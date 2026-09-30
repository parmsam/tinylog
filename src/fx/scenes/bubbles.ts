import { BufferAttribute, BufferGeometry, OrthographicCamera, Points, Scene as ThreeScene, ShaderMaterial } from 'three';
import { color, createRenderer } from './common';
import type { SceneFactory } from './types';

/** Bath bubbles rising slowly and wobbling, with a thin iridescent rim and a highlight. */
const COUNT = 60;

const vertexShader = /* glsl */ `
  attribute vec3 seed; // x start, speed, size
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHeight;
  varying float vSeed;
  void main() {
    float s = seed.z;
    float y = fract(seed.y * 7.13 + uTime * (0.015 + seed.y * 0.02));
    float x = seed.x + sin(uTime * (0.5 + s) + s * 30.0) * 0.03;
    gl_Position = vec4(x * 2.0 - 1.0, y * 2.3 - 1.15, 0.0, 1.0);
    gl_PointSize = (14.0 + s * 46.0) * uPixelRatio * uHeight;
    vSeed = s;
  }
`;
const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uA, uB, uText;
  uniform float uPulse;
  varying float vSeed;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float rim = smoothstep(0.36, 0.47, d) * smoothstep(0.5, 0.47, d);
    float fill = smoothstep(0.5, 0.0, d) * 0.06;
    float shine = smoothstep(0.12, 0.0, length(p - vec2(-0.16, -0.16)));
    vec3 rimColor = mix(uA, uB, 0.5 + 0.5 * sin(atan(p.y, p.x) * 2.0 + vSeed * 12.0));
    vec3 c = rimColor * rim + uText * (shine * 0.9 + fill);
    float a = (rim * 0.55 + shine * 0.6 + fill) * (0.8 + 0.4 * uPulse);
    gl_FragColor = vec4(c * a, a);
  }
`;

export const createBubbles: SceneFactory = (canvas, colors) => {
  const renderer = createRenderer(canvas);
  const scene = new ThreeScene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const seeds = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) seeds.set([Math.random(), Math.random(), Math.random() ** 2], i * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute('seed', new BufferAttribute(seeds, 3));
  const uniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uHeight: { value: 1 },
    uA: { value: color(colors.a) },
    uB: { value: color(colors.c) },
    uText: { value: color(colors.text) },
  };
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, premultipliedAlpha: true });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  return {
    resize(w, h) {
      renderer.setSize(w, h, false);
      uniforms.uHeight.value = Math.min(1.4, Math.max(0.7, h / 800));
    },
    setColors(c) {
      uniforms.uA.value = color(c.a);
      uniforms.uB.value = color(c.c);
      uniforms.uText.value = color(c.text);
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
