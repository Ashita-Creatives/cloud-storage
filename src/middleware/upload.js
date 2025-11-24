import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  IMAGE_MIMES,
  VIDEO_MIMES,
  AUDIO_MIMES,
  GIF_MIMES,
  DOC_MIMES
} from '../utils/mime.js';

const {
  TEMP_PATH = './temp',
  MAX_IMAGE_SIZE = 5 * 1024 * 1024,
  MAX_VIDEO_SIZE = 100 * 1024 * 1024,
  MAX_AUDIO_SIZE = 20 * 1024 * 1024,
  MAX_GIF_SIZE = 10 * 1024 * 1024,
  MAX_DOC_SIZE = 10 * 1024 * 1024
} = process.env;

fs.mkdirSync(TEMP_PATH, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_PATH);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuidv4()}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const mime = file.mimetype;
  if (
    IMAGE_MIMES.includes(mime) ||
    VIDEO_MIMES.includes(mime) ||
    AUDIO_MIMES.includes(mime) ||
    GIF_MIMES.includes(mime) ||
    DOC_MIMES.includes(mime)
  ) {
    return cb(null, true);
  }
  cb(new Error('Unsupported file type'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 10
    // Do not set size here; we'll validate per-file post-upload according to mime
  }
});

export default upload;
