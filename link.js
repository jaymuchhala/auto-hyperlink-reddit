// Runs only when a post or comment is submitted: no observers, timers or typing
// listeners. A capture listener on window runs before Reddit's own submit code,
// which reads the box's value afterwards, so the links go out with the post.
(() => {
  const WORD = '\\p{L}\\p{N}_';
  const BUTTON = '#comment-composer-submit-button, #submit-post-button, [slot="submit-button"], button[type="submit"]';
  const COMPOSER = 'shreddit-composer';
  const TEXTAREA = 'textarea[name="text"]'; // old.reddit.com; titles are name="title"
  let links = [];

  const key = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

  function rules() {
    const sorted = [...links].sort((a, b) => b.name.length - a.name.length); // longest name wins
    const names = sorted.map((l) => key(l.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
    return {
      source: `(?<![${WORD}/.@#-])(?:${names.join('|')})(?![${WORD}]|[-./][\\p{L}\\p{N}])`,
      urls: new Map(links.map((l) => [key(l.name), l.url])),
      done: new Set(), // names to leave alone: each is linked once per post
    };
  }

  function seedLinked(text, r) {
    for (const m of text.matchAll(new RegExp(r.source, 'giu'))) r.done.add(key(m[0]));
  }

  // Rich text: Reddit's Lexical editor. Its own node methods do the edit, and
  // discrete commits at once, so the value Reddit reads next already has the links.
  function linkRichText(root) {
    const editor = root.__lexicalEditor;
    const Link = editor?._nodes.get('reddit-link')?.klass ?? editor?._nodes.get('link')?.klass;
    if (!Link) return;
    const r = rules();
    editor.update(() => {
      const texts = [];
      const walk = (node) => {
        const type = node.getType();
        if (node.getURL) return seedLinked(node.getTextContent(), r);
        if (type === 'code') return;
        if (type === 'text' && !node.hasFormat('code')) texts.push(node);
        if (node.getChildren) node.getChildren().forEach(walk);
      };
      walk(editor._pendingEditorState._nodeMap.get('root'));
      for (const node of texts) {
        const hits = [];
        for (const m of node.getTextContent().matchAll(new RegExp(r.source, 'giu'))) {
          const name = key(m[0]);
          if (r.done.has(name)) continue;
          r.done.add(name);
          hits.push({ start: m.index, end: m.index + m[0].length, url: r.urls.get(name) });
        }
        if (!hits.length) continue;
        let pos = 0;
        for (const part of node.splitText(...hits.flatMap((h) => [h.start, h.end]))) {
          const hit = hits.find((h) => h.start === pos);
          pos += part.getTextContent().length;
          if (!hit) continue;
          const link = new Link(hit.url);
          part.replace(link);
          link.append(part);
        }
      }
    }, { discrete: true, tag: 'skip-scroll-into-view' });
  }

  // Markdown: code, existing links and bare addresses are matched first and kept as they are.
  function linkMarkdown(box) {
    const r = rules();
    for (const m of box.value.matchAll(/\[([^\]]*)\]\(/g)) seedLinked(m[1], r);
    const skip = '```[\\s\\S]*?```|`[^`\\n]*`|^(?: {4}|\\t).*$|!?\\[[^\\]]*\\]\\([^)]*\\)|https?://\\S+';
    const next = box.value.replace(new RegExp(`(${skip})|${r.source}`, 'gimu'), (m, skipped) => {
      const name = key(m);
      if (skipped || r.done.has(name)) return m;
      r.done.add(name);
      const url = r.urls.get(name).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
      return `[${m.replace(/[[\]]/g, '\\$&')}](${url})`;
    });
    if (next === box.value) return;
    box.value = next;
    box.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }

  function linkBox(box) {
    if (!links.length || !box) return;
    try {
      if (box.matches(TEXTAREA)) return linkMarkdown(box);
      const rich = box.querySelector('[data-lexical-editor]');
      if (box.getAttribute('mode') !== 'markdown' && rich) return linkRichText(rich);
      const area = box.shadowRoot?.querySelector('shreddit-markdown-composer')?.shadowRoot?.querySelector('textarea');
      if (area) linkMarkdown(area);
    } catch (err) {
      console.warn('Auto Hyperlink:', err); // never stand in the way of the post
    }
  }

  const inPath = (path, selector) => path.find((n) => n.matches?.(selector));

  addEventListener('click', (e) => {
    const path = e.composedPath();
    const button = inPath(path, BUTTON);
    if (!button) return;
    linkBox(inPath(path, COMPOSER)
      ?? (button.matches('#submit-post-button') ? document.querySelector(`#post-submit-form ${COMPOSER}, ${COMPOSER}`) : null)
      ?? inPath(path, 'form')?.querySelector(TEXTAREA));
  }, true);

  // Cmd/Ctrl+Enter sends from inside the box.
  addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
    const path = e.composedPath();
    linkBox(inPath(path, COMPOSER) ?? inPath(path, TEXTAREA));
  }, true);

  document.addEventListener('ahl:links', (e) => { links = JSON.parse(e.detail); });
  document.dispatchEvent(new CustomEvent('ahl:ready'));
})();
