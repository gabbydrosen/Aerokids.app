import * as THREE from "three";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";

import { Landscape } from "./world.js";
import { asphaltTexture, blobShadowTexture } from "./textures.js";

// Sky, fog and the far horizon share one color so distant land fades smoothly.
const HORIZON = 0xcfe5f5;
const SKY_TOP = 0x3d8ddb;
const SUN_DIRECTION = new THREE.Vector3(-1100, 1500, 700).normalize();

const RUNWAY_HALF_WIDTH = 46;
const RUNWAY_HALF_LENGTH = 850;
const GROUND_Y = 0;
const GEAR_Y = 1.05;
const VISUAL_RUNWAY_Y = 0.32;
const TRAINING_RUNWAY = { x: 520, z: -3400, halfWidth: 48, halfLength: 700 };

export class FlightSim {
  constructor(canvas, onProgress = () => {}) {
    this.onProgress = onProgress;
    this.frameDt = 1 / 60;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(HORIZON);
    this.scene.fog = new THREE.Fog(HORIZON, 1500, 3300);

    // near/far close together to stop flicker
    this.camera = new THREE.PerspectiveCamera(61, 1, 1.2, 6000);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;

    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.envTextures = {};
    this.obstacles = [];
    this.mountains = [];
    this.missionGates = [];
    this.currentGateIndex = 0;
    this.gateGroup = new THREE.Group();
    this.scene.add(this.gateGroup);
    this.paused = true;
    this.cameraMode = "chase";
    this.attract = true;

    this._buildWorld();
    const sceneryReady = this._loadWorldAssets();
    this._buildAircraft();
    this.reset();
    this.resize();
    this.ready = Promise.all([sceneryReady, this.aircraftReady]).then(async () => {
      this.landscape = new Landscape(this, this.sceneryModels);
      await this.landscape.prepare(this.state.x, this.state.z, (n, total) =>
        this.onProgress(`Building the countryside (${n} of ${total})`, 0.55 + (0.4 * n) / total),
      );
      this.onProgress("Warming up the graphics…", 0.97);
      if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
      else this.renderer.compile(this.scene, this.camera);
      this.render();
    });
    window.addEventListener("resize", () => this.resize());
  }

  reset() {
    this.state = {
      x: 0,
      y: GEAR_Y,
      z: 690,
      heading: 0,
      pitch: 0,
      roll: 0,
      yawSlip: 0,
      speedKts: 0,
      altitudeFt: 0,
      verticalSpeedFpm: 0,
      throttle: 0,
      pitchDeg: 0,
      rollDeg: 0,
      onGround: true,
      crashed: false,
      failureReason: "",
      justTookOff: false,
      justLanded: false,
      justPassedGate: null,
      justMissedGate: null,
      gateIndex: 0,
      gateCount: this.missionGates.length,
      runwayId: "home",
    };

    if (this.aircraft) this._updateTransforms(true);
  }

  _buildWorld() {
    this.scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x6f8a4a, 2.0));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
    sun.position.copy(SUN_DIRECTION).multiplyScalar(2000);
    this.scene.add(sun);
    this._addSky();
    this._addShadow();
    this._addAirport();
    this._addTrainingAirport();
    this._addHangar(230, 150, 85, 55, 14, 0xe4572e);
    this._addHangar(320, 70, 80, 60, 15, 0x2a7fd4);
    this._addTower(365, -55);
  }

  _addAirport() {
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(RUNWAY_HALF_WIDTH * 2, RUNWAY_HALF_LENGTH * 2),
      this._runwayMaterial(0x3a3f42, RUNWAY_HALF_WIDTH * 2, RUNWAY_HALF_LENGTH * 2),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.y = 0.22;
    this.scene.add(runway);

    const stripeMat = new THREE.MeshBasicMaterial({
      color: 0xf5f1df,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    });

    for (let z = -740; z <= 740; z += 92) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 38), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.27, z);
      this.scene.add(stripe);
    }

    for (const x of [-43, 43]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1660), stripeMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.27, 0);
      this.scene.add(line);
    }

    for (const end of [-805, 805]) {
      for (let x = -30; x <= 30; x += 10) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 27), stripeMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(x, 0.28, end);
        this.scene.add(bar);
      }
    }

    const taxiMat = new THREE.MeshStandardMaterial({
      color: 0x4c5051,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });

    const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(38, 720), taxiMat);
    taxiway.rotation.x = -Math.PI / 2;
    taxiway.position.set(118, 0.18, -210);
    this.scene.add(taxiway);

    const connector = new THREE.Mesh(new THREE.PlaneGeometry(150, 34), taxiMat);
    connector.rotation.x = -Math.PI / 2;
    connector.position.set(69, 0.19, -210);
    this.scene.add(connector);

    const apron = new THREE.Mesh(new THREE.PlaneGeometry(250, 260), taxiMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(235, 0.17, 15);
    this.scene.add(apron);

    const lights = [];
    for (let z = -790; z <= 790; z += 72) for (const x of [-52, 52]) lights.push([x, z]);
    this._addRunwayLights(lights);

    this._addRunwayLabel("18", 0, 700, Math.PI);
    this._addRunwayLabel("36", 0, -700, 0);
    this._addWindsock(92, 280);
  }

  _addTrainingAirport() {
    const cx = TRAINING_RUNWAY.x;
    const cz = TRAINING_RUNWAY.z;
    const w = TRAINING_RUNWAY.halfWidth;
    const l = TRAINING_RUNWAY.halfLength;

    const runwayMat = this._runwayMaterial(0x40464a, w * 2, l * 2);
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, l * 2), runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(cx, 0.22, cz);
    this.scene.add(runway);

    const stripeMat = new THREE.MeshBasicMaterial({
      color: 0xf6f1dd,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    });
    for (let z = cz - l + 75; z <= cz + l - 75; z += 92) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 34), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(cx, 0.28, z);
      this.scene.add(stripe);
    }
    for (const x of [cx - w + 3, cx + w - 3]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(1.2, l * 2 - 20), stripeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.28, cz);
      this.scene.add(edge);
    }
    for (const end of [cz - l + 32, cz + l - 32]) {
      for (let x = cx - 30; x <= cx + 30; x += 10) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 24), stripeMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(x, 0.29, end);
        this.scene.add(bar);
      }
    }

    const lights = [];
    for (let z = cz - l + 40; z <= cz + l - 40; z += 70)
      for (const x of [cx - w - 8, cx + w + 8]) lights.push([x, z]);
    this._addRunwayLights(lights);

    const taxiMat = new THREE.MeshStandardMaterial({
      color: 0x505456,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(220, 170), taxiMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(cx + 175, 0.18, cz + 45);
    this.scene.add(apron);
    const connector = new THREE.Mesh(new THREE.PlaneGeometry(170, 32), taxiMat);
    connector.rotation.x = -Math.PI / 2;
    connector.position.set(cx + 82, 0.19, cz + 45);
    this.scene.add(connector);

    this._addRunwayLabel("18", cx, cz + l - 135, Math.PI);
    this._addRunwayLabel("36", cx, cz - l + 135, 0);
    this._addWindsock(cx + 105, cz + 260);

    // A few buildings make the second field easy to recognize from the air.
    this._addHangar(cx + 205, cz + 95, 78, 48, 14, 0x2a9d8f);
    this._addHangar(cx + 205, cz + 10, 92, 52, 15, 0xf2a541);
    this._addTower(cx + 285, cz + 65);
  }

  _runwayMaterial(color, width, length) {
    this.asphalt ||= asphaltTexture();
    let map = null;
    if (this.asphalt) {
      map = this.asphalt.clone();
      map.needsUpdate = true;
      map.repeat.set(width / 24, length / 24);
    }
    return new THREE.MeshLambertMaterial({
      color,
      map,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    });
  }

  // Small edge lights, drawn together as one instanced mesh per runway.
  _addRunwayLights(points) {
    this.runwayLightGeometry ||= new THREE.CylinderGeometry(0.55, 0.7, 1.1, 6).translate(0, 0.55, 0);
    this.runwayLightMaterial ||= new THREE.MeshBasicMaterial({ color: 0xfff1b8 });
    const mesh = new THREE.InstancedMesh(this.runwayLightGeometry, this.runwayLightMaterial, points.length);
    const m = new THREE.Matrix4();
    points.forEach(([x, z], i) => {
      m.makeTranslation(x, 0.2, z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.scene.add(mesh);
  }

  // Hangar with a curved roof and a big colored door facing the runway (west).
  _addHangar(x, z, w, d, wallHeight, doorColor) {
    const body = new THREE.MeshLambertMaterial({ color: 0xece7dc });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x8e9aa3 });
    const door = new THREE.MeshLambertMaterial({ color: doorColor });
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallHeight, d), body);
    walls.position.set(x, wallHeight / 2, z);
    const roofRise = d * 0.28;
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(d / 2, d / 2, w + 1, 16, 1, false, 0, Math.PI)
        .rotateZ(Math.PI / 2)
        .scale(1, roofRise / (d / 2), 1),
      roofMat,
    );
    roof.position.set(x, wallHeight, z);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.8, wallHeight * 0.82, d * 0.7), door);
    front.position.set(x - w / 2 - 0.3, wallHeight * 0.41, z);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, d + 0.2), door);
    stripe.position.set(x - w / 2 - 0.2, wallHeight - 1.2, z);
    this.scene.add(walls, roof, front, stripe);
    this.obstacles.push({
      minX: x - w / 2 - 3,
      maxX: x + w / 2 + 3,
      minZ: z - d / 2 - 3,
      maxZ: z + d / 2 + 3,
      height: wallHeight + roofRise + 5,
    });
  }

  _addTower(x, z) {
    const white = new THREE.MeshLambertMaterial({ color: 0xf2efe8 });
    const glass = new THREE.MeshLambertMaterial({
      color: 0x2f6f86,
      emissive: 0x0d2b38,
      emissiveIntensity: 0.6,
    });
    const trim = new THREE.MeshLambertMaterial({ color: 0xe4572e });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6, 42, 10), white);
    column.position.set(x, 21, z);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 7, 3, 10), white);
    deck.position.set(x, 43.5, z);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 8, 10), glass);
    cab.position.set(x, 49, z);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 2, 10), trim);
    roof.position.set(x, 54, z);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 5), white);
    mast.position.set(x, 59, z);
    this.scene.add(column, deck, cab, roof, mast);
    this.obstacles.push({ minX: x - 13, maxX: x + 13, minZ: z - 13, maxZ: z + 13, height: 60 });
  }

  // A gradient sky with a soft sun. It follows the camera and never writes
  // depth, so it cannot clip through scenery or flicker.
  _addSky() {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(SKY_TOP) },
        horizon: { value: new THREE.Color(HORIZON) },
        sunDir: { value: SUN_DIRECTION.clone() },
      },
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(horizon, top, pow(h, 0.5));
          float sun = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.95, 0.82) * pow(sun, 900.0) * 1.4 + vec3(1.0, 0.92, 0.75) * pow(sun, 14.0) * 0.16;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(4600, 32, 16), material);
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  _addShadow() {
    const map = blobShadowTexture();
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      map,
      polygonOffset: true,
      polygonOffsetFactor: -10,
      polygonOffsetUnits: -10,
    });
    if (!map) material.opacity = 0.25;
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), material);
    this.shadow.renderOrder = 1;
    this.scene.add(this.shadow);
    // Kenney's soft blob shadow (CC0) replaces the drawn one once it loads.
    if (typeof document !== "undefined")
      this.textureLoader.load(
        "./textures/blob_shadow.png",
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          material.map = tex;
          material.needsUpdate = true;
          this.shadowFromKenney = true;
        },
        undefined,
        () => {},
      );
  }

  _updateShadow() {
    if (!this.shadow) return;
    const s = this.state,
      heightM = Math.max(0, s.y - GEAR_Y);
    const fade = THREE.MathUtils.clamp(1 - heightM / 140, 0, 1);
    this.shadow.visible = fade > 0.02 && !s.crashed;
    const size = 1 + heightM * 0.006;
    this.shadow.position.set(s.x, 0.38, s.z);
    this.shadow.rotation.y = s.heading;
    this.shadow.scale.set(11 * size, 1, 9 * size);
    this.shadow.material.opacity = (this.shadowFromKenney ? 0.38 : 0.5) * fade;
  }

  _addRunwayLabel(text, x, z, rotationY = 0) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = "#f5f1df";
    ctx.font = "bold 150px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 132);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(32, 46), mat);
    label.rotation.x = -Math.PI / 2;
    label.rotation.z = rotationY;
    label.position.set(x, 0.31, z);
    this.scene.add(label);
  }

  _addWindsock(x, z) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.75 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xf27035, roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf5f3ec, roughness: 0.8 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 18, 8), poleMat);
    pole.position.set(x, 9, z);
    this.scene.add(pole);
    const sock = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6 - i * 0.18, 1.45 - i * 0.18, 4.2, 10, 1, true),
        i % 2 ? white : orange,
      );
      seg.rotation.z = Math.PI / 2;
      seg.position.x = i * 3.8;
      sock.add(seg);
    }
    sock.position.set(x + 2.5, 16.5, z);
    sock.rotation.y = -0.4;
    this.scene.add(sock);
  }

  _loadGLB(path) {
    return this.gltfLoader.loadAsync(path);
  }

  _configureModel(root, { castShadow = true, receiveShadow = true, hideColliders = false } = {}) {
    root.traverse((obj) => {
      if (!obj.isMesh) return;

      if (hideColliders && /collider/i.test(obj.name || "")) {
        obj.visible = false;
        return;
      }

      obj.castShadow = castShadow;
      obj.receiveShadow = receiveShadow;

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!material) continue;
        const maps = [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.metalnessMap,
          material.emissiveMap,
          material.aoMap,
        ];
        for (const map of maps) {
          if (!map) continue;
          map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
          map.needsUpdate = true;
        }
      }
    });
  }

  _placeGroundedAsset(
    source,
    {
      x = 0,
      z = 0,
      scale = 1,
      scaleX = null,
      scaleY = null,
      scaleZ = null,
      rotationY = 0,
      groundY = 0,
      useTopAsGround = false,
      name = "WorldAsset",
    } = {},
  ) {
    const model = source.clone(true);
    model.name = name;
    model.position.set(0, 0, 0);
    model.rotation.set(0, rotationY, 0);
    model.scale.set(scaleX ?? scale, scaleY ?? scale, scaleZ ?? scale);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x += x - center.x;
    model.position.z += z - center.z;
    model.position.y += groundY - (useTopAsGround ? box.max.y : box.min.y);
    model.updateMatrixWorld(true);
    this.scene.add(model);
    return model;
  }

  async _loadWorldAssets() {
    this.sceneryModels = {};
    const files = [
      "tree",
      "tree-round",
      "house",
      "car",
      "truck-red",
      "truck-yellow",
      "truck-green",
      "truck-purple",
      "shop-a",
      "shop-b",
      "shop-c",
      "shop-d",
      "garage",
      "fountain",
      "cloud",
      "coin",
    ];
    let done = 0;
    await Promise.all(
      files.map(async (key) => {
        try {
          const gltf = await this._loadGLB(`./models/scenery/${key}.glb`);
          this._configureModel(gltf.scene, { castShadow: false, receiveShadow: false });
          this.sceneryModels[key] = gltf.scene;
        } catch (error) {
          console.error("could not load", key, error);
        }
        done++;
        this.onProgress("Loading trees, towns and clouds…", 0.1 + (0.35 * done) / files.length);
      }),
    );
    try {
      const gltf = await this._loadGLB("./models/mountain.glb");
      this._configureModel(gltf.scene, { castShadow: false, receiveShadow: false });
      const box = new THREE.Box3().setFromObject(gltf.scene),
        size = box.getSize(new THREE.Vector3());
      for (const [x, z, width] of [
        [-2500, -2200, 900],
        [2600, -1700, 1000],
        [-2500, 2300, 800],
        [2800, 2200, 950],
      ]) {
        const scale = width / Math.max(size.x, size.z);
        const model = this._placeGroundedAsset(gltf.scene, { x, z, scale, name: "Mountain" });
        this.mountains.push({ x, z, radius: width * 0.75, height: size.y * scale, model });
      }
    } catch (error) {
      console.error("could not load mountains", error);
    }
  }

  _buildAircraft() {
    // physics moves this group, the model just sits inside it
    this.aircraft = new THREE.Group();
    this.aircraft.name = "AircraftPhysicsRoot";
    this.scene.add(this.aircraft);

    this.modelPropeller = null;
    this.modelElevator = null;
    this.modelRudder = null;

    this._loadAircraftModel();
  }

  _loadAircraftModel() {
    this.aircraftReady = this._loadGLB("./models/plane.glb")
      .then((gltf) => {
        const model = gltf.scene;
        model.name = "RealAircraftVisual";

        // model: x = wings, y = up, -z = nose
        const modelScale = 0.0077;
        model.scale.setScalar(modelScale);

        // the model is turned about 14 degrees, fix it so it points down the runway
        model.rotation.y = THREE.MathUtils.degToRad(14.25);
        model.rotation.z = THREE.MathUtils.degToRad(1.0);

        model.traverse((obj) => {
          if (!obj.isMesh) return;

          obj.castShadow = true;
          obj.receiveShadow = true;

          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const material of materials) {
            if (!material) continue;
            if (material.map) {
              material.map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
              material.map.needsUpdate = true;
            }
          }
        });

        // center it and put the tires on the runway
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());

        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y += VISUAL_RUNWAY_Y - GEAR_Y - box.min.y;

        // parts of the model we animate
        this.modelPropeller = model.getObjectByName("propelting") || null;
        this.modelElevator = model.getObjectByName("haleror") || null;
        this.modelRudder = model.getObjectByName("halerorvert") || null;

        if (this.modelElevator) {
          this.modelElevator.userData.baseQuaternion = this.modelElevator.quaternion.clone();
        }
        if (this.modelRudder) {
          this.modelRudder.userData.baseQuaternion = this.modelRudder.quaternion.clone();
        }

        this.aircraft.add(model);
        this.aircraft.visible = this.cameraMode !== "cockpit";
      })
      .catch((error) => console.error("could not load the plane", error));
  }

  clearMissionGates() {
    while (this.gateGroup.children.length) {
      const child = this.gateGroup.children[0];
      this.gateGroup.remove(child);
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
      else child.material?.dispose?.();
    }
    this.missionGates = [];
    this.currentGateIndex = 0;
    if (this.state) {
      this.state.gateIndex = 0;
      this.state.gateCount = 0;
    }
  }

  setMissionGates(gates = []) {
    this.clearMissionGates();
    const palette = [0x28a9e2, 0xffcf44, 0x71cf77, 0x8a74d8, 0xff806d, 0x36c7bd];

    this.missionGates = gates.map((g, i) => {
      const radius = g.radius || 42;
      const color = g.color ?? palette[i % palette.length];
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.18,
        roughness: 0.42,
        metalness: 0.08,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, Math.max(2.8, radius * 0.075), 12, 48),
        material,
      );
      ring.position.set(g.x || 0, g.y || 60, g.z || -500);
      const prev = i > 0 ? gates[i - 1] : { x: 0, z: 690 };
      const dxPath = (g.x || 0) - (prev.x || 0);
      const dzPath = (g.z || -500) - (prev.z || 690);
      ring.rotation.y = Math.atan2(dxPath, dzPath);
      ring.castShadow = true;
      this.gateGroup.add(ring);

      return {
        ...g,
        x: g.x || 0,
        y: g.y || 60,
        z: g.z || -500,
        radius,
        originalRadius: radius,
        ring,
        attempts: 0,
        passed: false,
      };
    });

    this.currentGateIndex = 0;
    if (this.state) {
      this.state.gateIndex = 0;
      this.state.gateCount = this.missionGates.length;
    }
    this._highlightCurrentGate();
  }

  _highlightCurrentGate() {
    this.missionGates.forEach((gate, i) => {
      const active = i === this.currentGateIndex;
      gate.ring.visible = !gate.passed;
      gate.ring.scale.setScalar(active ? 1.08 : 0.92);
      gate.ring.material.emissiveIntensity = active ? 0.34 : 0.1;
      gate.ring.material.opacity = active ? 1 : 0.55;
      gate.ring.material.transparent = !active;
    });
  }

  _gateCriteriaFailures(gate, s) {
    const c = gate.criteria || {};
    const failed = [];
    if (Number.isFinite(c.maxAbsBank) && Math.abs(s.rollDeg) > c.maxAbsBank) failed.push("bank");
    if (Number.isFinite(c.maxAbsVSpeed) && Math.abs(s.verticalSpeedFpm) > c.maxAbsVSpeed)
      failed.push("verticalSpeed");
    if (Number.isFinite(c.minSpeed) && s.speedKts < c.minSpeed) failed.push("slow");
    if (Number.isFinite(c.maxSpeed) && s.speedKts > c.maxSpeed) failed.push("fast");
    if (Number.isFinite(c.maxAbsPitch) && Math.abs(s.pitchDeg) > c.maxAbsPitch) failed.push("pitch");
    return failed;
  }

  _updateMissionGates() {
    const s = this.state;
    if (!this.missionGates.length || s.crashed || s.onGround) return;
    if (this.currentGateIndex >= this.missionGates.length) return;

    const gate = this.missionGates[this.currentGateIndex];
    const dx = s.x - gate.x;
    const dy = s.y - gate.y;
    const dz = s.z - gate.z;
    const angle = gate.ring.rotation.y;
    const lateral = dx * Math.cos(angle) - dz * Math.sin(angle);
    const along = dx * Math.sin(angle) + dz * Math.cos(angle);
    const radial = Math.hypot(lateral, dy);
    const closeToPlane = Math.abs(along) <= Math.max(18, gate.radius * 0.42);

    const criteriaFailed = this._gateCriteriaFailures(gate, s);

    if (closeToPlane && radial <= gate.radius * 0.72 && criteriaFailed.length === 0) {
      gate.passed = true;
      gate.ring.visible = false;
      s.justPassedGate = {
        index: this.currentGateIndex,
        label: gate.label || `Gate ${this.currentGateIndex + 1}`,
        skill: gate.skill || "control",
        attempts: gate.attempts + 1,
      };
      this.currentGateIndex += 1;
      s.gateIndex = this.currentGateIndex;
      this._highlightCurrentGate();
      return;
    }

    // missed a ring? move it back in front of you so you don't have to turn around
    if (along > Math.max(35, gate.radius * 0.7)) {
      gate.attempts += 1;
      s.justMissedGate = {
        index: this.currentGateIndex,
        label: gate.label || `Gate ${this.currentGateIndex + 1}`,
        skill: gate.skill || "control",
        wasHigh: s.y > gate.y + gate.radius * 0.55,
        wasLow: s.y < gate.y - gate.radius * 0.55,
        wasLeft: s.x < gate.x - gate.radius * 0.55,
        wasRight: s.x > gate.x + gate.radius * 0.55,
        criteriaFailed: this._gateCriteriaFailures(gate, s),
        attempts: gate.attempts,
      };

      // landing rings stay put since they line up with the runway
      if (this.lessonKey === "landing") {
        gate.passed = true;
        gate.ring.visible = false;
        this.currentGateIndex++;
        s.gateIndex = this.currentGateIndex;
        this._highlightCurrentGate();
        return;
      }

      gate.z = s.z - 390;
      gate.x = s.x * 0.28;
      // Each retry makes the ring a little bigger, up to 12% larger.
      gate.radius = Math.min(gate.originalRadius * 1.12, gate.originalRadius + gate.attempts * 6);
      gate.ring.position.set(gate.x, gate.y, gate.z);
      gate.ring.rotation.y = Math.atan2(gate.x - s.x, gate.z - s.z);
      gate.ring.scale.setScalar((gate.radius / gate.originalRadius) * 1.08);
    }
  }

  getMissionProgress() {
    return {
      current: this.currentGateIndex,
      total: this.missionGates.length,
      complete: this.missionGates.length > 0 && this.currentGateIndex >= this.missionGates.length,
    };
  }

  setCameraMode(mode) {
    this.cameraMode = mode === "cockpit" ? "cockpit" : "chase";
    if (this.aircraft) this.aircraft.visible = this.attract || this.cameraMode !== "cockpit";
    this._updateTransforms(true);
  }

  toggleCameraMode() {
    this.setCameraMode(this.cameraMode === "cockpit" ? "chase" : "cockpit");
    return this.cameraMode;
  }

  getCameraMode() {
    return this.cameraMode;
  }

  setPaused(v) {
    this.paused = Boolean(v);
  }

  update(input, dt) {
    this.frameDt = dt;
    this.time = (this.time || 0) + (this.paused && !this.attract ? 0 : dt);
    this.landscape?.update(this.state.x, this.state.z, this.paused && !this.attract ? 0 : dt);
    const s = this.state;
    s.justTookOff = false;
    s.justLanded = false;
    s.justPassedGate = null;
    s.justMissedGate = null;
    if (!this.paused) {
      const spin = (5 + (s.throttle || 0) * 45) * dt;
      if (this.modelPropeller) this.modelPropeller.rotation.z += spin;

      // move the control surfaces on the model
      if (this.modelElevator?.userData.baseQuaternion) {
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(THREE.MathUtils.degToRad(-input.pitch * 10), 0, 0),
        );
        this.modelElevator.quaternion.copy(this.modelElevator.userData.baseQuaternion).multiply(q);
      }

      if (this.modelRudder?.userData.baseQuaternion) {
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0, THREE.MathUtils.degToRad(input.rudder * 11), 0),
        );
        this.modelRudder.quaternion.copy(this.modelRudder.userData.baseQuaternion).multiply(q);
      }
    }

    if (this.paused || s.crashed) {
      this._updateTransforms();
      return s;
    }

    if (s.onGround) {
      this._updateGround(input, dt);
    } else {
      this._updateAir(input, dt);
    }

    this._checkObstacleCollision();
    this._checkMountainCollision();
    this._updateMissionGates();
    this._updateTransforms();
    return s;
  }

  _updateGround(input, dt) {
    const s = this.state;

    s.throttle += (input.throttle - s.throttle) * (1 - Math.exp(-dt * 6));
    const targetSpeed = s.throttle * 78;
    const groundResponse = s.throttle < 0.08 ? 2.0 : 1.25;
    s.speedKts += (targetSpeed - s.speedKts) * (1 - Math.exp(-dt * groundResponse));
    if (s.throttle < 0.05) s.speedKts = Math.max(0, s.speedKts - 5.5 * dt);

    // Rudder steers on the ground. A/D are reserved for roll in the air.
    const steer = input.rudder * THREE.MathUtils.degToRad(20) * Math.min(1, s.speedKts / 25);
    s.heading -= steer * dt;

    const pitchTarget = THREE.MathUtils.degToRad(input.pitch * 8);
    s.pitch += (pitchTarget - s.pitch) * (1 - Math.exp(-dt * 2.4));
    s.roll *= Math.exp(-dt * 8);

    const mps = s.speedKts * 0.514444;
    s.x -= Math.sin(s.heading) * mps * dt;
    s.z -= Math.cos(s.heading) * mps * dt;

    s.y = GEAR_Y;
    s.altitudeFt = 0;
    s.verticalSpeedFpm = 0;
    s.pitchDeg = THREE.MathUtils.radToDeg(s.pitch);
    s.rollDeg = THREE.MathUtils.radToDeg(s.roll);

    const onRunway = this._isOverRunway();

    if (!onRunway && s.speedKts > 22) {
      this._crash("You left the runway while moving too fast.");
      return;
    }

    if (onRunway && s.speedKts > 50 && input.pitch > 0.22) {
      s.onGround = false;
      s.y = GEAR_Y + 0.6;
      s.justTookOff = true;
    }
  }

  _updateAir(input, dt) {
    const s = this.state;
    // ease into control inputs instead of snapping
    const smooth = 1 - Math.exp(-dt * 2.15);

    const targetPitch = THREE.MathUtils.degToRad(input.pitch * 14);
    const targetRoll = THREE.MathUtils.degToRad(input.roll * 36);

    s.pitch += (targetPitch - s.pitch) * smooth;
    s.roll += (targetRoll - s.roll) * smooth;
    s.yawSlip += (input.rudder - s.yawSlip) * (1 - Math.exp(-dt * 2.2));
    s.throttle += (input.throttle - s.throttle) * (1 - Math.exp(-dt * 5.5));

    const targetSpeed = 42 + s.throttle * 94 - Math.max(0, THREE.MathUtils.radToDeg(s.pitch)) * 0.42;
    s.speedKts += (targetSpeed - s.speedKts) * (1 - Math.exp(-dt * 0.85));
    s.speedKts = THREE.MathUtils.clamp(s.speedKts, 25, 150);

    const pitchDeg = THREE.MathUtils.radToDeg(s.pitch);
    const rollDeg = THREE.MathUtils.radToDeg(s.roll);

    const turnRateDeg = Math.sin(s.roll) * (s.speedKts / 70) * 15.5 + s.yawSlip * 6.5;
    s.heading -= THREE.MathUtils.degToRad(turnRateDeg) * dt;

    const forwardMps = s.speedKts * 0.514444;
    const liftFactor = THREE.MathUtils.clamp((s.speedKts - 30) / 38, 0.18, 1.05);

    let climbMps = Math.sin(s.pitch) * forwardMps * 0.76 * liftFactor;
    if (s.speedKts < 45) climbMps -= (45 - s.speedKts) * 0.16;
    if (Math.abs(rollDeg) > 45) climbMps -= (Math.abs(rollDeg) - 45) * 0.025;

    s.verticalSpeedFpm = climbMps * 196.8504;
    s.y += climbMps * dt;

    const horizontal = Math.cos(s.pitch) * forwardMps;
    s.x -= Math.sin(s.heading) * horizontal * dt;
    s.z -= Math.cos(s.heading) * horizontal * dt;

    s.altitudeFt = Math.max(0, (s.y - GEAR_Y) * 3.28084);
    s.pitchDeg = pitchDeg;
    s.rollDeg = rollDeg;

    if (s.y <= GEAR_Y) {
      this._handleGroundContact();
    }
  }

  _handleGroundContact() {
    const s = this.state;
    // What counts as a landing rather than a crash.
    const r = {
      sinkMin: -700,
      bankMax: 13,
      pitchMin: -5,
      pitchMax: 13,
      speedMin: 35,
      speedMax: 94,
      runwayMargin: 7,
    };
    const overLandingArea = this._isOverLandingArea(r.runwayMargin);

    const gentle = s.verticalSpeedFpm >= r.sinkMin;
    const wingsLevel = Math.abs(s.rollDeg) <= r.bankMax;
    const usablePitch = s.pitchDeg >= r.pitchMin && s.pitchDeg <= r.pitchMax;
    const landingSpeed = s.speedKts >= r.speedMin && s.speedKts <= r.speedMax;

    if (overLandingArea && gentle && wingsLevel && usablePitch && landingSpeed) {
      s.onGround = true;
      s.y = GEAR_Y;
      s.altitudeFt = 0;
      s.verticalSpeedFpm = 0;
      s.roll *= 0.32;
      s.pitch *= 0.28;
      s.justLanded = true;
      s.runwayId = this._whichRunway(r.runwayMargin) || "runway";
      // Bleed some speed at touchdown so a good landing can actually roll out.
      s.speedKts *= 0.84;
      return;
    }

    let reason = "The plane hit the ground too hard.";
    if (!overLandingArea) reason = "The plane touched down away from the runway.";
    else if (!wingsLevel) reason = "The wings were tilted too much at touchdown.";
    else if (!landingSpeed)
      reason =
        s.speedKts > r.speedMax
          ? "The plane was too fast to land safely."
          : "The plane was too slow at touchdown.";
    else if (!usablePitch) reason = "The nose angle was not safe for touchdown.";
    this._crash(reason);
  }

  _checkObstacleCollision() {
    const s = this.state;
    if (s.crashed) return;

    if (this.landscape?.collision(s.x, s.y, s.z)) {
      this._crash(`The plane hit ${this.landscape.collisionName(s.x, s.y, s.z)}.`);
      return;
    }
    for (const box of this.obstacles) {
      if (s.x >= box.minX && s.x <= box.maxX && s.z >= box.minZ && s.z <= box.maxZ && s.y <= box.height) {
        this._crash("The plane hit a building.");
        return;
      }
    }
  }

  _checkMountainCollision() {
    const s = this.state;
    if (s.crashed || s.onGround) return;

    for (const mountain of this.mountains) {
      const dx = s.x - mountain.x;
      const dz = s.z - mountain.z;
      const distance = Math.hypot(dx, dz);

      if (distance >= mountain.radius) continue;

      let localTerrainHeight = 0;
      if (mountain.model) {
        if (s.y > mountain.height + 10) continue;
        this.terrainRay ||= new THREE.Raycaster();
        this.terrainRay.set(new THREE.Vector3(s.x, mountain.height + 100, s.z), new THREE.Vector3(0, -1, 0));
        const hit = this.terrainRay.intersectObject(mountain.model, true)[0];
        if (!hit) continue;
        localTerrainHeight = hit.point.y;
      } else localTerrainHeight = Math.max(0, mountain.height * (1 - distance / mountain.radius));

      if (s.y <= localTerrainHeight + 4) {
        this._crash("The plane hit a mountain.");
        return;
      }
    }
  }

  _whichRunway(margin = 0) {
    const s = this.state;
    const home = Math.abs(s.x) <= RUNWAY_HALF_WIDTH + margin && Math.abs(s.z) <= RUNWAY_HALF_LENGTH + margin;
    if (home) return "home";

    const training =
      Math.abs(s.x - TRAINING_RUNWAY.x) <= TRAINING_RUNWAY.halfWidth + margin &&
      Math.abs(s.z - TRAINING_RUNWAY.z) <= TRAINING_RUNWAY.halfLength + margin;
    if (training) return "training";
    return null;
  }

  _isOverRunway(margin = 0) {
    return this._whichRunway(margin) !== null;
  }

  _isOverLandingArea(margin = 0) {
    return this._whichRunway(margin) !== null;
  }

  _crash(reason) {
    const s = this.state;
    s.crashed = true;
    s.failureReason = reason;
    s.verticalSpeedFpm = 0;
    this.paused = true;
  }

  _updateTransforms(snap = false) {
    const s = this.state;
    this.aircraft.position.set(s.x, s.y, s.z);
    this.aircraft.rotation.order = "YXZ";
    this.aircraft.rotation.y = s.heading;
    this.aircraft.rotation.x = s.pitch;
    this.aircraft.rotation.z = -s.roll;

    this.aircraft.updateMatrixWorld(true);
    this._updateShadow();

    if (this.attract && this.paused) {
      // menu: camera sits still, looking at the parked plane
      this.camera.position.set(s.x + 17, s.y + 6, s.z + 17);
      this.camera.lookAt(s.x - 3, s.y + 1.4, s.z - 3);
      this._setMenuOffset(true);
      return;
    }

    if (this.cameraMode === "cockpit") {
      const cockpitLocal = new THREE.Vector3(0, 0.58, -1.25);
      const targetCamera = this.aircraft.localToWorld(cockpitLocal.clone());
      if (snap) this.camera.position.copy(targetCamera);
      else this.camera.position.lerp(targetCamera, 1 - Math.exp(-21 * this.frameDt));
      this.camera.quaternion.copy(this.aircraft.quaternion);
    } else {
      const backDistance = s.onGround ? 21 : 19.5;
      const backHeight = s.onGround ? 6.2 : 5.4;
      const back = new THREE.Vector3(0, backHeight, backDistance);
      back.applyEuler(new THREE.Euler(0, s.heading, 0));
      const targetCamera = new THREE.Vector3(s.x, s.y, s.z).add(back);

      if (snap) this.camera.position.copy(targetCamera);
      else this.camera.position.lerp(targetCamera, 1 - Math.exp(-7.7 * this.frameDt));

      const lookAhead = new THREE.Vector3(
        -Math.sin(s.heading) * 70,
        s.onGround ? 1 : Math.sin(s.pitch) * 38,
        -Math.cos(s.heading) * 70,
      );
      this.camera.lookAt(new THREE.Vector3(s.x, s.y + 0.8, s.z).add(lookAhead));
    }
  }

  setAttract(value) {
    this.attract = Boolean(value);
    if (this.aircraft) this.aircraft.visible = this.attract || this.cameraMode !== "cockpit";
    if (!this.attract) {
      this._setMenuOffset(false);
      this._updateTransforms(true);
    }
  }

  // On wide screens the menu panel covers the left side, so shift the view to
  // keep the parked airplane visible on the right.
  _setMenuOffset(on) {
    const w = this.canvas?.clientWidth || globalThis.innerWidth || 0,
      h = this.canvas?.clientHeight || globalThis.innerHeight || 0;
    const shift = on && w > 820 ? -w * 0.2 : 0;
    if (shift === (this.menuShift || 0) && (this.camera.view?.fullWidth === w || !shift)) return;
    this.menuShift = shift;
    if (shift) this.camera.setViewOffset(w, h, shift, 0, w, h);
    else this.camera.clearViewOffset();
  }

  setQuality(value) {
    this.quality = value;
    this.landscape?.setQuality(value);
    this.scene.fog.near = value === "low" ? 900 : 1500;
    this.scene.fog.far = value === "low" ? 2200 : 3300;
    const cap = value === "high" ? 1.75 : value === "low" ? 0.8 : 1.25;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.resize();
  }

  render() {
    this.sky?.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = Math.max(0.1, w / Math.max(1, h));
    this.menuShift = null;
    if (this.camera.view) this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}
