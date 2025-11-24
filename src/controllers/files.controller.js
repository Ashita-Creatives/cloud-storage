import File from '../models/file.model.js';
import * as storage from '../services/storageLocal.service.js';
import * as imageService from '../services/image.service.js';
import fs from 'fs';
import path from 'path';
import { IMAGE_MIMES } from '../utils/mime.js';

const {
  MAX_IMAGE_SIZE = 5 * 1024 * 1024,
  MAX_VIDEO_SIZE = 100 * 1024 * 1024,
  MAX_AUDIO_SIZE = 20 * 1024 * 1024,
  MAX_GIF_SIZE = 10 * 1024 * 1024,
  MAX_DOC_SIZE = 10 * 1024 * 1024,
  SIGNING_SECRET
} = process.env;

function getLimitForMime(mime) {
  if (IMAGE_MIMES.includes(mime)) return Number(MAX_IMAGE_SIZE);
  if (mime.startsWith('video/')) return Number(MAX_VIDEO_SIZE);
  if (mime.startsWith('audio/')) return Number(MAX_AUDIO_SIZE);
  if (mime === 'image/gif') return Number(MAX_GIF_SIZE);
  return Number(MAX_DOC_SIZE);
}

/**
 * UPLOAD FILES
 */
export async function uploadFiles(req, res) {
  try {
    const files = req.files || [];
    if (!files.length)
      return res.status(400).json({ error: 'No files uploaded' });

    const visibility = req.body.visibility === 'private' ? 'private' : 'public';
    const bucket = visibility;

    const saved = [];

    for (const f of files) {
      const limit = getLimitForMime(f.mimetype);

      if (f.size > limit) {
        try {
          fs.unlinkSync(f.path);
        } catch {}
        return res.status(413).json({
          error: `${f.originalname} exceeds max size`
        });
      }

      const { fullPath, relativePath } = await storage.saveFileToBucket(
        f,
        bucket
      );

      const meta = {};
      if (IMAGE_MIMES.includes(f.mimetype)) {
        try {
          const thumb = await imageService.createThumbnail(fullPath);
          meta.thumbnail = path
            .relative(process.env.STORAGE_ROOT || './storage', thumb)
            .replace(/\\/g, '/');
        } catch (err) {
          console.warn('Thumbnail error:', err);
        }
      }

      const doc = await File.create({
        owner: req.user?.id || null,
        originalName: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
        storagePath: relativePath,
        visibility,
        bucket,
        meta
      });

      saved.push(doc);
    }

    res.json({ files: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

/**
 * GET SIGNED URL FOR PRIVATE FILE
 */
export async function getSignedUrlForFile(req, res) {
  try {
    const id = req.params.id;
    const ttl = req.query.ttl ? Number(req.query.ttl) : undefined;

    const file = await File.findById(id);
    if (!file) return res.status(404).json({ error: 'Not found' });

    if (file.visibility !== 'private')
      return res.status(400).json({ error: 'File is not private' });

    const rel = file.storagePath;
    const { token, expires } = storage.generateSignedUrl(rel, ttl);

    const host = req.protocol + '://' + req.get('host');
    const url = `${host}/private/${rel}?token=${token}&expires=${expires}`;

    res.json({ url, token, expires });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create signed URL' });
  }
}

/**
 * SERVE PRIVATE FILE (SIGNED URL VALIDATION)
 *
 * Route: /private/:path(*)
 */
export async function servePrivateFile(req, res) {
  try {
    const relativePath = req.query.path;
    if (!relativePath)
      return res.status(400).json({ error: 'Missing ?path parameter' });

    const { token, expires } = req.query;

    const valid = storage.validateSignedToken(relativePath, token, expires);
    if (!valid)
      return res.status(403).json({ error: 'Invalid or expired token' });

    const fullPath = storage.resolveFullPath(relativePath);
    if (!fs.existsSync(fullPath))
      return res.status(404).json({ error: 'Not found' });

    const file = await File.findOne({ storagePath: relativePath });
    const mimeType = file?.mimeType || 'application/octet-stream';

    const rangeHeader = req.headers.range;
    return storage.streamFile(res, fullPath, mimeType, rangeHeader);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not serve file' });
  }
}

/**
 * TRANSFORM IMAGE (PUBLIC OR PRIVATE)
 *
 * Route: /transform/:path(*)
 */
export async function transformAndServe(req, res) {
  try {
    const relativePath = req.query.path;
    if (!relativePath)
      return res.status(400).json({ error: 'Missing ?path parameter' });

    const isPrivate = relativePath.startsWith('private/');

    if (isPrivate) {
      const { token, expires } = req.query;
      if (!storage.validateSignedToken(relativePath, token, expires)) {
        return res.status(403).json({ error: 'Invalid/expired token' });
      }
    }

    const fullPath = storage.resolveFullPath(relativePath);
    if (!fs.existsSync(fullPath))
      return res.status(404).json({ error: 'Not found' });

    const width = req.query.w ? parseInt(req.query.w, 10) : undefined;
    const height = req.query.h ? parseInt(req.query.h, 10) : undefined;
    const format = req.query.format || 'webp';
    const fit = req.query.fit || 'cover';

    const transformed = await imageService.transformImage(fullPath, {
      width,
      height,
      format,
      fit
    });

    res.setHeader('Content-Type', `image/${format}`);
    return fs.createReadStream(transformed).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Transform error' });
  }
}
