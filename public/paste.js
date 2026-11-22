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
  document.getElementById('meta').textContent = `${data.language} · created ${created}${expiry}`;

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
  navigator.clipboard.writeText(document.getElementById('content').innerText);
  const btn = document.getElementById('copy');
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}

load();

document.getElementById('copy').addEventListener('click', copyContent);
// Arrow wrapper: a bare listener would pass the click event as the password.
document.getElementById('decrypt').addEventListener('click', () => attemptDecrypt());
