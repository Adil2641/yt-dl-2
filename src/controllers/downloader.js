const path = require('path');
const Cache = require('../models/cache');
const fs = require('fs');
const config = require('../config');
const Scraper = require('../lib/scraper');

const CACHE_DIR = path.join(__dirname, '../../cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

class DownloaderController {

    async downloadVideo(req, res) {
        let responded = false;
        const videoUrl = req.query.url;
        const quality = req.query.quality || 'best';
        console.log('Starting video download:', {
            url: videoUrl,
            quality: quality,
            timestamp: new Date().toISOString()
        });
        if (!videoUrl) {
            console.error('Download failed: Missing URL');
            return res.status(400).json({ error: 'Missing YouTube URL.' });
        }
        const cookiesPath = path.join(__dirname, '../../cookies.txt');
    const cookiesExist = fs.existsSync(cookiesPath) && fs.statSync(cookiesPath).size > 0;
        res.header('Content-Disposition', `attachment; filename="video.mp4"`);
        let totalSize = 0;
        let downloaded = 0;
        let percent = 0;
        let lastPercent = -1;
        let videoId = null;
        try {
            if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
                videoId = videoUrl;
            } else {
                const match = videoUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                if (match) videoId = match[1];
                else if (videoUrl.includes('youtube.com/shorts')) {
                    const m = videoUrl.match(/shorts\/([a-zA-Z0-9_-]{11})/);
                    if (m) videoId = m[1];
                } else if (videoUrl.includes('youtu.be/')) {
                    const m = videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                    if (m) videoId = m[1];
                }
            }
        } catch (e) {
            console.error('URL parsing error:', e);
        }
        if (!videoId || videoId.length !== 11) {
            return res.status(400).json({ error: 'Invalid YouTube video URL or ID.' });
        }
        const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
        // Always use info cache to get correct audio+video format
        let formatArg = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        if (quality && quality !== 'best') {
            // Try to get info from cache (fast)
            let info = null;
            const cacheHit = await Cache.findOne({ videoId, type: 'info' });
            if (cacheHit && cacheHit.info && Array.isArray(cacheHit.info.formats)) {
                info = cacheHit.info;
            } else {
                // Fallback: fetch info from our scraper adapter
                try {
                    info = await Scraper.getInfo(cleanUrl, { cookies: cookiesExist ? cookiesPath : undefined });
                } catch (e) { /* ignore and continue */ }
            }
            if (info) {
                const selectedFormat = (info.formats || []).find(f => f.format_id === quality);
                if (selectedFormat) {
                    if (selectedFormat.vcodec !== 'none' && selectedFormat.acodec !== 'none') {
                        formatArg = quality;
                    } else if (selectedFormat.vcodec !== 'none' && selectedFormat.acodec === 'none') {
                        formatArg = `${quality}+bestaudio[ext=m4a]/bestaudio/best`;
                    } else {
                        formatArg = quality;
                    }
                }
            }
        }
        // Check cache in MongoDB and on disk (serve from cache if available)
        const cacheHit = await Cache.findOne({ videoId, type: 'video', quality });
        if (cacheHit && cacheHit.filePath && fs.existsSync(cacheHit.filePath)) {
            res.setHeader('Content-Type', cacheHit.contentType || 'video/mp4');
            res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
            return fs.createReadStream(cacheHit.filePath).pipe(res);
        }
        // Use scraper adapter to stream the selected format
        try {
            const filePath = path.join(CACHE_DIR, `${videoId}_${quality}_video.mp4`);
            const stream = await Scraper.downloadStream(cleanUrl, { format: formatArg, type: 'video', cookies: cookiesExist ? cookiesPath : undefined });
            if (!stream) {
                return res.status(500).json({ error: 'Failed to create download stream.' });
            }
            const fileStream = fs.createWriteStream(filePath);
            let streamErrored = false;
            stream.on('error', (err) => { streamErrored = true; console.error('stream error:', err); });
            stream.pipe(fileStream);
            // Timeout handling
            let finished = false;
            const timeout = setTimeout(() => {
                if (!finished && !res.headersSent) {
                    console.error('Timeout: download took too long.');
                    stream.destroy && stream.destroy();
                }
            }, 30000);
            fileStream.on('finish', async () => {
                finished = true;
                clearTimeout(timeout);
                if (streamErrored) return res.status(500).json({ error: 'Stream failed during download.' });
                await Cache.findOneAndUpdate(
                    { videoId, type: 'video', quality },
                    { $set: { filePath, contentType: 'video/mp4', createdAt: new Date() } },
                    { upsert: true }
                );
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', 'video/mp4');
                    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
                    return fs.createReadStream(filePath).pipe(res);
                } else {
                    return res.status(500).json({ error: 'File not found after download.' });
                }
            });
            fileStream.on('error', (err) => {
                clearTimeout(timeout);
                console.error('file write error:', err);
            });
        } catch (err) {
            console.error('Video download error:', {
                error: err.message,
                stack: err.stack,
                url: videoUrl,
                quality: quality,
                timestamp: new Date().toISOString(),
                errorType: err.name,
                errorCode: err.code
            });
            return res.status(500).json({ 
                error: 'Failed to download video.', 
                details: err.message,
                errorType: err.name,
                errorCode: err.code
            });
        }
    }

    async downloadAudio(req, res) {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            return res.status(400).json({ error: 'Missing YouTube URL.' });
        }

    const cookiesPath = path.join(__dirname, '../../cookies.txt');
    const cookiesExist = fs.existsSync(cookiesPath) && fs.statSync(cookiesPath).size > 0;
    res.header('Content-Disposition', 'attachment; filename="audio.mp3"');
        console.log('Audio download started for:', videoUrl);
        // Extract videoId for cache
        let videoId = null;
        try {
            if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
                videoId = videoUrl;
            } else {
                const match = videoUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                if (match) videoId = match[1];
                else if (videoUrl.includes('youtube.com/shorts')) {
                    const m = videoUrl.match(/shorts\/([a-zA-Z0-9_-]{11})/);
                    if (m) videoId = m[1];
                } else if (videoUrl.includes('youtu.be/')) {
                    const m = videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                    if (m) videoId = m[1];
                }
            }
        } catch (e) {}
        // Check cache in MongoDB and on disk
        const cacheHit = videoId ? await Cache.findOne({ videoId, type: 'audio', quality: 'mp3' }) : null;
        if (cacheHit && cacheHit.filePath && fs.existsSync(cacheHit.filePath)) {
            res.setHeader('Content-Type', cacheHit.contentType || 'audio/mp3');
            res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
            return fs.createReadStream(cacheHit.filePath).pipe(res);
        }
        // Use scraper adapter to download audio. We pass requested audio format (mp3) as hint.
        try {
            const filePath = path.join(CACHE_DIR, `${videoId || 'unknown'}_mp3_audio.mp3`);
            const stream = await Scraper.downloadStream(videoUrl, { format: 'bestaudio', type: 'audio', audioFormat: 'mp3', cookies: cookiesExist ? cookiesPath : undefined });
            if (!stream) return res.status(500).json({ error: 'Failed to create audio stream.' });
            const fileStream = fs.createWriteStream(filePath);
            let streamErrored = false;
            stream.on('error', (err) => { streamErrored = true; console.error('audio stream error:', err); });
            stream.pipe(fileStream);
            let finished = false;
            const timeout = setTimeout(() => {
                if (!finished && !res.headersSent) {
                    console.error('Timeout: audio download took too long.');
                    stream.destroy && stream.destroy();
                }
            }, 30000);
            fileStream.on('finish', async () => {
                finished = true;
                clearTimeout(timeout);
                if (streamErrored) return res.status(500).json({ error: 'Stream failed during audio download.' });
                await Cache.findOneAndUpdate(
                    { videoId, type: 'audio', quality: 'mp3' },
                    { $set: { filePath, contentType: 'audio/mp3', createdAt: new Date() } },
                    { upsert: true }
                );
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', 'audio/mp3');
                    res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
                    return fs.createReadStream(filePath).pipe(res);
                } else {
                    return res.status(500).json({ error: 'File not found after download.' });
                }
            });
            fileStream.on('error', (err) => {
                clearTimeout(timeout);
                console.error('audio file write error:', err);
            });
        } catch (err) {
            console.error('downloadAudio error:', err);
            return res.status(500).json({ error: 'Failed to download audio.', details: err.message });
        }
    }

    async downloadShorts(req, res) {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            return res.status(400).json({ error: 'Missing YouTube Shorts URL.' });
        }

    const cookiesPath = path.join(__dirname, '../../cookies.txt');
    const cookiesExist = fs.existsSync(cookiesPath) && fs.statSync(cookiesPath).size > 0;
    res.header('Content-Disposition', 'attachment; filename="shorts.mp4"');
        console.log('Shorts download started for:', videoUrl);
        try {
            const filePath = path.join(CACHE_DIR, `shorts_${Date.now()}.mp4`);
            const stream = await Scraper.downloadStream(videoUrl, { format: 'best[ext=mp4]/best', type: 'video', cookies: cookiesExist ? cookiesPath : undefined });
            if (!stream) return res.status(500).json({ error: 'Failed to create shorts stream.' });
            const fileStream = fs.createWriteStream(filePath);
            let streamErrored = false;
            stream.on('error', (err) => { streamErrored = true; console.error('shorts stream error:', err); });
            stream.pipe(fileStream);
            const timeout = setTimeout(() => {
                if (!streamErrored && !res.headersSent) {
                    console.error('Timeout: shorts download took too long.');
                    stream.destroy && stream.destroy();
                }
            }, 30000);
            fileStream.on('finish', () => {
                clearTimeout(timeout);
                if (streamErrored) return res.status(500).json({ error: 'Shorts stream failed during download.' });
                if (fs.existsSync(filePath)) {
                    res.setHeader('Content-Type', 'video/mp4');
                    res.setHeader('Content-Disposition', 'attachment; filename="shorts.mp4"');
                    return fs.createReadStream(filePath).pipe(res);
                }
                return res.status(500).json({ error: 'File not found after shorts download.' });
            });
            fileStream.on('error', (err) => { console.error('shorts file write error:', err); });
        } catch (err) {
            console.error('downloadShorts error:', err);
            return res.status(500).json({ error: 'Failed to download shorts.', details: err.message });
        }
    }

    async getVideoInfo(req, res) {
        const videoUrl = req.query.url;
        console.log('Video info request received:', {
            url: videoUrl,
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
            ip: req.ip
        });
        if (!videoUrl) {
            console.error('Info request failed: Missing URL');
            return res.status(400).json({ error: 'Missing YouTube URL.' });
        }

        // Robustly extract video ID from any YouTube URL (shorts, normal, youtu.be, etc.)
        let videoId = null;
        try {
            if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
                videoId = videoUrl;
            } else if (videoUrl.includes('youtube.com/shorts')) {
                const match = videoUrl.match(/shorts\/([a-zA-Z0-9_-]{11})/);
                if (match) videoId = match[1];
            } else if (videoUrl.includes('youtu.be/')) {
                const match = videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                if (match) videoId = match[1];
            } else if (videoUrl.includes('youtube.com')) {
                const urlObj = new URL(videoUrl);
                videoId = urlObj.searchParams.get('v');
            }
        } catch (e) {
            console.error('URL parsing error:', e);
        }
        if (!videoId || videoId.length !== 11) {
            return res.status(400).json({ error: 'Invalid YouTube video URL or ID.' });
        }
        const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const cookiesPath = path.join(__dirname, '../../cookies.txt');
    const cookiesExist = fs.existsSync(cookiesPath) && fs.statSync(cookiesPath).size > 0;
    // Check cache first
        const cacheHit = await Cache.findOne({ videoId, type: 'info' });
        if (cacheHit && cacheHit.info) {
            const info = cacheHit.info;
            return res.json({
                title: info.title,
                description: info.description,
                duration: info.duration,
                views: info.view_count, // <-- add this alias for frontend
                view_count: info.view_count, // keep for admin
                thumbnail: (info.thumbnails && info.thumbnails.length > 0) ? info.thumbnails[info.thumbnails.length - 1].url : '',
                formats: (info.formats || []).map(f => ({
                    itag: f.format_id,
                    ext: f.ext,
                    resolution: f.resolution || '',
                    qualityLabel: f.quality_label || f.format_note || '',
                    filesize: f.filesize || f.filesize_approx || null,
                    hasAudio: f.acodec !== 'none',
                    hasVideo: f.vcodec !== 'none'
                }))
            });
        }
        try {
            const info = await Scraper.getInfo(cleanUrl, { cookies: cookiesExist ? cookiesPath : undefined });
            if (!info) return res.status(500).json({ error: 'Failed to fetch video info.' });
            await Cache.findOneAndUpdate(
                { videoId, type: 'info' },
                { $set: { info, createdAt: new Date() } },
                { upsert: true }
            );
            return res.json({
                title: info.title,
                description: info.description,
                duration: info.duration,
                views: info.view_count,
                view_count: info.view_count,
                thumbnail: (info.thumbnails && info.thumbnails.length > 0) ? info.thumbnails[info.thumbnails.length - 1].url : '',
                formats: (info.formats || []).map(f => ({
                    itag: f.format_id,
                    ext: f.ext,
                    resolution: f.resolution || '',
                    qualityLabel: f.quality_label || f.format_note || '',
                    filesize: f.filesize || f.filesize_approx || null,
                    hasAudio: f.acodec !== 'none',
                    hasVideo: f.vcodec !== 'none'
                }))
            });
        } catch (err) {
            console.error('Video info fetch error:', {
                error: err.message,
                stack: err.stack,
                url: videoUrl,
                timestamp: new Date().toISOString()
            });
            res.status(500).json({ 
                error: 'Failed to fetch video info.', 
                details: err.message,
                errorType: err.name,
                errorCode: err.code
            });
        }
    }
}

module.exports = DownloaderController;