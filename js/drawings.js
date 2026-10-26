// flashcard pictures drawn as svg: side view, front view, gauge, scan, approach
// (plane shapes are the <symbol>s in index.html)

const W = 260,
  H = 120,
  CX = 130,
  CY = 60;

function arrowHead(x, y, angleDeg, cls = "fa-accent") {
  const a = (angleDeg * Math.PI) / 180,
    s = 8;
  const p1 = [x - s * Math.cos(a - 0.5), y - s * Math.sin(a - 0.5)],
    p2 = [x - s * Math.cos(a + 0.5), y - s * Math.sin(a + 0.5)];
  return `<path class="${cls}-fill" d="M${x} ${y}L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}Z"/>`;
}
function arrow(x1, y1, x2, y2, cls = "fa-accent") {
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return `<path class="${cls}" d="M${x1} ${y1}L${x2} ${y2}"/>` + arrowHead(x2, y2, ang, cls);
}
function label(x, y, text, anchor = "middle") {
  return `<text class="fa-label" x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`;
}
const planeSide = (pitch, x = CX, y = CY, w = 96) =>
  `<use href="#plane-side" class="fa-plane" x="${x - w / 2}" y="${y - w / 4}" width="${w}" height="${w / 2}" transform="rotate(${-pitch} ${x} ${y})"/>`;

function side(pitch, extra) {
  let s = `<path class="fa-horizon" d="M10 ${CY + 18}H250"/>`;
  const nose = [CX + 40 * Math.cos((pitch * Math.PI) / 180), CY - 40 * Math.sin((pitch * Math.PI) / 180)];
  if (extra === "updown")
    s +=
      arrow(nose[0] + 18, CY - 4, nose[0] + 18, CY - 36) +
      arrow(nose[0] + 30, CY + 4, nose[0] + 30, CY + 36) +
      label(nose[0] + 10, 22, "nose up", "end") +
      label(nose[0] + 22, 112, "nose down", "end");
  if (extra === "flare") {
    return (
      `<path class="fa-ground" d="M0 104H260"/><path class="fa-runway" d="M110 104H250"/>` +
      `<path class="fa-path" d="M10 40Q120 96 200 100"/>` +
      label(16, 24, "level off just above the runway", "start") +
      planeSide(pitch, 170, 88, 70)
    );
  }
  if (extra === "slow")
    s += `<path class="fa-wind" d="M40 ${CY + 36}H70"/>` + label(16, 116, "speed falling", "start");
  return s + planeSide(pitch);
}

function front(bank, extra) {
  let s = `<path class="fa-horizon" d="M10 ${CY + 24}H250"/>`;
  const a = (bank * Math.PI) / 180;
  const liftEnd = [CX + 52 * Math.sin(a), CY - 52 * Math.cos(a)];
  s += `<g transform="rotate(${bank} ${CX} ${CY})"><path class="fa-wing" d="M60 ${CY}H200"/><path class="fa-wing" d="M${CX} ${CY - 10}V${CY - 26}"/><path class="fa-wing" d="M112 ${CY - 18}H148"/><circle class="fa-body" cx="${CX}" cy="${CY}" r="11"/></g>`;
  if (extra === "lift") {
    s += arrow(CX, CY, liftEnd[0], liftEnd[1]) + label(liftEnd[0] + 6, liftEnd[1] - 4, "lift", "start");
    if (Math.abs(bank) > 5)
      s +=
        `<path class="fa-dash" d="M${CX} ${CY}V${liftEnd[1]}M${CX} ${liftEnd[1]}H${liftEnd[0]}"/>` +
        label(CX - 6, liftEnd[1] + 4, "up", "end");
  }
  if (extra === "rollback") {
    s +=
      `<path class="fa-accent" d="M${CX + 60} ${CY - 40}A72 72 0 0 0 ${CX - 52} ${CY - 46}"/>` +
      arrowHead(CX - 52, CY - 46, 150);
    s += label(130, 114, "roll back toward level");
  }
  if (extra === "turn")
    s +=
      `<path class="fa-accent" d="M70 106Q170 112 220 80"/>` +
      arrowHead(220, 80, -32) +
      label(16, 22, "bank the wings and the airplane turns", "start");
  if (extra === "angle")
    s +=
      `<path class="fa-accent" d="M200 ${CY}A70 70 0 0 1 ${CX + 70 * Math.cos(a)} ${CY + 70 * Math.sin(a)}"/>` +
      label(214, CY + 22, `${bank}°`, "start");
  return s;
}

function gauge(kind, value) {
  const cfg = {
    speed: { max: 160, start: -150, span: 300, unit: "kt", name: "Airspeed" },
    altitude: { max: 1000, start: 0, span: 360, unit: "ft", name: "Altitude" },
    vsi: { max: 2000, start: -90, span: 85, unit: "ft/min", name: "Climb rate" },
  }[kind];
  const CX = 92;
  let s = `<circle class="fa-face" cx="${CX}" cy="${CY}" r="50"/>`;
  for (let i = 0; i <= 10; i++) {
    const deg = kind === "vsi" ? -90 + (i - 5) * 34 : cfg.start + (cfg.span * i) / 10,
      r = ((deg - 90) * Math.PI) / 180;
    s += `<path class="fa-tick" d="M${CX + 40 * Math.cos(r)} ${CY + 40 * Math.sin(r)}L${CX + 47 * Math.cos(r)} ${CY + 47 * Math.sin(r)}"/>`;
  }
  const deg =
    kind === "vsi"
      ? -90 + (85 * value) / 1000
      : kind === "altitude"
        ? ((value % 1000) / 1000) * 360
        : cfg.start + (cfg.span * value) / cfg.max;
  s += `<g transform="rotate(${deg} ${CX} ${CY})"><path class="fa-needle" d="M${CX - 3} ${CY + 6}L${CX} ${CY - 40}L${CX + 3} ${CY + 6}Z"/></g><circle class="fa-accent-fill" cx="${CX}" cy="${CY}" r="4"/>`;
  s +=
    label(156, 54, cfg.name, "start") +
    `<text class="fa-big" x="156" y="82">${value > 0 && kind === "vsi" ? "+" : ""}${value} ${cfg.unit}</text>`;
  return s;
}

function scan() {
  let s = "";
  [
    [60, "Speed"],
    [130, "Height"],
    [200, "Wings"],
  ].forEach(([x, name], i) => {
    s +=
      `<circle class="fa-face" cx="${x}" cy="62" r="26"/><path class="fa-needle-line" d="M${x} 62L${x + 14 * Math.sin(i + 0.6)} ${62 - 14 * Math.cos(i + 0.6)}"/>` +
      label(x, 106, name);
  });
  s +=
    `<path class="fa-path" d="M78 30Q130 6 182 30"/>` +
    arrowHead(182, 30, 30) +
    label(130, 14, "look at each one, then start again");
  return s;
}

function approach(mode) {
  let s = `<path class="fa-ground" d="M0 104H260"/><path class="fa-runway" d="M150 104H250"/><path class="fa-center" d="M160 104H240"/>`;
  if (mode === "stable")
    s +=
      `<path class="fa-path" d="M20 34L170 100"/>` +
      label(16, 22, "steady speed, path and wings", "start") +
      planeSide(-5, 80, 52, 70);
  return s;
}

// picture is [kind, ...options], as listed on each flashcard in content.js.
export function flashPicture([kind, a, b], title) {
  const draw = { side, front, gauge, scan, approach }[kind];
  return `<svg class="flash-art" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">${draw(a, b)}</svg>`;
}
