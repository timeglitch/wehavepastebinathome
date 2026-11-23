const express = require('express');
const crypto = require('crypto');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { slugify: transliterate } = require('transliteration');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
// Localhost only: the Cloudflare tunnel is the sole public entry point.
const HOST = process.env.HOST || '127.0.0.1';
// Total storage cap, so open publishing can't fill the disk shared with Immich.
const MAX_DB_BYTES = Number(process.env.MAX_DB_BYTES) || 10 * 1024 ** 3;

app.set('trust proxy', 1);

// Only our own scripts and the SRI-pinned highlight.js may run, so nothing else
// can read the decryption key in the URL fragment. Inline styles stay allowed.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '1mb' }));
// Terminal uploads: any non-JSON body is the paste text itself
// (curl --data-binary sends form-encoded by default, so accept that too).
app.use('/api/paste', express.text({ limit: '1mb', type: req => !req.is('application/json') }));
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

// Readable URLs from any script: Café → cafe, 中文 → zhong-wen, Привет → privet.
function slugify(title) {
  return transliterate(title, { lowercase: true, separator: '-' })
    .replace(/[^a-z0-9-]+/g, '')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
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
  // JSON from the web page, or raw text from a terminal with options in the query string.
  const isText = typeof req.body === 'string';
  const fields = isText ? { ...req.query, content: req.body, encrypted: undefined } : (req.body ?? {});
  const { title, content, language, expiry, encrypted } = fields;
  const fail = (status, error) => isText
    ? res.status(status).type('text/plain').send(error + '\n')
    : res.status(status).json({ error });

  // The page always sends strings, but anyone can POST their own JSON.
  const optionalString = v => v === undefined || v === null || typeof v === 'string';
  if (typeof content !== 'string' || !optionalString(title) || !optionalString(expiry)
      || !(language === undefined || language === null || /^[a-z0-9+#-]{1,30}$/i.test(language))
      || !(encrypted === undefined || typeof encrypted === 'boolean')) {
    return fail(400, 'Invalid paste fields');
  }

  if (!content.trim()) {
    return fail(400, 'Content is required');
  }

  if (db.usedBytes() + Buffer.byteLength(content) > MAX_DB_BYTES) {
    return fail(507, 'Storage is full. Try again later.');
  }

  const id = uniqueId(title);
  const now = Date.now();
  const expiryMap = { '1h': 3600, '1d': 86400, '1w': 604800, '1m': 2592000 };
  const seconds = expiryMap[expiry];
  const expires_at = seconds ? now + seconds * 1000 : null;

  db.insert({ id, title: title || null, content, language: language || 'plaintext', created_at: now, expires_at, encrypted: !!encrypted });

  if (isText) return res.type('text/plain').send(`${req.protocol}://${req.get('host')}/${id}\n`);
  res.json({ id, url: `/${id}` });
});

// Get paste (API)
app.get('/api/paste/:id', (req, res) => {
  const paste = db.get(req.params.id);
  if (!paste) return res.status(404).json({ error: 'Paste not found or expired' });
  res.json(paste);
});

// Raw paste: plain text for curl and scripts. Encrypted pastes are ciphertext,
// so they're only readable in the browser.
app.get('/raw/:id', (req, res) => {
  const paste = db.get(req.params.id);
  if (!paste) return res.status(404).type('text/plain').send('Paste not found or expired\n');
  if (paste.encrypted) return res.status(403).type('text/plain').send('This paste is encrypted; open it in a browser.\n');
  res.type('text/plain; charset=utf-8').send(paste.content);
});

// View paste (HTML)
app.get('/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'paste.html'));
});

const DAY_MS = 24 * 60 * 60 * 1000;
setInterval(() => db.cleanup(), DAY_MS);

app.listen(PORT, HOST, () => console.log(`Pastebin running at http://${HOST}:${PORT}`));
