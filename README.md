# Minesweeper

A dependency-free expert Minesweeper frontend:

- 30 columns × 16 rows
- 99 mines
- Safe first click
- Recursive empty-cell clearing
- Right-click flagging
- Number chording
- Timer, mine counter, sound, win and loss states

## Run

Open `index.html` directly, or serve the folder with any static web server.

## Local userscript demonstration

The included `local-autosolver.user.js` demonstrates how a userscript can read
and control a Minesweeper board through its DOM. It is restricted to localhost
and does not run on third-party websites.

1. Install Tampermonkey in your browser.
2. Create a userscript and paste in `local-autosolver.user.js`.
3. Serve this folder locally, for example with VS Code Live Server.
4. Open the local URL with `?external-solver=1` added:

   `http://127.0.0.1:5500/index.html?external-solver=1`

5. Make the first click. The userscript will then flag, reveal, and chord cells.

## Read-only online highlighter

`minesweeperonline-highlighter.user.js` is a separate Tampermonkey userscript
for `minesweeperonline.com`. It never clicks or flags cells. It only reads the
visible board and adds:

- Green outlines to cells that are logically safe.
- Red outlines to cells that must contain mines.

Paste the file into a new Tampermonkey script, save it, and reload the website.
The bottom-right status button can pause or resume the highlights.
