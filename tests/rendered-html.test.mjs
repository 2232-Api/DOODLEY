import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Doodley drawing studio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Doodley — Dithered drawing sprints · Doodley<\/title>/i);
  assert.match(html, /DOODLEY/);
  assert.match(html, /DITHER SPRINT STUDIO/);
  assert.match(html, /Dithered pixel drawing canvas/);
  assert.match(html, /DOWNLOAD SESSION ZIP/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("the drawing engine is an integer pixel and dither implementation", async () => {
  const source = await readFile(new URL("../app/DoodleyStudio.tsx", import.meta.url), "utf8");

  assert.match(source, /const CANVAS_WIDTH = 256/);
  assert.match(source, /const CANVAS_HEIGHT = 192/);
  assert.match(source, /const BAYER_4/);
  assert.match(source, /fillRect\(x, y, 1, 1\)/);
  assert.match(source, /BITMAP_FONT/);
  assert.match(source, /type PenMode = "solid" \| "dither" \| "duotone"/);
  assert.match(source, /style === "duotone"/);
  assert.match(source, /usePrimary \? primaryColor : secondaryColor/);
  assert.match(source, /style === "dither"/);
  assert.match(source, /type="range"/);
  assert.match(source, /const MAX_BRUSH_SIZE = 20/);
  assert.match(source, /centerShift = brushSize % 2 === 0 \? 0\.5 : 0/);
  assert.doesNotMatch(source, /lineTo\(|stroke\(\)/);
});
