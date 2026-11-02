// Lets the worker notice a new build.txt during development (see background.js).
if (!('update_url' in chrome.runtime.getManifest())) {
  try { chrome.runtime.sendMessage('ahl:checkBuild').catch(() => {}); } catch (_) { /* extension reloaded */ }
}

const rows = document.getElementById('rows');
const status = document.getElementById('status');

// Shows a link the way a saved row does: just the site, with the full address on hover.
function setLink(anchor, url) {
  anchor.href = url;
  anchor.title = url;
  anchor.textContent = new URL(url).host;
}

// Returns a full http(s) address, or null if it isn't one.
function cleanUrl(value) {
  const text = value.trim();
  if (!text) return null;
  try {
    // example.com:8080 has a port, not a scheme.
    const url = new URL(/^[a-z][a-z0-9+.-]*:(?!\d+(?:[/?#]|$))/i.test(text) ? text : `https://${text}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}

const cleanName = (value) => value.trim().replace(/\s+/g, ' ');

// A saved link's names. Early versions saved them as one comma-joined string.
const namesOf = (link) => (Array.isArray(link.names) ? link.names : String(link.name ?? '').split(',')).map((n) => cleanName(String(n))).filter(Boolean);

// Waits for a pause in typing: storage.sync refuses more than 120 writes a minute.
let saveTimer = null;
let keepStatus = false; // the next save leaves the status message up
let lastSaved = null; // this window's own last write, to tell it from another window's
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}
addEventListener('pagehide', () => { if (saveTimer !== null) save(); });

// Returns whether it saved.
async function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  const links = [];
  for (const row of rows.children) {
    const [, url] = row.querySelectorAll('input');
    const address = cleanUrl(url.value);
    const names = rowNames(row);
    url.setAttribute('aria-invalid', String(Boolean(url.value.trim()) && !address));
    // A half-typed change keeps the last good link: the menu can close at any moment.
    if (address) row.dataset.saved = address;
    if (names.length && row.dataset.saved) links.push({ names, url: row.dataset.saved });
  }
  try {
    lastSaved = JSON.stringify(links);
    await chrome.storage.sync.set({ links });
    if (!keepStatus) status.textContent = '';
    keepStatus = false;
    return true;
  } catch (err) {
    status.textContent = `Couldn't save: ${err.message}`;
    return false;
  }
}

// A name can only have one link: nothing at posting time could say which to use.
// Splits names into those free to add to this row and those another row has.
function checkNames(names, row) {
  const key = (name) => name.toLowerCase();
  const free = [];
  const taken = [];
  for (const name of names) {
    const other = [...rows.children].find((r) => r !== row && [...r.querySelectorAll('.chip')].some((c) => key(c.dataset.name) === key(name)));
    if (other) taken.push({ name, url: cleanUrl(other.querySelectorAll('input')[1].value) });
    else free.push(name);
  }
  return { free, taken };
}

// Warns that a name is in use. The other row may not have a valid link yet.
function showTaken({ name, url }) {
  const warning = Object.assign(document.createElement('span'), { className: 'warning' });
  if (url) {
    const anchor = Object.assign(document.createElement('a'), { target: '_blank', rel: 'noopener' });
    setLink(anchor, url);
    warning.append(`“${name}” is linked to `, anchor);
  } else {
    warning.append(`“${name}” is already in another row`);
  }
  status.replaceChildren(warning);
}

// The row's names: its chips, plus anything typed that isn't a chip yet.
function rowNames(row) {
  const typed = cleanName(row.querySelector('.names input').value);
  return [...row.querySelectorAll('.chip')].map((c) => c.dataset.name).concat(typed ? [typed] : []);
}

// Adds names to a row as chips, leaving out any it already has. The name box goes once there's a name.
function addNames(row, names) {
  const box = row.querySelector('.names');
  const input = box.querySelector('input');
  for (const name of names) {
    const have = [...box.querySelectorAll('.chip')].some((c) => c.dataset.name.toLowerCase() === name.toLowerCase());
    if (have) continue;
    const chip = Object.assign(document.createElement('button'), { type: 'button', className: 'chip' });
    chip.dataset.name = name;
    chip.setAttribute('aria-label', `${name}: remove`);
    const x = Object.assign(document.createElement('span'), { className: 'x' });
    chip.append(name, x);
    // A chip removes itself on click. Removing a row's last name removes the row.
    chip.addEventListener('click', () => {
      chip.remove();
      if (!box.querySelector('.chip')) {
        row.remove();
        if (!rows.children.length) addRow();
      }
      save();
    });
    // .tight: a chip at the end of a line grows into its margin instead, since
    // wrapping would pull it out from under the pointer.
    const checkRoom = () => chip.classList.toggle('tight', chip.getBoundingClientRect().right + 16 > box.getBoundingClientRect().right);
    chip.addEventListener('mouseenter', checkRoom);
    chip.addEventListener('focus', checkRoom);
    input.before(chip);
  }
  input.hidden = Boolean(box.querySelector('.chip'));
}

function addRow(link = { names: [], url: '' }) {
  const row = document.createElement('div');
  row.className = 'row';
  if (cleanUrl(link.url)) row.dataset.saved = cleanUrl(link.url);
  let settle;
  let merged = false;
  const names = Object.assign(document.createElement('div'), { className: 'names' });
  const nameInput = Object.assign(document.createElement('input'), { placeholder: 'Word or phrase' });
  nameInput.setAttribute('aria-label', 'Add a name');
  names.append(nameInput);
  const commit = () => {
    if (!nameInput.value.trim()) return;
    const { free, taken } = checkNames([cleanName(nameInput.value)], row);
    addNames(row, free);
    nameInput.value = '';
    if (taken.length) {
      showTaken(taken[0]);
      keepStatus = true;
    }
    settle();
    saveSoon();
  };
  // Enter or leaving the box turns what's typed into a chip. Names can hold commas.
  nameInput.addEventListener('input', saveSoon);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    commit();
    if (nameInput.hidden && !urlInput.hidden) urlInput.focus();
  });
  nameInput.addEventListener('blur', commit);
  const urlInput = Object.assign(document.createElement('input'), { placeholder: 'https://chromewebstore.google.com/…', value: link.url });
  urlInput.setAttribute('aria-label', 'Link');
  urlInput.addEventListener('input', saveSoon);
  // A row with a name and a valid link shows the link as plain text. Its × goes back to the box.
  const view = Object.assign(document.createElement('div'), { className: 'link-view' });
  const anchor = Object.assign(document.createElement('a'), { target: '_blank', rel: 'noopener' });
  const change = Object.assign(document.createElement('button'), { type: 'button', className: 'change', textContent: '×', title: 'Change link' });
  change.setAttribute('aria-label', 'Change link');
  change.addEventListener('click', () => {
    view.hidden = true;
    urlInput.hidden = false;
    urlInput.select();
  });
  view.append(anchor, change);
  settle = () => {
    if (merged) return; // removing the row blurs its box, which lands back here
    const url = cleanUrl(urlInput.value);
    const done = Boolean(url) && rowNames(row).length > 0;
    // Names with the same link are one group, in the higher row.
    const same = done && [...rows.children].find((r) => r !== row && rowNames(r).length && cleanUrl(r.querySelectorAll('input')[1].value) === url);
    if (same) {
      merged = true;
      addNames(same, rowNames(row));
      row.remove();
      saveSoon();
      return;
    }
    view.hidden = !done;
    urlInput.hidden = done;
    if (!done) return;
    setLink(anchor, url);
  };
  urlInput.addEventListener('blur', settle);
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') settle(); });
  row.append(names, urlInput, view);
  rows.append(row);
  addNames(row, namesOf(link));
  settle();
  return row;
}

// With an empty row already there, + goes to it instead of adding another.
const emptyRow = () => [...rows.children].find((row) => !rowNames(row).length && !row.querySelectorAll('input')[1].value.trim());
const add = document.getElementById('add');
add.addEventListener('click', () => (emptyRow() ?? addRow()).querySelector('input').focus());
// Already in the empty row: keeps the focus there, so its outline doesn't blink on each click.
add.addEventListener('mousedown', (e) => {
  if (document.activeElement === emptyRow()?.querySelector('input')) e.preventDefault();
});

document.getElementById('backup').addEventListener('click', async () => {
  const saved = await save();
  const { links = [] } = await chrome.storage.sync.get('links');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'auto-hyperlink-reddit', links }, null, 2)], { type: 'application/json' }));
  a.download = `auto-hyperlink-reddit-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  if (saved) status.textContent = `Backed up ${links.length} ${links.length === 1 ? 'link' : 'links'}.`;
});

// The toolbar menu closes when a file picker opens, so restoring happens in a tab.
const file = document.getElementById('file');
document.getElementById('restore').addEventListener('click', async () => {
  if (await chrome.tabs.getCurrent()) return file.click();
  await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html#restore') });
  window.close();
});
if (location.hash === '#restore') status.textContent = 'Click Restore to choose your backup file.';

// Restoring adds to what's here and never removes anything.
file.addEventListener('change', async () => {
  try {
    const { links } = JSON.parse(await file.files[0].text());
    let added = 0;
    let skipped = 0;
    for (const link of links) {
      const url = cleanUrl(String(link.url));
      if (!url) continue;
      const row = [...rows.children].find((r) => cleanUrl(r.querySelectorAll('input')[1].value) === url);
      const { free: names, taken } = checkNames(namesOf(link), row);
      skipped += taken.length;
      if (!names.length) continue;
      if (row) {
        addNames(row, names);
      } else {
        addRow({ names, url });
        added++;
      }
    }
    for (const r of [...rows.children]) if (!rowNames(r).length && !r.querySelectorAll('input')[1].value.trim()) r.remove();
    if (await save()) status.textContent = `Restored. ${added} new ${added === 1 ? 'link' : 'links'} added.${skipped ? ` ${skipped} ${skipped === 1 ? 'name' : 'names'} skipped, already used for another link.` : ''}`;
  } catch {
    status.textContent = "That file isn't a backup from this extension.";
  }
  file.value = '';
});

// The notes wrap where the longest link's text ends. Only short links would squeeze them, hence the minimum.
const note = document.querySelector('.note');
function fitNote() {
  const box = note.getBoundingClientRect();
  const ends = [...rows.querySelectorAll('.link-view a')].map((a) => a.getBoundingClientRect().right);
  note.style.paddingRight = `${box.right - Math.max(box.left + 280, ...ends)}px`;
}
new MutationObserver(fitNote).observe(rows, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

function render(links) {
  rows.replaceChildren();
  links.forEach((link) => addRow(link));
  if (!links.length) addRow();
}

chrome.storage.sync.get('links').then(({ links = [] }) => render(links));

// Saving writes the whole list, so a window left open has to keep up or it would undo the other's changes.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.links) return;
  const links = changes.links.newValue ?? [];
  if (JSON.stringify(links) === lastSaved) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  render(links);
});
