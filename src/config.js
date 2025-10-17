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

// If YT_COOKIES is provided as an environment variable (useful for Render secrets), write it to the configured cookies path
try {
    const cookiesEnv = process.env.YT_COOKIES;
    if (cookiesEnv && cookiesEnv.trim().length > 0) {
        const cookiesPath = path.resolve(config.paths.cookies || './cookies.txt');
        fs.writeFileSync(cookiesPath, cookiesEnv, { encoding: 'utf8' });
        try { if (process.platform !== 'win32') fs.chmodSync(cookiesPath, 0o600); } catch (e) {}
        // eslint-disable-next-line no-console
        console.log('Wrote cookies from YT_COOKIES to', cookiesPath);
    }
} catch (err) {
    // eslint-disable-next-line no-console
    console.log('Failed to write YT_COOKIES to file:', err && err.message ? err.message : err);
}

// Log cookies file status for easier debugging on deploy platforms (Render)
try {
    const cookiesPath = path.resolve(config.paths.cookies || './cookies.txt');
    if (fs.existsSync(cookiesPath)) {
        const size = fs.statSync(cookiesPath).size;
        // eslint-disable-next-line no-console
        console.log(`Cookies file present at ${cookiesPath} (size=${size} bytes)`);
    } else {
        // eslint-disable-next-line no-console
        console.log(`Cookies file not found at ${cookiesPath}`);
    }
} catch (e) {
    // eslint-disable-next-line no-console
    console.log('Error checking cookies file:', e && e.message ? e.message : e);
}

module.exports = config;
