const express = require('express');
const downloadRoutes = require('./routes/download');
const path = require('path');
const mongoose = require('mongoose');
const Feedback = require('./models/feedback');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yt-dl-2')
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });

// Admin authentication middleware (simple, for demo)
function adminAuth(req, res, next) {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey === process.env.ADMIN_KEY) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

app.use(express.json());
app.use('/api', downloadRoutes);
app.use(express.static(path.join(__dirname, '../public')));

// Feedback submission endpoint (no email, just store)
app.post('/api/feedback', async (req, res) => {
    const { name, message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }
    try {
        const feedback = new Feedback({ name: name || '', message });
        await feedback.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save feedback.' });
    }
});

// Admin-only endpoint to view feedbacks with search, filter, and pagination
app.get('/api/admin/feedbacks', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', sort = 'date', order = 'desc' } = req.query;
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }
        const total = await Feedback.countDocuments(query);
        const feedbacks = await Feedback.find(query)
            .sort({ [sort]: order === 'asc' ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));
        res.json({ feedbacks, total });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch feedbacks.' });
    }
});

// Export feedbacks as CSV or JSON
app.get('/api/admin/feedbacks-export', adminAuth, async (req, res) => {
    try {
        const { format = 'json', search = '' } = req.query;
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }
        const feedbacks = await Feedback.find(query).sort({ date: -1 });
        if (format === 'csv') {
            const csv = [
                'Name,Message,Date',
                ...feedbacks.map(fb => `"${fb.name}","${fb.message.replace(/"/g, '""')}","${fb.date.toISOString()}"`)
            ].join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="feedbacks.csv"');
            res.send(csv);
        } else {
            res.json(feedbacks);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to export feedbacks.' });
    }
});

// Multi-delete feedbacks
app.post('/api/admin/feedbacks/delete-multi', adminAuth, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No IDs provided.' });
        await Feedback.deleteMany({ _id: { $in: ids } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete feedbacks.' });
    }
});

// Feedback statistics
app.get('/api/admin/feedbacks-stats', adminAuth, async (req, res) => {
    try {
        const total = await Feedback.countDocuments();
        const perDay = await Feedback.aggregate([
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, count: { $sum: 1 } } },
            { $sort: { _id: -1 } }
        ]);
        const perWeek = await Feedback.aggregate([
            { $group: { _id: { $isoWeek: "$date" }, count: { $sum: 1 } } },
            { $sort: { _id: -1 } }
        ]);
        // Most common words in feedback messages
        const all = await Feedback.find({}, 'message');
        const wordCount = {};
        all.forEach(fb => {
            (fb.message || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).forEach(word => {
                if (word.length > 2) wordCount[word] = (wordCount[word] || 0) + 1;
            });
        });
        const commonWords = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
        res.json({ total, perDay, perWeek, commonWords });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get stats.' });
    }
});

// In-memory admin activity log
const adminActivityLog = [];
function logAdminActivity(action, detail, req) {
    adminActivityLog.push({
        time: new Date(),
        action,
        detail,
        ip: req.ip
    });
    if (adminActivityLog.length > 1000) adminActivityLog.shift();
}

// Log admin actions for feedback delete, multi-delete, export, login
app.delete('/api/admin/feedbacks/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await Feedback.findByIdAndDelete(id);
        logAdminActivity('delete', `Deleted feedback ${id}`, req);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete feedback.' });
    }
});
app.post('/api/admin/feedbacks/delete-multi', adminAuth, async (req, res, next) => {
    logAdminActivity('multi-delete', `Deleted feedbacks: ${req.body.ids && req.body.ids.join(',')}`, req);
    next();
});
app.get('/api/admin/feedbacks-export', adminAuth, (req, res, next) => {
    logAdminActivity('export', `Exported feedbacks as ${req.query.format || 'json'}`, req);
    next();
});
// Admin login activity (simulate on feedbacks fetch)
app.get('/api/admin/feedbacks', adminAuth, (req, res, next) => {
    logAdminActivity('login', 'Viewed feedbacks', req);
    next();
});
// Get admin activity log
app.get('/api/admin/activity-log', adminAuth, (req, res) => {
    res.json(adminActivityLog.slice().reverse());
});

// Uptime endpoint
app.get('/api/uptime', (req, res) => {
    const uptimeSeconds = process.uptime();
    res.json({ uptime: uptimeSeconds });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});