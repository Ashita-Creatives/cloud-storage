import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { buckets } from './storageLocal.service.js';

const CACHE_DIR = process.env.IMAGE_CACHE_PATH || buckets.cache;

fs.mkdirSync(CACHE_DIR, { recursive: true });

function cacheName(keyObject) {
  const s = JSON.stringify(keyObject);
  return crypto.createHash('md5').update(s).digest('hex');
}

/**
 * Generate a cached transformed image.
 * options: { width, height, fit, format }
 * sourcePath: absolute path to original image
 * returns absolute path to cached image
 */
export async function transformImage(sourcePath, options = {}) {
  const key = cacheName({ sourcePath, options });
  const ext = options.format
    ? `.${options.format}`
    : path.extname(sourcePath) || '.webp';
  const out = path.join(CACHE_DIR, `${key}${ext}`);
  if (fs.existsSync(out)) return out;

  let pipeline = sharp(sourcePath);
  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width || null, options.height || null, {
      fit: options.fit || 'cover'
    });
  }
  if (options.format) {
    pipeline = pipeline.toFormat(options.format);
  } else {
    pipeline = pipeline.toFormat('webp');
  }
  await pipeline.toFile(out);
  return out;
}

/**
 * Create thumbnail (small webp)
 */
export async function createThumbnail(sourcePath, width = 300) {
  return transformImage(sourcePath, { width, format: 'webp', fit: 'cover' });
}
