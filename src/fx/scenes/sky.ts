import { AdditiveBlending, BufferAttribute, BufferGeometry, Line, LineBasicMaterial, PerspectiveCamera, Points, Scene as ThreeScene, ShaderMaterial, Vector3 } from 'three';
import { color, createRenderer } from './common';
import type { SceneFactory } from './types';

/** Slowly turning stars that twinkle, and the odd shooting star. */
const COUNT = 2400;

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float phase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uPixelRatio * (950.0 / -mv.z);
    vAlpha = 0.45 + 0.55 * sin(uTime * (0.6 + phase) + phase * 6.2831);
  }
`;
const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uPulse;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha * (1.0 + 0.4 * uPulse);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export const createSky: SceneFactory = (canvas, colors) => {
  const renderer = createRenderer(canvas);
  const scene = new ThreeScene();
  const camera = new PerspectiveCamera(60, 1, 1, 2000);
  camera.position.z = 0.01;

  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = 600 + Math.random() * 300;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
    size[i] = Math.random() < 0.06 ? 3.2 : 1 + Math.random() * 1.6;
    phase[i] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('size', new BufferAttribute(size, 1));
  geometry.setAttribute('phase', new BufferAttribute(phase, 1));
  const uniforms = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uColor: { value: color(colors.text) },
  };
  const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending, premultipliedAlpha: true });
  const stars = new Points(geometry, material);
  scene.add(stars);

  const trailGeo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
  const trailMat = new LineBasicMaterial({ color: color(colors.text), transparent: true, opacity: 0 });
  scene.add(new Line(trailGeo, trailMat));
  let shoot = { t: -1, from: new Vector3(), dir: new Vector3() };
  let nextShoot = 6 + Math.random() * 10;

  return {
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    setColors(c) {
      uniforms.uColor.value = color(c.text);
      trailMat.color = color(c.text);
    },
    render(time, dt, pulse) {
      uniforms.uTime.value = time;
      uniforms.uPulse.value = pulse;
      stars.rotation.y = time * 0.004;
      stars.rotation.x = Math.sin(time * 0.02) * 0.05;
      nextShoot -= dt;
      if (nextShoot <= 0 && shoot.t < 0) {
        const a = Math.random() * Math.PI * 2;
        shoot = { t: 0, from: new Vector3(Math.cos(a) * 300, 150 + Math.random() * 200, -700), dir: new Vector3(-Math.cos(a), -0.4, 0).normalize() };
        nextShoot = 12 + Math.random() * 18;
      }
      if (shoot.t >= 0) {
        shoot.t += dt;
        const head = shoot.from.clone().addScaledVector(shoot.dir, shoot.t * 900);
        trailGeo.setFromPoints([head.clone().addScaledVector(shoot.dir, -120), head]);
        trailMat.opacity = Math.max(0, 0.8 - shoot.t * 1.2);
        if (shoot.t > 0.8) shoot.t = -1;
      }
      renderer.render(scene, camera);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      trailGeo.dispose();
      trailMat.dispose();
      renderer.dispose();
    },
  };
};
