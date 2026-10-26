# AeroKids

A flight simulator that teaches kids how airplanes fly. You can fly with the screen, the keyboard, or by holding any object (a book, a plate) like a steering wheel in front of your phone's camera.

Made for the Congressional App Challenge.

## What you can do

- **Flight school** - 4 lessons: pitch, rolling and turning, straight and level, and takeoff and landing. Each one has picture cards, rings to fly through and a short quiz.
- **Stop and teach** - if you dive too fast, climb too steep, tip the wings too far or go too slow, the game pauses and asks what will happen next.
- **Free flight** - fly anywhere and find landmarks. Each one has a fact about flying.
- **Careers** - jobs in aviation and some of the women who were first in flight and space.
- **Fly for real** - programs that give kids a real first flight.

No accounts and nothing about you gets saved or sent anywhere. The camera video stays on the phone.

## Running it

It needs a local web server (opening index.html directly won't load the 3D models). Either:

- run `python3 start_server.py` and go to http://127.0.0.1:8000, or
- use the Live Server extension in VS Code.

The camera only works on https or 127.0.0.1. PHONE-SETUP.md explains how to try it on a phone, and HOW-IT-WORKS.md explains the code.

## Controls

| Key | Does |
| --- | --- |
| W / S | nose up / down |
| A / D | roll left / right |
| Q / E | rudder (steer on the ground) |
| Up / Down | more / less power |
| C | switch camera view |
| M | sound on/off |

## Files

- `index.html` - all the screens
- `style.css` - how it looks
- `js/main.js` - menus, lessons, free flight and the stuff on screen while flying
- `js/content.js` - all the lesson text, questions and facts
- `js/sim.js` - flight physics and the 3D view
- `js/world.js` - the countryside
- `js/handyoke.js` - camera yoke
- `js/input.js` - keyboard and power lever
- `js/drawings.js`, `js/sound.js`, `js/textures.js` - pictures, sounds and textures

The lessons are based on ideas from the FAA's *Airplane Flying Handbook* and *Pilot's Handbook of Aeronautical Knowledge*. The physics is simplified, so this is for learning the ideas, not real pilot training.

## Credits

| What | Source | License |
| --- | --- | --- |
| Airplane (`models/plane.glb`) | "Plane" by osmosikum, [Sketchfab](https://sketchfab.com/3d-models/plane-cedc8a07370747f7b0d14400cdf2faf9). Changes: textures resized to 512 px. | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Mountain (`models/mountain.glb`) | "Low Poly Mountain Free" by Poly Craftsman, [Sketchfab](https://sketchfab.com/3d-models/low-poly-mountain-free-dabda46f9be2416c93a4b584be17786b) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Car, pine tree, houses | Kenney Car Kit, Nature Kit, City Kit (Suburban), [kenney.nl](https://kenney.nl) | CC0 |
| Clouds, coins, trucks, shops, garage, fountain, shadow sprite, sounds | Kenney Starter Kits (3D Platformer, Racing, City Builder), [github.com/KenneyNL](https://github.com/KenneyNL). Their READMEs list the models, sprites and sounds as CC0; the kit code is MIT. | CC0 assets, MIT kits |
| Round tree | Kenney Mini Arena (additional credit: Tony Schär), from Kenney's Basic Scene starter kit | CC0 |
| Baloo 2 font | Ek Type, via Google Fonts | SIL Open Font License 1.1 |
| Atkinson Hyperlegible font | Braille Institute, via Google Fonts | SIL Open Font License 1.1 |
| Three.js 0.180.0 | `vendor/three/` | MIT (`vendor/three/LICENSE`) |
| MediaPipe Tasks Vision 0.10.21 and the Hand Landmarker model | `vendor/mediapipe/`, from Google ([npm](https://www.npmjs.com/package/@mediapipe/tasks-vision), [model](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)) | Apache 2.0 (`licenses/mediapipe-Apache-2.0.txt`) |

License texts are in `licenses/`. Kenney textures are embedded in each `.glb`, and Kenney sounds were converted to MP3. Grass, crop-row, asphalt and road textures, the farm, balloon, wind turbine, water tower, hangar and tower models, and the flashcard diagrams are drawn in code for this project.
