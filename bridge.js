// Hands the saved links to link.js, which runs in the page's own world (only
// there can it reach Reddit's editor) and has no access to chrome.storage.
const send = async () => {
  const { links = [], settings = {} } = await chrome.storage.sync.get(['links', 'settings']);
  // With Extra features off, what they set is kept but not used.
  const detail = settings.extras ? { links, settings } : { links: links.map(({ only, all, subs, ...link }) => link), settings: { ...settings, every: false } };
  document.dispatchEvent(new CustomEvent('ahl:links', { detail: JSON.stringify(detail) }));
};
document.addEventListener('ahl:ready', send);
chrome.storage.onChanged.addListener((changes) => { if (changes.links || changes.settings) send(); });
send();

// Lets the worker notice a new build.txt during development (see background.js).
if (!('update_url' in chrome.runtime.getManifest())) {
  try { chrome.runtime.sendMessage('ahl:checkBuild').catch(() => {}); } catch (_) { /* extension reloaded */ }
}
