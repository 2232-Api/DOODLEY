# DOODLEY

Doodley is a dual-screen drawing-sprint studio for artists. Load or search for a
reference on the left, then make a timed dithered pixel sketch on the right.

## Current features

- True 256 × 192 integer-pixel canvas
- 4 × 4 Bayer dithering at 25%, 50%, and 75% density
- Dithered pen, eraser, bitmap text, rectangle, and color-picker tools
- Mouse, touch, and stylus input
- Reference uploads and Wikimedia Commons image search
- Timed sprints, reference queues, pause, skip, and automatic progression
- Undo, redo, PNG export, and full-session ZIP export
- Device-local drawing autosave
- Responsive handheld-console-inspired interface

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

To verify a production build and run the automated tests:

```bash
npm test
```

## Drawing engine

The drawing surface is a 256 × 192 bitmap enlarged with nearest-neighbor
rendering. Tools write integer pixels directly through a Bayer threshold matrix;
the app does not use anti-aliased canvas stroke paths. Text is rendered with a
custom bitmap font so it follows the same pixel and dither constraints.

## Design note

The interface is inspired by early dual-screen handheld hardware, but uses
original UI assets and does not include Nintendo branding or proprietary icons.

The bundled example photograph is credited in the app to Jimmy Boos via Pexels.
Search results retain their Wikimedia Commons source and license attribution.
