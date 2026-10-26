// Camera yoke. MediaPipe finds both hands, the line between the palms is the yoke.
// tilt = roll, hands closer together (pulled back) = nose up, farther = nose down.
// Everything runs on the phone, the video isn't sent anywhere.

const ROLL_FULL = 40; // tilting the yoke 40 degrees = full roll
const PITCH_FULL = 0.3; // hands 30% closer together or farther apart = full pitch
const DEADZONE = 0.07; // small wobbles near the center count as zero
const SMOOTHING = 0.35; // how fast the yoke follows your hands (0 to 1)

// math

// The middle of the palm: the average of the wrist (point 0) and the four knuckles.
export function palmCenter(hand) {
  const points = [0, 5, 9, 13, 17].map((i) => hand[i]);
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

// Turns two hands into a yoke: its tilt angle and its width.
// Points go from 0 to 1 across the picture. The front camera is a mirror, so we flip x
// to make your left hand appear on the left.
export function yokeFromHands(hands, mirror = true) {
  if (hands.length < 2) return null;
  const palms = hands.slice(0, 2).map(palmCenter);
  if (mirror) palms.forEach((p) => (p.x = 1 - p.x));
  palms.sort((a, b) => a.x - b.x); // left palm first
  const [left, right] = palms;
  const width = Math.hypot(right.x - left.x, right.y - left.y);
  if (width < 0.08) return null; // too close: probably one hand seen twice
  const angle = (Math.atan2(right.y - left.y, right.x - left.x) * 180) / Math.PI;
  return { angle, width, left, right };
}

// Ignores tiny movements, then scales the rest so the full range still reaches 1.
function deadzone(value) {
  const size = Math.abs(value);
  if (size < DEADZONE) return 0;
  return Math.sign(value) * Math.min(1, (size - DEADZONE) / (1 - DEADZONE));
}

// Roll and pitch from -1 to 1, compared with the center you set.
export function controlsFromYoke(yoke, center) {
  const roll = (yoke.angle - center.angle) / ROLL_FULL;
  const pitch = (center.width - yoke.width) / center.width / PITCH_FULL;
  return { roll: deadzone(roll), pitch: deadzone(pitch) };
}

// camera and setup screen

export function setupHandYoke({ onOpen, onClose }) {
  const $ = (id) => document.getElementById(id);
  const video = $("cam-video");
  const mini = $("cam-mini");
  const actionBtn = $("cam-action");

  // input.js reads this object every frame.
  const hardware = (window.flightHardwareInput = { connected: false, pitch: 0, roll: 0, rudder: 0 });

  let stream = null;
  let tracker = null;
  let step = "off"; // off -> center -> flying
  let facing = "user"; // "user" is the front camera, "environment" the back one
  let yoke = null; // the latest smoothed yoke, or null if both hands aren't visible
  let center = null;
  let lastVideoTime = -1;
  let tracking = false; // true while track() is running every frame

  const STEPS = {
    off: [
      "Fly with any object",
      "Hold something with both hands like a steering wheel: a book, a plate, a ruler or a toy. The camera watches your hands.",
      "Turn on camera",
    ],
    center: [
      "Find your center",
      "Hold the object level in front of you, with both hands on screen. This is how you'll hold it to fly straight.",
      "Set center",
    ],
    flying: [
      "Ready to fly",
      "Tilt the object to turn. Pull it toward you to point the nose up. Push it toward the camera to point the nose down.",
      "Start flying",
    ],
  };

  function setStep(next) {
    step = next;
    const [title, text, button] = STEPS[next];
    $("cam-title").textContent = title;
    $("cam-step").textContent = text;
    actionBtn.textContent = button;
    actionBtn.disabled = false;
    $("cam-meters").classList.toggle("hidden", next !== "flying");
    $("cam-redo").classList.toggle("hidden", next !== "flying");
    $("cam-off").classList.toggle("hidden", next === "off");
    $("cam-flip").classList.toggle("hidden", next === "off");
  }

  function warn(text) {
    $("cam-warning").textContent = text;
    $("cam-warning").classList.toggle("hidden", !text);
  }

  async function startCamera() {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      warn("The camera only works on a secure (https) web address. Try Chrome or Safari.");
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
    } catch (error) {
      warn(
        error?.name === "NotAllowedError"
          ? "The camera is blocked. Allow camera access in your browser or phone settings, then try again."
          : "No camera was found, or another app is using it.",
      );
      return false;
    }
    video.srcObject = stream;
    video.classList.toggle("mirrored", facing === "user");
    await video.play().catch(() => {});
    warn("");
    return true;
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  // The hand tracker is big (about 8 MB), so it only loads the first time someone
  // turns on the camera. It tries the graphics chip first because that is faster.
  async function loadTracker() {
    if (tracker) return true;
    try {
      const { FilesetResolver, HandLandmarker } = await import("../vendor/mediapipe/vision_bundle.mjs");
      const folder = new URL("./vendor/mediapipe/", location.href).href;
      const files = await FilesetResolver.forVisionTasks(folder + "wasm");
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: folder + "hand_landmarker.task", delegate },
        runningMode: "VIDEO",
        numHands: 2,
      });
      try {
        tracker = await HandLandmarker.createFromOptions(files, options("GPU"));
      } catch {
        tracker = await HandLandmarker.createFromOptions(files, options("CPU"));
      }
      return true;
    } catch (error) {
      console.error(error);
      warn("Hand tracking could not load on this device. You can still fly with the keyboard.");
      return false;
    }
  }

  function startTracking() {
    if (tracking) return;
    tracking = true;
    requestAnimationFrame(track);
  }

  // Runs every frame while the camera is on.
  function track() {
    if (!stream) {
      tracking = false;
      return;
    }
    requestAnimationFrame(track);
    if (!tracker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;

    const hands = tracker.detectForVideo(video, performance.now()).landmarks || [];
    const seen = yokeFromHands(hands, facing === "user");
    if (!seen) yoke = null;
    else if (!yoke) yoke = seen;
    else {
      // Move part of the way toward the new reading so camera jitter doesn't shake the plane.
      yoke.angle += SMOOTHING * (seen.angle - yoke.angle);
      yoke.width += SMOOTHING * (seen.width - yoke.width);
      yoke.left = seen.left;
      yoke.right = seen.right;
    }

    if (step === "flying") {
      const controls = yoke ? controlsFromYoke(yoke, center) : { roll: 0, pitch: 0 };
      hardware.connected = Boolean(yoke);
      hardware.roll = controls.roll;
      hardware.pitch = controls.pitch;
      mini.classList.toggle("lost", !yoke);
      $("cam-mini-status").textContent = yoke ? "Camera yoke on" : "Can't see both hands";
      showMeters(controls);
    }
    drawYoke($("cam-overlay"), false);
    if (!mini.classList.contains("hidden")) drawYoke($("cam-mini-view"), true);
  }

  // Draws a yellow line between your palms, on top of the video.
  function drawYoke(canvas, withVideo) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (withVideo) {
      ctx.save();
      if (facing === "user") ctx.setTransform(-1, 0, 0, 1, w, 0); // mirror like the big preview
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    }
    if (!yoke) return;
    ctx.lineCap = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffc53d";
    ctx.beginPath();
    ctx.moveTo(yoke.left.x * w, yoke.left.y * h);
    ctx.lineTo(yoke.right.x * w, yoke.right.y * h);
    ctx.stroke();
    ctx.fillStyle = "#d9502a";
    for (const palm of [yoke.left, yoke.right]) {
      ctx.beginPath();
      ctx.arc(palm.x * w, palm.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function showMeters({ roll, pitch }) {
    $("cam-roll-fill").style.transform = `translateX(${roll * 50}%)`;
    $("cam-pitch-fill").style.transform = `translateX(${pitch * 50}%)`;
    $("cam-roll-word").textContent = !yoke ? "Not found" : roll > 0 ? "Right" : roll < 0 ? "Left" : "Level";
    $("cam-pitch-word").textContent = !yoke
      ? "Not found"
      : pitch > 0
        ? "Nose up"
        : pitch < 0
          ? "Nose down"
          : "Level";
  }

  // A short countdown so you have time to put both hands on the object.
  function countdown(seconds, done) {
    const number = $("cam-countdown");
    actionBtn.disabled = true;
    number.classList.remove("hidden");
    number.textContent = seconds;
    const timer = setInterval(() => {
      seconds -= 1;
      number.textContent = seconds;
      if (seconds > 0) return;
      clearInterval(timer);
      number.classList.add("hidden");
      actionBtn.disabled = false;
      done();
    }, 800);
  }

  function setCenter() {
    if (!yoke) {
      warn(
        "I can't see both hands. Hold the object with both hands and keep them on screen, then try again.",
      );
      return;
    }
    center = { angle: yoke.angle, width: yoke.width };
    warn("");
    setStep("flying");
    mini.classList.remove("hidden");
    document.body.classList.add("camera-yoke");
    $("camera-menu-label").textContent = "Camera yoke is on";
  }

  function turnOff() {
    stopCamera();
    hardware.connected = false;
    center = null;
    yoke = null;
    mini.classList.add("hidden");
    document.body.classList.remove("camera-yoke");
    $("camera-menu-label").textContent = "Set up camera yoke";
    setStep("off");
  }

  actionBtn.addEventListener("click", async () => {
    if (step === "off") {
      actionBtn.disabled = true;
      actionBtn.textContent = "Loading hand tracking…";
      if ((await startCamera()) && (await loadTracker())) {
        setStep("center");
        startTracking();
      } else {
        setStep("off");
      }
    } else if (step === "center") {
      countdown(2, setCenter);
    } else {
      close();
    }
  });

  $("cam-redo").addEventListener("click", () => setStep("center"));
  $("cam-off").addEventListener("click", turnOff);
  $("cam-flip").addEventListener("click", async () => {
    facing = facing === "user" ? "environment" : "user";
    if (await startCamera()) {
      setStep("center");
      startTracking();
    }
  });

  function open() {
    $("camera-screen").classList.remove("hidden");
    onOpen?.();
  }
  function close() {
    $("camera-screen").classList.add("hidden");
    onClose?.();
  }
  $("cam-close").addEventListener("click", close);
  $("camera-btn").addEventListener("click", open);
  $("camera-menu-btn").addEventListener("click", open);
  $("cam-mini-btn").addEventListener("click", open);

  setStep("off");
  return { open };
}
