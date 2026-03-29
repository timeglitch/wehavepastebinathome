const express = require('express');
const crypto = require('crypto');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: 'Too many pastes created, please try again later.' },
});

function randomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function uniqueId(title) {
  if (!title) return randomId();
  const base = slugify(title);
  if (!base) return randomId();
  if (!db.get(base)) return base;
  // Slug already taken — append incrementing suffix
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!db.get(candidate)) return candidate;
  }
  return `${base}-${randomId()}`;
}

// Create paste
app.post('/api/paste', createLimiter, (req, res) => {
  const { title, content, language, expiry, encrypted } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const id = uniqueId(title);
  const now = Date.now();
  const expiryMap = { '1h': 3600, '1d': 86400, '1w': 604800, '1m': 2592000 };
  const seconds = expiryMap[expiry];
  const expires_at = seconds ? now + seconds * 1000 : null;

  db.insert({ id, title: title || null, content, language: language || 'plaintext', created_at: now, expires_at, encrypted: !!encrypted });

  res.json({ id, url: `/${id}` });
});

// Get paste (API)
app.get('/api/paste/:id', (req, res) => {
  const paste = db.get(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Paste not found or expired' });
  res.json(paste);
});

// View paste (HTML)
app.get('/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'paste.html'));
});

const DAY_MS = 24 * 60 * 60 * 1000;
setInterval(() => db.cleanup(), DAY_MS);

app.listen(PORT, () => console.log(`Pastebin running at http://localhost:${PORT}`));
