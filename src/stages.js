// stages.js — stage (biome) definitions, upgrades, skins, achievements.

export const STAGES = [
  {
    id: 'alpine', name: '高原の岬', en: 'ALPINE MEADOWS', icon: '🏔️',
    desc: '緑の丘と湖が広がる、はじまりの崖。基本操作をここで覚えよう。',
    unlockStars: 0, length: 4200, parTime: 105, kind: 'hills', seed: 101,
    cliffHeight: 560, goalHeight: 40,
    sky: { top: '#2f6fd1', bottom: '#cfe8ff', fog: '#c6ddf4', fogNear: 500, fogFar: 2500, sun: '#fff3d2', sunDir: [0.45, 0.55, -0.5], hemi: ['#a9cdf0', '#4c6a3c'] },
    water: { level: -12, color: '#2b6fb0', opacity: 0.82 },
    palette: { bands: [[-30, '#c9b37a'], [0, '#3d7d3e'], [140, '#5a9a4a'], [280, '#7e8c70'], [360, '#8d8f8a'], [430, '#f2f5f7']], cliff: '#6e675c' },
    deco: [{ type: 'pine', density: 1.0, minH: -4, maxH: 330, maxSlope: 0.55 }, { type: 'rock', density: 0.2, minH: 150, maxH: 900, maxSlope: 1 }],
    wind: { x: 1.5, gust: 1.5 },
    rings: 20, gemDensity: 1.0, medals: [2500, 5500, 9000],
    missions: [
      { type: 'rings', n: 20, text: '全てのリングを通過する' },
      { type: 'gems', n: 70, text: 'ジェムを70個集める' },
      { type: 'time', n: 95, text: '95秒以内にゴールする' },
    ],
  },
  {
    id: 'canyon', name: '赤の峡谷', en: 'RED CANYON', icon: '🏜️',
    desc: '赤い岩のメサと深い谷。谷底スレスレを攻めれば高得点。',
    unlockStars: 2, length: 4800, parTime: 110, kind: 'canyon', seed: 202,
    cliffHeight: 520, goalHeight: 30,
    sky: { top: '#3c7bd6', bottom: '#f7d9b0', fog: '#e9cfae', fogNear: 400, fogFar: 2300, sun: '#ffe9c4', sunDir: [-0.5, 0.5, -0.4], hemi: ['#f2d9b5', '#7a4a2c'] },
    water: { level: -60, color: '#3f7f5a', opacity: 0.8 },
    palette: { bands: [[-60, '#b58a5a'], [0, '#c98b52'], [80, '#c2603c'], [160, '#d98a4e'], [240, '#b5533a'], [330, '#e6b283']], cliff: '#9c3f2b' },
    deco: [{ type: 'cactus', density: 0.6, minH: -40, maxH: 260, maxSlope: 0.35 }, { type: 'rock', density: 0.5, minH: -60, maxH: 400, maxSlope: 1 }, { type: 'deadtree', density: 0.15, minH: -40, maxH: 200, maxSlope: 0.4 }],
    wind: { x: -3, gust: 3 },
    rings: 24, gemDensity: 1.1, medals: [3500, 7000, 11500],
    missions: [
      { type: 'proximity', n: 12, text: '地面スレスレを合計12秒飛ぶ' },
      { type: 'rings', n: 24, text: '全てのリングを通過する' },
      { type: 'rolls', n: 3, text: 'バレルロールを3回決める' },
    ],
  },
  {
    id: 'islands', name: '珊瑚の群島', en: 'CORAL ISLANDS', icon: '🏝️',
    desc: 'エメラルドの海に浮かぶ島々。海面に落ちないように島から島へ。',
    unlockStars: 5, length: 5200, parTime: 120, kind: 'islands', seed: 303,
    cliffHeight: 470, goalHeight: 12,
    sky: { top: '#1f7fe0', bottom: '#dff4ff', fog: '#d2eefc', fogNear: 600, fogFar: 2800, sun: '#ffffff', sunDir: [0.2, 0.75, -0.3], hemi: ['#bfe6ff', '#1f7f9a'] },
    water: { level: 0, color: '#19a3b8', opacity: 0.78 },
    palette: { bands: [[-10, '#e6d9a6'], [4, '#f0e3ad'], [14, '#57b35a'], [80, '#3c8f45'], [180, '#6d8f5a'], [300, '#9a9a90']], cliff: '#7a6a55' },
    deco: [{ type: 'palm', density: 1.0, minH: 3, maxH: 60, maxSlope: 0.4 }, { type: 'broadleaf', density: 0.7, minH: 20, maxH: 220, maxSlope: 0.6 }, { type: 'rock', density: 0.15, minH: 5, maxH: 400, maxSlope: 1 }],
    wind: { x: 4, gust: 2.5 },
    rings: 26, gemDensity: 1.15, medals: [4000, 8000, 13000],
    missions: [
      { type: 'gems', n: 120, text: 'ジェムを120個集める' },
      { type: 'noboost', n: 1, text: 'ブーストを使わずにゴールする' },
      { type: 'time', n: 108, text: '108秒以内にゴールする' },
    ],
  },
  {
    id: 'volcano', name: '灼熱の火山', en: 'VOLCANIC WASTES', icon: '🌋',
    desc: '黒い岩と溶岩の湖。上昇気流に乗れば火口の上を越えられる。',
    unlockStars: 9, length: 5400, parTime: 125, kind: 'volcano', seed: 404,
    cliffHeight: 600, goalHeight: 50,
    sky: { top: '#3a2430', bottom: '#f08a4a', fog: '#c96f45', fogNear: 300, fogFar: 1900, sun: '#ffb070', sunDir: [0.1, 0.35, -0.9], hemi: ['#ff9a5a', '#2a1a1a'] },
    water: { level: -30, color: '#ff5a1a', opacity: 0.95, lava: true },
    palette: { bands: [[-30, '#3a2521'], [0, '#2b2422'], [120, '#3d3634'], [260, '#5a4d47'], [380, '#7a5a4a'], [480, '#8f6a55']], cliff: '#1e1a1a' },
    deco: [{ type: 'rock', density: 0.7, minH: -20, maxH: 800, maxSlope: 1 }, { type: 'deadtree', density: 0.3, minH: 0, maxH: 250, maxSlope: 0.4 }, { type: 'lavarock', density: 0.4, minH: -25, maxH: 120, maxSlope: 0.6 }],
    wind: { x: -2, gust: 5 },
    rings: 26, gemDensity: 1.2, medals: [4500, 9000, 14500],
    missions: [
      { type: 'proximity', n: 18, text: '地面スレスレを合計18秒飛ぶ' },
      { type: 'clean', n: 1, text: '一度も地面に触れずにゴールする' },
      { type: 'speed', n: 110, text: '最高速度 400km/h を出す' },
    ],
  },
  {
    id: 'fjord', name: '極北の氷河', en: 'FROZEN FJORDS', icon: '🧊',
    desc: '氷に閉ざされた峡湾。強風と細いフィヨルドが行く手を阻む。',
    unlockStars: 13, length: 5800, parTime: 130, kind: 'fjord', seed: 505,
    cliffHeight: 640, goalHeight: 15,
    sky: { top: '#5b7fb5', bottom: '#eaf2fb', fog: '#dfe9f4', fogNear: 400, fogFar: 2300, sun: '#fff8ee', sunDir: [-0.6, 0.3, -0.5], hemi: ['#dbe9f7', '#5a6f80'] },
    water: { level: 0, color: '#1f4f7a', opacity: 0.9 },
    palette: { bands: [[-5, '#7f8f9a'], [5, '#a8b7c2'], [60, '#dfe6ec'], [180, '#f4f8fb'], [350, '#ffffff'], [500, '#e8f0f8']], cliff: '#5b6772' },
    deco: [{ type: 'ice', density: 0.6, minH: 2, maxH: 400, maxSlope: 0.7 }, { type: 'pine', density: 0.35, minH: 5, maxH: 120, maxSlope: 0.5, snow: true }, { type: 'rock', density: 0.2, minH: 0, maxH: 600, maxSlope: 1 }],
    wind: { x: 6, gust: 6 },
    rings: 28, gemDensity: 1.2, medals: [5000, 10000, 16000],
    missions: [
      { type: 'rings', n: 28, text: '全てのリングを通過する' },
      { type: 'combo', n: 15, text: 'リングを15連続で通過する' },
      { type: 'time', n: 112, text: '112秒以内にゴールする' },
    ],
  },
  {
    id: 'sky', name: '天空の遺跡', en: 'SKY RUINS', icon: '☁️',
    desc: '雲海に浮かぶ島と古代の柱。雲の底に落ちれば二度と戻れない。',
    unlockStars: 17, length: 6200, parTime: 135, kind: 'sky', seed: 606,
    cliffHeight: 600, goalHeight: 240,
    sky: { top: '#2a1f5e', bottom: '#ffb38a', fog: '#e9b6a8', fogNear: 500, fogFar: 2600, sun: '#ffd2a0', sunDir: [0.3, 0.2, -0.9], hemi: ['#ffc4a0', '#5b4a7a'] },
    water: { level: -400, color: '#f3e7e8', opacity: 1, cloudsea: true },
    palette: { bands: [[-400, '#f6ecec'], [-300, '#f6ecec'], [120, '#c9a8b8'], [180, '#6fae7a'], [300, '#8fbf88'], [420, '#d8cfc4']], cliff: '#a48a9c' },
    deco: [{ type: 'pillar', density: 0.35, minH: 160, maxH: 600, maxSlope: 0.3 }, { type: 'broadleaf', density: 0.7, minH: 170, maxH: 600, maxSlope: 0.6 }, { type: 'rock', density: 0.2, minH: 150, maxH: 700, maxSlope: 1 }],
    wind: { x: 3, gust: 4 },
    rings: 30, gemDensity: 1.3, medals: [6000, 12000, 19000],
    missions: [
      { type: 'gems', n: 160, text: 'ジェムを160個集める' },
      { type: 'rolls', n: 6, text: 'バレルロールを6回決める' },
      { type: 'score', n: 15000, text: 'スコア15000以上でゴールする' },
    ],
  },
];

export const ENDLESS_UNLOCK_STARS = 4;

export const UPGRADES = [
  { id: 'lift', name: '揚力ウイング', icon: '🪽', desc: '滑空時の沈下が減り、遠くまで飛べる', max: 5, base: 120 },
  { id: 'agility', name: '旋回性能', icon: '🌀', desc: '操作への反応が速くなる', max: 5, base: 100 },
  { id: 'dive', name: 'ダイブ加速', icon: '⚡', desc: '急降下の加速と最高速度が上がる', max: 5, base: 150 },
  { id: 'boost', name: 'ブーストタンク', icon: '🔥', desc: 'ブースト容量と回復速度が上がる', max: 5, base: 130 },
  { id: 'magnet', name: 'ジェムマグネット', icon: '🧲', desc: 'ジェムを吸い寄せる範囲が広がる', max: 5, base: 110 },
  { id: 'armor', name: 'プロテクター', icon: '🛡️', desc: '地面に接触してもバウンドして飛び続けられる回数', max: 3, base: 300 },
];

export function upgradeCost(u, level) {
  return Math.round(u.base * Math.pow(level + 1, 1.8));
}

export const SKINS = [
  { id: 'orange', name: 'サンライズ', color: '#ff7a1a', req: null },
  { id: 'sky', name: 'スカイブルー', color: '#2fa8ff', req: { stars: 3 } },
  { id: 'lime', name: 'ライムグリーン', color: '#9dff3a', req: { stars: 6 } },
  { id: 'magenta', name: 'マゼンタ', color: '#ff3fa8', req: { rolls: 30 } },
  { id: 'white', name: 'スノーホワイト', color: '#f4f6ff', req: { stars: 12 } },
  { id: 'gold', name: 'ゴールド', color: '#ffd23a', req: { allGold: true } },
  { id: 'black', name: 'ステルスブラック', color: '#23242b', req: { endless: 8000 } },
];

export const ACHIEVEMENTS = [
  { id: 'first', name: 'はじめての飛行', desc: '崖から飛び降りる', test: s => s.stats.flights >= 1 },
  { id: 'goal1', name: '着地成功', desc: 'いずれかのステージをゴールする', test: s => s.stats.goals >= 1 },
  { id: 'combo10', name: 'リングマスター', desc: '10連続でリングを通過する', test: s => s.stats.maxCombo >= 10 },
  { id: 'gems500', name: '宝石商', desc: '累計500個のジェムを集める', test: s => s.stats.gemsTotal >= 500 },
  { id: 'gems3000', name: '大富豪', desc: '累計3000個のジェムを集める', test: s => s.stats.gemsTotal >= 3000 },
  { id: 'dist50', name: '長距離飛行', desc: '累計50kmを飛ぶ', test: s => s.stats.distance >= 50000 },
  { id: 'dist200', name: '渡り鳥', desc: '累計200kmを飛ぶ', test: s => s.stats.distance >= 200000 },
  { id: 'roll25', name: 'アクロバット', desc: 'バレルロールを累計25回決める', test: s => s.stats.rolls >= 25 },
  { id: 'prox60', name: 'スレスレ職人', desc: '地面スレスレ飛行を累計60秒', test: s => s.stats.proximity >= 60 },
  { id: 'speed', name: '音速の翼', desc: '時速420km以上を出す', test: s => s.stats.maxSpeed >= 116.7 },
  { id: 'stars9', name: '星の収集家', desc: '星を9個集める', test: s => totalStars(s) >= 9 },
  { id: 'allgold', name: '黄金の翼', desc: '全ステージで金メダルを獲得する', test: s => STAGES.every(st => (s.stars[st.id] || 0) >= 3) },
  { id: 'endless3k', name: '果てなき空', desc: 'エンドレスで3000m到達', test: s => s.endlessBest.distance >= 3000 },
  { id: 'endless8k', name: '空の彼方へ', desc: 'エンドレスで8000m到達', test: s => s.endlessBest.distance >= 8000 },
  { id: 'missions', name: '任務完了', desc: 'すべてのミッションを達成する', test: s => STAGES.every(st => (s.missions[st.id] || []).filter(Boolean).length === 3) },
  { id: 'crash20', name: '不死鳥', desc: '20回墜落してもあきらめない', test: s => s.stats.crashes >= 20 },
];

export function totalStars(save) {
  return STAGES.reduce((a, st) => a + (save.stars[st.id] || 0), 0);
}
