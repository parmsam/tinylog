import { BufferAttribute, BufferGeometry, OrthographicCamera, Points, Scene as ThreeScene, ShaderMaterial } from 'three';
import { color, createRenderer } from './common';
import type { SceneFactory } from './types';

/** Light snow: soft flakes falling at different depths, drifting side to side. */
const COUNT = 260;

const vertexShader = /* glsl */ `
  attribute vec3 seed; // x, phase, depth
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vDepth;
  void main() {
    float depth = seed.z;
    float y = 1.0 - fract(seed.y + uTime * (0.02 + depth * 0.05));
    float x = fract(seed.x + sin(uTime * 0.4 + seed.y * 20.0) * 0.02 * depth + uTime * 0.004);
    gl_Position = vec4(x * 2.2 - 1.1, y * 2.2 - 1.1, 0.0, 1.0);
    gl_PointSize = (3.0 + depth * 9.0) * uPixelRatio;
    vDepth = depth;
  }
`;
const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uPulse;
  varying float vDepth;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d) * (0.25 + 0.55 * vDepth) * (0.9 + 0.3 * uPulse);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export const createSnow: SceneFactory = (canvas, colors) => {
  const renderer = createRenderer(canvas);
  const scene = new ThreeScene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const seeds = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) seeds.set([Math.random(), Math.random(), Math.random()], i * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute('seed', new BufferAttribute(seeds, 3));
  const uniforms = { uTime: { value: 0 }, uPulse: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uColor: { value: color(colors.text) } };
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, premultipliedAlpha: true });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  return {
    resize(w, h) {
      renderer.setSize(w, h, false);
    },
    setColors(c) {
      uniforms.uColor.value = color(c.text);
    },
    render(time, _dt, pulse) {
      uniforms.uTime.value = time;
      uniforms.uPulse.value = pulse;
      renderer.render(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
};
