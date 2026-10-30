/* =========================================================
   UNO DA RADICIAÇÃO — 3D
   Jogo de cartas educativo: o valor de cada carta é o
   resultado da radiciação (√64 → 8).
   ========================================================= */
'use strict';

/* ---------------- DADOS ---------------- */
const COLORS = ['red', 'blue', 'green', 'yellow'];
const HEX = { red: '#e01f2d', blue: '#1592e6', green: '#5fbf43', yellow: '#f6cf3f' };
const CNAME = { red: 'vermelho', blue: 'azul', green: 'verde', yellow: 'amarelo' };

const ROOTS = [
  ['√', '4', 2], ['∛', '8', 2], ['√', '9', 3], ['∜', '81', 3],
  ['√', '16', 4], ['∛', '64', 4], ['√', '25', 5], ['∛', '125', 5],
  ['√', '36', 6], ['∛', '216', 6], ['√', '49', 7], ['√', '64', 8], ['√', '81', 9]
];

const CARD_W = 1.12, CARD_H = 1.68, CARD_T = 0.032;
const TEX_W = 480, TEX_H = 720;

/* ---------------- UTIL ---------------- */
const mod = (n, m) => ((n % m) + m) % m;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const $ = s => document.querySelector(s);

/* ---------------- ESTADO ---------------- */
const state = {
  deck: [], hands: [[], [], [], []], meshes: [[], [], [], []],
  discard: [], discardMeshes: [],
  color: null, turn: 0, dir: 1, skipNext: false,
  running: false, gen: 0, drawnThisTurn: false, lastDrawnId: null,
  quizMode: false, sound: true, wins: 0, games: 0,
  acertos: 0, erros: 0
};
let humanResolver = null;
let hoveredMesh = null;
let hoveredAmt = 0;

/* =========================================================
   CENA 3D
   ========================================================= */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#07070b');
scene.fog = new THREE.Fog('#07070b', 26, 62);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 120);

/* câmera orbital */
const cam = { theta: 0, phi: 0.82, radius: 15.4, target: new THREE.Vector3(0, 0, -0.6) };
function applyCamera() {
  cam.phi = Math.min(1.15, Math.max(0.38, cam.phi));
  cam.theta = Math.min(0.62, Math.max(-0.62, cam.theta));
  cam.radius = Math.min(34, Math.max(9.5, cam.radius));
  const sp = Math.sin(cam.phi);
  camera.position.set(
    cam.target.x + cam.radius * sp * Math.sin(cam.theta),
    cam.target.y + cam.radius * Math.cos(cam.phi),
    cam.target.z + cam.radius * sp * Math.cos(cam.theta)
  );
  camera.lookAt(cam.target);
}
applyCamera();

/* ---------------- LUZES ---------------- */
scene.add(new THREE.HemisphereLight(0xdce6ff, 0x232833, 0.78));
scene.add(new THREE.AmbientLight(0xffffff, 0.16));
const key = new THREE.DirectionalLight(0xfff6e2, 1.02);
key.position.set(5, 20, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -19; key.shadow.camera.right = 19;
key.shadow.camera.top = 19; key.shadow.camera.bottom = -19;
key.shadow.camera.near = 1; key.shadow.camera.far = 40;
key.shadow.bias = -0.0012;
key.shadow.normalBias = 0.012;
key.shadow.radius = 3.5;
scene.add(key);
const rim = new THREE.DirectionalLight(0x6ea8ff, 0.34);
rim.position.set(-9, 7, -8);
scene.add(rim);
const cen = new THREE.PointLight(0xffe6a8, 0.45, 26, 2);
cen.position.set(0, 5, 1);
scene.add(cen);

/* ---------------- MESA ---------------- */
function makeTableTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(512, 512, 40, 512, 512, 720);
  grd.addColorStop(0, 'rgba(42,58,72,1)');
  grd.addColorStop(0.34, 'rgba(28,39,50,1)');
  grd.addColorStop(0.55, 'rgba(20,29,37,0.92)');
  grd.addColorStop(0.68, 'rgba(15,22,29,0.55)');
  grd.addColorStop(0.82, 'rgba(12,18,24,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
  // textura de feltro
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.028})`;
    g.fillRect(Math.random() * 1024, Math.random() * 1024, 1.7, 1.7);
  }
  // círculo central
  g.strokeStyle = 'rgba(255,255,255,.045)';
  g.lineWidth = 6;
  g.beginPath(); g.arc(512, 512, 300, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.arc(512, 512, 330, 0, Math.PI * 2); g.stroke();
  // emblema
  g.save();
  g.translate(512, 512);
  g.globalAlpha = 0.06;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7;
  g.beginPath(); g.ellipse(0, 0, 150, 96, -0.12, 0, Math.PI * 2); g.stroke();
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// chão infinito (escuro) para o cenário não terminar numa borda reta
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(160, 160),
  new THREE.MeshStandardMaterial({ color: '#07070b', roughness: 1, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.02;
scene.add(floor);

const table = new THREE.Mesh(
  new THREE.PlaneGeometry(34, 34),
  new THREE.MeshStandardMaterial({ map: makeTableTexture(), roughness: 0.95, metalness: 0.02, transparent: true, depthWrite: false })
);
table.rotation.x = -Math.PI / 2;
table.receiveShadow = true;
table.renderOrder = 1;
scene.add(table);

/* =========================================================
   TEXTURAS DE CARTA
   ========================================================= */
const texCache = new Map();
const matCache = new Map();

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* desenha o símbolo de raiz (índice + radical + radicando) */
function radical(g, cx, cy, index, rad, fs, color, lw) {
  g.save();
  g.strokeStyle = color; g.fillStyle = color;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = `600 ${fs}px Georgia,"Times New Roman",serif`;
  g.font = font;
  const wRad = g.measureText(rad).width;
  const hRad = fs * 0.68;
  const tick = fs * 0.60;
  const pad = fs * 0.09;
  const left = cx - wRad / 2 - tick - pad;
  const right = cx + wRad / 2 + pad;
  const topY = cy - hRad * 0.60;
  const botY = cy + hRad * 0.58;
  g.lineWidth = lw || Math.max(3, fs * 0.082);
  g.beginPath();
  g.moveTo(left, cy + hRad * 0.02);
  g.lineTo(left + tick * 0.20, cy + hRad * 0.26);
  g.lineTo(left + tick * 0.55, botY);
  g.lineTo(left + tick * 1.02, topY);
  g.lineTo(right, topY);
  g.stroke();
  if (index) {
    g.font = `700 ${fs * 0.30}px Georgia,serif`;
    g.fillText(index, left + tick * 0.34, topY - fs * 0.16);
  }
  g.font = font;
  g.fillText(rad, cx + pad * 0.5, cy + hRad * 0.04);
  g.restore();
}

function iconSkip(g, cx, cy, R, color, lw) {
  g.save();
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  const a = Math.PI * 0.25;
  g.beginPath();
  g.moveTo(cx - R * Math.cos(a), cy + R * Math.sin(a));
  g.lineTo(cx + R * Math.cos(a), cy - R * Math.sin(a));
  g.stroke();
  g.restore();
}

function iconReverse(g, cx, cy, s, color, lw) {
  g.save();
  g.strokeStyle = color; g.fillStyle = color;
  g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  const h = s * 1.05, w = s * 0.62;
  const arrow = (dir, off) => {
    const x = cx + off;
    const y0 = cy + dir * h / 2, y1 = cy - dir * h / 2;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1 + dir * s * 0.16); g.stroke();
    g.beginPath();
    g.moveTo(x, y1 - dir * s * 0.05);
    g.lineTo(x - w / 2, y1 + dir * s * 0.24);
    g.lineTo(x + w / 2, y1 + dir * s * 0.24);
    g.closePath(); g.fill();
  };
  arrow(1, -s * 0.34);
  arrow(-1, s * 0.34);
  g.restore();
}

function iconCards(g, cx, cy, s, colors, lw) {
  g.save();
  g.lineWidth = lw; g.lineJoin = 'round';
  const w = s * 0.78, h = s * 1.05;
  const spots = [[-0.44, -0.30], [0.30, -0.42], [-0.10, 0.34], [0.46, 0.18]];
  spots.forEach((sp, i) => {
    g.save();
    g.translate(cx + sp[0] * s, cy + sp[1] * s);
    g.rotate((i - 1.5) * 0.13);
    g.strokeStyle = colors[i];
    roundRect(g, -w / 2, -h / 2, w, h, s * 0.14);
    g.stroke();
    g.restore();
  });
  g.restore();
}

function drawFace(card) {
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext('2d');
  const W = TEX_W, H = TEX_H;
  const isWild = card.kind === 'wild' || card.kind === 'wild4';
  const bg = isWild ? '#0b0b0d' : HEX[card.color];
  const fg = '#ffffff';

  roundRect(g, 4, 4, W - 8, H - 8, 40);
  g.save(); g.clip();
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // brilho sutil
  const lg = g.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(255,255,255,.16)');
  lg.addColorStop(.42, 'rgba(255,255,255,0)');
  lg.addColorStop(1, 'rgba(0,0,0,.16)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.restore();

  // moldura
  g.strokeStyle = 'rgba(255,255,255,.92)';
  g.lineWidth = 8;
  roundRect(g, 20, 20, W - 40, H - 40, 30);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.22)';
  g.lineWidth = 2.5;
  roundRect(g, 34, 34, W - 68, H - 68, 24);
  g.stroke();

  const cx = W / 2, cy = H / 2;

  if (card.kind === 'num') {
    radical(g, cx, cy + 6, card.root.k, card.root.v, 210, fg);
    g.save(); g.globalAlpha = .95;
    radical(g, 84, 92, card.root.k, card.root.v, 62, fg, 5);
    g.translate(W, H); g.rotate(Math.PI);
    radical(g, 84, 92, card.root.k, card.root.v, 62, fg, 5);
    g.restore();
  } else if (card.kind === 'skip') {
    iconSkip(g, cx, cy, 132, fg, 26);
    iconSkip(g, 84, 92, 40, fg, 8);
    g.save(); g.translate(W, H); g.rotate(Math.PI); iconSkip(g, 84, 92, 40, fg, 8); g.restore();
  } else if (card.kind === 'rev') {
    iconReverse(g, cx, cy, 118, fg, 24);
    iconReverse(g, 84, 92, 34, fg, 8);
    g.save(); g.translate(W, H); g.rotate(Math.PI); iconReverse(g, 84, 92, 34, fg, 8); g.restore();
  } else if (card.kind === 'draw2') {
    g.save();
    g.font = '800 200px "Trebuchet MS",Verdana,sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = fg; g.fillText('+2', cx, cy - 26);
    g.strokeStyle = fg; g.lineWidth = 16; g.lineJoin = 'round';
    roundRect(g, cx - 96, cy + 82, 84, 108, 14); g.stroke();
    roundRect(g, cx + 12, cy + 62, 84, 108, 14); g.stroke();
    g.restore();
    cornerText(g, '+2', 84, 92, 74, fg);
    g.save(); g.translate(W, H); g.rotate(Math.PI); cornerText(g, '+2', 84, 92, 74, fg); g.restore();
  } else if (card.kind === 'wild' || card.kind === 'wild4') {
    iconCards(g, cx, cy - (card.kind === 'wild4' ? 6 : 0), 250, ['#e01f2d', '#1592e6', '#5fbf43', '#f6cf3f'], 13);
    if (card.kind === 'wild4') {
      cornerText(g, '+4', 84, 92, 78, fg);
      g.save(); g.translate(W, H); g.rotate(Math.PI); cornerText(g, '+4', 84, 92, 78, fg); g.restore();
    } else {
      g.save();
      g.globalAlpha = .9;
      g.strokeStyle = fg; g.lineWidth = 4;
      g.beginPath(); g.arc(84, 94, 34, 0, Math.PI * 2); g.stroke();
      g.translate(W, H); g.rotate(Math.PI);
      g.beginPath(); g.arc(84, 94, 34, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }
  return c;
}

function cornerText(g, t, x, y, fs, color) {
  g.save();
  g.fillStyle = color;
  g.font = `800 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8;
  g.fillText(t, x, y);
  g.restore();
}

function drawBack() {
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext('2d');
  const W = TEX_W, H = TEX_H;
  roundRect(g, 4, 4, W - 8, H - 8, 40);
  g.save(); g.clip();
  g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 7;
  roundRect(g, 22, 22, W - 44, H - 44, 32); g.stroke();

  // oval UNO
  g.save();
  g.translate(W / 2, H / 2 - 30);
  g.rotate(-0.16);
  g.shadowColor = 'rgba(224,31,45,.55)'; g.shadowBlur = 26;
  g.fillStyle = '#e01f2d';
  g.beginPath(); g.ellipse(0, 0, 158, 96, 0, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#ffd84a';
  g.font = 'italic 900 108px "Trebuchet MS",Verdana,sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('UNO', 0, 2);
  g.restore();

  g.save();
  g.translate(W / 2, H / 2 + 118);
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.font = '700 34px "Trebuchet MS",Verdana,sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('DA RADICIAÇÃO', 0, 0);
  g.restore();

  g.save();
  g.globalAlpha = .5;
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  g.font = '400 46px Georgia,serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('√   ∛   ∜', W / 2, H - 86);
  g.restore();
  return c;
}

function texFromCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

let backTex = null;
function getBackTex() {
  if (!backTex) backTex = texFromCanvas(drawBack());
  return backTex;
}
function getFaceTex(card) {
  const k = card.kind + '|' + (card.color || '-') + '|' + (card.root ? card.root.k + card.root.v : '');
  if (!texCache.has(k)) texCache.set(k, texFromCanvas(drawFace(card)));
  return texCache.get(k);
}
function faceMat(tex) {
  if (!matCache.has(tex.uuid)) {
    matCache.set(tex.uuid, new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.78, metalness: 0.0,
      alphaTest: 0.5, side: THREE.DoubleSide
    }));
  }
  return matCache.get(tex.uuid);
}
const edgeMat = new THREE.MeshStandardMaterial({ color: '#e9e9ef', roughness: 0.85, metalness: 0 });
const cardGeo = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H, 1, 1, 1);

function makeCardMesh(card, faceUp) {
  const front = faceMat(getFaceTex(card));
  const back = faceMat(getBackTex());
  const mats = [edgeMat, edgeMat, faceUp ? front : back, faceUp ? back : front, edgeMat, edgeMat];
  const m = new THREE.Mesh(cardGeo, mats);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.card = card;
  m.userData.faceUp = faceUp;
  return m;
}
function setFaceUp(mesh, up) {
  if (mesh.userData.faceUp === up) return;
  const front = faceMat(getFaceTex(mesh.userData.card));
  const back = faceMat(getBackTex());
  mesh.material[2] = up ? front : back;
  mesh.material[3] = up ? back : front;
  mesh.userData.faceUp = up;
}

/* =========================================================
   ASSENTOS / POSIÇÕES
   ========================================================= */
const DRAW = new THREE.Vector3(-1.85, 0, 0);
const DISC = new THREE.Vector3(1.75, 0, 0);
const SEATS = [
  { name: 'Você', bot: false, pos: new THREE.Vector3(0, 0.06, 3.15), rot: 0, span: 10.4 },
  { name: 'Ana', bot: true, pos: new THREE.Vector3(-6.15, 0.06, 0.15), rot: Math.PI / 2, span: 6.6 },
  { name: 'Bruno', bot: true, pos: new THREE.Vector3(0, 0.06, -3.75), rot: Math.PI, span: 8.6 },
  { name: 'Carla', bot: true, pos: new THREE.Vector3(6.15, 0.06, 0.15), rot: -Math.PI / 2, span: 6.6 }
];

function handTargets(pi) {
  const seat = SEATS[pi], n = state.hands[pi].length;
  const aspect = innerWidth / innerHeight;
  const narrow = aspect < 0.62;
  const mid = aspect < 1.25;
  const targetW = narrow ? (pi === 0 ? 5.6 : 5.2) : (mid ? 9.6 : 11.4);
  const span = Math.min(seat.span, targetW);
  const spacing = Math.min(narrow ? 0.8 : 1.2, span / Math.max(n, 1));
  const out = [];
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), seat.rot);
  for (let i = 0; i < n; i++) {
    const t = i - (n - 1) / 2;
    const v = new THREE.Vector3(t * spacing, 0, Math.abs(t) * 0.012);
    v.applyQuaternion(q);
    const p = seat.pos.clone().add(v);
    p.y += i * 0.0055;
    out.push({ pos: p, rotY: seat.rot + t * (narrow ? 0.02 : 0.014) });
  }
  return out;
}

function layoutHand(pi, instant) {
  const tg = handTargets(pi);
  const ps = [];
  state.meshes[pi].forEach((m, i) => {
    const t = tg[i];
    if (!t) return;
    m.userData.base = { pos: t.pos.clone(), rotY: t.rotY };
    if (instant) {
      m.position.copy(t.pos);
      m.rotation.set(0, t.rotY, 0);
    } else {
      ps.push(tweenObj(m, { position: [t.pos.x, t.pos.y, t.pos.z], rotY: t.rotY, rotX: 0 }, 330, { ease: easeOut }));
    }
  });
  return Promise.all(ps);
}

/* =========================================================
   PILHAS VISUAIS
   ========================================================= */
const drawGroup = new THREE.Group();
scene.add(drawGroup);
const discardGroup = new THREE.Group();
scene.add(discardGroup);
let drawStack = [];

function rebuildDrawStack() {
  drawStack.forEach(m => drawGroup.remove(m));
  drawStack = [];
  const n = Math.min(9, state.deck.length);
  for (let i = 0; i < n; i++) {
    const m = makeCardMesh({ kind: 'num', color: 'red', root: { k: '√', v: '64', val: 8 } }, false);
    m.position.set(DRAW.x + (Math.random() - .5) * 0.012, 0.035 + i * (CARD_T + 0.002), DRAW.z + (Math.random() - .5) * 0.012);
    m.rotation.y = (Math.random() - .5) * 0.03;
    drawGroup.add(m);
    drawStack.push(m);
  }
  drawGroup.children.forEach(c => { if (c.isMesh && !drawStack.includes(c)) drawGroup.remove(c); });
}

/* ---------------- rótulos 3D ---------------- */
function makeLabel(text, opts = {}) {
  const fs = 44, pad = 26;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `700 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  c.width = w; c.height = fs + pad * 1.4;
  const g2 = c.getContext('2d');
  g2.font = `700 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  g2.fillStyle = opts.bg || 'rgba(10,10,14,.78)';
  roundRect(g2, 0, 0, c.width, c.height, c.height / 2); g2.fill();
  g2.strokeStyle = opts.border || 'rgba(255,255,255,.16)'; g2.lineWidth = 3;
  roundRect(g2, 1.5, 1.5, c.width - 3, c.height - 3, c.height / 2); g2.stroke();
  g2.fillStyle = opts.color || '#ffffff';
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = texFromCanvas(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  const s = opts.scale || 0.0125;
  sp.scale.set(c.width * s, c.height * s, 1);
  return sp;
}

function makeFlatLabel(text, opts = {}) {
  const fs = 46;
  const c = document.createElement('canvas');
  let g = c.getContext('2d');
  g.font = `700 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 60;
  c.width = w; c.height = fs + 40;
  g = c.getContext('2d');
  g.fillStyle = 'rgba(9,12,16,.62)';
  roundRect(g, 0, 0, c.width, c.height, c.height / 2); g.fill();
  g.strokeStyle = 'rgba(255,216,74,.5)'; g.lineWidth = 3;
  roundRect(g, 1.5, 1.5, c.width - 3, c.height - 3, c.height / 2); g.stroke();
  g.fillStyle = '#ffd84a';
  g.font = `700 ${fs}px "Trebuchet MS",Verdana,sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = texFromCanvas(c);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const h = opts.h || 0.42;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(h * c.width / c.height, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

const labels = [];
function buildLabels() {
  labels.forEach(l => scene.remove(l));
  labels.length = 0;
  SEATS.forEach((seat, i) => {
    if (seat.bot) {
      const sp = makeLabel(`${seat.name} · ${state.hands[i].length}`, { scale: 0.0085 });
      const out = new THREE.Vector3(seat.pos.x, 0, seat.pos.z).normalize().multiplyScalar(1.0);
      sp.position.copy(seat.pos).add(out).add(new THREE.Vector3(0, 1.02, 0));
      scene.add(sp); labels.push(sp);
    }
  });
  const dl = makeFlatLabel('MONTE · COMPRAR', { h: 0.36 });
  dl.position.set(DRAW.x, 0.02, DRAW.z + 1.22);
  dl.renderOrder = 5;
  scene.add(dl); labels.push(dl);
}
function updateLabels() {
  let k = 0;
  SEATS.forEach((seat, i) => {
    if (!seat.bot) return;
    const sp = labels[k++];
    if (!sp) return;
    const txt = `${seat.name} · ${state.hands[i].length}${state.turn === i ? '  •' : ''}`;
    // recria apenas se mudou (barato: poucos rótulos)
    if (sp.userData.txt !== txt) {
      sp.userData.txt = txt;
      const nl = makeLabel(txt, { scale: 0.0085, color: state.turn === i ? '#ffd84a' : '#ffffff' });
      nl.position.copy(sp.position);
      nl.userData.txt = txt;
      scene.remove(sp); scene.add(nl);
      const idx = labels.indexOf(sp);
      labels[idx] = nl;
    }
  });
}

/* ---------------- anel do jogador ativo ---------------- */
const ringTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  // anel fino com brilho suave
  for (let i = 0; i < 26; i++) {
    const r = 214 - i * 3.4;
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.strokeStyle = `rgba(255,216,74,${0.055 * (1 - i / 26)})`;
    g.lineWidth = 7;
    g.stroke();
  }
  g.beginPath(); g.arc(256, 256, 216, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(255,216,74,.85)'; g.lineWidth = 3; g.stroke();
  return texFromCanvas(c);
})();
const ringGroup = new THREE.Group();
scene.add(ringGroup);
const activeRing = new THREE.Mesh(
  new THREE.PlaneGeometry(6.6, 5.0),
  new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
);
activeRing.rotation.x = -Math.PI / 2;
activeRing.position.y = 0.014;
ringGroup.add(activeRing);

/* ---------------- destaque de cartas jogáveis ---------------- */
const hlTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 192, 30, 128, 192, 250);
  grd.addColorStop(0, 'rgba(255,216,74,.55)');
  grd.addColorStop(.72, 'rgba(255,216,74,.35)');
  grd.addColorStop(1, 'rgba(255,216,74,0)');
  g.fillStyle = grd;
  roundRect(g, 8, 8, 240, 368, 34); g.fill();
  return texFromCanvas(c);
})();
const hlGroup = new THREE.Group();
scene.add(hlGroup);
const hlPool = [];
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 1.42, CARD_H * 1.3),
    new THREE.MeshBasicMaterial({ map: hlTex, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  hlGroup.add(m); hlPool.push(m);
}
function refreshHighlights() {
  hlPool.forEach(m => m.visible = false);
  if (!state.running || state.turn !== 0 || !humanResolver) return;
  let k = 0;
  state.meshes[0].forEach((m, i) => {
    const card = state.hands[0][i];
    if (!card) return;
    const ok = isPlayable(card) && (!state.drawnThisTurn || card.id === state.lastDrawnId);
    m.userData.playable = ok;
    if (!ok || k >= hlPool.length) return;
    const hl = hlPool[k++];
    hl.visible = true;
    hl.position.copy(m.position); hl.position.y = 0.006;
    hl.rotation.z = m.rotation.y;
  });
}

/* =========================================================
   TWEENS
   ========================================================= */
const tweens = [];
function tweenObj(obj, to, dur = 320, opt = {}) {
  return new Promise(resolve => {
    tweens.push({
      obj, to, dur, t: 0, delay: opt.delay || 0,
      ease: opt.ease || easeInOut, arc: opt.arc || 0, resolve,
      from: {
        px: obj.position.x, py: obj.position.y, pz: obj.position.z,
        rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z,
        sx: obj.scale.x, sy: obj.scale.y, sz: obj.scale.z
      }
    });
  });
}
function hasTween(obj) { return tweens.some(t => t.obj === obj); }
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.delay > 0) { tw.delay -= dt; continue; }
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur), e = tw.ease(k), f = tw.from, o = tw.obj, to = tw.to;
    if (to.position) o.position.set(
      lerp(f.px, to.position[0], e), lerp(f.py, to.position[1], e), lerp(f.pz, to.position[2], e));
    if (to.rotY !== undefined) o.rotation.y = lerp(f.ry, to.rotY, e);
    if (to.rotX !== undefined) o.rotation.x = lerp(f.rx, to.rotX, e);
    if (to.rotZ !== undefined) o.rotation.z = lerp(f.rz, to.rotZ, e);
    if (to.scale !== undefined) { const s = lerp(f.sx, to.scale, e); o.scale.set(s, s, s); }
    if (to.scaleX !== undefined) o.scale.x = lerp(f.sx, to.scaleX, e);
    if (tw.arc) o.position.y += Math.sin(Math.PI * k) * tw.arc;
    if (k >= 1) { tweens.splice(i, 1); tw.resolve && tw.resolve(); }
  }
}

/* =========================================================
   SOM
   ========================================================= */
let actx = null;
function beep(freq = 440, dur = 0.09, type = 'sine', vol = 0.06, when = 0) {
  if (!state.sound) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime + when;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { /* silêncio */ }
}
const SFX = {
  play: () => { beep(560, .08, 'triangle', .07); beep(760, .07, 'triangle', .05, .05); },
  draw: () => beep(300, .1, 'sine', .05),
  err: () => { beep(180, .12, 'sawtooth', .05); },
  uno: () => { beep(660, .1, 'square', .05); beep(990, .12, 'square', .05, .1); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => beep(f, .22, 'triangle', .07, i * .13)); },
  lose: () => { [440, 392, 330, 262].forEach((f, i) => beep(f, .25, 'sine', .07, i * .15)); }
};

/* =========================================================
   BARALHO
   ========================================================= */
let uid = 0;
function buildDeck() {
  const deck = [];
  const push = (kind, color, root) => deck.push({ id: ++uid, kind, color, root, val: root ? root.val : null });
  COLORS.forEach(c => {
    ROOTS.forEach(r => push('num', c, { k: r[0], v: r[1], val: r[2] }));
    for (let i = 0; i < 2; i++) {
      push('skip', c); push('rev', c); push('draw2', c);
    }
  });
  for (let i = 0; i < 4; i++) { push('wild', null); push('wild4', null); }
  // embaralha
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardLabel(card) {
  if (card.kind === 'num') {
    const r = card.root || card;
    return `${r.k || ''}${r.v || ''}`;
  }
  if (card.kind === 'skip') return 'Bloqueio';
  if (card.kind === 'rev') return 'Reverter';
  if (card.kind === 'draw2') return '+2';
  if (card.kind === 'wild') return 'Curinga';
  return 'Curinga +4';
}

function isPlayable(card) {
  const top = state.discard[state.discard.length - 1];
  if (!top) return true;
  if (card.kind === 'wild' || card.kind === 'wild4') return true;
  if (card.color === state.color) return true;
  if (card.kind === 'num' && top.kind === 'num' && card.root.val === top.root.val) return true;
  if (card.kind !== 'num' && card.kind === top.kind) return true;
  return false;
}

/* =========================================================
   UI
   ========================================================= */
const ui = {
  msg: $('#msg'), status: $('#statusTxt'), chip: $('#colorChip'),
  btnDraw: $('#btnDraw'), btnPass: $('#btnPass'), btnUno: $('#btnUno'),
  tooltip: $('#tooltip'), flash: $('#flash')
};
let msgTimer = null;
function setMsg(html, ms = 2600) {
  ui.msg.innerHTML = html;
  ui.msg.classList.add('show');
  clearTimeout(msgTimer);
  if (ms) msgTimer = setTimeout(() => ui.msg.classList.remove('show'), ms);
}
function setStatus(txt, playerIdx) {
  ui.status.innerHTML = txt;
  document.querySelector('#status .dot').style.background = playerIdx === 0 ? '#ffd84a' : '#7fb6ff';
  document.querySelector('#status .dot').style.boxShadow = '0 0 10px ' + (playerIdx === 0 ? '#ffd84a' : '#7fb6ff');
}
function setChip() {
  ui.chip.style.background = state.color ? HEX[state.color] : 'transparent';
  ui.chip.style.boxShadow = state.color ? `0 0 12px ${HEX[state.color]}` : 'none';
}
function flash(html) {
  ui.flash.innerHTML = html;
  ui.flash.classList.add('show');
  setTimeout(() => ui.flash.classList.remove('show'), 1100);
}
function showPass(v) { ui.btnPass.classList.toggle('hidden', !v); }
function showUno(v) { ui.btnUno.classList.toggle('hidden', !v); }
function showDraw(v) { ui.btnDraw.classList.toggle('hidden', !v); }

/* =========================================================
   ANIMAÇÕES DE CARTA
   ========================================================= */
async function flipMesh(mesh, up, dur = 150) {
  await tweenObj(mesh, { scaleX: 0.02 }, dur, { ease: easeInOut });
  setFaceUp(mesh, up);
  await tweenObj(mesh, { scaleX: 1 }, dur, { ease: easeInOut });
}

/* cada carta precisa subir ao menos a própria espessura (CARD_T),
   caso contrário as cartas se atravessam quando a pilha cresce */
const DISC_SP = CARD_T + 0.0018;
async function animateToDiscard(mesh, card, gen) {
  setFaceUp(mesh, true);
  const ry = (Math.random() - 0.5) * 0.16;
  const nivel = Math.min(state.discardMeshes.length, 11);
  const y = 0.048 + nivel * DISC_SP;
  const ox = (Math.random() - 0.5) * 0.05;
  const oz = (Math.random() - 0.5) * 0.05;
  await tweenObj(mesh, {
    position: [DISC.x + ox, y, DISC.z + oz], rotY: ry, rotX: 0, rotZ: 0, scale: 1
  }, 400, { ease: easeOut, arc: 1.2 });
  discardGroup.add(mesh);
  mesh.position.set(DISC.x + ox, y, DISC.z + oz);
  state.discardMeshes.push(mesh);
  while (state.discardMeshes.length > 12) {
    const old = state.discardMeshes.shift();
    discardGroup.remove(old);
  }
  /* reempilha (mantém ordem e evita sobreposição) */
  state.discardMeshes.forEach((mm, i) => {
    if (!hasTween(mm)) mm.position.y = 0.048 + Math.min(i, 11) * DISC_SP;
  });
}

/* =========================================================
   AÇÕES DE JOGO
   ========================================================= */
async function drawCards(pi, n, gen) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (!state.deck.length) reshuffleDiscard();
    if (!state.deck.length) break;
    const card = state.deck.pop();
    state.hands[pi].push(card);
    drawn.push(card);
    const m = makeCardMesh(card, false);
    m.position.set(DRAW.x + (Math.random() - .5) * .1, 0.14, DRAW.z + (Math.random() - .5) * .1);
    m.rotation.y = 0;
    scene.add(m);
    state.meshes[pi].push(m);
  }
  rebuildDrawStack();
  layoutHand(pi);
  SFX.draw();
  await sleep(340);
  if (pi === 0) {
    for (const m of state.meshes[0].slice(-drawn.length)) await flipMesh(m, true, 110);
    layoutHand(0);
    await sleep(180);
  }
  updateLabels();
  return drawn;
}

function reshuffleDiscard() {
  if (state.discard.length <= 1) return;
  const top = state.discard.pop();
  const rest = state.discard.splice(0, state.discard.length);
  state.deck.push(...rest);
  state.discard.push(top);
  // remove malhas antigas do monte de descarte (mantém topo)
  while (state.discardMeshes.length > 1) {
    const old = state.discardMeshes.shift();
    discardGroup.remove(old);
  }
  rebuildDrawStack();
  setMsg('O monte acabou — embaralhando o descarte.');
}

async function playCardFromHand(pi, card, gen) {
  const hand = state.hands[pi];
  const idx = hand.indexOf(card);
  if (idx < 0) return false;
  hand.splice(idx, 1);
  const mesh = state.meshes[pi].splice(idx, 1)[0];

  let newColor = card.color;
  if (card.kind === 'wild' || card.kind === 'wild4') {
    newColor = pi === 0 ? await pickColor() : botColor(pi);
  }

  state.discard.push(card);
  state.color = newColor;

  if (mesh) {
    if (pi === 0) scene.add(mesh); // garante que está na cena
    else { await flipMesh(mesh, true, 120); }
    await animateToDiscard(mesh, card, gen);
  }
  SFX.play();
  layoutHand(pi);
  setChip();

  // mensagens / educação
  if (card.kind === 'num') {
    flash(`${card.root.k}<span style="font-size:.66em">${card.root.v}</span> = <b>${card.root.val}</b>`);
  } else if (card.kind === 'wild' || card.kind === 'wild4') {
    flash(`Curinga → ${CNAME[newColor]}`);
  } else if (card.kind === 'skip') {
    flash('Bloqueio!');
  } else if (card.kind === 'rev') {
    flash('Reverter!');
  } else if (card.kind === 'draw2') {
    flash('+2');
  }

  const nextP = mod(pi + state.dir, 4);
  const who = SEATS[nextP].name;

  if (card.kind === 'skip') {
    state.skipNext = true;
    setMsg(`<b>${SEATS[pi].name}</b> bloqueou: <b>${who}</b> perde a vez.`);
  } else if (card.kind === 'rev') {
    state.dir *= -1;
    setMsg(`<b>${SEATS[pi].name}</b> inverteu o sentido do jogo.`);
  } else if (card.kind === 'draw2' || card.kind === 'wild4') {
    const n = card.kind === 'draw2' ? 2 : 4;
    state.skipNext = true;
    setMsg(`<b>${SEATS[pi].name}</b>: ${who} compra ${n} cartas e perde a vez.`);
    await drawCards(nextP, n, gen);
  } else if (card.kind === 'wild') {
    setMsg(`<b>${SEATS[pi].name}</b> escolheu a cor <b>${CNAME[newColor]}</b>.`);
  }

  // UNO
  if (state.hands[pi].length === 1) {
    if (pi === 0) {
      const ok = await unoWindow();
      if (!ok) {
        setMsg('Você esqueceu de gritar <b>UNO!</b> — compre 2 cartas.', 3200);
        await drawCards(0, 2, gen);
      }
    } else {
      SFX.uno();
      setMsg(`<b>${SEATS[pi].name}</b> gritou <b>UNO!</b> — falta 1 carta!`, 2400);
      await sleep(500);
    }
  }

  if (state.hands[pi].length === 0) {
    await sleep(400);
    endGame(pi);
    return true;
  }
  return true;
}

function unoWindow() {
  return new Promise(resolve => {
    let done = false;
    showUno(true);
    SFX.uno();
    const finish = (ok) => {
      if (done) return;
      done = true;
      showUno(false);
      ui.btnUno.onclick = null;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 3400);
    ui.btnUno.onclick = () => { clearTimeout(timer); finish(true); };
  });
}

function pickColor() {
  return new Promise(resolve => {
    const ov = $('#ovColor');
    ov.classList.remove('hidden');
    ov.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        ov.classList.add('hidden');
        resolve(b.dataset.c);
      };
    });
  });
}

function botColor(pi) {
  const count = { red: 0, blue: 0, green: 0, yellow: 0 };
  state.hands[pi].forEach(c => { if (c.color) count[c.color]++; });
  let best = COLORS[Math.floor(Math.random() * 4)], bv = -1;
  COLORS.forEach(c => { if (count[c] > bv) { bv = count[c]; best = c; } });
  return best;
}

/* =========================================================
   DESAFIO (MODO AULA)
   ========================================================= */
function askQuiz(card) {
  state.pendingQuiz = card;
  return new Promise(resolve => {
    const ov = $('#ovQuiz');
    const q = $('#quizQ'), opts = $('#quizOpts');
    q.innerHTML = `${card.root.k}<span style="font-size:.62em">${card.root.v}</span>`;
    opts.innerHTML = '';
    const correct = card.root.val;
    const set = new Set([correct]);
    const pool = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(v => v !== correct);
    while (set.size < 4) set.add(pool[Math.floor(Math.random() * pool.length)]);
    const arr = [...set].sort(() => Math.random() - 0.5);
    ov.classList.remove('hidden');
    arr.forEach(v => {
      const b = document.createElement('button');
      b.className = 'opt'; b.textContent = v;
      b.onclick = () => {
        const ok = v === correct;
        b.classList.add(ok ? 'ok' : 'bad');
        if (!ok) {
          [...opts.children].forEach(x => { if (+x.textContent === correct) x.classList.add('ok'); });
        }
        if (ok) state.acertos++; else state.erros++;
        setTimeout(() => {
          ov.classList.add('hidden');
          state.pendingQuiz = null;
          resolve(ok);
        }, ok ? 320 : 1150);
      };
      opts.appendChild(b);
    });
  });
}

/* =========================================================
   TURNO DO JOGADOR (humano)
   ========================================================= */
function waitHuman() {
  return new Promise(res => { humanResolver = res; });
}
function resolveHuman(action) {
  if (!humanResolver) return;
  const r = humanResolver; humanResolver = null; r(action);
}

async function humanTurn(gen) {
  state.drawnThisTurn = false;
  state.lastDrawnId = null;
  showUno(false);
  setStatus('Sua vez', 0);
  flash('Sua vez!');
  refreshHighlights();
  showDraw(true);
  showPass(false);
  const hasPlay = state.hands[0].some(isPlayable);
  if (!hasPlay) setMsg('Nenhuma carta combina — clique em <b>Comprar carta</b>.', 4000);
  else if (!ui.msg.classList.contains('show')) setMsg('Escolha uma carta que combine com a <b>cor</b> ou o <b>valor</b>.', 4000);

  while (state.running && gen === state.gen) {
    const action = await waitHuman();
    if (!state.running || gen !== state.gen) return;

    if (action.type === 'draw') {
      if (state.drawnThisTurn) continue;
      const drawn = await drawCards(0, 1, gen);
      state.drawnThisTurn = true;
      if (!drawn.length) { showPass(true); continue; }
      state.lastDrawnId = drawn[0].id;
      state.lastDrawnId = drawn[0].id;
      refreshHighlights();
      if (isPlayable(drawn[0])) {
        setMsg(`Você comprou <b>${cardLabel(drawn[0])}</b>${drawn[0].kind === 'num' ? ` = ${drawn[0].root.val}` : ''}. Pode jogar!`, 4200);
        showDraw(false);
        showPass(true);
      } else {
        setMsg('A carta comprada não serve. Passando a vez...', 1800);
        showDraw(false);
        await sleep(900);
        return;
      }
      continue;
    }

    if (action.type === 'pass') {
      if (!state.drawnThisTurn) { setMsg('Você precisa comprar antes de passar.', 1600); continue; }
      return;
    }

    if (action.type === 'play') {
      const card = action.card;
      if (state.drawnThisTurn && card.id !== state.lastDrawnId) {
        setMsg('Você só pode jogar a carta que comprou.', 1700);
        SFX.err();
        continue;
      }
      if (!isPlayable(card)) {
        setMsg(`Essa carta não combina com a mesa. Precisa ser <b>${CNAME[state.color]}</b>${state.discard.length ? ` ou valer <b>${state.discard[state.discard.length - 1].kind === 'num' ? state.discard[state.discard.length - 1].root.val : cardLabel(state.discard[state.discard.length - 1])}</b>` : ''}.`, 2600);
        SFX.err();
        continue;
      }
      if (state.quizMode && card.kind === 'num') {
        const ok = await askQuiz(card);
        if (!ok) {
          setMsg(`Ops! ${card.root.k}${card.root.v} vale <b>${card.root.val}</b>. Tente outra carta.`, 2600);
          continue;
        }
      }
      showDraw(false); showPass(false);
      refreshHighlights();
      await playCardFromHand(0, card, gen);
      return;
    }
  }
}

/* =========================================================
   TURNO DOS BOTS
   ========================================================= */
async function botTurn(pi, gen) {
  setStatus(`${SEATS[pi].name} está jogando...`, pi);
  setMsg(`Vez de <b>${SEATS[pi].name}</b>...`, 1200);
  await sleep(350 + Math.random() * 350);
  if (!state.running || gen !== state.gen) return;

  const playables = state.hands[pi].filter(isPlayable);

  if (!playables.length) {
    await drawCards(pi, 1, gen);
    const c = state.hands[pi][state.hands[pi].length - 1];
    if (c && isPlayable(c)) {
      await sleep(320);
      await playCardFromHand(pi, c, gen);
    } else {
      setMsg(`<b>${SEATS[pi].name}</b> comprou e passou.`, 1500);
      await sleep(420);
    }
    return;
  }

  const card = chooseBotCard(pi, playables);
  await sleep(220);
  await playCardFromHand(pi, card, gen);
}

function chooseBotCard(pi, cards) {
  const nextP = mod(pi + state.dir, 4);
  const pressure = state.hands[nextP].length <= 2;
  const score = c => {
    switch (c.kind) {
      case 'draw2': return pressure ? 120 : 70;
      case 'skip': return pressure ? 115 : 68;
      case 'rev': return 62;
      case 'wild4': return 25;
      case 'wild': return 22;
      default: return 80 + Math.random() * 6;
    }
  };
  // evita curygas no começo
  const sorted = [...cards].sort((a, b) => score(b) - score(a));
  const best = sorted[0];
  if (pressure && (best.kind === 'wild' || best.kind === 'wild4')) {
    const sp = sorted.find(c => c.kind === 'draw2' || c.kind === 'skip');
    if (sp) return sp;
  }
  return best;
}

/* =========================================================
   LOOP PRINCIPAL
   ========================================================= */
function advanceTurn() {
  refreshHighlights();
  state.turn = mod(state.turn + state.dir, 4);
  if (state.skipNext) {
    state.skipNext = false;
    state.turn = mod(state.turn + state.dir, 4);
  }
}

async function gameLoop(gen) {
  while (state.running && gen === state.gen) {
    updateLabels();
    if (state.turn === 0) await humanTurn(gen);
    else await botTurn(state.turn, gen);
    if (state.running && gen === state.gen && state.turn === 0) { showDraw(false); showPass(false); }
    if (!state.running || gen !== state.gen) return;
    advanceTurn();
    await sleep(180);
  }
}

/* =========================================================
   NOVA PARTIDA
   ========================================================= */
function clearTable() {
  [drawGroup, discardGroup].forEach(gp => {
    while (gp.children.length) gp.remove(gp.children[0]);
  });
  for (let i = 0; i < 4; i++) {
    state.meshes[i].forEach(m => scene.remove(m));
    state.meshes[i] = [];
    state.hands[i] = [];
  }
  labels.forEach(l => scene.remove(l));
  labels.length = 0;
  tweens.length = 0;
  drawStack = [];
}

function newGame() {
  state.gen++;
  const gen = state.gen;
  state.running = false;
  clearTable();
  state.deck = buildDeck();
  state.discard = [];
  state.discardMeshes = [];
  state.dir = 1;
  state.turn = Math.floor(Math.random() * 4);
  state.skipNext = false;
  state.color = null;
  state.drawnThisTurn = false;
  state.games++;

  // distribui 7
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 7; j++) {
      const c = state.deck.pop();
      state.hands[i].push(c);
      const m = makeCardMesh(c, i === 0);
      m.position.set(DRAW.x, 0.1, DRAW.z);
      m.rotation.y = (Math.random() - .5) * 0.6;
      scene.add(m);
      state.meshes[i].push(m);
    }
  }

  // carta inicial: sempre uma carta de raiz (evita coringa no início)
  let first = state.deck.pop();
  let guard = 0;
  while ((first.kind === 'wild' || first.kind === 'wild4') && guard++ < 50) {
    state.deck.unshift(first);
    first = state.deck.pop();
  }
  state.discard.push(first);
  state.color = first.color || COLORS[Math.floor(Math.random() * 4)];

  const fm = makeCardMesh(first, true);
  fm.position.set(DISC.x, 0.05, DISC.z);
  fm.rotation.y = (Math.random() - .5) * 0.4;
  scene.add(fm);
  state.discardMeshes.push(fm);
  discardGroup.add(fm);

  rebuildDrawStack();
  buildLabels();

  for (let i = 0; i < 4; i++) layoutHand(i, true);
  // pequeno "deal" animado
  setTimeout(() => { for (let i = 0; i < 4; i++) layoutHand(i); }, 30);

  setChip();
  updateLabels();
  state.running = true;
  setMsg(`A mesa começou com <b>${cardLabel(first)}</b>. Cor: <b>${CNAME[state.color]}</b>.`, 4200);
  setTimeout(() => { if (gen === state.gen) gameLoop(gen); }, 700);
}

/* ---------------- confete ---------------- */
const confettiBits = [];
function confetti(n, colors) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16 + Math.random() * 0.12, 0.1 + Math.random() * 0.1),
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true })
    );
    m.position.set((Math.random() - .5) * 10, 4 + Math.random() * 4, (Math.random() - .5) * 8);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    m.userData.v = new THREE.Vector3((Math.random() - .5) * .04, -(0.03 + Math.random() * 0.05), (Math.random() - .5) * .04);
    m.userData.spin = new THREE.Vector3((Math.random() - .5) * .12, (Math.random() - .5) * .12, (Math.random() - .5) * .12);
    scene.add(m); confettiBits.push(m);
  }
}
function updateConfetti(dt) {
  for (let i = confettiBits.length - 1; i >= 0; i--) {
    const m = confettiBits[i];
    m.position.addScaledVector(m.userData.v, dt / 16.6);
    m.rotation.x += m.userData.spin.x * dt / 16.6;
    m.rotation.y += m.userData.spin.y * dt / 16.6;
    m.rotation.z += m.userData.spin.z * dt / 16.6;
    m.userData.v.y += 0.0006 * dt / 16.6;
    if (m.position.y < 0.02) {
      m.position.y = 0.02; m.userData.v.set(0, 0, 0); m.userData.spin.set(0, 0, 0);
      m.material.opacity -= 0.02;
      if (m.material.opacity <= 0) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); confettiBits.splice(i, 1); }
    }
  }
}

/* =========================================================
   FIM DE JOGO
   ========================================================= */
function endGame(winner) {
  state.running = false;
  humanResolver = null;
  showDraw(false); showPass(false); showUno(false);
  refreshHighlights();
  confetti(winner === 0 ? 90 : 40, winner === 0 ? ['#ffd84a','#ff5252','#6ef08a','#7fb6ff'] : ['#8b93a3']);
  const ov = $('#ovEnd');
  const eu = winner === 0;
  if (eu) { state.wins++; SFX.win(); } else SFX.lose();
  $('#endTitle').innerHTML = eu
    ? 'Você <span style="color:#ffd84a">venceu!</span>'
    : `${SEATS[winner].name} venceu`;
  $('#endSub').textContent = eu
    ? 'Radiciação afiada! Bora de novo?'
    : 'Quase! Tente outra vez — as raízes são traiçoeiras.';
  const total = state.acertos + state.erros;
  $('#endStats').innerHTML = `
    <div class="stat"><small>Vitórias</small><b>${state.wins}</b></div>
    <div class="stat"><small>Partidas</small><b>${state.games}</b></div>
    <div class="stat"><small>Acertos no desafio</small><b>${state.acertos}</b></div>
    <div class="stat"><small>Aproveitamento</small><b>${total ? Math.round(100 * state.acertos / total) : 0}%</b></div>`;
  ov.classList.remove('hidden');
  setStatus(eu ? 'Você venceu!' : `${SEATS[winner].name} venceu`, winner);
}

/* =========================================================
   INTERAÇÃO
   ========================================================= */
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let dragging = false, dragMoved = 0, lastX = 0, lastY = 0, pointerDownOnCard = null;

function pickCard(ev) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(pointer, camera);
  const meshes = state.meshes[0];
  if (!meshes.length) return null;
  const hits = ray.intersectObjects(meshes, false);
  return hits.length ? hits[0].object : null;
}

canvas.addEventListener('pointerdown', e => {
  dragging = true; dragMoved = 0;
  lastX = e.clientX; lastY = e.clientY;
  pointerDownOnCard = pickCard(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX; lastY = e.clientY;
    if (dragMoved > 6) {
      cam.theta -= dx * 0.0035;
      cam.phi -= dy * 0.003;
      applyCamera();
      canvas.style.cursor = 'grabbing';
      ui.tooltip.style.opacity = 0;
      return;
    }
  }
  // hover
  const m = pickCard(e);
  if (m !== hoveredMesh) { hoveredMesh = m; hoveredAmt = 0; }
  if (m) {
    const c = m.userData.card;
    const ok = state.running && state.turn === 0 && humanResolver && isPlayable(c);
    let label;
    if (c.kind === 'num') {
      const r = c.root || c;
      label = `${r.k || ''}${r.v || ''} <b>= ${r.val}</b>`;
    }
    else label = cardLabel(c);
    ui.tooltip.innerHTML = label + (ok ? '' : ' · <span style="color:#ff8b8b">não combina</span>');
    ui.tooltip.style.left = e.clientX + 'px';
    ui.tooltip.style.top = e.clientY + 'px';
    ui.tooltip.style.opacity = 1;
    canvas.style.cursor = ok ? 'pointer' : 'not-allowed';
  } else {
    ui.tooltip.style.opacity = 0;
    canvas.style.cursor = dragging ? 'grabbing' : 'grab';
  }
});
canvas.addEventListener('pointerup', e => {
  const wasDrag = dragMoved > 6;
  dragging = false;
  canvas.style.cursor = 'grab';
  if (wasDrag) return;
  const m = pickCard(e);
  if (m && m === pointerDownOnCard && state.running && state.turn === 0 && humanResolver) {
    const card = m.userData.card;
    const onlyDrawn = state.drawnThisTurn;
    if (!isPlayable(card) || (onlyDrawn && card.id !== state.lastDrawnId)) {
      SFX.err();
      // pequeno "não" visual
      const base = m.userData.base;
      tweenObj(m, { position: [base.pos.x + 0.12, base.pos.y, base.pos.z] }, 70, { ease: easeOut })
        .then(() => tweenObj(m, { position: [base.pos.x - 0.12, base.pos.y, base.pos.z] }, 70))
        .then(() => tweenObj(m, { position: [base.pos.x, base.pos.y, base.pos.z] }, 90));
      return;
    }
    resolveHuman({ type: 'play', card });
    hoveredMesh = null;
    ui.tooltip.style.opacity = 0;
  }
  pointerDownOnCard = null;
});
const touches = new Map();
let pinchStart = 0;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const [a, b] = e.touches;
    pinchStart = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && pinchStart) {
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    cam.radius *= pinchStart / d;
    pinchStart = d;
    applyCamera();
    dragging = true; dragMoved = 999;
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { pinchStart = 0; }, { passive: true });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.radius += e.deltaY * 0.008;
  applyCamera();
}, { passive: false });

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'r') { newGame(); $('#ovEnd').classList.add('hidden'); }
  if (k === 'h') $('#ovStart').classList.toggle('hidden');
  if (k === 'm') toggleSound();
  if (k === 'u') { if (!ui.btnUno.classList.contains('hidden')) ui.btnUno.click(); }
  if (k === 'd' || k === ' ') {
    e.preventDefault();
    if (state.running && state.turn === 0 && humanResolver && !state.drawnThisTurn && !ui.btnDraw.classList.contains('hidden')) {
      resolveHuman({ type: 'draw' });
    }
  }
});

ui.btnDraw.onclick = () => {
  if (state.running && state.turn === 0 && humanResolver) resolveHuman({ type: 'draw' });
};
ui.btnPass.onclick = () => {
  if (state.running && state.turn === 0 && humanResolver) resolveHuman({ type: 'pass' });
};
$('#btnRestart').onclick = () => { $('#ovEnd').classList.add('hidden'); newGame(); };
$('#btnHelp').onclick = () => $('#ovStart').classList.remove('hidden');
$('#btnPlay').onclick = () => {
  $('#ovStart').classList.add('hidden');
  state.quizMode = $('#swQuiz').classList.contains('on');
  try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) { }
  newGame();
};
$('#btnAgain').onclick = () => { $('#ovEnd').classList.add('hidden'); newGame(); };
$('#btnHome').onclick = () => {
  $('#ovEnd').classList.add('hidden');
  $('#ovStart').classList.remove('hidden');
  state.running = false;
};
$('#swQuiz').onclick = () => $('#swQuiz').classList.toggle('on');
ui.btnUno.onclick = null;

function toggleSound() {
  state.sound = !state.sound;
  $('#btnSound').textContent = state.sound ? '🔊' : '🔇';
  $('#btnSound').classList.toggle('off', !state.sound);
}
$('#btnSound').onclick = toggleSound;

/* =========================================================
   RENDER LOOP
   ========================================================= */
let lastT = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(48, now - lastT);
  lastT = now;
  updateTweens(dt);
  updateConfetti(dt);

  // hover suave + anel do jogador
  hoveredAmt += ((hoveredMesh ? 1 : 0) - hoveredAmt) * Math.min(1, dt / 90);
  state.meshes[0].forEach(m => {
    const b = m.userData.base;
    if (!b) return;
    const isH = m === hoveredMesh;
    const lift = isH ? hoveredAmt : (m.userData.lift || 0);
    m.userData.lift = isH ? hoveredAmt : Math.max(0, (m.userData.lift || 0) - dt / 400);
    if (!tweens.some(t => t.obj === m)) {
      m.position.y = b.pos.y + m.userData.lift * 0.42;
      m.position.z = b.pos.z + m.userData.lift * 0.16;
      const sc = 1 + m.userData.lift * 0.06;
      m.scale.set(sc, 1, sc);
    }
  });

  const hlPulse = 0.55 + Math.sin(now / 300) * 0.22;
  hlPool.forEach(m => { if (m.visible) m.material.opacity = hlPulse; });

  // anel pulsante do jogador da vez
  if (state.running) {
    activeRing.material.opacity = 0.3 + Math.sin(now / 460) * 0.1;
    const seat = SEATS[state.turn];
    const p = seat.pos.clone().multiplyScalar(0.82);
    p.y = 0.014;
    ringGroup.position.lerp(p, 0.1);
    const targetRot = seat.rot;
    let d = targetRot - ringGroup.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    ringGroup.rotation.y += d * 0.1;
    const wide = state.turn === 0 || state.turn === 2;
    activeRing.scale.set(wide ? 1.7 : 1.02, wide ? 1.15 : 1.55, 1);
    activeRing.material.color.set(state.turn === 0 ? 0xffd84a : 0x9fc4ff);
  } else {
    activeRing.material.opacity += (0 - activeRing.material.opacity) * 0.1;
  }

  renderer.render(scene, camera);
}

function fitCamera() {
  const aspect = innerWidth / innerHeight;
  const vFov = camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const narrow = aspect < 0.62;
  const mid = aspect < 1.25;
  const targetW = narrow ? 8.4 : (mid ? 12.4 : 13.6);
  /* margem extra na vertical para a mão não ficar atrás dos botões (telas baixas) */
  const short = innerHeight < 700;
  const targetD = narrow ? 9.4 : (mid ? (short ? 13.8 : 9.6) : (short ? 13.8 : 9.3));
  cam.radius = Math.max(13.5, Math.min(34, Math.max(
    targetW / (2 * Math.tan(hFov / 2)),
    targetD / (2 * Math.tan(vFov / 2))
  )));
  cam.phi = narrow ? 0.74 : (mid ? 0.8 : 0.82);
  applyCamera();
}
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  fitCamera();
});
fitCamera();

/* início */
buildLabels();
requestAnimationFrame(animate);
setStatus('Pronto para jogar');
setMsg('Clique em <b>Jogar</b> para começar.', 0);

/* depuração / testes automatizados (inofensivo) */
window.__uno = {
  state, SEATS, isPlayable, cardLabel,
  screenOf(id) {
    const m = state.meshes[0].find(x => x.userData.card.id === id);
    if (!m) return null;
    const v = m.position.clone().project(camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  },
  handInfo() { return state.hands[0].map(c => ({ id: c.id, label: cardLabel(c), ok: isPlayable(c) })); },
  autoStep() {
    const p = state.hands[0].find(isPlayable);
    if (p) resolveHuman({ type: 'play', card: p });
    else resolveHuman({ type: 'draw' });
    return p ? cardLabel(p) : 'draw';
  },
  resolveHuman
};
