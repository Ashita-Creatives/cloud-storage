# 🚀 **Cloud Storage — Self-Hosted Storage API (Node.js, Express 5)**

Cloud Storage is a **self-hosted storage API** built for the CDN usage.
It supports **public & private file storage**, **signed URL access**, **image transformations**, and **streaming**, all fully hosted on your VPS with **no external cloud dependencies** (no S3, no R2).

## ✨ **Features**

- **Public & Private file uploads**
- **Signed URLs** for private file access (S3-style security)
- **Local storage** under `/var/cloudstorage/storage`
- **Image transformations** using Sharp

  - resize
  - crop
  - format conversion
  - caching

- **Video streaming** with `Range` support
- **Upload multiple files**
- **Auto directory structure**

  ```
  public/YYYY/MM/DD/file.ext
  private/YYYY/MM/DD/file.ext
  ```

- **JSON metadata stored in MongoDB**
- **Express 5 compatible routing** (no wildcard routes)
- **Clean query-based path system**
  → `?path=private/.../file.png`
- **Zero cloud services needed**

# 📦 **Project Structure**

```
src/
├─ controllers/
│   └─ files.controller.js
├─ middleware/
│   └─ upload.js
├─ models/
│   └─ file.model.js
├─ routes/
│   └─ files.routes.js
├─ services/
│   ├─ storageLocal.service.js
│   └─ image.service.js
├─ app.js
└─ server.js
```

# ⚙️ **Environment Variables (`.env`)**

```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/cloud_storage

# Storage paths
STORAGE_ROOT=/var/cloudstorage/storage
IMAGE_CACHE_PATH=/var/cloudstorage/cache
TEMP_PATH=/var/cloudstorage/temp

# Private file signed URL security
SIGNING_SECRET=your-very-strong-secret
SIGNED_URL_TTL=300

# Maximum file sizes (bytes)
MAX_IMAGE_SIZE=5242880
MAX_VIDEO_SIZE=104857600
MAX_AUDIO_SIZE=20971520
MAX_GIF_SIZE=10485760
MAX_DOC_SIZE=10485760
```

Make sure directories exist:

```bash
sudo mkdir -p /var/cloudstorage/storage/{public,private}
sudo mkdir -p /var/cloudstorage/{cache,temp}
sudo chown -R $USER:$USER /var/cloudstorage
```

# 🚀 **Starting the Server**

```bash
npm install
npm run start
```

or for development:

```bash
npm run dev
```

# 🧪 **API Usage**

# 1️⃣ Upload Files

`POST /api/files/upload`

### Request

**Content-Type:** `multipart/form-data`

Fields:

| Field        | Type | Description           |
| ------------ | ---- | --------------------- |
| `files`      | FILE | One or more files     |
| `visibility` | TEXT | `public` or `private` |

### Example (cURL)

```bash
curl -X POST "http://localhost:4000/api/files/upload" \
  -F "visibility=private" \
  -F "files=@/path/to/photo.png"
```

# 2️⃣ Get Signed URL (Private Files)

`GET /api/files/:id/signed-url`

Returns a time-limited URL for downloading or streaming a private file.

### Example

```bash
curl "http://localhost:4000/api/files/6789abc/signed-url"
```

### Response

```json
{
  "url": "http://localhost:4000/api/files/private?path=private/2025/11/25/file.png&token=abc&expires=12345678",
  "token": "abc",
  "expires": 12345678
}
```

# 3️⃣ Download / Stream Private File

Just use the signed URL:

```
GET /api/files/private?path=<path>&token=<token>&expires=<timestamp>
```

Supports streaming video/audio.

# 4️⃣ Image Transformations

`GET /api/files/transform?path=<file>&w=300&h=200&format=webp`

### Example

```bash
curl "http://localhost:4000/api/files/transform?path=public/2025/11/25/photo.png&w=400&h=300"
```

### Transform Options

| Query    | Description        |
| -------- | ------------------ |
| `w`      | width              |
| `h`      | height             |
| `fit`    | cover/contain/fill |
| `format` | webp/png/jpg       |

# 📥 **Upload Response Example**

```json
{
  "files": [
    {
      "_id": "67890abcd",
      "originalName": "photo.png",
      "mimeType": "image/png",
      "size": 102394,
      "storagePath": "private/2025/11/25/uuid.png",
      "visibility": "private",
      "bucket": "private",
      "meta": {
        "thumbnail": "cache/12abff98.webp"
      }
    }
  ]
}
```

# 🔐 **How Private File Security Works**

1. Private file stored under:

   ```
   private/YYYY/MM/DD/uuid.ext
   ```

2. API issues signed URL:

   ```
   /api/files/private?path=private/...&token=XXX&expires=YYY
   ```

3. On request:

   - Path is validated
   - Token is validated (HMAC-SHA256)
   - Expiration timestamp checked
   - File is streamed from disk

No JWT authentication is needed for private downloads—only the signed URL.

# 🌐 **Recommended Nginx Setup**

(If hosting behind Nginx)

```
location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
}

location /storage/public/ {
    alias /var/cloudstorage/storage/public/;
    access_log off;
}
```

Optional: Serve transformed images & cache directly:

```
location /cache/ {
    alias /var/cloudstorage/cache/;
    access_log off;
}
```

# 🧹 **Future Features (optional)**

- Delete file endpoint
- User quotas / storage limits
- Folder-like organization
- Video thumbnail generation (ffmpeg)
- Chunked uploads (large files)
- JS SDK (`cloudstorage-js`)

# 🧑‍💻 **Author**

Jonathan Mwebaze
Self-hosted cloud infrastructure tools.
