import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema({
  owner: { type: String, required: false }, // store user id if you use auth
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  storagePath: { type: String, required: true }, // absolute path on disk
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  bucket: { type: String, enum: ['public', 'private'], required: true },
  meta: {
    width: Number,
    height: Number,
    duration: Number
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('File', FileSchema);
