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
  // One address, however it's written: scheme, www, capitals, trailing slash, escaped brackets.
  const sameUrl = (url) => url.toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/%28/g, '(').replace(/%29/g, ')').replace(/\/+$/, '');
  // Left alone in both kinds of box: links written out as text, and web addresses with or without a scheme.
  const LINKISH = '!?\\[[^\\]]*\\]\\([^)]*\\)|\\[[^\\]]*\\]\\[[^\\]]*\\]|(?:https?://|www\\.)\\S+|[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)+/\\S*';

  function rules() {
    // A link can have several names. Early versions saved them as one comma-joined string.
    // If a name is ever on two rows, the higher row wins.
    const urls = new Map(links.flatMap((l) => (l.names ?? l.name.split(',')).map((n) => [key(n), l.url])).reverse());
    urls.delete('');
    const sorted = [...urls.keys()].sort((a, b) => b.length - a.length); // longest name wins
    const names = sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[^\\S\\n]+')); // a name stays on one line
    return {
      source: `(?<![${WORD}/.@#-])(?:${names.join('|')})(?![${WORD}]|[-./][\\p{L}\\p{N}])`,
      urls,
      done: new Set(), // addresses to leave alone: each is linked once per post
    };
  }

  // The address for this match, or null if it's been linked already. Marks it as linked.
  // Unicode case rules can match text key() doesn't map to a name (Greek final sigma), which also gives null.
  function claim(name, r) {
    const url = r.urls.get(key(name));
    if (!url || r.done.has(sameUrl(url))) return null;
    r.done.add(sameUrl(url));
    return url;
  }

  function seedLinked(text, r) {
    for (const m of text.matchAll(new RegExp(r.source, 'giu'))) claim(m[0], r);
  }

  // An address written out in the text counts as linked. A closing bracket may be part of it or not, so both go in.
  function seedAddresses(text, r) {
    for (const [address] of text.matchAll(/(?:https?:\/\/|www\.)[^\s<>[\]]+/gi)) {
      for (const end of [/[.,;:!?'"]+$/, /[).,;:!?'"]+$/]) r.done.add(sameUrl(address.replace(end, '')));
    }
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
        if (node.getURL) {
          r.done.add(sameUrl(node.getURL() ?? ''));
          return seedLinked(node.getTextContent(), r);
        }
        if (type === 'code') return;
        if (type === 'text' && !node.hasFormat('code')) {
          texts.push(node);
          seedAddresses(node.getTextContent(), r);
        }
        if (node.getChildren) node.getChildren().forEach(walk);
      };
      walk(editor._pendingEditorState._nodeMap.get('root'));
      for (const node of texts) {
        // Neighbours count for whole-name matching: formatting can split a word across nodes.
        const before = node.getPreviousSibling()?.getTextContent() ?? '';
        const text = node.getTextContent();
        const after = node.getNextSibling()?.getTextContent() ?? '';
        const hits = [];
        for (const m of (before + text + after).matchAll(new RegExp(`(${LINKISH})|${r.source}`, 'giu'))) {
          const start = m.index - before.length;
          const end = start + m[0].length;
          if (m[1] || start < 0 || end > text.length) continue;
          const url = claim(m[0], r);
          if (url) hits.push({ start, end, url });
        }
        if (!hits.length) continue;
        let pos = 0;
        for (const part of node.splitText(...hits.flatMap((h) => [h.start, h.end]))) {
          const hit = hits.find((h) => h.start === pos);
          pos += part.getTextContent().length;
          if (!hit) continue;
          const link = new Link(hit.url);
          part.insertBefore(link); // not replace(): that drops a caret inside the name
          link.append(part);
        }
      }
    }, { discrete: true, tag: 'skip-scroll-into-view' });
  }

  // Markdown: code, existing links and bare addresses are matched first and kept as they are.
  function linkMarkdown(box) {
    const r = rules();
    for (const m of box.value.matchAll(/\[([^\]]*)\][([]/g)) seedLinked(m[1], r);
    seedAddresses(box.value, r);
    // Fences run to the end of the box if never closed. The second group is the run of backticks.
    const skip = '```[\\s\\S]*?(?:```|(?![\\s\\S]))|~~~[\\s\\S]*?(?:~~~|(?![\\s\\S]))|(`+)[^\\n]*?\\2|^(?: {4}|\\t).*$|^ {0,3}\\[[^\\]]+\\]:.*$|' + LINKISH;
    const caret = box.selectionStart;
    let moved = 0;
    const next = box.value.replace(new RegExp(`(${skip})|${r.source}`, 'gimu'), (m, skipped, ticks, at) => {
      if (skipped) return m;
      const target = claim(m, r);
      if (!target) return m;
      const url = target.replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
      const linked = `[${m.replace(/[[\]]/g, '\\$&')}](${url})`;
      if (at < caret) moved += linked.length - m.length;
      return linked;
    });
    if (next === box.value) return;
    box.value = next;
    box.setSelectionRange(caret + moved, caret + moved); // the send may not go through, so they can carry on typing
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
    if (!inPath(path, BUTTON)) return;
    linkBox(inPath(path, COMPOSER)
      ?? (inPath(path, '#submit-post-button') ? document.querySelector(`#post-submit-form ${COMPOSER}`) : null)
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
