import * as THREE from "three";
import { mergeGeometries } from "../vendor/three/examples/jsm/utils/BufferGeometryUtils.js";
import { grassTexture, cropTexture, roadTexture, ROAD_GREY } from "./textures.js";

export const TILE_SIZE = 1400;
export const TILE_RADIUS = 3;
const HALF = TILE_SIZE / 2;
const CELLS = 8;
const CELL = TILE_SIZE / CELLS;

export function randomFor(x, z) {
  let seed = (Math.imul(x, 73856093) ^ Math.imul(z, 19349663) ^ 48271) >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function tileCoordinates(x, z) {
  return [Math.floor((x + HALF) / TILE_SIZE), Math.floor((z + HALF) / TILE_SIZE)];
}
export function reserved(x, z, pad = 0) {
  return (
    (Math.abs(x) < 460 + pad && Math.abs(z) < 1100 + pad) ||
    (Math.abs(x - 520) < 430 + pad && Math.abs(z + 3400) < 900 + pad)
  );
}
// Lesson rings fly through this box. Tall landmarks stay out of it so they
// never block a lesson path.
export function lessonCorridor(x, z, pad = 0) {
  return x > -760 - pad && x < 1200 + pad && z > -4400 - pad && z < 1300 + pad;
}

// field colors
const GRASS = [0x8cc063, 0x7db556, 0x9fcf6e, 0x74ad50, 0x95c76a];
const CROPS = [0xe7c55c, 0xf0d84a, 0xb6d66a, 0xb98a5a, 0xa98bd0, 0xd9b45a];
const VEHICLES = [
  ["car", 0.4, 7],
  ["truck-red", 0.15, 8.5],
  ["truck-yellow", 0.15, 8.5],
  ["truck-green", 0.15, 8.5],
  ["truck-purple", 0.15, 8.5],
];
const SHOPS = ["shop-a", "shop-b", "shop-c", "shop-d", "garage"];
const TOWN_COLORS = [0xe4572e, 0x2a9d8f, 0xf2a541, 0x5b8def];
const BALLOON_SCHEMES = [
  [0xe63946, 0xffd166],
  [0x2a9d8f, 0xffffff],
  [0x7b5ea7, 0xf4a259],
  [0x1d7fd8, 0xf25f5c],
];

// the world is a grid of tiles that follow the plane. Same coordinates = same tile.
export class Landscape {
  constructor(sim, models) {
    this.sim = sim;
    this.scene = sim.scene;
    this.models = models || {};
    this.tiles = new Map();
    this.parts = new Map();
    this.elapsed = 0;
    this.quality = "balanced";
    const grassMap = grassTexture(),
      cropMap = cropTexture();
    this.fieldMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, map: grassMap });
    this.cropMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, map: cropMap });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      color: 0x3f9bd6,
      emissive: 0x0c3e66,
      emissiveIntensity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    const roadMap = roadTexture();
    this.roadMaterial = new THREE.MeshLambertMaterial({
      color: roadMap ? 0xffffff : ROAD_GREY,
      map: roadMap,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.crossMaterial = new THREE.MeshLambertMaterial({
      color: ROAD_GREY,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.treeMaterial = new THREE.MeshLambertMaterial({ color: 0x416d46 });
    this.buildingMaterial = new THREE.MeshLambertMaterial({ color: 0xd8c7a6 });
    // big ground plane under everything so there are never holes
    this.safetyGround = new THREE.Mesh(
      new THREE.PlaneGeometry(22000, 22000),
      new THREE.MeshLambertMaterial({ color: 0x86b85d, depthWrite: false }),
    );
    this.safetyGround.rotation.x = -Math.PI / 2;
    this.safetyGround.position.y = -0.08;
    this.safetyGround.renderOrder = -100;
    this.scene.add(this.safetyGround);
    this.balloonGeometries = BALLOON_SCHEMES.map((scheme) => balloonGeometry(scheme));
    this.turbineTower = turbineTowerGeometry();
    this.turbineRotor = turbineRotorGeometry();
    this.farmGeometry = farmGeometry();
    this.towerGeometries = TOWN_COLORS.map((color) => waterTowerGeometry(color));
    this.traffic = new Traffic(this);
    this.clouds = new CloudLayer(this);
  }

  // Each model becomes one geometry per material, sized so its widest side
  // equals `width` meters and its base sits on the ground.
  modelParts(key, width) {
    const id = `${key}:${width}`;
    if (this.parts.has(id)) return this.parts.get(id);
    const root = this.models[key];
    let parts = [];
    if (root) {
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3()),
        center = bounds.getCenter(new THREE.Vector3());
      const scale = width / Math.max(size.x, size.z, 0.001);
      const adjust = new THREE.Matrix4().makeScale(scale, scale, scale);
      adjust.multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
      const byMaterial = new Map();
      root.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        const geo = o.geometry
          .clone()
          .applyMatrix4(new THREE.Matrix4().multiplyMatrices(adjust, o.matrixWorld));
        if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
        byMaterial.get(o.material).push(geo);
      });
      for (const [material, geos] of byMaterial) {
        let merged = null;
        try {
          merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        } catch {
          merged = null;
        }
        if (merged) parts.push({ geometry: merged, material });
        else for (const g of geos) parts.push({ geometry: g, material });
      }
    } else parts = this.fallbackParts(key, width);
    this.parts.set(id, parts);
    return parts;
  }

  fallbackParts(key, width) {
    if (key === "tree" || key === "tree-round")
      return [
        {
          geometry: new THREE.ConeGeometry(width * 0.55, width * 1.8, 6).translate(0, width * 0.9, 0),
          material: this.treeMaterial,
        },
      ];
    if (key === "house" || SHOPS.includes(key))
      return [
        {
          geometry: new THREE.BoxGeometry(width * 0.85, width * 0.55, width * 0.7).translate(
            0,
            width * 0.275,
            0,
          ),
          material: this.buildingMaterial,
        },
      ];
    if (key === "fountain") return [];
    return [];
  }

  instances(group, key, positions, width) {
    if (!positions.length) return;
    const matrix = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      up = new THREE.Vector3(0, 1, 0),
      p = new THREE.Vector3(),
      s = new THREE.Vector3();
    for (const part of this.modelParts(key, width)) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, positions.length);
      positions.forEach(([x, z, rotation = 0, scale = 1, y = 0.08], i) => {
        q.setFromAxisAngle(up, rotation);
        p.set(x, y, z);
        s.set(scale, scale, scale);
        matrix.compose(p, q, s);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }

  makeTile(tx, tz) {
    const rng = randomFor(tx, tz),
      cx = tx * TILE_SIZE,
      cz = tz * TILE_SIZE;
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    const isReserved = (x, z, pad = 0) => reserved(cx + x, cz + z, pad);
    const nearRoad = (x, z, pad) => Math.abs(x) < pad || Math.abs(z) < pad;
    const plain = { p: [], c: [], uv: [] },
      crop = { p: [], c: [], uv: [] };
    const ponds = [],
      forestCells = [],
      farmCells = [];
    const color = new THREE.Color();

    // 1. Fields. Adjacent cells share exact edges, so there are no overlapping layers.
    for (let i = 0; i < CELLS; i++)
      for (let j = 0; j < CELLS; j++) {
        const x = -HALF + i * CELL,
          z = -HALF + j * CELL,
          mx = x + CELL / 2,
          mz = z + CELL / 2;
        const roll = rng();
        const blocked = isReserved(mx, mz, 40);
        let kind = roll < 0.5 ? "grass" : roll < 0.88 ? "crop" : roll < 0.95 ? "forest" : "pond";
        if (blocked && kind !== "crop") kind = "grass";
        const target = kind === "crop" ? crop : plain;
        if (kind === "crop") color.setHex(CROPS[Math.floor(rng() * CROPS.length)]);
        else if (kind === "forest") color.setHex(0x6c9f4a);
        else color.setHex(GRASS[Math.floor(rng() * GRASS.length)]);
        const rows = rng() < 0.5;
        const quad = [
          [x, z],
          [x, z + CELL],
          [x + CELL, z],
          [x + CELL, z],
          [x, z + CELL],
          [x + CELL, z + CELL],
        ];
        for (const [px, pz] of quad) {
          target.p.push(px, 0, pz);
          target.c.push(color.r, color.g, color.b);
          if (kind === "crop") target.uv.push((rows ? px : pz) / 32, (rows ? pz : px) / 32);
          else target.uv.push(px / 50, pz / 50);
        }
        if (kind === "forest" && !blocked) forestCells.push([mx, mz]);
        if (kind === "pond" && !blocked && !nearRoad(mx, mz, 70))
          ponds.push([mx + (rng() - 0.5) * 30, mz + (rng() - 0.5) * 30, 38 + rng() * 34]);
        if (kind === "grass" && !blocked && !nearRoad(mx, mz, 90) && rng() < 0.12) farmCells.push([mx, mz]);
      }
    const ground = new THREE.Mesh(fieldGeometry(plain), this.fieldMaterial);
    group.add(ground);
    const crops = new THREE.Mesh(fieldGeometry(crop), this.cropMaterial);
    group.add(crops);
    let pondMesh = null;
    if (ponds.length) {
      pondMesh = new THREE.Mesh(pondGeometry(ponds, rng), this.waterMaterial);
      group.add(pondMesh);
    }
    const inPond = (x, z, pad = 0) => ponds.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r + pad);

    const pines = [],
      rounds = [],
      houses = [],
      farms = [],
      colliders = [],
      spheres = [],
      landmarks = [];
    const addTree = (x, z) => {
      if (nearRoad(x, z, 16) || isReserved(x, z, 30) || inPond(x, z, 8)) return;
      (rng() < 0.55 ? pines : rounds).push([x, z, rng() * 6.28, 0.7 + rng() * 0.6]);
    };
    // 2. Trees: forests, scattered trees and hedgerows along some field edges.
    for (const [mx, mz] of forestCells)
      for (let k = 0; k < 22; k++) addTree(mx + (rng() - 0.5) * CELL * 0.9, mz + (rng() - 0.5) * CELL * 0.9);
    for (let i = 0; i < 34; i++) addTree((rng() - 0.5) * 1320, (rng() - 0.5) * 1320);
    for (let i = 1; i < CELLS; i++) {
      if (i === CELLS / 2) continue; // road line
      const line = -HALF + i * CELL;
      if (rng() < 0.22) for (let t = -HALF + 20; t < HALF - 20; t += 24) addTree(line + (rng() - 0.5) * 4, t);
      if (rng() < 0.22) for (let t = -HALF + 20; t < HALF - 20; t += 24) addTree(t, line + (rng() - 0.5) * 4);
    }

    // 3. Houses along both roads.
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 160 + 70,
        z = (rng() > 0.5 ? 1 : -1) * (65 + rng() * 50);
      if (isReserved(x, z, 60)) continue;
      houses.push([x, z, z > 0 ? Math.PI : 0]);
      colliders.push(box(cx + x, cz + z, 19, 24));
    }
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * 190 + 40,
        x = (rng() > 0.5 ? 1 : -1) * (65 + rng() * 50);
      if (isReserved(x, z, 60) || Math.abs(z) < 140) continue;
      houses.push([x, z, x > 0 ? -Math.PI / 2 : Math.PI / 2]);
      colliders.push(box(cx + x, cz + z, 19, 24));
    }

    // 4. Farms: a red barn with a silo.
    for (const [mx, mz] of farmCells.slice(0, 2)) {
      farms.push([mx, mz, (Math.floor(rng() * 4) * Math.PI) / 2]);
      colliders.push(box(cx + mx, cz + mz, 30, 38));
      landmarks.push({ type: "farm", name: "Farm", x: cx + mx, z: cz + mz, y: 20 });
    }

    // 5. A small town at some crossroads.
    const shops = Object.fromEntries(SHOPS.map((k) => [k, []])),
      fountains = [],
      towers = [];
    if (rng() < 0.32 && !isReserved(0, 0, 320)) {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          for (const [ax, az] of [
            [34, 34],
            [76, 34],
            [34, 76],
            [118, 34],
            [34, 118],
          ]) {
            if (rng() < 0.3) continue;
            const x = sx * ax,
              z = sz * az;
            const facesZRoad = ax < az;
            const rotation = facesZRoad ? (sx > 0 ? -Math.PI / 2 : Math.PI / 2) : sz > 0 ? Math.PI : 0;
            const kind = SHOPS[Math.floor(rng() * SHOPS.length)];
            shops[kind].push([x, z, rotation]);
            colliders.push(box(cx + x, cz + z, 16, 42));
          }
        }
      fountains.push([sign(rng() - 0.5) * 150, 34 * sign(rng() - 0.5), 0]);
      const wx = sign(rng() - 0.5) * 165,
        wz = sign(rng() - 0.5) * 120;
      towers.push([wx, wz, Math.floor(rng() * TOWN_COLORS.length)]);
      colliders.push(box(cx + wx, cz + wz, 12, 62));
      landmarks.push({ type: "town", name: "Town water tower", x: cx + wx, z: cz + wz, y: 50 });
    }

    // 6. Wind farm, away from airports and lesson paths.
    const turbines = [];
    if (rng() < 0.24 && !lessonCorridor(cx, cz, 700) && !isReserved(0, 0, 800)) {
      const side = rng() < 0.5 ? -1 : 1,
        row = side * (260 + rng() * 180);
      for (let x = -480; x <= 480; x += 240) {
        if (Math.abs(x) < 40) continue;
        const z = row + (rng() - 0.5) * 60;
        if (inPond(x, z, 20)) continue;
        turbines.push([x, z, rng() * Math.PI]);
        colliders.push({
          minX: cx + x - 4,
          maxX: cx + x + 4,
          minZ: cz + z - 30,
          maxZ: cz + z + 30,
          height: 100,
        });
      }
      if (turbines.length) landmarks.push({ type: "wind", name: "Wind farm", x: cx, z: cz + row, y: 70 });
    }

    // 7. Hot-air balloons, floating above lesson heights.
    const balloons = [];
    if (rng() < 0.42 && !lessonCorridor(cx, cz, 300) && !isReserved(0, 0, 500)) {
      const count = 1 + (rng() < 0.4 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const x = (rng() - 0.5) * 1000,
          z = (rng() - 0.5) * 1000,
          y = 150 + rng() * 110;
        const mesh = new THREE.Mesh(
          this.balloonGeometries[Math.floor(rng() * this.balloonGeometries.length)],
          this.solidMaterial,
        );
        mesh.position.set(x, y, z);
        mesh.rotation.y = rng() * 6.28;
        group.add(mesh);
        const sphere = { x: cx + x, y: y + 18, z: cz + z, r: 17 };
        spheres.push(sphere);
        balloons.push({ mesh, baseY: y, phase: rng() * 6.28, sphere });
        landmarks.push({
          type: "balloon",
          name: "Hot-air balloon",
          x: cx + x,
          z: cz + z,
          y: y + 18,
          ref: sphere,
        });
      }
    }
    if (ponds.length) {
      const [px, pz, r] = ponds.reduce((a, b) => (b[2] > a[2] ? b : a));
      if (r > 55) landmarks.push({ type: "lake", name: "Pond", x: cx + px, z: cz + pz, y: 5 });
    }

    // 8. Roads cross at tile centers and meet the next tile's road exactly at
    // the tile edge. Airports interrupt them.
    const roadGeo = roadGeometry(isReserved);
    const roads = new THREE.Mesh(roadGeo.geometry, this.roadMaterial);
    group.add(roads);
    let crossMesh = null;
    if (roadGeo.hasZ && roadGeo.hasX && !isReserved(0, 0, 30)) {
      crossMesh = new THREE.Mesh(
        (this.crossGeometry ||= new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2).translate(0, 0.09, 0)),
        this.crossMaterial,
      );
      group.add(crossMesh);
    }
    // Trees and houses are fine detail: they are hidden in far tiles, where fog
    // would mostly cover them anyway. Landmarks stay visible to the horizon.
    const detail = new THREE.Group();
    group.add(detail);
    this.instances(detail, "tree", pines, 8);
    this.instances(detail, "tree-round", rounds, 14);
    this.instances(detail, "house", houses, 34);
    for (const kind of SHOPS) this.instances(group, kind, shops[kind], 28);
    this.instances(group, "fountain", fountains, 22);
    if (farms.length) group.add(staticInstances(this.farmGeometry, this.solidMaterial, farms));
    towers.forEach(([x, z, c]) => {
      const m = new THREE.Mesh(this.towerGeometries[c], this.solidMaterial);
      m.position.set(x, 0, z);
      group.add(m);
    });
    let rotors = null;
    if (turbines.length) {
      group.add(staticInstances(this.turbineTower, this.solidMaterial, turbines));
      rotors = new THREE.InstancedMesh(this.turbineRotor, this.solidMaterial, turbines.length);
      rotors.userData.turbines = turbines;
      rotors.frustumCulled = false;
      group.add(rotors);
      this.spinRotors(rotors, 0);
    }
    const traffic = this.traffic.planTile(rng, roadGeo.hasZ, roadGeo.hasX);
    this.scene.add(group);
    return {
      group,
      detail,
      ground,
      crops,
      roads,
      pondMesh,
      colliders,
      spheres,
      balloons,
      rotors,
      landmarks,
      traffic,
      tx,
      tz,
    };
  }

  spinRotors(rotors, angle) {
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      p = new THREE.Vector3(),
      s = new THREE.Vector3(1, 1, 1);
    rotors.userData.turbines.forEach(([x, z, offset], i) => {
      e.set(angle + offset, 0, 0);
      q.setFromEuler(e);
      p.set(x - 2.2, 72, z);
      m.compose(p, q, s);
      rotors.setMatrixAt(i, m);
    });
    rotors.instanceMatrix.needsUpdate = true;
  }

  needed(x, z) {
    const [tx, tz] = tileCoordinates(x, z),
      list = [];
    for (let dx = -TILE_RADIUS; dx <= TILE_RADIUS; dx++)
      for (let dz = -TILE_RADIUS; dz <= TILE_RADIUS; dz++) list.push([tx + dx, tz + dz]);
    list.sort(
      (a, b) =>
        Math.hypot(a[0] * TILE_SIZE - x, a[1] * TILE_SIZE - z) -
        Math.hypot(b[0] * TILE_SIZE - x, b[1] * TILE_SIZE - z),
    );
    return list;
  }
  async prepare(x, z, onProgress = () => {}) {
    const list = this.needed(x, z);
    for (let i = 0; i < list.length; i++) {
      const [tx, tz] = list[i],
        key = `${tx},${tz}`;
      if (!this.tiles.has(key)) this.tiles.set(key, this.makeTile(tx, tz));
      onProgress(i + 1, list.length);
      await new Promise((r) => setTimeout(r, 0));
    }
    this.prune(new Set(list.map((p) => p.join(","))));
    this.traffic.update(x, z, this.elapsed);
    this.clouds.update(x, z, 0);
  }
  prune(keep) {
    for (const [key, tile] of this.tiles)
      if (!keep.has(key)) {
        this.scene.remove(tile.group);
        tile.ground.geometry.dispose();
        tile.crops.geometry.dispose();
        tile.roads.geometry.dispose();
        tile.pondMesh?.geometry.dispose();
        tile.group.traverse((o) => {
          if (o.isInstancedMesh) o.dispose();
        });
        this.tiles.delete(key);
      }
  }
  setQuality(value) {
    this.quality = value;
    this.clouds.setQuality(value);
  }

  update(x, z, dt) {
    this.elapsed += dt;
    this.safetyGround.position.set(x, -0.08, z);
    const list = this.needed(x, z),
      keep = new Set(list.map((p) => p.join(",")));
    // A tile's nearest edge is outside the fully opaque fog when it is created.
    for (const [tx, tz] of list) {
      const key = `${tx},${tz}`;
      if (!this.tiles.has(key)) {
        this.tiles.set(key, this.makeTile(tx, tz));
        break;
      }
    }
    this.prune(keep);
    const fogFar = (this.scene.fog?.far || 3300) + 200;
    const detailRange = this.quality === "low" ? 900 : this.quality === "high" ? 2400 : 1500;
    for (const tile of this.tiles.values()) {
      const gap = Math.hypot(
        Math.max(0, Math.abs(tile.tx * TILE_SIZE - x) - HALF),
        Math.max(0, Math.abs(tile.tz * TILE_SIZE - z) - HALF),
      );
      tile.group.visible = gap < fogFar;
      tile.detail.visible = gap < detailRange;
      if (!tile.group.visible || dt === 0) continue;
      for (const b of tile.balloons) {
        const y = b.baseY + Math.sin(this.elapsed * 0.35 + b.phase) * 5;
        b.mesh.position.y = y;
        b.sphere.y = y + 18;
      }
      if (tile.rotors && gap < 1800) this.spinRotors(tile.rotors, this.elapsed * 1.6);
    }
    this.traffic.update(x, z, this.elapsed);
    this.clouds.update(x, z, dt);
  }

  collision(x, y, z) {
    const [tx, tz] = tileCoordinates(x, z);
    const tile = this.tiles.get(`${tx},${tz}`);
    if (!tile) return false;
    if (tile.colliders.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && y <= b.height))
      return true;
    return tile.spheres.some((s) => Math.hypot(x - s.x, y - s.y, z - s.z) < s.r);
  }
  collisionName(x, y, z) {
    const [tx, tz] = tileCoordinates(x, z);
    const tile = this.tiles.get(`${tx},${tz}`);
    if (tile?.spheres.some((s) => Math.hypot(x - s.x, y - s.y, z - s.z) < s.r)) return "a hot-air balloon";
    if (
      tile?.colliders.some(
        (b) => b.height === 100 && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ,
      )
    )
      return "a wind turbine";
    return "a building";
  }

  // landmarks near a point, nearest first
  landmarksNear(x, z, maxDistance = 6000) {
    const out = [];
    for (const tile of this.tiles.values())
      for (const l of tile.landmarks) {
        const d = Math.hypot(l.x - x, l.z - z);
        if (d <= maxDistance)
          out.push({
            ...l,
            y: l.ref ? l.ref.y : l.y,
            key: `${l.type}@${Math.round(l.x)},${Math.round(l.z)}`,
            distance: d,
          });
      }
    return out.sort((a, b) => a.distance - b.distance);
  }

  cloudDensityAt(x, y, z) {
    return this.clouds.densityAt(x, y, z);
  }
}

function sign(v) {
  return v < 0 ? -1 : 1;
}
function box(x, z, half, height) {
  return { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half, height };
}

function fieldGeometry({ p, c, uv }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const n = new Float32Array(p.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  geo.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  return geo;
}

// Road strips along the tile's local Z and X axes, split wherever an airport
// sits on the road. Each strip is 20 m wide; the texture repeats every 20 m.
function roadGeometry(isReserved) {
  const geos = [];
  let hasZ = false,
    hasX = false;
  for (const axis of ["z", "x"]) {
    let start = null;
    const flush = (end) => {
      if (start === null) return;
      const length = end - start,
        mid = (start + end) / 2;
      const g = new THREE.PlaneGeometry(20, length, 1, 1).rotateX(-Math.PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * length) / 20);
      if (axis === "x") g.rotateY(Math.PI / 2);
      g.translate(axis === "z" ? 0 : mid, 0.08, axis === "z" ? mid : 0);
      geos.push(g);
      if (axis === "z") hasZ = true;
      else hasX = true;
      start = null;
    };
    for (let d = -HALF; d < HALF; d += 20) {
      const open = axis === "z" ? !isReserved(0, d + 10, 20) : !isReserved(d + 10, 0, 20);
      if (open && start === null) start = d;
      if (!open) flush(d);
    }
    flush(HALF);
  }
  const geometry = geos.length ? mergeGeometries(geos, false) : new THREE.BufferGeometry();
  return { geometry, hasZ, hasX };
}

function pondGeometry(ponds, rng) {
  const geos = ponds.map(([x, z, r]) => {
    const g = new THREE.CircleGeometry(r, 14),
      pos = g.attributes.position;
    for (let i = 1; i < pos.count; i++) {
      const k = 0.82 + rng() * 0.3;
      pos.setXY(i, pos.getX(i) * k, pos.getY(i) * k);
    }
    return g.rotateX(-Math.PI / 2).translate(x, 0.14, z);
  });
  return geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
}

function staticInstances(geometry, material, list) {
  const mesh = new THREE.InstancedMesh(geometry, material, list.length);
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    p = new THREE.Vector3(),
    s = new THREE.Vector3(1, 1, 1);
  list.forEach(([x, z, r = 0], i) => {
    q.setFromAxisAngle(up, r);
    p.set(x, 0, z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// Geometry helpers: simple low-poly shapes with baked colors, merged so each
// landmark draws in one call.
function painted(geo, hex) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex),
    arr = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = c.r;
    arr[i + 1] = c.g;
    arr[i + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  if (geo.attributes.uv) geo.deleteAttribute("uv");
  return geo;
}
function merge(list) {
  return mergeGeometries(
    list.map(([g, c]) => painted(g, c)),
    false,
  );
}

function balloonGeometry([a, b]) {
  const profile = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12,
      y = t * 30;
    const r =
      t < 0.72
        ? Math.sin((t / 0.72) * Math.PI * 0.5 + 0.18) * 14
        : Math.cos(((t - 0.72) / 0.28) * Math.PI * 0.5) * 14;
    profile.push(new THREE.Vector2(Math.max(r, t > 0.95 ? 0 : 2.2), y));
  }
  const env = new THREE.LatheGeometry(profile, 16).toNonIndexed();
  // Stripes: color each vertical gore by its angle around the balloon.
  const pos = env.attributes.position,
    colors = new Float32Array(pos.count * 3),
    ca = new THREE.Color(a),
    cb = new THREE.Color(b);
  for (let i = 0; i < pos.count; i += 3) {
    const mx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
      mz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const gore = Math.floor(((Math.atan2(mz, mx) + Math.PI) / (Math.PI * 2)) * 16);
    const c = gore % 2 ? ca : cb;
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  env.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  env.deleteAttribute("uv");
  env.translate(0, 8, 0);
  const basket = painted(new THREE.BoxGeometry(3.4, 2.6, 3.4).translate(0, 1.3, 0), 0x8a5a33);
  const ropes = [
    [-1.5, -1.5],
    [1.5, -1.5],
    [-1.5, 1.5],
    [1.5, 1.5],
  ].map(([x, z]) => painted(new THREE.CylinderGeometry(0.12, 0.12, 6, 4).translate(x, 5.4, z), 0x5a4632));
  return mergeGeometries([env, basket, ...ropes], false);
}

function turbineTowerGeometry() {
  return merge([
    [new THREE.CylinderGeometry(1.1, 2.0, 72, 8).translate(0, 36, 0), 0xf4f6f7],
    [new THREE.BoxGeometry(7, 3.4, 3.2).translate(0.8, 72, 0), 0xe9ecee],
  ]);
}
function turbineRotorGeometry() {
  const parts = [[new THREE.SphereGeometry(1.7, 8, 6), 0xf4f6f7]];
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.BoxGeometry(0.5, 30, 1.8).translate(0, 16, 0).rotateX((i * Math.PI * 2) / 3);
    parts.push([blade, 0xf7f8f9]);
  }
  // A red tip on one blade makes the spin easy to see.
  parts.push([new THREE.BoxGeometry(0.55, 4, 1.9).translate(0, 29, 0), 0xe4572e]);
  return merge(parts);
}
function farmGeometry() {
  const roof = new THREE.CylinderGeometry(0.01, 22, 12, 4, 1)
    .rotateY(Math.PI / 4)
    .scale(1, 1, 0.8)
    .translate(0, 25, 0);
  return merge([
    [new THREE.BoxGeometry(32, 19, 25).translate(0, 9.5, 0), 0xc2412d],
    [roof, 0x5b4f4a],
    [new THREE.BoxGeometry(10, 10, 0.6).translate(0, 5, 12.7), 0xf3ede2],
    [new THREE.CylinderGeometry(6, 6, 30, 10).translate(26, 15, 4), 0xd9d4c7],
    [new THREE.SphereGeometry(6, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(26, 30, 4), 0x9aa3a8],
  ]);
}
function waterTowerGeometry(color) {
  const parts = [];
  for (const [x, z] of [
    [-6, -6],
    [6, -6],
    [-6, 6],
    [6, 6],
  ])
    parts.push([new THREE.CylinderGeometry(0.7, 0.9, 40, 5).translate(x, 20, z), 0x8d99a6]);
  parts.push([new THREE.CylinderGeometry(11, 11, 12, 16).translate(0, 46, 0), color]);
  parts.push([new THREE.CylinderGeometry(11.4, 11.4, 1.6, 16).translate(0, 44, 0), 0xffffff]);
  parts.push([new THREE.ConeGeometry(12, 6, 16).translate(0, 55, 0), 0x6b7682]);
  return merge(parts);
}

// Cars and trucks drive both ways on every road. One instanced mesh per
// vehicle model draws all of them, so traffic costs a handful of draw calls.
class Traffic {
  constructor(world) {
    this.world = world;
    this.meshes = new Map();
    const scene = world.scene;
    for (const [key, , length] of VEHICLES) {
      if (!world.models[key]) continue;
      const parts = world.modelParts(key, length);
      const list = parts.map((part) => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, 160);
        mesh.count = 0;
        mesh.frustumCulled = false;
        scene.add(mesh);
        return mesh;
      });
      this.meshes.set(key, list);
    }
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
    this.up = new THREE.Vector3(0, 1, 0);
  }
  planTile(rng, hasZ, hasX) {
    const cars = [];
    for (const axis of ["z", "x"]) {
      if ((axis === "z" && !hasZ) || (axis === "x" && !hasX)) continue;
      for (let k = 0; k < 6; k++) {
        let r = rng(),
          type = VEHICLES[0][0];
        for (const [key, weight] of VEHICLES) {
          if (r < weight) {
            type = key;
            break;
          }
          r -= weight;
        }
        cars.push({ axis, dir: k % 2 ? 1 : -1, phase: rng() * TILE_SIZE, speed: 10 + rng() * 8, type });
      }
    }
    return cars;
  }
  update(x, z, time) {
    if (!this.meshes.size) return;
    const counts = new Map([...this.meshes.keys()].map((k) => [k, 0]));
    const range = this.world.quality === "low" ? 1700 : 2600;
    for (const tile of this.world.tiles.values()) {
      const tcx = tile.tx * TILE_SIZE,
        tcz = tile.tz * TILE_SIZE;
      if (Math.hypot(tcx - x, tcz - z) > range) continue;
      for (const car of tile.traffic) {
        const list = this.meshes.get(car.type);
        if (!list) continue;
        const n = counts.get(car.type);
        if (n >= 160) continue;
        const s = ((((car.phase + car.dir * car.speed * time) % TILE_SIZE) + TILE_SIZE) % TILE_SIZE) - HALF;
        const lane = car.axis === "z" ? -car.dir * 4.5 : car.dir * 4.5;
        const wx = tcx + (car.axis === "z" ? lane : s),
          wz = tcz + (car.axis === "z" ? s : lane);
        if (reserved(wx, wz, 14)) continue;
        const yaw = car.axis === "z" ? (car.dir > 0 ? 0 : Math.PI) : car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.q.setFromAxisAngle(this.up, yaw);
        this.p.set(wx, 0.49, wz);
        this.m.compose(this.p, this.q, this.s);
        for (const mesh of list) mesh.setMatrixAt(n, this.m);
        counts.set(car.type, n + 1);
      }
    }
    for (const [key, list] of this.meshes)
      for (const mesh of list) {
        mesh.count = counts.get(key);
        mesh.instanceMatrix.needsUpdate = true;
      }
  }
}

// Puffy clouds drift slowly with the wind. Clouds are placed in a grid of
// cells that moves with the wind, so the same sky comes back if you return.
class CloudLayer {
  constructor(world) {
    this.world = world;
    this.cell = 1100;
    this.radius = 3;
    this.capacity = 260;
    this.wind = new THREE.Vector2(3.2, 1.1);
    this.time = 0;
    this.puffs = [];
    const material = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0xc4d3e2,
      emissiveIntensity: 0.55,
    });
    const parts = world.models.cloud
      ? world.modelParts("cloud", 2)
      : [{ geometry: new THREE.IcosahedronGeometry(1, 1).translate(0, 1, 0) }];
    this.mesh = new THREE.InstancedMesh(parts[0].geometry, material, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    world.scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.e = new THREE.Euler();
  }
  setQuality(value) {
    this.radius = value === "low" ? 2 : 3;
  }
  update(x, z, dt) {
    this.time += dt;
    const ox = this.wind.x * this.time,
      oz = this.wind.y * this.time;
    const bx = Math.floor((x - ox) / this.cell),
      bz = Math.floor((z - oz) / this.cell);
    this.puffs.length = 0;
    let n = 0;
    for (let i = -this.radius; i <= this.radius; i++)
      for (let j = -this.radius; j <= this.radius; j++) {
        const cx = bx + i,
          cz = bz + j,
          rng = randomFor(cx * 7 + 3, cz * 13 - 5);
        if (rng() > 0.52) continue;
        const centerX = (cx + rng()) * this.cell + ox,
          centerZ = (cz + rng()) * this.cell + oz;
        const baseY = 230 + rng() * 210,
          count = 3 + Math.floor(rng() * 4),
          size = 0.8 + rng() * 0.6;
        for (let k = 0; k < count && n < this.capacity; k++) {
          const px = centerX + (rng() - 0.5) * 140 * size,
            pz = centerZ + (rng() - 0.5) * 80 * size,
            py = baseY + (rng() - 0.3) * 22;
          const scale = (30 + rng() * 26) * size;
          this.e.set(0, rng() * 6.28, 0);
          this.q.setFromEuler(this.e);
          this.p.set(px, py, pz);
          this.s.set(scale, scale * 0.7, scale);
          this.m.compose(this.p, this.q, this.s);
          this.mesh.setMatrixAt(n++, this.m);
          this.puffs.push(px, py + scale * 0.55, pz, scale * 0.95, scale * 0.6);
        }
      }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // 0 = clear air, 1 = deep inside a cloud.
  densityAt(x, y, z) {
    let best = 0;
    const p = this.puffs;
    for (let i = 0; i < p.length; i += 5) {
      const dx = (x - p[i]) / p[i + 3],
        dy = (y - p[i + 1]) / p[i + 4],
        dz = (z - p[i + 2]) / p[i + 3];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < 1) best = Math.max(best, 1 - d);
    }
    return best;
  }
}
