// game.js — one play session: scene setup, camera, scoring, missions, HUD state.
import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { Course, goalXFor } from './course.js';
import { Player } from './player.js';
import { clamp, lerp } from './noise.js';

const DEG = Math.PI / 180;

function makeSky(stage) {
  const geo = new THREE.SphereGeometry(6000, 24, 12);
  const sun = new THREE.Vector3(...stage.sky.sunDir).normalize();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(stage.sky.top) },
      bottom: { value: new THREE.Color(stage.sky.bottom) },
      sunColor: { value: new THREE.Color(stage.sky.sun) },
      sunDir: { value: sun },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y * 1.6 + 0.15, 0.0, 1.0);
        vec3 c = mix(bottom, top, pow(h, 0.7));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunColor * (pow(s, 600.0) * 1.4 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

export class Game {
  constructor(app, stage, mode) {
    this.app = app;
    this.stage = stage;
    this.mode = mode;               // 'stage' | 'endless'
    this.endless = mode === 'endless';
    const save = app.save;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(stage.sky.fog);
    this.scene.fog = new THREE.Fog(stage.sky.fog, stage.sky.fogNear, stage.sky.fogFar);
    this.sky = makeSky(stage);
    this.scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(stage.sky.hemi[0], stage.sky.hemi[1], 0.85);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(stage.sky.sun, 1.6);
    this.sun.position.set(...stage.sky.sunDir).multiplyScalar(1000);
    this.scene.add(this.sun);

    const goalX = this.endless ? 0 : goalXFor(stage);
    this.terrain = new Terrain(this.scene, stage, { endless: this.endless, goalX });
    this.course = new Course(this.scene, stage, this.terrain, { endless: this.endless, seed: this.endless ? (Date.now() & 0xffff) : stage.seed * 3 + 1 });
    this.player = new Player(this.scene, { color: app.skinColor(), upgrades: save.upgrades, invertY: save.settings.invertY });

    const startY = this.terrain.heightAt(0, -10) + 1;
    this.player.reset(new THREE.Vector3(0, startY, -10));
    this.terrain.prewarm(0, 0);

    this.camera = app.camera;
    this.camPos = new THREE.Vector3(0, startY + 5, -30);
    this.camLook = new THREE.Vector3(0, startY, 0);
    this.camMode = save.settings.camera || 'chase';
    this.shake = 0;
    this.prevPos = new THREE.Vector3().copy(this.player.pos);
    this.wind = new THREE.Vector3();
    this.time = 0;
    this.readyT = 0;
    this.finished = false;
    this.result = null;
    this.slowmo = 1;
    this.popups = [];
    this.magnetRadius = 4.5 + 2.2 * save.upgrades.magnet;

    this.stats = {
      score: 0, time: 0, rings: 0, ringsTotal: this.endless ? 0 : stage.rings, missed: 0,
      gems: 0, gold: 0, combo: 0, maxCombo: 0, proximity: 0, rolls: 0, maxSpeed: 0,
      boostUsed: false, bounces: 0, distance: 0, finished: false, crashed: false,
    };

    // speed streak particles
    const n = 260;
    const pg = new THREE.BufferGeometry();
    this.streakPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.resetStreak(i, true);
    pg.setAttribute('position', new THREE.BufferAttribute(this.streakPos, 3));
    this.streaks = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.9, transparent: true, opacity: 0, sizeAttenuation: true, depthWrite: false }));
    this.streaks.frustumCulled = false;
    this.scene.add(this.streaks);
  }

  resetStreak(i, anywhere) {
    const p = this.streakPos;
    p[i * 3] = (Math.random() - 0.5) * 60;
    p[i * 3 + 1] = (Math.random() - 0.5) * 40;
    p[i * 3 + 2] = anywhere ? Math.random() * 120 - 20 : 90 + Math.random() * 40;
  }

  get phase() { return this.player.phase; }

  jump() {
    if (this.player.phase === 'ready') {
      this.player.jump();
      this.app.audio.jump();
      this.app.save.stats.flights++;
    }
  }

  popup(text, cls = '') { this.popups.push({ text, cls }); }

  addScore(n, text, cls) {
    this.stats.score += n;
    if (text) this.popup(`${text} +${n}`, cls);
  }

  update(dt, input) {
    const st = this.stats, p = this.player, audio = this.app.audio;
    this.time += dt;
    dt *= this.slowmo;

    // wind: constant + gusts
    const w = this.stage.wind;
    const gust = Math.sin(this.time * 0.7) * Math.sin(this.time * 0.23 + 1) * w.gust;
    const endlessMul = this.endless ? 1 + clamp(p.pos.z / 8000, 0, 1.5) : 1;
    this.wind.set((w.x + gust) * endlessMul, 0, Math.sin(this.time * 0.4) * w.gust * 0.3);
    // thermals: hot volcanic rock pushes you up
    if (this.stage.kind === 'volcano' && p.phase === 'flying') {
      const hh = this.terrain.heightAt(p.pos.x, p.pos.z);
      this.wind.y = clamp((hh - 220) / 120, 0, 1) * clamp(1 - (p.pos.y - hh) / 260, 0, 1) * 9;
      this.thermal = this.wind.y > 2;
    } else this.thermal = false;

    if (p.phase === 'ready') {
      this.readyT += dt;
      if (input.consume('Space') || input.consume('Enter')) this.jump();
    }
    if (p.phase === 'flying') {
      st.time += dt;
      if (input.consume('KeyV') || input.consume('KeyC')) { this.camMode = this.camMode === 'chase' ? 'fpv' : 'chase'; this.app.save.settings.camera = this.camMode; }
    }

    this.prevPos.copy(p.pos);
    const ev = p.update(dt, input, this.wind, this.terrain.heightAt, this.stage.water.level);

    if (ev.jumped) this.popup(this.endless ? 'ENDLESS FLIGHT' : this.stage.en, 'title');
    if (ev.boosting) { st.boostUsed = true; if (!this.wasBoosting) audio.boostOn(); }
    this.wasBoosting = ev.boosting;
    if (ev.rolled) {
      st.rolls++;
      const pts = 250;
      this.addScore(pts, 'バレルロール!', 'trick');
      audio.roll();
    }
    if (ev.bounced) {
      st.bounces++; st.combo = 0; this.shake = 1;
      this.popup('バウンド! 残り' + p.bounces, 'bad');
      audio.bounce();
    }
    if (ev.crashed) {
      st.crashed = true;
      this.shake = 1.5;
      audio.crash();
      this.finish(ev.water ? 'water' : 'crash');
    }

    if (p.phase === 'flying') {
      st.distance += Math.hypot(p.pos.x - this.prevPos.x, p.pos.z - this.prevPos.z);
      st.maxSpeed = Math.max(st.maxSpeed, p.speed);
      // proximity scoring
      const g = p.groundDist;
      const overWater = this.terrain.heightAt(p.pos.x, p.pos.z) < this.stage.water.level;
      const waterDist = p.pos.y - this.stage.water.level;
      const near = Math.min(g, overWater ? waterDist : 1e9);
      if (near < 12 && p.speed > 25) {
        st.proximity += dt;
        this.proxAcc = (this.proxAcc || 0) + dt * 18 * (near < 6 ? 1.6 : 1);
        if (this.proxAcc >= 10) { const n = Math.floor(this.proxAcc); st.score += n; this.proxAcc -= n; }
        this.proxActive = true;
      } else this.proxActive = false;

      // course events
      const cev = this.course.update(dt, this.prevPos, p.pos, this.magnetRadius);
      for (const r of cev.rings) {
        st.rings++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo);
        const mult = Math.min(st.combo, 5);
        this.addScore(100 * mult, st.combo > 1 ? `RING ×${st.combo}` : 'RING', 'ring');
        audio.ring(st.combo);
        p.boost = Math.min(p.boostMax, p.boost + 12);
      }
      for (const r of cev.missed) {
        st.missed++;
        if (st.combo > 0) { this.popup('コンボ終了', 'bad'); audio.miss(); }
        st.combo = 0;
      }
      if (cev.gems) { st.gems += cev.gems; st.score += 10 * cev.gems; audio.gem(); }
      if (cev.gold) { st.gold += cev.gold; this.addScore(50 * cev.gold, 'GOLD GEM', 'gold'); audio.gold(); }
      if (cev.goal) { this.finish('goal'); }
      if (this.endless) {
        const dist = Math.floor(p.pos.z);
        if (dist > (st.endlessDist || 0)) { st.score += dist - (st.endlessDist || 0); st.endlessDist = dist; }
      }
    }

    this.terrain.update(p.pos.x, p.pos.z, p.phase === 'flying' ? 5 : 12);
    this.updateCamera(dt, ev);
    this.updateStreaks(dt);
    this.shake = Math.max(0, this.shake - dt * 2);
    return ev;
  }

  updateStreaks(dt) {
    const p = this.player;
    const speed = p.phase === 'flying' ? p.speed : 0;
    const vis = clamp((speed - 45) / 55, 0, 1);
    this.streaks.material.opacity = vis * 0.6;
    if (vis <= 0) return;
    const arr = this.streakPos;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3 + 2] -= speed * dt * 1.2;
      if (arr[i * 3 + 2] < -20) this.resetStreak(i, false);
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;
    this.streaks.position.copy(this.camera.position);
    this.streaks.quaternion.copy(this.camera.quaternion);
    this.streaks.rotateY(Math.PI); // camera looks down -z; streaks defined along +z
  }

  updateCamera(dt, ev) {
    const p = this.player, cam = this.camera;
    const f = p.forward;
    let desired, look, fov;
    if (p.phase === 'ready') {
      const a = Math.sin(this.readyT * 0.35) * 0.7;
      desired = new THREE.Vector3(p.pos.x + Math.sin(a) * 14, p.pos.y + 4.5, p.pos.z - 1 - Math.cos(a) * 14);
      look = new THREE.Vector3(p.pos.x, p.pos.y + 1.2, p.pos.z + 6);
      const hc = this.terrain.heightAt(desired.x, desired.z);
      if (desired.y < hc + 2.5) desired.y = hc + 2.5;
      fov = 62;
      this.camPos.lerp(desired, 1 - Math.exp(-dt * 3));
      this.camLook.lerp(look, 1 - Math.exp(-dt * 3));
    } else if (this.camMode === 'fpv' && p.phase === 'flying') {
      desired = p.pos.clone().addScaledVector(f, 1.6).add(new THREE.Vector3(0, 0.6, 0));
      look = p.pos.clone().addScaledVector(f, 60);
      fov = 80 + clamp((p.speed - 40) / 60, 0, 1) * 18;
      this.camPos.copy(desired);
      this.camLook.copy(look);
    } else {
      const dist = 13 + clamp(p.speed, 0, 120) * 0.05;
      desired = p.pos.clone().addScaledVector(f, -dist).add(new THREE.Vector3(0, 4.2, 0));
      // keep camera above terrain
      const h = this.terrain.heightAt(desired.x, desired.z);
      if (desired.y < h + 3) desired.y = h + 3;
      look = p.pos.clone().addScaledVector(f, 30).add(new THREE.Vector3(0, 1.5, 0));
      fov = 66 + clamp((p.speed - 40) / 60, 0, 1) * 22 + (ev.boosting ? 5 : 0);
      const k = p.phase === 'flying' ? 7 : 4;
      this.camPos.lerp(desired, 1 - Math.exp(-dt * k));
      this.camLook.lerp(look, 1 - Math.exp(-dt * 10));
    }
    if (this.shake > 0) {
      const s = this.shake * 0.8;
      this.camPos.x += (Math.random() - 0.5) * s; this.camPos.y += (Math.random() - 0.5) * s;
    }
    cam.position.copy(this.camPos);
    cam.up.set(0, 1, 0).applyAxisAngle(f, -p.roll * 0.35);
    cam.lookAt(this.camLook);
    cam.fov = lerp(cam.fov, fov, 1 - Math.exp(-dt * 4));
    cam.updateProjectionMatrix();
    this.sky.position.copy(cam.position);
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    const st = this.stats, p = this.player;
    st.finished = reason === 'goal';
    st.reason = reason;
    if (reason === 'goal') {
      p.phase = 'finished';
      this.app.audio.goal();
      const par = this.stage.parTime;
      const timeBonus = Math.max(0, Math.round((par - st.time) * 25));
      st.timeBonus = timeBonus;
      st.goalBonus = 500;
      st.score += 500 + timeBonus;
      this.popup('GOAL!', 'title');
    } else {
      this.slowmo = 0.25;
    }
    this.result = this.computeResult();
  }

  computeResult() {
    const st = this.stats, save = this.app.save, stage = this.stage;
    const res = { stats: st, medal: 0, newMedal: false, missions: [], gemsEarned: 0, newBest: false, achievements: [] };
    save.stats.distance += st.distance;
    save.stats.rings += st.rings;
    save.stats.gemsTotal += st.gems + st.gold;
    save.stats.rolls += st.rolls;
    save.stats.proximity += st.proximity;
    save.stats.maxSpeed = Math.max(save.stats.maxSpeed, st.maxSpeed);
    save.stats.maxCombo = Math.max(save.stats.maxCombo, st.maxCombo);
    if (st.crashed) save.stats.crashes++;
    let gems = st.gems + st.gold * 5;

    if (this.endless) {
      const dist = st.endlessDist || 0;
      if (dist > save.endlessBest.distance) { save.endlessBest.distance = dist; res.newBest = true; }
      if (st.score > save.endlessBest.score) { save.endlessBest.score = st.score; res.newBest = true; }
      gems += Math.floor(dist / 100);
      res.distance = dist;
    } else {
      if (st.finished) save.stats.goals++;
      let medal = 0;
      for (let i = 0; i < 3; i++) if (st.score >= stage.medals[i]) medal = i + 1;
      res.medal = medal;
      const prev = save.stars[stage.id] || 0;
      if (medal > prev) {
        res.newMedal = true;
        save.stars[stage.id] = medal;
        gems += [0, 60, 120, 250][medal] - [0, 60, 120, 250][prev];
      }
      const best = save.best[stage.id] || { score: 0, time: 0 };
      if (st.score > best.score) { best.score = st.score; res.newBest = true; }
      if (st.finished && (best.time === 0 || st.time < best.time)) best.time = st.time;
      save.best[stage.id] = best;
      const done = save.missions[stage.id] || [false, false, false];
      stage.missions.forEach((m, i) => {
        const ok = this.missionOK(m);
        const fresh = ok && !done[i];
        if (fresh) { done[i] = true; gems += 150; }
        res.missions.push({ text: m.text, ok, fresh, was: done[i] });
      });
      save.missions[stage.id] = done;
    }
    save.gems += gems;
    res.gemsEarned = gems;
    return res;
  }

  missionOK(m) {
    const st = this.stats;
    switch (m.type) {
      case 'rings': return st.rings >= m.n;
      case 'gems': return st.gems + st.gold >= m.n;
      case 'time': return st.finished && st.time <= m.n;
      case 'proximity': return st.proximity >= m.n;
      case 'rolls': return st.rolls >= m.n;
      case 'score': return st.finished && st.score >= m.n;
      case 'speed': return st.maxSpeed >= m.n;
      case 'noboost': return st.finished && !st.boostUsed;
      case 'clean': return st.finished && st.bounces === 0;
      case 'combo': return st.maxCombo >= m.n;
      default: return false;
    }
  }

  hudState() {
    const p = this.player, st = this.stats;
    const nr = this.course.nextRing;
    return {
      phase: p.phase, speed: p.speed, alt: p.pos.y, ground: p.groundDist, score: st.score, combo: st.combo,
      time: st.time, rings: st.rings, ringsTotal: st.ringsTotal, gems: st.gems + st.gold,
      boost: p.boost / p.boostMax, boosting: this.wasBoosting, prox: this.proxActive, bounces: p.bounces,
      target: nr ? nr.pos : (this.course.goal && !this.course.goal.done ? this.course.goal.pos : null),
      dist: this.endless ? (st.endlessDist || 0) : null,
      popups: this.popups.splice(0),
    };
  }

  dispose() {
    this.terrain.dispose();
    this.course.dispose();
    this.player.dispose();
    this.sky.geometry.dispose(); this.sky.material.dispose();
    this.streaks.geometry.dispose(); this.streaks.material.dispose();
  }
}
