import express from 'express';
import upload from '../middleware/upload.js';
import * as filesController from '../controllers/files.controller.js';

const router = express.Router();

// Upload
router.post('/upload', upload.array('files', 10), filesController.uploadFiles);

// Signed URL
router.get('/:id/signed-url', filesController.getSignedUrlForFile);

export default router;
