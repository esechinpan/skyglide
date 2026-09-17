// deco.js — low-poly decoration templates (trees, rocks, pillars...) with vertex colors,
// merged per terrain chunk into a single mesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function colored(geom, color) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function part(geom, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const g = colored(geom, color);
  g.scale(s, s, s);
  g.rotateZ(rz); g.rotateX(rx); g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

const cache = new Map();

export function template(type, variant = 0) {
  const key = type + ':' + variant;
  if (cache.has(key)) return cache.get(key);
  let parts = [];
  switch (type) {
    case 'pine': {
      const leaf = variant === 1 ? '#dfe9ee' : (variant === 2 ? '#1f5a2c' : '#2b6b34');
      parts = [
        part(new THREE.CylinderGeometry(0.25, 0.4, 2.2, 5), '#5a3b22', 0, 1.1, 0),
        part(new THREE.ConeGeometry(2.4, 5.5, 6), leaf, 0, 4.2, 0),
        part(new THREE.ConeGeometry(1.7, 4.5, 6), leaf, 0, 7, 0),
        part(new THREE.ConeGeometry(1.0, 3.2, 6), leaf, 0, 9.2, 0),
      ];
      break;
    }
    case 'broadleaf':
      parts = [
        part(new THREE.CylinderGeometry(0.3, 0.45, 3.2, 5), '#6b4a2b', 0, 1.6, 0),
        part(new THREE.DodecahedronGeometry(2.9, 0), variant === 1 ? '#5aa646' : '#3f8f3b', 0, 5.2, 0, 0.3, 0.5, 0),
        part(new THREE.DodecahedronGeometry(2.0, 0), '#4b9a44', 1.6, 4.2, 0.8, 0.1, 0.9, 0.2),
      ];
      break;
    case 'palm': {
      parts = [part(new THREE.CylinderGeometry(0.22, 0.42, 8, 5), '#8a6a45', 0.4, 4, 0, 0, 0, -0.1)];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const leaf = colored(new THREE.BoxGeometry(3.6, 0.12, 0.9), '#3fa04a');
        leaf.translate(1.9, 0, 0);
        leaf.rotateZ(-0.45);
        leaf.rotateY(a);
        leaf.translate(0.8, 7.7, 0);
        parts.push(leaf);
      }
      break;
    }
    case 'cactus':
      parts = [
        part(new THREE.CylinderGeometry(0.5, 0.6, 5.5, 6), '#3d8b4a', 0, 2.75, 0),
        part(new THREE.CylinderGeometry(0.32, 0.32, 2.4, 6), '#3d8b4a', -1.1, 3.2, 0, 0, 0, 1.2),
        part(new THREE.CylinderGeometry(0.32, 0.32, 2.0, 6), '#3d8b4a', -1.8, 4.3, 0),
        part(new THREE.CylinderGeometry(0.32, 0.32, 2.0, 6), '#3d8b4a', 1.0, 2.6, 0, 0, 0, -1.2),
        part(new THREE.CylinderGeometry(0.32, 0.32, 1.8, 6), '#3d8b4a', 1.7, 3.6, 0),
      ];
      break;
    case 'rock':
      parts = [
        part(new THREE.DodecahedronGeometry(1.8, 0), variant === 1 ? '#8a8378' : '#6f6a62', 0, 0.6, 0, 0.3, 0.7, 0.2),
        part(new THREE.DodecahedronGeometry(1.1, 0), '#7d776d', 1.6, 0.3, 0.6, 0.1, 0.2, 0.5),
      ];
      parts[0].scale(1.3, 0.8, 1.1);
      break;
    case 'lavarock':
      parts = [part(new THREE.DodecahedronGeometry(1.6, 0), '#4a2a22', 0, 0.5, 0, 0.4, 0.3, 0.1)];
      break;
    case 'deadtree':
      parts = [
        part(new THREE.CylinderGeometry(0.18, 0.4, 6, 5), '#3b2f28', 0, 3, 0),
        part(new THREE.CylinderGeometry(0.08, 0.16, 3, 4), '#3b2f28', -0.9, 4.6, 0, 0, 0, 0.9),
        part(new THREE.CylinderGeometry(0.08, 0.16, 2.6, 4), '#3b2f28', 0.8, 5.2, 0.2, 0.3, 0, -0.8),
      ];
      break;
    case 'ice':
      parts = [
        part(new THREE.ConeGeometry(1.3, 7, 5), '#cfe8ff', 0, 3.5, 0, 0.1, 0, 0.1),
        part(new THREE.ConeGeometry(0.8, 4, 5), '#e6f3ff', 1.3, 2, 0.4, -0.1, 0, -0.3),
        part(new THREE.ConeGeometry(0.6, 3, 5), '#bfe0ff', -1.1, 1.5, -0.5, 0.2, 0, 0.3),
      ];
      break;
    case 'pillar':
      parts = [
        part(new THREE.CylinderGeometry(1.1, 1.3, 1.2, 8), '#c9bda6', 0, 0.6, 0),
        part(new THREE.CylinderGeometry(0.85, 0.95, variant === 1 ? 6 : 12, 8), '#ddd1bb', 0, variant === 1 ? 4 : 7, 0),
      ];
      if (variant !== 1) parts.push(part(new THREE.BoxGeometry(2.6, 0.7, 2.6), '#c9bda6', 0, 13.3, 0));
      break;
    default:
      parts = [part(new THREE.BoxGeometry(1, 1, 1), '#ff00ff', 0, 0.5, 0)];
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  cache.set(key, merged);
  return merged;
}

const VARIANTS = { pine: 3, broadleaf: 2, rock: 2, pillar: 2 };

// Build a merged decoration geometry for a chunk. `rng` is a seeded PRNG for this chunk.
export function buildDecoGeometry(rules, rng, ox, oz, size, heightAt, waterLevel, densityScale = 1) {
  const geoms = [];
  const EPS = 4;
  for (const rule of rules) {
    const count = Math.floor(rule.density * 40 * densityScale);
    for (let i = 0; i < count; i++) {
      const x = ox + rng() * size, z = oz + rng() * size;
      const h = heightAt(x, z);
      if (h < rule.minH || h > rule.maxH || h < waterLevel + 1.5) continue;
      const dx = heightAt(x + EPS, z) - heightAt(x - EPS, z);
      const dz = heightAt(x, z + EPS) - heightAt(x, z - EPS);
      const slope = Math.hypot(dx, dz) / (2 * EPS);
      if (slope > rule.maxSlope) continue;
      let variant = 0;
      if (rule.snow) variant = 1;
      else if (VARIANTS[rule.type]) variant = Math.floor(rng() * VARIANTS[rule.type]);
      const g = template(rule.type, variant).clone();
      const s = 0.75 + rng() * 0.8;
      g.scale(s, s, s);
      g.rotateY(rng() * Math.PI * 2);
      g.translate(x, h - 0.3, z);
      geoms.push(g);
    }
  }
  if (!geoms.length) return null;
  const merged = mergeGeometries(geoms, false);
  for (const g of geoms) g.dispose();
  return merged;
}

// Cloud clusters used as a single merged mesh.
export function buildClouds(rng, count, xRange, zMin, zMax, yMin, yMax) {
  const geoms = [];
  for (let c = 0; c < count; c++) {
    const cx = (rng() * 2 - 1) * xRange, cz = zMin + rng() * (zMax - zMin), cy = yMin + rng() * (yMax - yMin);
    const puffs = 4 + Math.floor(rng() * 5);
    const w = 60 + rng() * 120;
    for (let p = 0; p < puffs; p++) {
      const r = 18 + rng() * 30;
      const g = colored(new THREE.IcosahedronGeometry(r, 1), '#ffffff');
      g.scale(1.6, 0.7, 1.2);
      g.translate(cx + (rng() - 0.5) * w, cy + (rng() - 0.5) * 18, cz + (rng() - 0.5) * w * 0.5);
      geoms.push(g);
    }
  }
  const merged = mergeGeometries(geoms, false);
  for (const g of geoms) g.dispose();
  return merged;
}
