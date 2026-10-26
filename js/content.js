// All the words in the app: lessons, stop-and-teach questions, quiz and facts.
// Lesson order: flight plan question, flashcards, takeoff, intro, rings, quiz.
// steps[i] shows while you fly toward ring i. Some text is a function of
// (state, gate) so it can show live numbers.

export const LESSON_ORDER = ["pitch", "roll", "level", "landing"];

const feet = (state, gate) => `${gate.targetAlt} ft`;

// world y is meters above the runway, wheels sit ~1 m up
const ftToWorldY = (ft) => 1.05 + ft / 3.28084;

function straightCourse({ radius, startZ, gap, xs, alts, criteria }) {
  return xs.map((x, i) => ({
    x,
    y: ftToWorldY(alts[i]),
    z: startZ - gap * i,
    radius,
    targetAlt: alts[i],
    criteria: criteria(i),
  }));
}

export const LESSONS = {
  pitch: {
    name: "Pitch",
    intro: {
      kicker: "Lesson 1",
      title: "Pitch moves the nose up and down.",
      copy: "Climb, level off, go down, then climb back. Keep an eye on how high you are and how fast you're going.",
      controls: "Pull the yoke back to raise the nose. Push it forward to lower the nose.",
    },
    plan: {
      route: ["Takeoff", "Climb", "Level", "Descend"],
      question: "When you climb up to the high ring, what should you keep an eye on?",
      options: [
        ["Your speed, so it doesn't get too slow", true],
        ["Tipping the wings a lot", false],
        ["Making one giant move at the end", false],
      ],
      success: "Good thinking. Climbing uses up speed, so watch it as you go up.",
    },
    flashcards: [
      {
        title: "Pitch",
        text: "Pitch is which way the nose points: up, down or level. Nose up to climb, nose down to go down.",
        picture: ["side", 12, "updown"],
      },
      {
        title: "Airspeed",
        text: "Airspeed is how fast air rushes past the wings, in knots (kt). Climbing steeply makes it drop, like biking up a hill.",
        picture: ["gauge", "speed", 65],
      },
      {
        title: "Climb rate",
        text: "The climb rate gauge shows how fast you're going up or down, in feet per minute. Zero means your height is steady.",
        picture: ["gauge", "vsi", 500],
      },
      {
        title: "Stall",
        text: "Wings need air flowing fast over them to make lift. Nose too high and too slow, and the wing stops lifting. That's a stall.",
        picture: ["side", 24, "slow"],
      },
    ],
    gates: () =>
      straightCourse({
        radius: 44,
        startZ: -470,
        gap: 385,
        xs: [0, 0, 0, 0, 0, 0],
        alts: [150, 300, 300, 175, 260, 260],
        criteria: (i) => (i === 5 ? { maxAbsBank: 9, maxAbsVSpeed: 480 } : {}),
      }),
    steps: [
      {
        title: "Start climbing gently.",
        target: "Climb",
        sub: "Nose up a little",
        feedback: "Small moves. Let the plane climb on its own.",
      },
      {
        title: "Climb to the high ring.",
        target: "High ring",
        sub: feet,
        feedback: (s) =>
          s.speedKts < 50 ? "You're getting slow. Lower the nose a little." : "Watch your height and speed.",
      },
      {
        title: "Level off at the ring's height.",
        target: "Level off",
        sub: feet,
        feedback: (s) =>
          Math.abs(s.verticalSpeedFpm) > 550
            ? "Still climbing. Bring the nose down to level."
            : "Nice and level.",
      },
      {
        title: "Go down slowly.",
        target: "Go down",
        sub: feet,
        feedback: (s) =>
          s.verticalSpeedFpm < -900 ? "Going down fast. Ease the nose up." : "Smooth and slow.",
      },
      {
        title: "Climb back up.",
        target: "Climb back",
        sub: feet,
        feedback: "Start leveling a little before you reach the height.",
      },
      {
        title: "Finish flying steady.",
        target: "Steady",
        sub: feet,
        feedback: (s) =>
          Math.abs(s.verticalSpeedFpm) < 450
            ? "Steady. Hold it there."
            : "Get the nose level so you stop going up or down.",
      },
    ],
    passed: [
      "You're climbing. Raising the nose made the plane go up.",
      "High ring! You climbed without getting too slow.",
      "Level! You started leveling off before the ring.",
      "Nice slow descent.",
      "Back up. Small, early moves work best.",
      "Last ring. Wings level, height steady. That's flying!",
    ],
    reflection(i, state) {
      if (i === 1)
        return {
          title: "You made the climb!",
          copy: "If your speed starts dropping while you climb, what helps?",
          options: [
            [
              "Lower the nose a little",
              true,
              "Yes! Pointing the nose a bit lower is like going down a gentler hill. The plane speeds back up.",
            ],
            ["Point the nose even higher", false, "That makes the plane slow down even more."],
            ["Tip the wings a lot", false, "Tipping the wings turns the plane. It doesn't fix your speed."],
          ],
        };
      if (i === 2 && Math.abs(state.verticalSpeedFpm) > 500)
        return {
          title: "You were still climbing at the ring.",
          copy: "How can you stop right at the height you want?",
          options: [
            [
              "Start lowering the nose a little before you get there",
              true,
              "Yes! A plane keeps moving while you change it, like a bike coasting. Start early.",
            ],
            ["Wait until you're way past it", false, "Then you'll go too high and have to come back down."],
            ["Tip the wings", false, "The wings turn the plane. The nose controls going up and down."],
          ],
        };
      if (i === 3)
        return {
          title: "You went down smoothly.",
          copy: "If you're going down too steeply, how do you fix it?",
          options: [
            ["Raise the nose a little", true, "Yes! Less nose-down means a gentler slope."],
            ["Push the nose down more", false, "That makes you go down even faster."],
            ["Tip the wings a lot", false, "That turns the plane but doesn't fix going down fast."],
          ],
        };
      return null;
    },
    repeatedMiss: {
      title: "That ring was tricky.",
      copy: "What usually helps the most?",
      options: [
        [
          "Make small moves early and watch what the plane does",
          true,
          "Yes! Small, early moves are easier to control than big, late ones.",
        ],
        ["Make one giant move at the last second", false, "Big late moves make the plane swing too far."],
        ["Don't look at the gauges", false, "The gauges show you what's happening before it's a problem."],
      ],
    },
  },

  roll: {
    name: "Roll and turn",
    intro: {
      kicker: "Lesson 2",
      title: "Tip the wings to turn.",
      copy: "Fly a twisty course. Tip the wings smoothly and start leveling them before each ring.",
      controls: "Tilt the yoke left or right to tip the wings. Hold it level to stop turning.",
    },
    plan: {
      route: ["Takeoff", "Bank", "Turn", "Roll out"],
      question: "As you get close to where you want to stop turning, what should you do?",
      options: [
        ["Start bringing the wings back to level", true],
        ["Tip the wings even more", false],
        ["Close your eyes", false],
      ],
      success: "Right. The plane keeps turning for a moment, so start leveling early.",
    },
    flashcards: [
      {
        title: "Bank",
        text: "Bank is how far the wings are tipped. Level wings mean 0 degrees.",
        picture: ["front", 30, "angle"],
      },
      {
        title: "Turn",
        text: "When the wings tip, some of their lift pulls sideways. That sideways pull turns the plane.",
        picture: ["front", 25, "turn"],
      },
      {
        title: "Rolling out",
        text: "Start leveling the wings before you're pointed where you want to go, or you'll turn too far.",
        picture: ["front", 12, "rollback"],
      },
      {
        title: "Turns and height",
        text: "In a steep turn, less lift points up, so the plane can sink. Keep turns gentle.",
        picture: ["front", 35, "lift"],
      },
    ],
    gates: () =>
      straightCourse({
        radius: 46,
        startZ: -520,
        gap: 395,
        xs: [0, -185, -390, -120, 220, 420, 0],
        alts: Array(7).fill(260),
        criteria: (i) => ([0, 3, 6].includes(i) ? { maxAbsBank: 9, maxAbsVSpeed: 550 } : { maxAbsBank: 36 }),
      }),
    steps: [
      {
        title: "Get ready for the turns.",
        target: "Get ready",
        sub: feet,
        feedback: "Wings level, flying steady.",
      },
      {
        title: "Tip the wings toward the next ring.",
        target: "Turn",
        sub: feet,
        feedback: "A gentle tip is enough.",
      },
      {
        title: "Keep turning.",
        target: "Keep turning",
        sub: feet,
        feedback: (s) =>
          Math.abs(s.rollDeg) > 36 ? "Wings are tipped a lot. Ease off a little." : "Good turn.",
      },
      {
        title: "Level the wings early.",
        target: "Level wings",
        sub: "Start before the ring",
        feedback: "Start leveling now, not after the ring.",
      },
      { title: "Turn the other way.", target: "Other way", sub: feet, feedback: "Smooth and gentle." },
      {
        title: "Turn and keep your height.",
        target: "Turn and height",
        sub: feet,
        feedback: (s) =>
          Math.abs(s.verticalSpeedFpm) > 650
            ? "Your height is changing fast. Check the nose."
            : "Keep checking your gauges.",
      },
      {
        title: "Level the wings and finish.",
        target: "Finish",
        sub: feet,
        feedback: "Wings level, height steady.",
      },
    ],
    passed: [
      "Ready to turn.",
      "You tipped the wings and the plane started turning.",
      "Nice turn. You kept the wings tipped just enough.",
      "You leveled early and stopped right on target.",
      "You turned the other way.",
      "Great. You turned and kept your height at the same time.",
      "Course done. Wings level at the finish!",
    ],
    reflection(i) {
      if (i === 3)
        return {
          title: "You leveled the wings early.",
          copy: "Why start leveling before you're pointed the right way?",
          options: [
            [
              "The plane keeps turning until the wings are level",
              true,
              "Yes! As long as the wings are tipped, the plane keeps turning. Start early so you stop on target.",
            ],
            ["The runway moves around", false, "Runways stay put."],
            ["The engine needs a break", false, "The engine doesn't change how you turn."],
          ],
        };
      if (i === 2 || i === 6)
        return {
          title: "You're in a turn.",
          copy: "Why can a plane sink when it turns?",
          options: [
            [
              "Some of the lift pulls sideways instead of up",
              true,
              "Yes! The wings' lift tips with them, so less of it holds the plane up.",
            ],
            ["The engine turns off", false, "The engine keeps running in a turn."],
            [
              "Planes can't change height in a turn",
              false,
              "They can. That's why pilots watch their height.",
            ],
          ],
        };
      return null;
    },
    repeatedMiss: {
      title: "That turn was tricky.",
      copy: "What will help next time?",
      options: [
        ["Start turning or leveling a little earlier", true, "Yes! Early, gentle moves get you to the ring."],
        ["Tip the wings a lot at the last second", false, "That usually makes you turn too far."],
        ["Skip the next ring", false, "The rings show you where to fly."],
      ],
    },
  },

  level: {
    name: "Straight and level",
    intro: {
      kicker: "Lesson 3",
      title: "Fly straight and steady.",
      copy: "Keep your height, speed and wings steady all at once. Fix little problems before they get big.",
      controls: "Yoke for the nose and wings. Power lever for speed.",
    },
    plan: {
      route: ["Takeoff", "Settle", "Hold", "Finish"],
      question: "What's the best way to fix a small mistake?",
      options: [
        ["Make one small change, wait, then check again", true],
        ["Move everything at once", false],
        ["Wait until the mistake is huge", false],
      ],
      success: "Good. One small change at a time lets you see what it did.",
    },
    flashcards: [
      {
        title: "Altitude",
        text: "Altitude is how high you are, in feet. One full trip around this gauge is 1,000 feet.",
        picture: ["gauge", "altitude", 300],
      },
      {
        title: "Climb rate",
        text: "The climb rate gauge tells you if you're going up or down before your altitude changes much.",
        picture: ["gauge", "vsi", 0],
      },
      {
        title: "Airspeed",
        text: "More power makes you faster. So does pointing the nose down. Both change your speed.",
        picture: ["gauge", "speed", 85],
      },
      {
        title: "Scan",
        text: "Pilots look from gauge to gauge to window, over and over. That's called a scan.",
        picture: ["scan"],
      },
    ],
    gates: () =>
      straightCourse({
        radius: 46,
        startZ: -530,
        gap: 390,
        xs: [0, 0, 35, -35, 28, 0, 0],
        alts: Array(7).fill(260),
        criteria(i) {
          const c = {};
          if ([0, 4, 5, 6].includes(i)) c.maxAbsVSpeed = 480;
          if ([1, 4, 5, 6].includes(i)) c.maxAbsBank = 9;
          if (i === 2) c.minSpeed = 62;
          if (i === 3 || i === 6) Object.assign(c, { minSpeed: 62, maxSpeed: 98 });
          return c;
        },
      }),
    steps: [
      {
        title: "Settle at the ring's height.",
        target: "Settle",
        sub: feet,
        feedback: (s) =>
          Math.abs(s.verticalSpeedFpm) > 500 ? "Still going up or down. Level the nose." : "Nice and steady.",
      },
      {
        title: "Keep the wings level.",
        target: "Straight",
        sub: feet,
        feedback: "Check your height and wings.",
      },
      {
        title: "Check your power and speed.",
        target: "Power check",
        sub: "Not too slow",
        feedback: (s) => (s.speedKts < 62 ? "A bit slow. Add some power." : "Good speed."),
      },
      {
        title: "Keep your speed just right.",
        target: "Speed check",
        sub: "Not too fast",
        feedback: (s) => (s.speedKts > 98 ? "A bit fast. Take off some power." : "Keep the nose calm."),
      },
      {
        title: "Make a small turn.",
        target: "Small turn",
        sub: feet,
        feedback: "Early and gentle.",
      },
      {
        title: "Keep everything steady.",
        target: "Hold",
        sub: feet,
        feedback: "Look around all your gauges, not just one.",
      },
      {
        title: "Finish steady.",
        target: "Final check",
        sub: feet,
        feedback: "Keep the last fix small.",
      },
    ],
    passed: [
      "Settled. Your height is steady.",
      "Straight and level. Wings stayed flat.",
      "Power check done. Good speed.",
      "Speed check done. You used power, not big nose moves.",
      "Nice small turn. Early and gentle wins.",
      "Steady! You checked more than one gauge.",
      "All done. Height, speed and wings all steady.",
    ],
    reflection(i) {
      if (i === 2)
        return {
          title: "You did a power check.",
          copy: "What does the Power lever mostly change?",
          options: [
            ["How fast you go", true, "Yes! More power pushes the plane faster through the air."],
            ["Which way the runway points", false, "The runway never moves."],
            ["The color of the wings", false, "Nice try. Power doesn't change the paint."],
          ],
        };
      if (i === 3 || i === 6)
        return {
          title: "You're keeping lots of things steady.",
          copy: "Why check the climb rate as well as the altitude?",
          options: [
            [
              "It warns you early that your height is about to change",
              true,
              "Yes! It's like seeing a car start to roll before it's moved very far.",
            ],
            [
              "It replaces the altitude gauge",
              false,
              "You need both: where you are and where you're heading.",
            ],
            ["It only works on the ground", false, "It matters most while you're flying."],
          ],
        };
      return null;
    },
    repeatedMiss: {
      title: "Steady flying is hard at first.",
      copy: "What usually helps?",
      options: [
        [
          "Make one small change, wait, then check again",
          true,
          "Yes! Then you can see what your change did.",
        ],
        ["Move all the controls at once", false, "Then it's hard to tell what fixed what."],
        ["Make one giant move at the last second", false, "That usually makes a new problem."],
      ],
    },
  },

  landing: {
    name: "Takeoff and landing",
    intro: {
      kicker: "Lesson 4",
      title: "Fly to Meadow Airport and land.",
      copy: "Climb, cruise, line up with the runway, go down slowly and land. Keep your speed under control.",
      controls: "Use the nose, the wings and the Power lever together.",
    },
    plan: {
      route: ["Takeoff", "Cruise", "Approach", "Land"],
      question: "What should you get ready early, way before you land?",
      options: [
        ["Line up with the runway and slow down", true],
        ["A sharp turn at the very end", false],
        ["Full power all the way to the ground", false],
      ],
      success: "Good. Getting ready early makes the landing much easier.",
    },
    flashcards: [
      {
        title: "Approach",
        text: "The approach is the part of the flight where you line up and get ready to land.",
        picture: ["approach", "stable"],
      },
      {
        title: "Going down",
        text: "Going down too fast means a hard bump on the runway. Slow and steady is best.",
        picture: ["gauge", "vsi", -500],
      },
      {
        title: "Landing speed",
        text: "Too fast and you'll zoom past the runway. Too slow and the wings can stall.",
        picture: ["gauge", "speed", 65],
      },
      {
        title: "Flare",
        text: "Just above the runway, raise the nose a little. This flare slows your sink for a soft touchdown.",
        picture: ["side", 6, "flare"],
      },
    ],
    // These gates lead to Meadow Airport's runway, so they are placed by hand.
    gates: () =>
      [
        [80, 240, -930],
        [225, 300, -1420],
        [385, 260, -1870],
        [470, 200, -2240],
        [510, 140, -2470],
        [520, 82, -2620],
        [520, 42, -2710],
      ].map(([x, alt, z], i) => {
        const criteria = {};
        if (i >= 3) criteria.maxAbsBank = 13;
        if (i >= 4) criteria.maxAbsVSpeed = 800;
        if (i >= 5) Object.assign(criteria, { minSpeed: 38, maxSpeed: 96 });
        return { x, y: ftToWorldY(alt), z, radius: 50, targetAlt: alt, criteria };
      }),
    steps: [
      {
        title: "Climb away from the home airport.",
        target: "Climb out",
        sub: feet,
        feedback: "No need to rush the turn.",
      },
      {
        title: "Fly toward Meadow Airport.",
        target: "Cruise",
        sub: feet,
        feedback: "Look outside for the runway.",
      },
      { title: "Find the runway.", target: "Find runway", sub: feet, feedback: "Start getting ready early." },
      {
        title: "Line up with the runway.",
        target: "Line up",
        sub: feet,
        feedback: "Fix your line early.",
      },
      {
        title: "Go down slowly.",
        target: "Go down",
        sub: feet,
        feedback: (s) =>
          s.verticalSpeedFpm < -800 ? "Going down fast. Raise the nose a little." : "Good. Slow and steady.",
      },
      { title: "Almost there.", target: "Final", sub: feet, feedback: "Only small moves now." },
      {
        title: "Fly over the start of the runway.",
        target: "Runway",
        sub: feet,
        feedback: "Get ready to flare and touch down.",
      },
    ],
    // After the last gate the lesson ends with a landing, not another ring.
    touchdown: {
      title: "Land the plane.",
      target: "Touch down",
      sub: "Slow and straight",
      feedback: (s) => (s.onGround ? "Stay in the middle and pull the power back." : "Nice and steady."),
    },
    passed: [
      "You climbed away from the airport.",
      "Cruising toward Meadow Airport.",
      "You found the runway. Getting ready early gives you time.",
      "Lined up. Everything is coming together.",
      "Nice slow descent. Watch your speed.",
      "Almost there. Small moves only.",
      "Over the runway. Now a gentle touchdown.",
    ],
    reflection(i) {
      if (i === 3)
        return {
          title: "You're lining up to land.",
          copy: "What should be ready before you land?",
          options: [
            [
              "Lined up, the right speed, wings level and going down slowly",
              true,
              "Yes! Pilots call this a stable approach: everything ready early.",
            ],
            ["Only your height", false, "Height matters, but so do speed, wings and lining up."],
            ["Only the power", false, "Power is just one piece."],
          ],
        };
      if (i === 5)
        return {
          title: "You're almost at the runway.",
          copy: "Why should you avoid big moves right now?",
          options: [
            [
              "A big move this close to the ground can throw everything off",
              true,
              "Yes! Close to the ground there's no room to fix a big mistake.",
            ],
            ["The runway might turn", false, "Runways never move."],
            ["The plane stops listening", false, "The plane still responds. It's just risky."],
          ],
        };
      return null;
    },
    repeatedMiss: {
      title: "Landing takes practice.",
      copy: "What will help with the next ring?",
      options: [
        [
          "Fix your line, speed or height earlier with a small move",
          true,
          "Yes! Fix little problems before they grow.",
        ],
        ["Wait, then make a big move", false, "Big late moves are hard near the ground."],
        ["Don't worry about speed", false, "Speed matters a lot when you land."],
      ],
    },
  },
};

export const TAKEOFF_STEP = {
  title: "Take off from the runway.",
  target: "Take off",
  sub: "Full power, then nose up",
  feedback: "Push the Power lever up. When you're fast, pull back gently.",
};

// Fills in the step fields that depend on the flight.
export function resolveStep(step, state, gate) {
  const value = (field) => (typeof field === "function" ? field(state, gate) : field);
  return {
    title: value(step.title),
    target: value(step.target),
    sub: value(step.sub),
    feedback: value(step.feedback),
  };
}

export function missFeedback(miss, lessonKey) {
  const failed = miss.criteriaFailed || [];
  if (failed.includes("bank")) return "Wings were tipped too much. Level them before the next ring.";
  if (failed.includes("verticalSpeed"))
    return "You were going up or down too fast. Steady the nose before the next ring.";
  if (failed.includes("slow")) return "Too slow. Add power before the next ring.";
  if (failed.includes("fast")) return "Too fast. Take off some power before the next ring.";
  if (miss.wasHigh) return "You flew over the ring. Lower the nose a little sooner.";
  if (miss.wasLow) return "You flew under the ring. Raise the nose a little sooner.";
  if (lessonKey === "roll") return "You passed beside the ring. Start your turn a little sooner.";
  return "You missed the ring. Try a smaller, earlier move.";
}

// stop and teach questions (main.js checkSafety decides when to ask)
export const SAFETY_CHECKS = {
  dive: {
    title: "Whoa! You're heading down fast.",
    copy: "What happens if a plane keeps diving like this?",
    options: [
      [
        "It gets close to the ground very quickly",
        true,
        "Right. A steep dive loses lots of height fast, and the plane speeds up too.",
      ],
      [
        "It slows down and stops in the air",
        false,
        "Not quite. Pointing down makes a plane go faster, like rolling down a hill.",
      ],
      [
        "Nothing. It will fix itself",
        false,
        "Planes go where the nose points, so a dive keeps going until you fix it.",
      ],
    ],
    fix: "Fix it: ease the nose up a little. A small, smooth pull is better than a big yank.",
  },
  climb: {
    title: "Your nose is very high and you're slowing down.",
    copy: "What can happen if you keep climbing this steeply?",
    options: [
      [
        "The wings can stall and stop lifting",
        true,
        "Right. Wings need fast air to make lift. Too slow with the nose too high, and they stall.",
      ],
      [
        "The plane keeps climbing forever",
        false,
        "Not quite. Climbing uses up speed, like biking up a steep hill.",
      ],
      ["The engine gets stronger", false, "The engine stays the same. Your speed keeps dropping."],
    ],
    fix: "Fix it: lower the nose a little so the plane can speed back up.",
  },
  bank: {
    title: "Your wings are tipped a lot.",
    copy: "What happens when the wings tip this far?",
    options: [
      [
        "The plane turns hard and starts to sink",
        true,
        "Right. Tipped wings point some of their lift sideways, so less holds you up.",
      ],
      ["The plane flies straight", false, "Not quite. Tipped wings always make a plane turn."],
      ["The plane flies higher", false, "It's the other way: a steep turn makes a plane sink."],
    ],
    fix: "Fix it: tilt the yoke back toward level until the wings are flat.",
  },
  slow: {
    title: "You're flying really slowly.",
    copy: "Why is flying too slowly a problem?",
    options: [
      [
        "The wings need speed to make enough lift",
        true,
        "Right. Less speed means less air over the wings, and less lift.",
      ],
      [
        "Slow is always safer in the air",
        false,
        "On the ground, yes. In the air, the wings need speed to hold you up.",
      ],
      ["The gauges stop working", false, "The gauges work fine. They're warning you."],
    ],
    fix: "Fix it: push the Power lever up and lower the nose a little to build speed.",
  },
};

// quiz questions - first answer is always the right one, they get shuffled later

export const quizBanks = {
  pitch: [
    {
      q: "What does pulling the yoke back do?",
      a: ["Raises the nose", "Tips the wings", "Adds power"],
      explanation: "Pulling back points the nose up, so the plane climbs.",
    },
    {
      q: "What can happen if you climb too steeply and get too slow?",
      a: ["The wings can stall", "The runway gets longer", "The plane flies faster"],
      explanation: "Wings need fast air to make lift. Too slow with the nose high, and they stall.",
    },
    {
      q: "Your speed keeps dropping while you climb. What should you do?",
      a: ["Lower the nose a little", "Pull the nose up more", "Tip the wings a lot"],
      explanation: "A gentler climb lets the plane speed back up, like a smaller hill on a bike.",
    },
    {
      q: "What does the climb rate gauge show?",
      a: ["How fast you're going up or down", "Which way you're pointed", "How much fuel you have"],
      explanation: "It shows feet per minute. Above zero means going up. Below zero means going down.",
    },
    {
      q: "Why start leveling off a little before the height you want?",
      a: [
        "The plane keeps moving while you change it",
        "The altitude gauge stops working",
        "The runway moves",
      ],
      explanation: "Like a bike coasting after you stop pedaling, a plane keeps climbing for a moment.",
    },
    {
      q: "What does +300 feet per minute mean?",
      a: ["You're going up", "You're going down", "You're turning right"],
      explanation: "A plus number means your height is going up. A minus number means it's going down.",
    },
    {
      q: "What's the best way to fix your height?",
      a: ["One small move, then watch", "Move every control at once", "Wait until it's way off"],
      explanation: "Small moves are easy to control. Watch what the plane does, then decide.",
    },
    {
      q: "What is lift?",
      a: ["The upward push the wings make", "The engine's sound", "The wheels pushing on the ground"],
      explanation: "Air flowing over the curved wing pushes it up. That push is lift.",
    },
  ],

  roll: [
    {
      q: "What is bank?",
      a: ["How far the wings are tipped", "How high the plane is", "How fast the propeller spins"],
      explanation: "Bank is the tip of the wings. Level wings are 0 degrees of bank.",
    },
    {
      q: "Why does tipping the wings make the plane turn?",
      a: ["Some of the lift pulls sideways", "The wheels steer in the air", "The engine points left"],
      explanation: "The wings' lift tips with them. The sideways part pulls the plane around the turn.",
    },
    {
      q: "Why can a plane sink in a steep turn?",
      a: ["Less of the lift points up", "The engine loses power", "The air gets heavier"],
      explanation: "When lift points partly sideways, less of it is left to hold the plane up.",
    },
    {
      q: "When should you start leveling the wings to stop a turn?",
      a: ["A little before you're pointed the right way", "Way after you pass it", "Only after landing"],
      explanation: "The plane keeps turning until the wings are level, so start a little early.",
    },
    {
      q: "How do you turn the plane to the right?",
      a: ["Tilt the yoke right", "Pull the yoke back", "Add power"],
      explanation: "Tilting right tips the right wing down, and the plane turns right.",
    },
    {
      q: "A turn keeps getting steeper. What should you do?",
      a: ["Tilt back toward level", "Tip the wings more", "Pull back hard"],
      explanation: "Make the turn gentler first. Then make your next fix.",
    },
    {
      q: "Besides direction, what should you check in a turn?",
      a: ["Your height and speed", "Only the next ring", "Nothing else"],
      explanation: "A turn can change your height and speed too, so keep checking the gauges.",
    },
    {
      q: "What happens if you hold the wings tipped to the right?",
      a: ["The plane keeps turning right", "It flies straight", "The engine stops"],
      explanation: "As long as the wings are tipped, the plane keeps turning. Level them to stop.",
    },
  ],

  level: [
    {
      q: "What does the Power lever mostly change?",
      a: ["How fast you go", "The color of the wings", "Which way the runway points"],
      explanation: "More power pushes the plane faster through the air.",
    },
    {
      q: "What does zero on the climb rate gauge mean?",
      a: ["Your height is steady", "The plane has stopped", "The engine is off"],
      explanation: "Zero only means you're not going up or down. You're still flying forward.",
    },
    {
      q: "What is a pilot's scan?",
      a: ["Looking from gauge to gauge to window, over and over", "A photo of the plane", "A kind of runway"],
      explanation: "One number can look fine while another drifts. Scanning catches it early.",
    },
    {
      q: "What is airspeed measured in?",
      a: ["Knots", "Feet", "Degrees"],
      explanation: "A knot is about 1.15 miles per hour. Pilots and sailors both use knots.",
    },
    {
      q: "Why wait a moment after you make a fix?",
      a: ["The plane needs time to respond", "The gauges are just decoration", "The runway moves"],
      explanation: "Planes respond over a few seconds. Wait, look again, then decide.",
    },
    {
      q: "What does a heading of 090 mean?",
      a: ["You're pointed east", "You're climbing", "You're pointed south"],
      explanation: "Heading is like a compass: north is 000, east is 090, south is 180 and west is 270.",
    },
    {
      q: "What does steady, level flight look like on the gauges?",
      a: ["Climb rate near zero and wings level", "Wings tipped a lot", "A big climb rate"],
      explanation: "Steady means your height isn't changing and the wings are flat.",
    },
    {
      q: "Why look outside as well as at the gauges?",
      a: [
        "To spot the ground, the runway and other planes",
        "The gauges never help",
        "It changes the controls",
      ],
      explanation: "Gauges give you numbers. Looking outside shows you what's around you.",
    },
  ],

  landing: [
    {
      q: "What is the approach?",
      a: [
        "The part where you line up and get ready to land",
        "The first turn after takeoff",
        "Driving to the hangar",
      ],
      explanation: "On the approach you line up with the runway and slow down so the landing is easy.",
    },
    {
      q: "Why get ready to land early?",
      a: ["So you don't need big moves near the ground", "It makes the runway wider", "It turns off gravity"],
      explanation: "Close to the ground there's no room for big mistakes, so get ready early.",
    },
    {
      q: "What is the flare?",
      a: ["Raising the nose a little just before touchdown", "Flashing the lights", "Turning off the engine"],
      explanation: "The flare slows how fast you sink, so the wheels touch down softly.",
    },
    {
      q: "You're too fast as you get close to the runway. What helps?",
      a: ["Take off some power early", "Point the nose straight down", "Make a sharp turn"],
      explanation: "Too fast and the plane floats past the runway. Slow down early.",
    },
    {
      q: "What happens if you go down too fast right before the runway?",
      a: ["A hard bump on landing", "A softer landing", "The plane floats up"],
      explanation: "Sinking fast means hitting the runway hard. Slow and steady is better.",
    },
    {
      q: "What should you do after the wheels touch down?",
      a: ["Pull the power back and stay in the middle", "Climb again right away", "Make a sharp turn"],
      explanation: "The plane is still rolling fast. Keep it straight while it slows down.",
    },
    {
      q: "What can a pilot do if a landing doesn't look right?",
      a: ["Go around: add power, climb and try again", "Dive at the runway", "Turn off the engine"],
      explanation: "A go-around is smart, not a failure. Real pilots do it whenever a landing isn't stable.",
    },
    {
      q: "Why keep the wings level when you land?",
      a: ["So both wheels touch the runway together", "To turn faster", "To make the runway longer"],
      explanation: "Level wings let the plane settle evenly onto both main wheels.",
    },
  ],
};

for (const [lesson, questions] of Object.entries(quizBanks)) {
  questions.forEach((question, i) => {
    question.correct = 0;
    question.id = `${lesson}:${i}`;
  });
}

// no repeats until you have seen every question in the lesson
const seenByLesson = new Map();

export function pickQuestions(pool, count, key) {
  let seen = seenByLesson.get(key) || new Set();
  const picked = [];
  while (picked.length < Math.min(count, pool.length)) {
    let choices = pool.filter((q) => !seen.has(q.id) && !picked.includes(q));
    if (!choices.length) {
      seen = new Set();
      choices = pool.filter((q) => !picked.includes(q));
    }
    const question = choices[Math.floor(Math.random() * choices.length)];
    picked.push(question);
    seen.add(question.id);
  }
  seenByLesson.set(key, seen);
  return picked;
}

// free flight facts (ideas from FAA student material)

export const FACTS = {
  balloon: {
    title: "Hot-air balloon",
    text: "Hot air is lighter than cool air, so the balloon floats up. Balloons can't steer well, so airplanes always give them lots of room.",
  },
  wind: {
    title: "Wind farm",
    text: "Spinning blades show the wind is blowing. Pilots take off and land facing into the wind, because it helps the wings lift sooner.",
  },
  town: {
    title: "Water tower",
    text: "Pilots find their way by matching towns, roads and lakes to a map. It's called pilotage, and a water tower is easy to spot.",
  },
  lake: {
    title: "Pond",
    text: "Lakes and ponds have shapes you can match on a map, so pilots use them as checkpoints along the way.",
  },
  farm: {
    title: "Farm",
    text: "Some pilots fly crop-dusters low over fields to spread seeds or plant food. They have to watch closely for trees and power lines.",
  },
  mountain: {
    title: "Mountain",
    text: "The air gets thinner the higher you go, so planes climb more slowly up there. Pilots plan to fly well above mountains.",
  },
  airport: {
    title: "Airport",
    text: "Runway numbers are compass directions without the last zero. Runway 36 points north (360 degrees). The other end is 18 (south).",
  },
};

export function factFor(type) {
  return FACTS[type] || FACTS.town;
}
