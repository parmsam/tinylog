import * as THREE from 'three';

/**
 * Night-sky background: slowly turning stars that twinkle, and the odd shooting star.
 * Loaded lazily (its own chunk) only when chosen in Settings. ~30 fps, paused when hidden,
 * one still frame under reduced motion.
 */
export interface Sky {
  setColor(css: string): void;
  dispose(): void;
}

const VERT = `
  attribute float size;
  attribute float phase;
  uniform float time;
  uniform float pixelRatio;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * pixelRatio * (950.0 / -mv.z);
    vAlpha = 0.45 + 0.55 * sin(time * (0.6 + phase) + phase * 6.2831);
  }
`;
const FRAG = `
  uniform vec3 color;
  uniform float opacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(color, a * vAlpha * opacity);
  }
`;

export function createSky(host: HTMLElement, opts: { color: string; still: boolean; dim: boolean }): Sky {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.domElement.className = 'sky-canvas';
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 2000);
  camera.position.z = 0.01;

  const COUNT = 2400;
  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    // Points on a big sphere around the camera.
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const r = 600 + Math.random() * 300;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
    size[i] = Math.random() < 0.06 ? 3.2 : 1 + Math.random() * 1.6;
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      pixelRatio: { value: dpr },
      color: { value: new THREE.Color(opts.color) },
      opacity: { value: opts.dim ? 0.45 : 0.9 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(geo, mat);
  scene.add(stars);

  // A shooting star: a short fading line that crosses now and then.
  const trailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const trailMat = new THREE.LineBasicMaterial({ color: new THREE.Color(opts.color), transparent: true, opacity: 0 });
  const trail = new THREE.Line(trailGeo, trailMat);
  scene.add(trail);
  let shoot = { t: -1, from: new THREE.Vector3(), dir: new THREE.Vector3() };
  let nextShoot = 6 + Math.random() * 10;

  function resize() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  let last = 0;
  let elapsed = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30 fps is plenty for a background
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    elapsed += dt;
    mat.uniforms.time.value = elapsed;
    stars.rotation.y += dt * 0.004;
    stars.rotation.x = Math.sin(elapsed * 0.02) * 0.05;

    nextShoot -= dt;
    if (nextShoot <= 0 && shoot.t < 0) {
      const a = Math.random() * Math.PI * 2;
      shoot = {
        t: 0,
        from: new THREE.Vector3(Math.cos(a) * 300, 150 + Math.random() * 200, -700),
        dir: new THREE.Vector3(-Math.cos(a), -0.4, 0).normalize(),
      };
      nextShoot = 12 + Math.random() * 18;
    }
    if (shoot.t >= 0) {
      shoot.t += dt;
      const head = shoot.from.clone().addScaledVector(shoot.dir, shoot.t * 900);
      const tail = head.clone().addScaledVector(shoot.dir, -120);
      trailGeo.setFromPoints([tail, head]);
      trailMat.opacity = Math.max(0, 0.8 - shoot.t * 1.2) * (opts.dim ? 0.5 : 1);
      if (shoot.t > 0.8) shoot.t = -1;
    }
    renderer.render(scene, camera);
  };

  const start = () => {
    if (!raf && !opts.still) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  if (opts.still) renderer.render(scene, camera);
  else start();

  return {
    setColor(css) {
      mat.uniforms.color.value.set(css);
      trailMat.color.set(css);
      if (opts.still) renderer.render(scene, camera);
    },
    dispose() {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      geo.dispose();
      mat.dispose();
      trailGeo.dispose();
      trailMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
