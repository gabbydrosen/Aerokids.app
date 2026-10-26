## AeroKids

AeroKids is a flight simulator designed to teach kids about aviation and how airplanes fly. The goal is to make aerospace education more accessible through an interactive learning experience.

The simulator can be controlled using a keyboard, on-screen controls, or a phone camera. The camera option lets users hold an object like a book or plate in front of their phone and use it as a steering wheel.

# Features

Flight School - Four lessons covering pitch, rolling and turning, straight and level flight, and takeoff and landing. Each lesson includes picture cards, flying challenges, and a short quiz.

Stop and Teach - The simulator pauses when the user makes certain mistakes, like diving too quickly, climbing too steeply, banking too far, or flying too slowly. It then asks them to predict what will happen.

Free Flight - Users can explore the environment and discover landmarks with aviation facts.

Careers - Information about different aviation careers and women who made important contributions to aviation and space exploration.

Flight Opportunities - Information about programs that offer kids the chance to experience flying in real life.

# Running the Simulator

The simulator needs a local web server to load the 3D models.

Run python3 start_server.py and open http://127.0.0.1:8000, or use the Live Server extension in VS Code.

The camera controls require HTTPS or localhost.

# Controls

On a phone (turn it sideways):

- Hold an object with both hands like a steering wheel so the front camera can see it
- Tilt it left / right - Roll left / right
- Pull it toward you - Nose up
- Push it away - Nose down
- Power lever on the screen - Drag up for more throttle

On a computer:

- W / S - Pitch up / down
- A / D - Roll left / right
- Q / E - Rudder
- Up / Down arrows - Increase / decrease throttle
- C - Change camera view
- M - Toggle sound

# Files

- index.html - Main interface
- style.css - Styling
- js/main.js - Menus, lessons, free flight, and flight interface
- js/content.js - Lesson content, questions, and facts
- js/sim.js - Flight physics and 3D simulation
- js/world.js - Environment
- js/handyoke.js - Camera controls
- js/input.js - Keyboard and throttle controls
- js/drawings.js, js/sound.js, js/textures.js - Graphics, audio, and textures

The lessons are based on concepts from the FAA's Airplane Flying Handbook and Pilot's Handbook of Aeronautical Knowledge. The physics is simplified for educational purposes and is not intended for actual flight training.

# Credits

Airplane - "Plane" by osmosikum on Sketchfab, CC BY 4.0. Textures resized to 512 px.
https://sketchfab.com/3d-models/plane-cedc8a07370747f7b0d14400cdf2faf9

Mountain - "Low Poly Mountain Free" by Poly Craftsman on Sketchfab, CC BY 4.0.
https://sketchfab.com/3d-models/low-poly-mountain-free-dabda46f9be2416c93a4b584be17786b

Cars, pine trees, and houses - Kenney Car Kit, Nature Kit, and City Kit (Suburban), CC0.
https://kenney.nl

Clouds, coins, trucks, shops, garage, fountain, shadow sprite, and sounds - Kenney Starter Kits, CC0 assets and MIT kit code.
https://github.com/KenneyNL

Round tree - Kenney Mini Arena, additional credit to Tony Schär, CC0.

Baloo 2 font - Ek Type, SIL Open Font License 1.1.

Atkinson Hyperlegible font - Braille Institute, SIL Open Font License 1.1.

Three.js 0.180.0 - MIT License.

MediaPipe Tasks Vision 0.10.21 and Hand Landmarker - Google, Apache 2.0.

Full license information is included in the licenses folder. Some textures and sounds were resized or converted for use in the simulator. Other parts of the environment, including the farm, roads, balloon, wind turbine, water tower, hangar, tower, and lesson diagrams, are directly in the code.
