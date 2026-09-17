// ui.js — DOM menus, HUD and result screens.
import { STAGES, UPGRADES, SKINS, ACHIEVEMENTS, ENDLESS_UNLOCK_STARS, upgradeCost, totalStars } from './stages.js';
import { isStageUnlocked, isSkinUnlocked, persist } from './save.js';

const $ = id => document.getElementById(id);
const fmtTime = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor(app) {
    this.app = app;
    this.current = 'title';
    for (const b of document.querySelectorAll('[data-go]')) b.addEventListener('click', () => { app.audio.click(); this.show(b.dataset.go); });
    $('btn-endless').addEventListener('click', () => {
      if (totalStars(app.save) < ENDLESS_UNLOCK_STARS) { this.toast(`エンドレスは星${ENDLESS_UNLOCK_STARS}個で解放`); return; }
      app.audio.click(); this.showEndlessPicker();
    });
    $('btn-pause').addEventListener('click', () => app.togglePause());
    $('btn-resume').addEventListener('click', () => app.togglePause());
    $('btn-restart').addEventListener('click', () => app.restart());
    $('btn-quit').addEventListener('click', () => app.quitToTitle());
    $('btn-retry').addEventListener('click', () => app.restart());
    $('btn-next').addEventListener('click', () => app.nextStage());
    $('btn-result-title').addEventListener('click', () => app.quitToTitle());
    $('btn-reset').addEventListener('click', () => { if (confirm('本当にセーブデータを消去しますか？')) app.resetSave(); });

    // settings
    const s = app.save.settings;
    $('set-invert').checked = s.invertY;
    $('set-sens').value = s.sensitivity;
    $('set-quality').value = s.quality;
    $('set-sfx').checked = s.sfx;
    $('set-music').checked = s.music;
    $('set-invert').addEventListener('change', e => { s.invertY = e.target.checked; persist(app.save); });
    $('set-sens').addEventListener('input', e => { s.sensitivity = parseFloat(e.target.value); persist(app.save); });
    $('set-quality').addEventListener('change', e => { s.quality = e.target.value; app.applyQuality(); persist(app.save); });
    $('set-sfx').addEventListener('change', e => { s.sfx = e.target.checked; persist(app.save); });
    $('set-music').addEventListener('change', e => { s.music = e.target.checked; persist(app.save); });

    this.popupsEl = $('hud-popups');
    this.lastHud = {};
  }

  show(name) {
    for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
    this.current = name;
    if (name === 'title') this.renderTitle();
    if (name === 'stages') this.renderStages();
    if (name === 'hangar') this.renderHangar();
    if (name === 'records') this.renderRecords();
    const el = $('screen-' + name) || $(name);
    if (el) el.classList.remove('hidden');
    $('touch').classList.toggle('hidden', !(name === 'hud' && this.app.input.isTouch));
  }

  showOverlay(name, on) { $('screen-' + name).classList.toggle('hidden', !on); }
  loading(on) { $('loading').classList.toggle('hidden', !on); }

  toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    $('toast').appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  renderTitle() {
    const s = this.app.save;
    $('title-stats').innerHTML = `<div>★ <b>${totalStars(s)}</b> / ${STAGES.length * 3}</div><div>◆ <b>${s.gems}</b></div><div>実績 <b>${s.achievements.length}</b> / ${ACHIEVEMENTS.length}</div>`;
  }

  renderStages() {
    const s = this.app.save;
    $('stages-stars').textContent = `★ ${totalStars(s)}`;
    const wrap = $('stage-cards');
    wrap.innerHTML = '';
    for (const st of STAGES) {
      const unlocked = isStageUnlocked(s, st);
      const stars = s.stars[st.id] || 0;
      const best = s.best[st.id];
      const ms = s.missions[st.id] || [false, false, false];
      const card = document.createElement('div');
      card.className = 'card' + (unlocked ? '' : ' locked');
      card.innerHTML = `
        <div class="banner" style="background:linear-gradient(160deg, ${st.sky.top}, ${st.sky.bottom} 60%, ${st.palette.bands[2][1]})">${st.icon}</div>
        <h3>${escapeHtml(st.name)}</h3><div class="en">${st.en}</div>
        <p>${escapeHtml(st.desc)}</p>
        <div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'off'}">★</span>`).join('')}</div>
        <div class="best">${best ? `ベスト ${best.score.toLocaleString()} pts${best.time ? ' ・ ' + fmtTime(best.time) : ''}` : '未クリア'} ・ 金: ${st.medals[2].toLocaleString()}</div>
        <div class="mission-dots">${ms.map(d => `<i class="${d ? 'done' : ''}"></i>`).join('')}<span>ミッション ${ms.filter(Boolean).length}/3</span></div>
        ${unlocked ? '' : `<div class="lock">🔒 ★${st.unlockStars}で解放</div>`}`;
      if (unlocked) card.addEventListener('click', () => { this.app.audio.click(); this.app.startStage(st, 'stage'); });
      wrap.appendChild(card);
    }
  }

  showEndlessPicker() {
    // endless uses stage select too, but flagged
    this.show('stages');
    document.querySelector('#screen-stages h2').textContent = 'エンドレス — 景色を選択';
    const s = this.app.save;
    const cards = $('stage-cards').children;
    STAGES.forEach((st, i) => {
      const card = cards[i];
      const clone = card.cloneNode(true);
      card.replaceWith(clone);
      if (isStageUnlocked(s, st)) clone.addEventListener('click', () => { this.app.audio.click(); this.app.startStage(st, 'endless'); });
      const b = clone.querySelector('.best');
      if (b) b.textContent = `エンドレス最長 ${s.endlessBest.distance}m ・ 最高 ${s.endlessBest.score.toLocaleString()} pts`;
    });
    const back = document.querySelector('#screen-stages [data-go=title]');
    back.onclick = () => { document.querySelector('#screen-stages h2').textContent = 'ステージ選択'; back.onclick = null; };
  }

  renderHangar() {
    const s = this.app.save, app = this.app;
    $('hangar-gems').textContent = `◆ ${s.gems}`;
    const list = $('upgrade-list');
    list.innerHTML = '';
    for (const u of UPGRADES) {
      const lvl = s.upgrades[u.id] || 0;
      const cost = lvl < u.max ? upgradeCost(u, lvl) : null;
      const row = document.createElement('div');
      row.className = 'upg';
      row.innerHTML = `<div class="icon">${u.icon}</div><div class="info"><b>${u.name} <span style="color:var(--muted);font-weight:400">Lv.${lvl}/${u.max}</span></b><small>${u.desc}</small>
        <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn small ${cost != null && s.gems >= cost ? 'primary' : ''}" ${cost == null || s.gems < cost ? 'disabled' : ''}>${cost == null ? 'MAX' : '◆ ' + cost}</button>`;
      row.querySelector('button').addEventListener('click', () => {
        if (cost == null || s.gems < cost) return;
        s.gems -= cost; s.upgrades[u.id] = lvl + 1; persist(s);
        app.audio.unlock(); this.renderHangar();
      });
      list.appendChild(row);
    }
    const skins = $('skin-list');
    skins.innerHTML = '';
    for (const k of SKINS) {
      const ok = isSkinUnlocked(s, k);
      const el = document.createElement('div');
      el.className = 'skin' + (s.skin === k.id ? ' selected' : '') + (ok ? '' : ' locked');
      const req = k.req ? (k.req.stars != null ? `★${k.req.stars}` : k.req.rolls != null ? `ロール${k.req.rolls}回` : k.req.endless != null ? `エンドレス${k.req.endless}m` : '全ステージ金') : '';
      el.innerHTML = `<div class="swatch" style="background:${k.color}"></div>${k.name}${ok ? '' : `<br><small>🔒 ${req}</small>`}`;
      if (ok) el.addEventListener('click', () => { s.skin = k.id; persist(s); app.audio.click(); this.renderHangar(); });
      skins.appendChild(el);
    }
  }

  renderRecords() {
    const s = this.app.save;
    $('achievement-list').innerHTML = ACHIEVEMENTS.map(a => {
      const ok = s.achievements.includes(a.id);
      return `<div class="ach ${ok ? '' : 'locked'}"><div class="mark">${ok ? '🏆' : '🔒'}</div><div><b>${a.name}</b><small>${a.desc}</small></div></div>`;
    }).join('');
    const st = s.stats;
    const rows = [
      ['飛行回数', st.flights], ['ゴール回数', st.goals], ['墜落回数', st.crashes],
      ['累計飛行距離', (st.distance / 1000).toFixed(1) + ' km'], ['累計リング', st.rings], ['累計ジェム', st.gemsTotal],
      ['バレルロール', st.rolls], ['スレスレ飛行', st.proximity.toFixed(0) + ' 秒'], ['最高速度', Math.round(st.maxSpeed * 3.6) + ' km/h'], ['最大コンボ', st.maxCombo],
      ['エンドレス最長', s.endlessBest.distance + ' m'], ['エンドレス最高', s.endlessBest.score.toLocaleString() + ' pts'],
    ];
    $('stats-list').innerHTML = rows.map(([k, v]) => `<div class="statrow"><span>${k}</span><span>${v}</span></div>`).join('');
    $('best-list').innerHTML = STAGES.map(stg => {
      const b = s.best[stg.id];
      return `<div class="statrow"><span>${stg.icon} ${stg.name}</span><span>${b ? b.score.toLocaleString() + ' pts' + (b.time ? ' / ' + fmtTime(b.time) : '') : '—'}</span></div>`;
    }).join('');
  }

  // ---- HUD
  hud(state, game, camera) {
    const L = this.lastHud;
    const set = (id, v) => { if (L[id] !== v) { L[id] = v; $(id).textContent = v; } };
    set('hud-score', state.score.toLocaleString());
    set('hud-combo', state.combo > 1 ? `COMBO ×${Math.min(state.combo, 5)}${state.combo > 5 ? ' (' + state.combo + ')' : ''}` : '');
    set('hud-time', fmtTime(state.time));
    set('hud-rings', state.ringsTotal ? `◎ ${state.rings}/${state.ringsTotal}` : `◎ ${state.rings}`);
    set('hud-gems', `◆ ${state.gems}`);
    set('hud-dist', state.dist != null ? `${state.dist} m` : '');
    set('hud-speed', Math.round(state.speed * 3.6));
    set('hud-alt', Math.round(state.alt));
    set('hud-ground', Math.max(0, Math.round(state.ground)));
    set('hud-bounces', state.bounces > 0 ? '🛡️'.repeat(state.bounces) : '');
    $('hud-boost').style.width = (state.boost * 100).toFixed(0) + '%';
    $('hud-prox').classList.toggle('on', !!state.prox);
    $('ready-prompt').classList.toggle('hidden', state.phase !== 'ready');
    document.getElementById('vignette').style.opacity = Math.min(1, Math.max(0, (state.speed - 50) / 60) + (state.boosting ? 0.3 : 0));

    for (const p of state.popups) {
      const el = document.createElement('div');
      el.className = 'popup ' + p.cls; el.textContent = p.text;
      el.style.top = (Math.random() * 40 - 20) + 'px';
      this.popupsEl.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    }

    // target indicator
    const tEl = $('hud-target'), aEl = $('hud-arrow');
    if (state.target && state.phase === 'flying') {
      const v = state.target.clone().project(camera);
      const dist = state.target.distanceTo(game.player.pos);
      const behind = v.z > 1;
      const W = window.innerWidth, H = window.innerHeight;
      if (!behind && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9) {
        tEl.style.display = 'block'; aEl.style.display = 'none';
        tEl.style.left = ((v.x + 1) / 2 * W) + 'px';
        tEl.style.top = ((1 - v.y) / 2 * H) + 'px';
        set('hud-target-dist', Math.round(dist) + 'm');
      } else {
        tEl.style.display = 'none'; aEl.style.display = 'block';
        let x = v.x, y = v.y;
        if (behind) { x = -x; y = -y; }
        const ang = Math.atan2(y, x);
        const m = 0.86;
        const px = Math.cos(ang), py = Math.sin(ang);
        const k = Math.min(m / Math.abs(px || 1e-6), m * 0.92 / Math.abs(py || 1e-6));
        const sx = (px * k + 1) / 2 * W, sy = (1 - py * k) / 2 * H;
        aEl.style.left = (sx - 17) + 'px'; aEl.style.top = (sy - 24) + 'px';
        aEl.style.transform = `rotate(${-ang}rad)`;
      }
    } else { tEl.style.display = 'none'; aEl.style.display = 'none'; }
  }

  showResult(game, res) {
    const st = res.stats, endless = game.endless;
    $('result-title').textContent = endless ? (st.reason === 'water' ? 'SPLASH' : 'CRASH') : (st.finished ? 'GOAL!' : (st.reason === 'water' ? 'SPLASH...' : 'CRASH...'));
    $('result-medal').innerHTML = endless ? `<span style="font-size:20px">到達距離 <b>${res.distance} m</b></span>${res.newBest ? '<div class="newbest">NEW RECORD!</div>' : ''}`
      : (`${['—', '🥉', '🥈', '🥇'][res.medal]} ${['メダルなし', 'ブロンズ', 'シルバー', 'ゴールド'][res.medal]}` + (res.newMedal ? '<div class="newbest">NEW!</div>' : '') + (res.newBest && !res.newMedal ? '<div class="newbest">NEW BEST!</div>' : ''));
    $('result-score').textContent = st.score.toLocaleString();
    const rows = [
      ['リング', `${st.rings}${st.ringsTotal ? '/' + st.ringsTotal : ''}`], ['最大コンボ', st.maxCombo], ['ジェム / ゴールド', `${st.gems} / ${st.gold}`],
      ['スレスレ飛行', st.proximity.toFixed(1) + ' 秒'], ['バレルロール', st.rolls], ['最高速度', Math.round(st.maxSpeed * 3.6) + ' km/h'], ['タイム', fmtTime(st.time)],
    ];
    if (st.finished) rows.push(['ゴールボーナス', '+' + st.goalBonus], ['タイムボーナス', '+' + st.timeBonus]);
    $('result-breakdown').innerHTML = rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
    $('result-missions').innerHTML = endless ? '' : res.missions.map(m => `<div class="mission ${m.ok ? 'ok' : ''} ${m.fresh ? 'fresh' : ''}">${m.ok ? '✅' : (m.was ? '☑️' : '⬜')} ${escapeHtml(m.text)}</div>`).join('');
    $('result-gems').textContent = `◆ +${res.gemsEarned} ジェム獲得`;
    $('result-ach').innerHTML = res.achievements.map(a => `🏆 実績解除: ${a.name}`).join('<br>');
    const idx = STAGES.indexOf(game.stage);
    const next = STAGES[idx + 1];
    const nextBtn = $('btn-next');
    nextBtn.classList.toggle('hidden', endless || !next || !isStageUnlocked(this.app.save, next));
    this.showOverlay('result', true);
  }
}
