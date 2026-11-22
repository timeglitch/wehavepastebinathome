document.getElementById('encrypt').addEventListener('change', e => {
  document.getElementById('password-field').style.display = e.target.checked ? 'block' : 'none';
});

async function submit() {
  const rawContent = document.getElementById('content').value;
  if (!rawContent.trim()) return;

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
  const result = document.getElementById('result');
  result.style.display = 'block';

  if (data.error) {
    result.textContent = 'Error: ' + data.error;
  } else {
    const url = window.location.origin + data.url + fragment;
    const link = document.createElement('a');
    link.href = data.url + fragment;
    link.textContent = url;
    result.replaceChildren(document.createTextNode('Paste created: '), link);
  }
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
