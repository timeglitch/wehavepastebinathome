function toBase64url(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(str) {
  return Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encryptContent(plaintext, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
  );
  const blob = new Uint8Array(28 + ciphertext.byteLength);
  blob.set(salt, 0); blob.set(iv, 16); blob.set(new Uint8Array(ciphertext), 28);
  return toBase64url(blob);
}

async function decryptContent(encoded, password) {
  const raw = fromBase64url(encoded);
  const key = await deriveKey(password, raw.slice(0, 16));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: raw.slice(16, 28) }, key, raw.slice(28)
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('Wrong password or corrupted data.');
  }
}

function randomKey() {
  return toBase64url(crypto.getRandomValues(new Uint8Array(32)));
}
