// AeroKids - menus, lessons, free flight and the HUD

import { FlightSim } from "./sim.js";
import { KeyboardInput } from "./input.js";
import { setupHandYoke } from "./handyoke.js";
import {
  LESSONS,
  LESSON_ORDER,
  TAKEOFF_STEP,
  SAFETY_CHECKS,
  resolveStep,
  missFeedback,
  quizBanks,
  pickQuestions,
  factFor,
} from "./content.js";
import { SoundBoard } from "./sound.js";
import { flashPicture } from "./drawings.js";

const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");

const homeScreen = $("home-screen");
const hud = $("hud");
const dialogs = [
  "plan-screen",
  "flashcard-screen",
  "lesson-intro",
  "pause-screen",
  "question-screen",
  "quiz-screen",
  "crash-screen",
  "complete-screen",
  "careers-screen",
  "discovery-screen",
].map($);
const lessonButtons = [...document.querySelectorAll(".lesson-choice")];

const MEADOW_AIRPORT = { name: "Meadow Airport", x: 520, z: -3400 };
const STEP = 1 / 60; // the sim runs 60 small steps per second

const sound = new SoundBoard();
const completedLessons = new Set();

let sim;
let input;
let handYoke = null;
let ready = false;

// The current flight. mode is "lesson" (Flight school) or "free" (Free flight).
let mode = "lesson";
let lessonKey = "pitch";
let flying = false; // a flight is on screen (it may be paused)
let takeoffDone = false;
let courseStarted = false;
let finished = false; // the end screen for this flight has been shown
let questionOpen = false;
let questionCooldown = 0;
let askedQuestions = new Set();
let danger = { dive: 0, climb: 0, bank: 0, slow: 0 };
let report = null;
let log = { seconds: 0, meters: 0, maxAltitude: 0 };
let found = new Set(); // landmarks found in Free flight
let landmarkTarget = null;
let landmarkTimer = 0;
let cloudTipShown = false;
let touchdownSeen = false;
let cameraView = "chase";
let cameraPausedFlight = false;
let toastTimer = null;
let factTimer = null;

// controls

function enableControls() {
  window.flightControlsEnabled = true;
}

function disableControls() {
  window.flightControlsEnabled = false;
  input?.clearAxes();
}

function pauseFlight() {
  disableControls();
  sim.setPaused(true);
}

function resumeFlight() {
  enableControls();
  sim.setPaused(false);
}

function closeDialogs() {
  dialogs.forEach(hide);
}

// on phones go fullscreen and sideways (works on Android, iPhone just ignores it)
function goFullscreen() {
  if (!window.matchMedia || !matchMedia("(pointer: coarse)").matches) return;
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement
    .requestFullscreen()
    .then(() => screen.orientation.lock("landscape"))
    .catch(() => {});
}

// Power lever for touch screens: drag up for more power. The arrow keys move the same throttle.
const powerLever = $("power-lever");
function setPowerFromFinger(e) {
  const box = powerLever.getBoundingClientRect();
  input.throttle = clamp(1 - (e.clientY - box.top - 10) / (box.height - 20), 0, 1);
}
powerLever.addEventListener("pointerdown", (e) => {
  if (!window.flightControlsEnabled) return;
  powerLever.setPointerCapture?.(e.pointerId);
  setPowerFromFinger(e);
  e.preventDefault();
});
powerLever.addEventListener("pointermove", (e) => {
  if (window.flightControlsEnabled && e.buttons) setPowerFromFinger(e);
});

// home menu

$("school-btn").addEventListener("click", () => (homeScreen.dataset.view = "school"));
$("school-back").addEventListener("click", () => (homeScreen.dataset.view = "home"));

lessonButtons.forEach((button) => {
  button.addEventListener("click", () => {
    lessonKey = button.dataset.lesson;
    startLesson();
  });
});

$("free-btn").addEventListener("click", () => {
  if (!ready) return;
  goFullscreen();
  mode = "free";
  startFlight();
});

$("careers-btn").addEventListener("click", () => show($("careers-screen")));
$("careers-back").addEventListener("click", () => hide($("careers-screen")));
$("careers-close").addEventListener("click", () => hide($("careers-screen")));
$("discovery-btn").addEventListener("click", () => show($("discovery-screen")));
$("discovery-back").addEventListener("click", () => hide($("discovery-screen")));
$("discovery-close").addEventListener("click", () => hide($("discovery-screen")));

function goHome() {
  disableControls();
  if (sim) {
    sim.setPaused(true);
    sim.clearMissionGates();
    sim.reset();
    sim.setAttract(true);
  }
  flying = false;
  setCameraView(cameraView);
  closeDialogs();
  hide($("fact-card"));
  hide(hud);
  // After a lesson you land back on the lesson list; after Free flight, on the main menu.
  homeScreen.dataset.view = mode === "lesson" ? "school" : "home";
  show(homeScreen);
}

function markLessonDone(key) {
  completedLessons.add(key);
  $("learning-progress").textContent = `${completedLessons.size} of 4 done`;
  lessonButtons.forEach((b) => b.classList.toggle("done", completedLessons.has(b.dataset.lesson)));
}

// lesson

function startLesson() {
  if (!ready) return;
  goFullscreen();
  mode = "lesson";
  showFlightPlan();
}

function showFlightPlan() {
  const { plan } = LESSONS[lessonKey];
  disableControls();
  hide(homeScreen);
  show($("plan-screen"));
  $("plan-result").textContent = "";
  hide($("plan-next-btn"));

  $("plan-route").innerHTML = plan.route
    .map((label, i) => {
      const line = i < plan.route.length - 1 ? '<div class="route-line"></div>' : "";
      return `<div class="route-stop"><span>${i + 1}</span><strong>${label}</strong></div>${line}`;
    })
    .join("");
  $("plan-question").querySelector("h3").textContent = plan.question;

  showChoices($("plan-options"), plan.options, (correct, button, buttons) => {
    if (correct) {
      buttons.forEach((b) => (b.disabled = true));
      $("plan-result").textContent = plan.success;
      show($("plan-next-btn"));
    } else {
      $("plan-result").textContent = "Not quite. Try again!";
    }
  });
}

// Fills a .choice-list with answer buttons in a random order. options are [label, correct, ...].
function showChoices(box, options, onPick) {
  box.innerHTML = "";
  const buttons = shuffle(options).map(([label, correct, ...rest]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.textContent = label;
    button.addEventListener("click", () => {
      button.classList.add(correct ? "correct" : "wrong");
      if (!correct) setTimeout(() => button.classList.remove("wrong"), 650);
      onPick(correct, button, buttons, ...rest);
    });
    box.appendChild(button);
    return button;
  });
}

// Fisher-Yates shuffle: swap each item with a random one before it.
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

$("plan-back-btn").addEventListener("click", goHome);
$("plan-next-btn").addEventListener("click", () => {
  hide($("plan-screen"));
  showFlashcard(0);
});

let flashIndex = 0;

function showFlashcard(index) {
  const cards = LESSONS[lessonKey].flashcards;
  const card = cards[index];
  flashIndex = index;
  show($("flashcard-screen"));
  $("flash-count").textContent = `Card ${index + 1} of ${cards.length}`;
  $("flash-title").textContent = card.title;
  $("flash-picture").innerHTML = flashPicture(card.picture, card.title);
  $("flash-text").textContent = card.text;
  $("flash-next-btn").textContent = index === cards.length - 1 ? "Go to the runway" : "Next";
}

$("flash-back-btn").addEventListener("click", goHome);
$("flash-next-btn").addEventListener("click", () => {
  if (flashIndex < LESSONS[lessonKey].flashcards.length - 1) {
    showFlashcard(flashIndex + 1);
  } else {
    hide($("flashcard-screen"));
    startFlight();
  }
});

// Shown once the plane is off the runway: explain the course, then fly it.
function showLessonIntro() {
  const { intro } = LESSONS[lessonKey];
  takeoffDone = true;
  pauseFlight();
  $("intro-kicker").textContent = intro.kicker;
  $("intro-title").textContent = intro.title;
  $("intro-copy").textContent = intro.copy;
  $("intro-controls").textContent = intro.controls;
  show($("lesson-intro"));
}

$("lesson-intro-home").addEventListener("click", goHome);
$("intro-go-btn").addEventListener("click", () => {
  hide($("lesson-intro"));
  courseStarted = true;
  resumeFlight();
});

function setUpCourse() {
  const gates = LESSONS[lessonKey].gates();
  sim.setMissionGates(gates);
  sim.lessonKey = lessonKey;
  $("mission-dots").innerHTML = gates.map(() => '<span class="mission-dot"></span>').join("");
  show($("mission-progress"));
  showCourseProgress(0, gates.length);
  report = { gatesPassed: 0, maxAltitude: 0, maxBank: 0, minAirspeed: Infinity, totalGates: gates.length };
}

function showCourseProgress(current, total) {
  $("mission-progress-count").textContent = `${current} / ${total}`;
  [...$("mission-dots").children].forEach((dot, i) => {
    dot.classList.toggle("done", i < current);
    dot.classList.toggle("current", i === current && current < total);
  });
}

function updateCourse(state) {
  if (!state.onGround) {
    report.maxAltitude = Math.max(report.maxAltitude, state.altitudeFt || 0);
    report.maxBank = Math.max(report.maxBank, Math.abs(state.rollDeg || 0));
    if (state.speedKts > 0) report.minAirspeed = Math.min(report.minAirspeed, state.speedKts);
  }

  const lesson = LESSONS[lessonKey];
  if (state.justPassedGate) {
    const { index } = state.justPassedGate;
    report.gatesPassed += 1;
    showCourseProgress(state.gateIndex, state.gateCount);
    showToast(lesson.passed[index] || "Ring cleared!", 2600, true);
    const question = lesson.reflection(index, state);
    if (question) askOnce(`${lessonKey}-${index}`, question);
  }
  if (state.justMissedGate) {
    const miss = state.justMissedGate;
    showCourseProgress(state.gateIndex, state.gateCount);
    showToast(missFeedback(miss, lessonKey), 2400);
    if (miss.attempts >= 2) askOnce(`miss-${lessonKey}-${miss.index}`, lesson.repeatedMiss);
  }
}

function courseComplete(state) {
  const { complete } = sim.getMissionProgress();
  if (lessonKey !== "landing") return complete;
  // The landing lesson ends once the plane has touched down at Meadow and slowed down.
  if (state.justLanded && state.runwayId === "training") {
    touchdownSeen = true;
    showToast("Touchdown! Stay in the middle and slow down.", 2600, true);
  }
  return complete && touchdownSeen && state.onGround && state.speedKts < 12;
}

let quiz = { questions: [], index: 0, firstTry: 0, misses: 0 };

function startQuiz() {
  quiz = { questions: pickQuestions(quizBanks[lessonKey], 3, lessonKey), index: 0, firstTry: 0, misses: 0 };
  show($("quiz-screen"));
  showQuizQuestion();
}

function showQuizQuestion() {
  const item = quiz.questions[quiz.index];
  const last = quiz.index === quiz.questions.length - 1;
  quiz.misses = 0;
  $("quiz-progress").textContent = `Question ${quiz.index + 1} of ${quiz.questions.length}`;
  $("quiz-title").textContent = item.q;
  $("quiz-result").textContent = "";
  hide($("quiz-next-btn"));

  const options = item.a.map((label, i) => [label, i === item.correct]);
  showChoices($("quiz-options"), options, (correct, button, buttons) => {
    if (correct) {
      buttons.forEach((b) => (b.disabled = true));
      if (quiz.misses === 0) quiz.firstTry += 1;
      $("quiz-result").textContent = `${quiz.misses === 0 ? "Correct!" : "You got it."} ${item.explanation}`;
      $("quiz-next-btn").textContent = last ? "See results" : "Next";
      show($("quiz-next-btn"));
    } else {
      quiz.misses += 1;
      button.disabled = true;
      $("quiz-result").textContent = "Not quite. Try another answer.";
    }
  });
}

$("quiz-next-btn").addEventListener("click", () => {
  quiz.index += 1;
  if (quiz.index < quiz.questions.length) showQuizQuestion();
  else showLessonComplete();
});

function showLessonComplete() {
  const { name } = LESSONS[lessonKey];
  markLessonDone(lessonKey);
  hide($("quiz-screen"));

  const summary =
    lessonKey === "landing"
      ? "You flew to Meadow Airport, landed and stopped safely."
      : "You flew the whole course and kept the plane under control.";
  const score = `You got ${quiz.firstTry} of ${quiz.questions.length} quiz questions right on your first try.`;
  const slowest = Number.isFinite(report.minAirspeed)
    ? `, slowest speed ${Math.round(report.minAirspeed)} kt`
    : "";
  const flight =
    `Your flight: ${report.gatesPassed} of ${report.totalGates} rings, ` +
    `highest ${Math.round(report.maxAltitude)} ft, steepest bank ${Math.round(report.maxBank)}°${slowest}.`;

  $("complete-title").textContent = `You finished ${name}!`;
  $("complete-copy").textContent = `${summary} ${score} ${flight}`;
  $("next-btn").textContent = lessonKey === "landing" ? "Back to lesson 1" : "Next lesson";
  show($("complete-screen"));
}

$("next-btn").addEventListener("click", () => {
  lessonKey = LESSON_ORDER[(LESSON_ORDER.indexOf(lessonKey) + 1) % LESSON_ORDER.length];
  hide($("complete-screen"));
  startLesson();
});
$("complete-retry").addEventListener("click", () => {
  hide($("complete-screen"));
  startFlight();
});
$("complete-home").addEventListener("click", goHome);

// free flight

// Everything you can find, nearest first, skipping ones already found.
function landmarksToFind(state) {
  const list = sim.landscape?.landmarksNear(state.x, state.z, 7000) || [];
  for (const m of sim.mountains) {
    list.push({
      type: "mountain",
      x: m.x,
      z: m.z,
      y: m.height,
      key: `mountain@${m.x},${m.z}`,
      reach: m.radius + 250,
    });
  }
  // You start at Home Airport, so the airport to find is the other one.
  list.push({
    type: "airport",
    name: MEADOW_AIRPORT.name,
    x: MEADOW_AIRPORT.x,
    z: MEADOW_AIRPORT.z,
    y: 0,
    key: "meadow",
    reach: 700,
  });
  return list
    .filter((l) => !found.has(l.key))
    .map((l) => ({ ...l, distance: Math.hypot(l.x - state.x, l.z - state.z) }))
    .sort((a, b) => a.distance - b.distance);
}

function updateFreeFlight(state) {
  if (state.justLanded) showToast("Nice landing!", 2400, true);
  if (state.onGround) return;

  // Pick the nearest landmark every 2 seconds, so the arrow follows the closest one.
  landmarkTimer -= STEP;
  if (landmarkTimer <= 0) {
    landmarkTimer = 2;
    landmarkTarget = landmarksToFind(state)[0] || null;
  }
  const t = landmarkTarget;
  if (t && Math.hypot(state.x - t.x, state.z - t.z) < (t.reach || 260) && Math.abs(state.y - t.y) < 300) {
    found.add(t.key);
    sound.play("coin", 0.7);
    showFact(t);
    landmarkTarget = null;
    landmarkTimer = 0;
  }
}

function showFact(landmark) {
  const fact = factFor(landmark.type);
  $("fact-kicker").textContent = `You found it! ${found.size} found`;
  $("fact-title").textContent = landmark.name && landmark.type === "airport" ? landmark.name : fact.title;
  $("fact-text").textContent = fact.text;
  hide($("skill-toast"));
  show($("fact-card"));
  clearTimeout(factTimer);
  factTimer = setTimeout(() => hide($("fact-card")), 10000);
}

function distanceText(meters) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m away` : `${(meters / 1000).toFixed(1)} km away`;
}

// stop and teach

// If the plane stays in an unsafe state for a full second, pause and ask about it.
// Each kind of problem is asked once per flight.
function checkSafety(state, dt) {
  if (questionOpen || questionCooldown > 0 || state.onGround) return;
  const problems = {
    dive: state.verticalSpeedFpm < -1300 && state.altitudeFt > 90,
    climb: state.pitchDeg > 12 && state.speedKts < 62 && state.altitudeFt > 80,
    bank: Math.abs(state.rollDeg) > 52,
    slow: state.speedKts < 40 && state.altitudeFt > 100,
  };
  for (const [kind, happening] of Object.entries(problems)) {
    danger[kind] = happening ? danger[kind] + dt : Math.max(0, danger[kind] - dt * 2);
  }
  const kind = Object.keys(problems).find((k) => danger[k] > 1);
  if (kind) askOnce(`safety-${kind}`, { kicker: "Stop and think", ...SAFETY_CHECKS[kind] });
}

function askOnce(key, question) {
  if (askedQuestions.has(key)) return;
  askedQuestions.add(key);
  askQuestion(question);
}

// Pauses the flight and asks a question. After the right answer it shows the
// explanation and, for safety questions, how to fix the problem.
function askQuestion({ kicker = "Flight check", title, copy, options, fix }) {
  questionOpen = true;
  pauseFlight();
  sound.play("click", 0.5);
  $("question-kicker").textContent = kicker;
  $("question-title").textContent = title;
  $("question-copy").textContent = copy;
  $("question-result").textContent = "";
  $("question-fix").textContent = fix || "";
  hide($("question-fix"));
  hide($("question-continue"));
  showChoices($("question-options"), options, (correct, button, buttons, explanation) => {
    $("question-result").textContent = explanation;
    if (correct) {
      buttons.forEach((b) => (b.disabled = true));
      if (fix) show($("question-fix"));
      show($("question-continue"));
    }
  });
  show($("question-screen"));
}

$("question-continue").addEventListener("click", () => {
  hide($("question-screen"));
  questionOpen = false;
  questionCooldown = 5;
  danger = { dive: 0, climb: 0, bank: 0, slow: 0 };
  resumeFlight();
});

// starting a flight

let starting = false;

async function startFlight() {
  if (starting) return;
  starting = true;
  $("loading-title").textContent = "Getting your plane ready";
  $("loading-status").textContent = "Rolling the plane onto the runway…";
  setLoadingBar(0.9);
  hide($("loading-retry"));
  show($("loading-screen"));
  try {
    resetFlight();
    pauseFlight();
    // Build the scenery around the plane before the first frame.
    await sim.landscape.prepare(sim.state.x, sim.state.z);
    await sim.renderer.compileAsync(sim.scene, sim.camera);
    sim.render();
    resetClock();
    hide($("loading-screen"));
    resumeFlight();
  } catch (error) {
    console.error(error);
    showLoadError("The flight could not start. Restart the app to try again.");
  } finally {
    starting = false;
  }
}

function resetFlight() {
  closeDialogs();
  hide(homeScreen);
  hide($("fact-card"));
  show(hud);

  input.reset();
  sim.reset();
  sim.setAttract(false);
  sim.clearMissionGates();
  hide($("mission-progress"));
  if (mode === "lesson") setUpCourse();

  flying = true;
  takeoffDone = false;
  courseStarted = false;
  finished = false;
  questionOpen = false;
  questionCooldown = 4;
  askedQuestions = new Set();
  danger = { dive: 0, climb: 0, bank: 0, slow: 0 };
  found = new Set();
  landmarkTarget = null;
  landmarkTimer = 0;
  touchdownSeen = false;
  cloudTipShown = false;
  log = { seconds: 0, meters: 0, maxAltitude: 0 };

  document.body.classList.toggle("free-flight", mode === "free");
  setCameraView(cameraView);
  showStep(TAKEOFF_STEP);
}

// pause, crash and camera

function statRows(rows) {
  return rows
    .map(([label, value]) => `<div class="log-row"><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
}

function showPause() {
  const minutes = Math.floor(log.seconds / 60);
  const seconds = String(Math.floor(log.seconds % 60)).padStart(2, "0");
  const rows = [
    ["Flying time", `${minutes}:${seconds}`],
    ["Distance", `${(log.meters / 1000).toFixed(1)} km`],
    ["Highest", `${Math.round(log.maxAltitude)} ft`],
  ];
  if (mode === "free") rows.push(["Landmarks found", found.size]);
  $("pilot-log").innerHTML = statRows(rows);
  show($("pause-screen"));
}

$("pause-btn").addEventListener("click", () => {
  if (!flying || sim.paused) return;
  pauseFlight();
  showPause();
});
$("resume-btn").addEventListener("click", () => {
  hide($("pause-screen"));
  resumeFlight();
});
$("restart-btn").addEventListener("click", () => {
  hide($("pause-screen"));
  startFlight();
});
$("pause-home-btn").addEventListener("click", goHome);
$("pause-camera-btn").addEventListener("click", () => {
  hide($("pause-screen"));
  handYoke?.open();
  cameraPausedFlight = true; // closing the camera setup goes back to flying
});
$("pause-sound-btn").addEventListener("click", toggleSound);

function showCrash(reason) {
  closeDialogs();
  sound.play("crash", 0.7);
  $("crash-title").textContent = "Crash! The flight ended.";
  $("crash-copy").textContent = `${reason} Try again with smaller, earlier moves.`;
  show($("crash-screen"));
}

$("crash-retry").addEventListener("click", () => {
  hide($("crash-screen"));
  startFlight();
});
$("crash-home").addEventListener("click", goHome);

function toggleSound() {
  sound.start();
  showSoundState(sound.toggle());
}

function showSoundState(muted) {
  $("pause-sound-btn").textContent = muted ? "Sound: off" : "Sound: on";
  $("pause-sound-btn").ariaPressed = String(!muted);
}

// The chase camera follows the plane; the cockpit view (C key) looks out the windshield.
function setCameraView(view) {
  cameraView = view;
  sim?.setCameraMode(view);
  const inCockpit = view === "cockpit" && flying;
  $("cockpit-overlay").classList.toggle("hidden", !inCockpit);
  document.body.classList.toggle("cockpit-view", inCockpit);
}

function pauseForFocusLoss() {
  input?.clearAxes();
  if (flying && !sim.paused) {
    pauseFlight();
    showPause();
  }
  accumulator = 0;
}

// Sound can only start after the first tap or key press.
window.addEventListener("pointerdown", () => sound.start());
window.addEventListener("keydown", (e) => {
  sound.start();
  if (e.code === "KeyM") toggleSound();
  if (e.code === "KeyC" && window.flightControlsEnabled && flying) {
    e.preventDefault();
    setCameraView(cameraView === "cockpit" ? "chase" : "cockpit");
  }
});
window.addEventListener("blur", pauseForFocusLoss);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseForFocusLoss();
  resetClock();
});

// main loop

let lastTime = performance.now();
let accumulator = 0;
let hudTimer = 0;

function resetClock() {
  lastTime = performance.now();
  accumulator = 0;
}

// Runs once per screen refresh. The physics runs in fixed 1/60 s steps so the
// plane flies the same on a fast computer and a slow phone.
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  let state = sim.state;
  $("power-lever-fill").style.height = `${Math.round(input.throttle * 100)}%`;
  accumulator = Math.min(accumulator + dt, 0.1);
  while (accumulator >= STEP) {
    state = sim.update(input.update(STEP), STEP);
    accumulator -= STEP;
    step(state);
  }

  sound.flight({
    active: flying && !sim.paused,
    throttle: state.throttle || 0,
    speedKts: state.speedKts || 0,
  });
  updateCloudVeil(state);
  hudTimer += dt;
  if (hudTimer >= 0.1) {
    hudTimer = 0;
    updateHud(state);
  }
  sim.render();
}

// One 1/60 s step of lesson and Free flight rules on top of the physics.
function step(state) {
  if (questionCooldown > 0) questionCooldown -= STEP;
  if (!flying || finished) return;

  if (!sim.paused && !state.crashed) {
    log.seconds += STEP;
    log.meters += state.speedKts * 0.514444 * STEP; // knots to meters per second
    log.maxAltitude = Math.max(log.maxAltitude, state.altitudeFt || 0);
    if (state.justLanded) sound.play("land", 0.7);

    if (!takeoffDone && !state.onGround && state.altitudeFt > 70) {
      if (mode === "lesson") showLessonIntro();
      else {
        takeoffDone = true;
        showToast("You're flying! Follow the arrow to find landmarks.", 3200, true);
      }
    }

    if (mode === "lesson" && courseStarted && !questionOpen) {
      if (state.justPassedGate) sound.play("coin", 0.5);
      updateCourse(state);
      if (courseComplete(state)) {
        finished = true;
        pauseFlight();
        startQuiz();
        return;
      }
    }
    if (mode === "free") updateFreeFlight(state);
    if (takeoffDone && !questionOpen) checkSafety(state, STEP);
  }

  if (state.crashed) {
    finished = true;
    pauseFlight();
    showCrash(state.failureReason);
  }
}

// Flying into a cloud fades the view to white, like real cloud.
function updateCloudVeil(state) {
  const eye = sim.camera?.position;
  const density = flying && eye && sim.landscape ? sim.landscape.cloudDensityAt(eye.x, eye.y, eye.z) : 0;
  const opacity = Math.min(0.94, density * 2.2);
  $("cloud-veil").style.opacity = String(opacity);
  if (opacity > 0.5 && !cloudTipShown && flying && !sim.paused) {
    cloudTipShown = true;
    showToast(
      "Inside a cloud you can't see the ground! Pilots who fly by looking outside stay clear of clouds.",
      4200,
      true,
    );
  }
}

// hud (what you see while flying)

function showToast(message, ms = 1800, teaching = false) {
  clearTimeout(toastTimer);
  const toast = $("skill-toast");
  toast.textContent = message;
  toast.classList.toggle("education-toast", teaching);
  show(toast);
  toastTimer = setTimeout(() => hide(toast), ms);
}

function showStep(step, state = sim.state, gate = null) {
  const view = resolveStep(step, state, gate);
  $("lesson-title").textContent = view.title;
  $("target-main").textContent = view.target;
  $("target-sub").textContent = view.sub;
  $("feedback").textContent = view.feedback;
}

function updateHud(state) {
  const speed = state.speedKts || 0;
  const altitude = Math.max(0, state.altitudeFt || 0);
  const climb = state.verticalSpeedFpm || 0;
  const heading = headingDegrees(state.heading);
  const roll = state.rollDeg || 0;
  const pitch = clamp(state.pitchDeg || 0, -25, 25);

  $("airspeed").textContent = Math.round(speed);
  $("altitude").textContent = Math.round(altitude);
  $("heading").textContent = String(heading).padStart(3, "0");
  $("vertical-speed").textContent = Math.round(climb / 50) * 50;
  $("asi-needle").style.transform = `rotate(${-150 + (300 * Math.min(160, speed)) / 160}deg)`;
  $("alt-needle").style.transform = `rotate(${((altitude % 1000) / 1000) * 360}deg)`;
  $("hdg-card").style.transform = `rotate(${-heading}deg)`;
  $("vsi-needle").style.transform = `rotate(${-90 + (85 * clamp(climb, -2000, 2000)) / 1000}deg)`;
  $("att-horizon").style.transform = `rotate(${-roll}deg) translateY(${pitch * 1.6}px)`;
  $("att-pointer").style.transform = `rotate(${-roll}deg)`;

  $("cockpit-speed").textContent = Math.round(speed);
  $("cockpit-alt").textContent = Math.round(altitude);
  $("cockpit-hdg").textContent = String(heading).padStart(3, "0");
  $("cockpit-power").textContent = `${Math.round((state.throttle ?? 0) * 100)}%`;

  const groundClose =
    takeoffDone && !state.onGround && altitude < 110 && climb < 0 && lessonKey !== "landing";
  $("ground-warning").classList.toggle("hidden", !groundClose);

  if (!flying || sim.paused) return;
  if (!takeoffDone) {
    showStep(TAKEOFF_STEP, state);
    pointArrow(state, null);
  } else if (mode === "lesson") {
    updateLessonHud(state);
  } else {
    updateFreeHud(state);
  }
}

function updateLessonHud(state) {
  const lesson = LESSONS[lessonKey];
  const progress = sim.getMissionProgress();
  const gate = progress.complete ? null : sim.missionGates[progress.current];

  if (progress.complete && lesson.touchdown) showStep(lesson.touchdown, state);
  else showStep(lesson.steps[Math.min(progress.current, lesson.steps.length - 1)], state, gate);

  // The arrow points at the next ring, or at the runway once the landing course is flown.
  pointArrow(state, gate || (progress.complete && lessonKey === "landing" ? MEADOW_AIRPORT : null));
}

function updateFreeHud(state) {
  const t = landmarkTarget;
  $("lesson-title").textContent = "Free flight";
  $("feedback").textContent = `Landmarks found: ${found.size}`;
  if (t) {
    $("target-main").textContent = `Find: ${t.type === "airport" ? t.name : factFor(t.type).title}`;
    $("target-sub").textContent = distanceText(Math.hypot(state.x - t.x, state.z - t.z));
  } else {
    $("target-main").textContent = "Explore";
    $("target-sub").textContent = "Looking for landmarks…";
  }
  pointArrow(state, t);
}

function pointArrow(state, target) {
  const arrow = $("target-arrow");
  arrow.classList.toggle("hidden", !target);
  if (!target) return;
  const bearing = (Math.atan2(target.x - state.x, state.z - target.z) * 180) / Math.PI;
  $("target-arrow-needle").style.transform = `rotate(${bearing - headingDegrees(state.heading)}deg)`;
}

// sim headings are radians, counter-clockwise; the compass is degrees, clockwise.
function headingDegrees(radians) {
  const degrees = ((((-radians * 180) / Math.PI) % 360) + 360) % 360;
  return Math.round(degrees) % 360;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// start up

function showLoadError(message, retry = true) {
  show($("loading-screen"));
  $("loading-title").textContent = "Flight paused";
  $("loading-status").textContent = message;
  $("loading-retry").classList.toggle("hidden", !retry);
}

$("loading-retry").addEventListener("click", () => location.reload());

function setLoadingBar(fraction) {
  const percent = `${Math.round(clamp(fraction, 0.04, 1) * 100)}%`;
  $("loading-bar").style.width = percent;
  $("loading-screen").style.setProperty?.("--p", percent);
}

async function boot() {
  try {
    sim = new FlightSim($("sim-canvas"), (message, fraction) => {
      $("loading-status").textContent = message;
      if (Number.isFinite(fraction)) setLoadingBar(fraction);
    });
    input = new KeyboardInput();
    disableControls();
    handYoke = setupHandYoke({
      onOpen: () => {
        cameraPausedFlight = flying && !sim.paused;
        if (cameraPausedFlight) pauseFlight();
      },
      onClose: () => {
        if (cameraPausedFlight && !questionOpen && !finished) resumeFlight();
        cameraPausedFlight = false;
      },
    });
    await sim.ready;

    ready = true;
    showSoundState(sound.muted);
    // Phones start on the lighter graphics setting.
    if (window.matchMedia && matchMedia("(pointer: coarse) and (max-height: 600px)").matches) sim.setQuality("low");
    // add ?debug to the url to poke at the sim from the console
    if (location.search.includes("debug")) window.__aerokids = { sim, input };
    hide($("loading-screen"));
    $("school-btn").disabled = false;
    resetClock();
    requestAnimationFrame(animate);
  } catch (error) {
    console.error(error);
    showLoadError(
      "The simulator could not start. Check that you opened the full folder through a local server and that WebGL 2 is available.",
    );
  }
}

boot();
