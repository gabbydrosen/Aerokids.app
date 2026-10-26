# AeroKids

AeroKids is a flight simulator designed to teach kids about aviation and how airplanes fly. The goal is to make aerospace education more accessible through an interactive learning experience.

The simulator can be controlled using a keyboard, on-screen controls, or a phone camera. The camera option lets users hold an object like a book or plate in front of their phone and use it as a steering wheel.

## Features

- Flight school: Four lessons covering pitch, rolling and turning, straight and level flight, and takeoff and landing. Each lesson includes picture cards, flying challenges, and a quiz.
- Stop and teach: The simulator pauses when the user makes certain mistakes, like diving too quickly or climbing too steeply, and asks them to predict what will happen.
- Free flight: Users can explore the environment and discover landmarks with aviation facts.
- Careers: Information about aviation careers and women who made important contributions to aviation and space exploration.
- Flight opportunities: Information about programs that offer kids the chance to experience flying in real life.

## Running the simulator

The simulator needs a local web server to load the 3D models.

Run `python3 start_server.py` and open `http://127.0.0.1:8000`, or use the Live Server extension in VS Code.

The camera controls require HTTPS or localhost.

Additional documentation is available in `PHONE-SETUP.md` and `HOW-IT-WORKS.md`.

## Controls

| Key | Action |
|---|---|
| W / S | Pitch up / down |
| A / D | Roll left / right |
| Q / E | Rudder |
| Up / Down | Throttle |
| C | Change camera |
| M | Toggle sound |

## Code

- `index.html` - main interface
- `style.css` - styling
- `js/main.js` - menus, lessons, and free flight
- `js/content.js` - lesson content and questions
- `js/sim.js` - flight physics and 3D simulation
- `js/world.js` - environment
- `js/handyoke.js` - camera controls
- `js/input.js` - keyboard and throttle controls
- `js/drawings.js`, `js/sound.js`, `js/textures.js` - graphics, audio, and textures

The lessons are based on concepts from the FAA's *Airplane Flying Handbook* and *Pilot's Handbook of Aeronautical Knowledge*. The physics is simplified for educational purposes and is not intended for actual flight training.

## Credits

- Airplane: ["Plane" by osmosikum](https://sketchfab.com/3d-models/plane-cedc8a07370747f7b0d14400cdf2faf9), CC BY 4.0. Textures resized to 512 px.
- Mountain: ["Low Poly Mountain Free" by Poly Craftsman](https://sketchfab.com/3d-models/low-poly-mountain-free-dabda46f9be2416c93a4b584be17786b), CC BY 4.0.
- Cars, trees, houses, and other assets: [Kenney](https://kenney.nl), CC0.
- Additional models, sprites, and sounds: [Kenney Starter Kits](https://github.com/KenneyNL), CC0 assets and MIT code.
- Round tree: Kenney Mini Arena, additional credit to Tony Schär, CC0.
- Baloo 2: Ek Type, SIL Open Font License 1.1.
- Atkinson Hyperlegible: Braille Institute, SIL Open Font License 1.1.
- Three.js 0.180.0: MIT.
- MediaPipe Tasks Vision 0.10.21 and Hand Landmarker: Google, Apache 2.0.

Full license information is included in the `licenses/` folder. Some models and textures were modified or converted for use in the simulator. Other environment elements and lesson diagrams are generated in code.
