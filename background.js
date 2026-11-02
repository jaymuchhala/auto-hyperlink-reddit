// Development: when loaded unpacked (no update_url), reload when build.txt changes,
// so edits on disk take effect without a trip to chrome://extensions. Each page load
// and menu open pings the worker to trigger the check. The stamp seen at load is kept
// in session storage, which outlives the worker going idle but is cleared by a reload.
// Store installs have an update_url, so they never ping and this never runs.
async function checkBuild() {
  if ('update_url' in chrome.runtime.getManifest()) return;
  try {
    const stamp = (await (await fetch(chrome.runtime.getURL('build.txt'), { cache: 'no-store' })).text()).trim();
    const { build } = await chrome.storage.session.get('build');
    if (build === undefined) await chrome.storage.session.set({ build: stamp });
    else if (stamp !== build) chrome.runtime.reload();
  } catch (_) { /* no build.txt */ }
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg === 'ahl:checkBuild') checkBuild();
});
checkBuild();
