// save.js — localStorage progression.
import { ACHIEVEMENTS, SKINS, STAGES, totalStars } from './stages.js';

const KEY = 'skyglide.save.v1';

function defaults() {
  return {
    gems: 0,
    stars: {},          // stageId -> 0..3
    best: {},           // stageId -> { score, time }
    missions: {},       // stageId -> [bool, bool, bool]
    upgrades: { lift: 0, agility: 0, dive: 0, boost: 0, magnet: 0, armor: 0 },
    skin: 'orange',
    achievements: [],
    endlessBest: { distance: 0, score: 0 },
    stats: { flights: 0, goals: 0, crashes: 0, distance: 0, rings: 0, gemsTotal: 0, rolls: 0, proximity: 0, maxSpeed: 0, maxCombo: 0 },
    settings: { invertY: false, sensitivity: 1, quality: 'high', sfx: true, music: true, camera: 'chase' },
  };
}

function merge(base, obj) {
  for (const k of Object.keys(obj || {})) {
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]) && base[k] && typeof base[k] === 'object') merge(base[k], obj[k]);
    else base[k] = obj[k];
  }
  return base;
}

export function loadSave() {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) merge(d, JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return d;
}

export function persist(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  return defaults();
}

export function isStageUnlocked(save, stage) {
  return totalStars(save) >= stage.unlockStars;
}

export function isSkinUnlocked(save, skin) {
  const r = skin.req;
  if (!r) return true;
  if (r.stars != null) return totalStars(save) >= r.stars;
  if (r.rolls != null) return save.stats.rolls >= r.rolls;
  if (r.endless != null) return save.endlessBest.distance >= r.endless;
  if (r.allGold) return STAGES.every(st => (save.stars[st.id] || 0) >= 3);
  return false;
}

// Evaluate achievements, return list of newly unlocked ones.
export function checkAchievements(save) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id)) continue;
    let ok = false;
    try { ok = a.test(save); } catch (e) { ok = false; }
    if (ok) { save.achievements.push(a.id); fresh.push(a); }
  }
  return fresh;
}

export function skinColor(save) {
  const s = SKINS.find(k => k.id === save.skin) || SKINS[0];
  return s.color;
}
