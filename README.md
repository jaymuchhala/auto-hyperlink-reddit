# Auto Hyperlink for Reddit (Beta)

Type as normal on Reddit. When you press **Post**, **Comment**, **Reply** or **Save**, names you've chosen (your Chrome extensions, for example) become links.

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
- Only the first mention of each name in a post is linked, so posts don't look spammy.
- Whole names only: `Mute List` won't match inside `Mute Listing`, `mute-list` or a web address.
- Longer names win: `Mute List Pro` beats `Mute List`.
- Text that's already a link, and code, are left alone. A name that's already linked isn't linked again.
- A name split across formatting (half bold, for example) won't match.

## Light by design

There's no typing listener, page observer, timer or network request. The code runs when a submit button is clicked or Cmd/Ctrl+Enter is pressed, and only reads the box you're sending. The small background worker exists only for the development reload below and stays idle in store installs. See [PRIVACY.md](PRIVACY.md).

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
