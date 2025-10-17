const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
let raw = {};
try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
    raw = {};
}

// Normalize and apply env overrides
const config = Object.assign({}, raw);
config.paths = config.paths || {};
config.paths.ytDlp = config.paths.ytDlp || { defaultUnix: './yt-dlp', defaultWin: './yt-dlp.exe' };
config.app = config.app || {};
config.app.port = process.env.PORT ? Number(process.env.PORT) : (config.app.port || 3000);
config.app.host = process.env.HOST || config.app.host || '0.0.0.0';
config.app.mode = process.env.RENDER === 'true' ? 'render' : (process.env.APP_MODE || config.app.mode || 'auto');
config.app.trustProxy = process.env.TRUST_PROXY ? (process.env.TRUST_PROXY === 'true') : (config.app.trustProxy || false);

// Helper to determine and prepare yt-dlp path
config.getYtDlpPath = function() {
    const isWin = process.platform === 'win32';
    let p;
    if (config.app.mode === 'render') {
        // prefer the unix binary when running on Render
        p = path.resolve(config.paths.ytDlp.defaultUnix);
    } else if (config.app.mode === 'window') {
        p = path.resolve(config.paths.ytDlp.defaultWin);
    } else {
        p = isWin ? path.resolve(config.paths.ytDlp.defaultWin) : path.resolve(config.paths.ytDlp.defaultUnix);
    }

    // Try to make executable on Unix/Render environments
    try {
        if (process.platform !== 'win32') {
            fs.chmodSync(p, 0o755);
        }
    } catch (err) {
        // Non-fatal: chmod may fail if file doesn't exist yet; caller will handle missing binary
        // log to console for visibility in render logs
        // Avoid throwing so postinstall can still run
        // eslint-disable-next-line no-console
        console.log('chmod (prepare yt-dlp) warning:', err.message || err);
    }

    return p;
};

module.exports = config;
