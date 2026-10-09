import * as THREE from "three";
import { isLand, port, spawn, type World, type Position, type Node } from "./engine";

export type IslandView = {
  world: World;
  country: string;
  positions: Record<string, Position>;
  uid?: string;
  origin: boolean;
  selected?: Position | null;
  mining?: { node: string; actor: string } | null;
  firstPerson?: { yaw: number; pitch: number };
};
export type IslandRenderer = {
  draw: (view: IslandView, time: number) => void;
  pick: (x: number, y: number) => Position | null;
  dispose: () => void;
};

const SEA = "#b9e3e6";
const TOP = 0.12;
const noise = (x: number, y: number) => Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;

/** Fixed camera and procedural assets keep every island usable without a download or drag gesture. */
export function createIslandRenderer(canvas: HTMLCanvasElement, initial: IslandView, mini: boolean): IslandRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setClearColor(SEA);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mini ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !mini;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SEA);
  const camera = new THREE.OrthographicCamera(-15, 15, 10, -10, .1, 150);
  const width = initial.world.config.map.width, height = initial.world.config.map.height;
  const center = new THREE.Vector3(width / 2, 0, height / 2);
  const playerCamera = new THREE.PerspectiveCamera(72, 1, .045, 110);
  playerCamera.rotation.order = "YXZ"; scene.add(playerCamera);
  let activeCamera: THREE.Camera = camera;
  camera.position.copy(center).add(new THREE.Vector3(23, 27, 30));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight("#fff8ed", "#688c8b", 2.1));
  const sun = new THREE.DirectionalLight("#fff5e6", 2.5);
  sun.position.set(-8, 24, 5);
  sun.target.position.copy(center);
  sun.castShadow = !mini;
  sun.shadow.mapSize.set(512, 512);
  Object.assign(sun.shadow.camera, { left: -23, right: 23, top: 23, bottom: -23, near: 1, far: 65 });
  sun.shadow.normalBias = .05;
  sun.shadow.bias = -.0004;
  scene.add(sun, sun.target);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const spriteMaterials = new Set<THREE.SpriteMaterial>();
  const basicMaterials = new Set<THREE.Material>();
  const geometry = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const rock = geometry(new THREE.IcosahedronGeometry(1, 0));
  const cone = geometry(new THREE.ConeGeometry(1, 1, 5));
  const cylinder = geometry(new THREE.CylinderGeometry(1, 1, 1, 8));
  const mat = (color: string, opacity = 1) => {
    const key = `${color}:${opacity}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .92, flatShading: true, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }));
    return materials.get(key)!;
  };
  function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, opacity = 1) {
    const m = new THREE.Mesh(geo, mat(color, opacity));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = !mini; m.receiveShadow = true; parent.add(m); return m;
  }
  const box = (p: THREE.Object3D, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, opacity = 1) => mesh(p, cube, color, x, y, z, sx, sy, sz, opacity);
  const heldTool = new THREE.Group(); playerCamera.add(heldTool);
  heldTool.position.set(.34, -.35, -.63); heldTool.rotation.z = -.24;
  box(heldTool, "#edc7a4", 0, -.12, .04, .14, .27, .15);
  box(heldTool, "#99714c", 0, .13, 0, .055, .53, .055);
  box(heldTool, "#bed0d4", 0, .39, 0, .4, .09, .09);
  box(heldTool, "#7e999f", -.17, .34, 0, .06, .13, .09);
  heldTool.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = new THREE.MeshBasicMaterial({ color: (o.material as THREE.MeshStandardMaterial).color, depthTest: false, depthWrite: false });
    basicMaterials.add(material); o.material = material; o.renderOrder = 30; o.castShadow = false;
  });
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < 12; i++) {
    const x = -30 + noise(i, 41) * 85, z = -35 + noise(i, 52) * 85;
    box(clouds, "#f6f9ee", x, 10 + noise(i, 61) * 4, z, 3 + noise(i, 71) * 4, .6, 2.3);
  }
  function label(parent: THREE.Object3D, text: string, x: number, y: number, z: number, accent = "#426450", size = .42) {
    if (mini) return;
    const c = document.createElement("canvas"), ctx = c.getContext("2d")!;
    ctx.font = "600 28px sans-serif";
    c.width = Math.ceil(ctx.measureText(text).width + 32); c.height = 52;
    ctx.fillStyle = "rgba(255,255,246,.96)";
    ctx.beginPath(); ctx.roundRect(0, 0, c.width, c.height, 15); ctx.fill();
    ctx.font = "600 28px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = accent; ctx.fillText(text, c.width / 2, 26);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }); spriteMaterials.add(material);
    const sprite = new THREE.Sprite(material); sprite.position.set(x, y, z); sprite.scale.set(size * c.width / c.height, size, 1); sprite.renderOrder = 5;
    parent.add(sprite);
  }
  function clear(group: THREE.Group) {
    group.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) { o.material.dispose(); basicMaterials.delete(o.material); }
      if (o instanceof THREE.Sprite) {
        o.material.map?.dispose(); if (o.material.map) textures.delete(o.material.map);
        o.material.dispose(); spriteMaterials.delete(o.material);
      }
    });
    group.clear();
  }
  const spec = initial.world.config.countries.find((c: any) => c.id === initial.country);
  const biome = spec?.biome || "";
  const desert = biome.includes("사막"), forest = biome.includes("숲");
  const landColor = desert ? "#e5c58c" : forest ? "#7fac82" : "#a8c989";
  const terrain = new THREE.Group(); scene.add(terrain);
  const cells: Position[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (isLand(initial.world, x, y)) cells.push({ x, y });
  function tileLayer(y: number, thickness: number, color: string, expansion: number, vary: boolean) {
    const tiles = new THREE.InstancedMesh(cube, mat(color), cells.length);
    const matrix = new THREE.Matrix4(), colorValue = new THREE.Color(color);
    cells.forEach((p, i) => {
      const edge = !isLand(initial.world, p.x - 1, p.y) || !isLand(initial.world, p.x + 1, p.y) || !isLand(initial.world, p.x, p.y - 1) || !isLand(initial.world, p.x, p.y + 1);
      const spread = expansion > 0 && edge ? expansion * (.75 + noise(p.x, p.y) * 1.4) : expansion;
      matrix.compose(new THREE.Vector3(p.x + .5, y, p.y + .5), new THREE.Quaternion(), new THREE.Vector3(1 + spread, thickness, 1 + spread));
      tiles.setMatrixAt(i, matrix);
      if (vary) tiles.setColorAt(i, colorValue.clone().offsetHSL(0, 0, (noise(p.x, p.y) - .5) * .075));
    });
    tiles.receiveShadow = true; tiles.castShadow = !mini; terrain.add(tiles);
  }
  tileLayer(-.67, .54, "#8faaa0", .72, true);
  tileLayer(-.35, .42, "#dbbd86", .43, true);
  tileLayer(-.055, .35, landColor, 0, true);
  const ocean = box(terrain, "#addde0", width / 2, -.96, height / 2, width * 4, .08, height * 4);
  const oceanMaterial = new THREE.MeshBasicMaterial({ color: SEA }); basicMaterials.add(oceanMaterial);
  ocean.material = oceanMaterial as unknown as THREE.MeshStandardMaterial; ocean.castShadow = false;
  if (!mini) {
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: .16 }); basicMaterials.add(shadowMaterial);
    const shadow = new THREE.Mesh(cube, shadowMaterial); shadow.position.copy(ocean.position); shadow.position.y += .005; shadow.scale.copy(ocean.scale); shadow.receiveShadow = true; terrain.add(shadow);
  }
  // Uneven sand shelves and low tide rocks soften the grid silhouette; playable cells stay unchanged.
  for (let i = 0; i < width - 4; i++) {
    const x = i + 2.5, z = height - 2 + noise(i, 2) * .35;
    mesh(terrain, rock, i % 3 ? "#d7c392" : "#a3b8ad", x, -.48, z, .36 + noise(i, 7) * .3, .24 + noise(i, 9) * .2, .34);
  }
  for (let i = 0; i < height - 5; i++) {
    mesh(terrain, rock, "#c3bea1", width - 2 + noise(i, 3) * .35, -.42, i + 2.8, .35, .27, .38 + noise(i, 5) * .2);
  }
  // Small, deliberate paths make the resource patches, workshops, and construction district readable.
  for (const p of cells) {
    if (p.y === 9 || p.x === 9 || (p.y === 5 && p.x < 10)) {
      box(terrain, desert ? "#efd7a7" : "#cad2a0", p.x + .5, TOP + .008, p.y + .5, .97, .018, .97);
      if ((p.x + p.y) % 3 === 0) box(terrain, "#e0dcc0", p.x + .3, TOP + .03, p.y + .4, .24, .035, .16);
    } else if (noise(p.x, p.y) > .65) {
      box(terrain, desert ? "#cbaa70" : "#77a46e", p.x + .73, TOP + .045, p.y + .78, .045, .1, .045);
      box(terrain, desert ? "#f2daa6" : "#d4dea0", p.x + .64, TOP + .028, p.y + .72, .1, .05, .08);
    }
  }
  const seaDetails = new THREE.Group(); scene.add(seaDetails);
  for (let i = 0; i < 35; i++) {
    const x = noise(i, 11) * (width + 5) - 2.5, z = noise(i, 27) * (height + 4) - 2;
    if (!isLand(initial.world, Math.floor(x), Math.floor(z))) {
      box(seaDetails, "#e0f5ee", x, -.76, z, .28 + noise(i, 0) * .55, .022, .065, .72);
    }
  }
  // Flowers, small rocks and palms at the unoccupied edges distinguish the three biomes.
  for (let x = 3; x < width - 3; x += 2) {
    const z = height - 2.35;
    if (desert && x % 4 === 3) {
      box(terrain, "#a08558", x + .25, .7, z, .14, 1.15, .14);
      for (let k = 0; k < 4; k++) {
        const leaf = box(terrain, "#82a66a", x + .25, 1.24, z, 1.05, .12, .22);
        leaf.rotation.y = k * Math.PI / 2; leaf.rotation.z = .15;
      }
    } else if (forest && x % 4 === 3) {
      box(terrain, "#8f7351", x + .3, .52, z, .14, .8, .14);
      mesh(terrain, cone, "#4f8c70", x + .3, 1.1, z, .49, 1.3, .49);
    } else {
      mesh(terrain, rock, desert ? "#cbac7c" : "#bcc5a8", x + .3, .23, z, .23, .18, .2);
    }
  }
  // Merge static detail into instanced batches, preserving model raycasts and animated resource groups.
  function batchStatic(group: THREE.Group) {
    const batches = new Map<string, THREE.Mesh[]>();
    for (const child of [...group.children]) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || !(child.material instanceof THREE.MeshStandardMaterial) || child.material.transparent) continue;
      const key = `${child.geometry.uuid}:${child.material.uuid}:${child.castShadow}:${child.receiveShadow}`;
      const batch = batches.get(key) || []; batch.push(child); batches.set(key, batch);
    }
    for (const batch of batches.values()) {
      if (batch.length < 2) continue;
      const first = batch[0], instanced = new THREE.InstancedMesh(first.geometry, first.material, batch.length);
      instanced.castShadow = first.castShadow; instanced.receiveShadow = first.receiveShadow;
      batch.forEach((child, i) => { child.updateMatrix(); instanced.setMatrixAt(i, child.matrix); group.remove(child); });
      group.add(instanced);
    }
  }
  batchStatic(terrain);
  if (seaDetails.children.length) {
    const waves = seaDetails.children as THREE.Mesh[], first = waves[0];
    const ripples = new THREE.InstancedMesh(first.geometry, first.material, waves.length);
    waves.forEach((wave, i) => { wave.updateMatrix(); ripples.setMatrixAt(i, wave.matrix); });
    seaDetails.clear(); seaDetails.add(ripples);
  }
  const objects = new THREE.Group(), sites = new THREE.Group(), facilities = new THREE.Group(), avatars = new THREE.Group(), effects = new THREE.Group();
  scene.add(objects, sites, facilities, avatars, effects);
  function atTile(p: Position, parent: THREE.Group) {
    const group = new THREE.Group(); group.position.set(p.x + .5, TOP, p.y + .5); group.userData.tile = { x: p.x, y: p.y }; parent.add(group); return group;
  }
  const nodeModels = new Map<string, THREE.Group>();
  function resource(n: Node) {
    const g = atTile(n, objects); nodeModels.set(n.id, g);
    if (n.good === "wood") {
      box(g, "#8c6848", 0, .45, 0, .21, .9, .21);
      mesh(g, cone, "#45846a", 0, .89, 0, .53, .94, .53);
      mesh(g, cone, "#69a57c", 0, 1.31, 0, .4, .8, .4);
      mesh(g, cone, "#8bb988", 0, 1.6, 0, .27, .6, .27);
    } else if (n.good === "cotton") {
      box(g, "#69864b", 0, .22, 0, .08, .44, .08);
      for (let k = 0; k < 3; k++) {
        const a = k * 2.094;
        mesh(g, rock, "#fffbec", Math.cos(a) * .19, .39 + k * .07, Math.sin(a) * .19, .22, .22, .22);
      }
      box(g, "#8ea46a", -.15, .19, .08, .32, .07, .16);
    } else if (n.good === "oil") {
      mesh(g, cylinder, "#374552", 0, .24, .1, .23, .44, .23);
      box(g, "#dcad67", 0, .27, .1, .47, .07, .43);
      box(g, "#59676c", .16, .58, -.13, .09, .94, .1);
      const beam = box(g, "#d49d55", .06, .93, -.13, .71, .11, .13); beam.rotation.z = -.27;
      box(g, "#525f67", -.26, .63, -.13, .035, .57, .035);
    } else if (n.good === "sand") {
      mesh(g, rock, "#f4d893", -.12, .14, .03, .4, .25, .34);
      mesh(g, rock, "#ffe6ab", .19, .16, -.06, .25, .3, .25);
      box(g, "#be9a5c", .1, .08, .31, .15, .07, .11);
    } else {
      mesh(g, rock, n.good === "iron" ? "#777c7a" : "#97a9ac", -.08, .31, 0, .43, .44, .38).rotation.y = .4;
      mesh(g, rock, n.good === "iron" ? "#ad8c70" : "#bdc6be", .26, .18, .18, .24, .26, .24);
      if (n.good === "iron") {
        box(g, "#e4b186", -.14, .57, .08, .16, .09, .13);
        box(g, "#c48a60", -.35, .33, .1, .09, .15, .15);
      }
    }
  }
  function facility(name: string, p: Position, w: World) {
    const g = atTile(p, facilities);
    box(g, "#d5bd92", 0, .05, 0, .94, .1, .88);
    if (name === "bench" || name === "loom") {
      for (const x of [-.32, .32]) for (const z of [-.24, .24]) box(g, "#8c6950", x, .26, z, .09, .5, .09);
      box(g, "#c99961", 0, .49, 0, .86, .13, .68);
      if (name === "loom") {
        for (const x of [-.31, .31]) box(g, "#8c6950", x, .88, -.1, .08, .85, .08);
        box(g, "#c2d8dc", 0, .86, -.08, .5, .62, .055);
        box(g, "#cf949c", 0, .83, -.035, .5, .12, .035);
        box(g, "#8c6950", 0, 1.28, -.1, .78, .08, .12);
      } else {
        box(g, "#dfb47e", 0, .64, -.05, .58, .16, .24);
        box(g, "#71828b", .17, .76, .12, .3, .06, .12);
      }
    } else {
      box(g, name === "furnace" ? "#7f8d8e" : "#c99a78", 0, .47, 0, .78, .84, .68);
      box(g, "#596a71", .19, 1.04, -.17, .21, .59, .24);
      box(g, "#e2c5a0", 0, .89, 0, .87, .11, .76);
      box(g, "#594b49", 0, .35, .348, .36, .4, .025);
      box(g, "#f2ae61", 0, .29, .365, .24, .18, .03);
      box(g, "#ffde8c", .02, .31, .386, .1, .17, .025);
    }
    label(g, w.config.facilities[name], 0, 1.64, 0, "#59645b", .36);
  }
  function harbor(w: World) {
    const p = port(w), g = atTile(p, facilities);
    for (let i = 0; i < 9; i++) box(g, i % 2 ? "#bd936a" : "#d2ae80", .12 + i * .19, -.06, 0, .165, .14, .83);
    for (const x of [0, 1.57]) for (const z of [-.34, .34]) box(g, "#896f55", x, -.23, z, .11, .62, .11);
    box(g, "#fff6d6", .03, .56, -.3, .045, 1.22, .045);
    box(g, spec.color, .28, 1.02, -.3, .46, .29, .035);
    label(g, "항구", .55, 1.52, 0, "#48727b", .42);
    const boat = new THREE.Group(); boat.position.set(1.38, -.54, 1.14); g.add(boat); boat.name = "boat";
    mesh(boat, cylinder, "#916d51", 0, 0, 0, .34, .22, .76).rotation.y = .2;
    box(boat, "#eee1b5", 0, .15, 0, .52, .1, 1.05);
    box(boat, "#82694e", 0, .66, 0, .045, 1, .045);
    box(boat, "#fff9e7", .22, .78, 0, .46, .64, .025);
    box(boat, spec.color, .22, .59, .018, .46, .14, .025);
  }
  const builtModels = new Map<string, THREE.Group>();
  function building(w: World, origin: boolean) {
    clear(sites); builtModels.clear();
    const all = Object.values(w.countries[initial.country].sites);
    if (!all.length) return;
    const xs = all.map(s => s.x), ys = all.map(s => s.y), minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
    box(sites, "#dae2cc", (minX + maxX + 1) / 2, TOP + .015, (minY + maxY + 1) / 2, maxX - minX + 1.18, .045, maxY - minY + 1.18);
    for (const s of all) {
      const g = atTile(s, sites);
      if (!s.unit) {
        box(g, "#eaf2df", 0, .09, 0, .86, .13, .86, .65);
        for (const x of [-.41, .41]) box(g, "#fcfff1", x, .2, 0, .035, .25, .85, .8);
        for (const z of [-.41, .41]) box(g, "#fcfff1", 0, .2, z, .85, .25, .035, .8);
        box(g, w.config.goods[s.good].color, 0, .17, 0, .24, .025, .24, .65);
      } else {
        builtModels.set(s.id, g);
        const sources = Object.keys(s.unit.sources), base = w.config.goods[s.good].color;
        box(g, "#a7977c", 0, .11, 0, .91, .17, .91);
        box(g, origin ? "#f0ede0" : base, 0, .44, 0, .86, .56, .86);
        box(g, "#f3e4c7", 0, .76, 0, .93, .12, .93);
        if (s.good === "glass") box(g, "#b9e6e4", 0, .47, .442, .61, .36, .025, .8);
        if (s.good === "plank") for (let k = 0; k < 3; k++) box(g, "#ad8158", 0, .3 + k * .16, .442, .78, .028, .026);
        if (origin) sources.forEach((id, i) => {
          const color = w.config.countries.find((c: any) => c.id === id)?.color || "#fff";
          box(g, color, -.43 + (i + .5) * .86 / sources.length, .47, .444, .86 / sources.length, .48, .025);
          box(g, color, -.43 + (i + .5) * .86 / sources.length, .829, 0, .86 / sources.length, .02, .85);
        });
      }
    }
    label(sites, spec.building.name, (minX + maxX + 1) / 2, 1.7, minY - .2, "#657b64", .43);
    if (all.every(s => s.unit)) {
      // A finished landmark crowns the contributed blocks without hiding their provenance.
      const cx = (minX + maxX + 1) / 2, cz = (minY + maxY + 1) / 2;
      if (desert) {
        box(sites, "#fff0cf", cx, 1.09, cz, 2.4, .5, 1.7);
        mesh(sites, cone, "#c88f6f", cx, 1.62, cz, 1.8, .68, 1.3).rotation.y = Math.PI / 4;
      } else if (forest) {
        box(sites, "#f6f4df", cx, 1.15, cz, 2.35, .65, 1.65);
        box(sites, "#83b9ac", cx, 1.54, cz, 2.55, .16, 1.9);
        box(sites, "#d37f6f", cx, 1.18, cz + .838, .44, .13, .025);
        box(sites, "#d37f6f", cx, 1.18, cz + .854, .13, .44, .025);
      } else {
        for (const x of [minX + .5, maxX + .5]) box(sites, "#d7d2bb", x, 1.2, cz, .27, 1.25, .3);
        box(sites, "#e9dcbe", cx, 1.71, cz, maxX - minX + 1.1, .16, .44);
      }
    }
  }
  const avatarModels = new Map<string, THREE.Group>();
  function avatar(id: string, view: IslandView) {
    const p = view.world.players[id], own = id === view.uid, g = new THREE.Group(); avatars.add(g); avatarModels.set(id, g);
    box(g, "#435c62", -.09, .1, 0, .115, .2, .16); box(g, "#435c62", .09, .1, 0, .115, .2, .16);
    box(g, own ? "#577fac" : spec.color, 0, .32, 0, .32, .3, .22);
    box(g, "#efcaa4", 0, .59, 0, .28, .26, .26);
    box(g, own ? "#426381" : "#775b44", 0, .74, -.01, .33, .08, .3);
    box(g, "#334754", -.065, .61, .136, .033, .035, .012); box(g, "#334754", .065, .61, .136, .033, .035, .012);
    const arm = box(g, "#efcaa4", .22, .37, 0, .11, .25, .13); arm.name = "arm";
    const tool = new THREE.Group(); tool.name = "tool"; tool.position.set(.27, .45, .05); tool.visible = false; g.add(tool);
    box(tool, "#99764b", 0, .14, 0, .045, .5, .045); box(tool, "#c6d3d5", 0, .39, 0, .32, .08, .075);
    if (own) {
      const ringMaterial = new THREE.MeshBasicMaterial({ color: "#fffbea", side: THREE.DoubleSide }); basicMaterials.add(ringMaterial);
      const ring = new THREE.Mesh(geometry(new THREE.RingGeometry(.3, .36, 24)), ringMaterial);
      ring.rotation.x = -Math.PI / 2; ring.position.y = .025; g.add(ring);
    }
    label(g, p.nickname, 0, 1.02, 0, own ? "#385f88" : "#53644f", .33);
    return g;
  }
  const selection = new THREE.Group(); scene.add(selection);
  for (const x of [-.46, .46]) box(selection, "#fffde1", x, .035, 0, .055, .035, .95);
  for (const z of [-.46, .46]) box(selection, "#fffde1", 0, .035, z, .95, .035, .055);
  const miningRing = new THREE.Group(); scene.add(miningRing);
  for (const x of [-.43, .43]) box(miningRing, "#ffcc6b", x, .055, 0, .055, .05, .92);
  for (const z of [-.43, .43]) box(miningRing, "#ffcc6b", 0, .055, z, .92, .05, .055);
  type Burst = { group: THREE.Group; started: number };
  const bursts: Burst[] = [];
  function burst(n: Node, time: number, w: World) {
    const g = atTile(n, effects);
    for (let i = 0; i < 9; i++) {
      const m = box(g, i % 3 ? w.config.goods[n.good].color : "#fff2b3", 0, .4, 0, .1, .1, .1);
      m.userData.velocity = new THREE.Vector3(Math.cos(i * 2.4) * .65, .7 + noise(i, n.x) * .8, Math.sin(i * 2.4) * .65);
    }
    label(g, `+1 ${w.config.goods[n.good].name}`, 0, 1.05, 0, "#426c42", .42);
    bursts.push({ group: g, started: time });
  }
  let nodesSignature = "", sitesSignature = "", facilitiesSignature = "", playersSignature = "", lastRound = initial.world.round;
  let previousNodes: Record<string, Node> = {};
  let currentView = initial, lastW = 0, lastH = 0, centersDirty = true;
  const raycaster = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), intersection = new THREE.Vector3();
  function setCenters(view: IslandView) {
    const centers: Record<string, [number, number]> = {};
    for (const p of cells) {
      const c = view.world.countries[view.country];
      const n = Object.values(c.nodes).find(n => n.x === p.x && n.y === p.y);
      const f = Object.values(c.facilities).find(f => f.x === p.x && f.y === p.y);
      const s = Object.values(c.sites).find(s => s.x === p.x && s.y === p.y);
      const elevation = n ? n.good === "wood" ? 1.05 : .35 : f ? .55 : s ? s.unit ? .45 : .15 : .04;
      const v = new THREE.Vector3(p.x + .5, TOP + elevation, p.y + .5).project(camera);
      centers[`${p.x},${p.y}`] = [(v.x + 1) / 2, (1 - v.y) / 2];
    }
    canvas.dataset.tileCenters = JSON.stringify(centers);
  }
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h; renderer.setSize(w, h, false);
    const bounds = new THREE.Box3();
    for (const x of [0, width + 1]) for (const z of [0, height]) for (const y of [-1, 2.4]) bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    const aspect = w / h, half = Math.max((bounds.max.y - bounds.min.y) / 2, (bounds.max.x - bounds.min.x) / (2 * aspect)) * 1.03;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
    playerCamera.aspect = aspect; playerCamera.updateProjectionMatrix(); centersDirty = true;
  }
  let disposed = false;
  return {
    draw(view, time) {
      if (disposed) return;
      currentView = view; resize();
      const w = view.world, c = w.countries[view.country];
      const ns = JSON.stringify(c.nodes);
      if (ns !== nodesSignature) {
        if (lastRound === w.round && nodesSignature) for (const n of Object.values(previousNodes)) if (!c.nodes[n.id]) burst(n, time, w);
        clear(objects); nodeModels.clear(); Object.values(c.nodes).forEach(resource);
        previousNodes = c.nodes; nodesSignature = ns; lastRound = w.round; centersDirty = true;
      }
      const ss = JSON.stringify(c.sites) + view.origin;
      if (ss !== sitesSignature) { building(w, view.origin); sitesSignature = ss; centersDirty = true; }
      const fs = JSON.stringify(c.facilities);
      if (fs !== facilitiesSignature) { clear(facilities); Object.entries(c.facilities).forEach(([name, p]) => facility(name, p, w)); harbor(w); facilitiesSignature = fs; centersDirty = true; }
      const ps = JSON.stringify(Object.values(w.players).filter(p => p.country === view.country).map(p => [p.id, p.nickname])) + view.uid;
      if (ps !== playersSignature) { clear(avatars); avatarModels.clear(); Object.values(w.players).filter(p => p.country === view.country).forEach(p => avatar(p.id, view)); playersSignature = ps; }
      for (const [id, g] of avatarModels) {
        g.visible = !(view.firstPerson && id === view.uid);
        const p = view.positions[id] || spawn(w, id), tx = p.x + .5, tz = p.y + .5;
        if (!g.userData.placed) { g.position.set(tx, TOP, tz); g.userData.placed = true; }
        const moving = Math.abs(g.position.x - tx) + Math.abs(g.position.z - tz) > .025;
        if (moving) { g.rotation.y = Math.atan2(tx - g.position.x, tz - g.position.z); g.position.x += (tx - g.position.x) * .36; g.position.z += (tz - g.position.z) * .36; }
        g.position.y = TOP + (moving ? Math.abs(Math.sin(time * .015)) * .065 : 0);
        const mining = view.mining?.actor === id, tool = g.getObjectByName("tool")!;
        tool.visible = mining;
        if (mining) { const n = c.nodes[view.mining!.node]; if (n) g.rotation.y = Math.atan2(n.x + .5 - g.position.x, n.y + .5 - g.position.z); tool.rotation.x = Math.sin(time * .025) * 1.2; }
      }
      selection.visible = !!view.selected;
      if (view.selected) { selection.position.set(view.selected.x + .5, TOP + .035, view.selected.y + .5); selection.scale.setScalar(1 + Math.sin(time * .005) * .025); }
      const active = view.mining && c.nodes[view.mining.node];
      miningRing.visible = !!active;
      if (active) { miningRing.position.set(active.x + .5, TOP + .055, active.y + .5); miningRing.scale.setScalar(1 + Math.sin(time * .017) * .09); }
      for (const [id, model] of nodeModels) { model.rotation.z = view.mining?.node === id ? Math.sin(time * .035) * .045 : 0; }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i], age = (time - b.started) / 1000;
        if (age > 1.1) { clear(b.group); effects.remove(b.group); bursts.splice(i, 1); continue; }
        b.group.children.forEach(o => { if (o.userData.velocity) { const v = o.userData.velocity as THREE.Vector3; o.position.set(v.x * age, .4 + v.y * age - age * age, v.z * age); o.scale.setScalar(Math.max(.01, .1 * (1 - age / 1.1))); o.rotation.x = age * 4; } else if (o instanceof THREE.Sprite) o.position.y = 1.05 + age * .55; });
      }
      const boat = facilities.getObjectByName("boat"); if (boat) { boat.position.y = -.54 + Math.sin(time * .0017) * .055; boat.rotation.z = Math.sin(time * .0012) * .035; }
      seaDetails.position.y = Math.sin(time * .001) * .015;
      const fp = !!view.firstPerson && !!view.uid;
      activeCamera = fp ? playerCamera : camera;
      heldTool.visible = fp; clouds.visible = fp;
      scene.background = new THREE.Color(fp ? "#c4e4ed" : SEA);
      scene.fog = fp ? new THREE.Fog("#c4e4ed", 15, 65) : null;
      if (fp) {
        const own = avatarModels.get(view.uid!);
        const position = view.positions[view.uid!] || spawn(w, view.uid!);
        playerCamera.position.set(own?.position.x ?? position.x + .5, (own?.position.y ?? TOP) + 1.23, own?.position.z ?? position.y + .5);
        playerCamera.rotation.set(THREE.MathUtils.clamp(view.firstPerson!.pitch, -1.15, 1.15), view.firstPerson!.yaw, 0, "YXZ");
        playerCamera.updateMatrixWorld();
        const swinging = view.mining?.actor === view.uid;
        heldTool.rotation.x = swinging ? -.55 + Math.sin(time * .026) * .65 : -.12;
        heldTool.rotation.z = swinging ? -.24 + Math.sin(time * .026) * .25 : -.24;
        heldTool.position.y = -.35 + (swinging ? Math.sin(time * .026) * .055 : Math.sin(time * .002) * .007);
      }
      if (centersDirty) { setCenters(view); centersDirty = false; }
      renderer.render(scene, activeCamera);
      canvas.dataset.view = fp ? "first-person" : "overview";
      canvas.dataset.renderer = "webgl";
    },
    pick(x, y) {
      const fp = !!currentView.firstPerson;
      raycaster.far = fp ? 6 : Infinity;
      raycaster.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), activeCamera);
      const hits = raycaster.intersectObjects([objects, facilities, sites], true);
      for (const hit of hits) {
        let o: THREE.Object3D | null = hit.object;
        while (o) { if (o.userData.tile) return o.userData.tile as Position; o = o.parent; }
      }
      if (!raycaster.ray.intersectPlane(ground, intersection)) return null;
      if (fp && raycaster.ray.origin.distanceTo(intersection) > 6) return null;
      const p = { x: Math.floor(intersection.x), y: Math.floor(intersection.z) };
      return isLand(currentView.world, p.x, p.y) ? p : null;
    },
    dispose() {
      disposed = true;
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); spriteMaterials.forEach(m => m.dispose());
      basicMaterials.forEach(m => m.dispose());
      scene.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); delete canvas.dataset.tileCenters;
    },
  };
}

/** An explicit, interactive fallback for school devices that disable WebGL. */
export function createFlatIslandRenderer(canvas: HTMLCanvasElement): IslandRenderer {
  const ctx = canvas.getContext("2d");
  let current: IslandView;
  return {
    draw(view) {
      current = view;
      if (!ctx) return;
      const { world: w, country, positions, selected } = view, c = w.countries[country];
      const width = w.config.map.width, height = w.config.map.height, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cssWidth = canvas.clientWidth || 600, cssHeight = canvas.clientHeight || cssWidth * height / width;
      if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) { canvas.width = Math.round(cssWidth * dpr); canvas.height = Math.round(cssHeight * dpr); }
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      ctx.fillStyle = SEA; ctx.fillRect(0, 0, width, height);
      const spec = w.config.countries.find((s: any) => s.id === country), centers: Record<string, [number, number]> = {};
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (isLand(w, x, y)) { ctx.fillStyle = spec.land; ctx.fillRect(x, y, .99, .99); centers[`${x},${y}`] = [(x + .5) / width, (y + .5) / height]; }
      for (const s of Object.values(c.sites)) { ctx.fillStyle = s.unit ? (view.origin ? w.config.countries.find((a: any) => a.id === Object.keys(s.unit!.sources)[0])?.color || "#fff" : w.config.goods[s.good].color) : "#e5eed8"; ctx.fillRect(s.x + .1, s.y + .1, .8, .8); }
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = ".52px sans-serif";
      for (const n of Object.values(c.nodes)) { ctx.fillStyle = w.config.goods[n.good].color; ctx.fillRect(n.x + .12, n.y + .14, .76, .72); ctx.fillStyle = "#fff"; ctx.fillText(({ wood: "♠", cotton: "✿", oil: "●", iron: "◆", sand: "∴", stone: "⬟" } as Record<string, string>)[n.good] || "◆", n.x + .5, n.y + .53); }
      for (const [name, p] of Object.entries(c.facilities)) { ctx.fillStyle = "#9e8874"; ctx.fillRect(p.x + .04, p.y + .12, .92, .8); ctx.fillStyle = "#fff9e8"; ctx.font = ".29px sans-serif"; ctx.fillText(w.config.facilities[name], p.x + .5, p.y + .52); }
      const harbor = port(w); ctx.fillStyle = "#c29b70"; ctx.fillRect(harbor.x, harbor.y + .15, 1.65, .7);
      for (const p of Object.values(w.players).filter(p => p.country === country)) { const pos = positions[p.id] || spawn(w, p.id); ctx.fillStyle = p.id === view.uid ? "#527aab" : spec.color; ctx.fillRect(pos.x + .25, pos.y + .28, .5, .57); ctx.fillStyle = "#f3d1ad"; ctx.fillRect(pos.x + .3, pos.y + .08, .4, .34); }
      if (selected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = .065; ctx.strokeRect(selected.x + .04, selected.y + .04, .92, .92); }
      ctx.font = ".27px sans-serif"; ctx.fillStyle = "#527f86"; ctx.textAlign = "left"; ctx.fillText("2D 지도 · WebGL을 사용할 수 없는 기기", .6, height - .45);
      canvas.dataset.tileCenters = JSON.stringify(centers); canvas.dataset.renderer = "2d"; canvas.dataset.view = "overview";
    },
    pick(x, y) { if (!current) return null; const p = { x: Math.floor(x * current.world.config.map.width), y: Math.floor(y * current.world.config.map.height) }; return isLand(current.world, p.x, p.y) ? p : null; },
    dispose() { delete canvas.dataset.tileCenters; },
  };
}
