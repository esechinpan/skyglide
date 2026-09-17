// terrain.js — procedural biome height fields + chunked low-poly terrain streaming.
import * as THREE from 'three';
import { makeNoise2D, mulberry32, fbm, ridged, smoothstep, lerp, clamp } from './noise.js';
import { buildDecoGeometry } from './deco.js';

export const CHUNK = 400;
const VIEW_RADIUS = 6;
const NEAR_RADIUS = 3;

// Returns heightAt(x, z) for a stage. The start cliff (z < 0) is a high plateau and
// stage mode adds a flat landing pad at the goal.
export function makeHeightFn(stage, { endless = false, goalX = 0 } = {}) {
  const noise = makeNoise2D(stage.seed);
  const noise2 = makeNoise2D(stage.seed + 7);
  const noise3 = makeNoise2D(stage.seed + 13);
  const kind = stage.kind;
  const L = stage.length;
  const cliffH = stage.cliffHeight;
  const goalH = stage.goalHeight;

  // volcano cones
  const cones = [];
  if (kind === 'volcano') {
    const r = mulberry32(stage.seed + 99);
    for (let i = 0; i < (endless ? 40 : 4); i++) {
      cones.push({ x: (r() - 0.5) * 1800, z: 900 + i * (endless ? 900 : 1150) + r() * 300, r: 420 + r() * 200, h: 320 + r() * 160 });
    }
  }
  // sky spires
  const spires = [];
  if (kind === 'sky') {
    const r = mulberry32(stage.seed + 77);
    for (let i = 0; i < (endless ? 80 : 14); i++) {
      spires.push({ x: (r() - 0.5) * 2200, z: 400 + r() * (endless ? 30000 : L), r: 40 + r() * 60, h: 380 + r() * 260 });
    }
  }

  function base(x, z) {
    switch (kind) {
      case 'hills': {
        const n = fbm(noise, x * 0.0012, z * 0.0012, 5);
        const r = ridged(noise2, x * 0.0006, z * 0.0006, 4);
        return n * 120 + r * 300 - 70;
      }
      case 'canyon': {
        const n = fbm(noise, x * 0.0015, z * 0.0015, 4);
        let h = n * 170 + 130;
        const step = 45;
        const q = h / step, f = q - Math.floor(q);
        h = (Math.floor(q) + smoothstep(0.3, 0.7, f)) * step;
        const cv = Math.abs(fbm(noise2, x * 0.0007, z * 0.0007, 2));
        const canyon = 1 - smoothstep(0.0, 0.13, cv);
        h -= canyon * 230;
        return h + fbm(noise3, x * 0.02, z * 0.02, 2) * 4;
      }
      case 'islands': {
        const n = fbm(noise, x * 0.0016, z * 0.0016, 5);
        const m = fbm(noise2, x * 0.0005, z * 0.0005, 3);
        let h = (n * 0.5 + m * 0.9) * 240 - 35;
        if (h > 0) h += Math.pow(h / 240, 1.4) * 140;
        return h;
      }
      case 'volcano': {
        let h = ridged(noise, x * 0.001, z * 0.001, 5) * 380 - 70 + fbm(noise2, x * 0.003, z * 0.003, 3) * 50;
        for (const c of cones) {
          const d = Math.hypot(x - c.x, z - c.z);
          if (d < c.r) {
            const cone = c.h * (1 - smoothstep(0, c.r, d));
            const crater = c.h * 0.55 * (1 - smoothstep(0, c.r * 0.28, d));
            h += cone - crater;
          }
        }
        return h;
      }
      case 'fjord': {
        const r = ridged(noise, x * 0.0008, z * 0.0008, 5);
        return r * 540 - 160 + fbm(noise2, x * 0.004, z * 0.004, 3) * 35;
      }
      case 'sky': {
        const m = fbm(noise2, x * 0.0007, z * 0.0007, 3);
        const island = smoothstep(0.02, 0.32, m);
        const n = fbm(noise, x * 0.002, z * 0.002, 4);
        let h = lerp(-400, 210 + n * 110 + m * 160, island);
        for (const s of spires) {
          const d = Math.hypot(x - s.x, z - s.z);
          if (d < s.r) h = Math.max(h, -400 + (s.h + 400) * Math.pow(1 - d / s.r, 0.6));
        }
        return h;
      }
      default:
        return fbm(noise, x * 0.001, z * 0.001, 5) * 200;
    }
  }

  return function heightAt(x, z) {
    let h = base(x, z);
    // start cliff: plateau behind the edge
    const edge = fbm(noise3, x * 0.008, 0, 2) * 50 * smoothstep(40, 220, Math.abs(x));
    const cz = 1 - smoothstep(edge, 34 + edge, z);
    if (cz > 0) {
      const cx = 1 - smoothstep(520, 900, Math.abs(x));
      const c = cz * cx;
      if (c > 0) {
        const plat = cliffH + fbm(noise2, x * 0.004, z * 0.004, 3) * 14;
        h = lerp(h, Math.max(h, plat), c);
      }
    }
    if (!endless) {
      const d = Math.hypot(x - goalX, z - L);
      const g = 1 - smoothstep(60, 230, d);
      if (g > 0) h = lerp(h, goalH, g);
    }
    return h;
  };
}

function hash2(x, z) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export class Terrain {
  constructor(scene, stage, opts = {}) {
    this.scene = scene;
    this.stage = stage;
    this.endless = !!opts.endless;
    this.heightAt = makeHeightFn(stage, opts);
    this.chunks = new Map();
    this.queue = [];
    this.bands = stage.palette.bands.map(([h, c]) => [h, new THREE.Color(c)]);
    this.cliffColor = new THREE.Color(stage.palette.cliff);
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    this.decoMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
    this.group = new THREE.Group();
    scene.add(this.group);
    this.waterLevel = stage.water.level;
    this.lastCenter = null;
    this.tmpColor = new THREE.Color();

    // water / lava / cloud sea plane
    const w = stage.water;
    const wmat = new THREE.MeshStandardMaterial({
      color: w.color, transparent: w.opacity < 1, opacity: w.opacity,
      roughness: w.lava ? 0.6 : (w.cloudsea ? 1 : 0.25), metalness: w.lava || w.cloudsea ? 0 : 0.2,
      emissive: w.lava ? new THREE.Color('#ff3300') : new THREE.Color('#000000'), emissiveIntensity: w.lava ? 0.9 : 0,
      flatShading: true,
    });
    const wgeo = new THREE.PlaneGeometry(7000, 7000, 40, 40);
    wgeo.rotateX(-Math.PI / 2);
    const pos = wgeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, (hash2(pos.getX(i), pos.getZ(i)) - 0.5) * (w.cloudsea ? 30 : 2.5));
    wgeo.computeVertexNormals();
    this.water = new THREE.Mesh(wgeo, wmat);
    this.water.position.y = w.level;
    scene.add(this.water);
  }

  colorFor(h, ny, x, z, out) {
    const b = this.bands;
    if (h <= b[0][0]) out.copy(b[0][1]);
    else if (h >= b[b.length - 1][0]) out.copy(b[b.length - 1][1]);
    else {
      for (let i = 0; i < b.length - 1; i++) {
        if (h >= b[i][0] && h < b[i + 1][0]) {
          const t = (h - b[i][0]) / (b[i + 1][0] - b[i][0]);
          out.copy(b[i][1]).lerp(b[i + 1][1], t);
          break;
        }
      }
    }
    const steep = smoothstep(0.7, 0.45, ny);
    if (steep > 0) out.lerp(this.cliffColor, steep);
    const j = 1 + (hash2(Math.floor(x), Math.floor(z)) - 0.5) * 0.12;
    out.r *= j; out.g *= j; out.b *= j;
    return out;
  }

  buildChunk(cx, cz, lod) {
    const seg = lod === 0 ? 32 : 16;
    const size = CHUNK, step = size / seg;
    const ox = cx * size, oz = cz * size;
    const n = seg + 1, pn = n + 2;
    const hs = new Float32Array(pn * pn);
    const H = this.heightAt;
    for (let j = 0; j < pn; j++) for (let i = 0; i < pn; i++) hs[j * pn + i] = H(ox + (i - 1) * step, oz + (j - 1) * step);
    const positions = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    const c = this.tmpColor;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        const h = hs[(j + 1) * pn + (i + 1)];
        const x = ox + i * step, z = oz + j * step;
        positions[idx * 3] = x; positions[idx * 3 + 1] = h; positions[idx * 3 + 2] = z;
        const hl = hs[(j + 1) * pn + i], hr = hs[(j + 1) * pn + i + 2];
        const hb = hs[j * pn + i + 1], hf = hs[(j + 2) * pn + i + 1];
        const nx = hl - hr, nz = hb - hf, ny = 2 * step;
        const len = Math.hypot(nx, ny, nz);
        this.colorFor(h, ny / len, x, z, c);
        colors[idx * 3] = c.r; colors[idx * 3 + 1] = c.g; colors[idx * 3 + 2] = c.b;
      }
    }
    const indices = new Uint16Array(seg * seg * 6);
    let k = 0;
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
        indices[k++] = a; indices[k++] = cc; indices[k++] = b;
        indices[k++] = b; indices[k++] = cc; indices[k++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = true;
    const group = new THREE.Group();
    group.add(mesh);

    // decorations
    const rng = mulberry32((cx * 73856093) ^ (cz * 19349663) ^ this.stage.seed);
    const dgeo = buildDecoGeometry(this.stage.deco, rng, ox, oz, size, H, this.waterLevel, lod === 0 ? 1 : 0.45);
    if (dgeo) {
      dgeo.computeBoundingSphere();
      group.add(new THREE.Mesh(dgeo, this.decoMaterial));
    }
    this.group.add(group);
    return { group, lod, cx, cz };
  }

  removeChunk(key) {
    const ch = this.chunks.get(key);
    if (!ch) return;
    this.group.remove(ch.group);
    ch.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.chunks.delete(key);
  }

  // Stream chunks around (px, pz). budgetMs limits generation time per call.
  update(px, pz, budgetMs = 6, force = false) {
    const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK);
    if (!this.lastCenter || this.lastCenter[0] !== ccx || this.lastCenter[1] !== ccz || force) {
      this.lastCenter = [ccx, ccz];
      this.queue.length = 0;
      for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
        for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
          const ring = Math.max(Math.abs(dx), Math.abs(dz));
          const lod = ring <= NEAR_RADIUS ? 0 : 1;
          const key = (ccx + dx) + ',' + (ccz + dz);
          const ex = this.chunks.get(key);
          if (!ex || ex.lod !== lod) this.queue.push({ cx: ccx + dx, cz: ccz + dz, lod, ring, key });
        }
      }
      this.queue.sort((a, b) => a.ring - b.ring);
      for (const [key, ch] of this.chunks) {
        if (Math.max(Math.abs(ch.cx - ccx), Math.abs(ch.cz - ccz)) > VIEW_RADIUS + 1) this.removeChunk(key);
      }
    }
    const t0 = performance.now();
    while (this.queue.length && (performance.now() - t0 < budgetMs)) {
      const q = this.queue.shift();
      const ex = this.chunks.get(q.key);
      if (ex && ex.lod === q.lod) continue;
      if (ex) this.removeChunk(q.key);
      this.chunks.set(q.key, this.buildChunk(q.cx, q.cz, q.lod));
    }
    this.water.position.x = Math.round(px / 100) * 100;
    this.water.position.z = Math.round(pz / 100) * 100;
  }

  // Generate everything around a point synchronously (used before a run starts).
  prewarm(px, pz) {
    this.update(px, pz, 1e9, true);
  }

  dispose() {
    for (const key of [...this.chunks.keys()]) this.removeChunk(key);
    this.scene.remove(this.group);
    this.scene.remove(this.water);
    this.water.geometry.dispose();
    this.water.material.dispose();
    this.material.dispose();
    this.decoMaterial.dispose();
  }
}
