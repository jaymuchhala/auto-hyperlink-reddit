# Auto Hyperlink for Reddit

Type as normal on Reddit. When you press **Post**, **Comment**, **Save** or **Save Edits**, names you've chosen (your Chrome extensions, for example) become links.

You set the names and their links in the extension's toolbar menu.

## Where it works

| Box | Rich text | Markdown |
|---|---|---|
| New comment, reply, comment edit | Yes | Yes |
| New post body, post edit | Yes | Yes |
| old.reddit.com comments, post text, messages | n/a | Yes |

Titles are never changed. Neither are search boxes or any other field, including chat, because Reddit doesn't support links there.

## What it does and doesn't link

- Matching ignores capitals and keeps what you typed: `mute list` stays `mute list`, as a link.
- Only the first mention of each link in a post is linked, so posts don't look spammy.
- A link can have several names, like `Mute List` and `RML`: add each with the same link and they group together. Whichever comes first in the post gets linked, and the others are left alone. Names can contain commas.
- Each name goes to one link, and the menu won't let you use a name twice. For a second link, like a website as well as the store page, use a more specific name: `Mute List` for the store and `Mute List website` for the site.
- Whole names only: `Mute List` won't match inside `Mute Listing`, `mute-list` or a web address.
- Longer names win: `Mute List Pro` beats `Mute List`.
- Text that's already a link, and code, are left alone. If you've linked a name or its address yourself, or written the address out (`https://`, `www.` or neither), it isn't linked again.
- A name split across formatting (half bold, for example) won't match.

## Your data

Names and links save as you type, in Chrome's extension storage, and sync between your browsers if Chrome sync is on. There's room for roughly 80 links. A name with no link yet, or a link with no name, stays in the menu until you finish it, on that computer only, and isn't used on Reddit. Uninstalling removes them, so use **Back up** in the menu to save them to a file. **Restore** adds a backup to your current list and never removes anything.

## Light by design

There's no typing listener, page observer, timer or network request. The code runs when a submit button is clicked, and only reads the box you're sending. The small background worker exists only for the development reload below and stays idle in store installs. See [PRIVACY.md](PRIVACY.md).

## Install from source

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose this folder.

## Development

No build step. `link.js` runs in the page's own world because Reddit's editor (Lexical) can only be reached there, and `bridge.js` passes it the saved links. `test/mock.html` runs `link.js` against real Lexical with Reddit's composer markup: serve the project root over localhost, then open it.

When loaded unpacked, the extension reloads itself when `build.txt` changes. After editing, run `date +%s > build.txt`, then refresh Reddit twice: the first load triggers the reload, the second gets the new code. The first time, click **Reload** once on `chrome://extensions`.

`./package.sh` builds the Chrome Web Store zip into `dist/`.

## License

[MIT](LICENSE)
