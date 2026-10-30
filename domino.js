/* =====================================================================
   DOMINÓ DA POTENCIAÇÃO — 3D
   Cada peça tem duas metades: uma POTÊNCIA e um VALOR.
   Encaixe: o valor de uma metade é o resultado da potência da outra.
   Ex.: peça [ (2×3)² | 64 ] encaixa numa ponta que mostre 36,
        porque (2×3)² = 36; e a metade 64 recebe qualquer potência que dê 64.
   ===================================================================== */
'use strict';

/* ---------------- DADOS ---------------- */
const i = n => ({ n, d: 1 });
const f = (n, d) => ({ n, d });
const vKey = v => (v.d === 1 ? String(v.n) : `${v.n}/${v.d}`);
const vText = v => (v.d === 1 ? String(v.n) : `${v.n}/${v.d}`);

/* ---- 8 conceitos, resultados todos diferentes ----
   As 28 peças são todos os pares (i<j) entre eles:
   metade teal = potência/expressão de um conceito,
   metade roxa  = resultado de OUTRO conceito.
   Assim a mesa sempre encaixa: (2×3)² encaixa em 36 etc.,
   e o baralho fica conectado como um dominó de verdade. */
const CONCEPTS = [
  { e: '2²', v: i(4), s: '2² = 2 × 2 = 4' },
  { e: '3²', v: i(9), s: '3² = 3 × 3 = 9' },
  { e: '(2 × 3)²', v: i(36), s: '(2×3)² = 6² = 36' },
  { e: '5⁵ ÷ 5²', v: i(125), s: '5⁵ ÷ 5² = 5³ = 125' },
  { e: '8² − 2³', v: i(56), s: '8² − 2³ = 64 − 8 = 56' },
  { e: '(6⁻¹)²', v: f(1, 36), s: '(6⁻¹)² = 6⁻² = 1/6² = 1/36' },
  { e: '4⁻²', v: f(1, 16), s: '4⁻² = 1/4² = 1/16' },
  { e: '3⁴', v: i(81), s: '3⁴ = 3×3×3×3 = 81' }
];

/* ---------------- UTIL ---------------- */
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mod = (n, m) => ((n % m) + m) % m;
function shuffle(a) {
  const r = a.slice();
  for (let k = r.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [r[k], r[j]] = [r[j], r[k]]; }
  return r;
}

/* ---------------- ESTADO ---------------- */
const S = {
  tiles: [], hands: [[], [], [], []], chain: [], boneyard: [],
  turn: 0, over: false, passes: 0, hint: true, sound: true,
  sel: null, valid: [], round: 0, wins: 0, games: 0, acertos: 0, erros: 0,
  left: null, right: null, zoom: 1
};
const SEAT_NAMES = ['Você', 'Ana', 'Bruno', 'Carla'];

/* ---------------- CENA ---------------- */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#07070b');
scene.fog = new THREE.Fog('#07070b', 28, 68);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 140);
const cam = { theta: 0, phi: 0.84, radius: 15, target: new THREE.Vector3(0, 0, -0.4) };
function applyCamera() {
  cam.phi = Math.min(1.12, Math.max(0.4, cam.phi));
  cam.theta = Math.min(0.5, Math.max(-0.5, cam.theta));
  const sp = Math.sin(cam.phi);
  camera.position.set(
    cam.target.x + cam.radius * sp * Math.sin(cam.theta),
    cam.target.y + cam.radius * Math.cos(cam.phi),
    cam.target.z + cam.radius * sp * Math.cos(cam.theta)
  );
  camera.lookAt(cam.target);
}
applyCamera();

/* luzes */
scene.add(new THREE.HemisphereLight(0xdce6ff, 0x232833, 0.8));
scene.add(new THREE.AmbientLight(0xffffff, 0.16));
const key = new THREE.DirectionalLight(0xfff6e2, 1.0);
key.position.set(5, 18, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -20; key.shadow.camera.right = 20;
key.shadow.camera.top = 20; key.shadow.camera.bottom = -20;
key.shadow.camera.near = 1; key.shadow.camera.far = 46;
key.shadow.bias = -0.0012; key.shadow.normalBias = 0.012; key.shadow.radius = 3;
scene.add(key);
const rim = new THREE.DirectionalLight(0x6ee0ef, 0.3);
rim.position.set(-9, 6, -7);
scene.add(rim);

/* mesa */
function tableTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(512, 512, 40, 512, 512, 720);
  grd.addColorStop(0, 'rgba(34,48,62,1)');
  grd.addColorStop(0.34, 'rgba(24,34,45,1)');
  grd.addColorStop(0.55, 'rgba(17,25,33,0.92)');
  grd.addColorStop(0.72, 'rgba(13,19,25,0.5)');
  grd.addColorStop(0.86, 'rgba(10,14,19,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
  for (let n = 0; n < 22000; n++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.026})`;
    g.fillRect(Math.random() * 1024, Math.random() * 1024, 1.7, 1.7);
  }
  g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 5;
  g.beginPath(); g.arc(512, 512, 320, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180),
  new THREE.MeshStandardMaterial({ color: '#07070b', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; scene.add(floor);
const table = new THREE.Mesh(new THREE.PlaneGeometry(38, 38),
  new THREE.MeshStandardMaterial({ map: tableTexture(), roughness: 0.95, transparent: true, depthWrite: false }));
table.rotation.x = -Math.PI / 2; table.receiveShadow = true; table.renderOrder = 1; scene.add(table);

/* ---------------- TEXTURAS DAS PEÇAS ---------------- */
const TW = 1.60, TH = 0.17, TD = 0.80;      // largura (2 metades) x espessura x profundidade
const HAND_Z = 3.4;                         // onde fica a mão do jogador
const GAPX = 0.12, GAPZ = 0.22;
/* retrato (celular): menos peças por linha para continuar legível */
const narrow = () => camera.aspect < 0.85;
const COLS = () => (narrow() ? 4 : 7);
const HCOLS = () => (narrow() ? 4 : 9);    // mesa em grade (6 peças por linha)
const TEX_W = 640, TEX_H = 320;
const TEAL = '#2e7f8a', PURPLE = '#4a3f96';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* desenha um valor (inteiro ou fração empilhada) */
function drawValue(g, v, cx, cy, size, color) {
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (v.d === 1) {
    g.font = `800 ${size}px "Trebuchet MS",Verdana,sans-serif`;
    g.fillText(String(v.n), cx, cy + size * 0.03);
  } else {
    const fs = size * 0.72;
    g.font = `800 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
    const wnum = g.measureText(String(v.n)).width;
    const wden = g.measureText(String(v.d)).width;
    const wbar = Math.max(wnum, wden) + fs * 0.34;
    g.fillText(String(v.n), cx, cy - fs * 0.56);
    g.fillText(String(v.d), cx, cy + fs * 0.6);
    g.strokeStyle = color; g.lineWidth = Math.max(3, fs * 0.075); g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - wbar / 2, cy + fs * 0.02); g.lineTo(cx + wbar / 2, cy + fs * 0.02); g.stroke();
  }
}

/* texto ajustado à largura disponível */
function fitText(g, text, cx, cy, maxW, size, weight, family) {
  let fs = size;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  do {
    g.font = `${weight} ${fs}px ${family}`;
    if (g.measureText(text).width <= maxW) break;
    fs -= 2;
  } while (fs > 12);
  g.fillText(text, cx, cy);
  return fs;
}

const texCache = new Map();
function tileTexture(left, right) {
  const key = `${left.kind === 'expr' ? left.tex : vText(left.val)}|${right.kind === 'expr' ? right.tex : vText(right.val)}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext('2d');
  const W = TEX_W, H = TEX_H, half = W / 2;

  roundRect(g, 3, 3, W - 6, H - 6, 26);
  g.save(); g.clip();
  /* metade esquerda (teal) e direita (roxa) */
  const lg1 = g.createLinearGradient(0, 0, 0, H);
  lg1.addColorStop(0, '#358f9b'); lg1.addColorStop(1, '#256d77');
  g.fillStyle = lg1; g.fillRect(0, 0, half, H);
  const lg2 = g.createLinearGradient(0, 0, 0, H);
  lg2.addColorStop(0, '#5246a4'); lg2.addColorStop(1, '#3f3483');
  g.fillStyle = lg2; g.fillRect(half, 0, half, H);
  /* brilho */
  const gl = g.createLinearGradient(0, 0, 0, H * 0.6);
  gl.addColorStop(0, 'rgba(255,255,255,.18)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.fillRect(0, 0, W, H * 0.6);
  g.restore();

  /* divisória branca + pino central (como nas peças de verdade) */
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(half, 16); g.lineTo(half, H - 16); g.stroke();
  g.fillStyle = '#e9edf5';
  g.beginPath(); g.arc(half, H / 2, 7, 0, Math.PI * 2); g.fill();

  /* conteúdo */
  [left, right].forEach((h2, idx) => {
    const cx = idx === 0 ? half / 2 : half + half / 2;
    if (h2.kind === 'expr') {
      g.fillStyle = '#ffffff';
      fitText(g, h2.tex, cx, H / 2, half - 46, 92, '700', 'Georgia,"Times New Roman",serif');
    } else {
      drawValue(g, h2.val, cx, H / 2, 118, '#ffffff');
    }
  });

  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texCache.set(key, t);
  return t;
}

let backTex = null;
function tileBackTexture() {
  if (backTex) return backTex;
  const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext('2d'), W = TEX_W, H = TEX_H;
  roundRect(g, 3, 3, W - 6, H - 6, 26);
  g.save(); g.clip();
  g.fillStyle = '#141a22'; g.fillRect(0, 0, W, H);
  for (let n = 0; n < 7000; n++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3.5;
  roundRect(g, 16, 16, W - 32, H - 32, 20); g.stroke();
  g.fillStyle = 'rgba(110,224,239,.85)';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 74px Georgia,serif';
  g.fillText('xⁿ', W / 2, H / 2);
  backTex = new THREE.CanvasTexture(c);
  backTex.encoding = THREE.sRGBEncoding;
  backTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return backTex;
}

const edgeMat = new THREE.MeshStandardMaterial({ color: '#e9e3d3', roughness: 0.95 });
const matCache = new Map();
function faceMat(tex) {
  if (!matCache.has(tex.uuid)) {
    matCache.set(tex.uuid, new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.72, metalness: 0.0, alphaTest: 0.4
    }));
  }
  return matCache.get(tex.uuid);
}
const tileGeo = new THREE.BoxGeometry(TW, TH, TD);

function tileMesh(halfLeft, halfRight, faceUp) {
  const front = faceMat(tileTexture(halfLeft, halfRight));
  const back = faceMat(tileBackTexture());
  const mats = [edgeMat, edgeMat, faceUp ? front : back, faceUp ? back : front, edgeMat, edgeMat];
  const m = new THREE.Mesh(tileGeo, mats);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.faceUp = faceUp;
  m.userData.halves = [halfLeft, halfRight];
  return m;
}
function setFace(m, halfLeft, halfRight, up) {
  const front = faceMat(tileTexture(halfLeft, halfRight));
  const back = faceMat(tileBackTexture());
  m.material[2] = up ? front : back;
  m.material[3] = up ? back : front;
  m.userData.faceUp = up;
  m.userData.halves = [halfLeft, halfRight];
}

/* ---------------- TWEENS ---------------- */
const tweens = [];
function tweenObj(obj, to, dur = 320, opt = {}) {
  for (let n = tweens.length - 1; n >= 0; n--) if (tweens[n].obj === obj) tweens.splice(n, 1);
  return new Promise(resolve => {
    tweens.push({
      obj, to, dur, t: 0, delay: opt.delay || 0, ease: opt.ease || easeInOut,
      arc: opt.arc || 0, resolve,
      from: {
        px: obj.position.x, py: obj.position.y, pz: obj.position.z,
        rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z,
        sx: obj.scale.x, sy: obj.scale.y, sz: obj.scale.z
      }
    });
  });
}
function hasTween(o) { return tweens.some(t => t.obj === o); }
function updateTweens(dt) {
  for (let n = tweens.length - 1; n >= 0; n--) {
    const tw = tweens[n];
    if (tw.delay > 0) { tw.delay -= dt; continue; }
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur), e = tw.ease(k), f = tw.from, o = tw.obj, to = tw.to;
    if (to.position) o.position.set(lerp(f.px, to.position[0], e), lerp(f.py, to.position[1], e), lerp(f.pz, to.position[2], e));
    if (to.rotY !== undefined) o.rotation.y = lerp(f.ry, to.rotY, e);
    if (to.rotX !== undefined) o.rotation.x = lerp(f.rx, to.rotX, e);
    if (to.rotZ !== undefined) o.rotation.z = lerp(f.rz, to.rotZ, e);
    if (to.scale !== undefined) { const s = lerp(f.sx, to.scale, e); o.scale.set(s, s, s); }
    if (tw.arc) o.position.y += Math.sin(Math.PI * k) * tw.arc;
    if (k >= 1) { tweens.splice(n, 1); tw.resolve && tw.resolve(); }
  }
}

/* ---------------- SOM ---------------- */
let actx = null;
function beep(freq = 440, dur = 0.09, type = 'sine', vol = 0.06, when = 0) {
  if (!S.sound) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime + when;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { }
}
const SFX = {
  play: () => { beep(520, .08, 'triangle', .07); beep(700, .07, 'triangle', .05, .05); },
  draw: () => beep(300, .1, 'sine', .05),
  err: () => beep(170, .12, 'sawtooth', .05),
  match: () => beep(880, .1, 'sine', .06),
  win: () => [523, 659, 784, 1046].forEach((fr, n) => beep(fr, .22, 'triangle', .07, n * .13)),
  lose: () => [440, 392, 330, 262].forEach((fr, n) => beep(fr, .25, 'sine', .07, n * .15))
};

/* ---------------- RÓTULOS ---------------- */
function makeLabel(text, opts) {
  opts = opts || {};
  const fs = 44, pad = 26;
  const c = document.createElement('canvas');
  let g = c.getContext('2d');
  g.font = `700 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  c.width = w; c.height = fs + pad * 1.4;
  g = c.getContext('2d');
  g.font = `700 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  g.fillStyle = opts.bg || 'rgba(10,10,14,.8)';
  roundRect(g, 0, 0, c.width, c.height, c.height / 2); g.fill();
  g.strokeStyle = opts.border || 'rgba(255,255,255,.16)'; g.lineWidth = 3;
  roundRect(g, 1.5, 1.5, c.width - 3, c.height - 3, c.height / 2); g.stroke();
  g.fillStyle = opts.color || '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sp.renderOrder = 30;
  const sc = opts.scale || 0.0085;
  sp.scale.set(c.width * sc, c.height * sc, 1);
  return sp;
}

/* ---------------- ASSENTOS ---------------- */
const SEATS = [
  { pos: new THREE.Vector3(0, 0.05, HAND_Z), rot: 0 },
  { pos: new THREE.Vector3(-6.1, 0.05, -0.7), rot: Math.PI / 2 },
  { pos: new THREE.Vector3(0, 0.05, -4.0), rot: Math.PI },
  { pos: new THREE.Vector3(6.1, 0.05, -0.7), rot: -Math.PI / 2 }
];
const ring = new THREE.Mesh(new THREE.PlaneGeometry(7, 5.4),
  new THREE.MeshBasicMaterial({ map: (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    for (let n = 0; n < 26; n++) {
      g.beginPath(); g.arc(256, 256, 214 - n * 3.4, 0, Math.PI * 2);
      g.strokeStyle = `rgba(110,224,239,${0.055 * (1 - n / 26)})`; g.lineWidth = 7; g.stroke();
    }
    g.beginPath(); g.arc(256, 256, 216, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(110,224,239,.8)'; g.lineWidth = 3; g.stroke();
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  })(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.012;
scene.add(ring);

/* ---------------- MONTAGEM / LAYOUT ---------------- */
const handGroup = new THREE.Group(); scene.add(handGroup);
const chainGroup = new THREE.Group(); scene.add(chainGroup);

const R = { hand: [], chain: [], endMarkL: null, endMarkR: null };

function handWidth(count) { return Math.max(1, Math.min(count, HCOLS())) * (TW + GAPX); }
function handTargets(count) {
  const out = [];
  const cols = HCOLS();
  const rows = Math.max(1, Math.ceil(count / cols));
  for (let k = 0; k < count; k++) {
    const row = Math.floor(k / cols);
    const inRow = Math.min(cols, count - row * cols);
    const t = (k % cols) - (inRow - 1) / 2;
    out.push({
      pos: new THREE.Vector3(t * (TW + GAPX), 0.14 + k * 0.004,
        HAND_Z + (rows - 1 - row) * (TD + 0.26)),
      rotY: 0
    });
  }
  return out;
}
function layoutHand(instant) {
  const ms = R.hand;
  const tg = handTargets(ms.length);
  ms.forEach((m, k) => {
    const t = tg[k];
    if (!t) return;
    m.userData.base = { pos: t.pos.clone(), rotY: t.rotY };
    if (instant) { m.position.copy(t.pos); m.rotation.set(0, t.rotY, 0); return; }
    tweenObj(m, { position: [t.pos.x, t.pos.y, t.pos.z], rotY: t.rotY, rotX: 0 }, 300, { ease: easeOut });
  });
}

function chainTargets() {
  const n = S.chain.length;
  const C = COLS();
  const out = [];
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / C), col = k % C;
    const inRow = Math.min(C, n - row * C);
    const x = (col - (inRow - 1) / 2) * (TW + GAPX);
    const z = -row * (TD + GAPZ);
    out.push(new THREE.Vector3(x, 0.05, z));
  }
  return out;
}
function layoutChain() {
  const tg = chainTargets();
  R.chain.forEach((m, k) => {
    const t = tg[k];
    if (!t) return;
    if (hasTween(m)) return;
    tweenObj(m, { position: [t.x, t.y, t.z], rotY: 0, rotX: 0 }, 320, { ease: easeOut });
  });
}

function botTargets(seat, count) {
  const s = SEATS[seat];
  const spacing = Math.min(0.5, 4.6 / Math.max(count, 1));
  const out = [];
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
  for (let k = 0; k < count; k++) {
    const t = k - (count - 1) / 2;
    const v = new THREE.Vector3(t * spacing, 0, 0);
    v.applyQuaternion(q);
    const p = s.pos.clone().add(v);
    p.y += k * 0.006;
    out.push({ pos: p, rotY: s.rot });
  }
  return out;
}

/* ---------------- CONSTRUÇÃO DO JOGO ---------------- */
function buildTiles() {
  const tiles = [];
  for (let a = 0; a < CONCEPTS.length; a++) {
    for (let b = a + 1; b < CONCEPTS.length; b++) {
      const left = CONCEPTS[a], right = CONCEPTS[b];
      const flip = Math.random() < 0.5;         // qual metade fica na frente
      const P = flip ? right : left;
      const T = flip ? left : right;
      tiles.push({
        id: tiles.length + 1,
        expr: { kind: 'expr', tex: P.e, val: P.v, steps: P.s },
        val: { kind: 'val', val: T.v },
        used: false
      });
    }
  }
  return tiles;
}

function clearTable() {
  R.hand.forEach(m => handGroup.remove(m));
  R.chain.forEach(m => chainGroup.remove(m));
  R.hand = []; R.chain = [];
  tweens.length = 0;
  $('#ends').innerHTML = '';
}

function newGame() {
  clearTable();
  S.tiles = buildTiles();
  S.hands = [[], [], [], []];
  S.chain = [];
  S.boneyard = S.tiles.slice();
  S.over = false; S.passes = 0; S.sel = null; S.valid = []; S.zoom = 1;
  S.round++; S.games++;
  $('#ovEnd').classList.add('hidden');
  $('#ovStart').classList.add('hidden');
  $('#hud').classList.remove('hidden');

  /* distribui 6 peças (4 jogadores = 24) e separa a peça inicial */
  for (let r = 0; r < 6; r++) for (let p = 0; p < 4; p++) S.hands[p].push(S.boneyard.pop());

  /* peça inicial: uma que não seja "dupla" (evita empate de conceito no começo) */
  let start = S.boneyard.pop();
  const first = { tile: start, hl: start.expr, hr: start.val };
  S.chain.push(first);
  S.left = first.hl;
  S.right = first.hr;
  const mesh = tileMesh(first.hl, first.hr, true);
  mesh.position.set(0, 0.05, 0);
  chainGroup.add(mesh);
  R.chain.push(mesh);
  mesh.userData.entry = first;

  /* mãos visíveis */
  S.hands[0].forEach(t => {
    const m = tileMesh(t.expr, t.val, true);
    m.material = m.material.map(mm => mm.clone());   // material próprio (permite escurecer)
    m.userData.tile = t;
    m.position.set(0, 0.6, HAND_Z);
    handGroup.add(m);
    R.hand.push(m);
  });
  layoutHand(true);
  rebuildBotPiles();
  updateLabels();
  S.turn = Math.floor(Math.random() * 4);
  setMsg(`Peça inicial na mesa: <b>${start.expr.tex}</b> e <b>${vText(start.val.val)}</b>.`, 4200);
  refreshValid();
  updateHUD();
  setTimeout(beginTurn, 600);
}

const botGroups = [null, null, null, null];
function rebuildBotPiles() {
  for (let p = 1; p < 4; p++) {
    if (narrow()) { if (botGroups[p]) { scene.remove(botGroups[p]); botGroups[p] = null; } continue; }
    if (botGroups[p]) scene.remove(botGroups[p]);
    const g = new THREE.Group();
    const n = Math.min(S.hands[p].length, 6);
    const seat = SEATS[p];
    const back = faceMat(tileBackTexture());
    const sc = 0.52;
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(tileGeo, [edgeMat, edgeMat, back, back, edgeMat, edgeMat]);
      m.scale.set(sc, sc, sc);
      m.position.copy(seat.pos);
      m.position.y = 0.05 + k * (TH * sc + 0.008);
      m.position.z += k * 0.012;
      m.rotation.y = seat.rot;
      m.castShadow = true;
      g.add(m);
    }
    scene.add(g);
    botGroups[p] = g;
  }
}
/* monte de compra (peças viradas para baixo) */
let monteGroup = null, monteLabel = null, monteCount = -1;
const MONTE_POS = new THREE.Vector3(-4.3, 0.05, 1.75);
function rebuildMonte() {
  if (S.boneyard.length === monteCount && monteGroup) return;
  monteCount = S.boneyard.length;
  if (monteGroup) scene.remove(monteGroup);
  monteGroup = new THREE.Group();
  const n = Math.min(S.boneyard.length, 6);
  const back = faceMat(tileBackTexture());
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(tileGeo, [edgeMat, edgeMat, back, back, edgeMat, edgeMat]);
    const sc = 0.62;
    m.scale.set(sc, sc, sc);
    m.position.set(MONTE_POS.x, MONTE_POS.y + k * (TH * sc + 0.006), MONTE_POS.z);
    m.rotation.y = 0.05 * k;
    m.castShadow = true;
    monteGroup.add(m);
  }
  scene.add(monteGroup);
}

function updateLabels() {
  rebuildMonte();
  rebuildBotPiles();
  let leader = 0;
  for (let k = 1; k < 4; k++) if (S.hands[k].length < S.hands[leader].length) leader = k;
  document.querySelectorAll('#bots .chip').forEach(chip => {
    const seat = +chip.dataset.seat;
    chip.querySelector('b').textContent = S.hands[seat].length;
    chip.classList.toggle('active', S.turn === seat && !S.over);
    chip.classList.toggle('leader', seat === leader && !S.over);
  });
}

/* ---------------- REGRAS ---------------- */
const matchHalf = (exposed, half) => {
  if (!exposed || !half) return false;
  if (exposed.kind === 'val' && half.kind === 'expr') return vKey(half.val) === vKey(exposed.val);
  if (exposed.kind === 'expr' && half.kind === 'val') return vKey(half.val) === vKey(exposed.val);
  return false;
};
/* quais pontas aceitam esta peça? */
function endsFor(tile) {
  const ends = [];
  if (matchHalf(S.right, tile.expr)) ends.push({ side: 'R', hl: tile.expr, hr: tile.val });
  if (matchHalf(S.right, tile.val)) ends.push({ side: 'R', hl: tile.val, hr: tile.expr });
  if (matchHalf(S.left, tile.expr)) ends.push({ side: 'L', hl: tile.val, hr: tile.expr });
  if (matchHalf(S.left, tile.val)) ends.push({ side: 'L', hl: tile.expr, hr: tile.val });
  return ends;
}
const canPlay = tile => endsFor(tile).length > 0;

function refreshValid() {
  S.valid = S.hands[0].filter(canPlay).map(t => t.id);
  R.hand.forEach(m => {
    const ok = !!(m.userData.tile && S.valid.includes(m.userData.tile.id) && S.turn === 0 && !S.over);
    m.userData.playable = ok;
    if (m.material && m.material[2] && m.material[2].color) {
      m.material[2].color.setScalar(ok ? 1 : 0.42);
    }
  });
  return S.valid;
}

/* ---------------- COLOCAR PEÇA ---------------- */
async function placeTile(seat, tile, end) {
  const idx = S.hands[seat].indexOf(tile);
  if (idx < 0) return false;
  S.hands[seat].splice(idx, 1);

  const entry = { tile, hl: end.hl, hr: end.hr, side: end.side };
  let mesh;
  if (seat === 0) {
    const hi = R.hand.findIndex(m => m.userData.tile === tile);
    mesh = hi >= 0 ? R.hand.splice(hi, 1)[0] : null;
  }
  if (!mesh) {
    mesh = tileMesh(end.hl, end.hr, true);
    mesh.position.set(SEATS[seat].pos.x, 0.6, SEATS[seat].pos.z);
    chainGroup.add(mesh);
  } else {
    handGroup.remove(mesh);
    chainGroup.add(mesh);
    setFace(mesh, end.hl, end.hr, true);
  }
  mesh.position.y = 0.6;

  if (end.side === 'R') {
    S.chain.push(entry); R.chain.push(mesh);
    S.right = end.hr;
  } else {
    S.chain.unshift(entry); R.chain.unshift(mesh);
    S.left = end.hl;
  }
  mesh.userData.entry = entry;
  S.passes = 0;

  /* encaixa na mesa */
  const tg = chainTargets();
  tweenObj(mesh, { position: [tg[end.side === 'R' ? tg.length - 1 : 0].x, 0.05, 0], rotY: 0, rotX: 0 },
    340, { ease: easeOut, arc: 0.9 }).then(() => layoutChain());
  layoutChain();
  layoutHand();

  SFX.play();
  const matched = end.hl.kind === 'val'
    ? `<b>${vText(end.hl.val)}</b> = <span class="eq">${end.hr.tex}</span>`
    : `<span class="eq">${end.hl.tex}</span> = <b>${vText(end.hl.val)}</b>`;
  flash(matched);
  if (S.hint) setMsg(`${SEAT_NAMES[seat]} encaixou ${matched}`, 2600);
  updateLabels();
  updateHUD();
  updateEnds();
  refreshValid();

  if (S.hands[seat].length === 0) { endGame(seat); return true; }
  await sleep(420);
  nextTurn();
  return true;
}

/* ---------------- TURNO ---------------- */
function nextTurn() {
  if (S.over) return;
  S.turn = mod(S.turn + 1, 4);
  S.sel = null;
  clearEndButtons();
  refreshValid();
  updateLabels();
  updateHUD();
  beginTurn();
}

async function beginTurn() {
  if (S.over) return;
  updateHUD();
  if (S.turn === 0) {
    const v = refreshValid();
    if (!v.length) {
      await autoDraw(0);
      if (!S.over && !refreshValid().length) {
        setMsg('Sem jogada e sem peças no monte — você passou a vez.', 2600);
        await sleep(900);
        passTurn(0);
        return;
      }
      if (!S.over) { setMsg('Sua vez: clique numa peça iluminada e escolha a ponta.', 3600); updateEnds(); }
      return;
    }
    setMsg('Sua vez: clique numa peça iluminada e escolha a ponta.', 3600);
    $('#btnPass').classList.add('hidden');
    updateEnds();
    return;
  }
  /* bot */
  await sleep(500 + Math.random() * 450);
  if (S.over || S.turn === 0) return;
  const seat = S.turn;
  let opts = S.hands[seat].map(t => ({ t, ends: endsFor(t) })).filter(x => x.ends.length);
  if (!opts.length) {
    const got = autoDrawSync(seat);
    opts = S.hands[seat].map(t => ({ t, ends: endsFor(t) })).filter(x => x.ends.length);
    if (!opts.length) {
      setMsg(`${SEAT_NAMES[seat]} comprou${got ? ' uma peça' : ''} e passou.`, 1600);
      updateLabels(); updateHUD();
      await sleep(650);
      if (!S.over) passTurn(seat);
      return;
    }
    updateLabels(); updateHUD();
    await sleep(350);
  }
  /* preferência: jogar a peça cuja metade livre "vale" mais (estratégia simples) */
  opts.sort((a, b) => b.ends.length - a.ends.length);
  const pickOpt = opts[Math.floor(Math.random() * Math.min(2, opts.length))];
  const end = pickOpt.ends[Math.floor(Math.random() * pickOpt.ends.length)];
  await placeTile(seat, pickOpt.t, end);
}

function passTurn(seat) {
  if (S.over) return;
  S.passes++;
  updateLabels();
  if (S.passes >= 4) { endGame(-1); return; }
  nextTurn();
}

function autoDrawSync(seat) {
  if (!S.boneyard.length) return false;
  const t = S.boneyard.pop();
  S.hands[seat].push(t);
  SFX.draw();
  if (seat === 0) {
    const m = tileMesh(t.expr, t.val, true);
    m.material = m.material.map(mm => mm.clone());
    m.userData.tile = t;
    m.position.set(0, 0.7, HAND_Z);
    handGroup.add(m);
    R.hand.push(m);
    layoutHand();
  }
  updateLabels();
  return true;
}
async function autoDraw(seat) {
  let got = false;
  while (S.boneyard.length && !canPlay(S.hands[seat][S.hands[seat].length - 1])) {
    autoDrawSync(seat);
    got = true;
    await sleep(240);
  }
  if (got) setMsg('Você comprou do monte.', 1600);
  refreshValid();
  return got;
}

/* ---------------- FIM ---------------- */
function endGame(winner) {
  S.over = true;
  clearEndButtons();
  const counts = S.hands.map(h => h.length);
  let title, sub;
  if (winner === 0) {
    S.wins++; SFX.win();
    title = 'Você <span style="color:#ffd84a">venceu!</span>';
    sub = 'Zerou a mão primeiro — potências afiadas!';
  } else if (winner > 0) {
    SFX.lose();
    title = `${SEAT_NAMES[winner]} venceu`;
    sub = 'Quase! Fique de olho nas metades de valor.';
  } else {
    const min = Math.min(...counts);
    const who = counts.indexOf(min);
    if (who === 0) { S.wins++; SFX.win(); title = 'Você <span style="color:#ffd84a">venceu!</span>'; sub = 'Jogo fechado: você tinha menos peças.'; }
    else { SFX.lose(); title = `${SEAT_NAMES[who]} venceu`; sub = 'Jogo fechado: menos peças na mão.'; }
  }
  $('#endTitle').innerHTML = title;
  $('#endSub').textContent = sub;
  $('#endStats').innerHTML = `
    <div class="stat"><small>Vitórias</small><b>${S.wins}</b></div>
    <div class="stat"><small>Partidas</small><b>${S.games}</b></div>
    <div class="stat"><small>Peças na mesa</small><b>${S.chain.length}</b></div>
    <div class="stat"><small>Restaram no monte</small><b>${S.boneyard.length}</b></div>`;
  $('#ovEnd').classList.remove('hidden');
  confetti(winner === 0 ? 80 : 30, winner === 0 ? ['#6ee0ef', '#ffd84a', '#a78bfa', '#fff'] : ['#8b93a3']);
}

/* ---------------- HUD ---------------- */
let msgTimer = null;
function setMsg(html, ms) {
  const el = $('#msg');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(msgTimer);
  if (ms) msgTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function flash(html) {
  const el = $('#flash');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => el.classList.remove('show'), 1200);
}
function updateHUD() {
  const dot = document.querySelector('#status .dot');
  const st = $('#statusTxt');
  if (S.over) { st.textContent = 'Fim de partida'; return; }
  if (S.turn === 0) { st.innerHTML = 'Sua vez'; dot.style.background = '#ffd84a'; dot.style.boxShadow = '0 0 10px #ffd84a'; }
  else {
    st.innerHTML = `${SEAT_NAMES[S.turn]} está jogando…`;
    dot.style.background = '#6ee0ef'; dot.style.boxShadow = '0 0 10px #6ee0ef';
  }
  const ftxt = h => (h.kind === 'expr' ? h.tex : vText(h.val));
  $('#statusEnds').textContent = (S.left && S.right ? `pontas: ${ftxt(S.left)} | ${ftxt(S.right)}` : '')
    + (S.boneyard.length ? `  ·  monte: ${S.boneyard.length}` : '  ·  monte vazio');
  ring.position.set(SEATS[S.turn].pos.x * 0.82, 0.012, SEATS[S.turn].pos.z * 0.82);
  ring.material.opacity = S.turn === 0 ? 0.5 : 0.3;
  ring.material.color.set(S.turn === 0 ? 0xffd84a : 0x6ee0ef);
  $('#btnHint').classList.toggle('off', !S.hint);
}

/* botões flutuantes nas pontas válidas */
function clearEndButtons() { $('#ends').innerHTML = ''; }
function updateEnds() {
  clearEndButtons();
  if (S.over || S.turn !== 0 || !S.sel) return;
  const sides = new Set(endsFor(S.sel).map(e => e.side));
  if (sides.size < 2) return;
  sides.forEach(side => {
    const btn = document.createElement('button');
    btn.className = 'endbtn';
    btn.dataset.side = side;
    btn.textContent = side === 'R' ? 'encaixar à direita →' : '← encaixar à esquerda';
    btn.onclick = () => humanPickEnd(side);
    $('#ends').appendChild(btn);
  });
  positionEndButtons();
}
function positionEndButtons() {
  const btns = $('#ends').querySelectorAll('.endbtn');
  if (!btns.length) return;
  const tg = chainTargets();
  btns.forEach(btn => {
    const side = btn.dataset.side;
    const base = side === 'R' ? tg[tg.length - 1] : tg[0];
    const p = new THREE.Vector3(base.x + (side === 'R' ? TW * 0.62 : -TW * 0.62), 0.05, base.z);
    const v = p.project(camera);
    btn.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    btn.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight + 8}px`;
  });
}
async function humanPickEnd(side) {
  if (!S.sel || S.over || S.turn !== 0) return;
  const tile = S.sel;
  const end = endsFor(tile).find(e => e.side === side);
  if (!end) return;
  S.sel = null;
  clearEndButtons();
  await placeTile(0, tile, end);
}

/* ---------------- INTERAÇÃO 3D ---------------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2(-9, -9);
let dragging = false, dragMoved = 0, lastX = 0, lastY = 0, downTile = null, hovered = null, hoverAmt = 0;

function pickTile(ev) {
  const r = canvas.getBoundingClientRect();
  ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const hits = ray.intersectObjects(R.hand.filter(m => m.visible), false);
  return hits.length ? hits[0].object : null;
}

canvas.addEventListener('pointerdown', e => {
  dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY;
  downTile = pickTile(e);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
});
canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;
    if (dragMoved > 6) {
      cam.theta -= dx * 0.0035; cam.phi -= dy * 0.003;
      applyCamera();
      $('#tooltip').style.opacity = 0;
      canvas.style.cursor = 'grabbing';
      return;
    }
  }
  const m = pickTile(e);
  if (m !== hovered) { hovered = m; hoverAmt = 0; }
  const tip = $('#tooltip');
  if (m && m.userData.tile) {
    const t = m.userData.tile;
    const playable = canPlay(t) && S.turn === 0 && !S.over;
    tip.innerHTML = `<span class="e">${t.expr.tex} &nbsp;|&nbsp; ${vText(t.val.val)}</span>` +
      (S.hint ? `<span class="s">${t.expr.steps}</span>` : '') +
      (playable ? '' : ' · <span style="color:#ff8b8b">não encaixa agora</span>');
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
    tip.style.opacity = 1;
    canvas.style.cursor = playable ? 'pointer' : 'not-allowed';
  } else {
    tip.style.opacity = 0;
    canvas.style.cursor = dragging ? 'grabbing' : 'grab';
  }
});
canvas.addEventListener('pointerup', e => {
  const wasDrag = dragMoved > 6;
  dragging = false;
  canvas.style.cursor = 'grab';
  const m = downTile;
  downTile = null;
  if (wasDrag || !m) return;
  const tile = m.userData.tile;
  if (!tile || S.over || S.turn !== 0) return;
  if (!canPlay(tile)) {
    SFX.err();
    const b = m.userData.base;
    if (b) {
      tweenObj(m, { position: [b.pos.x + .1, b.pos.y, b.pos.z] }, 70, { ease: easeOut })
        .then(() => tweenObj(m, { position: [b.pos.x - .1, b.pos.y, b.pos.z] }, 70))
        .then(() => tweenObj(m, { position: [b.pos.x, b.pos.y, b.pos.z] }, 90));
    }
    setMsg('Essa peça não encaixa em nenhuma ponta agora.', 2000);
    return;
  }
  const ends = endsFor(tile);
  if (ends.length === 1) { S.sel = null; clearEndButtons(); placeTile(0, tile, ends[0]); return; }
  S.sel = (S.sel === tile) ? null : tile;
  if (S.sel) setMsg('Essa peça encaixa nas <b>duas pontas</b> — escolha onde colocar.', 3000);
  updateEnds();
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  S.zoom = Math.min(2.2, Math.max(0.55, S.zoom * (1 + e.deltaY * 0.0012)));
  S.zoom = Math.min(2.2, Math.max(0.55, S.zoom));
}, { passive: false });

let pinch = 0;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const [a, b] = e.touches;
    pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && pinch) {
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    S.zoom = Math.min(2.2, Math.max(0.55, S.zoom * (pinch / d)));
    pinch = d;
    dragging = true; dragMoved = 999;
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { pinch = 0; }, { passive: true });

/* ---------------- CONFETE ---------------- */
const confettiBits = [];
function confetti(n, colors) {
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: colors[k % colors.length], side: THREE.DoubleSide, transparent: true }));
    m.position.set((Math.random() - .5) * 10, 4 + Math.random() * 4, (Math.random() - .5) * 8);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    m.userData.v = new THREE.Vector3((Math.random() - .5) * .04, -(0.03 + Math.random() * .05), (Math.random() - .5) * .04);
    m.userData.sp = new THREE.Vector3((Math.random() - .5) * .12, (Math.random() - .5) * .12, 0);
    scene.add(m); confettiBits.push(m);
  }
}
function updateConfetti(dt) {
  for (let k = confettiBits.length - 1; k >= 0; k--) {
    const m = confettiBits[k];
    m.position.addScaledVector(m.userData.v, dt / 16.6);
    m.rotation.x += m.userData.sp.x * dt / 16.6;
    m.rotation.y += m.userData.sp.y * dt / 16.6;
    if (m.position.y <= 0.02) {
      m.material.opacity -= 0.02;
      if (m.material.opacity <= 0) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); confettiBits.splice(k, 1); }
    }
  }
}

/* ---------------- DESTAQUES ---------------- */
const hlTex = (() => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 160;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(160, 80, 26, 160, 80, 158);
  grd.addColorStop(0, 'rgba(120,236,255,.55)');
  grd.addColorStop(.55, 'rgba(96,220,245,.34)');
  grd.addColorStop(.85, 'rgba(70,200,235,.10)');
  grd.addColorStop(1, 'rgba(70,200,235,0)');
  g.fillStyle = grd;
  roundRect(g, 4, 4, 312, 152, 30); g.fill();
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
})();
const hlPool = [];
for (let k = 0; k < 10; k++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(TW * 1.26, TD * 1.62),
    new THREE.MeshBasicMaterial({ map: hlTex, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 4;
  scene.add(m); hlPool.push(m);
}

/* ---------------- MARCAS DAS PONTAS ---------------- */
const endMarkers = [];
for (let k = 0; k < 2; k++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.50, 30),
    new THREE.MeshBasicMaterial({ color: 0x6ee0ef, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  m.renderOrder = 4;
  scene.add(m);
  endMarkers.push(m);
}
function updateEndMarkers(now) {
  const tg = chainTargets();
  if (S.over || S.turn !== 0 || !tg.length) { endMarkers.forEach(m => m.visible = false); return; }
  const spots = [
    { t: tg[0], dx: -TW * 0.68 },
    { t: tg[tg.length - 1], dx: TW * 0.68 }
  ];
  endMarkers.forEach((m, k) => {
    const sp = spots[k];
    m.visible = true;
    m.position.set(sp.t.x + sp.dx, 0.03, sp.t.z);
    const s = 1 + Math.sin(now / 380 + k) * 0.16;
    m.scale.set(s, s, s);
    m.material.opacity = 0.5 + Math.sin(now / 380 + k) * 0.22;
  });
}

/* ---------------- CÂMERA ---------------- */
const FOV_V = () => camera.fov * Math.PI / 180;
function keyPoints() {
  const pts = [];
  const handW = handWidth(R.hand.length);
  const hRows = Math.max(1, Math.ceil(R.hand.length / HCOLS()));
  const zHandNear = HAND_Z + (hRows - 1) * (TD + 0.26);
  pts.push(new THREE.Vector3(-handW / 2, 0.12, zHandNear), new THREE.Vector3(handW / 2, 0.12, zHandNear));
  const n = Math.max(1, S.chain.length);
  const cw = Math.min(COLS(), n) * (TW + GAPX);
  const rows = Math.ceil(n / COLS());
  pts.push(new THREE.Vector3(-cw / 2, 0.12, 0), new THREE.Vector3(cw / 2, 0.12, 0));
  pts.push(new THREE.Vector3(0, 0.5, -(rows - 1) * (TD + GAPZ) + TD / 2));
  if (!narrow()) {
    pts.push(new THREE.Vector3(0, 0.4, -4.2),
      new THREE.Vector3(-6.6, 0.4, -0.7), new THREE.Vector3(6.6, 0.4, -0.7));
  }
  return pts;
}
function desiredCamera() {
  const phi = narrow() ? 0.66 : 0.80;
  const rows = Math.max(1, Math.ceil(S.chain.length / COLS()));
  const handRows = Math.max(1, Math.ceil(R.hand.length / HCOLS()));
  const zTop = HAND_Z + (handRows - 1) * (TD + 0.26) + 0.85;
  const zBot = narrow()
    ? -(rows - 1) * (TD + GAPZ) - 1.0
    : Math.min(-(rows - 1) * (TD + GAPZ) - 0.9, -4.5);
  const targetZ = (zTop + zBot) / 2;
  const pts = keyPoints();
  let r = 12;
  for (let it = 0; it < 10; it++) {
    camera.position.set(cam.target.x + r * Math.sin(phi) * Math.sin(cam.theta),
      Math.cos(phi) * r,
      cam.target.z + r * Math.sin(phi) * Math.cos(cam.theta));
    camera.position.z = targetZ + r * Math.sin(phi) * Math.cos(cam.theta);
    camera.lookAt(cam.target.x, 0, targetZ);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    let worst = 0;
    for (const p of pts) {
      const v = p.clone().project(camera);
      // margens assimétricas: HUD no topo (chips) e mensagem/botões embaixo
      const limY = v.y >= 0 ? 0.78 : 0.70;
      worst = Math.max(worst, Math.abs(v.x) / 0.94, Math.abs(v.y) / limY);
    }
    if (Math.abs(worst - 1) < 0.02) break;
    r *= Math.pow(worst, 0.85);
    r = Math.min(60, Math.max(5, r));
  }
  camera.position.set(cam.target.x, Math.cos(phi) * cam.radius, targetZ + Math.sin(phi) * cam.radius);
  return { radius: r * S.zoom, phi, targetZ };
}
let camWanted = { radius: 11, phi: 0.8, targetZ: 0.4 };
function fitCamera(snap) {
  camWanted = desiredCamera();
  cam.phi = camWanted.phi;
  if (snap) { cam.radius = camWanted.radius; cam.target.z = camWanted.targetZ; applyCamera(); }
}
function smoothCamera(dt) {
  camWanted = desiredCamera();
  const k = Math.min(1, dt / 220);
  cam.radius += (camWanted.radius - cam.radius) * k;
  cam.target.z += (camWanted.targetZ - cam.target.z) * k;
  if (!dragging) cam.phi += (camWanted.phi - cam.phi) * k * 0.6;
  applyCamera();
}
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fitCamera(true);
  layoutHand();
  updateEnds();
});

/* ---------------- UI ---------------- */
$('#btnPlay').onclick = () => {
  S.hint = $('#swHint').classList.contains('on');
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { }
  newGame();
  fitCamera(true);
};
$('#swHint').onclick = () => $('#swHint').classList.toggle('on');
$('#btnHint').onclick = () => { S.hint = !S.hint; updateHUD(); setMsg(S.hint ? 'Resolução das potências <b>ligada</b>.' : 'Resolução <b>desligada</b> — desafio!', 1800); };
$('#btnSound').onclick = () => { S.sound = !S.sound; $('#btnSound').textContent = S.sound ? '🔊' : '🔇'; $('#btnSound').classList.toggle('off', !S.sound); };
$('#btnHelp').onclick = () => {
  $('#ovStart').classList.remove('hidden');
  $('#btnCloseHelp').classList.toggle('hidden', !S.round);
};
$('#btnCloseHelp').onclick = () => $('#ovStart').classList.add('hidden');
$('#btnRestart').onclick = () => { newGame(); fitCamera(true); };
$('#btnAgain').onclick = () => { newGame(); fitCamera(true); };
$('#btnPass').onclick = () => { $('#btnPass').classList.add('hidden'); passTurn(0); };
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'h') $('#btnHint').click();
  if (k === 'm') $('#btnSound').click();
  if (k === 'n' || k === 'r') { newGame(); fitCamera(true); }
  if (k === 'escape') { $('#ovStart').classList.add('hidden'); }
});

/* ---------------- LOOP ---------------- */
let lastT = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(48, now - lastT);
  lastT = now;
  updateTweens(dt);
  updateConfetti(dt);
  smoothCamera(dt);

  /* hover nas peças da mão */
  hoverAmt += ((hovered ? 1 : 0) - hoverAmt) * Math.min(1, dt / 90);
  R.hand.forEach(m => {
    const b = m.userData.base;
    if (!b) return;
    const isH = m === hovered;
    const wantLift = isH ? 1 : (m.userData.playable ? 0.35 : 0);
    m.userData.lift = (m.userData.lift || 0) + (wantLift - (m.userData.lift || 0)) * Math.min(1, dt / 120);
    if (!hasTween(m)) {
      m.position.y = b.pos.y + m.userData.lift * 0.3;
      m.position.z = b.pos.z + m.userData.lift * 0.12;
      const sc = 1 + m.userData.lift * 0.05;
      m.scale.set(sc, 1, sc);
    }
  });

  /* destaques das jogáveis */
  hlPool.forEach(h => h.visible = false);
  if (S.turn === 0 && !S.over) {
    let n = 0;
    R.hand.forEach(m => {
      if (!m.userData.playable || n >= hlPool.length) return;
      const h = hlPool[n++];
      h.visible = true;
      h.position.set(m.position.x, 0.045, m.position.z);
      h.rotation.z = 0;
    });
    const pulse = 0.62 + Math.sin(now / 320) * 0.18;
    hlPool.forEach(h => { if (h.visible) h.material.opacity = pulse; });
  }
  updateEndMarkers(now);
  if ($('#ends').childElementCount) positionEndButtons();
  if (!S.over) {
    ring.material.opacity += ((S.turn === 0 ? 0.5 : 0.28) + Math.sin(now / 460) * 0.08 - ring.material.opacity) * 0.2;
  } else ring.material.opacity += (0 - ring.material.opacity) * 0.1;

  renderer.render(scene, camera);
}

/* início */
fitCamera();
requestAnimationFrame(animate);

/* hooks de teste */
window.__domino = {
  S, R, scene, camera, endsFor, canPlay, placeTile, newGame, endGame,
  handInfo: () => S.hands[0].map(t => ({
    id: t.id, e: t.expr.tex, val: vText(t.val.val), ok: canPlay(t)
  })),
  playAuto: () => {
    if (S.turn !== 0 || S.over) return null;
    const t = S.hands[0].find(canPlay);
    if (!t) return 'none';
    const end = endsFor(t)[0];
    placeTile(0, t, end);
    return t.id;
  },
  state: () => ({
    turn: S.turn, over: S.over, chain: S.chain.length, boneyard: S.boneyard.length,
    hands: S.hands.map(h => h.length), left: S.left, right: S.right,
    chainOk: S.chain.every((e, k) => k === 0 || matchHalf(S.chain[k - 1].hr, e.hl))
  })
};
