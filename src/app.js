import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import path from 'path';
import filesRoutes from './routes/files.routes.js';
import * as filesController from './controllers/files.controller.js';

const app = express();
app.use(express.json());

// connect DB
mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log('Mongo connected'))
  .catch(err => {
    console.error('Mongo error', err);
    process.exit(1);
  });

// Routes
app.use('/api/files', filesRoutes);

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// ----------------------
// TRANSFORM IMAGE
// /api/files/transform/<public|private>/<path>
// This matches ANY nested path inside public/ or private/
// Example:
//   GET /api/files/transform/public/2025/11/24/img.png?w=300
//   GET /api/files/transform/private/2025/11/24/img.png?token=...&expires=...
// ----------------------
app.get('/api/files/transform', filesController.transformAndServe);

// ----------------------
// SERVE PRIVATE FILES
// /api/files/private/<path>?token=...&expires=...
// Private files MUST be token validated
// ----------------------
app.get('/api/files/private', filesController.servePrivateFile);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled err', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

export default app;
