# Christmas Starlight

An interactive winter scene drawn in Canvas. A procedurally drawn spruce stands amid falling snow, drifting stars, and a spiraling golden ribbon. The translucent background scrolls through excerpts of the JavaScript that renders the scene.

## Run locally

Open [`index.html`](index.html) in a modern browser. The project runs from local HTML, CSS, and JavaScript files.

- Drag with a mouse or a finger to orbit the tree and tilt the view.
- Move the pointer across the scene to stir the nearby stardust.
- Focus the scene with Tab and use the arrow keys to adjust the view.
- When the star at the top of the tree begins to pulse, press and hold it to enter the closing scene. Select **Replay** to return to the beginning.

The scene follows the browser's reduced-motion preference. The dedication is shown on wide screens with a mouse-style pointer.

## Privacy

The scene uses pointer movements, viewport dimensions, and motion preferences locally in the browser. When the site is hosted on GitHub Pages, the hosting platform logs visitor IP addresses for security. See [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection).

## Source guide

| File                                                      | Purpose                                           |
| --------------------------------------------------------- | ------------------------------------------------- |
| [`index.html`](index.html) and [`style.css`](style.css) | Page layout and responsive styling                |
| [`scene.js`](scene.js)                                   | Camera, pointer interaction, and scene animation  |
| [`spruce.js`](spruce.js)                                 | Procedural tree geometry and rendering            |
| [`starfield.js`](starfield.js)                           | Layered starfield and drifting particle streams   |
| [`source-backdrop.js`](source-backdrop.js)               | Syntax highlighting for the scrolling source text |
| [`finale.js`](finale.js)                                 | Closing constellation scene                       |

## Acknowledgements

Thanks to **Codex** and **Antigravity** for helping design and build the project, and to **USTC Token Plan** for its support.
