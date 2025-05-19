const mongoose = require('mongoose');

const cacheSchema = new mongoose.Schema({
    videoId: { type: String, required: true },
    type: { type: String, enum: ['video', 'audio', 'info'], required: true },
    quality: { type: String }, // for video/audio
    data: { type: Buffer }, // for video/audio
    info: { type: mongoose.Schema.Types.Mixed }, // for info
    contentType: { type: String }, // e.g. 'video/mp4', 'audio/mp3'
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 } // 30 days TTL
});

cacheSchema.index({ videoId: 1, type: 1, quality: 1 }, { unique: true });

module.exports = mongoose.model('Cache', cacheSchema);
