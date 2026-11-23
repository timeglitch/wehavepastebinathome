# wehavepastebinathome

A self-hosted pastebin with optional client-side encryption.

## Features

- Create pastes with optional title, syntax highlighting, and expiry
- **End-to-end encryption** — content is encrypted in the browser before being sent; the server never sees plaintext
  - No password: a random key is generated and embedded in the share URL (`/id#key`)
  - With password: encrypted with your password, not included in the URL
- Syntax highlighting via highlight.js (viewer)
- Slug-based URLs when a title is set (`/my-paste`), random IDs otherwise
- Auto-expiry with daily cleanup
- Rate limiting (30 pastes per IP per 15 minutes)

## Running locally

```bash
npm install
npm run dev     # auto-restarts on file changes
# or
npm start       # production
```

Runs at http://localhost:3000. The SQLite database (`pastes.db`) is created automatically on first run.

## Deploying

Runs in Docker on a home server, exposed through a Cloudflare Tunnel that routes
`paste.frankzhang.org` to `http://localhost:3000`. Cloudflare terminates HTTPS.

```bash
rsync -az --exclude node_modules/ --exclude pastes.db --exclude .git/ --exclude data/ \
  ./ frank-optiplex:Projects/wehavepastebinathome/
ssh frank-optiplex 'cd ~/Projects/wehavepastebinathome && docker compose up -d --build'
```

- The container runs as the unprivileged `node` user and publishes on `127.0.0.1` only, so the tunnel is the sole way in.
- Pastes live in `./data/pastes.db` beside `compose.yaml` (bind-mounted at `/data`). Back up that folder; never rsync over it.
- Env vars: `HOST` (default `127.0.0.1`), `PORT` (default `3000`), `DB_PATH` (default `pastes.db`), `MAX_DB_BYTES` (default 10 GiB; new pastes get 507 above it).
- Delete a paste (takedowns): `sqlite3 data/pastes.db "DELETE FROM pastes WHERE id = '<id>';"` on the server. 

## API

From a terminal: send raw text, get the link back as plain text. Options go in the query string: `title` (also sets the URL), `expiry` (`1h`, `1d`, `1w`, `1m`), `language`.

```bash
cat notes.txt | curl --data-binary @- 'https://paste.frankzhang.org/api/paste?title=notes&expiry=1d'
# https://paste.frankzhang.org/notes

curl https://paste.frankzhang.org/raw/notes      # the text back
```

| Endpoint | Body / result |
| --- | --- |
| `POST /api/paste` | Raw text (any non-JSON content type) → URL as plain text; or JSON `{title, content, language, expiry, encrypted}` → `{id, url}` |
| `GET /raw/:id` | Plain text. `403` for encrypted pastes (only the browser can decrypt), `404` if missing or expired |
| `GET /api/paste/:id` | JSON with all fields; `content` is ciphertext for encrypted pastes |

Terminal uploads are never encrypted: encryption happens in the browser. Rate limit: 30 pastes per IP per 15 minutes.

## Project structure

```
server.js          Express app — routes, rate limiting, ID generation
db.js              SQLite wrapper (node:sqlite)
public/
  index.html       Create paste form
  paste.html       Paste viewer
  crypto.js        Shared Web Crypto API helpers (PBKDF2 + AES-GCM)
Dockerfile         Production image (node:24-alpine, runs as `node`)
compose.yaml       Service, localhost-only port, ./data bind mount
```

## Security

Encryption uses the browser's built-in Web Crypto API — no external libraries.

- **Key derivation:** PBKDF2-HMAC-SHA256, 210,000 iterations, 16-byte random salt per paste
- **Encryption:** AES-GCM 256-bit, 12-byte random IV per paste
- **Wire format:** `base64url(salt[16] + iv[12] + ciphertext)` stored in the database
- The URL fragment (`#key`) is never sent to the server by the browser

> **Note:** E2E encryption protects data at rest on the server. HTTPS is required to prevent a network attacker from tampering with the JavaScript. In production, Cloudflare serves it over HTTPS.
