const express = require('express');
const router = express.Router();
const DownloaderController = require('../controllers/downloader');

const downloaderController = new DownloaderController();

router.get('/video-download', downloaderController.downloadVideo.bind(downloaderController));
router.get('/audio-download', downloaderController.downloadAudio.bind(downloaderController));
router.get('/video-info', downloaderController.getVideoInfo.bind(downloaderController));
router.get('/shorts-download', downloaderController.downloadShorts.bind(downloaderController));

module.exports = router;