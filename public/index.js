document.getElementById('encrypt').addEventListener('change', e => {
  document.getElementById('password').disabled = !e.target.checked;
});

async function submit() {
  const rawContent = document.getElementById('content').value;
  if (!rawContent.trim()) return;

  // Start the clipboard write now, while the click still counts as permission,
  // and hand it a promise of the link (Safari requires this; Chrome/Firefox accept it).
  const created = createPaste(rawContent);
  let copied = Promise.reject();
  if (navigator.clipboard && window.ClipboardItem) {
    const blob = created.then(r => {
      if (r.error) throw new Error(r.error);
      return new Blob([r.url], { type: 'text/plain' });
    });
    copied = navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
  }
  copied.catch(() => {}); // handled below

  const result = document.getElementById('result');
  result.style.display = 'block';
  const r = await created.catch(e => ({ error: e.message }));
  if (r.error) {
    result.textContent = 'Error: ' + r.error;
    return;
  }

  const link = document.createElement('a');
  link.href = r.url;
  link.textContent = r.url;
  const ok = await copied.then(() => true, () => false);
  result.replaceChildren(
    document.createTextNode('Paste created: '), link, copyButton(r.url));
  if (ok) toast('Link copied to clipboard');
}

// Encrypts if asked, uploads, and resolves to { url } (with #key) or { error }.
async function createPaste(rawContent) {
  const doEncrypt = document.getElementById('encrypt').checked;
  const userPassword = document.getElementById('password').value;
  let content = rawContent;
  let fragment = '';

  if (doEncrypt) {
    const key = userPassword || randomKey();
    content = await encryptContent(rawContent, key);
    if (!userPassword) fragment = '#' + key;
  }

  const res = await fetch('/api/paste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: document.getElementById('title').value,
      content,
      language: document.getElementById('language').value,
      expiry: document.getElementById('expiry').value,
      encrypted: doEncrypt,
    }),
  });
  const data = await res.json();
  if (data.error) return { error: data.error };
  return { url: window.location.origin + data.url + fragment };
}

document.getElementById('content').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit();
  if (e.key === 'Tab') {
    e.preventDefault();
    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.slice(0, start) + '  ' + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + 2;
  }
});

document.getElementById('create').addEventListener('click', submit);

// Clicking the greyed-out password field means "I want a password": turn Encrypt on.
document.getElementById('password-field').addEventListener('click', () => {
  const encrypt = document.getElementById('encrypt');
  const password = document.getElementById('password');
  if (!password.disabled) return;
  encrypt.checked = true;
  encrypt.dispatchEvent(new Event('change'));
  password.focus();
});


// Icon button that copies the link again; shows a check for a moment after copying.
function copyButton(url) {
  const btn = document.createElement('button');
  btn.className = 'copy-link';
  btn.title = 'Copy link';
  btn.setAttribute('aria-label', 'Copy link');
  btn.innerHTML = ICON_COPY;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(url);
    toast('Link copied to clipboard');
    btn.innerHTML = ICON_CHECK;
    setTimeout(() => { btn.innerHTML = ICON_COPY; }, 1500);
  });
  return btn;
}
