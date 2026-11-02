// Hands the saved links to link.js, which runs in the page's own world (only
// there can it reach Reddit's editor) and has no access to chrome.storage.
const send = async () => {
  const { links = [] } = await chrome.storage.sync.get('links');
  document.dispatchEvent(new CustomEvent('ahl:links', { detail: JSON.stringify(links) }));
};
document.addEventListener('ahl:ready', send);
chrome.storage.onChanged.addListener((changes) => { if (changes.links) send(); });
send();
