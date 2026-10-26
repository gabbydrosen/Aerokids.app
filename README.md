# AeroKids 

AeroKids is a flight simulator I made to help kids learn about aviation in a fun, hands-on way. The goal is to make learning about flying more accessible, especially for students who might not otherwise get the chance to explore aerospace.

You can fly using your keyboard, on-screen controls, or even your phone's camera. For the camera option, you can hold something like a book or plate in front of your phone and use it like a steering wheel.

### What's included

- **Flight School:** Four lessons covering pitch, rolling and turning, straight and level flight, and takeoff and landing. Each lesson has pictures, flying challenges, and a short quiz.
- **Learning while flying:** If you fly too fast, climb too steeply, bank too far, or get close to stalling, the simulator pauses and asks you what might happen next.
- **Free Flight:** Explore the world, practice flying, and discover landmarks with aviation facts.
- **Aviation Careers:** Learn about different careers in aviation and women who helped shape the history of flight and space exploration.
- **Real Flight Opportunities:** Find programs that help kids experience flying in real life.

### Running the simulator

The simulator needs a local web server to load the 3D models properly.

You can either run `python3 start_server.py` and open `http://127.0.0.1:8000`, or use the Live Server extension in VS Code.

The camera feature needs HTTPS or localhost to work.

There are also two guides included:
- `PHONE-SETUP.md` explains how to test it on a phone.
- `HOW-IT-WORKS.md` explains how the code works.

### Controls

| Key | Action |
|---|---|
| W / S | Pitch up / down |
| A / D | Roll left / right |
| Q / E | Rudder |
| Up / Down arrows | Increase / decrease throttle |
| C | Change camera view |
| M | Toggle sound |

### How it's built

The simulator uses HTML, CSS, JavaScript, and Three.js for the 3D environment. I also used MediaPipe for the camera-based controls.

Most of the code is organized into separate files for the flight physics, scenery, lessons, controls, and interface.

The flying mechanics are simplified to make them easier for kids to understand. The lessons are based on concepts from the FAA's *Airplane Flying Handbook* and *Pilot's Handbook of Aeronautical Knowledge*, but the simulator isn't intended for actual pilot training.

### Credits

Some of the 3D models, sounds, and other assets come from open-source or Creative Commons resources.

- Airplane model: ["Plane" by osmosikum](https://sketchfab.com/3d-models/plane-cedc8a07370747f7b0d14400cdf2faf9), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Textures resized to 512 px.
- Mountain model: ["Low Poly Mountain Free" by Poly Craftsman](https://sketchfab.com/3d-models/low-poly-mountain-free-dabda46f9be2416c93a4b584be17786b), licensed under CC BY 4.0.
- Cars, trees, houses, clouds, sounds, and other assets: [Kenney](https://kenney.nl) and [Kenney Starter Kits](https://github.com/KenneyNL), primarily CC0 assets. Starter kit code is MIT licensed.
- Round tree: Kenney Mini Arena, with additional credit to Tony Schär, CC0.
- Baloo 2 font: Ek Type, SIL Open Font License 1.1.
- Atkinson Hyperlegible font: Braille Institute, SIL Open Font License 1.1.
- Three.js 0.180.0: MIT License.
- MediaPipe Tasks Vision 0.10.21 and Hand Landmarker: Google, Apache 2.0.

The full license texts are included in the `licenses/` folder. Some of the textures and sounds have been resized or converted for use in the simulator.

Other parts of the environment, including the farm, roads, runway-related scenery, and lesson diagrams, are generated directly in the code.

### What's next

I'm still working on improving the simulator, especially the controls, flight physics, and educational features. Eventually, I want to combine it with low-cost physical flight controls so students can have a more hands-on experience without needing expensive equipment.
