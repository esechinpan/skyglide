// input.js — keyboard, gamepad and touch input unified into a small state object.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressedOnce = new Set();
    this.pitch = 0;   // +1 = nose up
    this.roll = 0;    // +1 = bank right
    this.boost = false;
    this.brake = false;
    this.touch = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.gamepadIndex = null;

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedOnce.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !isEditable(e.target)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', e => { this.gamepadIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = null; });
  }

  // Attach touch controls to DOM elements.
  attachTouch(stickEl, knobEl, boostBtn, brakeBtn, actionBtn) {
    const stickR = 60;
    const onStart = e => {
      const t = e.changedTouches[0];
      this.touch.active = true; this.touch.id = t.identifier;
      const r = stickEl.getBoundingClientRect();
      this.touch.ox = r.left + r.width / 2; this.touch.oy = r.top + r.height / 2;
      this.touch.x = 0; this.touch.y = 0;
      e.preventDefault();
    };
    const onMove = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.id) continue;
        let dx = t.clientX - this.touch.ox, dy = t.clientY - this.touch.oy;
        const d = Math.hypot(dx, dy);
        if (d > stickR) { dx *= stickR / d; dy *= stickR / d; }
        this.touch.x = dx / stickR; this.touch.y = dy / stickR;
        knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      e.preventDefault();
    };
    const onEnd = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.id) continue;
        this.touch.active = false; this.touch.x = 0; this.touch.y = 0;
        knobEl.style.transform = '';
      }
    };
    stickEl.addEventListener('touchstart', onStart, { passive: false });
    stickEl.addEventListener('touchmove', onMove, { passive: false });
    stickEl.addEventListener('touchend', onEnd);
    stickEl.addEventListener('touchcancel', onEnd);
    const hold = (el, key) => {
      el.addEventListener('touchstart', e => { this.keys.add(key); this.pressedOnce.add(key); e.preventDefault(); }, { passive: false });
      el.addEventListener('touchend', () => this.keys.delete(key));
      el.addEventListener('touchcancel', () => this.keys.delete(key));
    };
    hold(boostBtn, 'ShiftLeft');
    hold(brakeBtn, 'KeyX');
    hold(actionBtn, 'Space');
  }

  pollGamepad() {
    if (this.gamepadIndex == null || !navigator.getGamepads) return null;
    const gp = navigator.getGamepads()[this.gamepadIndex];
    if (!gp) return null;
    const dz = v => Math.abs(v) < 0.12 ? 0 : v;
    return {
      roll: dz(gp.axes[0] || 0),
      pitch: -dz(gp.axes[1] || 0),
      boost: (gp.buttons[7] && gp.buttons[7].pressed) || (gp.buttons[0] && gp.buttons[0].pressed),
      brake: (gp.buttons[6] && gp.buttons[6].pressed) || (gp.buttons[1] && gp.buttons[1].pressed),
      rollL: gp.buttons[4] && gp.buttons[4].pressed,
      rollR: gp.buttons[5] && gp.buttons[5].pressed,
      start: gp.buttons[9] && gp.buttons[9].pressed,
    };
  }

  update(sensitivity = 1) {
    const k = this.keys;
    let pitch = 0, roll = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) pitch -= 1;     // push forward = dive
    if (k.has('KeyS') || k.has('ArrowDown')) pitch += 1;   // pull back = nose up
    if (k.has('KeyA') || k.has('ArrowLeft')) roll -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) roll += 1;
    this.boost = k.has('ShiftLeft') || k.has('ShiftRight');
    this.brake = k.has('KeyX') || k.has('ControlLeft');
    this.trickL = this.consume('KeyQ');
    this.trickR = this.consume('KeyE');

    const gp = this.pollGamepad();
    if (gp) {
      if (Math.abs(gp.pitch) > 0) pitch = gp.pitch;
      if (Math.abs(gp.roll) > 0) roll = gp.roll;
      this.boost = this.boost || gp.boost;
      this.brake = this.brake || gp.brake;
      if (gp.rollL && !this._gpL) this.trickL = true;
      if (gp.rollR && !this._gpR) this.trickR = true;
      if (gp.start && !this._gpStart) this.pressedOnce.add('Escape');
      if (gp.boost && !this._gpA) this.pressedOnce.add('Space');
      this._gpL = gp.rollL; this._gpR = gp.rollR; this._gpStart = gp.start; this._gpA = gp.boost;
    }
    if (this.touch.active) {
      roll = this.touch.x;
      pitch = this.touch.y;   // drag down = pull up
    }
    this.pitch = Math.max(-1, Math.min(1, pitch * sensitivity));
    this.roll = Math.max(-1, Math.min(1, roll * sensitivity));
  }

  consume(code) {
    if (this.pressedOnce.has(code)) { this.pressedOnce.delete(code); return true; }
    return false;
  }

  endFrame() { this.pressedOnce.clear(); }
}

function isEditable(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}
