const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
const root = path.join(__dirname, '..');
const ytdlpPath = os.platform() === 'win32' ? path.join(root, 'yt-dlp.exe') : path.join(root, 'yt-dlp');

function downloadYtDlp() {
  if (fs.existsSync(ytdlpPath)) {
    console.log('yt-dlp already exists:', ytdlpPath);
    return;
  }
  if (os.platform() === 'win32') {
    execSync(`curl -L ${ytdlpUrl} -o "${ytdlpPath}"`, { stdio: 'inherit' });
  } else {
    execSync(`curl -L ${ytdlpUrl} -o "${ytdlpPath}"`, { stdio: 'inherit' });
    fs.chmodSync(ytdlpPath, 0o755);
  }
}

try {
  downloadYtDlp();
  console.log('yt-dlp downloaded successfully.');
} catch (e) {
  console.error('Failed to download yt-dlp:', e);
  process.exit(1);
}
