// main.js — app bootstrap: renderer, loop, screens and session management.
import * as THREE from 'three';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { loadSave, persist, resetSave, checkAchievements, skinColor, isStageUnlocked } from './save.js';
import { STAGES } from './stages.js';

class App {
  constructor() {
    this.save = loadSave();
    this.canvas = document.getElementById('c');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.5, 9000);
    this.input = new Input();
    this.audio = new AudioSys(this.save.settings);
    this.ui = new UI(this);
    this.game = null;
    this.paused = false;
    this.clock = new THREE.Clock();
    this.state = 'menu';
    this.menuScene = this.buildMenuScene();
    this.applyQuality();
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // audio unlock on first gesture
    const unlock = () => { this.audio.start(); this.audio.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });

    this.input.attachTouch(document.getElementById('stick'), document.getElementById('knob'), document.getElementById('tbtn-boost'), document.getElementById('tbtn-brake'), document.getElementById('tbtn-action'));
    // touch: action button doubles as jump / barrel roll
    document.getElementById('tbtn-action').addEventListener('touchstart', () => { if (this.game && this.game.phase === 'flying') this.input.pressedOnce.add('KeyE'); }, { passive: true });

    this.ui.show('title');
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'game' && !this.paused) this.togglePause(); });
    requestAnimationFrame(() => this.loop());
  }

  skinColor() { return skinColor(this.save); }

  applyQuality() {
    const q = this.save.settings.quality;
    const pr = q === 'low' ? 0.6 : q === 'med' ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(pr);
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Simple animated backdrop for menus.
  buildMenuScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1020');
    scene.fog = new THREE.Fog('#0b1020', 60, 400);
    const geo = new THREE.PlaneGeometry(1200, 1200, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, Math.sin(x * 0.02) * 12 + Math.cos(z * 0.03 + x * 0.01) * 14 + Math.sin(x * 0.11 + z * 0.07) * 3);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#233a7a', flatShading: true, roughness: 1 }));
    mesh.position.y = -40;
    scene.add(mesh);
    scene.add(new THREE.HemisphereLight('#6f9bff', '#0b1020', 1.2));
    const sun = new THREE.DirectionalLight('#ffb070', 1.5); sun.position.set(-1, 0.6, -0.5); scene.add(sun);
    // rings floating
    const rg = new THREE.TorusGeometry(6, 0.5, 8, 30);
    const rm = new THREE.MeshStandardMaterial({ color: '#39c6ff', emissive: '#1ea7ff', emissiveIntensity: 0.8 });
    this.menuRings = [];
    for (let i = 0; i < 12; i++) {
      const r = new THREE.Mesh(rg, rm);
      r.position.set((Math.random() - 0.5) * 300, Math.random() * 40 - 10, -60 - i * 30);
      scene.add(r); this.menuRings.push(r);
    }
    return scene;
  }

  startStage(stage, mode) {
    this.ui.loading(true);
    this.ui.show('hud');
    document.getElementById('hud-stage').textContent = (mode === 'endless' ? 'ENDLESS — ' : '') + stage.en;
    setTimeout(() => {
      if (this.game) this.game.dispose();
      this.game = new Game(this, stage, mode);
      this.state = 'game';
      this.paused = false;
      this.ui.loading(false);
      this.clock.getDelta();
    }, 30);
  }

  restart() {
    if (!this.game) return;
    this.ui.showOverlay('result', false);
    this.ui.showOverlay('pause', false);
    this.startStage(this.game.stage, this.game.mode);
  }

  nextStage() {
    const idx = STAGES.indexOf(this.game.stage);
    const next = STAGES[idx + 1];
    if (next && isStageUnlocked(this.save, next)) { this.ui.showOverlay('result', false); this.startStage(next, 'stage'); }
  }

  quitToTitle() {
    if (this.game && !this.game.finished && this.game.phase === 'flying') {
      // abandoning a run still records stats
      this.game.finish('quit');
      this.commitResult(this.game.result);
    }
    if (this.game) { this.game.dispose(); this.game = null; }
    this.state = 'menu'; this.paused = false;
    this.ui.showOverlay('result', false);
    this.ui.showOverlay('pause', false);
    this.ui.show('title');
  }

  togglePause() {
    if (this.state !== 'game' || this.game.finished) return;
    this.paused = !this.paused;
    this.ui.showOverlay('pause', this.paused);
    if (!this.paused) this.clock.getDelta();
  }

  resetSave() {
    this.save = resetSave();
    this.audio.settings = this.save.settings;
    this.ui.app = this;
    location.reload();
  }

  commitResult(res) {
    const fresh = checkAchievements(this.save);
    res.achievements = fresh;
    persist(this.save);
    for (const a of fresh) { this.ui.toast(`🏆 実績解除: ${a.name}`); this.audio.unlock(); }
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    let dt = Math.min(0.05, this.clock.getDelta());
    const g = this.game;
    if (this.state === 'game' && g) {
      if (this.input.consume('Escape') || this.input.consume('KeyP')) this.togglePause();
      if (!this.paused) {
        this.input.update(this.save.settings.sensitivity);
        const ev = g.update(dt, this.input);
        this.audio.update(dt, { speed: g.player.speed, boosting: ev.boosting, flying: g.phase === 'flying' });
        this.ui.hud(g.hudState(), g, this.camera);
        if (g.finished && !g.resultShown) {
          g.resultShown = true;
          this.commitResult(g.result);
          setTimeout(() => { if (this.game === g) this.ui.showResult(g, g.result); }, g.stats.finished ? 900 : 1300);
        }
      }
      this.renderer.render(g.scene, this.camera);
    } else {
      // menu backdrop
      const t = performance.now() / 1000;
      this.camera.position.set(Math.sin(t * 0.1) * 30, 12 + Math.sin(t * 0.17) * 4, 40);
      this.camera.lookAt(0, 0, -100);
      this.camera.fov = 60; this.camera.updateProjectionMatrix();
      for (const r of this.menuRings) { r.rotation.y += dt * 0.5; r.position.y += Math.sin(t + r.position.x) * dt * 2; }
      this.audio.update(dt, { menu: true });
      this.renderer.render(this.menuScene, this.camera);
    }
    this.input.endFrame();
  }
}

window.app = new App();
