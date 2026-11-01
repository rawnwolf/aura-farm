import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createScene(canvas) {
  const isSmall = () => window.innerWidth < 820;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall() ? 1.5 : 2));
  renderer.setClearColor(0x07060d, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07060d, 0.06);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.2, 9);

  // Shared tier state, lerped every frame.
  const state = {
    color: new THREE.Color('#E9A24A'),
    target: new THREE.Color('#E9A24A'),
    intensity: 0.35,
    targetIntensity: 0.35,
    pointer: new THREE.Vector2(),
    pointerTarget: new THREE.Vector2(),
    scroll: 0,
  };

  const root = new THREE.Group();
  scene.add(root);

  // ---------- The hooded figure ----------
  const figureMat = new THREE.ShaderMaterial({
    uniforms: { uRim: { value: state.color }, uIntensity: { value: 0.35 } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-(viewMatrix * wp).xyz);
        vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uRim; uniform float uIntensity;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.6);
        vec3 base = vec3(0.012, 0.010, 0.022);
        // the robe fades into the void toward the hem
        float hem = smoothstep(-2.4, -0.6, vY);
        vec3 col = base + uRim * f * (0.35 + uIntensity * 1.1) * hem;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const figure = new THREE.Group();
  root.add(figure);

  // Robe: a lathe profile flaring out to the hem
  const robeProfile = [
    [0.0, 0.62], [0.30, 0.58], [0.52, 0.42], [0.62, 0.15], [0.66, -0.3],
    [0.74, -0.9], [0.86, -1.5], [1.0, -2.1], [1.08, -2.5], [0.0, -2.5],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const robe = new THREE.Mesh(new THREE.LatheGeometry(robeProfile, 64), figureMat);
  robe.scale.z = 0.72;
  figure.add(robe);

  // Hood: a solid ellipsoid; the face is a deep void set into its front
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), figureMat);
  hood.position.set(0, 0.98, 0.0);
  hood.scale.set(0.98, 1.28, 1.08);
  figure.add(hood);

  const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 24), voidMat);
  face.position.set(0, 0.9, 0.29);
  face.scale.set(0.72, 0.9, 0.8);
  figure.add(face);

  // Two faint eyes, tinted by tier
  const eyeMat = new THREE.MeshBasicMaterial({ color: state.color.clone(), transparent: true, opacity: 0.0 });
  const eyes = new THREE.Group();
  [-0.12, 0.12].forEach((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), eyeMat);
    e.position.set(x * 0.9, 0.95, 0.615);
    e.scale.set(1.4, 0.7, 1);
    eyes.add(e);
  });
  figure.add(eyes);

  // ---------- Aura halo (shader plane behind the figure) ----------
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: state.color }, uIntensity: { value: 0.35 }, uDim: { value: 1 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uColor; uniform float uIntensity; uniform float uDim;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5;
        p.y -= 0.06;
        p.x *= 1.15;
        float r = length(p);
        float a = atan(p.y, p.x);
        // breathing core
        float core = exp(-r * (10.0 - uIntensity * 3.0)) * (0.5 + 0.12 * sin(uTime * 1.3));
        // rings expanding outward, more of them as intensity rises
        float rings = 0.0;
        for (int i = 0; i < 4; i++) {
          float fi = float(i);
          float rr = fract(uTime * 0.07 + fi * 0.25) * 0.5;
          float w = 0.004 + 0.006 * uIntensity;
          float ring = smoothstep(w, 0.0, abs(r - rr)) * (1.0 - rr * 2.0);
          rings += ring * step(fi, uIntensity * 4.0);
        }
        // wisps
        float wisp = sin(a * 7.0 + uTime * 0.6 + r * 18.0) * 0.5 + 0.5;
        float wispMask = smoothstep(0.45, 0.12, r) * smoothstep(0.05, 0.2, r);
        float glow = core + rings * 0.9 + wisp * wispMask * 0.18 * uIntensity;
        float edge = smoothstep(0.5, 0.3, r);
        vec3 col = mix(uColor, vec3(1.0, 0.96, 0.9), core * 0.35);
        gl_FragColor = vec4(col * glow * edge * (0.28 + uIntensity * 0.55) * uDim, 1.0);
      }`,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), haloMat);
  halo.position.set(0, 0.5, -1.2);
  root.add(halo);

  // ---------- Orbiting rings ----------
  const ringMat = new THREE.MeshBasicMaterial({ color: state.color.clone(), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const rings = [];
  [[1.5, 0.006, 1.1, 0.25], [1.9, 0.004, 0.6, -0.4], [2.25, 0.003, 0.2, 0.15]].forEach(([rad, tube, tilt, spin]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 160), ringMat);
    m.rotation.x = Math.PI / 2 - tilt * 0.35;
    m.rotation.y = tilt * 0.4;
    m.position.y = -0.2;
    m.userData.spin = spin;
    root.add(m);
    rings.push(m);
  });

  // ---------- Embers rising ----------
  const EMBERS = isSmall() ? 220 : 480;
  const pos = new Float32Array(EMBERS * 3);
  const seed = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) {
    const r = 0.4 + Math.random() * 2.8;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = -2.6 + Math.random() * 6;
    pos[i * 3 + 2] = Math.sin(a) * r * 0.6;
    seed[i] = Math.random();
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  emberGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const emberMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: state.color }, uIntensity: { value: 0.35 }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uPR; uniform float uIntensity;
      attribute float seed; varying float vA;
      void main(){
        vec3 p = position;
        float speed = 0.18 + seed * 0.35 + uIntensity * 0.25;
        p.y = mod(p.y + 2.6 + uTime * speed, 6.0) - 2.6;
        p.x += sin(uTime * 0.5 + seed * 20.0) * 0.15;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float life = smoothstep(-2.6, -1.6, p.y) * smoothstep(3.4, 1.4, p.y);
        vA = life * (0.35 + seed * 0.65);
        gl_PointSize = (2.0 + seed * 3.5) * uPR * (6.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uIntensity; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * (0.4 + uIntensity * 0.8);
        gl_FragColor = vec4(uColor * a * 1.6, 1.0);
      }`,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  root.add(embers);

  // ---------- Bloom ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.45, 0.22);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Layout ----------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layout();
  }
  function layout() {
    // Desktop: figure sits right of the text. Mobile: centered, higher.
    // Desktop: the figure stays right of the content column. Mobile: centered behind it.
    const small = isSmall();
    const wide = window.innerWidth >= 1200;
    const s = Math.min(state.scroll, 1);
    root.position.x = small ? 0 : wide ? 2.3 : 1.9;
    root.position.y = small ? 1.1 - s * 0.5 : -s * 0.15;
    root.scale.setScalar(small ? 0.74 : 1);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    state.pointerTarget.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    state.pointerTarget.set(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30)));
  });
  resize();

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) loop(); });

  function frame(t, dt) {
    const k = 1 - Math.pow(0.02, dt); // frame-rate independent smoothing
    // Dim the glow once the hero scrolls away, more on phones where text sits on top of it
    const dim = 1 - Math.min(state.scroll, 1) * (isSmall() ? 0.55 : 0.2);
    state.color.lerp(state.target, k);
    state.intensity += (state.targetIntensity - state.intensity) * k;
    state.pointer.lerp(state.pointerTarget, k * 0.6);

    figureMat.uniforms.uIntensity.value = state.intensity;
    haloMat.uniforms.uIntensity.value = state.intensity;
    emberMat.uniforms.uIntensity.value = state.intensity;
    haloMat.uniforms.uTime.value = t;
    haloMat.uniforms.uDim.value = dim;
    emberMat.uniforms.uTime.value = t;
    ringMat.color.copy(state.color);
    ringMat.opacity = (0.12 + state.intensity * 0.4) * dim;
    eyeMat.color.copy(state.color);
    eyeMat.opacity = Math.max(0, state.intensity - 0.3) * 1.3;
    bloom.strength = (0.45 + state.intensity * 0.45) * dim;

    figure.rotation.y = state.pointer.x * 0.35;
    figure.rotation.x = state.pointer.y * 0.06;
    figure.position.y = Math.sin(t * 0.8) * 0.06;
    rings.forEach((r, i) => { r.rotation.z = t * r.userData.spin * 0.3 + i; });
    layout();
    composer.render();
  }

  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    frame(reduceMotion ? 0 : clock.elapsedTime, dt);
    requestAnimationFrame(loop);
  }
  loop();

  return {
    setTier(color, intensity) {
      state.target.set(color);
      state.targetIntensity = intensity;
    },
    setScroll(v) { state.scroll = v; },
    snapshot() { composer.render(); return renderer.domElement; },
  };
}
