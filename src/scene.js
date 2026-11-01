import * as THREE from 'three';

// A full-screen cinematic scene drawn in one fragment shader:
// a rune-carved stone portal in a Veilbound-style dungeon, with the holder's
// aura swirling inside it, light spilling onto the walls, a wet reflective floor
// with coin glints, drifting mist and rising embers.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const frag = /* glsl */`
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uDim;
uniform vec2 uPortal;     // portal centre in scene units
uniform float uScale;     // portal scale
uniform vec2 uPointer;

#define TEAL vec3(0.25, 0.86, 0.80)
#define VIOLET vec3(0.32, 0.16, 0.58)
#define GOLD vec3(1.0, 0.78, 0.42)

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = r * p * 2.03; a *= 0.5; }
  return v;
}

// Signed distance to the portal opening (negative inside). Arch = pillars + round top.
float portalSD(vec2 q, float w, float h){
  if (q.y > 0.0) return length(q) - w;
  return max(abs(q.x) - w, -q.y - h);
}

// The swirling aura inside the portal, also reused for floor reflections.
vec3 vortex(vec2 q, float t){
  float r = length(q);
  float a = atan(q.y, q.x);
  float swirl = a + t * 0.25 + 1.6 / (r + 0.35);
  vec2 sp = vec2(cos(swirl), sin(swirl)) * r * 3.2;
  float n = fbm(sp + vec2(t * 0.15, -t * 0.3));
  float n2 = fbm(sp * 1.7 - vec2(t * 0.2, 0.0) + n * 2.0);
  float core = exp(-r * (5.5 - uIntensity * 2.5));
  vec3 deep = mix(vec3(0.03, 0.02, 0.08), VIOLET * 0.6, n);
  vec3 c = mix(deep, uColor, smoothstep(0.35, 0.95, n2) * (0.45 + uIntensity * 0.75));
  c += uColor * core * (0.6 + uIntensity * 1.4);
  c += vec3(1.0, 0.97, 0.9) * pow(core, 3.0) * (0.3 + uIntensity);
  float streak = pow(max(0.0, sin(swirl * 6.0 + n * 8.0)), 12.0) * smoothstep(0.6, 0.1, r);
  c += uColor * streak * 0.6 * (0.4 + uIntensity);
  return c;
}

// Procedural rune glyph inside a unit cell
float rune(vec2 p, float id){
  p = p * 2.0 - 1.0;
  float d = 1e3;
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float h1 = hash(vec2(id, fi));
    float h2 = hash(vec2(fi, id + 7.0));
    vec2 a = vec2(floor(h1 * 3.0) - 1.0, floor(h2 * 3.0) - 1.0) * 0.6;
    vec2 b = vec2(floor(hash(vec2(id + fi, 3.1)) * 3.0) - 1.0, floor(hash(vec2(id - fi, 9.7)) * 3.0) - 1.0) * 0.6;
    vec2 pa = p - a, ba = b - a;
    float hh = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
    d = min(d, length(pa - ba * hh));
  }
  return smoothstep(0.16, 0.04, d);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  float t = uTime;

  vec2 par = uPointer * vec2(0.02, 0.012);
  vec2 pw = p + par * 0.4;           // back wall
  vec2 pp = (p + par) - uPortal;     // portal space
  pp /= uScale;

  float w = 0.27;
  float h = 0.36;
  float floorY = -h;
  vec2 q = pp;
  float dOpen = portalSD(q, w, h + 0.5);

  float distGlow = max(dOpen, 0.0);
  vec3 portalLight = uColor * (0.018 + uIntensity * 0.03) / (distGlow * distGlow * 4.0 + 0.02);
  portalLight += VIOLET * 0.06 / (distGlow + 0.15);

  vec3 col;

  // ---------- Back wall ----------
  vec2 bw = pw * vec2(5.0, 9.0);
  bw.x += step(1.0, mod(floor(bw.y), 2.0)) * 0.5;
  vec2 cell = fract(bw), cid = floor(bw);
  float mortar = smoothstep(0.0, 0.05, cell.x) * smoothstep(1.0, 0.95, cell.x) * smoothstep(0.0, 0.08, cell.y) * smoothstep(1.0, 0.92, cell.y);
  float stone = 0.55 + 0.45 * fbm(pw * 14.0 + cid * 3.1);
  stone *= 0.75 + 0.25 * hash(cid);
  vec3 wall = vec3(0.045, 0.05, 0.07) * stone * (0.35 + 0.65 * mortar);
  col = wall * (0.35 + portalLight * 2.2);
  float pillarX = abs(pw.x - uPortal.x) - 0.78 * uScale;
  float runeCol = smoothstep(0.03, 0.0, abs(pillarX));
  vec2 rc = vec2(pillarX * 22.0 + 0.5, pw.y * 11.0);
  float wallRunes = runeCol * rune(fract(rc), floor(rc.y)) * step(-0.25, pw.y) * step(pw.y, 0.35) * step(uPortal.x - 0.01, pw.x);
  col += TEAL * wallRunes * (0.5 + 0.3 * sin(t * 1.3 + pw.y * 6.0));

  // ---------- Portal opening ----------
  if (dOpen < 0.0) {
    vec2 vq = (q - vec2(0.0, -0.06)) / 0.55;
    col = vortex(vq, t);
    col *= smoothstep(0.0, -0.05, dOpen) * 0.7 + 0.3;
  }

  // ---------- Arch stones ----------
  float thick = 0.085;
  if (dOpen >= 0.0 && dOpen < thick && q.y > floorY) {
    float u = dOpen / thick;
    float along = q.y > 0.0 ? atan(q.x, q.y) * 3.0 : (q.y * 6.0 + sign(q.x) * 20.0);
    float block = smoothstep(0.0, 0.06, fract(along)) * smoothstep(1.0, 0.94, fract(along));
    float tex = 0.5 + 0.5 * fbm(q * 30.0);
    vec3 s = vec3(0.12, 0.12, 0.145) * tex * (0.4 + 0.6 * block) * (0.7 + portalLight * 0.5);
    float rim = exp(-u * 9.0);
    s += uColor * rim * (0.25 + uIntensity * 0.55);
    s *= 0.6 + 0.4 * smoothstep(0.0, 0.3, u) * smoothstep(1.0, 0.7, u);
    float band = smoothstep(0.35, 0.42, u) * smoothstep(0.75, 0.68, u);
    vec2 rp = vec2(fract(along * 1.6), (u - 0.38) / 0.34);
    float glyph = rune(rp, floor(along * 1.6)) * band;
    float pulse = 0.55 + 0.45 * sin(t * 1.6 - along * 1.2);
    s += mix(TEAL, uColor, 0.35 + uIntensity * 0.4) * glyph * pulse * (1.3 + uIntensity * 1.2);
    col = s;
  }
  if (dOpen >= thick) col *= 0.65 + 0.35 * smoothstep(thick, thick + 0.08, dOpen);
  // atmospheric halo around the portal
  if (dOpen > 0.0) col += uColor * (0.02 + uIntensity * 0.045) / (dOpen * 7.0 + 0.09) * 0.5;

  // ---------- Floor ----------
  if (q.y < floorY) {
    float fy = floorY - q.y;
    float z = 0.18 / (fy + 0.015);
    vec2 fuv = vec2(q.x * z, z);
    vec2 tile = fract(fuv * vec2(1.6, 0.9));
    float grout = smoothstep(0.0, 0.04, tile.x) * smoothstep(0.0, 0.06, tile.y);
    float fstone = 0.5 + 0.5 * fbm(fuv * 3.0);
    vec3 fl = vec3(0.05, 0.052, 0.068) * fstone * (0.5 + 0.5 * grout);
    vec2 rq = vec2(q.x + (noise(fuv * 6.0 + t * 0.6) - 0.5) * 0.02 * fy * 4.0, floorY + fy);
    float rd = portalSD(rq, w, h + 0.5);
    vec3 refl = rd < 0.0 ? vortex((rq - vec2(0.0, -0.06)) / 0.55, t) : vec3(0.0);
    float fres = exp(-fy * 3.2);
    fl += refl * 0.75 * fres;
    fl += portalLight * 0.14 * fstone;
    vec2 cg = fuv * vec2(5.0, 3.0);
    vec2 ci = floor(cg), cf = fract(cg) - 0.5;
    float hc = hash(ci + 11.0);
    if (hc > 0.8) {
      vec2 off = (vec2(hash(ci + 1.3), hash(ci + 5.7)) - 0.5) * 0.5;
      float coin = smoothstep(0.16, 0.1, length((cf - off) * vec2(1.0, 2.2)));
      float tw = pow(0.5 + 0.5 * sin(t * 2.0 + hc * 40.0), 8.0);
      fl += GOLD * coin * (0.5 + 1.0 * tw) * exp(-abs(q.x) * 1.4) * smoothstep(0.0, 0.05, fy);
    }
    col = fl * smoothstep(1.2, 0.0, fy);
  }

  // ---------- Mist ----------
  float mistY = floorY + 0.05;
  float mist = fbm(vec2(pp.x * 2.0 + t * 0.06, pp.y * 5.0 - t * 0.02));
  mist *= smoothstep(mistY + 0.35, mistY - 0.05, q.y) * smoothstep(-1.4, -0.4, q.y);
  col += mix(VIOLET * 0.55, uColor * 0.5, 0.35) * mist * 0.55 * (0.6 + uIntensity * 0.5);

  // ---------- Embers ----------
  vec3 emb = vec3(0.0);
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = 7.0 + fl * 5.0;
    vec2 ep = (q + vec2(0.0, t * (0.05 + fl * 0.025))) * sc;
    ep.x += sin(ep.y * 0.6 + fl * 3.0 + t * 0.5) * 0.3;
    vec2 ei = floor(ep), ef = fract(ep) - 0.5;
    float he = hash(ei + fl * 17.0);
    if (he > 0.82) {
      vec2 o = (vec2(hash(ei + 3.1), hash(ei + 8.2)) - 0.5) * 0.7;
      float d = length(ef - o);
      float life = 0.5 + 0.5 * sin(t * (1.0 + he) + he * 30.0);
      emb += uColor * smoothstep(0.08, 0.0, d) * life * (1.2 - fl * 0.3);
    }
  }
  float emberMask = exp(-abs(q.x) * 1.3) * smoothstep(-0.6, 0.0, q.y + 0.2);
  col += emb * emberMask * (0.5 + uIntensity * 0.9);

  // ---------- God rays ----------
  float ang = atan(q.y, q.x);
  float rays = fbm(vec2(ang * 3.0, t * 0.1));
  float rl = length(q);
  col += uColor * pow(rays, 3.0) * 0.35 * exp(-rl * 1.6) * smoothstep(0.2, 0.5, rl) * (0.3 + uIntensity);

  // ---------- Grade ----------
  col *= uDim;
  vec2 vp = (frag / uRes) - 0.5;
  col *= 1.0 - dot(vp, vp) * 1.15;
  col = col / (1.0 + col * 0.85);
  col = pow(col, vec3(0.92));
  col += (hash(frag + fract(t)) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createScene(canvas) {
  const isSmall = () => window.innerWidth < 820;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x05070a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const state = {
    color: new THREE.Color('#E9A24A'), target: new THREE.Color('#E9A24A'),
    intensity: 0.35, targetIntensity: 0.35,
    pointer: new THREE.Vector2(), pointerTarget: new THREE.Vector2(),
    scroll: 0,
  };

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uColor: { value: state.color },
    uIntensity: { value: 0.35 },
    uDim: { value: 1 },
    uPortal: { value: new THREE.Vector2(0.45, 0.02) },
    uScale: { value: 1 },
    uPointer: { value: state.pointer },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag,
    depthTest: false, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  function quality() { return isSmall() ? 0.6 : Math.min(window.devicePixelRatio, 1.5) * 0.7; }

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    const aspect = w / h;
    const s = Math.min(state.scroll, 1);
    if (isSmall()) {
      uniforms.uPortal.value.set(0, 0.2 - s * 0.08);
      uniforms.uScale.value = Math.min(1, aspect * 1.6) * 0.82;
    } else {
      uniforms.uPortal.value.set(Math.min(0.5 * aspect - 0.48, 0.42 * aspect - 0.18), 0.05);
      uniforms.uScale.value = 1;
    }
  }

  function resize() {
    renderer.setPixelRatio(quality());
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
    layout();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    state.pointerTarget.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    state.pointerTarget.set(Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (45 - e.beta) / 30)));
  });
  resize();

  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); loop(); } });

  function frame(t, dt) {
    const k = 1 - Math.pow(0.02, dt);
    state.color.lerp(state.target, k);
    state.intensity += (state.targetIntensity - state.intensity) * k;
    state.pointer.lerp(state.pointerTarget, k * 0.5);
    uniforms.uIntensity.value = state.intensity;
    uniforms.uTime.value = t;
    uniforms.uDim.value = 1 - Math.min(state.scroll, 1) * (isSmall() ? 0.5 : 0.18);
    layout();
    renderer.render(scene, camera);
  }

  let elapsed = 0;
  function loop() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduceMotion) elapsed += dt;
    frame(elapsed, dt);
    requestAnimationFrame(loop);
  }
  loop();

  return {
    setTier(color, intensity) { state.target.set(color); state.targetIntensity = intensity; },
    setScroll(v) { state.scroll = v; },
    snapshot(color, intensity, draw) {
      const saved = { c: state.color.clone(), tc: state.target.clone(), i: state.intensity, ti: state.targetIntensity, p: state.pointer.clone(), s: state.scroll };
      state.color.set(color); state.target.set(color);
      state.intensity = state.targetIntensity = intensity;
      state.pointer.set(0, 0); state.scroll = 0;
      frame(elapsed, 0);
      const c = renderer.domElement;
      const H = c.height, W = c.width;
      const toPx = (x, y) => ({ x: x * H + W / 2, y: H / 2 - y * H });
      const P = uniforms.uPortal.value, S = uniforms.uScale.value;
      const top = toPx(P.x, P.y + 0.42 * S), bottom = toPx(P.x, P.y - 0.62 * S);
      try { draw({ canvas: c, cx: top.x, top: top.y, bottom: bottom.y }); }
      finally {
        state.color.copy(saved.c); state.target.copy(saved.tc);
        state.intensity = saved.i; state.targetIntensity = saved.ti;
        state.pointer.copy(saved.p); state.scroll = saved.s;
      }
    },
  };
}
