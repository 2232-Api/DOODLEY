# DOODLEY

Doodley is a dual-screen drawing-sprint studio for artists. Load or search for a
reference on the left, then make a timed dithered pixel sketch on the right.

## Current features

- True 256 × 192 integer-pixel canvas
- 4 × 4 Bayer dithering at 25%, 50%, and 75% density
- Solid Pixel, Dither Ink, and full-coverage Duotone pen modes
- Adjustable 1–6 px Duotone texture grain with a live checker preview
- Twelve quick colors plus full color-wheel pickers for both Duotone inks
- Continuous 1–20 px brush-size slider with one-pixel step controls
- Pixel eraser, bitmap text, rectangle, and color-picker tools
- Mouse, touch, and stylus input
- Reference uploads and Wikimedia Commons image search
- Timed sprints, reference queues, pause, skip, and automatic progression
- Undo, redo, PNG export, and full-session ZIP export
- Device-local drawing autosave
- Responsive flat pixel-workstation interface with custom 9 × 9 tool icons

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
rendering. Tools write integer pixels directly; the app does not use
anti-aliased canvas stroke paths. Dither Ink uses a Bayer threshold to leave
ordered paper gaps, while Duotone assigns every brush pixel to one of two colors
through the same matrix. Text uses a custom bitmap font.

## Design note

The interface is inspired by early dual-screen handheld hardware, but uses
original UI assets and does not include Nintendo branding or proprietary icons.

The bundled example photograph is credited in the app to Jimmy Boos via Pexels.
Search results retain their Wikimedia Commons source and license attribution.
