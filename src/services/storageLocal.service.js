import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import util from 'util';
import rangeParser from 'range-parser';

const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);

const { STORAGE_ROOT = './storage', SIGNING_SECRET = 'changeme' } = process.env;

const buckets = {
  public: path.join(STORAGE_ROOT, 'public'),
  private: path.join(STORAGE_ROOT, 'private'),
  cache: path.join(STORAGE_ROOT, 'cache'),
  temp: path.join(STORAGE_ROOT, 'temp')
};

// ensure directories exist
for (const p of Object.values(buckets)) fs.mkdirSync(p, { recursive: true });

function hmac(value) {
  return crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(value)
    .digest('hex');
}

/**
 * Generate signed token for a given fileId/path
 * returns an object { url, token, expires }
 */
export function generateSignedUrl(
  relativePath,
  ttlSeconds = Number(process.env.SIGNED_URL_TTL || 300)
) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  // data = path + expires
  const data = `${relativePath}:${expires}`;
  const token = hmac(data);
  return {
    token,
    expires,
    url: `${relativePath}?token=${token}&expires=${expires}`
  };
}

/**
 * Validate token and expiry
 */
export function validateSignedToken(relativePath, token, expires) {
  if (!token || !expires) return false;
  const now = Math.floor(Date.now() / 1000);
  const exp = parseInt(expires, 10);
  if (isNaN(exp) || now > exp) return false;
  const expected = hmac(`${relativePath}:${exp}`);
  // Use timing-safe compare
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/**
 * Save file from temp to bucket
 * file: multer file object (path, mimetype, originalname, size)
 * bucket: 'public' or 'private'
 * returns { fullPath, relativePath }
 */
export async function saveFileToBucket(file, bucket = 'public') {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const destDir = path.join(buckets[bucket], String(y), m, d);
  await fs.promises.mkdir(destDir, { recursive: true });
  const filename = path.basename(file.path); // keep the temp name (uuid.ext)
  const dest = path.join(destDir, filename);
  await fs.promises.rename(file.path, dest);
  const relativePath = path.relative(STORAGE_ROOT, dest).replace(/\\/g, '/'); // e.g. public/2025/11/24/uuid.png
  return { fullPath: dest, relativePath };
}

/**
 * Stream a local file to express res with range support
 */
export async function streamFile(res, fullPath, mimeType, rangeHeader) {
  const stats = await stat(fullPath);
  const total = stats.size;
  if (rangeHeader) {
    // parse range
    const ranges = rangeParser(total, rangeHeader);
    if (ranges === -1 || ranges === -2) {
      res.status(416).end();
      return;
    }
    const r = ranges[0];
    const start = r.start;
    const end = r.end;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType
    });
    const stream = fs.createReadStream(fullPath, { start, end });
    stream.pipe(res);
    stream.on('error', () => {
      res.status(500).end();
    });
  } else {
    res.writeHead(200, {
      'Content-Length': total,
      'Content-Type': mimeType
    });
    fs.createReadStream(fullPath)
      .pipe(res)
      .on('error', () => res.status(500).end());
  }
}

/**
 * Helper to get absolute path from relativePath (as stored in DB)
 */
export function resolveFullPath(relativePath) {
  return path.join(STORAGE_ROOT, relativePath);
}

export { buckets };
