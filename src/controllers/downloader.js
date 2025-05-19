const { spawn } = require('child_process');
const path = require('path');
const ytdl = require('ytdl-core');

class DownloaderController {
    // Use correct yt-dlp binary for platform
    getYtDlpPath() {
        if (process.platform === 'win32') {
            return path.join(__dirname, '../../yt-dlp.exe');
        } else {
            return path.join(__dirname, '../../yt-dlp');
        }
    }

    async downloadVideo(req, res) {
        const videoUrl = req.query.url;
        const quality = req.query.quality || 'best';
        if (!videoUrl) {
            return res.status(400).json({ error: 'Missing YouTube URL.' });
        }
        const ytdlpPath = this.getYtDlpPath();
        const cookiesPath = path.join(__dirname, '../../cookies.txt');
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
        // Use selected quality if provided, otherwise best available
        const formatArg = quality && quality !== 'best' ? quality : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        const ytdlp = spawn(ytdlpPath, [
            '--cookies', cookiesPath,
            '-o', '-',
            '-f', formatArg,
            '--concurrent-fragments', '8',
            '--no-playlist',
            '--quiet',
            cleanUrl
        ]);
        ytdlp.stdout.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize > 0) {
                percent = Math.floor((downloaded / totalSize) * 100);
                if (percent !== lastPercent) {
                    process.stdout.write(`\rDownload: ${percent}% (${(downloaded/1048576).toFixed(2)}MB/${(totalSize/1048576).toFixed(2)}MB)`);
                    lastPercent = percent;
                }
            } else {
                process.stdout.write(`\rDownloaded: ${(downloaded/1048576).toFixed(2)} MB (no total size)`);
            }
        });
        ytdlp.stdout.pipe(res);
        ytdlp.stderr.on('data', (data) => {
            console.error(`yt-dlp error: ${data}`);
        });
        ytdlp.on('error', (err) => {
            console.error(err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to start yt-dlp.' });
            }
        });
        ytdlp.on('close', (code) => {
            if (totalSize > 0) process.stdout.write('\n');
            console.log(`\n--- Video download process finished for: ${videoUrl} ---`);
            if (code !== 0 && !res.headersSent) {
                res.status(500).json({ error: 'yt-dlp failed to download video.' });
            }
        });
    }

    async downloadAudio(req, res) {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            return res.status(400).json({ error: 'Missing YouTube URL.' });
        }

        const ytdlpPath = this.getYtDlpPath();
        const cookiesPath = path.join(__dirname, '../../cookies.txt');
        res.header('Content-Disposition', 'attachment; filename="audio.mp3"');
        console.log('Download started for:', videoUrl);
        const ytdlp = spawn(ytdlpPath, [
            '--cookies', cookiesPath,
            '-o', '-', // output to stdout
            '-f', 'bestaudio[ext=mp3]/bestaudio/best', // best audio only, prefer mp3
            '--quiet',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--no-playlist',
            videoUrl
        ]);
        let totalSize = 0;
        let downloaded = 0;
        let percent = 0;
        let lastPercent = -1;
        ytdlp.stdout.on('data', (chunk) => {
            downloaded += chunk.length;
            if (totalSize > 0) {
                percent = Math.floor((downloaded / totalSize) * 100);
                if (percent !== lastPercent) {
                    process.stdout.write(`\rAudio Download: ${percent}% (${(downloaded/1048576).toFixed(2)}MB/${(totalSize/1048576).toFixed(2)}MB)`);
                    lastPercent = percent;
                }
            } else {
                process.stdout.write(`\rAudio Downloaded: ${(downloaded/1048576).toFixed(2)} MB (no total size)`);
            }
        });
        ytdlp.stdout.pipe(res);

        ytdlp.stderr.on('data', (data) => {
            console.error(`yt-dlp error: ${data}`);
        });

        ytdlp.on('error', (err) => {
            console.error(err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to start yt-dlp.' });
            }
        });

        ytdlp.on('close', (code) => {
            if (totalSize > 0) process.stdout.write('\n');
            console.log(`\n--- Audio download process finished for: ${videoUrl} ---`);
            if (code !== 0 && !res.headersSent) {
                res.status(500).json({ error: 'yt-dlp failed to download audio.' });
            }
        });
    }

    async downloadShorts(req, res) {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            return res.status(400).json({ error: 'Missing YouTube Shorts URL.' });
        }

        const ytdlpPath = this.getYtDlpPath();
        const cookiesPath = path.join(__dirname, '../../cookies.txt');

        res.header('Content-Disposition', 'attachment; filename="shorts.mp4"');
        console.log('Download started for:', videoUrl);
        const ytdlp = spawn(ytdlpPath, [
            '--cookies', cookiesPath,
            '-o', '-', // output to stdout
            '-f', 'best[ext=mp4]/best', // download the best single MP4 format
            '--quiet',
            '--no-playlist',
            videoUrl
        ]);

        ytdlp.stdout.pipe(res);

        ytdlp.stderr.on('data', (data) => {
            console.error(`yt-dlp error: ${data}`);
        });

        ytdlp.on('error', (err) => {
            console.error(err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to start yt-dlp.' });
            }
        });

        ytdlp.on('close', (code) => {
            if (code !== 0 && !res.headersSent) {
                res.status(500).json({ error: 'yt-dlp failed to download Shorts video.' });
            }
        });
    }

    async getVideoInfo(req, res) {
        const videoUrl = req.query.url;
        if (!videoUrl) {
            console.error('Missing YouTube URL.');
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

        const ytdlpPath = this.getYtDlpPath();
        const cookiesPath = path.join(__dirname, '../../cookies.txt');
        try {
            const ytdlp = spawn(ytdlpPath, [
                '--cookies', cookiesPath,
                '-j', // JSON output
                cleanUrl
            ]);
            let json = '';
            ytdlp.stdout.on('data', (data) => {
                json += data.toString();
                console.log('yt-dlp stdout:', data.toString());
            });
            ytdlp.stderr.on('data', (data) => {
                console.error('yt-dlp stderr:', data.toString());
            });
            ytdlp.on('error', (err) => {
                console.error('yt-dlp process error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to fetch video info.' });
                }
            });
            let timeout = setTimeout(() => {
                if (!res.headersSent) {
                    console.error('Timeout: yt-dlp took too long to respond.');
                    res.status(504).json({ error: 'Timeout: yt-dlp took too long to respond. Please check your URL or try again later.' });
                    ytdlp.kill('SIGKILL');
                }
            }, 30000); // 30 seconds timeout
            ytdlp.on('close', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    console.error(`yt-dlp exited with code ${code}`);
                    return res.status(500).json({ error: 'yt-dlp failed to fetch video info.' });
                }
                try {
                    const info = JSON.parse(json);
                    // Log all available formats for debugging
                    if (info.formats) {
                        console.log('Available formats:', info.formats.map(f => ({
                            format_id: f.format_id,
                            ext: f.ext,
                            vcodec: f.vcodec,
                            acodec: f.acodec,
                            resolution: f.resolution,
                            format_note: f.format_note,
                            filesize: f.filesize || f.filesize_approx || null
                        })));
                    }
                    res.json({
                        title: info.title,
                        thumbnail: (info.thumbnails && info.thumbnails.length > 0) ? info.thumbnails[info.thumbnails.length - 1].url : '',
                        duration: info.duration,
                        views: info.view_count,
                        isShorts: cleanUrl.includes('youtube.com/shorts') || cleanUrl.includes('youtu.be/shorts'),
                        qualities: (info.formats || []).map(f => ({
                            itag: f.format_id,
                            qualityLabel: f.resolution || f.format_note || f.format_id,
                            resolution: f.resolution || '',
                            ext: f.ext,
                            audio: f.acodec !== 'none',
                            video: f.vcodec !== 'none',
                            filesize: f.filesize || f.filesize_approx || null
                        }))
                    });
                } catch (err) {
                    console.error('yt-dlp parse error:', err, '\nRaw output:', json);
                    res.status(500).json({ error: 'Failed to parse yt-dlp output.' });
                }
            });
        } catch (err) {
            console.error('getVideoInfo error:', err);
            res.status(500).json({ error: 'Failed to fetch video info.', details: err.message });
        }
    }
}

module.exports = DownloaderController;