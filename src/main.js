// 온라인 성균관 2030 — 월드모델 파일럿
// 공간(명륜당·은행나무 마당) · 에이전트(나·다른 유생·NPC 유생·훈장님 AI) · 이벤트(향 타이머·정각 종·등불·계절 프롬프트)
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWorld, realTheme, softDot, SEATS, FLOOR_Y, SPAWN, TIMES, SEASONS } from './scene.js';
import { ROBES, HUNJANG_LOOK, scholarName } from './character.js';
import { Player, Avatar, createInput } from './player.js';
import { connect, botScholars, botLine, bellPhase, kst, ONLINE_CAPABLE } from './net.js';
import { hunjang, cleanChat, makeTheme } from './ai.js';
import { startAudio, setAmbience, tickAmbience, bell as bellSound, chime, strike, pop, toggleSound, setVolume, VOL } from './audio.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const TOUCH = matchMedia('(pointer: coarse)').matches;
const HIGH = qs.get('q') ? qs.get('q') === 'high' : !(TOUCH || Math.min(innerWidth, innerHeight) < 600);
const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

// ---------------- 렌더러 ----------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: HIGH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, HIGH ? 2 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = HIGH; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.25;
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 1400);
camera.position.set(0, 7, 24);
const world = buildWorld(scene, { high: HIGH });
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
if (HIGH) {
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.overrideVisibility = function () { const cache = this._visibilityCache; this.scene.traverse((o) => { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.isSprite || (o.material && o.material.transparent)) o.visible = false; }); };
  gtao.blendIntensity = 0.8; gtao.updateGtaoMaterial({ radius: 0.5, distanceFallOff: 1, thickness: 1 }); composer.addPass(gtao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
if (HIGH) composer.addPass(new SMAAPass(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()));
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ---------------- 테마 (기본: 지금 실제 계절·시각) ----------------
let theme = realTheme();
let themeUntil = 0;
function applyTheme(th, { by = null, silent = false } = {}) {
  theme = th; world.applyTheme(th);
  $('theme-pill').textContent = `${th.season === 'winter' ? '❄️' : th.season === 'spring' ? '🌸' : th.season === 'summer' ? '🌿' : '🍂'} ${th.title}`;
  setAmbience({ night: TIMES[th.time]?.night || 0, rain: th.weather === 'rain' ? 1 : 0 });
  bloom.strength = th.time === 'night' ? 0.75 : th.time === 'sunset' || th.time === 'dawn' ? 0.55 : 0.4;
  renderer.toneMappingExposure = th.time === 'night' ? 1.15 : 1.0;
  if (!silent && by) toast(`${by}님이 서원 풍경을 바꿨어요 · ${th.title}`);
}
applyTheme(theme, { silent: true });

// ---------------- 나 ----------------
const MEM_KEY = 'sgk-memory';
const mem = (() => { try { return JSON.parse(localStorage.getItem(MEM_KEY) || 'null') || { days: {} }; } catch { return { days: {} }; } })();
const saveMem = () => { try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch { /* 저장 불가 */ } };
const today = () => kst().day;
const todayLog = () => (mem.days[today()] = mem.days[today()] || []);

const me = {
  id: Math.random().toString(36).slice(2, 10), joinedAt: Date.now(),
  name: mem.name || scholarName(), robe: mem.robe || ROBES[2], hat: mem.hat || 'yugeon',
  seat: null, state: 'walk', goal: '', startAt: 0, endAt: 0, mins: 0, sync: false,
  get look() { return { skin: mem.skin || '#f2c9a0', hair: '#2b1d14', hairStyle: this.hat === 'none' ? 'bun' : 'short', outfit: this.robe, robe: true, belt: this.robe === '#c92a2a' ? '#1c3d6e' : '#c92a2a', accessory: this.hat, accessoryColor: '#1d1b22' }; },
  get done() { return todayLog().filter((s) => s.full).length; },
  public() {
    const p = player ? player.pos : SPAWN;
    return { id: this.id, name: this.name, look: this.look, seat: this.seat, x: +p.x.toFixed(2), z: +p.z.toFixed(2), state: this.state, goal: this.state === 'study' ? this.goal : '', endAt: this.state === 'study' ? this.endAt : 0, done: this.done, theme: themeUntil > Date.now() ? { ...theme, until: themeUntil } : null };
  },
};
let player = null, input = null, net = null, entered = false;

// ---------------- 입학 화면 ----------------
$('my-name').value = me.name;
$('reroll').onclick = () => { me.name = scholarName(); $('my-name').value = me.name; };
ROBES.forEach((c) => { const b = document.createElement('button'); b.style.background = c; b.title = c; if (c === me.robe) b.className = 'on'; b.onclick = () => { me.robe = c; [...$('robes').children].forEach((x) => x.classList.toggle('on', x === b)); }; $('robes').appendChild(b); });
[...$('hats').children].forEach((b) => { b.classList.toggle('on', b.dataset.v === me.hat); b.onclick = () => { me.hat = b.dataset.v; [...$('hats').children].forEach((x) => x.classList.toggle('on', x === b)); }; });
if (mem.visits) document.querySelector('#intro .kicker').textContent = `다시 오셨네요 · ${mem.visits + 1}번째 등교`;
$('enter').onclick = enter;
$('my-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });

function enter() {
  if (entered) return; entered = true;
  me.name = cleanChat($('my-name').value || me.name, 12) || scholarName();
  Object.assign(mem, { name: me.name, robe: me.robe, hat: me.hat, visits: (mem.visits || 0) + 1 }); saveMem();
  startAudio();
  $('intro').classList.add('hidden');
  ['hud', 'topright', 'hint'].forEach((k) => $(k).classList.remove('hidden'));
  if (TOUCH) $('joy').classList.remove('hidden');
  player = new Player(scene, me.look, me.name);
  player.pos.set(SPAWN.x, 0, SPAWN.z); player.yaw = 0;
  player.extra = () => [...avatars.values()].filter((a) => !a.seated).map((a) => ({ x: a.group.position.x, z: a.group.position.z, r: 0.3 })).concat([{ x: hj.group.position.x, z: hj.group.position.z, r: 0.35 }]);
  input = createInput(canvas, player);
  hint('명륜당 마루의 빈 방석으로 가서 앉아보세요 · 이동 WASD/조이스틱 · 시점 드래그');
  net = connect(me, {
    onPeers: () => {}, onStatus,
    onSay: ({ id, text }) => { const a = avatars.get(id); if (a) a.say(cleanChat(text), performance.now()); },
    onTheme: (t, by) => { if (!t || !t.until || t.until < Date.now() || t.until <= themeUntil) return; themeUntil = t.until; const name = net.peers.get(by)?.name || '누군가'; applyTheme(t, { by: name }); },
    onLantern: ({ id, name }) => { if (id === me.id) return; toast(`🏮 ${cleanChat(name, 12)}님이 향 하나를 다 태웠어요 · 등불이 켜졌어요`); flashLantern(); },
  });
  setInterval(() => net.update(), 2000);
  hjGreet();
}
function onStatus(s) {
  const el = $('status');
  if (!ONLINE_CAPABLE) { el.textContent = '🌙 혼자 미리보기 · NPC 유생과 함께'; return; }
  if (s.error) { el.textContent = '⚠️ 연결 끊김 · 새로고침해 주세요'; el.title = s.error; return; }
  el.textContent = s.online ? `🟢 ${s.room}번 서원 · 접속 ${s.count || 1}명` : '연결 중…';
}

// ---------------- 토스트·힌트 ----------------
let toastT = 0;
function toast(msg, ms = 3600) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
let hintT = 0;
function hint(msg, ms = 9000) { const h = $('hint'); h.textContent = msg; h.style.opacity = 1; clearTimeout(hintT); hintT = setTimeout(() => { h.style.opacity = 0; }, ms); }

// ---------------- 다른 유생들 ----------------
const avatars = new Map(); // id -> Avatar (실제 사람 + NPC)
let bots = [], botsAt = 0, lastLineSlot = -1;
function takenSeats() { const s = new Set(); if (me.seat !== null) s.add(me.seat); net?.peers.forEach((p) => { if (p.seat !== null && p.seat !== undefined) s.add(p.seat); }); return s; }
function statusText(st) {
  if (st.state === 'study') { const left = st.left !== undefined ? st.left : Math.max(0, (st.endAt - Date.now()) / 1000); return `📖 ${st.goal ? cleanChat(st.goal, 14) + ' · ' : ''}${Math.ceil(left / 60)}분`; }
  if (st.state === 'break') return '🍵 쉬는 중';
  if (st.seat !== null && st.seat !== undefined) return '🪷 자리 잡음';
  return '';
}
function syncAvatars(dt, now) {
  if (now - botsAt > 500) { botsAt = now; bots = botScholars(Date.now(), (net?.peers.size || 0) + 1, takenSeats()); }
  const want = new Map();
  net?.peers.forEach((p, id) => {
    const seated = p.seat !== null && p.seat !== undefined;
    const s = seated ? SEATS[p.seat] : null;
    want.set(id, { ...p, seated, x: s ? s.x : p.x, z: s ? s.z : p.z, read: p.state === 'study' });
  });
  bots.forEach((b) => want.set(b.id, b));
  avatars.forEach((a, id) => { if (!want.has(id)) { a.dispose(); avatars.delete(id); } });
  want.forEach((st, id) => {
    let a = avatars.get(id);
    if (!a) { a = new Avatar(scene, { look: st.look, name: st.name, bot: st.bot }); a.group.position.set(st.x, 0, st.z); avatars.set(id, a); }
    a.setLook(st.look, st.name, st.bot);
    a.seated = st.seated;
    a.setStatus(statusText(st));
    a.update(dt, st, now, camera.position);
    a.studying = st.state === 'study'; a.seatIdx = st.seat;
  });
  const line = botLine(Date.now() / 1000, bots);
  if (line && line.slot !== lastLineSlot) { lastLineSlot = line.slot; avatars.get(line.id)?.say(line.text, now, 4000); }
}

// ---------------- 훈장님 (모두에게 같은 길을 도는 AI) ----------------
const hj = new Avatar(scene, { look: HUNJANG_LOOK, name: '훈장님', tagColor: 'rgba(120,80,20,0.82)' });
hj.group.position.set(0, FLOOR_Y, -10.6);
const PATROL = [[-9.6, -10.5], [9.6, -10.5], [9.6, -12.3], [-9.6, -12.3], [-9.6, -14.1], [9.6, -14.1], [9.6, -16.2], [0, -16.6], [-9.6, -16.2]];
const PATROL_LEN = PATROL.reduce((s, p, i) => s + Math.hypot(p[0] - PATROL[(i + 1) % PATROL.length][0], p[1] - PATROL[(i + 1) % PATROL.length][1]), 0);
let hjVisit = null; // { x, z, until, face }
function hjRoute(sec) {
  const b = bellPhase(sec * 1000);
  if (b.phase === 'break') { const t = sec / 14; return { x: -4.4 + Math.sin(t) * 0.8, z: 0.4 + Math.cos(t * 0.7) * 0.6, speed: 1.2 }; }
  let d = (sec * 0.45) % PATROL_LEN;
  for (let i = 0; i < PATROL.length; i++) {
    const a = PATROL[i], c = PATROL[(i + 1) % PATROL.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (d <= L) { const k = d / L; const pause = Math.floor(sec / 9) % 4 === 0; return { x: a[0] + (c[0] - a[0]) * k, z: a[1] + (c[1] - a[1]) * k, speed: pause ? 0.4 : 2 }; }
    d -= L;
  }
  return { x: 0, z: -10.5, speed: 2 };
}
function hjSay(text, ms = 7000) { hj.say(text, performance.now(), ms); }
function hjComeTo(seatIdx, ms = 9000) { const s = SEATS[seatIdx]; const side = s.x > 8 ? -1 : 1; hjVisit = { x: s.x + side * 1.2, z: s.z + 0.75, until: performance.now() + ms, face: -side * Math.PI / 2 }; }
async function hjGreet() { const r = await hunjang({ kind: 'welcome' }); hjSay(r.text); }
function tickHunjang(dt, now) {
  let st = hjRoute(Date.now() / 1000);
  if (hjVisit && now < hjVisit.until) st = { x: hjVisit.x, z: hjVisit.z, speed: 2.2, facing: hjVisit.face };
  else hjVisit = null;
  hj.update(dt, { ...st, seated: false, talk: !!hj.bubble }, now, camera.position);
}

// ---------------- 향 (타이머) ----------------
let lenChoice = 50;
[...$('lens').children].forEach((b) => b.onclick = () => {
  lenChoice = b.dataset.m === 'custom' ? 'custom' : Number(b.dataset.m);
  [...$('lens').children].forEach((x) => x.classList.toggle('on', x === b));
  $('len-custom').classList.toggle('hidden', lenChoice !== 'custom');
  if (lenChoice !== 'custom') $('sync').checked = false;
});
$('sync').onchange = () => { if ($('sync').checked) [...$('lens').children].forEach((x) => x.classList.remove('on')); };
function syncNote() {
  const b = bellPhase();
  $('sync-note').textContent = b.phase === 'study' ? `· 다음 종까지 ${Math.ceil(b.left / 60)}분` : `· 지금은 쉬는 시간 (${Math.ceil(b.left / 60)}분 뒤 시작)`;
}

function nearestFreeSeat() {
  if (!player || player.seat) return null;
  const taken = takenSeats(); avatars.forEach((a) => { if (a.seated && a.seatIdx !== undefined) taken.add(a.seatIdx); });
  let best = null, bd = 1.1;
  SEATS.forEach((s) => { if (taken.has(s.i)) return; const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z); if (d < bd) { bd = d; best = s; } });
  return best;
}
function sit(s) {
  me.seat = s.i; me.state = 'seat'; player.sitAt(s); pop();
  $('seat-label').textContent = `명륜당 ${s.row + 1}열 ${s.col + 1}번 자리`;
  $('goal').value = me.goal || '';
  showDock('goal-card'); syncNote();
  $('chatbar').classList.add('hidden');
  net?.update();
  if (!me.greeted) { me.greeted = true; hjComeTo(s.i, 7000); hjSay('자리 잡았구먼. 오늘 할 것 하나만 적고 향을 피우거라.'); }
}
function stand() {
  if (me.state === 'study') {
    const mins = Math.floor((Date.now() - me.startAt) / 60000);
    if (mins >= 5) { todayLog().push({ goal: me.goal, mins, at: me.startAt, full: false }); saveMem(); }
    hunjang({ kind: 'leave', goal: me.goal }).then((r) => hjSay(r.text));
  }
  setIncense(me.seat, null);
  me.seat = null; me.state = 'walk'; player.stand(); setFocus(false);
  showDock(null); $('chatbar').classList.remove('hidden');
  net?.update();
}
async function startIncense() {
  let mins;
  if ($('sync').checked) {
    const b = bellPhase();
    if (b.phase !== 'study' || b.left < 180) { toast('지금은 쉬는 시간이에요. 종이 울리면 다 같이 시작해요 · 다른 길이를 골라도 돼요'); return; }
    mins = b.left / 60; me.sync = true;
  } else { mins = lenChoice === 'custom' ? Math.max(1, Math.min(180, Number($('len-custom').value) || 25)) : lenChoice; me.sync = false; }
  me.goal = cleanChat($('goal').value || '오늘의 공부', 30) || '오늘의 공부';
  me.mins = Math.round(mins); me.startAt = Date.now(); me.endAt = me.startAt + mins * 60000; me.state = 'study';
  strike(); setIncense(me.seat, { start: me.startAt, end: me.endAt });
  $('f-goal').textContent = me.goal; showDock('focus-card');
  net?.update();
  hjComeTo(me.seat, 8000);
  const r = await hunjang({ kind: 'start', goal: me.goal, mins: me.mins });
  hjSay(r.text, 9000);
  toast('🪔 향을 피웠어요 · 다른 창으로 공부해도 시간은 계속 흘러요');
}
function finishIncense() {
  if (me.state !== 'study') return;
  me.state = 'seat';
  todayLog().push({ goal: me.goal, mins: me.mins, at: me.startAt, full: true }); saveMem();
  chime(); setIncense(me.seat, null); setFocus(false);
  net?.update(); net?.lantern({ name: me.name });
  flashLantern(true);
  $('done-sub').textContent = `${me.mins}분 · 오늘 ${me.done}번째 향`;
  $('done-say').textContent = '…';
  showDock('done-card');
  hunjang({ kind: 'done', goal: me.goal, mins: me.mins, count: me.done }).then((r) => { $('done-say').textContent = r.text; hjSay(r.text, 8000); });
  hjComeTo(me.seat, 9000);
  document.title = '🏮 향이 다 탔어요 · 온라인 성균관';
  try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('온라인 성균관', { body: `향이 다 탔어요 · ${me.goal}` }); } catch { /* 무시 */ }
}
$('start').onclick = startIncense;
$('goal').addEventListener('keydown', (e) => { if (e.key === 'Enter') startIncense(); });
$('stand').onclick = stand;
$('stop').onclick = stand;
$('again').onclick = () => { showDock('goal-card'); syncNote(); };
$('rest').onclick = () => { stand(); me.state = 'break'; net?.update(); hint('은행나무 아래에서 쉬어요 · 훈장님 곁에 가면 고민을 여쭐 수 있어요'); };

function showDock(id) { ['goal-card', 'focus-card', 'done-card'].forEach((k) => $(k).classList.toggle('hidden', k !== id)); }

// 책상 위 향: 모든 자리 (내 것 · 다른 사람 · NPC)
const incense = new Map(); // seatIdx -> { start, end }
function setIncense(i, v) { if (i === null || i === undefined) return; if (v) incense.set(i, v); else incense.delete(i); }
const smoke = { pts: null, list: [] };
{
  const n = 260, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  smoke.pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#e8e4dc', size: 0.09, map: softDot(), transparent: true, opacity: 0.35, depthWrite: false }));
  smoke.pts.frustumCulled = false; scene.add(smoke.pts);
  for (let k = 0; k < n; k++) smoke.list.push({ life: 0, x: 0, y: -99, z: 0, vx: 0 });
}
let smokeK = 0, smokeAcc = 0;
function tickIncense(dt, now) {
  // 다른 사람·NPC 공부 상태를 책상 향에 반영
  const live = new Map(incense);
  net?.peers.forEach((p) => { if (p.state === 'study' && p.seat != null) live.set(p.seat, { start: p.endAt - 50 * 60000, end: p.endAt }); });
  bots.forEach((b) => { if (b.state === 'study' && b.seat != null) live.set(b.seat, { start: Date.now() - (3000 - b.left) * 1000, end: Date.now() + b.left * 1000 }); });
  smokeAcc += dt;
  world.desks.forEach((d, i) => {
    const v = live.get(i);
    d.stick.visible = d.ember.visible = !!v;
    if (!v) return;
    const frac = THREE.MathUtils.clamp((v.end - Date.now()) / Math.max(1, v.end - v.start), 0.03, 1);
    d.stick.scale.y = frac;
    d.ember.position.set(0.34, 0.42 + 0.3 * frac, -0.08);
    d.ember.material.color.setHSL(0.06, 1, 0.5 + Math.sin(now / 200 + i) * 0.08);
    if (smokeAcc > 0.12 && camera.position.distanceTo(d.group.position) < 14) {
      const p = smoke.list[smokeK++ % smoke.list.length];
      const wp = d.group.localToWorld(d.ember.position.clone());
      Object.assign(p, { life: 3.2, x: wp.x, y: wp.y + 0.02, z: wp.z, vx: (Math.random() - 0.5) * 0.04 });
    }
  });
  if (smokeAcc > 0.12) smokeAcc = 0;
  const arr = smoke.pts.geometry.attributes.position.array;
  smoke.list.forEach((p, k) => {
    if (p.life > 0) { p.life -= dt; p.y += dt * 0.16; p.x += Math.sin(now / 600 + k) * dt * 0.03 + p.vx * dt; }
    arr[k * 3] = p.x; arr[k * 3 + 1] = p.life > 0 ? p.y : -99; arr[k * 3 + 2] = p.z;
  });
  smoke.pts.geometry.attributes.position.needsUpdate = true;
}

// ---------------- 등불 (모두의 공부가 쌓이는 세계 상태) ----------------
function litCount() {
  let n = me.done;
  net?.peers.forEach((p) => { n += Number(p.done) || 0; });
  const botDone = bots.reduce((s, b) => s + (b.done || 0), 0);
  return n + Math.floor(botDone * 0.25);
}
const sparks = [];
function flashLantern(mine) {
  const idx = Math.min(world.lanterns.length - 1, litCount());
  const l = world.lanterns[Math.max(0, idx - 1)] || world.lanterns[0];
  const pos = l.getWorldPosition(new THREE.Vector3());
  const n = 50, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { p.set([pos.x, pos.y, pos.z], i * 3); v.push(new THREE.Vector3().randomDirection().multiplyScalar(0.8 + Math.random() * 1.6)); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffc24a', size: 0.22, map: softDot(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(pts); sparks.push({ pts, v, life: 1.6 });
  if (mine) toast('🏮 내 향으로 마당에 등불 하나가 켜졌어요');
}
function tickSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.life -= dt;
    const a = s.pts.geometry.attributes.position;
    s.v.forEach((v, k) => { a.setXYZ(k, a.getX(k) + v.x * dt, a.getY(k) + v.y * dt, a.getZ(k) + v.z * dt); v.y -= dt * 1.2; });
    a.needsUpdate = true; s.pts.material.opacity = Math.max(0, s.life / 1.6);
    if (s.life <= 0) { scene.remove(s.pts); sparks.splice(i, 1); }
  }
}

// ---------------- 종 (정각 공용 리듬) ----------------
let lastPhase = bellPhase().phase;
function tickBell() {
  const b = bellPhase();
  const pill = $('bell-pill');
  pill.textContent = b.phase === 'study' ? `🔔 다 같이 공부 · 쉬는 종까지 ${fmt(b.left)}` : `🍵 다 같이 쉬는 시간 · ${fmt(b.left)}`;
  pill.classList.toggle('break', b.phase === 'break');
  if (b.phase !== lastPhase) {
    lastPhase = b.phase;
    bellSound(); world.ringBell();
    if (b.phase === 'break') toast('🔔 쉬는 종이 울렸어요 · 마당에 나와 바람 쐬어요', 5000);
    else toast('🔔 공부 종이 울렸어요 · 다 같이 다시 앉아요', 5000);
  }
  if (!$('goal-card').classList.contains('hidden')) syncNote();
}

// ---------------- 내 타이머 표시 ----------------
function tickMyTimer() {
  if (me.state !== 'study') { if (!document.title.startsWith('🏮')) document.title = '온라인 성균관 2030'; return; }
  const left = (me.endAt - Date.now()) / 1000;
  if (left <= 0) { finishIncense(); return; }
  $('f-time').textContent = fmt(left);
  const frac = left / (me.mins * 60);
  $('ring-fg').style.strokeDashoffset = String(326.7 * (1 - frac));
  document.title = `🪔 ${fmt(left)} · ${me.goal}`;
}
// 다른 창에 있어도 1초마다 확인 (화면은 멈춰도 시간·종은 흐름)
setInterval(() => { if (!entered) return; tickMyTimer(); tickBell(); }, 1000);

// ---------------- 집중 모드 ----------------
let focusOn = false, lowPower = mem.lowPower !== false;
function setFocus(v) {
  focusOn = v; player && (player.focus = v); if (player) player.freeLook = false;
  document.body.classList.toggle('focusing', v);
  $('focus-btn').textContent = v ? '☀️ 집중 모드 끄기' : '🌙 집중 모드';
  if (v) hint('집중 모드 · 화면을 아주 느리게 그려 배터리를 아껴요. 시간과 종은 그대로 흘러요', 6000);
}
$('focus-btn').onclick = () => setFocus(!focusOn);
$('low-power').checked = lowPower;
$('low-power').onchange = (e) => { lowPower = e.target.checked; mem.lowPower = lowPower; saveMem(); };

// ---------------- 대화 (쉬는 시간) ----------------
$('chatbar').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = cleanChat($('chat').value); if (!t) return;
  $('chat').value = '';
  player.say(t, performance.now()); net?.say(t);
});

// ---------------- 훈장님께 여쭙기 ----------------
const askHist = [];
function openAsk() { $('ask-panel').classList.remove('hidden'); if (!askHist.length) addAsk(false, '무엇이 마음에 걸리는가? 공부 이야기라면 무엇이든 말해 보게.'); setTimeout(() => $('ask-in').focus(), 50); }
function addAsk(isMe, text, cls = '') { const d = document.createElement('div'); d.className = `msg ${isMe ? 'me' : 'bot'} ${cls}`; d.textContent = text; $('ask-log').appendChild(d); $('ask-log').scrollTop = 1e6; return d; }
async function ask(q) {
  q = cleanChat(q, 120); if (!q) return;
  addAsk(true, q); askHist.push({ me: true, text: q });
  const d = addAsk(false, '허허…', 'typing');
  const r = await hunjang({ kind: 'ask', question: q, goal: me.goal, history: askHist });
  d.classList.remove('typing'); d.textContent = r.text; askHist.push({ me: false, text: r.text });
  hjSay(r.text, 8000);
}
$('ask-form').addEventListener('submit', (e) => { e.preventDefault(); const q = $('ask-in').value; $('ask-in').value = ''; ask(q); });
[...$('ask-chips').children].forEach((b) => b.onclick = () => ask(b.textContent));
$('ask-close').onclick = () => $('ask-panel').classList.add('hidden');

// ---------------- 계절·날씨 프롬프트 ----------------
const modal = (id, v) => $(id).classList.toggle('hidden', !v);
document.querySelectorAll('.overlay .x').forEach((b) => b.onclick = () => b.closest('.overlay').classList.add('hidden'));
$('season-btn').onclick = () => { modal('season-modal', true); setTimeout(() => $('season-in').focus(), 50); };
async function requestTheme(prompt) {
  prompt = cleanChat(prompt, 40); if (!prompt) return;
  modal('season-modal', false); toast('🍃 하늘에 부탁하는 중…');
  const t = await makeTheme(prompt);
  themeUntil = Date.now() + 10 * 60000;
  applyTheme(t);
  toast(`풍경이 바뀌었어요 · ${t.title}`);
  if (t.line) hjSay(t.line);
  net?.theme({ ...t, until: themeUntil, by: me.id }); net?.update();
}
$('season-form').addEventListener('submit', (e) => { e.preventDefault(); requestTheme($('season-in').value); $('season-in').value = ''; });
document.querySelectorAll('#season-modal .chips button').forEach((b) => b.onclick = () => requestTheme(b.textContent));
$('season-reset').onclick = () => { themeUntil = 0; applyTheme(realTheme()); modal('season-modal', false); net?.update(); };

// ---------------- 일과 두루마리 ----------------
$('journal-btn').onclick = () => { drawJournal(); modal('journal-modal', true); };
async function drawJournal(comment) {
  const c = $('journal-canvas'), g = c.getContext('2d'), W = c.width, H = c.height;
  const list = todayLog();
  const total = list.reduce((s, x) => s + x.mins, 0);
  g.fillStyle = '#f3ead6'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(150,120,80,${Math.random() * 0.06})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.fillStyle = '#6b3a24'; g.fillRect(0, 0, W, 36); g.fillRect(0, H - 36, W, 36);
  g.strokeStyle = '#a8823a'; g.lineWidth = 3; g.strokeRect(46, 70, W - 92, H - 140);
  const serif = '"Noto Serif KR","Nanum Myeongjo","Batang",serif';
  g.fillStyle = '#2a201a'; g.textAlign = 'center';
  g.font = `800 64px ${serif}`; g.fillText('일과 두루마리', W / 2, 170);
  const { day } = kst();
  g.font = `600 30px ${serif}`; g.fillStyle = '#6b5a44'; g.fillText(`${day.replace(/-/g, '. ')} · ${me.name}`, W / 2, 222);
  g.textAlign = 'left'; g.fillStyle = '#2a201a';
  let y = 310;
  if (!list.length) { g.font = `600 32px ${serif}`; g.fillStyle = '#6b5a44'; g.fillText('아직 피운 향이 없어요. 오늘의 첫 향을 피워보세요.', 100, y); y += 60; }
  list.slice(-10).forEach((s, i) => {
    const t = new Date(s.at + 9 * 3600000).toISOString().slice(11, 16);
    g.font = `800 30px ${serif}`; g.fillStyle = s.full ? '#b8862a' : '#9a8a74'; g.fillText(s.full ? '🪔' : '·', 96, y);
    g.fillStyle = '#2a201a'; g.font = `700 32px ${serif}`; g.fillText(`${t}  ${s.goal}`.slice(0, 26), 146, y);
    g.font = `600 28px ${serif}`; g.fillStyle = '#6b5a44'; g.textAlign = 'right'; g.fillText(`${s.mins}분${s.full ? '' : ' (중간에 일어남)'}`, W - 100, y); g.textAlign = 'left';
    g.strokeStyle = 'rgba(120,90,50,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(96, y + 24); g.lineTo(W - 96, y + 24); g.stroke();
    y += 66 + (i === 0 ? 0 : 0);
  });
  y = Math.max(y + 20, 880);
  g.textAlign = 'center'; g.fillStyle = '#2a201a'; g.font = `800 44px ${serif}`;
  g.fillText(`오늘 ${Math.floor(total / 60)}시간 ${total % 60}분 · 등불 ${me.done}개`, W / 2, y);
  g.font = `600 30px ${serif}`; g.fillStyle = '#7a4a24';
  const say = comment || (list.length ? '훈장님이 읽는 중…' : '앉아 있는 것부터가 공부니라.');
  wrapText(g, `훈장님 : ${say}`, W / 2, y + 74, W - 200, 44);
  // 낙관(도장)
  g.fillStyle = '#c92a2a'; g.fillRect(W - 190, H - 200, 96, 96); g.fillStyle = '#f3ead6'; g.font = `800 34px ${serif}`; g.fillText('成均', W - 142, H - 160); g.fillText('館', W - 142, H - 120);
  $('journal-dl').href = c.toDataURL('image/png');
  if (!comment && list.length) { const r = await hunjang({ kind: 'journal', sessions: list }); drawJournal(r.text); }
}
function wrapText(g, text, x, y, maxW, lh) { let line = ''; for (const ch of text) { if (g.measureText(line + ch).width > maxW) { g.fillText(line, x, y); y += lh; line = ch; } else line += ch; } g.fillText(line, x, y); }

// ---------------- 설정 ----------------
$('settings-btn').onclick = () => modal('settings-modal', true);
$('vol-amb').value = VOL.amb; $('vol-sfx').value = VOL.sfx;
$('vol-amb').oninput = (e) => setVolume('amb', Number(e.target.value));
$('vol-sfx').oninput = (e) => setVolume('sfx', Number(e.target.value));
$('snd').onclick = () => { startAudio(); $('snd').textContent = toggleSound() ? '🔊' : '🔇'; };

// ---------------- 행동 버튼 (앉기 / 여쭙기) ----------------
let actionKind = null;
function tickAction() {
  if (!player) return;
  let kind = null, label = '';
  if (!player.seat) {
    const s = nearestFreeSeat();
    const dh = Math.hypot(player.pos.x - hj.group.position.x, player.pos.z - hj.group.position.z);
    if (s) { kind = 'sit'; label = '🪷 방석에 앉기 (E)'; }
    else if (dh < 2.4) { kind = 'ask'; label = '🙇 훈장님께 여쭙기 (E)'; }
  }
  if (kind !== actionKind) { actionKind = kind; $('action').classList.toggle('hidden', !kind); $('action').textContent = label; }
}
function doAction() { if (actionKind === 'sit') { const s = nearestFreeSeat(); if (s) sit(s); } else if (actionKind === 'ask') openAsk(); }
$('action').onclick = doAction;
addEventListener('keydown', (e) => { if (!entered || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return; if (e.code === 'KeyE' || e.code === 'Space') { doAction(); e.preventDefault(); } });

// ---------------- 루프 ----------------
const clock = new THREE.Clock();
let lastMove = 0, lastRender = 0, intro = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()); const now = performance.now();
  // 집중 모드 + 배터리 절약: 움직임이 없으면 초당 4번만 그림
  if (focusOn && lowPower && now - (input?.activity || 0) > 2500 && now - lastRender < 250) return;
  const rdt = Math.min(0.25, (now - lastRender) / 1000 || dt); lastRender = now;
  if (!entered) { // 입학 화면 뒤 천천히 도는 카메라
    intro += rdt * 0.05;
    camera.position.set(Math.sin(intro) * 13, 10 + Math.sin(intro * 0.7) * 1.5, 1 + Math.cos(intro) * 13);
    camera.lookAt(0, 2.5, -6);
  } else {
    player.update(rdt, input.poll(), camera, now);
    if (!player.seat && now - lastMove > 100 && player.walking) { lastMove = now; net?.move(player.pos.x, player.pos.z); }
    tickAction();
  }
  syncAvatars(rdt, now);
  tickHunjang(rdt, now);
  tickIncense(rdt, now);
  tickSparks(rdt);
  world.setLit(litCount());
  world.update(rdt, now, camera.position);
  world.tickBell(rdt);
  tickAmbience(rdt);
  if (themeUntil && Date.now() > themeUntil && !theme.real) { themeUntil = 0; applyTheme(realTheme()); toast('풍경이 지금 실제 계절·시각으로 돌아왔어요'); }
  $('lantern-pill').textContent = `🏮 오늘 함께 밝힌 등불 ${Math.min(world.LANTERN_COUNT, litCount())}/${world.LANTERN_COUNT}`;
  composer.render();
}
tickBell();
frame();

// 디버그·테스트용
window.__sgk = { me, world, theme: () => theme, applyTheme, finishIncense, startIncense, sit: (i) => sit(SEATS[i]), stand, setFocus, player: () => player, bots: () => bots, requestTheme, litCount, drawJournal, ask, SEASONS };
