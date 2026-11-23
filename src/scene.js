// 온라인 성균관 — 공간(월드) 빌더
// 명륜당(공부 마루) · 은행나무 마당 · 동재/서재 · 담장과 정문 · 종각 · 등불 줄 · 계절/시간/날씨
import * as THREE from 'three';

// ---------------- 배치 상수 ----------------
export const FLOOR_Y = 0.9;
// 동그랗고 부드러운 입자 텍스처 (연기·눈·꽃잎)
let dotTex = null;
export function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c); return dotTex;
} // 명륜당 마루 높이
const PLAT = { x: 11, z0: -18.5, z1: -9.6 }; // 기단(돌 받침) 범위
const INNER = { x: 10.6, z0: -17.5, z1: -10.0 }; // 마루 위 걸을 수 있는 곳
const STAIRS = [{ x0: -2.2, x1: 2.2 }, { x0: -8.9, x1: -6.9 }, { x0: 6.9, x1: 8.9 }];
const STAIR_Z = { z0: -10.2, z1: -8.5 };
export const BOUNDS = { x: 18.4, z0: -19.6, z1: 15.2 };
export const ROWS = [-11.4, -13.2, -15.0];
export const COLS = [-8.4, -6, -3.6, -1.2, 1.2, 3.6, 6, 8.4];
export const SEATS = [];
ROWS.forEach((z, r) => COLS.forEach((x, c) => SEATS.push({ i: SEATS.length, row: r, col: c, x, z, y: FLOOR_Y })));
export const SPAWN = { x: 0, z: 7.5 };
export const GINKGO = [{ x: -7, z: -2.5 }, { x: 7, z: -2.5 }];
export const BELL = { x: 12.6, z: -7.6 };
// 쉬는 시간에 유생들이 모이는 곳 (마당)
export const BREAK_SPOTS = [[-5.2, -1.4], [-8.8, -0.6], [-6.4, 0.2], [5.4, -1.2], [8.6, -0.4], [6.2, 0.4], [-2.8, 3.5], [2.6, 3.8], [0, 6.5], [-4.4, 7.2], [4.2, 7.4], [-9.5, 5], [9.4, 5.2], [-1.6, 10], [1.8, 10.4], [-6, 11], [6.2, 11]];

const inBox = (x, z, b) => Math.abs(x) < b.x && z > b.z0 && z < b.z1;
export function heightAt(x, z) {
  if (inBox(x, z, PLAT)) return FLOOR_Y;
  if (z >= STAIR_Z.z0 && z <= STAIR_Z.z1 && STAIRS.some((s) => x > s.x0 && x < s.x1)) return FLOOR_Y * (1 - (z - PLAT.z1) / (STAIR_Z.z1 - PLAT.z1));
  return 0;
}
export function walkable(x, z) {
  if (Math.abs(x) > BOUNDS.x || z < BOUNDS.z0 || z > BOUNDS.z1) return false;
  if (inBox(x, z, INNER)) return true;
  if (z >= STAIR_Z.z0 && z <= STAIR_Z.z1 && STAIRS.some((s) => x > s.x0 + 0.15 && x < s.x1 - 0.15)) return true;
  if (Math.abs(x) < PLAT.x + 0.35 && z > PLAT.z0 - 0.4 && z < PLAT.z1 + 0.35) return false; // 기단 가장자리
  return true;
}
// 원형 충돌체(기둥·나무·석등·종각) / 상자 충돌체(동재·서재·담장 안쪽 건물)
export const COLLIDERS = [];
export const BOXES = [];

// ---------------- 텍스처 도우미 ----------------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

const TEX = {};
function tileTex() { // 기와 골
  return TEX.tile || (TEX.tile = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3d4148'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      const gr = g.createLinearGradient(x, 0, x + 32, 0);
      gr.addColorStop(0, '#2c2f35'); gr.addColorStop(0.5, '#5a5f68'); gr.addColorStop(1, '#2c2f35');
      g.fillStyle = gr; g.fillRect(x, 0, 32, h);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < h; y += 42) g.fillRect(0, y, w, 4);
  }));
}
function woodTex() { // 마루 널
  return TEX.wood || (TEX.wood = canvasTex(512, 512, (g, w, h) => {
    for (let y = 0; y < h; y += 32) {
      const l = 52 + rnd() * 14; g.fillStyle = `hsl(28, 38%, ${l * 0.62}%)`; g.fillRect(0, y, w, 32);
      g.fillStyle = 'rgba(40,20,8,0.35)'; g.fillRect(0, y, w, 2);
      for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(60,30,10,${0.08 + rnd() * 0.1})`; g.beginPath(); const yy = y + 6 + rnd() * 20; g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + rnd() * 6 - 3, w * 0.6, yy + rnd() * 6 - 3, w, yy); g.stroke(); }
      g.fillStyle = 'rgba(40,20,8,0.35)'; g.fillRect(Math.floor(rnd() * w), y, 2, 32);
    }
  }, [3, 2]));
}
function paperTex(lit) { // 창호지 + 살
  const k = lit ? 'paperL' : 'paper';
  return TEX[k] || (TEX[k] = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = lit ? '#fff1d0' : '#efe6d2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6b4a2e'; g.lineWidth = 6;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 14; g.strokeRect(0, 0, w, h);
  }));
}
function groundTex() { // 마사토 마당
  return TEX.ground || (TEX.ground = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#c8b894'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(120,100,70,${rnd() * 0.25})` : `rgba(255,250,235,${rnd() * 0.3})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 2.5); }
  }, [10, 10]));
}
function stoneTex() { // 기단 장대석
  return TEX.stone || (TEX.stone = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#a8a49a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 42) for (let x = (y / 42) % 2 ? -40 : 0; x < w; x += 90) {
      g.fillStyle = `hsl(40, 6%, ${56 + rnd() * 12}%)`; g.fillRect(x + 2, y + 2, 86, 38);
    }
  }, [6, 1]));
}
function plasterTex() { // 회벽 + 나무틀
  return TEX.plaster || (TEX.plaster = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f1ebdd'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h); g.fillRect(w / 2 - 6, 0, 12, h);
  }));
}

const M = {};
function mats() {
  if (M.ok) return M;
  M.ok = true;
  M.tile = new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.75, color: '#ffffff' });
  M.tileUnder = new THREE.MeshStandardMaterial({ color: '#5a3a26', roughness: 0.9, side: THREE.BackSide });
  M.pillar = new THREE.MeshStandardMaterial({ color: '#7a3b2a', roughness: 0.7 });
  M.beam = new THREE.MeshStandardMaterial({ color: '#3f6b5c', roughness: 0.7 });
  M.beamRed = new THREE.MeshStandardMaterial({ color: '#8c3a2a', roughness: 0.7 });
  M.wood = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.55 });
  M.stone = new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.95 });
  M.stonePlain = new THREE.MeshStandardMaterial({ color: '#b3ad9f', roughness: 0.95 });
  M.paper = new THREE.MeshStandardMaterial({ map: paperTex(false), roughness: 0.9, emissive: '#ffc070', emissiveIntensity: 0, emissiveMap: paperTex(true) });
  M.plaster = new THREE.MeshStandardMaterial({ map: plasterTex(), roughness: 0.95 });
  M.ground = new THREE.MeshStandardMaterial({ map: groundTex(), roughness: 1 });
  M.grass = new THREE.MeshStandardMaterial({ color: '#4f6b3a', roughness: 1 });
  M.desk = new THREE.MeshStandardMaterial({ color: '#5a321c', roughness: 0.45 });
  M.cushion = new THREE.MeshStandardMaterial({ color: '#8c2f3a', roughness: 0.95 });
  M.book = new THREE.MeshStandardMaterial({ color: '#d9cfb8', roughness: 0.95 });
  M.cover = new THREE.MeshStandardMaterial({ color: '#2f4a6e', roughness: 0.8 });
  M.bronze = new THREE.MeshStandardMaterial({ color: '#7a6a3a', roughness: 0.35, metalness: 0.7 });
  M.bark = new THREE.MeshStandardMaterial({ color: '#5b4a3c', roughness: 1 });
  M.dark = new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 0.8 });
  return M;
}

// ---------------- 한옥 지붕 (팔작지붕 근사: 처마가 휘어 올라감) ----------------
function makeRoof({ w, d, wr, eave, h, lift = 0.6, seg = [48, 24] }) {
  const g = new THREE.PlaneGeometry(w * 2, d * 2, seg[0], seg[1]);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const t = Math.min(1, Math.max(Math.abs(z) / d, (Math.abs(x) - wr) / (w - wr), 0));
    const corner = Math.pow(Math.abs(x) / w, 4) * Math.pow(Math.abs(z) / d, 1.5);
    p.setY(i, eave + h * Math.pow(1 - t, 1.5) + lift * corner + lift * 0.25 * Math.pow(Math.abs(x) / w, 6));
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 0.6, uv.getY(i) * d * 0.7);
  const m = mats();
  const top = new THREE.Mesh(g, m.tile); top.castShadow = true; top.receiveShadow = true;
  const under = new THREE.Mesh(g, m.tileUnder); under.position.y = -0.08;
  const grp = new THREE.Group(); grp.add(top, under);
  // 용마루
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(wr * 2 + 0.6, 0.32, 0.38), new THREE.MeshStandardMaterial({ color: '#2f3238', roughness: 0.7 }));
  ridge.position.y = eave + h + 0.12; ridge.castShadow = true; grp.add(ridge);
  [-1, 1].forEach((s) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.42), ridge.material); c.position.set(s * (wr + 0.3), eave + h + 0.26, 0); c.rotation.z = -s * 0.35; grp.add(c); });
  grp.userData.top = top;
  return grp;
}

// ---------------- 은행나무 ----------------
function makeGinkgo(x, z, scene, high) {
  const m = mats();
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  // 둘레석
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.45, 24, 1, true), m.stonePlain); ring.position.y = 0.22; ring.receiveShadow = true; g.add(ring);
  const ringTop = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.75, 24), m.stonePlain); ringTop.rotation.x = -Math.PI / 2; ringTop.position.y = 0.45; g.add(ringTop);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshStandardMaterial({ color: '#6b5a44', roughness: 1 })); soil.rotation.x = -Math.PI / 2; soil.position.y = 0.38; g.add(soil);
  // 줄기 + 가지
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 6.5, 14), m.bark); trunk.position.y = 3.2; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.5, len = 2.4 + rnd() * 1.6;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.26, len, 8), m.bark);
    b.position.set(Math.cos(a) * len * 0.35, 5 + rnd() * 2.4, Math.sin(a) * len * 0.35);
    b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); b.castShadow = true; g.add(b);
  }
  // 잎 덩어리 (인스턴스)
  const N = high ? 230 : 130;
  const leafGeo = new THREE.IcosahedronGeometry(0.85, 1);
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.85, color: '#ffffff' });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, N); leaves.castShadow = true;
  const d = new THREE.Object3D(), pts = [];
  for (let i = 0; i < N; i++) {
    let px, py, pz;
    do { px = rnd() * 2 - 1; py = rnd() * 2 - 1; pz = rnd() * 2 - 1; } while (px * px + py * py + pz * pz > 1);
    const cone = 1 - (py + 1) * 0.28; // 위로 갈수록 좁게 (은행나무 실루엣)
    d.position.set(px * 4.2 * cone, 8 + py * 3.6, pz * 4.2 * cone);
    d.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); const s = 0.7 + rnd() * 0.6; d.scale.setScalar(s); d.updateMatrix();
    leaves.setMatrixAt(i, d.matrix); leaves.setColorAt(i, new THREE.Color('#7cb342'));
    pts.push({ m: d.matrix.clone(), r: rnd() });
  }
  g.add(leaves);
  COLLIDERS.push({ x, z, r: 1.8 });
  return { group: g, leaves, pts, x, z };
}

// ---------------- 벚나무(정문 옆) ----------------
function makeCherry(x, z, scene) {
  const m = mats();
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.6, 10), m.bark); t.position.y = 1.3; t.rotation.z = 0.08; t.castShadow = true; g.add(t);
  const mat = new THREE.MeshStandardMaterial({ color: '#f7c6d6', roughness: 0.9 });
  const blobs = [];
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + rnd() * 0.5, 1), mat); b.position.set(rnd() * 2.4 - 1.2, 2.8 + rnd() * 1.4, rnd() * 2.4 - 1.2); b.castShadow = true; g.add(b); blobs.push(b); }
  COLLIDERS.push({ x, z, r: 0.45 });
  return { mat, blobs };
}

// ---------------- 소나무(담장 밖) ----------------
function makePines(scene, high) {
  const m = mats();
  const n = high ? 70 : 40;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.32, 4, 6), m.bark, n);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshStandardMaterial({ color: '#2f4a32', roughness: 1, flatShading: true }), n * 2);
  const d = new THREE.Object3D(); let k = 0;
  for (let i = 0; i < n; i++) {
    let x, z;
    const side = i % 4;
    if (side === 0) { x = -26 + rnd() * 52; z = -24 - rnd() * 10; }
    else if (side === 1) { x = -23 - rnd() * 8; z = -24 + rnd() * 44; }
    else if (side === 2) { x = 23 + rnd() * 8; z = -24 + rnd() * 44; }
    else { x = -30 + rnd() * 60; z = 20 + rnd() * 8; if (Math.abs(x) < 5) x += 10 * Math.sign(x || 1); }
    const s = 0.8 + rnd() * 0.6;
    d.position.set(x, 2 * s, z); d.rotation.set(0, 0, (rnd() - 0.5) * 0.3); d.scale.setScalar(s); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix);
    for (let j = 0; j < 2; j++) { d.position.set(x + (rnd() - 0.5) * 1.5, (4 + j * 1.2) * s, z + (rnd() - 0.5) * 1.5); d.scale.set(s * (1.4 - j * 0.3), s * 0.55, s * (1.4 - j * 0.3)); d.rotation.set(0, rnd() * 3, 0); d.updateMatrix(); crown.setMatrixAt(k++, d.matrix); }
  }
  trunk.castShadow = crown.castShadow = true;
  scene.add(trunk, crown);
  return { crown };
}

// ---------------- 청사초롱 (등불 줄) ----------------
function makeLantern() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12), new THREE.MeshStandardMaterial({ color: '#c92a2a', emissive: '#ff6a3a', emissiveIntensity: 0.05, roughness: 0.8 }));
  const capM = new THREE.MeshStandardMaterial({ color: '#2b4a9a', emissive: '#4a7aff', emissiveIntensity: 0.02, roughness: 0.8 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.1, 12), capM); top.position.y = 0.26;
  const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.1, 12), capM); bot.position.y = -0.26;
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.25, 6), new THREE.MeshStandardMaterial({ color: '#c92a2a' })); tassel.position.y = -0.44;
  g.add(body, top, bot, tassel);
  g.userData = { body, capM, lit: 0, target: 0 };
  return g;
}

// ---------------- 책상(서안) + 향로 ----------------
function makeDesk(seat) {
  const m = mats();
  const g = new THREE.Group(); g.position.set(seat.x, FLOOR_Y, seat.z + 0.62);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.42), m.desk); top.position.y = 0.34; top.castShadow = true; top.receiveShadow = true; g.add(top);
  [-1, 1].forEach((s) => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.38), m.desk); leg.position.set(s * 0.42, 0.16, 0); g.add(leg); const curl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), m.desk); curl.rotation.x = Math.PI / 2; curl.position.set(s * 0.46, 0.37, 0); g.add(curl); });
  // 펼친 책
  const book = new THREE.Group(); book.position.set(-0.08, 0.37, 0.02);
  [-1, 1].forEach((s) => { const pg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.28), m.book); pg.position.x = s * 0.11; pg.rotation.z = -s * 0.08; book.add(pg); });
  const cov = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.008, 0.3), m.cover); cov.position.y = -0.01; book.add(cov);
  g.add(book);
  // 향로 + 향
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.06, 14), m.bronze); burner.position.set(0.34, 0.39, -0.08); g.add(burner);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 5), new THREE.MeshStandardMaterial({ color: '#8a5a3a' }));
  stick.geometry.translate(0, 0.15, 0); stick.position.set(0.34, 0.42, -0.08); stick.visible = false; g.add(stick);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff7a2a', toneMapped: false })); ember.visible = false; g.add(ember);
  // 방석
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.6), m.cushion); cushion.position.set(0, 0.04, -0.62); cushion.receiveShadow = true; g.add(cushion);
  return { group: g, stick, ember, burner, book };
}

// ---------------- 하늘 ----------------
function makeSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#5aa0e0') }, bottom: { value: new THREE.Color('#d8ecff') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float t = clamp(vP.y*1.6+0.1,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(t,0.8)),1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat); scene.add(sky);
  const n = 900, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) + 0.05; v.normalize().multiplyScalar(560); p.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
  const disc = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, fog: false, depthWrite: false, toneMapped: false, transparent: true }));
  orb.scale.setScalar(70); scene.add(orb);
  return { mat, stars, orb };
}

// ---------------- 계절·시간 프리셋 ----------------
export const TIMES = {
  dawn: { sky: ['#4a5a8c', '#f2b48a'], fog: '#c9a89a', sun: [0.2, 0.15, 1], sunC: '#ffc89a', sunI: 1.3, hemi: ['#b8c4e8', '#6b5a4a', 0.7], night: 0.35, label: '새벽' },
  day: { sky: ['#4f93d8', '#d9ecfb'], fog: '#c7d8e6', sun: [0.5, 0.85, 0.4], sunC: '#fff4e0', sunI: 2.6, hemi: ['#dcecff', '#8a7a5a', 1.1], night: 0, label: '낮' },
  sunset: { sky: ['#4a4a8a', '#ff9a5a'], fog: '#d89a7a', sun: [-0.7, 0.18, 0.6], sunC: '#ffb070', sunI: 1.7, hemi: ['#e8b8a8', '#5a4a3a', 0.75], night: 0.25, label: '해 질 녘' },
  night: { sky: ['#060b1e', '#1e2c4e'], fog: '#141c30', sun: [-0.3, 0.7, -0.5], sunC: '#9fb4e8', sunI: 0.55, hemi: ['#4a5a8a', '#1a1612', 0.35], night: 1, label: '밤' },
};
export const SEASONS = {
  spring: { label: '봄', leaf: ['#a9d86e', '#c5e88a', '#8cc152'], ground: '#cbbd98', grass: '#6b8f45', cherry: '#f7c6d6', snow: 0, canopy: 1 },
  summer: { label: '여름', leaf: ['#3f8f3a', '#2f7a32', '#58a948'], ground: '#c4b48e', grass: '#3f6e2e', cherry: '#4f8a3a', snow: 0, canopy: 1 },
  autumn: { label: '가을', leaf: ['#ffcf3a', '#f5b81a', '#ffe066', '#e8a317'], ground: '#cbb890', grass: '#7a7a42', cherry: '#d8743a', snow: 0, canopy: 0.95 },
  winter: { label: '겨울', leaf: ['#e8eef4', '#d8e0e8'], ground: '#e9eef3', grass: '#dfe6ec', cherry: '#e4eaf0', snow: 1, canopy: 0.35 },
};
export function realTheme(date = new Date()) {
  const kst = new Date(date.getTime() + (date.getTimezoneOffset() + 540) * 60000);
  const mo = kst.getMonth() + 1, h = kst.getHours();
  const season = mo >= 3 && mo <= 5 ? 'spring' : mo >= 6 && mo <= 8 ? 'summer' : mo >= 9 && mo <= 11 ? 'autumn' : 'winter';
  const time = h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'sunset' : 'night';
  const weather = season === 'autumn' ? 'leaves' : season === 'winter' ? 'snow' : season === 'spring' ? 'petals' : 'clear';
  return { title: `지금의 성균관 · ${SEASONS[season].label} ${TIMES[time].label}`, season, time, weather, real: true };
}

// ---------------- 월드 빌드 ----------------
export function buildWorld(scene, { high = true } = {}) {
  const m = mats();
  COLLIDERS.length = 0; BOXES.length = 0;
  const sky = makeSky(scene);
  scene.fog = new THREE.Fog('#c7d8e6', 60, 320);

  // 빛
  const hemi = new THREE.HemisphereLight('#dcecff', '#8a7a5a', 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
  sun.castShadow = high; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  // 명륜당 안 따뜻한 등잔 빛 (밤에 켜짐)
  const hallLights = [-6, 0, 6].map((x) => { const l = new THREE.PointLight('#ffb96a', 0, 14, 1.6); l.position.set(x, FLOOR_Y + 2.4, -13.2); scene.add(l); return l; });

  // 땅
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), m.grass); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; scene.add(outer);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(39, 37), m.ground); yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0, -2); yard.receiveShadow = true; scene.add(yard);
  // 박석 길 (정문 → 명륜당)
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1), new THREE.MeshStandardMaterial({ color: '#a39d90', roughness: 0.95 }), 260);
  { const d = new THREE.Object3D(); let k = 0; for (let z = -8.2; z < 15.8 && k < 260; z += 0.62) for (let x = -1.5; x < 1.5 && k < 260; x += 0.75 + rnd() * 0.2) { d.position.set(x + 0.35, 0.03, z + (rnd() - 0.5) * 0.1); d.scale.set(0.68 + rnd() * 0.2, 1, 0.54 + rnd() * 0.1); d.rotation.y = (rnd() - 0.5) * 0.1; d.updateMatrix(); slabs.setMatrixAt(k, d.matrix); slabs.setColorAt(k++, new THREE.Color().setHSL(0.1, 0.05, 0.55 + rnd() * 0.12)); } slabs.count = k; }
  slabs.receiveShadow = true; scene.add(slabs);

  // ===== 명륜당 =====
  const hall = new THREE.Group(); scene.add(hall);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(PLAT.x * 2, FLOOR_Y, PLAT.z1 - PLAT.z0), m.stone);
  plat.position.set(0, FLOOR_Y / 2, (PLAT.z0 + PLAT.z1) / 2); plat.receiveShadow = true; plat.castShadow = true; hall.add(plat);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(21, 0.06, 8.2), m.wood); floor.position.set(0, FLOOR_Y + 0.02, -13.9); floor.receiveShadow = true; hall.add(floor);
  // 계단
  STAIRS.forEach((s) => {
    const w = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2;
    for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(w, FLOOR_Y * (3 - k) / 3, 0.55), m.stonePlain); st.position.set(cx, FLOOR_Y * (3 - k) / 6, PLAT.z1 + 0.27 + k * 0.55); st.receiveShadow = true; st.castShadow = true; hall.add(st); }
  });
  // 기둥 + 도리
  const PX = [-10.2, -6.8, -3.4, 0, 3.4, 6.8, 10.2];
  const colH = 3.0;
  [-17.6, -10.2].forEach((z) => PX.forEach((x) => {
    if (Math.abs(x) < 0.1) return;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, colH, 14), m.pillar); p.position.set(x, FLOOR_Y + colH / 2, z); p.castShadow = true; hall.add(p);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.12, 12), m.stonePlain); base.position.set(x, FLOOR_Y + 0.06, z); hall.add(base);
    if (z > -11) COLLIDERS.push({ x, z, r: 0.32 });
  }));
  [-17.6, -10.2].forEach((z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(21.2, 0.32, 0.36), m.beam); b.position.set(0, FLOOR_Y + colH + 0.1, z); b.castShadow = true; hall.add(b); const r2 = new THREE.Mesh(new THREE.BoxGeometry(21.2, 0.12, 0.3), m.beamRed); r2.position.set(0, FLOOR_Y + colH - 0.12, z); hall.add(r2); });
  [-10.2, 10.2].forEach((x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 7.8), m.beam); b.position.set(x, FLOOR_Y + colH + 0.1, -13.9); hall.add(b); });
  // 뒷벽·옆벽 창호
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20.4, colH - 0.2), m.paper); backWall.position.set(0, FLOOR_Y + colH / 2, -17.62); hall.add(backWall);
  m.paper.map.repeat.set(1, 1);
  [-1, 1].forEach((s) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(7.2, colH - 0.2), m.paper); w.position.set(s * 10.22, FLOOR_Y + colH / 2, -13.9); w.rotation.y = -s * Math.PI / 2; hall.add(w); });
  BOXES.push({ x: 0, z: -18.1, hx: 11, hz: 0.5 });
  // 지붕
  const hallRoof = makeRoof({ w: 12.8, d: 5.6, wr: 8.2, eave: FLOOR_Y + colH + 0.1, h: 2.6, lift: 0.8 });
  hallRoof.position.z = -13.9; hall.add(hallRoof);
  // 현판 明倫堂
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.08), new THREE.MeshStandardMaterial({
    map: canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#2a201a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#a8823a'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#f0d58a'; g.font = '700 96px "Noto Serif KR","Batang","serif"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('明 倫 堂', w / 2, h / 2 + 4); }),
    roughness: 0.6, emissive: '#f0d58a', emissiveIntensity: 0.02,
  }));
  board.position.set(0, FLOOR_Y + colH + 0.75, -10.0); hall.add(board);

  // 책상 24개
  const desks = SEATS.map((s) => { const d = makeDesk(s); hall.add(d.group); return d; });

  // ===== 동재 · 서재 (유생 기숙사) =====
  [-1, 1].forEach((s) => {
    const g = new THREE.Group(); g.position.set(s * 15.4, 0, 1.5); scene.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.45, 15.4), m.stone); base.position.y = 0.22; base.receiveShadow = true; g.add(base);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 14.6), m.plaster); body.position.y = 1.55; body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (let k = 0; k < 6; k++) { const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.7), m.paper); door.position.set(-s * 1.81, 1.35, -6 + k * 2.4); door.rotation.y = -s * Math.PI / 2; g.add(door); }
    const maru = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 14.6), m.wood); maru.position.set(-s * 2.15, 0.56, 0); g.add(maru);
    const roof = makeRoof({ w: 8.4, d: 3.0, wr: 6.2, eave: 2.6, h: 1.7, lift: 0.5, seg: [40, 16] }); roof.rotation.y = Math.PI / 2; g.add(roof);
    BOXES.push({ x: s * 15.4, z: 1.5, hx: 2.6, hz: 7.8 });
  });

  // ===== 담장 + 정문 =====
  const wallMat = m.plaster;
  const capMat = new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.7 });
  const wallSeg = (x, z, len, rotY) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, 1.9, 0.5), wallMat); w.position.set(x, 0.95, z); w.rotation.y = rotY; w.castShadow = true; w.receiveShadow = true; scene.add(w);
    const c = new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 0.22, 0.9), capMat); c.position.set(x, 2.0, z); c.rotation.y = rotY; scene.add(c);
    wallMat.map.repeat.set(1, 1);
  };
  wallSeg(0, -20.2, 40, 0);
  wallSeg(-19.2, -2.2, 36, Math.PI / 2); wallSeg(19.2, -2.2, 36, Math.PI / 2);
  wallSeg(-10.8, 16, 16.8, 0); wallSeg(10.8, 16, 16.8, 0);
  { // 정문(삼문)
    const g = new THREE.Group(); g.position.set(0, 0, 16); scene.add(g);
    [-2.4, 2.4].forEach((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 3.1, 12), m.pillar); p.position.set(x, 1.55, 0); p.castShadow = true; g.add(p); COLLIDERS.push({ x, z: 16, r: 0.3 }); });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 0.32), m.beam); lintel.position.y = 3.15; g.add(lintel);
    const roof = makeRoof({ w: 3.6, d: 1.5, wr: 2, eave: 3.25, h: 1.1, lift: 0.35, seg: [24, 10] }); g.add(roof);
    [-1, 1].forEach((s) => { const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.7, 0.08), new THREE.MeshStandardMaterial({ color: '#9c2f24', roughness: 0.7 })); door.position.set(s * 2.3, 1.4, -1.05); door.rotation.y = s * 1.45; g.add(door); });
    // 태극 문양 대신 단순한 원 장식
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.06), new THREE.MeshStandardMaterial({ map: canvasTex(384, 110, (gg, w, h) => { gg.fillStyle = '#2a201a'; gg.fillRect(0, 0, w, h); gg.fillStyle = '#f0d58a'; gg.font = '700 64px "Noto Serif KR",serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('成 均 館', w / 2, h / 2 + 4); }), roughness: 0.6 }));
    sign.position.set(0, 2.75, 0.2); g.add(sign);
  }

  // ===== 종각 =====
  const bellG = new THREE.Group(); bellG.position.set(BELL.x, 0, BELL.z); scene.add(bellG);
  [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.8, 10), m.pillar); p.position.set(x, 1.4, z); p.castShadow = true; bellG.add(p); });
  const bellRoof = makeRoof({ w: 1.6, d: 1.6, wr: 0.2, eave: 2.8, h: 1.0, lift: 0.3, seg: [16, 16] }); bellG.add(bellRoof);
  const bellPivot = new THREE.Group(); bellPivot.position.y = 2.6; bellG.add(bellPivot);
  const bell = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.3, -0.05], [0.42, -0.4], [0.5, -0.95], [0.55, -1.05], [0, -1.05]].map(([x, y]) => new THREE.Vector2(x, y)), 24), M.bronze);
  bell.castShadow = true; bellPivot.add(bell);
  COLLIDERS.push({ x: BELL.x, z: BELL.z, r: 1.3 });

  // ===== 은행나무 · 벚나무 · 석등 =====
  const ginkgos = GINKGO.map((p) => makeGinkgo(p.x, p.z, scene, high));
  const cherries = [makeCherry(-7.5, 12.5, scene), makeCherry(7.5, 12.5, scene)];
  const pines = makePines(scene, high);
  const stoneLamps = [[-3, 2.5], [3, 2.5], [-3, 9], [3, 9]].map(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.3, 8), m.stonePlain); base.position.y = 0.15; g.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8), m.stonePlain); post.position.y = 0.75; g.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), new THREE.MeshStandardMaterial({ color: '#b3ad9f', emissive: '#ffb050', emissiveIntensity: 0 })); box.position.y = 1.4; g.add(box);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.32, 8), m.stonePlain); cap.position.y = 1.76; g.add(cap);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    COLLIDERS.push({ x, z, r: 0.42 });
    return box;
  });
  const lampLight = new THREE.PointLight('#ffb050', 0, 16, 1.6); lampLight.position.set(0, 2, 5.5); scene.add(lampLight);

  // ===== 먼 산 =====
  const hills = [];
  const hillMat = new THREE.MeshStandardMaterial({ color: '#4a6a5a', roughness: 1, flatShading: true });
  [[-120, -230, 90, 55], [40, -260, 130, 72], [180, -200, 80, 45], [-230, -120, 70, 38], [240, -40, 70, 40], [-60, 260, 110, 40], [150, 220, 90, 42]].forEach(([x, z, r, h]) => {
    const g = new THREE.ConeGeometry(r, h, 9, 3); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < h / 2 - 1) { p.setX(i, p.getX(i) * (0.85 + rnd() * 0.3)); p.setZ(i, p.getZ(i) * (0.85 + rnd() * 0.3)); p.setY(i, p.getY(i) + (rnd() - 0.5) * 6); }
    g.computeVertexNormals();
    const mm = new THREE.Mesh(g, hillMat); mm.position.set(x, h / 2 - 4, z); scene.add(mm); hills.push(mm);
  });

  // ===== 등불 줄 (모두의 공부가 쌓이면 하나씩 켜짐) =====
  const lanterns = [];
  const ropeMat = new THREE.LineBasicMaterial({ color: '#3a2a20' });
  [[0.5, 0], [7.5, 0]].forEach(([z]) => {
    const pts = []; for (let k = 0; k <= 30; k++) { const x = -13 + (26 * k) / 30; const sag = 1 - Math.pow(x / 13, 2); pts.push(new THREE.Vector3(x, 5.6 - sag * 0.7, z)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ropeMat));
    for (let k = 1; k <= 20; k++) { const x = -13 + (26 * k) / 21; const sag = 1 - Math.pow(x / 13, 2); const l = makeLantern(); l.position.set(x, 5.6 - sag * 0.7 - 0.32, z); l.userData.phase = rnd() * 6; scene.add(l); lanterns.push(l); }
  });
  // 줄 거는 기둥
  [-13.4, 13.4].forEach((x) => [0.5, 7.5].forEach((z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.8, 8), m.pillar); p.position.set(x, 2.9, z); scene.add(p); COLLIDERS.push({ x, z, r: 0.22 }); }));
  // 정렬: 가운데부터 켜지도록
  lanterns.sort((a, b) => Math.abs(a.position.x) - Math.abs(b.position.x) || a.position.z - b.position.z);

  // ===== 날씨 입자 =====
  const NP = high ? 1600 : 800;
  const wGeo = new THREE.BufferGeometry(); const wPos = new Float32Array(NP * 3); const wVel = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) { wPos.set([(rnd() - 0.5) * 60, rnd() * 22, (rnd() - 0.5) * 60], i * 3); }
  wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  const wMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, map: softDot(), transparent: true, opacity: 0.95, depthWrite: false });
  const weatherPts = new THREE.Points(wGeo, wMat); weatherPts.frustumCulled = false; scene.add(weatherPts);
  // 떨어진 잎 (바닥)
  const fallen = new THREE.InstancedMesh(new THREE.CircleGeometry(0.09, 5), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, side: THREE.DoubleSide }), 700);
  { const d = new THREE.Object3D(); for (let i = 0; i < 700; i++) { const t = GINKGO[i % 2]; const a = rnd() * 6.28, r = 1.8 + Math.pow(rnd(), 0.7) * 6.5; d.position.set(t.x + Math.cos(a) * r, 0.015, t.z + Math.sin(a) * r * 0.9); d.rotation.set(-Math.PI / 2, 0, rnd() * 6); d.scale.set(1 + rnd(), 0.7 + rnd() * 0.6, 1); d.updateMatrix(); fallen.setMatrixAt(i, d.matrix); fallen.setColorAt(i, new THREE.Color('#ffd43b').offsetHSL((rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.15)); } }
  fallen.receiveShadow = true; scene.add(fallen);

  // ---------------- 상태 ----------------
  const state = { theme: null, cur: null, glow: 0, lit: 0, weather: 'clear', night: 0 };
  const tmp = new THREE.Color();
  const roofs = [];
  scene.traverse((o) => { if (o.userData?.top) roofs.push(o.userData.top); });

  function applyTheme(th) {
    const T = TIMES[th.time] || TIMES.day, S = SEASONS[th.season] || SEASONS.autumn;
    state.theme = th; state.weather = th.weather || 'clear'; state.target = { T, S, sky: th.sky };
    // 즉시 바뀌는 것들 (색은 update 에서 부드럽게)
    const cols = (S.leaf || []).map((c) => new THREE.Color(c));
    ginkgos.forEach((gk) => gk.pts.forEach((p, i) => {
      const keep = p.r < S.canopy;
      const mtx = keep ? p.m : new THREE.Matrix4().makeScale(0, 0, 0);
      gk.leaves.setMatrixAt(i, mtx);
      gk.leaves.setColorAt(i, cols[i % cols.length].clone().offsetHSL(0, 0, (p.r - 0.5) * 0.08));
    }));
    ginkgos.forEach((gk) => { gk.leaves.instanceMatrix.needsUpdate = true; gk.leaves.instanceColor.needsUpdate = true; });
    cherries.forEach((c) => { c.mat.color.set(S.cherry); c.blobs.forEach((b, i) => { b.visible = th.season !== 'winter' || i % 3 === 0; }); });
    fallen.visible = th.season === 'autumn' || th.season === 'winter';
    const fc = th.season === 'winter' ? '#f4f7fa' : '#ffd43b';
    for (let i = 0; i < fallen.count; i++) fallen.setColorAt(i, tmp.set(fc).offsetHSL(((i * 37) % 10 - 5) * 0.006, 0, ((i * 13) % 10 - 5) * 0.02));
    fallen.instanceColor.needsUpdate = true;
    roofs.forEach((r) => r.material.color.set(S.snow ? '#e8eef6' : '#ffffff'));
    pines.crown.material.color.set(S.snow ? '#7a8f84' : '#2f4a32');
    // 날씨 입자
    const w = state.weather;
    wMat.color.set(w === 'rain' ? '#a8c4e8' : w === 'petals' ? '#ffc2d6' : w === 'leaves' ? '#ffd43b' : '#ffffff');
    wMat.size = w === 'rain' ? 0.06 : w === 'petals' || w === 'leaves' ? 0.18 : 0.12;
    weatherPts.visible = ['rain', 'snow', 'petals', 'leaves'].includes(w);
    for (let i = 0; i < NP; i++) {
      const v = w === 'rain' ? [0, -16 - rnd() * 4, 0] : w === 'snow' ? [(rnd() - 0.5) * 0.6, -0.8 - rnd() * 0.6, (rnd() - 0.5) * 0.6] : [(rnd() - 0.2) * 1.2, -0.7 - rnd() * 0.5, (rnd() - 0.5) * 1];
      wVel.set(v, i * 3);
    }
  }

  const lerpC = (c, to, k) => c.lerp(tmp.set(to), k);
  function update(dt, now, camPos) {
    const tg = state.target; if (!tg) return;
    const { T, S } = tg; const k = Math.min(1, dt * 1.5);
    const sk = tg.sky || T.sky;
    lerpC(sky.mat.uniforms.top.value, sk[0], k); lerpC(sky.mat.uniforms.bottom.value, sk[1], k);
    const fogC = state.weather === 'fog' ? '#c8ccd0' : T.fog;
    lerpC(scene.fog.color, fogC, k);
    scene.fog.near += ((state.weather === 'fog' ? 8 : state.weather === 'rain' ? 30 : 60) - scene.fog.near) * k;
    scene.fog.far += ((state.weather === 'fog' ? 70 : state.weather === 'rain' ? 160 : 320) - scene.fog.far) * k;
    lerpC(sun.color, T.sunC, k); sun.intensity += ((state.weather === 'rain' || state.weather === 'fog' ? T.sunI * 0.45 : T.sunI) - sun.intensity) * k;
    const sd = new THREE.Vector3(...T.sun).normalize();
    const c = camPos || new THREE.Vector3();
    sun.position.set(c.x * 0 + sd.x * 60, sd.y * 60, sd.z * 60); sun.target.position.set(0, 0, -2);
    lerpC(hemi.color, T.hemi[0], k); lerpC(hemi.groundColor, T.hemi[1], k); hemi.intensity += (T.hemi[2] - hemi.intensity) * k;
    state.night += (T.night - state.night) * k;
    const n = state.night;
    scene.environmentIntensity = 0.25 - 0.19 * n;
    sky.stars.material.opacity = Math.max(0, n - 0.3) * (state.weather === 'clear' || state.weather === 'leaves' ? 1 : 0.2);
    sky.orb.position.copy(sd).multiplyScalar(520); sky.orb.material.color.set(n > 0.6 ? '#dfe8ff' : T.sunC); sky.orb.material.opacity = state.weather === 'rain' || state.weather === 'fog' ? 0.2 : 0.95;
    sky.orb.scale.setScalar(n > 0.6 ? 46 : 80);
    hillMat.color.copy(tmp.set('#4a6a5a').lerp(new THREE.Color(T.fog), 0.45 + n * 0.2));
    lerpC(M.ground.color, S.snow ? '#ffffff' : '#ffffff', k); lerpC(M.grass.color, S.grass, k);
    M.ground.color.set(S.snow ? '#f6f8fb' : '#ffffff');
    // 밤에는 창호·등잔이 따뜻하게
    M.paper.emissiveIntensity = n * 0.55;
    hallLights.forEach((l) => { l.intensity = n * (l.userData.boost || 9) + 1.2 * (1 - n) * 0; });
    // 등불
    lanterns.forEach((l, i) => {
      const u = l.userData; u.target = i < state.lit ? 1 : 0;
      u.lit += (u.target - u.lit) * Math.min(1, dt * 2);
      const fl = 0.9 + Math.sin(now / 300 + u.phase) * 0.1;
      u.body.material.emissiveIntensity = 0.05 + u.lit * (0.8 + n * 1.6) * fl;
      u.capM.emissiveIntensity = 0.02 + u.lit * 0.4;
      l.rotation.z = Math.sin(now / 900 + u.phase) * 0.06;
    });
    const litFrac = Math.min(1, state.lit / lanterns.length);
    stoneLamps.forEach((b) => { b.material.emissiveIntensity = (0.3 + litFrac) * (0.3 + n * 1.4); });
    lampLight.intensity = n * (2 + litFrac * 10);
    // 날씨 입자 이동 (카메라 주변)
    if (weatherPts.visible) {
      const p = wGeo.attributes.position.array, s = dt;
      const wob = state.weather === 'petals' || state.weather === 'leaves' || state.weather === 'snow';
      for (let i = 0; i < NP; i++) {
        const j = i * 3;
        p[j] += wVel[j] * s + (wob ? Math.sin(now / 700 + i) * 0.01 : 0); p[j + 1] += wVel[j + 1] * s; p[j + 2] += wVel[j + 2] * s;
        if (p[j + 1] < 0) { p[j] = c.x + (Math.random() - 0.5) * 60; p[j + 1] = 18 + Math.random() * 6; p[j + 2] = c.z + (Math.random() - 0.5) * 60; }
      }
      wGeo.attributes.position.needsUpdate = true;
    }
  }
  function setLit(n) { state.lit = Math.max(0, Math.min(lanterns.length, n)); }
  function ringBell() { bellG.userData.swing = 1; }
  function tickBell(dt) { const s = bellG.userData.swing || 0; if (s > 0.001) { bellPivot.rotation.x = Math.sin(performance.now() / 260) * 0.18 * s; bellG.userData.swing = s * Math.pow(0.4, dt); } }

  return { sun, hemi, hallLights, desks, lanterns, ginkgos, applyTheme, update, setLit, ringBell, tickBell, state, LANTERN_COUNT: lanterns.length };
}
