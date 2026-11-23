// Display names, matching the Syntax dropdown on the create page.
const LANGUAGE_NAMES = {
  plaintext: 'Plain text', javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
  bash: 'Bash', html: 'HTML', css: 'CSS', json: 'JSON', sql: 'SQL', go: 'Go', rust: 'Rust',
};

const id = location.pathname.replace(/^\//, '');
let pendingData = null;

async function load() {
  const res = await fetch(`/api/paste/${id}`);
  const data = await res.json();

  if (data.error) {
    document.getElementById('title').textContent = 'Not found';
    const errSpan = document.createElement('span');
    errSpan.id = 'error';
    errSpan.textContent = data.error;
    document.getElementById('content').replaceChildren(errSpan);
    return;
  }

  document.title = data.title || 'Paste ' + id;
  document.getElementById('title').textContent = data.title || 'Untitled';
  const created = new Date(data.created_at).toLocaleString();
  const expiry = data.expires_at ? ' · expires ' + new Date(data.expires_at).toLocaleString() : '';
  const meta = document.getElementById('meta');
  meta.textContent = `${LANGUAGE_NAMES[data.language] ?? data.language} · created ${created}${expiry}`;
  if (data.encrypted) {
    // Fixed markup, no paste data in it, so innerHTML is safe here.
    meta.insertAdjacentHTML('afterbegin',
      '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>'
      + '<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>encrypted · ');
  }

  if (!data.encrypted) {
    // Quiet link to the plain-text version at the end of the metadata line.
    const raw = document.createElement('a');
    raw.href = `/raw/${encodeURIComponent(id)}`;
    raw.textContent = 'raw';
    meta.append(' · ', raw);
  }

  if (data.encrypted) {
    pendingData = data;
    const fragment = location.hash.slice(1);
    if (fragment) {
      await attemptDecrypt(decodeURIComponent(fragment));
    } else {
      document.getElementById('decrypt-panel').style.display = 'flex';
    }
  } else {
    renderContent(data.content, data.language);
  }
}

function renderContent(plaintext, language) {
  const block = document.getElementById('content');
  block.textContent = plaintext;
  if (language && language !== 'plaintext') {
    block.className = `language-${language}`;
    hljs.highlightElement(block);
  }
  document.getElementById('copy').style.display = 'inline-block';
}

async function attemptDecrypt(passwordOverride) {
  const password = passwordOverride ?? document.getElementById('dec-password').value;
  const errEl = document.getElementById('decrypt-error');
  errEl.style.display = 'none';
  try {
    const plaintext = await decryptContent(pendingData.content, password);
    document.getElementById('decrypt-panel').style.display = 'none';
    renderContent(plaintext, pendingData.language);
  } catch (e) {
    if (!passwordOverride) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    } else {
      document.getElementById('decrypt-panel').style.display = 'flex';
    }
  }
}

document.getElementById('dec-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') attemptDecrypt();
});

function copyContent() {
  navigator.clipboard.writeText(document.getElementById('content').innerText)
    .then(() => toast('Paste copied to clipboard'));
}

load();

document.getElementById('copy').addEventListener('click', copyContent);
// Arrow wrapper: a bare listener would pass the click event as the password.
document.getElementById('decrypt').addEventListener('click', () => attemptDecrypt());
