import * as THREE from "three";

// textures drawn with canvas at startup

const hasCanvas = () => typeof document !== "undefined" && typeof document.createElement === "function";

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

// seeded random so it looks the same every time
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas, repeat = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Light speckled grass. It is multiplied by each field's vertex color.
export function grassTexture() {
  if (!hasCanvas()) return null;
  const size = 256,
    c = makeCanvas(size),
    ctx = c.getContext("2d"),
    rng = seeded(11);
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const x = rng() * size,
      y = rng() * size,
      r = 0.6 + rng() * 2.2;
    const v = 200 + Math.floor(rng() * 55);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    // Draw wrapped copies so the tile has no seams.
    for (const ox of [0, -size, size])
      for (const oy of [0, -size, size]) {
        ctx.moveTo(x + ox + r, y + oy);
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      }
    ctx.fill();
  }
  return finish(c);
}

// Planted rows for crop fields. The u axis runs across the rows.
export function cropTexture() {
  if (!hasCanvas()) return null;
  const size = 128,
    c = makeCanvas(size),
    ctx = c.getContext("2d"),
    rng = seeded(29);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const rows = 8,
    w = size / rows;
  for (let i = 0; i < rows; i++) {
    ctx.fillStyle = "rgba(70,60,30,0.28)";
    ctx.fillRect(i * w + w * 0.62, 0, w * 0.38, size);
  }
  for (let i = 0; i < 500; i++) {
    const v = 215 + Math.floor(rng() * 40);
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(rng() * size, rng() * size, 1.5, 1.5);
  }
  return finish(c);
}

// Runway asphalt: dark grey with fine grain and a few tire marks.
export function asphaltTexture() {
  if (!hasCanvas()) return null;
  const size = 256,
    c = makeCanvas(size),
    ctx = c.getContext("2d"),
    rng = seeded(47);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = 205 + Math.floor(rng() * 50);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rng() * size, rng() * size, 1.4, 1.4);
  }
  ctx.strokeStyle = "rgba(40,40,40,0.12)";
  ctx.lineWidth = 5;
  for (let i = 0; i < 4; i++) {
    const x = 50 + rng() * 150;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rng() - 0.5) * 12, size);
    ctx.stroke();
  }
  return finish(c);
}

// Two-lane country road: white edge lines and a dashed yellow center line.
// The texture runs 20 m across and repeats every 20 m along the road.
export const ROAD_GREY = "#646a71";
export function roadTexture() {
  if (!hasCanvas()) return null;
  const w = 64,
    h = 64,
    c = document.createElement("canvas"),
    ctx = c.getContext("2d"),
    rng = seeded(83);
  c.width = w;
  c.height = h;
  ctx.fillStyle = ROAD_GREY;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) {
    const v = 80 + Math.floor(rng() * 40);
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},0.6)`;
    ctx.fillRect(rng() * w, rng() * h, 1, 1);
  }
  ctx.fillStyle = "#9aa0a6";
  ctx.fillRect(0, 0, 3, h);
  ctx.fillRect(w - 3, 0, 3, h);
  ctx.fillStyle = "#f4f2ea";
  ctx.fillRect(5, 0, 2, h);
  ctx.fillRect(w - 7, 0, 2, h);
  ctx.fillStyle = "#f2c94c";
  ctx.fillRect(w / 2 - 1, 0, 2, h * 0.5);
  const tex = finish(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  return tex;
}

// Soft round shadow drawn under the airplane.
export function blobShadowTexture() {
  if (!hasCanvas()) return null;
  const size = 128,
    c = makeCanvas(size),
    ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.6, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c, false);
}
