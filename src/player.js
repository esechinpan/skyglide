// player.js — wingsuit flyer: model, arcade glide physics, tricks, wingtip trails.
import * as THREE from 'three';
import { clamp } from './noise.js';

const DEG = Math.PI / 180;
const approach = (v, target, maxStep) => v + clamp(target - v, -maxStep, maxStep);

function buildModel(color) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: '#1e2230', roughness: 0.7, flatShading: true });
  const membrane = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.5, side: THREE.DoubleSide, flatShading: true });
  const visor = new THREE.MeshStandardMaterial({ color: '#7fe9ff', emissive: '#2fb7ff', emissiveIntensity: 0.8, roughness: 0.2 });

  // torso (lying prone, facing +z)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 1.3), suit);
  g.add(torso);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.4), dark);
  hips.position.z = -0.8; g.add(hips);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), dark);
  head.position.set(0, 0.12, 0.8); g.add(head);
  const vis = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.16), visor);
  vis.position.set(0, 0.14, 0.98); g.add(vis);

  // arm wings: triangles from shoulder out to wingtip and back to hip
  const wing = (sign) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.55);
    shape.lineTo(sign * 1.6, -0.3);
    shape.lineTo(sign * 0.35, -0.9);
    shape.lineTo(0, -0.7);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2); // shape XY -> XZ ; shape y -> -z, flip:
    geo.scale(1, 1, -1);
    const m = new THREE.Mesh(geo, membrane);
    m.position.set(sign * 0.25, 0.02, 0);
    return m;
  };
  g.add(wing(1), wing(-1));
  // legs + leg wing
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.9), suit);
  legs.position.z = -1.35; g.add(legs);
  const legWing = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.25, 0); shape.lineTo(0.25, 0); shape.lineTo(0.55, -1.1); shape.lineTo(-0.55, -1.1);
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2); geo.scale(1, 1, -1);
    const m = new THREE.Mesh(geo, membrane);
    m.position.set(0, 0.02, -0.85);
    return m;
  })();
  g.add(legWing);
  // boost flame
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 6), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 }));
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0, -2.2);
  flame.visible = false;
  g.add(flame);
  g.userData.flame = flame;
  g.scale.setScalar(1.6);
  return g;
}

class Trail {
  constructor(scene, color, n = 50) {
    this.n = n;
    this.pts = new Float32Array(n * 3);
    this.head = 0; this.count = 0;
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    geo.setAttribute('position', this.posAttr);
    const alpha = new Float32Array(n * 3);
    this.colAttr = new THREE.BufferAttribute(alpha, 3);
    geo.setAttribute('color', this.colAttr);
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.line.frustumCulled = false;
    this.color = new THREE.Color(color);
    scene.add(this.line);
    this.scene = scene;
  }
  push(p, strength) {
    this.pts[this.head * 3] = p.x; this.pts[this.head * 3 + 1] = p.y; this.pts[this.head * 3 + 2] = p.z;
    this.head = (this.head + 1) % this.n;
    this.count = Math.min(this.count + 1, this.n);
    // rebuild ordered arrays (oldest -> newest); unused slots collapse onto the oldest point
    const arr = this.posAttr.array, col = this.colAttr.array;
    const oldest = (this.head - this.count + this.n) % this.n;
    for (let i = 0; i < this.n; i++) {
      const j = i < this.n - this.count ? 0 : i - (this.n - this.count);
      const k = (oldest + j) % this.n;
      arr[i * 3] = this.pts[k * 3]; arr[i * 3 + 1] = this.pts[k * 3 + 1]; arr[i * 3 + 2] = this.pts[k * 3 + 2];
      const f = (this.count > 1 ? j / (this.count - 1) : 0) * strength;
      col[i * 3] = this.color.r * f; col[i * 3 + 1] = this.color.g * f; col[i * 3 + 2] = this.color.b * f;
    }
    this.posAttr.needsUpdate = true; this.colAttr.needsUpdate = true;
  }
  reset() { this.count = 0; this.head = 0; }
  dispose() { this.scene.remove(this.line); this.line.geometry.dispose(); this.line.material.dispose(); }
}

export class Player {
  constructor(scene, { color, upgrades, invertY = false }) {
    this.scene = scene;
    this.u = upgrades;
    this.invertY = invertY;
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.model = buildModel(color);
    this.root.add(this.model);
    scene.add(this.root);
    this.pos = this.root.position;
    this.forward = new THREE.Vector3(0, 0, 1);
    this.trailL = new Trail(scene, '#ffffff');
    this.trailR = new Trail(scene, '#ffffff');
    this.tmp = new THREE.Vector3();
    this.reset(new THREE.Vector3(0, 0, 0));
  }

  reset(pos) {
    this.pos.copy(pos);
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.speed = 0; this.vy = 0;
    this.boostMax = 100 + 30 * this.u.boost;
    this.boost = this.boostMax;
    this.bounces = this.u.armor;
    this.groundDist = 0;
    this.trick = null; this.trickCooldown = 0; this.grace = 0;
    this.phase = 'ready';   // ready | jumping | flying | crashed | finished
    this.jumpT = 0;
    this.trailL.reset(); this.trailR.reset();
    this.model.rotation.set(0, 0, 0);
    this.updateOrientation();
  }

  get maxSpeed() { return 95 + 5 * this.u.dive; }

  jump() {
    if (this.phase !== 'ready') return;
    this.phase = 'jumping';
    this.jumpT = 0;
  }

  updateOrientation() {
    this.root.rotation.set(-this.pitch, this.yaw, -this.roll);
    const f = this.forward;
    f.set(Math.cos(this.pitch) * Math.sin(this.yaw), Math.sin(this.pitch), Math.cos(this.pitch) * Math.cos(this.yaw));
  }

  // Returns an event object describing what happened this frame.
  update(dt, input, wind, heightAt, waterLevel, boostRegenMult = 1) {
    const ev = { boosting: false };
    const u = this.u;
    if (this.phase === 'ready') {
      this.model.position.y = 1.2;
      this.model.rotation.x = -0.15;
      return ev;
    }
    if (this.phase === 'jumping') {
      this.jumpT += dt;
      const t = this.jumpT;
      // short run-up then leap
      this.pos.z += 14 * dt;
      this.pos.y = heightAt(this.pos.x, this.pos.z) + 1;
      if (t > 0.8) {
        this.phase = 'flying';
        this.speed = 30;
        this.pitch = -10 * DEG;
        this.grace = 1.5;
        this.model.position.y = 0;
        this.model.rotation.x = 0;
        ev.jumped = true;
      }
      this.updateOrientation();
      return ev;
    }
    if (this.phase !== 'flying') return ev;

    const agility = 1 + 0.1 * u.agility;
    const pitchIn = input.pitch * (this.invertY ? -1 : 1);
    const rollIn = input.roll;

    // --- attitude
    const pitchRate = 85 * DEG * agility;
    if (Math.abs(pitchIn) > 0.04) this.pitch += pitchIn * pitchRate * dt;
    else this.pitch = approach(this.pitch, -5 * DEG, 35 * DEG * dt);
    this.pitch = clamp(this.pitch, -78 * DEG, 42 * DEG);
    const rollRate = 150 * DEG * agility;
    if (Math.abs(rollIn) > 0.04) this.roll += rollIn * rollRate * dt;
    else this.roll = approach(this.roll, 0, 110 * DEG * dt);
    this.roll = clamp(this.roll, -78 * DEG, 78 * DEG);
    if (this.speed < 16) this.pitch = approach(this.pitch, -45 * DEG, 70 * DEG * dt); // stall
    const spdF = clamp(this.speed / 45, 0.35, 1.25);
    this.yaw -= Math.sin(this.roll) * 1.35 * spdF * agility * dt;

    // --- speed
    const diveGain = 1 + 0.08 * u.dive;
    const dragC = 0.0006 * (input.brake ? 4.5 : 1);
    let a = 9.81 * (-Math.sin(this.pitch)) * 1.15 * diveGain - dragC * this.speed * this.speed;
    if (input.boost && this.boost > 0.5) {
      a += 30;
      this.boost = Math.max(0, this.boost - 30 * dt);
      ev.boosting = true;
    } else {
      this.boost = Math.min(this.boostMax, this.boost + (6 + 1.5 * u.boost) * boostRegenMult * dt);
    }
    const liftMult = 1 - 0.09 * u.lift;
    let sink = 2.0 * Math.pow(45 / Math.max(this.speed, 6), 1.6) * liftMult;
    sink = clamp(sink, 0.6, 15);
    if (input.brake) sink *= 0.75;
    a += sink * 0.12;
    const cap = this.maxSpeed + (ev.boosting ? 22 : 0);
    this.speed = clamp(this.speed + a * dt, 6, cap);

    // --- move
    this.updateOrientation();
    const f = this.forward;
    this.pos.x += (f.x * this.speed + wind.x) * dt;
    this.pos.y += (f.y * this.speed - sink + wind.y) * dt;
    this.pos.z += (f.z * this.speed + wind.z) * dt;
    this.vy = f.y * this.speed - sink;

    // --- tricks (barrel roll)
    this.trickCooldown = Math.max(0, this.trickCooldown - dt);
    if (!this.trick && this.trickCooldown === 0 && this.speed > 24 && (input.trickL || input.trickR)) {
      this.trick = { t: 0, dir: input.trickR ? 1 : -1 };
      ev.trickStart = true;
    }
    if (this.trick) {
      this.trick.t += dt * 1.6;
      const t = Math.min(1, this.trick.t);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.model.rotation.z = -this.trick.dir * e * Math.PI * 2;
      this.yaw -= this.trick.dir * 0.5 * dt;
      if (t >= 1) { this.trick = null; this.model.rotation.z = 0; this.trickCooldown = 0.8; ev.rolled = true; }
    }
    // subtle body language
    this.model.rotation.x = approach(this.model.rotation.x, -pitchIn * 0.15, dt * 2);

    // --- ground / water
    const h = heightAt(this.pos.x, this.pos.z);
    this.groundDist = this.pos.y - h;
    const floor = Math.max(h, waterLevel);
    if (this.grace > 0) {
      // just left the cliff: slide along the ground instead of crashing
      this.grace -= dt;
      if (this.pos.y < h + 1.0) this.pos.y = h + 1.0;
    } else if (this.pos.y < floor + 1.0) {
      if (this.bounces > 0 && h >= waterLevel) {
        this.bounces--;
        this.pos.y = h + 2.5;
        this.pitch = 24 * DEG;
        this.speed *= 0.65;
        this.roll = 0;
        ev.bounced = true;
      } else {
        this.pos.y = floor + 0.5;
        this.phase = 'crashed';
        ev.crashed = true;
        ev.water = h < waterLevel;
      }
    }

    // --- visuals
    this.model.userData.flame.visible = ev.boosting;
    if (ev.boosting) this.model.userData.flame.scale.setScalar(0.8 + Math.random() * 0.5);
    const strength = clamp((this.speed - 38) / 50, 0, 1) + (ev.boosting ? 0.4 : 0);
    const tipL = this.tmp.set(-1.85 * 1.6, 0, -0.3 * 1.6).applyEuler(this.root.rotation).add(this.pos);
    this.trailL.push(tipL, strength);
    const tipR = this.tmp.set(1.85 * 1.6, 0, -0.3 * 1.6).applyEuler(this.root.rotation).add(this.pos);
    this.trailR.push(tipR, strength);
    return ev;
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.trailL.dispose(); this.trailR.dispose();
  }
}
