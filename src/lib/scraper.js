const http = require('http');
const https = require('https');
const ytdl = require('ytdl-core');

// Defensive loader for @vreden/youtube_scraper
let scraperPkg = null;
try {
  scraperPkg = require('@vreden/youtube_scraper');
} catch (e) {
  scraperPkg = null;
}

function httpGetStream(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      resolve(res);
    });
    req.on('error', reject);
  });
}

async function getInfo(url, opts = {}) {
  console.log('Starting video info retrieval...');
  // If vreden scraper is available, use its metadata API
  if (scraperPkg && typeof scraperPkg.metadata === 'function') {
    console.log('Using @vreden/youtube_scraper for metadata...');
    try {
      const meta = await scraperPkg.metadata(url);
      // normalize to shape expected by controllers
      const formats = [];
      // Common supported qualities (from lowest to highest)
      const commonQualities = [
        { height: 144, label: '144p' },
        { height: 240, label: '240p' },
        { height: 360, label: '360p' },
        { height: 480, label: '480p' },
        { height: 720, label: 'HD 720p' },
        { height: 1080, label: 'Full HD 1080p' },
        { height: 1440, label: 'QHD 1440p' },
        { height: 2160, label: '4K 2160p' }
      ];
      const defaultAudioQualities = [128, 192, 256, 320];

      // Determine available qualities from metadata
      let availableQualities = new Set();
      
      // Check various metadata paths for quality information
      if (meta?.download?.availableQualityVideo?.length) {
        meta.download.availableQualityVideo.forEach(q => availableQualities.add(Number(q)));
      }
      if (meta?.download?.availableQuality?.length) {
        meta.download.availableQuality.forEach(q => availableQualities.add(Number(q)));
      }
      if (meta?.formats?.length) {
        meta.formats.forEach(f => {
          if (f.height) availableQualities.add(Number(f.height));
          if (f.qualityLabel) {
            const match = f.qualityLabel.match(/(\d+)p/);
            if (match) availableQualities.add(Number(match[1]));
          }
        });
      }

      // If no qualities detected, use common qualities
      if (availableQualities.size === 0) {
        availableQualities = new Set(commonQualities.map(q => q.height));
      }

      // Sort qualities in ascending order
      const videoQualities = Array.from(availableQualities).sort((a, b) => a - b);

      // Create format entries for each quality
      videoQualities.forEach(height => {
        const quality = commonQualities.find(q => q.height === height) || { height, label: `${height}p` };
        formats.push({
          format_id: String(height),
          ext: 'mp4',
          vcodec: 'avc1',
          acodec: 'aac',
          filesize: null,
          url: null,
          height: height,
          width: Math.round(height * 16 / 9),
          resolution: quality.label,
          quality_label: quality.label,
          hasVideo: true,
          hasAudio: true
        });
      });

      // Always ensure at least 360p is available as fallback
      if (formats.length === 0) {
        formats.push({
          format_id: '360',
          ext: 'mp4',
          vcodec: 'avc1',
          acodec: 'aac',
          filesize: null,
          url: null,
          height: 360,
          width: 640,
          resolution: '360p',
          quality_label: '360p',
          hasVideo: true,
          hasAudio: true
        });
      }

      // Get or set audio qualities
      const audioQualities = (meta?.download?.availableQualityAudio?.length)
        ? meta.download.availableQualityAudio
        : defaultAudioQualities;

      console.log('Video metadata retrieved successfully');
      console.log('Available video qualities:', videoQualities);
      console.log('Available audio qualities:', audioQualities);
      console.log('Number of formats:', formats.length);

      return {
        title: meta && meta.metadata ? meta.metadata.title : (meta && meta.title) || '',
        description: meta && meta.metadata ? (meta.metadata.description || '') : (meta && meta.description) || '',
        duration: (meta && meta.metadata && meta.metadata.seconds) ? Number(meta.metadata.seconds) : (meta && meta.seconds) || 0,
        view_count: (meta && meta.metadata && meta.metadata.views) ? Number(meta.metadata.views) : (meta && meta.views) || 0,
        thumbnails: (meta && meta.metadata && meta.metadata.thumbnails) ? meta.metadata.thumbnails : (meta && meta.thumbnails) ? meta.thumbnails : [],
        formats,
        audioQualities,
        videoQualities
      };
    } catch (error) {
      console.error('Error in @vreden/youtube_scraper metadata:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        url: url
      });
      // Continue to fallback
    }
    console.log('Falling back to ytdl-core...');

    return {
      title: meta && meta.metadata ? meta.metadata.title : (meta && meta.title) || '',
      description: meta && meta.metadata ? (meta.metadata.description || '') : (meta && meta.description) || '',
      duration: (meta && meta.metadata && meta.metadata.seconds) ? Number(meta.metadata.seconds) : (meta && meta.seconds) || 0,
      view_count: (meta && meta.metadata && meta.metadata.views) ? Number(meta.metadata.views) : (meta && meta.views) || 0,
      thumbnails: (meta && meta.metadata && meta.metadata.thumbnails) ? meta.metadata.thumbnails : (meta && meta.thumbnails) ? meta.thumbnails : [],
      formats,
      audioQualities,
      videoQualities
    };
  }

  // Fallback to ytdl-core
  const info = await ytdl.getInfo(url);
  const formats = (info && info.formats) ? info.formats.map(f => ({
    format_id: String(f.itag || f.format_id || ''),
    ext: f.container || '',
    vcodec: f.codec || (f.hasVideo ? 'avc1' : 'none'),
    acodec: f.hasAudio ? 'aac' : 'none',
    filesize: f.contentLength ? Number(f.contentLength) : (f.bitrate || null),
    url: f.url || null,
    resolution: f.qualityLabel || ''
  })) : [];
  return {
    title: info.videoDetails ? info.videoDetails.title : '',
    description: info.videoDetails ? info.videoDetails.shortDescription : '',
    duration: info.videoDetails ? Number(info.videoDetails.lengthSeconds || 0) : 0,
    view_count: info.videoDetails ? Number(info.videoDetails.viewCount || 0) : 0,
    thumbnails: (info.videoDetails && info.videoDetails.thumbnails) ? info.videoDetails.thumbnails : [],
    formats
  };
}

async function downloadStream(url, opts = {}) {
  console.log('Starting download with options:', opts);
  
  // Get video info first to ensure we have the correct formats
  const info = await getInfo(url, opts);
  if (!info) throw new Error('Failed to get video information');
  
  // opts: { format, type: 'video'|'audio'|'auto', quality (number), audioFormat }
  if (scraperPkg) {
    try {
      // Audio download
      if (opts.type === 'audio' || (opts.audioFormat && opts.audioFormat.toLowerCase() === 'mp3')) {
        console.log('Starting audio download...');
        const quality = opts.quality || 128;
        
        // Verify quality is available
        if (info.audioQualities && !info.audioQualities.includes(Number(quality))) {
          console.warn(`Requested audio quality ${quality} not available, using closest match`);
          // Find closest available quality
          const available = info.audioQualities.sort((a, b) => a - b);
          const closest = available.reduce((prev, curr) => 
            Math.abs(curr - quality) < Math.abs(prev - quality) ? curr : prev
          );
          opts.quality = closest;
        }

        // Try ytmp3 first
        if (typeof scraperPkg.ytmp3 === 'function') {
          console.log('Using ytmp3 with quality:', opts.quality);
          const result = await scraperPkg.ytmp3(url, opts.quality);
          const downloadUrl = result?.download?.url || result?.url;
          if (downloadUrl) return await httpGetStream(downloadUrl);
        }

        // Fallback to apimp3
        if (typeof scraperPkg.apimp3 === 'function') {
          console.log('Falling back to apimp3...');
          const result = await scraperPkg.apimp3(url, opts.quality);
          const downloadUrl = result?.download?.url || result?.url;
          if (downloadUrl) return await httpGetStream(downloadUrl);
        }
      }

      // Video download
      if (opts.type === 'video' || !opts.type) {
        console.log('Starting video download...');
        
        // Parse requested quality
        let requestedQuality = 360; // default
        if (opts.format) {
          const m = String(opts.format).match(/(\d{3,4})/);
          if (m) requestedQuality = Number(m[1]);
        }
        
        // Verify quality is available
        if (info.videoQualities && !info.videoQualities.includes(requestedQuality)) {
          console.warn(`Requested video quality ${requestedQuality}p not available, using closest match`);
          // Find closest available quality
          const available = info.videoQualities.sort((a, b) => a - b);
          const closest = available.reduce((prev, curr) => 
            Math.abs(curr - requestedQuality) < Math.abs(prev - requestedQuality) ? curr : prev
          );
          requestedQuality = closest;
        }
        
        console.log(`Attempting download with quality: ${requestedQuality}p`);

        // Try ytmp4 first
        if (typeof scraperPkg.ytmp4 === 'function') {
          try {
            console.log('Using ytmp4...');
            const result = await scraperPkg.ytmp4(url, requestedQuality);
            if (result?.download?.url || result?.url) {
              console.log('Got download URL from ytmp4');
              return await httpGetStream(result.download?.url || result.url);
            }
          } catch (e) {
            console.error('ytmp4 error:', e);
          }
        }

        // Fallback to apimp4
        if (typeof scraperPkg.apimp4 === 'function') {
          try {
            console.log('Falling back to apimp4...');
            const result = await scraperPkg.apimp4(url, requestedQuality);
            if (result?.download?.url || result?.url) {
              console.log('Got download URL from apimp4');
              return await httpGetStream(result.download?.url || result.url);
            }
          } catch (e) {
            console.error('apimp4 error:', e);
          }
        }
      }
    } catch (e) {
      // If the scraper's download helper fails, fallback to other approaches
      console.error('scraperPkg download helper error:', e && e.message ? e.message : e);
    }
  }

  // Fallback: try to resolve a direct format URL from metadata and stream it
  try {
    const info = await getInfo(url, opts);
    if (info && Array.isArray(info.formats) && info.formats.length) {
      let chosen = null;
      if (opts.format) chosen = info.formats.find(f => String(f.format_id) === String(opts.format));
      if (!chosen) chosen = info.formats.find(f => f.vcodec !== 'none' && f.acodec !== 'none') || info.formats[0];
      if (chosen && chosen.url) return await httpGetStream(chosen.url);
    }
  } catch (e) {
    // ignore
  }

  // Last resort: use ytdl-core
  try {
    if (opts.format) {
      const itag = parseInt(opts.format, 10);
      if (!Number.isNaN(itag)) return ytdl(url, { quality: itag });
    }
    return ytdl(url, { highWaterMark: 1 << 25 });
  } catch (e) {
    throw new Error('Failed to create download stream: ' + (e && e.message ? e.message : e));
  }
}

module.exports = {
  getInfo,
  downloadStream
};
