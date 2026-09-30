import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene as ThreeScene,
  Shape,
  ShapeGeometry,
} from 'three';
import { color, createRenderer } from './common';
import type { SceneColors, SceneFactory } from './types';

/**
 * A crib mobile: paper shapes (moon, stars, cloud, heart) hanging from a ring that turns slowly.
 * The turn is faked in 2D: each shape moves round an ellipse, getting smaller and fainter behind.
 */

function moon(r: number) {
  const s = new Shape();
  s.moveTo(0, r);
  s.absarc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  // The inner curve bows left (its leftmost point is at control.x / 2), leaving a crescent.
  s.quadraticCurveTo(-r * 1.25, 0, 0, r);
  return s;
}

function star(r: number) {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}

function cloud(r: number) {
  const s = new Shape();
  s.moveTo(-0.9 * r, -0.4 * r);
  s.lineTo(0.9 * r, -0.4 * r);
  s.absarc(0.6 * r, 0, 0.42 * r, -0.8, 1.9, false);
  s.absarc(0, 0.25 * r, 0.55 * r, 0.6, 2.55, false);
  s.absarc(-0.6 * r, 0, 0.42 * r, 1.3, 3.9, false);
  s.closePath();
  return s;
}

function heart(r: number) {
  const s = new Shape();
  s.moveTo(0, -r * 0.8);
  s.bezierCurveTo(-r * 1.2, -r * 0.1, -r * 0.7, r * 0.9, 0, r * 0.35);
  s.bezierCurveTo(r * 0.7, r * 0.9, r * 1.2, -r * 0.1, 0, -r * 0.8);
  return s;
}

const ITEMS = [
  { shape: moon(0.1), len: 0.42, tint: 'a' },
  { shape: star(0.075), len: 0.28, tint: 'c' },
  { shape: cloud(0.11), len: 0.5, tint: 'text' },
  { shape: heart(0.075), len: 0.33, tint: 'b' },
  { shape: star(0.06), len: 0.58, tint: 'a' },
] as const;

const TOP = 0.92;
const R = 0.5;

export const createMobile: SceneFactory = (canvas, colors) => {
  const renderer = createRenderer(canvas);
  const scene = new ThreeScene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 10);
  camera.position.z = 5;

  const tint = (c: SceneColors, k: (typeof ITEMS)[number]['tint']) => color(c[k]);
  const ringMat = new LineBasicMaterial({ color: color(colors.text), transparent: true, opacity: 0.35 });
  const ringGeo = new BufferGeometry();
  const ringPts = new Float32Array(64 * 3);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    ringPts.set([Math.cos(a) * R, TOP + Math.sin(a) * 0.04, 0], i * 3);
  }
  ringGeo.setAttribute('position', new BufferAttribute(ringPts, 3));
  scene.add(new LineLoop(ringGeo, ringMat));

  const stringPos = new Float32Array(ITEMS.length * 6);
  const stringGeo = new BufferGeometry();
  stringGeo.setAttribute('position', new BufferAttribute(stringPos, 3));
  const stringMat = new LineBasicMaterial({ color: color(colors.text), transparent: true, opacity: 0.25 });
  const strings = new LineSegments(stringGeo, stringMat);
  strings.frustumCulled = false;
  scene.add(strings);

  const pieces = ITEMS.map((item, i) => {
    const mat = new MeshBasicMaterial({ color: tint(colors, item.tint), transparent: true, opacity: 0.8 });
    const geo = new ShapeGeometry(item.shape, 24);
    const mesh = new Mesh(geo, mat);
    const g = new Group();
    g.add(mesh);
    scene.add(g);
    return { item, g, mat, geo, phase: (i / ITEMS.length) * Math.PI * 2 };
  });

  return {
    resize(w, h) {
      renderer.setSize(w, h, false);
      const aspect = w / h;
      // Keep shapes round: widen the view on landscape, and on phones keep the mobile a sensible size.
      camera.left = -Math.max(aspect, 0.6);
      camera.right = Math.max(aspect, 0.6);
      camera.updateProjectionMatrix();
    },
    setColors(c) {
      ringMat.color = color(c.text);
      stringMat.color = color(c.text);
      pieces.forEach((p) => (p.mat.color = tint(c, p.item.tint)));
    },
    render(time, _dt, pulse) {
      const turn = time * 0.12;
      pieces.forEach((p, i) => {
        const a = turn + p.phase;
        const depth = Math.sin(a); // -1 behind … 1 in front
        const x = Math.cos(a) * R;
        const sway = Math.sin(time * 0.9 + i * 1.7) * 0.012;
        const y = TOP + depth * 0.04 - p.item.len + sway;
        const scale = 0.8 + 0.2 * (depth + 1) * 0.5 + pulse * 0.05;
        p.g.position.set(x, y, depth);
        p.g.scale.setScalar(scale);
        p.g.rotation.z = Math.sin(time * 0.7 + i) * 0.14;
        p.mat.opacity = 0.45 + 0.4 * (depth + 1) * 0.5;
        p.g.renderOrder = Math.round((depth + 1) * 10);
        stringPos.set([x, TOP + depth * 0.04, depth, x, y + 0.09 * scale, depth], i * 6);
      });
      stringGeo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    },
    dispose() {
      pieces.forEach((p) => {
        p.geo.dispose();
        p.mat.dispose();
      });
      ringGeo.dispose();
      ringMat.dispose();
      stringGeo.dispose();
      stringMat.dispose();
      renderer.dispose();
    },
  };
};
