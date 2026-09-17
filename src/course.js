// course.js — rings, gems, goal gate and clouds; generation + collision detection.
import * as THREE from 'three';
import { mulberry32, clamp, lerp } from './noise.js';
import { buildClouds } from './deco.js';

const GEM_CAP = 5000, GOLD_CAP = 800;
const BUCKET = 50;

const matPending = new THREE.MeshStandardMaterial({ color: '#39c6ff', emissive: '#1ea7ff', emissiveIntensity: 0.9, roughness: 0.4 });
const matNext = new THREE.MeshStandardMaterial({ color: '#ffe38a', emissive: '#ffcc33', emissiveIntensity: 1.4, roughness: 0.3 });
const matHit = new THREE.MeshStandardMaterial({ color: '#7dff8a', emissive: '#37e05a', emissiveIntensity: 0.7, roughness: 0.5, transparent: true, opacity: 0.55 });
const matMiss = new THREE.MeshStandardMaterial({ color: '#ff6b6b', emissive: '#a02020', emissiveIntensity: 0.4, roughness: 0.6, transparent: true, opacity: 0.4 });
const matBeam = new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });

export function pathX(stage, z, i) {
  return Math.sin(z * 0.0011 + stage.seed) * 380 + Math.sin(z * 0.0031 + i) * 160;
}
// Goal x position for a stage (terrain needs it before the course exists).
export function goalXFor(stage) {
  return pathX(stage, stage.length, stage.rings) * 0.6;
}

export class Course {
  constructor(scene, stage, terrain, { endless = false, seed = 1 } = {}) {
    this.scene = scene;
    this.stage = stage;
    this.terrain = terrain;
    this.endless = endless;
    this.rng = mulberry32(seed);
    this.rings = [];
    this.nextRingIdx = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;

    this.torusGeo = new THREE.TorusGeometry(1, 0.085, 10, 36);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1400, 8, 1, true), matBeam);
    this.beam.visible = false;
    this.group.add(this.beam);

    // gems (instanced)
    const gemGeo = new THREE.OctahedronGeometry(1.7, 0);
    const gemMat = new THREE.MeshStandardMaterial({ color: '#5ff3ff', emissive: '#19c8e6', emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.2, flatShading: true });
    const goldGeo = new THREE.OctahedronGeometry(2.3, 0);
    const goldMat = new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb300', emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.4, flatShading: true });
    this.gemMesh = new THREE.InstancedMesh(gemGeo, gemMat, GEM_CAP);
    this.goldMesh = new THREE.InstancedMesh(goldGeo, goldMat, GOLD_CAP);
    this.gemMesh.frustumCulled = false; this.goldMesh.frustumCulled = false;
    this.gemMesh.count = 0; this.goldMesh.count = 0;
    this.group.add(this.gemMesh, this.goldMesh);
    this.gems = [];            // {x,y,z,gold,slot,taken,bucket}
    this.buckets = new Map();  // bucketKey -> Set(gem)
    this.freeGem = []; this.freeGold = [];
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v3 = new THREE.Vector3(); this.s3 = new THREE.Vector3(1, 1, 1);
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);

    // clouds
    const cr = mulberry32(seed + 5);
    this.cloudLen = 3600;
    const cg = buildClouds(cr, 42, 1800, 0, this.cloudLen, stage.cliffHeight - 120, stage.cliffHeight + 380);
    this.clouds = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, transparent: true, opacity: 0.86, emissive: '#8fa6bd', emissiveIntensity: 0.55 }));
    this.clouds.position.z = -600;
    this.group.add(this.clouds);

    this.lastWaypoint = new THREE.Vector3(0, stage.cliffHeight + 20, 40);
    this.goal = null;
    this.goalX = 0;
    if (!endless) this.generateStage();
    else this.extendTo(1200);
  }

  // ---------------------------------------------------------------- generation
  pathX(z, i) { return pathX(this.stage, z, i); }

  generateStage() {
    const st = this.stage, H = this.terrain.heightAt;
    const N = st.rings, L = st.length;
    const z0 = 200, z1 = L - 260;
    this.goalX = goalXFor(st);
    let prev = this.lastWaypoint.clone();
    for (let i = 0; i < N; i++) {
      const t = (i + 1) / (N + 1);
      const z = lerp(z0, z1, t) + (this.rng() - 0.5) * 60;
      const x = lerp(this.pathX(z, i), this.goalX, Math.pow(t, 6)) + (this.rng() - 0.5) * 120;
      const h = H(x, z);
      let y = lerp(st.cliffHeight + 10, st.goalHeight + 60, Math.pow(t, 0.85));
      const minY = Math.max(h, st.water.level) + 22 + this.rng() * 30;
      const maxY = Math.max(h, st.water.level) + 230;
      y = clamp(y, minY, maxY);
      const pos = new THREE.Vector3(x, y, z);
      this.addRing(pos, prev, 9);
      this.addGemsBetween(prev, pos);
      prev = pos;
    }
    // goal gate
    const gy = st.goalHeight;
    const gpos = new THREE.Vector3(this.goalX, gy + 26, L);
    this.addGemsBetween(prev, gpos.clone().setY(gy + 40));
    this.buildGoal(gpos);
    this.lastWaypoint.copy(prev);
  }

  // Endless: make sure rings exist up to z.
  extendTo(z) {
    const st = this.stage, H = this.terrain.heightAt;
    let prev = this.lastWaypoint;
    let i = this.rings.length;
    while (prev.z < z) {
      const dist = prev.z;
      const difficulty = clamp(dist / 9000, 0, 1);
      const nz = prev.z + 190 + this.rng() * 90;
      const x = this.pathX(nz, i) * (0.7 + difficulty * 0.6) + (this.rng() - 0.5) * 160;
      const h = Math.max(H(x, nz), st.water.level);
      let y = prev.y + (this.rng() - 0.5) * 120 - 10;
      y = clamp(y, h + 20 + this.rng() * 30, h + 200);
      const pos = new THREE.Vector3(x, y, nz);
      this.addRing(pos, prev, lerp(9.5, 6, difficulty));
      this.addGemsBetween(prev, pos);
      prev = pos; i++;
    }
    this.lastWaypoint = prev;
  }

  addRing(pos, prev, radius) {
    const normal = pos.clone().sub(prev).normalize();
    const mesh = new THREE.Mesh(this.torusGeo, matPending);
    mesh.position.copy(pos);
    mesh.scale.setScalar(radius);
    mesh.lookAt(pos.clone().add(normal));
    this.group.add(mesh);
    const ring = { pos, normal, radius, mesh, state: 'pending', idx: this.rings.length };
    this.rings.push(ring);
    return ring;
  }

  addGemsBetween(a, b) {
    const H = this.terrain.heightAt, st = this.stage;
    const rng = this.rng;
    const n = Math.round((7 + rng() * 5) * st.gemDensity);
    const mid = a.clone().lerp(b, 0.5);
    const dir = b.clone().sub(a);
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const ctrl = mid.add(perp.clone().multiplyScalar((rng() - 0.5) * 160)).add(new THREE.Vector3(0, (rng() - 0.35) * 90, 0));
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const p = new THREE.Vector3().copy(a).multiplyScalar((1 - t) * (1 - t))
        .addScaledVector(ctrl, 2 * (1 - t) * t)
        .addScaledVector(b, t * t);
      const floor = Math.max(H(p.x, p.z), st.water.level) + 6;
      if (p.y < floor) p.y = floor;
      this.addGem(p.x, p.y, p.z, false);
    }
    // ground trail with a gold gem — rewards flying low
    if (rng() < 0.75) {
      const t = 0.3 + rng() * 0.4;
      const c = a.clone().lerp(b, t).add(perp.clone().multiplyScalar((rng() - 0.5) * 200));
      const d = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const k = 5;
      for (let i = -k; i <= k; i++) {
        const x = c.x + d.x * i * 14, z = c.z + d.z * i * 14;
        const h = H(x, z);
        if (h < st.water.level + 2) continue;
        this.addGem(x, h + 5.5, z, i === 0);
      }
    }
  }

  addGem(x, y, z, gold) {
    const free = gold ? this.freeGold : this.freeGem;
    const mesh = gold ? this.goldMesh : this.gemMesh;
    let slot;
    if (free.length) slot = free.pop();
    else {
      slot = mesh.count;
      if (slot >= (gold ? GOLD_CAP : GEM_CAP)) return;
      mesh.count = slot + 1;
    }
    const gem = { x, y, z, gold, slot, taken: false, bucket: Math.floor(z / BUCKET), rot: Math.random() * 6 };
    this.gems.push(gem);
    let set = this.buckets.get(gem.bucket);
    if (!set) { set = new Set(); this.buckets.set(gem.bucket, set); }
    set.add(gem);
    this.writeGem(gem);
    return gem;
  }

  writeGem(gem) {
    const mesh = gem.gold ? this.goldMesh : this.gemMesh;
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), gem.rot + this.time * 2.2);
    this.m4.compose(this.v3.set(gem.x, gem.y, gem.z), this.q, this.s3);
    mesh.setMatrixAt(gem.slot, this.m4);
    mesh.instanceMatrix.needsUpdate = true;
  }

  removeGem(gem) {
    const mesh = gem.gold ? this.goldMesh : this.gemMesh;
    mesh.setMatrixAt(gem.slot, this.zero);
    mesh.instanceMatrix.needsUpdate = true;
    (gem.gold ? this.freeGold : this.freeGem).push(gem.slot);
    const set = this.buckets.get(gem.bucket);
    if (set) { set.delete(gem); if (!set.size) this.buckets.delete(gem.bucket); }
    gem.taken = true;
  }

  buildGoal(pos) {
    const st = this.stage;
    const g = new THREE.Group();
    const gate = new THREE.Mesh(this.torusGeo, new THREE.MeshStandardMaterial({ color: '#ffd45a', emissive: '#ff9d00', emissiveIntensity: 1.2, roughness: 0.3 }));
    gate.scale.setScalar(26);
    gate.scale.y = 26; gate.position.copy(pos);
    g.add(gate);
    const padMat = new THREE.MeshStandardMaterial({ color: '#f0f0f0', roughness: 0.9, flatShading: true });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(55, 60, 3, 24), padMat);
    pad.position.set(pos.x, st.goalHeight + 0.5, pos.z + 70);
    g.add(pad);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 3.4, 24), new THREE.MeshStandardMaterial({ color: '#ff5e3a', roughness: 0.9 }));
    stripe.position.copy(pad.position);
    g.add(stripe);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 18, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? '#ffffff' : '#ff5e3a' }));
      pole.position.set(pos.x + Math.cos(a) * 58, st.goalHeight + 9, pos.z + 70 + Math.sin(a) * 58);
      g.add(pole);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1500, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffb84d', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(pos.x, pos.y + 700, pos.z);
    g.add(beam);
    this.group.add(g);
    this.goal = { pos, normal: new THREE.Vector3(0, 0, 1), radius: 26, mesh: gate, group: g, done: false };
  }

  // ---------------------------------------------------------------- runtime
  get nextRing() {
    while (this.nextRingIdx < this.rings.length && this.rings[this.nextRingIdx].state !== 'pending') this.nextRingIdx++;
    return this.rings[this.nextRingIdx] || null;
  }

  // Detect collisions for the movement prev -> pos. Returns events.
  update(dt, prev, pos, magnetRadius) {
    this.time += dt;
    const ev = { rings: [], missed: [], gems: 0, gold: 0, goal: false };

    // rings: plane crossing test
    for (let i = this.nextRingIdx; i < Math.min(this.rings.length, this.nextRingIdx + 4); i++) {
      const r = this.rings[i];
      if (r.state !== 'pending') continue;
      if (this.crosses(prev, pos, r)) {
        r.state = 'hit'; if (r.mesh) r.mesh.material = matHit; ev.rings.push(r);
      } else if (pos.z > r.pos.z + 45 && i === this.nextRingIdx) {
        r.state = 'missed'; if (r.mesh) r.mesh.material = matMiss; ev.missed.push(r);
      }
    }
    const nr = this.nextRing;
    for (let i = Math.max(0, this.nextRingIdx - 2); i < this.rings.length; i++) {
      const r = this.rings[i];
      if (!r.mesh) continue;
      if (r.state === 'pending') r.mesh.material = r === nr ? matNext : matPending;
      if (r === nr) { r.mesh.scale.setScalar(r.radius * (1 + Math.sin(this.time * 6) * 0.04)); }
      else if (r.state === 'pending') r.mesh.scale.setScalar(r.radius);
    }
    if (nr) { this.beam.visible = true; this.beam.position.set(nr.pos.x, nr.pos.y, nr.pos.z); }
    else this.beam.visible = false;

    // goal
    if (this.goal && !this.goal.done && this.crosses(prev, pos, this.goal)) { this.goal.done = true; ev.goal = true; }
    if (this.goal) this.goal.mesh.rotation.z += dt * 0.5;

    // gems: nearby buckets
    const b0 = Math.floor((pos.z - 160) / BUCKET), b1 = Math.floor((pos.z + 160) / BUCKET);
    const r2 = magnetRadius * magnetRadius;
    const pull = magnetRadius * 2.4;
    for (let b = b0; b <= b1; b++) {
      const set = this.buckets.get(b);
      if (!set) continue;
      for (const gem of set) {
        const dx = gem.x - pos.x, dy = gem.y - pos.y, dz = gem.z - pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < r2) {
          this.removeGem(gem);
          if (gem.gold) ev.gold++; else ev.gems++;
          continue;
        }
        if (d2 < pull * pull) {
          const k = Math.min(1, dt * 7);
          gem.x -= dx * k; gem.y -= dy * k; gem.z -= dz * k;
        }
        if (Math.abs(dz) < 140) this.writeGem(gem);
      }
    }

    // endless housekeeping
    if (this.endless) {
      this.extendTo(pos.z + 1500);
      for (let i = 0; i < this.rings.length; i++) {
        const r = this.rings[i];
        if (r.mesh && r.pos.z < pos.z - 500) { this.group.remove(r.mesh); r.mesh = null; }
      }
      for (const [key, set] of this.buckets) {
        if (key * BUCKET < pos.z - 500) for (const gem of [...set]) this.removeGem(gem);
      }
      this.gems = this.gems.filter(g => !g.taken);
    }
    // clouds wrap
    if (pos.z > this.clouds.position.z + this.cloudLen * 0.7) this.clouds.position.z += this.cloudLen * 0.5;
    return ev;
  }

  crosses(prev, pos, r) {
    const s0 = (prev.x - r.pos.x) * r.normal.x + (prev.y - r.pos.y) * r.normal.y + (prev.z - r.pos.z) * r.normal.z;
    const s1 = (pos.x - r.pos.x) * r.normal.x + (pos.y - r.pos.y) * r.normal.y + (pos.z - r.pos.z) * r.normal.z;
    if (s0 < 0 && s1 >= 0) {
      const t = s0 / (s0 - s1);
      const hx = prev.x + (pos.x - prev.x) * t - r.pos.x;
      const hy = prev.y + (pos.y - prev.y) * t - r.pos.y;
      const hz = prev.z + (pos.z - prev.z) * t - r.pos.z;
      return hx * hx + hy * hy + hz * hz < r.radius * r.radius;
    }
    return false;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.gemMesh.dispose(); this.goldMesh.dispose();
  }
}
