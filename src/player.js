// 내 유생 캐릭터(3인칭) · 다른 유생(원격·NPC) · 입력
import * as THREE from 'three';
import { makeCharacter, animateCharacter, nameSprite, bubbleSprite } from './character.js';
import { walkable, heightAt, COLLIDERS, BOXES, FLOOR_Y, PAVILION } from './scene.js';
import { addCup } from './character.js';

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const SIT_DROP = 0.3; // 바닥(방석)에 앉을 때 몸을 내리는 양

function say(self, text, now, dur = 6000) {
  if (self.bubble) self.group.remove(self.bubble);
  self.bubble = bubbleSprite(text); self.bubble.position.y = 2.1; self.group.add(self.bubble);
  self.bubbleUntil = now + dur;
}
function tickBubble(self, now) { if (self.bubble && now > self.bubbleUntil) { self.group.remove(self.bubble); self.bubble = null; } }

// 머리 위 작은 상태표 (목표 · 남은 향)
export function statusSprite(text, color = 'rgba(30,24,20,0.62)') {
  return nameSprite(text, { bg: color, fg: '#fff3dc', scale: 0.78 });
}

export class Player {
  constructor(scene, look, name) {
    this.scene = scene; this.name = name;
    this.group = new THREE.Group(); scene.add(this.group);
    this.setLook(look);
    this.pos = this.group.position; this.pos.set(0, 0, 12.5);
    this.facing = Math.PI; this.phase = 0; this.walking = false; this.seat = null; this.wave = 0;
    this.yaw = 0; this.pitch = 0.32; this.dist = 6.5; this.focus = false;
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 8), new THREE.MeshBasicMaterial({ color: '#ffd23f', toneMapped: false }));
    this.marker.rotation.x = Math.PI; scene.add(this.marker);
  }
  setLook(look) {
    this.look = look;
    if (this.body) this.group.remove(this.body);
    this.body = makeCharacter(look); addCup(this.body); this.group.add(this.body); this.group.rotation.order = 'YXZ';
    if (this.tag) this.group.remove(this.tag);
    this.tag = nameSprite(this.name, { bg: 'rgba(255,196,90,0.88)', fg: '#2a1800', scale: 0.85 });
    this.tag.position.y = 1.95; this.group.add(this.tag);
  }
  say(text, now, dur) { say(this, text, now, dur); }
  resolveCollisions() {
    const R = 0.3, p = this.pos;
    for (let it = 0; it < 2; it++) {
      [...COLLIDERS, ...(this.extra ? this.extra() : [])].forEach((c) => {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + R;
        if (d < min) {
          const ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0;
          const nx = c.x + ux * min, nz = c.z + uz * min;
          if (walkable(nx, nz)) { p.x = nx; p.z = nz; } else if (walkable(nx, p.z)) p.x = nx; else if (walkable(p.x, nz)) p.z = nz;
        }
      });
      BOXES.forEach((b) => {
        const ox = b.hx + R - Math.abs(p.x - b.x), oz = b.hz + R - Math.abs(p.z - b.z);
        if (ox > 0 && oz > 0) {
          if (oz < ox) { const nz = b.z + Math.sign(p.z - b.z || 1) * (b.hz + R); if (walkable(p.x, nz)) p.z = nz; }
          else { const nx = b.x + Math.sign(p.x - b.x || 1) * (b.hx + R); if (walkable(nx, p.z)) p.x = nx; }
        }
      });
    }
  }
  // seat: { x, z, y?, facing?, kind: 'hall' | 'tea' }
  sitAt(seat) { this.bed = null; this.seat = seat; this.pos.set(seat.x, 0, seat.z); this.facing = seat.facing ?? 0; this.group.rotation.y = this.facing; this.freeLook = false; }
  sleepAt(bed) { this.seat = null; this.bed = bed; this.freeLook = false; this.pos.set(bed.footX, bed.y + 0.24, bed.z); }
  stand() {
    const s = this.seat, b = this.bed;
    if (b) { this.bed = null; this.pos.set(b.door.x, 0, b.door.z); this.facing = b.s > 0 ? -Math.PI / 2 : Math.PI / 2; }
    else if (s && s.kind === 'tea') { this.seat = null; this.pos.set(PAVILION.x - 2.6, 0, PAVILION.z + (s.z - PAVILION.z) * 0.6); this.facing = -Math.PI / 2; }
    else if (s) { this.seat = null; this.pos.set(s.x, 0, s.z - 0.75); }
    this.focus = false; this.hold = false;
    this.group.rotation.x = 0;
  }
  update(dt, input, camera, now) {
    let mx = input.x, mz = input.y;
    const len = Math.hypot(mx, mz);
    this.walking = false;
    if (!this.seat && !this.bed && len > 0.05) {
      mx /= Math.max(1, len); mz /= Math.max(1, len);
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const dir = fwd.multiplyScalar(mz).add(right.multiplyScalar(mx));
      const sp = (input.run ? 6 : 3.3) * Math.min(1, len);
      const nx = this.pos.x + dir.x * sp * dt, nz = this.pos.z + dir.z * sp * dt;
      if (walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
      else if (walkable(nx, this.pos.z)) this.pos.x = nx;
      else if (walkable(this.pos.x, nz)) this.pos.z = nz;
      this.facing = Math.atan2(dir.x, dir.z); this.walking = true;
      this.phase += dt * (input.run ? 12 : 8.5);
    }
    if (!this.seat && !this.bed) this.resolveCollisions();
    const gy = heightAt(this.pos.x, this.pos.z);
    const wantY = this.bed ? this.bed.y + 0.24 : this.seat ? (this.seat.y ?? FLOOR_Y) - SIT_DROP : gy;
    this.pos.y += (wantY - this.pos.y) * Math.min(1, dt * 14);
    if (this.bed) { this.group.rotation.set(-Math.PI / 2, this.bed.yaw, 0); }
    else {
      this.group.rotation.x = 0;
      const cur = this.group.rotation.y;
      this.group.rotation.y = cur + wrap(this.facing - cur) * Math.min(1, dt * 10);
    }
    if (this.wave > 0) this.wave -= dt;
    animateCharacter(this.body, { walking: this.walking, phase: this.phase, seated: !!this.seat, wave: this.wave > 0, talk: this.reading, hold: this.hold, lie: !!this.bed }, now);
    this.marker.position.set(this.pos.x, this.pos.y + 2.2 + Math.sin(now / 250) * 0.05, this.pos.z);
    this.marker.visible = !this.seat && !this.bed;
    this.body.visible = !(this.seat && this.focus && !this.freeLook); // 집중 모드: 내 눈으로 책상을 봄
    this.tag.visible = !this.seat && !this.bed;
    tickBubble(this, now);

    // 카메라: 앉으면 어깨 너머로 책상과 마당이 보이게
    // 날씨가 바뀌면 잠깐 하늘을 올려다봄
    if (this.skyUntil && now < this.skyUntil) { this.pitch += (-0.12 - this.pitch) * Math.min(1, dt * 2); this.dist += (8 - this.dist) * Math.min(1, dt * 2); }
    else if (this.skyUntil) { this.skyUntil = 0; this.pitch = this.savedPitch ?? 0.32; this.dist = this.savedDist ?? 6.5; }
    const sf = this.seat ? (this.seat.facing ?? 0) : 0;
    const sdir = new THREE.Vector3(Math.sin(sf), 0, Math.cos(sf));
    if ((this.seat || this.bed) && !this.freeLook && !this.skyUntil) {
      const want = this.bed ? { yaw: -this.bed.s * Math.PI / 2 - 0.25, pitch: 0.5, dist: 2.7 }
        : this.focus ? { yaw: sf + Math.PI, pitch: 0.72, dist: 1.55 }
        : this.seat.kind === 'tea' ? { yaw: sf + Math.PI + 0.95, pitch: 0.34, dist: 2.7 } : { yaw: sf + Math.PI + 0.5, pitch: 0.55, dist: 3.4 };
      this.yaw += wrap(want.yaw - this.yaw) * Math.min(1, dt * 2.5);
      this.pitch += (want.pitch - this.pitch) * Math.min(1, dt * 2);
      this.dist += (want.dist - this.dist) * Math.min(1, dt * 2);
    }
    const sy = this.seat ? (this.seat.y ?? FLOOR_Y) : 0;
    const target = this.bed ? new THREE.Vector3(this.bed.x, this.bed.y + 0.3, this.bed.z)
      : this.seat
        ? (this.focus ? new THREE.Vector3(this.pos.x, sy + 0.37, this.pos.z).addScaledVector(sdir, 0.95) : (this.seat.kind === 'tea' ? new THREE.Vector3(PAVILION.x, sy + 0.75, PAVILION.z) : new THREE.Vector3(this.pos.x, sy + 0.9, this.pos.z).addScaledVector(sdir, 1.7)))
        : new THREE.Vector3(this.pos.x, this.pos.y + 1.3, this.pos.z);
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.dist);
    const cam = target.clone().add(off);
    cam.y = Math.max(cam.y, heightAt(cam.x, cam.z) + 0.4);
    // 명륜당 안에서는 뒷벽·지붕을 뚫지 않게
    if (Math.abs(cam.x) < 11 && cam.z < -9) { cam.z = Math.max(cam.z, -17.3); cam.y = Math.min(cam.y, FLOOR_Y + 2.9); }
    cam.z = Math.min(cam.z, 15.2); cam.x = THREE.MathUtils.clamp(cam.x, -18.6, 18.6);
    camera.position.lerp(cam, Math.min(1, dt * 7));
    camera.lookAt(target);
  }
}

// ---------------- 다른 유생 (실제 접속자 · NPC · 훈장님) ----------------
export class Avatar {
  constructor(scene, { look, name, bot, tagColor }) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.scene = scene; this.lookKey = ''; this.tagColor = tagColor;
    this.setLook(look, name, bot);
    this.phase = Math.random() * 10; this.target = new THREE.Vector3(); this.facing = 0; this.statusKey = '';
  }
  setLook(look, name, bot) {
    const key = JSON.stringify(look) + name;
    if (key === this.lookKey) return;
    this.lookKey = key; this.name = name;
    if (this.body) this.group.remove(this.body);
    if (this.tag) this.group.remove(this.tag);
    this.body = makeCharacter(look); addCup(this.body); this.group.add(this.body); this.group.rotation.order = 'YXZ';
    this.tag = nameSprite(name, { bg: this.tagColor || (bot ? 'rgba(40,36,48,0.55)' : 'rgba(20,16,40,0.78)'), scale: 0.78 });
    this.tag.position.y = 1.92; this.group.add(this.tag);
  }
  setStatus(text) {
    if ((text || '') === this.statusKey) return;
    this.statusKey = text || '';
    if (this.status) { this.group.remove(this.status); this.status = null; }
    if (text) { this.status = statusSprite(text); this.status.position.y = 2.22; this.group.add(this.status); }
  }
  say(text, now, dur) { say(this, text, now, dur); }
  // st: { x, z, seated, facing?, wave, talk, read }
  update(dt, st, now, camPos) {
    tickBubble(this, now);
    if (camPos) {
      const d = camPos.distanceTo(this.group.position);
      const o = THREE.MathUtils.clamp(d < 3.8 ? 0 : d < 5 ? (d - 3.8) / 1.2 : 1 - (d - 16) / 10, 0, 1);
      this.tag.material.opacity = o; if (this.status) this.status.material.opacity = o;
    }
    if (st.lie) { // 이부자리에 누움
      this.group.position.set(st.lie.footX, st.lie.y + 0.24, st.lie.z);
      this.group.rotation.set(-Math.PI / 2, st.lie.yaw, 0);
      animateCharacter(this.body, { lie: true }, now);
      this.tag.visible = false; if (this.status) this.status.position.set(0, 1.0, 0.75);
      return;
    }
    this.tag.visible = true; if (this.status) this.status.position.set(0, 2.22, 0);
    this.group.rotation.x = 0;
    const y = st.seated ? (st.sitY ?? FLOOR_Y) - SIT_DROP : heightAt(st.x, st.z);
    this.target.set(st.x, y, st.z);
    const dxz = Math.hypot(this.target.x - this.group.position.x, this.target.z - this.group.position.z);
    const walking = !st.seated && dxz > 0.04;
    if (dxz > 8) this.group.position.copy(this.target);
    else { const k = Math.min(1, dt * (st.speed || 6)); this.group.position.x += (this.target.x - this.group.position.x) * k; this.group.position.z += (this.target.z - this.group.position.z) * k; this.group.position.y += (y - this.group.position.y) * Math.min(1, dt * 10); }
    if (walking) { this.phase += dt * 8.5; this.facing = Math.atan2(this.target.x - this.group.position.x, this.target.z - this.group.position.z); }
    if (st.seated) this.facing = st.facing ?? 0; else if (st.facing !== undefined && !walking) this.facing = st.facing;
    const cur = this.group.rotation.y;
    this.group.rotation.y = cur + wrap(this.facing - cur) * Math.min(1, dt * 8);
    animateCharacter(this.body, { walking, phase: this.phase, seated: st.seated, wave: st.wave, talk: st.talk, hold: st.hold }, now);
    if (st.read && st.seated) { const p = this.body.userData.parts; p.head.rotation.x = 0.28 + Math.sin(now / 1400 + this.phase) * 0.06; }
    else if (this.body.userData.parts) this.body.userData.parts.head.rotation.x = 0;
  }
  dispose() { this.scene.remove(this.group); }
}

// ---------------- 입력 ----------------
export function createInput(canvas, player) {
  const keys = new Set();
  const input = { x: 0, y: 0, run: false, joy: { x: 0, y: 0 }, activity: 0 };
  const typing = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
  const poke = () => { input.activity = performance.now(); };
  window.addEventListener('keydown', (e) => { if (!typing(e)) keys.add(e.code); poke(); });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; poke(); });
  window.addEventListener('pointermove', (e) => {
    poke();
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    player.yaw -= dx * 0.006; if (player.seat && drag.moved > 20) player.freeLook = true;
    player.pitch = THREE.MathUtils.clamp(player.pitch + dy * 0.004, -0.4, 1.2); player.skyUntil = 0;
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { player.dist = THREE.MathUtils.clamp(player.dist + e.deltaY * 0.01, 2, 16); poke(); e.preventDefault(); }, { passive: false });

  const pad = document.getElementById('joy'), knob = document.getElementById('joy-knob');
  let jid = null, jc = null;
  const moveJoy = (e) => {
    if (e.pointerId !== jid) return;
    let dx = e.clientX - jc.x, dy = e.clientY - jc.y;
    const l = Math.hypot(dx, dy), m = jc.R * 0.8;
    if (l > m) { dx *= m / l; dy *= m / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.joy.x = dx / m; input.joy.y = -dy / m; poke();
  };
  pad.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); jid = e.pointerId; const r = pad.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2, R: r.width / 2 }; pad.setPointerCapture(jid); moveJoy(e); });
  pad.addEventListener('pointermove', moveJoy);
  const endJoy = (e) => { if (e.pointerId !== jid) return; jid = null; input.joy.x = input.joy.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', endJoy); pad.addEventListener('pointercancel', endJoy);

  input.poll = () => {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    input.x = x || input.joy.x; input.y = y || input.joy.y;
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(input.joy.x, input.joy.y) > 0.95;
    return input;
  };
  return input;
}

// 하늘 보기: 잠깐 고개를 들었다가 원래대로
Player.prototype.lookUp = function (ms = 5000) { if (!this.skyUntil) { this.savedPitch = this.pitch; this.savedDist = this.dist; } this.skyUntil = performance.now() + ms; };
