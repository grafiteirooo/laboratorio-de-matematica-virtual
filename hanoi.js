/* =====================================================================
   TORRE DE HANOI — 3D
   Regras: mover um disco por vez, só o de cima de cada torre, e nunca
   colocar um disco maior sobre um menor. Objetivo: levar todos os discos
   da torre 1 (A) para a torre 3 (C), na mesma ordem.
   Mínimo de movimentos = 2ⁿ − 1.
   ===================================================================== */
'use strict';

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mod = (n, m) => ((n % m) + m) % m;

/* ---------------- ESTADO ---------------- */
const S = {
  n: 5,
  pegs: [[], [], []],      // pegs[i] = [tamanhos], índice 0 = base, último = topo
  meshes: {},              // tamanho -> mesh
  moves: 0, history: [], sel: null, over: false, started: false,
  t0: 0, elapsed: 0, busy: false, guiding: false, stopGuide: false,
  hintMode: true, sound: true, wins: 0, games: 0, assisted: false, undoCount: 0
};
const DISK_COLORS = ['#d1304f', '#1a7fe0', '#f58220', '#f5d922', '#7c2fc9', '#22a06b', '#e0559b'];
const PEG_NAMES = ['A', 'B', 'C'];
const PEG_INDEX = [0, 1, 2];

/* geometria */
const PEG_X = [-3.4, 0, 3.4];
const BASE_W = 10.4, BASE_H = 0.45, BASE_D = 3.1;
const PEG_R = 0.085, PEG_H = 3.5;
const DISK_H = 0.30;
const BASE_TOP = BASE_H;
const diskRadius = s => {
  const rMax = 1.5, rMin = 0.55;
  return S.n <= 1 ? rMax : rMin + (rMax - rMin) * (s - 1) / (S.n - 1);
};
const stackY = k => BASE_TOP + DISK_H / 2 + k * DISK_H;
const travelY = () => BASE_TOP + PEG_H + 0.55;

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
scene.fog = new THREE.Fog('#07070b', 26, 64);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 140);
const cam = { theta: 0, phi: 0.94, radius: 12, target: new THREE.Vector3(0, 1.25, 0), zoom: 1 };
function applyCamera() {
  cam.phi = Math.min(1.28, Math.max(0.42, cam.phi));
  cam.theta = Math.min(0.62, Math.max(-0.62, cam.theta));
  const sp = Math.sin(cam.phi);
  camera.position.set(
    cam.target.x + cam.radius * sp * Math.sin(cam.theta),
    cam.target.y + cam.radius * Math.cos(cam.phi),
    cam.target.z + cam.radius * sp * Math.cos(cam.theta)
  );
  camera.lookAt(cam.target);
}

/* luzes */
scene.add(new THREE.HemisphereLight(0xdce6ff, 0x232833, 0.42));
scene.add(new THREE.AmbientLight(0xffffff, 0.06));
const key = new THREE.DirectionalLight(0xfff6e2, 0.72);
key.position.set(6, 16, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -14; key.shadow.camera.right = 14;
key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
key.shadow.camera.near = 1; key.shadow.camera.far = 44;
key.shadow.bias = -0.0011; key.shadow.normalBias = 0.014; key.shadow.radius = 3;
scene.add(key);
const rim = new THREE.DirectionalLight(0xffb37a, 0.16);
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
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180),
  new THREE.MeshStandardMaterial({ color: '#07070b', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; scene.add(floor);
const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ map: tableTexture(), roughness: 0.95, transparent: true, depthWrite: false }));
table.rotation.x = -Math.PI / 2; table.receiveShadow = true; table.renderOrder = 1; scene.add(table);

/* ---------------- TWEENS ---------------- */
let tweens = [];
function tweenObj(obj, to, dur = 260, opt = {}) {
  for (let n = tweens.length - 1; n >= 0; n--) {
    if (tweens[n].obj === obj) {
      const old = tweens.splice(n, 1)[0];
      if (old.resolve) old.resolve();          // libera quem estava esperando
    }
  }
  return new Promise(resolve => {
    tweens.push({
      obj, to, dur, t: 0, delay: opt.delay || 0, ease: opt.ease || easeInOut, resolve,
      from: {
        px: obj.position.x, py: obj.position.y, pz: obj.position.z,
        ry: obj.rotation.y, s: obj.scale.x
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
    if (to.scale !== undefined) { const s = lerp(f.s, to.scale, e); o.scale.set(s, s, s); }
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
  pick: () => beep(600, .07, 'triangle', .05),
  drop: () => { beep(320, .09, 'sine', .06); beep(190, .11, 'sine', .05, .03); },
  err: () => { beep(180, .12, 'sawtooth', .05); beep(140, .14, 'sawtooth', .04, .1); },
  win: () => [523, 659, 784, 1046].forEach((f, n) => beep(f, .22, 'triangle', .07, n * .13))
};

/* ---------------- RÓTULOS ---------------- */
function makeLabel(text, opts) {
  opts = opts || {};
  const fs = 44, pad = 24;
  const c = document.createElement('canvas');
  let g = c.getContext('2d');
  g.font = `700 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  c.width = Math.ceil(g.measureText(text).width) + pad * 2;
  c.height = fs + pad * 1.4;
  g = c.getContext('2d');
  g.font = `700 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  if (opts.bg !== false) {
    g.fillStyle = opts.bg || 'rgba(10,10,14,.85)';
    g.beginPath(); g.roundRect ? g.roundRect(0, 0, c.width, c.height, c.height / 2) : g.rect(0, 0, c.width, c.height);
    g.fill();
  }
  g.fillStyle = opts.color || '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const sc = opts.scale || 0.0085;
  sp.scale.set(c.width * sc, c.height * sc, 1);
  return sp;
}

/* ---------------- TABULEIRO ---------------- */
const boardGroup = new THREE.Group(); scene.add(boardGroup);
const diskGeoCache = {};
const whiteMat = new THREE.MeshStandardMaterial({ color: '#f2f4f7', roughness: 0.55, metalness: 0.02 });
const baseMat = new THREE.MeshStandardMaterial({ color: '#eef1f6', roughness: 0.55, metalness: 0.02 });
const pegMats = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: '#dfe4ec', roughness: 0.45 }));

const pegRings = [];   // argolas de destaque nas torres
let baseMesh = null;
const pegsMeshes = [];

function buildBoard() {
  while (boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);
  pegsMeshes.length = 0;

  /* base branca */
  baseMesh = new THREE.Mesh(new THREE.BoxGeometry(BASE_W, BASE_H, BASE_D), baseMat);
  baseMesh.position.y = BASE_H / 2;
  baseMesh.castShadow = true; baseMesh.receiveShadow = true;
  boardGroup.add(baseMesh);

  /* pino/base de cada torre + haste */
  PEG_X.forEach((x, i) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.14, 32), pegMats[i]);
    foot.position.set(x, BASE_TOP + 0.07, 0);
    foot.castShadow = false; foot.receiveShadow = true;
    boardGroup.add(foot);

    const peg = new THREE.Mesh(new THREE.CylinderGeometry(PEG_R, PEG_R, PEG_H, 24), pegMats[i]);
    peg.position.set(x, BASE_TOP + 0.14 + PEG_H / 2, 0);
    peg.castShadow = false;
    peg.userData.peg = i;
    boardGroup.add(peg);
    pegsMeshes.push(peg);

    const lab = makeLabel(PEG_NAMES[i], { scale: 0.0072, bg: 'rgba(12,16,22,.9)', color: '#e8eef8' });
    lab.material.depthTest = false;
    lab.renderOrder = 25;
    lab.userData.landscapePos = new THREE.Vector3(x, BASE_H * 0.55, BASE_D / 2 + 0.06);
    lab.userData.portraitPos = new THREE.Vector3(x - 1.05, BASE_H * 0.55, 0);
    lab.position.copy(lab.userData.landscapePos);
    lab.userData.isLabel = true;
    boardGroup.add(lab);
  });

  /* argolas de destaque (sobem do chão) */
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.5, 40),
      new THREE.MeshBasicMaterial({ color: 0x6ee0ef, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(PEG_X[i], BASE_TOP + 0.005, 0);
    m.renderOrder = 4;
    boardGroup.add(m);
    pegRings[i] = m;
  }
}

function buildDisks() {
  Object.values(S.meshes).forEach(m => scene.remove(m));
  S.meshes = {};
  for (let s = 1; s <= S.n; s++) {
    const r = diskRadius(s);
    const geo = new THREE.CylinderGeometry(r, r, DISK_H, 56, 1, false);
    const col = DISK_COLORS[(S.n - s) % DISK_COLORS.length];
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.42, metalness: 0.05 });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.size = s;
    boardGroup.add(m);
    S.meshes[s] = m;
  }
}

/* ---------------- LAYOUT ---------------- */
function layoutDisks(instant) {
  for (let p = 0; p < 3; p++) {
    S.pegs[p].forEach((size, k) => {
      const m = S.meshes[size];
      if (!m) return;
      const y = stackY(k);
      if (instant) m.position.set(PEG_X[p], y, 0);
      else if (!hasTween(m)) tweenObj(m, { position: [PEG_X[p], y, 0] }, 220, { ease: easeOut });
      m.userData.peg = p;
      m.userData.stack = k;
      m.userData.top = k === S.pegs[p].length - 1;
    });
  }
}

/* ---------------- PARTIDA ---------------- */
function resetGame(n, keepOverlay) {
  if (n) S.n = n;
  tweens = [];
  S.pegs = [[], [], []];
  for (let s = S.n; s >= 1; s--) S.pegs[0].push(s);   // maior embaixo
  S.moves = 0; S.history = []; S.sel = null; S.over = false; S.started = false;
  S.elapsed = 0; S.t0 = 0; S.busy = false; S.guiding = false; S.stopGuide = false;
  S.assisted = false; S.undoCount = 0;
  S.round = (S.round || 0) + 1;
  S.games++;
  clearOverlays();
  $('#hud').classList.remove('hidden');
  if (!keepOverlay) $('#ovStart').classList.add('hidden');
  $('#btnStop').classList.add('hidden');
  $('#ovEnd').classList.add('hidden');
  buildBoard();
  buildDisks();
  layoutDisks(true);
  fitCamera();
  updateHUD();
  setMsg(`Leve os ${S.n} discos da torre A para a torre C. Mínimo: ${Math.pow(2, S.n) - 1} movimentos.`, 4200);
}
function clearOverlays() {
  $('#flash').classList.remove('show');
}

/* ---------------- REGRAS ---------------- */
const topOf = p => (S.pegs[p].length ? S.pegs[p][S.pegs[p].length - 1] : 0);
const canDrop = (size, p) => {
  const t = topOf(p);
  return t === 0 || size < t;
};
const pegOfDisk = size => {
  for (let p = 0; p < 3; p++) if (S.pegs[p].includes(size)) return p;
  return -1;
};

function isWin() { return S.pegs[2].length === S.n; }

/* ---------------- INTERAÇÃO ---------------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2(-9, -9);
let dragging = false, dragMoved = 0, lastX = 0, lastY = 0, downObj = null, hovered = null;

function setPtr(e) {
  const r = canvas.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
function pickDisk(ev) {
  setPtr(ev);
  ray.setFromCamera(ptr, camera);
  const list = Object.values(S.meshes);
  const hits = ray.intersectObjects(list, false);
  return hits.length ? hits[0].object : null;
}
function pickPeg(ev) {
  setPtr(ev);
  ray.setFromCamera(ptr, camera);
  /* plano da superfície da base */
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASE_TOP);
  const p = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, p)) return -1;
  let best = -1, bestD = 1.85;
  PEG_X.forEach((x, i) => {
    const d = Math.abs(p.x - x);
    if (d < bestD && Math.abs(p.z) < BASE_D * 0.9) { bestD = d; best = i; }
  });
  return best;
}

canvas.addEventListener('pointerdown', e => {
  dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY;
  downObj = pickDisk(e);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
});
canvas.addEventListener('pointermove', e => {
  setPtr(e);
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;
    if (dragMoved > 6) {
      cam.theta -= dx * 0.0035;
      cam.phi -= dy * 0.0028;
      applyCamera();
      $('#tooltip').style.opacity = 0;
      canvas.style.cursor = 'grabbing';
      return;
    }
  }
  const m = pickDisk(e);
  hovered = m;
  const tip = $('#tooltip');
  if (m) {
    const size = m.userData.size;
    const mover = m.userData.top && !S.busy && !S.over;
    tip.innerHTML = `Disco <b>${size}</b> · torre ${PEG_NAMES[m.userData.peg]}` +
      (mover ? '' : ' · <span style="color:#ffb3b3">está coberto</span>');
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
    tip.style.opacity = 1;
    canvas.style.cursor = mover ? 'pointer' : 'default';
  } else {
    tip.style.opacity = 0;
    canvas.style.cursor = dragging ? 'grabbing' : 'grab';
  }
});
canvas.addEventListener('pointerup', e => {
  const wasDrag = dragMoved > 6;
  dragging = false;
  canvas.style.cursor = 'grab';
  if (wasDrag) { downObj = null; return; }
  const disk = downObj; downObj = null;
  if (S.over || S.guiding) return;
  if (disk) { enqueue({ kind: 'disk', size: disk.userData.size }); return; }
  const p = pickPeg(e);
  if (p < 0) return;
  enqueue({ kind: 'peg', p });
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.zoom = Math.min(2.0, Math.max(0.55, cam.zoom * (1 + e.deltaY * 0.0012)));
  applyCamera();
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
    cam.zoom = Math.min(2.0, Math.max(0.55, cam.zoom * (pinch / d)));
    pinch = d;
    applyCamera();
    dragging = true; dragMoved = 999;
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { pinch = 0; }, { passive: true });

/* ---------------- INTENÇÕES (cliques) ----------------
   Durante a animação de um movimento a entrada é bloqueada (~350 ms),
   para não desalinhar o par "pegar disco → escolher torre". */
function enqueue(intent) {
  if (S.busy || S.over || S.guiding) return;
  if (intent.kind === 'disk') diskIntent(intent.size);
  else pegIntent(intent.p);
}
function diskIntent(size) {
  if (S.over || S.guiding) return;
  const m = S.meshes[size];
  if (!m || !m.userData.top) {
    SFX.err();
    setMsg(`O disco <b>${size}</b> está coberto — mova primeiro o disco de cima.`, 2200);
    shake(m);
    return;
  }
  if (S.sel && S.sel.size === size) { putBack(); return; }
  if (S.sel) { attemptMove(S.sel.size, pegOfDisk(size)); return; }
  lift(size);
}
function pegIntent(p) {
  if (S.over || S.guiding) return;
  if (S.sel) { attemptMove(S.sel.size, p); return; }
  if (S.pegs[p].length) lift(topOf(p));
}

/* ---------------- PEGAR / SOLTAR ---------------- */
function lift(size) {
  const p = pegOfDisk(size);
  if (p < 0) return;
  if (topOf(p) !== size) {
    SFX.err();
    setMsg(`O disco <b>${size}</b> está coberto — mova primeiro o disco de cima.`, 2200);
    shake(S.meshes[size]);
    return;
  }
  S.sel = { size, from: p };
  SFX.pick();
  const m = S.meshes[size];
  tweenObj(m, { position: [PEG_X[p], travelY(), 0], scale: 1.06 }, 220, { ease: easeOut });
  setMsg(`Disco <b>${size}</b> na mão — clique na torre de destino.`, 3000);
  updatePegHighlights();
  updateHUD();
}

function putBack() {
  if (!S.sel) return;
  const size = S.sel.size, p = pegOfDisk(size);
  const k = S.pegs[p].indexOf(size);
  S.sel = null;
  tweenObj(S.meshes[size], { position: [PEG_X[p], stackY(k), 0], scale: 1 }, 200, { ease: easeOut });
  updatePegHighlights();
  updateHUD();
}

async function attemptMove(size, to) {
  if (S.over) return;
  while (S.busy) await sleep(50);            // serializa com a animação em curso
  if (S.over) return;
  const from = pegOfDisk(size);
  if (from < 0 || to < 0) return;
  if (from === to) { putBack(); return; }
  if (!canDrop(size, to)) {
    SFX.err();
    const t = topOf(to);
    setMsg(`Não pode: o disco <b>${size}</b> é maior que o <b>${t}</b> da torre ${PEG_NAMES[to]}.`, 2800);
    const m = S.meshes[size];
    shake(m);
    putBack();
    return;
  }
  S.sel = null;
  await doMove(size, from, to, true);
}

async function doMove(size, from, to, count) {
  S.busy = true;
  updatePegHighlights();
  const m = S.meshes[size];
  /* tira do estado */
  S.pegs[from].pop();
  S.pegs[to].push(size);
  const k = S.pegs[to].length - 1;

  await tweenObj(m, { position: [PEG_X[from], travelY(), 0], scale: 1.08 }, 110, { ease: easeOut });
  await tweenObj(m, { position: [PEG_X[to], travelY(), 0], scale: 1.08 }, Math.max(150, 280 - S.n * 12), { ease: easeInOut });
  await tweenObj(m, { position: [PEG_X[to], stackY(k), 0], scale: 1 }, 120, { ease: easeOut });

  m.userData.peg = to;
  m.userData.stack = k;
  layoutDisks(false);          // atualiza os topos antes de liberar a fila
  S.busy = false;

  if (count) {
    S.moves++;
    S.history.push({ size, from, to });
    if (!S.started) { S.started = true; S.t0 = performance.now(); }
    SFX.drop();
    flash(`${PEG_NAMES[from]} → ${PEG_NAMES[to]}`);
  }
  updateHUD();
  if (isWin()) endGame();
}

async function undo() {
  if (S.over || S.guiding) return;
  while (S.busy) await sleep(60);            // espera a animação atual
  if (S.over || S.guiding || !S.history.length) return;
  const last = S.history.pop();
  S.sel = null;
  S.undoCount++;
  S.busy = true;
  /* garante que o disco está no topo da torre de destino atual */
  const cur = pegOfDisk(last.size);
  S.pegs[cur].pop();
  S.pegs[last.from].push(last.size);
  const m = S.meshes[last.size];
  const k = S.pegs[last.from].length - 1;
  await tweenObj(m, { position: [PEG_X[cur], travelY(), 0], scale: 1.04 }, 170);
  await tweenObj(m, { position: [PEG_X[last.from], travelY(), 0], scale: 1.04 }, 260);
  await tweenObj(m, { position: [PEG_X[last.from], stackY(k), 0], scale: 1 }, 160);
  layoutDisks(false);
  S.busy = false;
  S.moves = Math.max(0, S.moves - 1);
  updateHUD();
  setMsg(`Desfeito: disco <b>${last.size}</b> voltou para a torre ${PEG_NAMES[last.from]}.`, 2000);
}

/* ---------------- RESOLVEDOR (BFS) ---------------- */
/* estado = posição de cada disco: pos[size] = torre (0..2) */
function stateFromPegs() {
  const pos = new Array(S.n + 1).fill(0);
  for (let p = 0; p < 3; p++) S.pegs[p].forEach(size => { pos[size] = p; });
  return pos;
}
function solve(state, target) {
  target = target === undefined ? 2 : target;
  const enc = a => a.join('');
  const goal = new Array(S.n + 1).fill(target); goal[0] = 0;
  if (enc(state) === enc(goal)) return [];
  const start = state.slice();
  const seen = new Set([enc(start)]);
  const parent = new Map();
  const moveOf = new Map();
  parent.set(enc(start), null);
  let queue = [start], head = 0, found = null;
  while (head < queue.length && !found) {
    const cur = queue[head++];
    const top = [0, 0, 0];
    for (let s = S.n; s >= 1; s--) top[cur[s]] = s;   // menor tamanho = topo
    for (let from = 0; from < 3; from++) {
      const d = top[from];
      if (!d) continue;
      for (let to = 0; to < 3; to++) {
        if (to === from) continue;
        if (top[to] !== 0 && top[to] < d) continue;    // maior sobre menor: proibido
        const nx = cur.slice();
        nx[d] = to;
        const k = enc(nx);
        if (seen.has(k)) continue;
        seen.add(k);
        parent.set(k, enc(cur));
        moveOf.set(k, { size: d, from, to });
        if (k === enc(goal)) { found = k; break; }
        queue.push(nx);
      }
      if (found) break;
    }
  }
  if (!found) return [];
  const path = [];
  let k = found;
  while (parent.get(k)) { path.push(moveOf.get(k)); k = parent.get(k); }
  return path.reverse();
}

async function showHint() {
  if (S.over || S.guiding) return;
  while (S.busy) await sleep(60);
  if (S.over || S.guiding) return;
  const path = solve(stateFromPegs());
  if (!path.length) { setMsg('Já está resolvido! 🎉', 2200); return; }
  S.assisted = true;
  const mv = path[0];
  S.sel = null;
  updatePegHighlights();
  const m = S.meshes[mv.size];
  tweenObj(m, { position: [m.position.x, m.position.y + 0.22, 0], scale: 1.05 }, 180, { ease: easeOut })
    .then(() => tweenObj(m, { position: [m.position.x, m.position.y - 0.22, 0], scale: 1 }, 220, { ease: easeInOut }));
  const ring = pegRings[mv.to];
  ring.material.color.set(0xffd84a);
  ring.userData.hint = performance.now();
  pegRings[mv.from].material.color.set(0x6ee0ef);
  pegRings[mv.from].userData.hint = performance.now();
  setMsg(`Dica: mova o disco <b>${mv.size}</b> de <b>${PEG_NAMES[mv.from]}</b> para <b>${PEG_NAMES[mv.to]}</b>. ` +
    `Faltam <b>${path.length}</b> movimentos.`, 5200);
}

async function autoSolve() {
  if (S.busy || S.over || S.guiding) return;
  const path = solve(stateFromPegs());
  if (!path.length) return;
  S.guiding = true; S.stopGuide = false; S.assisted = true;
  S.sel = null;
  updatePegHighlights();
  $('#btnStop').classList.remove('hidden');
  updateHUD();
  setMsg(`Mostrando a solução ótima (${path.length} movimentos)…`, 3000);
  const gap = Math.max(210, 620 - S.n * 52);
  for (const mv of path) {
    if (S.stopGuide) break;
    const cur = pegOfDisk(mv.size);
    if (cur !== mv.from || !canDrop(mv.size, mv.to)) break;
    await doMove(mv.size, mv.from, mv.to, true);
    await sleep(gap);
  }
  S.guiding = false;
  $('#btnStop').classList.add('hidden');
  updateHUD();
  if (!S.over) setMsg('Solução pausada.', 1800);
}
function stopGuide() {
  S.stopGuide = true;
  S.guiding = false;
  $('#btnStop').classList.add('hidden');
  updateHUD();
}

/* ---------------- FIM ---------------- */
function endGame() {
  S.over = true;
  S.sel = null;
  updatePegHighlights();
  const min = Math.pow(2, S.n) - 1;
  const perfect = S.moves === min;
  S.wins++;
  SFX.win();
  const time = fmtTime(S.elapsed);
  $('#endTitle').innerHTML = perfect
    ? 'Perfeito! <span style="color:#ffd84a">✨</span>'
    : 'Você <span style="color:#ffd84a">venceu!</span>';
  $('#endSub').textContent = perfect
    ? `Você usou o mínimo possível: ${min} movimentos.`
    : (S.assisted ? 'Torre montada com ajuda da solução.' : 'Torre montada! Tente bater o mínimo.');
  $('#endStats').innerHTML = `
    <div class="stat"><small>Movimentos</small><b>${S.moves}</b></div>
    <div class="stat"><small>Mínimo (2ⁿ−1)</small><b>${min}</b></div>
    <div class="stat"><small>Tempo</small><b>${time}</b></div>
    <div class="stat"><small>Discos</small><b>${S.n}</b></div>`;
  $('#ovEnd').classList.remove('hidden');
  $('#btnStop').classList.add('hidden');
  confetti(perfect ? 90 : 40);
  updateHUD();
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
let flashTimer = null;
function flash(text) {
  const el = $('#flash');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 900);
}
const fmtTime = ms => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
function updateHUD() {
  $('#stMoves').textContent = S.moves;
  $('#stMin').textContent = Math.pow(2, S.n) - 1;
  $('#stTime').textContent = fmtTime(S.elapsed);
  $('#btnUndo').disabled = !S.history.length || S.busy || S.over;
  $('#pegA').classList.toggle('on', !!(S.sel && S.sel.from === 0));
  $('#pegB').classList.toggle('on', !!(S.sel && S.sel.from === 1));
  $('#pegC').classList.toggle('on', !!(S.sel && S.sel.from === 2));
  ['#pegA', '#pegB', '#pegC'].forEach(id => { $(id).disabled = S.over || S.guiding; });
}
function updatePegHighlights() {
  for (let i = 0; i < 3; i++) {
    const ring = pegRings[i];
    if (!ring) continue;
    let on = false, color = 0x6ee0ef;
    if (S.sel) {
      if (S.sel.from === i) { on = true; color = 0x6ee0ef; }
      else if (S.hintMode && canDrop(S.sel.size, i)) { on = true; color = 0x57e08a; }
    }
    ring.userData.target = on;
    ring.material.color.set(color);
    if (!on) ring.material.opacity = Math.min(ring.material.opacity, 0.2);
  }
}

/* ---------------- CONFETE ---------------- */
const confettiBits = [];
function confetti(n) {
  const cols = ['#d1304f', '#1a7fe0', '#f58220', '#f5d922', '#7c2fc9', '#ffffff'];
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: cols[k % cols.length], side: THREE.DoubleSide, transparent: true }));
    m.position.set((Math.random() - .5) * 12, 5 + Math.random() * 4, (Math.random() - .5) * 8);
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

function shake(mesh) {
  if (!mesh) return;
  const x0 = mesh.position.x;
  tweenObj(mesh, { position: [x0 + 0.12, mesh.position.y, mesh.position.z] }, 60, { ease: easeOut })
    .then(() => tweenObj(mesh, { position: [x0 - 0.12, mesh.position.y, mesh.position.z] }, 60))
    .then(() => tweenObj(mesh, { position: [x0, mesh.position.y, mesh.position.z] }, 80));
}

/* ---------------- CÂMERA ---------------- */
function fitCamera() {
  const port = camera.aspect < 0.85;
  /* no celular (retrato) o tabuleiro gira 90°: as torres ficam em profundidade,
     aproveitando a altura da tela em vez de espremer 10 unidades na largura. */
  boardGroup.rotation.y = port ? Math.PI / 2 : 0;
  boardGroup.children.forEach(c => {
    if (c.userData && c.userData.isLabel) {
      c.position.copy(port ? c.userData.portraitPos : c.userData.landscapePos);
    }
  });

  const vFov = camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const topY = BASE_TOP + 0.14 + PEG_H;
  const wSpan = (port ? BASE_D + 2.6 : BASE_W + 2.6);
  const dSpan = (port ? BASE_W + 1.4 : BASE_D + 1.4);
  const phi = port ? 0.76 : (camera.aspect < 1.2 ? 0.90 : 0.96);

  const needW = wSpan / (2 * Math.tan(hFov / 2)) * 1.06;
  const visH = dSpan * Math.cos(phi) + topY * Math.sin(phi) + 2.2;   // altura ocupada na tela
  const needH = visH / (2 * Math.tan(vFov / 2));
  cam.radius = Math.max(9.5, needW, needH) * cam.zoom * (port ? 1.30 : 1);
  cam.phi = phi;
  cam.target.y = topY * (port ? 0.34 : 0.44);
  applyCamera();
}
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fitCamera();
});

/* ---------------- UI ---------------- */
let pickN = 5;
document.querySelectorAll('#pickN .pick').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#pickN .pick').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    pickN = +b.dataset.n;
  };
});
$('#btnPlay').onclick = () => {
  S.hintMode = $('#swHelpMode').classList.contains('on');
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { }
  resetGame(pickN, false);
};
$('#swHelpMode').onclick = () => {
  $('#swHelpMode').classList.toggle('on');
  S.hintMode = $('#swHelpMode').classList.contains('on');
  updatePegHighlights();
};
$('#btnAgain').onclick = () => resetGame(S.n, true);
$('#btnRestart').onclick = () => resetGame(S.n, true);
$('#btnHint').onclick = () => showHint();
$('#btnUndo').onclick = () => undo();
$('#btnHelp').onclick = () => $('#ovStart').classList.remove('hidden');
$('#btnStop').onclick = () => stopGuide();
$('#btnSound').onclick = () => {
  S.sound = !S.sound;
  $('#btnSound').textContent = S.sound ? '🔊' : '🔇';
  $('#btnSound').classList.toggle('off', !S.sound);
};
$('#pegA').onclick = () => clickPeg(0);
$('#pegB').onclick = () => clickPeg(1);
$('#pegC').onclick = () => clickPeg(2);
function clickPeg(p) { enqueue({ kind: 'peg', p }); }
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === '1' || k === 'a') clickPeg(0);
  if (k === '2' || k === 'b') clickPeg(1);
  if (k === '3' || k === 'c') clickPeg(2);
  if (k === 'h') showHint();
  if (k === 'z') undo();
  if (k === 'm') $('#btnSound').click();
  if (k === 'n' || k === 'r') resetGame(S.n, true);
  if (k === 'escape') { $('#ovStart').classList.add('hidden'); $('#ovEnd').classList.add('hidden'); }
});

/* ---------------- LOOP ---------------- */
let lastT = performance.now();
let elapsedTick = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(48, now - lastT);
  lastT = now;
  updateTweens(dt);
  updateConfetti(dt);

  if (S.started && !S.over) {
    S.elapsed = now - S.t0;
    elapsedTick += dt;
    if (elapsedTick > 250) { elapsedTick = 0; $('#stTime').textContent = fmtTime(S.elapsed); }
  }

  /* pulso das argolas */
  pegRings.forEach(r => {
    if (!r) return;
    const hintAge = r.userData.hint ? now - r.userData.hint : 1e9;
    const active = r.userData.target || hintAge < 1600;
    const target = active ? 0.55 + Math.sin(now / 300) * 0.22 : 0;
    r.material.opacity += (target - r.material.opacity) * 0.18;
    r.visible = r.material.opacity > 0.01;
  });

  /* brilho sutil no disco selecionado */
  if (S.sel) {
    const m = S.meshes[S.sel.size];
    if (m && !hasTween(m)) m.rotation.y += dt * 0.0012;
  }

  /* disco sob o cursor */
  Object.values(S.meshes).forEach(m => {
    const want = (hovered === m) ? 1 : 0;
    m.userData.glow = (m.userData.glow || 0) + (want - (m.userData.glow || 0)) * Math.min(1, dt / 110);
    if (m.material.emissive) {
      const g = m.userData.glow * 0.16;
      m.material.emissive.setRGB(g, g, g);
    }
  });

  renderer.render(scene, camera);
}

/* início */
resetGame(5, true);
requestAnimationFrame(animate);

/* hooks de teste */
window.__hanoi = {
  S, scene, camera,
  resetGame, solve, showHint, autoSolve, attemptMove, clickPeg, lift, undo,
  state: () => ({
    n: S.n, moves: S.moves, over: S.over, busy: S.busy,
    pegs: S.pegs.map(p => p.slice()), sel: S.sel, min: Math.pow(2, S.n) - 1,
    solved: isWin(), history: S.history.length
  }),
  play: (size, to) => attemptMove(size, to),
  legal: (size, to) => canDrop(size, to)
};
