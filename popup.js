const rows = document.getElementById('rows');
const status = document.getElementById('status');

// Returns a full http(s) address, or null if it isn't one.
function cleanUrl(value) {
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}

async function save() {
  const links = [];
  let unfinished = false;
  for (const row of rows.children) {
    const [name, url] = row.querySelectorAll('input');
    const address = cleanUrl(url.value);
    const nameValue = name.value.trim();
    url.setAttribute('aria-invalid', String(Boolean(url.value.trim()) && !address));
    if (nameValue && address) links.push({ name: nameValue, url: address });
    else if (nameValue || url.value.trim()) unfinished = true;
  }
  try {
    await chrome.storage.sync.set({ links });
    status.textContent = unfinished ? 'Rows need a name and a valid address to count.' : 'Saved. It applies to open Reddit tabs too.';
  } catch (err) {
    status.textContent = `Couldn't save: ${err.message}`;
  }
}

function addRow(link = { name: '', url: '' }) {
  const row = document.createElement('div');
  row.className = 'row';
  const input = (placeholder, value, label) => {
    const el = Object.assign(document.createElement('input'), { placeholder, value });
    el.setAttribute('aria-label', label);
    el.addEventListener('input', save);
    return el;
  };
  const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: '×', title: 'Remove' });
  remove.setAttribute('aria-label', 'Remove');
  remove.addEventListener('click', () => { row.remove(); save(); });
  row.append(input('Extension name', link.name, 'Name'), input('https://chromewebstore.google.com/…', link.url, 'Link'), remove);
  rows.append(row);
  return row;
}

document.getElementById('add').addEventListener('click', () => addRow().querySelector('input').focus());

chrome.storage.sync.get('links').then(({ links = [] }) => {
  links.forEach(addRow);
  if (!links.length) addRow();
});
