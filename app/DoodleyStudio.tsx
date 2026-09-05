"use client";

import {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import JSZip from "jszip";

const CANVAS_WIDTH = 256;
const CANVAS_HEIGHT = 192;
const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 20;
const MIN_DUOTONE_PIXEL_SIZE = 1;
const MAX_DUOTONE_PIXEL_SIZE = 6;
const MIN_TEXT_PIXEL_SIZE = 1;
const MAX_TEXT_PIXEL_SIZE = 4;
const PAPER = "#fffdf4";
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

const BITMAP_FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

type Tool = "pen" | "eraser" | "text" | "shape" | "picker";
type PenMode = "solid" | "dither" | "duotone";
type StampStyle = PenMode | "erase";

type ReferenceImage = {
  id: string;
  url: string;
  title: string;
  author: string;
  source: string;
  pageUrl?: string;
};

type WikimediaPage = {
  pageid: number;
  title: string;
  fullurl?: string;
  imageinfo?: Array<{
    url: string;
    thumburl?: string;
    mime?: string;
    extmetadata?: {
      Artist?: { value?: string };
      LicenseShortName?: { value?: string };
    };
  }>;
};

const DEFAULT_REFERENCE: ReferenceImage = {
  id: "skateboard-reference",
  url: "/skateboard-reference.jpg",
  title: "Skateboard jump",
  author: "Jimmy Boos",
  source: "Pexels",
  pageUrl: "https://www.pexels.com/photo/man-jumping-on-skateboard-at-a-skate-park-12343312/",
};

const TOOL_ITEMS: Array<{ id: Tool; label: string; shortcut: string }> = [
  { id: "pen", label: "Pen", shortcut: "B" },
  { id: "eraser", label: "Eraser", shortcut: "E" },
  { id: "text", label: "Text", shortcut: "T" },
  { id: "shape", label: "Shape", shortcut: "R" },
  { id: "picker", label: "Pick", shortcut: "I" },
];

const PIXEL_ICONS: Record<Tool, string[]> = {
  pen: [
    "000000110",
    "000001111",
    "000011110",
    "000111100",
    "001111000",
    "011110000",
    "111100000",
    "111000000",
    "010000000",
  ],
  eraser: [
    "000001100",
    "000011110",
    "000111110",
    "001111100",
    "011111000",
    "111110000",
    "011100000",
    "001100000",
    "000000000",
  ],
  text: [
    "111111111",
    "101111101",
    "000111000",
    "000111000",
    "000111000",
    "000111000",
    "000111000",
    "001111100",
    "011111110",
  ],
  shape: [
    "111111111",
    "100000001",
    "100000001",
    "100000001",
    "100000001",
    "100000001",
    "100000001",
    "100000001",
    "111111111",
  ],
  picker: [
    "001111100",
    "011000110",
    "110111011",
    "101000101",
    "101010101",
    "101000101",
    "110111011",
    "011000110",
    "001111100",
  ],
};

const PEN_MODES: Array<{ id: PenMode; label: string; description: string }> = [
  { id: "solid", label: "Solid pixel", description: "Dense, hard-edged ink" },
  { id: "dither", label: "Dither ink", description: "Screen tone with paper gaps" },
  { id: "duotone", label: "Duotone", description: "Two-color woven texture" },
];

const PALETTE = [
  "#214fb3",
  "#e05a3f",
  "#191a22",
  "#4f8f4c",
  "#8a4da3",
  "#f0aa32",
  "#00a6c8",
  "#ec4d93",
  "#7a352d",
  "#f6d7a7",
  "#6044d8",
  "#73808c",
];

function stripHtml(value = "") {
  return value.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "sketch";
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function PixelToolIcon({ tool }: { tool: Tool }) {
  return (
    <span className="pixel-tool-icon" aria-hidden="true">
      {PIXEL_ICONS[tool].join("").split("").map((cell, index) => (
        <span className={cell === "1" ? "is-filled" : ""} key={index} />
      ))}
    </span>
  );
}

function ColorWheelControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-wheel-control">
      <span className="color-wheel-icon" aria-hidden="true" />
      <span className="color-wheel-copy">
        <strong>{label} COLOR WHEEL</strong>
        <small>CHOOSE ANY COLOR</small>
      </span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label} custom color`}
      />
    </label>
  );
}

export default function DoodleyStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeBaseRef = useRef<ImageData | null>(null);
  const undoRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const deadlineRef = useRef<number | null>(null);
  const advancingRef = useRef(false);

  const [tool, setTool] = useState<Tool>("pen");
  const [penMode, setPenMode] = useState<PenMode>("solid");
  const [showPenOptions, setShowPenOptions] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [density, setDensity] = useState(0.5);
  const [duotonePixelSize, setDuotonePixelSize] = useState(1);
  const [color, setColor] = useState(PALETTE[0]);
  const [secondaryColor, setSecondaryColor] = useState(PALETTE[1]);
  const [textValue, setTextValue] = useState("DOODLE");
  const [textPixelSize, setTextPixelSize] = useState(2);
  const [references, setReferences] = useState<ReferenceImage[]>([DEFAULT_REFERENCE]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const [historyTick, setHistoryTick] = useState(0);
  const [duration, setDuration] = useState(120);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("sports");
  const [searchResults, setSearchResults] = useState<ReferenceImage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const activeReference = references[activeIndex] ?? references[0];
  const completedCount = Object.keys(drawings).filter((id) => drawings[id]).length;
  const penModeLabel = PEN_MODES.find((mode) => mode.id === penMode)?.label ?? "Solid pixel";
  const penPreviewStyle = {
    "--pen-primary": color,
    "--pen-secondary": secondaryColor,
    "--duo-pixel-preview": `${duotonePixelSize * 2}px`,
  } as CSSProperties;

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) context.imageSmoothingEnabled = false;
    return context;
  }, []);

  const clearCanvasPixels = useCallback(() => {
    const context = getContext();
    if (!context) return;
    context.fillStyle = PAPER;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [getContext]);

  const persistCurrentDrawing = useCallback(() => {
    const canvas = canvasRef.current;
    const reference = references[activeIndex];
    if (!canvas || !reference) return "";
    const dataUrl = canvas.toDataURL("image/png");
    setDrawings((current) => ({ ...current, [reference.id]: dataUrl }));
    return dataUrl;
  }, [activeIndex, references]);

  const restoreCanvas = useCallback(
    (dataUrl?: string) => {
      clearCanvasPixels();
      if (!dataUrl) return;
      const context = getContext();
      if (!context) return;
      const image = new Image();
      image.onload = () => {
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      };
      image.src = dataUrl;
    },
    [clearCanvasPixels, getContext],
  );

  useEffect(() => {
    clearCanvasPixels();
    try {
      const saved = window.localStorage.getItem("doodley-drawings-v1");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        setDrawings(parsed);
        restoreCanvas(parsed[DEFAULT_REFERENCE.id]);
        setHasDrawn(Boolean(parsed[DEFAULT_REFERENCE.id]));
      }

      const savedPen = window.localStorage.getItem("doodley-pen-v1");
      if (savedPen) {
        const parsedPen = JSON.parse(savedPen) as {
          penMode?: PenMode;
          color?: string;
          secondaryColor?: string;
          density?: number;
          brushSize?: number;
          duotonePixelSize?: number;
          textPixelSize?: number;
        };
        if (PEN_MODES.some((mode) => mode.id === parsedPen.penMode)) {
          setPenMode(parsedPen.penMode as PenMode);
        }
        if (parsedPen.color) setColor(parsedPen.color);
        if (parsedPen.secondaryColor) setSecondaryColor(parsedPen.secondaryColor);
        if ([0.25, 0.5, 0.75].includes(parsedPen.density ?? 0)) {
          setDensity(parsedPen.density as number);
        }
        if (
          Number.isInteger(parsedPen.duotonePixelSize) &&
          (parsedPen.duotonePixelSize as number) >= MIN_DUOTONE_PIXEL_SIZE &&
          (parsedPen.duotonePixelSize as number) <= MAX_DUOTONE_PIXEL_SIZE
        ) {
          setDuotonePixelSize(parsedPen.duotonePixelSize as number);
        }
        if (
          Number.isInteger(parsedPen.textPixelSize) &&
          (parsedPen.textPixelSize as number) >= MIN_TEXT_PIXEL_SIZE &&
          (parsedPen.textPixelSize as number) <= MAX_TEXT_PIXEL_SIZE
        ) {
          setTextPixelSize(parsedPen.textPixelSize as number);
        }
        if (
          Number.isInteger(parsedPen.brushSize) &&
          (parsedPen.brushSize as number) >= MIN_BRUSH_SIZE &&
          (parsedPen.brushSize as number) <= MAX_BRUSH_SIZE
        ) {
          setBrushSize(parsedPen.brushSize as number);
        }
      }
    } catch {
      // A private browser window may reject storage. Drawing still works.
    }
  }, [clearCanvasPixels, restoreCanvas]);

  useEffect(() => {
    try {
      window.localStorage.setItem("doodley-drawings-v1", JSON.stringify(drawings));
    } catch {
      // Ignore storage quota errors; export remains available.
    }
  }, [drawings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "doodley-pen-v1",
        JSON.stringify({ penMode, color, secondaryColor, density, brushSize, duotonePixelSize, textPixelSize }),
      );
    } catch {
      // Pen preferences are optional; drawing remains available without storage.
    }
  }, [brushSize, color, density, duotonePixelSize, penMode, secondaryColor, textPixelSize]);

  const checkpoint = useCallback(() => {
    const context = getContext();
    if (!context) return;
    undoRef.current.push(context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
    if (undoRef.current.length > 30) undoRef.current.shift();
    redoRef.current = [];
    setHistoryTick((value) => value + 1);
  }, [getContext]);

  const mapPointer = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(CANVAS_WIDTH - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH))),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT))),
    };
  }, []);

  const setDitheredPixel = useCallback(
    (context: CanvasRenderingContext2D, x: number, y: number, nextColor: string, forceDensity = density) => {
      if (x < 0 || y < 0 || x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) return;
      if (BAYER_4[y & 3][x & 3] < Math.round(forceDensity * 16)) {
        context.fillStyle = nextColor;
        context.fillRect(x, y, 1, 1);
      }
    },
    [density],
  );

  const setStyledPixel = useCallback(
    (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      primaryColor: string,
      style: StampStyle,
    ) => {
      if (x < 0 || y < 0 || x >= CANVAS_WIDTH || y >= CANVAS_HEIGHT) return;

      if (style === "dither") {
        setDitheredPixel(context, x, y, primaryColor);
        return;
      }

      if (style === "duotone") {
        const patternX = Math.floor(x / duotonePixelSize) & 3;
        const patternY = Math.floor(y / duotonePixelSize) & 3;
        const usePrimary = BAYER_4[patternY][patternX] < Math.round(density * 16);
        context.fillStyle = usePrimary ? primaryColor : secondaryColor;
      } else {
        context.fillStyle = primaryColor;
      }
      context.fillRect(x, y, 1, 1);
    },
    [density, duotonePixelSize, secondaryColor, setDitheredPixel],
  );

  const stamp = useCallback(
    (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      nextColor: string,
      style: StampStyle = "dither",
    ) => {
      const radius = brushSize / 2;
      const start = -Math.floor(brushSize / 2);
      const end = start + brushSize - 1;
      const centerShift = brushSize % 2 === 0 ? 0.5 : 0;

      for (let offsetY = start; offsetY <= end; offsetY += 1) {
        for (let offsetX = start; offsetX <= end; offsetX += 1) {
          const distanceX = offsetX + centerShift;
          const distanceY = offsetY + centerShift;
          if (distanceX * distanceX + distanceY * distanceY <= radius * radius) {
            setStyledPixel(context, x + offsetX, y + offsetY, nextColor, style);
          }
        }
      }
    },
    [brushSize, setStyledPixel],
  );

  const drawPixelLine = useCallback(
    (
      context: CanvasRenderingContext2D,
      start: { x: number; y: number },
      end: { x: number; y: number },
      nextColor: string,
      style: StampStyle = "dither",
    ) => {
      const distance = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
      const steps = Math.max(1, distance);
      for (let step = 0; step <= steps; step += 1) {
        const x = Math.round(start.x + ((end.x - start.x) * step) / steps);
        const y = Math.round(start.y + ((end.y - start.y) * step) / steps);
        stamp(context, x, y, nextColor, style);
      }
    },
    [stamp],
  );

  const drawRectangle = useCallback(
    (context: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) => {
      const topLeft = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) };
      const topRight = { x: Math.max(start.x, end.x), y: Math.min(start.y, end.y) };
      const bottomRight = { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) };
      const bottomLeft = { x: Math.min(start.x, end.x), y: Math.max(start.y, end.y) };
      drawPixelLine(context, topLeft, topRight, color);
      drawPixelLine(context, topRight, bottomRight, color);
      drawPixelLine(context, bottomRight, bottomLeft, color);
      drawPixelLine(context, bottomLeft, topLeft, color);
    },
    [color, drawPixelLine],
  );

  const drawBitmapText = useCallback(
    (context: CanvasRenderingContext2D, text: string, startX: number, startY: number) => {
      let cursorX = startX;
      context.fillStyle = color;
      for (const rawCharacter of text.toUpperCase().slice(0, 18)) {
        const glyph = BITMAP_FONT[rawCharacter] ?? BITMAP_FONT["?"];
        glyph.forEach((row, rowIndex) => {
          row.split("").forEach((pixel, columnIndex) => {
            if (pixel !== "1") return;
            context.fillRect(
              cursorX + columnIndex * textPixelSize,
              startY + rowIndex * textPixelSize,
              textPixelSize,
              textPixelSize,
            );
          });
        });
        cursorX += 6 * textPixelSize;
        if (cursorX > CANVAS_WIDTH - 10) break;
      }
    },
    [color, textPixelSize],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const context = getContext();
    if (!context) return;
    const point = mapPointer(event);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === "picker") {
      const pixel = context.getImageData(point.x, point.y, 1, 1).data;
      setColor(`#${[pixel[0], pixel[1], pixel[2]].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`);
      return;
    }

    checkpoint();
    setHasDrawn(true);

    if (tool === "text") {
      drawBitmapText(context, textValue || "TEXT", point.x, point.y);
      persistCurrentDrawing();
      return;
    }

    isDrawingRef.current = true;
    lastPointRef.current = point;

    if (tool === "shape") {
      shapeStartRef.current = point;
      shapeBaseRef.current = context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }

    stamp(
      context,
      point.x,
      point.y,
      tool === "eraser" ? PAPER : color,
      tool === "eraser" ? "erase" : penMode,
    );
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const context = getContext();
    const point = mapPointer(event);
    if (!context || !lastPointRef.current) return;

    if (tool === "shape" && shapeStartRef.current && shapeBaseRef.current) {
      context.putImageData(shapeBaseRef.current, 0, 0);
      drawRectangle(context, shapeStartRef.current, point);
    } else {
      drawPixelLine(
        context,
        lastPointRef.current,
        point,
        tool === "eraser" ? PAPER : color,
        tool === "eraser" ? "erase" : penMode,
      );
    }
    lastPointRef.current = point;
  };

  const finishPointer = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    shapeStartRef.current = null;
    shapeBaseRef.current = null;
    persistCurrentDrawing();
  };

  const undo = useCallback(() => {
    const context = getContext();
    const previous = undoRef.current.pop();
    if (!context || !previous) return;
    redoRef.current.push(context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
    context.putImageData(previous, 0, 0);
    setHistoryTick((value) => value + 1);
    persistCurrentDrawing();
  }, [getContext, persistCurrentDrawing]);

  const redo = useCallback(() => {
    const context = getContext();
    const next = redoRef.current.pop();
    if (!context || !next) return;
    undoRef.current.push(context.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
    context.putImageData(next, 0, 0);
    setHistoryTick((value) => value + 1);
    persistCurrentDrawing();
  }, [getContext, persistCurrentDrawing]);

  const clearDrawing = () => {
    checkpoint();
    clearCanvasPixels();
    persistCurrentDrawing();
    setHasDrawn(false);
  };

  const switchReference = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= references.length || nextIndex === activeIndex) return;
      persistCurrentDrawing();
      setIsRunning(false);
      deadlineRef.current = null;
      setActiveIndex(nextIndex);
      setSecondsLeft(duration);
      undoRef.current = [];
      redoRef.current = [];
      setHistoryTick((value) => value + 1);
      const nextReference = references[nextIndex];
      restoreCanvas(drawings[nextReference.id]);
      setHasDrawn(Boolean(drawings[nextReference.id]));
    },
    [activeIndex, drawings, duration, persistCurrentDrawing, references, restoreCanvas],
  );

  const advanceReference = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    persistCurrentDrawing();
    setIsRunning(false);
    deadlineRef.current = null;
    if (activeIndex < references.length - 1) {
      const nextIndex = activeIndex + 1;
      setActiveIndex(nextIndex);
      setSecondsLeft(duration);
      undoRef.current = [];
      redoRef.current = [];
      setHistoryTick((value) => value + 1);
      const nextReference = references[nextIndex];
      restoreCanvas(drawings[nextReference.id]);
      setHasDrawn(Boolean(drawings[nextReference.id]));
    } else {
      setShowFinish(true);
    }
    window.setTimeout(() => {
      advancingRef.current = false;
    }, 250);
  }, [activeIndex, drawings, duration, persistCurrentDrawing, references, restoreCanvas]);

  useEffect(() => {
    if (!isRunning) return;
    if (!deadlineRef.current) deadlineRef.current = Date.now() + secondsLeft * 1000;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil(((deadlineRef.current ?? Date.now()) - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        advanceReference();
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [advanceReference, isRunning, secondsLeft]);

  const toggleTimer = useCallback(() => {
    if (isRunning) {
      const remaining = Math.max(0, Math.ceil(((deadlineRef.current ?? Date.now()) - Date.now()) / 1000));
      setSecondsLeft(remaining);
      deadlineRef.current = null;
      setIsRunning(false);
    } else {
      deadlineRef.current = Date.now() + secondsLeft * 1000;
      setIsRunning(true);
    }
  }, [isRunning, secondsLeft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      const shortcutMap: Record<string, Tool> = { b: "pen", e: "eraser", t: "text", r: "shape", i: "picker" };
      if (shortcutMap[event.key.toLowerCase()]) setTool(shortcutMap[event.key.toLowerCase()]);
      if (event.code === "Space") {
        event.preventDefault();
        toggleTimer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, toggleTimer, undo]);

  const handleDurationChange = (nextDuration: number) => {
    setDuration(nextDuration);
    setSecondsLeft(nextDuration);
    setIsRunning(false);
    deadlineRef.current = null;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 20)
      .map((file, index) => ({
        id: `upload-${Date.now()}-${index}`,
        url: URL.createObjectURL(file),
        title: file.name.replace(/\.[^.]+$/, ""),
        author: "Your upload",
        source: "Local image",
      }));
    if (uploaded.length) setReferences((current) => [...current, ...uploaded]);
  };

  const searchReferences = async (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    setIsSearching(true);
    setShowSearchResults(true);
    setSearchMessage("");
    try {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        generator: "search",
        gsrsearch: `${query} filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: "8",
        prop: "imageinfo|info",
        inprop: "url",
        iiprop: "url|mime|extmetadata",
        iiurlwidth: "900",
        iiextmetadatafilter: "Artist|LicenseShortName",
      });
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
      if (!response.ok) throw new Error("Search unavailable");
      const data = (await response.json()) as { query?: { pages?: Record<string, WikimediaPage> } };
      const results = Object.values(data.query?.pages ?? {})
        .map((page): ReferenceImage | null => {
          const info = page.imageinfo?.[0];
          if (!info || !info.mime?.startsWith("image/") || info.mime === "image/svg+xml") return null;
          const author = stripHtml(info.extmetadata?.Artist?.value) || "Wikimedia contributor";
          const license = stripHtml(info.extmetadata?.LicenseShortName?.value);
          return {
            id: `commons-${page.pageid}`,
            url: info.thumburl ?? info.url,
            title: page.title.replace(/^File:/, "").replace(/\.[^.]+$/, ""),
            author: license ? `${author} · ${license}` : author,
            source: "Wikimedia Commons",
            pageUrl: page.fullurl,
          };
        })
        .filter((item): item is ReferenceImage => Boolean(item));
      setSearchResults(results);
      setSearchMessage(results.length ? "" : "No usable images found. Try another prompt.");
    } catch {
      setSearchResults([]);
      setSearchMessage("Search is taking a break. You can still upload images.");
    } finally {
      setIsSearching(false);
    }
  };

  const addSearchResult = (reference: ReferenceImage) => {
    setReferences((current) => (current.some((item) => item.id === reference.id) ? current : [...current, reference]));
    setShowSearchResults(false);
  };

  const shuffleReferences = () => {
    persistCurrentDrawing();
    const shuffled = [...references].sort(() => Math.random() - 0.5);
    setReferences(shuffled);
    setActiveIndex(0);
    setSecondsLeft(duration);
    setIsRunning(false);
    restoreCanvas(drawings[shuffled[0]?.id]);
    setHasDrawn(Boolean(drawings[shuffled[0]?.id]));
  };

  const downloadCurrent = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeReference) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${String(activeIndex + 1).padStart(2, "0")}-${safeFileName(activeReference.title)}.png`);
    }, "image/png");
  };

  const downloadSession = async () => {
    const currentData = persistCurrentDrawing();
    const allDrawings = { ...drawings, [activeReference.id]: currentData };
    const zip = new JSZip();
    let added = 0;
    references.forEach((reference, index) => {
      const dataUrl = allDrawings[reference.id];
      if (!dataUrl) return;
      zip.file(`${String(index + 1).padStart(2, "0")}-${safeFileName(reference.title)}.png`, dataUrl.split(",")[1], { base64: true });
      added += 1;
    });
    zip.file(
      "session.txt",
      `DOODLEY DITHER SPRINT\n${new Date().toLocaleString()}\n${added} drawing${added === 1 ? "" : "s"}\n${duration} seconds per reference\n`,
    );
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `doodley-session-${new Date().toISOString().slice(0, 10)}.zip`);
  };

  const selectTool = (nextTool: Tool) => {
    if (nextTool === "pen") {
      setTool("pen");
      setShowPenOptions((isOpen) => (tool === "pen" ? !isOpen : true));
      return;
    }
    setTool(nextTool);
    setShowPenOptions(false);
  };

  return (
    <main className="doodley-app">
      <header className="brand-console" aria-label="Doodley drawing studio">
        <span className="speaker-grid" aria-hidden="true" />
        <div className="brand-lockup">
          <span className="brand-word">DOODLEY</span>
          <span className="brand-subtitle">DITHER SPRINT STUDIO</span>
        </div>
        <span className="status-led" title="Autosave active" />
        <span className="speaker-grid" aria-hidden="true" />
      </header>

      <section className="studio-grid">
        <article className="hardware-panel reference-panel" aria-label="Reference screen">
          <div className="screen-bezel">
            <div className="reference-screen">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeReference.url} alt={activeReference.title} />
              <div className="reference-overlay">
                <span>REFERENCE</span>
                <span>{String(activeIndex + 1).padStart(2, "0")}</span>
              </div>
            </div>

            <div className="reference-meta">
              <button
                type="button"
                className="pixel-button square-button"
                onClick={() => switchReference(activeIndex - 1)}
                disabled={activeIndex === 0}
                aria-label="Previous reference"
              >
                &lt;
              </button>
              <div className="reference-copy">
                <strong>{activeReference.title}</strong>
                {activeReference.pageUrl ? (
                  <a href={activeReference.pageUrl} target="_blank" rel="noreferrer">
                    {activeReference.source} · {activeReference.author}
                  </a>
                ) : (
                  <span>{activeReference.author}</span>
                )}
              </div>
              <button
                type="button"
                className="pixel-button square-button"
                onClick={() => switchReference(activeIndex + 1)}
                disabled={activeIndex === references.length - 1}
                aria-label="Next reference"
              >
                &gt;
              </button>
            </div>

            <div className="session-progress" aria-label={`${activeIndex + 1} of ${references.length} references`}>
              {references.slice(0, 12).map((reference, index) => (
                <button
                  type="button"
                  key={reference.id}
                  className={`progress-pip ${index === activeIndex ? "is-current" : ""} ${drawings[reference.id] ? "is-done" : ""}`}
                  onClick={() => switchReference(index)}
                  aria-label={`Open reference ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="reference-controls">
            <label className="pixel-button upload-button">
              <input type="file" accept="image/*" multiple onChange={(event) => handleFiles(event.target.files)} />
              <span aria-hidden="true">[+]</span> UPLOAD
            </label>
            <form className="search-form" onSubmit={searchReferences}>
              <span aria-hidden="true">[?]</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search reference images"
                placeholder="sports, poses…"
              />
              <button type="submit" disabled={isSearching} aria-label="Search">
                {isSearching ? "···" : "GO"}
              </button>
            </form>
            <button type="button" className="pixel-button square-button" onClick={shuffleReferences} aria-label="Shuffle references">
              MIX
            </button>

            {showSearchResults && (
              <div className="search-results" role="dialog" aria-label="Reference search results">
                <div className="results-header">
                  <strong>ADD A REFERENCE</strong>
                  <button type="button" onClick={() => setShowSearchResults(false)} aria-label="Close search results">
                    ×
                  </button>
                </div>
                {searchMessage && <p>{searchMessage}</p>}
                <div className="result-grid">
                  {searchResults.map((result) => (
                    <button type="button" key={result.id} onClick={() => addSearchResult(result)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={result.url} alt={result.title} />
                      <span>{result.title}</span>
                    </button>
                  ))}
                </div>
                <small>Images and licenses from Wikimedia Commons.</small>
              </div>
            )}
          </div>
        </article>

        <article className="hardware-panel canvas-panel" aria-label="Dithered drawing screen">
          <aside className="tool-rail" aria-label="Drawing tools">
            {TOOL_ITEMS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`tool-button ${tool === item.id ? "is-active" : ""}`}
                onClick={() => selectTool(item.id)}
                aria-pressed={tool === item.id}
                aria-expanded={item.id === "pen" ? showPenOptions : undefined}
                aria-controls={item.id === "pen" ? "pen-options" : undefined}
                title={`${item.label} (${item.shortcut})`}
              >
                <PixelToolIcon tool={item.id} />
                <span>{item.label}</span>
                <kbd>{item.shortcut}</kbd>
                {item.id === "pen" && <small className="tool-mode-label">{penMode === "duotone" ? "DUO" : penMode.toUpperCase()}</small>}
              </button>
            ))}
            <div className="rail-speaker" aria-hidden="true" />
          </aside>

          {showPenOptions && (
            <section id="pen-options" className="pen-options-card" aria-label="Pen options">
              <header className="pen-options-header">
                <div>
                  <span>TOOL 01</span>
                  <h2>PEN DECK</h2>
                </div>
                <button type="button" onClick={() => setShowPenOptions(false)} aria-label="Close pen options">×</button>
              </header>

              <p className="pen-options-intro">Choose how the ink fills each hard-edged brush pixel.</p>

              <div className="pen-mode-grid" role="radiogroup" aria-label="Pen mode">
                {PEN_MODES.map((mode) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={penMode === mode.id}
                    key={mode.id}
                    className={penMode === mode.id ? "is-selected" : ""}
                    onClick={() => setPenMode(mode.id)}
                  >
                    <span className={`pen-mode-preview ${mode.id}`} style={penPreviewStyle} aria-hidden="true" />
                    <strong>{mode.label}</strong>
                    <small>{mode.description}</small>
                  </button>
                ))}
              </div>

              <div className="pen-options-section">
                <div className="pen-section-heading">
                  <span>PRIMARY INK</span>
                  <output>{color.toUpperCase()}</output>
                </div>
                <div className="pen-color-row" aria-label="Primary pen color">
                  {PALETTE.map((swatch) => (
                    <button
                      type="button"
                      key={swatch}
                      className={color === swatch ? "is-selected" : ""}
                      style={{ backgroundColor: swatch }}
                      onClick={() => setColor(swatch)}
                      aria-label={`Use ${swatch} as the primary pen color`}
                    />
                  ))}
                </div>
                <ColorWheelControl label="PRIMARY" value={color} onChange={setColor} />
              </div>

              {penMode === "duotone" && (
                <div className="pen-options-section duo-section">
                  <div className="pen-section-heading">
                    <span>SECONDARY INK</span>
                    <output>{secondaryColor.toUpperCase()}</output>
                  </div>
                  <div className="pen-color-row" aria-label="Secondary pen color">
                    {PALETTE.map((swatch) => (
                      <button
                        type="button"
                        key={swatch}
                        className={secondaryColor === swatch ? "is-selected" : ""}
                        style={{ backgroundColor: swatch }}
                        onClick={() => setSecondaryColor(swatch)}
                        aria-label={`Use ${swatch} as the secondary pen color`}
                      />
                    ))}
                  </div>
                  <ColorWheelControl label="SECONDARY" value={secondaryColor} onChange={setSecondaryColor} />
                  <div className="duotone-strip" style={penPreviewStyle}>
                    <span>PRIMARY</span>
                    <strong>{Math.round(density * 100)} / {100 - Math.round(density * 100)}</strong>
                    <span>SECONDARY</span>
                  </div>
                  <div
                    className="duo-pixel-control"
                    style={{
                      "--duo-progress": `${((duotonePixelSize - MIN_DUOTONE_PIXEL_SIZE) / (MAX_DUOTONE_PIXEL_SIZE - MIN_DUOTONE_PIXEL_SIZE)) * 100}%`,
                    } as CSSProperties}
                  >
                    <div className="duo-pixel-heading">
                      <label htmlFor="duotone-pixel-size">TEXTURE PIXELS</label>
                      <output htmlFor="duotone-pixel-size" aria-live="polite">{duotonePixelSize} PX</output>
                    </div>
                    <div className="duo-pixel-slider">
                      <button
                        type="button"
                        onClick={() => setDuotonePixelSize((size) => Math.max(MIN_DUOTONE_PIXEL_SIZE, size - 1))}
                        disabled={duotonePixelSize === MIN_DUOTONE_PIXEL_SIZE}
                        aria-label="Decrease duotone texture pixel size"
                      >
                        −
                      </button>
                      <input
                        id="duotone-pixel-size"
                        type="range"
                        min={MIN_DUOTONE_PIXEL_SIZE}
                        max={MAX_DUOTONE_PIXEL_SIZE}
                        step="1"
                        value={duotonePixelSize}
                        onChange={(event) => setDuotonePixelSize(Number(event.target.value))}
                        aria-valuetext={`${duotonePixelSize} pixel texture blocks`}
                      />
                      <button
                        type="button"
                        onClick={() => setDuotonePixelSize((size) => Math.min(MAX_DUOTONE_PIXEL_SIZE, size + 1))}
                        disabled={duotonePixelSize === MAX_DUOTONE_PIXEL_SIZE}
                        aria-label="Increase duotone texture pixel size"
                      >
                        +
                      </button>
                    </div>
                    <div className="duo-pixel-scale" aria-hidden="true">
                      <span>FINE</span>
                      <span>CHUNKY</span>
                    </div>
                  </div>
                </div>
              )}

              {penMode !== "solid" && (
                <div className="pen-options-section texture-mix">
                  <div className="pen-section-heading"><span>{penMode === "duotone" ? "COLOR MIX" : "INK COVERAGE"}</span></div>
                  <div className="density-buttons" role="radiogroup" aria-label="Texture density">
                    {[0.25, 0.5, 0.75].map((amount) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={density === amount}
                        key={amount}
                        className={density === amount ? "is-selected" : ""}
                        onClick={() => setDensity(amount)}
                      >
                        {amount * 100}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <footer className="pen-options-footer">
                <span>{penMode === "duotone" ? "Every stroke pixel uses one of the two inks." : penMode === "solid" ? "No gaps. No smoothing. Pure pixel ink." : "Paper shows through the ordered screen tone."}</span>
                <button type="button" className="pixel-button" onClick={() => setShowPenOptions(false)}>DONE</button>
              </footer>
            </section>
          )}

          <div className="canvas-stage">
            <div className="canvas-status-row">
              <div>
                <span className="eyebrow">PIXEL GRID</span>
                <strong>{CANVAS_WIDTH} × {CANVAS_HEIGHT}</strong>
                <small>{tool === "pen" ? `PEN · ${penModeLabel.toUpperCase()}` : tool.toUpperCase()}</small>
              </div>
              <div className="timer-readout" data-warning={secondsLeft <= 10}>
                <span>TIME</span>
                <strong>{formatTime(secondsLeft)}</strong>
              </div>
              <div className="session-counter">
                <span>SPRINT</span>
                <strong>{activeIndex + 1} / {references.length}</strong>
              </div>
            </div>

            <div className="canvas-wrap">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
                onPointerLeave={finishPointer}
                aria-label="Dithered pixel drawing canvas"
              />
              {!hasDrawn && (
                <div className="canvas-hint" aria-hidden="true">
                  <span>DRAW HERE</span>
                  <small>Every mark snaps to the dither grid.</small>
                </div>
              )}
            </div>

            <div className="control-deck">
              <div className="history-controls">
                <button type="button" className="pixel-button" onClick={undo} disabled={undoRef.current.length === 0} aria-label="Undo">
                  <b aria-hidden="true">&lt;</b> <span>UNDO</span>
                </button>
                <button type="button" className="pixel-button" onClick={redo} disabled={redoRef.current.length === 0} aria-label="Redo">
                  <b aria-hidden="true">&gt;</b> <span>REDO</span>
                </button>
                <span className="history-tick" aria-hidden="true">{historyTick > -1 ? "" : ""}</span>
              </div>

              {tool !== "text" && (
                <div
                  className="size-slider-control"
                  style={{ "--size-progress": `${((brushSize - MIN_BRUSH_SIZE) / (MAX_BRUSH_SIZE - MIN_BRUSH_SIZE)) * 100}%` } as CSSProperties}
                >
                  <div className="size-slider-heading">
                    <label htmlFor="brush-size">{tool === "pen" ? "PEN SIZE" : "TOOL SIZE"}</label>
                    <output htmlFor="brush-size" aria-live="polite">{brushSize} PX</output>
                  </div>
                  <div className="size-slider-row">
                    <button
                      type="button"
                      onClick={() => setBrushSize((size) => Math.max(MIN_BRUSH_SIZE, size - 1))}
                      disabled={brushSize === MIN_BRUSH_SIZE}
                      aria-label="Decrease pen size"
                    >
                      −
                    </button>
                    <input
                      id="brush-size"
                      type="range"
                      min={MIN_BRUSH_SIZE}
                      max={MAX_BRUSH_SIZE}
                      step="1"
                      value={brushSize}
                      onChange={(event) => setBrushSize(Number(event.target.value))}
                      aria-valuetext={`${brushSize} pixels`}
                    />
                    <button
                      type="button"
                      onClick={() => setBrushSize((size) => Math.min(MAX_BRUSH_SIZE, size + 1))}
                      disabled={brushSize === MAX_BRUSH_SIZE}
                      aria-label="Increase pen size"
                    >
                      +
                    </button>
                  </div>
                  <div className="size-slider-scale" aria-hidden="true">
                    <span>1</span>
                    <span>10</span>
                    <span>20</span>
                  </div>
                </div>
              )}

              <label className="compact-control">
                <span>{tool === "text" ? "TEXT GRID" : tool === "pen" && penMode === "solid" ? "INK FILL" : penMode === "duotone" ? "DUO MIX" : "DITHER"}</span>
                {tool === "text" ? (
                  <strong className="solid-ink-value">5×7</strong>
                ) : tool === "pen" && penMode === "solid" ? (
                  <strong className="solid-ink-value">100%</strong>
                ) : (
                  <select value={density} onChange={(event) => setDensity(Number(event.target.value))}>
                    <option value="0.25">25%</option>
                    <option value="0.5">50%</option>
                    <option value="0.75">75%</option>
                  </select>
                )}
              </label>

              <div className="palette-control" aria-label="Drawing colors">
                {PALETTE.map((swatch) => (
                  <button
                    type="button"
                    key={swatch}
                    className={color === swatch ? "is-selected" : ""}
                    style={{ backgroundColor: swatch }}
                    onClick={() => setColor(swatch)}
                    aria-label={`Select color ${swatch}`}
                  />
                ))}
              </div>

              {tool === "text" && (
                <div className="text-stamp-control">
                  <div className="text-stamp-heading">
                    <label htmlFor="stamp-text">STAMP PIXEL TEXT</label>
                    <output>{textPixelSize}× / 5×7</output>
                  </div>
                  <input
                    id="stamp-text"
                    value={textValue}
                    maxLength={18}
                    onChange={(event) => setTextValue(event.target.value)}
                    placeholder="TYPE TEXT"
                  />
                  <div className="text-pixel-sizes" role="radiogroup" aria-label="Text pixel size">
                    {[1, 2, 3, 4].map((size) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={textPixelSize === size}
                        className={textPixelSize === size ? "is-selected" : ""}
                        key={size}
                        onClick={() => setTextPixelSize(size)}
                      >
                        {size}×
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="session-controls">
              <label className="duration-control">
                <span>SPRINT LENGTH</span>
                <select value={duration} onChange={(event) => handleDurationChange(Number(event.target.value))}>
                  <option value="30">00:30</option>
                  <option value="60">01:00</option>
                  <option value="120">02:00</option>
                  <option value="300">05:00</option>
                  <option value="600">10:00</option>
                </select>
              </label>
              <button type="button" className="pixel-button clear-button" onClick={clearDrawing}>CLEAR</button>
              <button type="button" className="pixel-button export-button" onClick={downloadCurrent}>PNG [V]</button>
              <button type="button" className={`pixel-button timer-button ${isRunning ? "is-running" : ""}`} onClick={toggleTimer}>
                {isRunning ? "[||] PAUSE" : secondsLeft === duration ? "[>] START" : "[>] RESUME"}
              </button>
              <button type="button" className="pixel-button skip-button" onClick={advanceReference}>SKIP [&gt;]</button>
            </div>
          </div>
        </article>
      </section>

      <footer className="app-footer">
        <span><i className="autosave-dot" /> Saved on this device</span>
        <span>{completedCount} finished · Space starts or pauses · ⌘Z undoes</span>
        <button type="button" onClick={downloadSession}>DOWNLOAD SESSION ZIP [V]</button>
      </footer>

      {showFinish && (
        <div className="finish-overlay" role="dialog" aria-modal="true" aria-labelledby="finish-title">
          <div className="finish-card">
            <span className="finish-stars" aria-hidden="true">✦ · ✦ · ✦</span>
            <p className="eyebrow">SPRINT COMPLETE</p>
            <h1 id="finish-title">NICE LINES!</h1>
            <p>Your pixel studies are saved on this device and ready to export.</p>
            <div className="finish-stats">
              <div><strong>{references.length}</strong><span>references</span></div>
              <div><strong>{formatTime(duration)}</strong><span>each</span></div>
              <div><strong>{completedCount || 1}</strong><span>drawings</span></div>
            </div>
            <button type="button" className="pixel-button timer-button" onClick={downloadSession}>DOWNLOAD ALL [V]</button>
            <button type="button" className="text-button" onClick={() => setShowFinish(false)}>Back to studio</button>
          </div>
        </div>
      )}
    </main>
  );
}
