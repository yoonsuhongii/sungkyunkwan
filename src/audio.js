// 서원 소리: 바람·새소리(낮)·풀벌레(밤)·빗소리 + 종소리·향 다 탄 풍경소리 — 파일 없이 WebAudio 합성
let ac = null, master = null, ambBus = null, sfxBus = null, windG = null, rainG = null, on = true;
export const VOL = { amb: 0.55, sfx: 0.8 };
let night = 0, rain = 0, birdT = 0, bugT = 0;

function noiseBuf(sec, brown) {
  const len = ac.sampleRate * sec, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w; }
  return b;
}
export function startAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.85; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = VOL.sfx; sfxBus.connect(master);
    ambBus = ac.createGain(); ambBus.gain.value = VOL.amb; ambBus.connect(master);
    const wind = ac.createBufferSource(); wind.buffer = noiseBuf(5, true); wind.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    windG = ac.createGain(); windG.gain.value = 0.18; wind.connect(lp).connect(windG).connect(ambBus); wind.start();
    const r = ac.createBufferSource(); r.buffer = noiseBuf(3, false); r.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.4;
    rainG = ac.createGain(); rainG.gain.value = 0; r.connect(bp).connect(rainG).connect(ambBus); r.start();
  } catch { ac = null; }
}
export function setAmbience({ night: n = 0, rain: r = 0, wind: w = 0 } = {}) {
  night = n; rain = r;
  if (!ac) return;
  rainG.gain.setTargetAtTime(r * 0.16, ac.currentTime, 1);
  windG.gain.setTargetAtTime(0.12 + r * 0.06 + w * 0.35, ac.currentTime, 1);
}
// 새소리·풀벌레는 가끔씩 (메인 루프에서 호출)
export function tickAmbience(dt) {
  if (!ac || !on || ac.state !== 'running') return;
  birdT -= dt; bugT -= dt;
  if (night < 0.5 && rain < 0.5 && birdT < 0) { birdT = 3 + Math.random() * 7; chirp(); }
  if (night > 0.5 && bugT < 0) { bugT = 0.6 + Math.random() * 1.6; cricket(); }
}
function chirp() {
  const t = ac.currentTime, f = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = t + i * 0.13;
    o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.06);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.025, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    o.connect(g).connect(ambBus); o.start(t0); o.stop(t0 + 0.1);
  }
}
function cricket() {
  const t = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = t + i * 0.07;
    o.frequency.value = 4400 + Math.random() * 200;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.012, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    o.connect(g).connect(ambBus); o.start(t0); o.stop(t0 + 0.06);
  }
}
// 정각 종: 낮고 길게 울리는 범종 느낌 (배음 여러 개)
export function bell() {
  if (!ac || !on) return;
  const t = ac.currentTime;
  [[98, 0.3, 7], [196, 0.16, 5], [247, 0.08, 4], [294, 0.07, 3.5], [392, 0.05, 2.5], [523, 0.03, 1.6]].forEach(([f, v, d]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 1.2; lg.gain.value = v * 0.3; lfo.connect(lg).connect(g.gain); lfo.start(t); lfo.stop(t + d);
    o.connect(g).connect(sfxBus); o.start(t); o.stop(t + d + 0.1);
  });
  const s = ac.createBufferSource(); s.buffer = noiseBuf(0.15, true); const g = ac.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); s.connect(g).connect(sfxBus); s.start(t);
}
// 향이 다 탔을 때: 풍경 소리
export function chime() {
  if (!ac || !on) return;
  const t = ac.currentTime;
  [1568, 2093, 2637].forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = t + i * 0.18;
    o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    o.connect(g).connect(sfxBus); o.start(t0); o.stop(t0 + 2.3);
  });
}
// 향 피우기: 성냥 '칙' + 작은 딸깍
export function strike() {
  if (!ac || !on) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = noiseBuf(0.35, false);
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200;
  const g = ac.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  s.connect(bp).connect(g).connect(sfxBus); s.start(t);
}
export function pop() {
  if (!ac || !on) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(660, t); o.frequency.exponentialRampToValueAtTime(990, t + 0.08);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g).connect(sfxBus); o.start(t); o.stop(t + 0.3);
}
export function setVolume(kind, v) { VOL[kind] = v; if (!ac) return; (kind === 'amb' ? ambBus : sfxBus).gain.setTargetAtTime(v, ac.currentTime, 0.1); }
export function isOn() { return on; }
export function toggleSound() { on = !on; if (master) master.gain.setTargetAtTime(on ? 0.85 : 0, ac.currentTime, 0.1); return on; }

// ---------------- 알람 예약 ----------------
// 오디오 시계에 미리 예약해 두므로, 다른 탭에 있어도 정확한 시각에 울림 (휴대폰 화면이 꺼지면 멈출 수 있음)
export function scheduleAlarm(atMs, kind = 'nap') {
  if (!ac) return { cancel() {} };
  const out = ac.createGain(); out.gain.value = 1; out.connect(master);
  const t0 = ac.currentTime + Math.max(0.05, (atMs - Date.now()) / 1000);
  const note = (t, f, d, v, type = 'sine') => {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
  };
  if (kind === 'nap') {
    // 낮잠 알람: 맑은 풍경 멜로디가 점점 커지며 30초 동안 반복 (일어나기를 누르면 멈춤)
    const mel = [784, 988, 1175, 988, 1319, 1175];
    for (let r = 0; r < 12; r++) {
      const v = Math.min(0.16, 0.05 + r * 0.012), t = t0 + r * 2.6;
      mel.forEach((f, i) => note(t + i * 0.22, f, 1.2, v, 'triangle'));
      note(t, 196, 1.8, v * 0.8);
    }
  } else {
    // 향이 다 탐: 풍경 + 종 한 번씩, 3번
    for (let r = 0; r < 3; r++) {
      const t = t0 + r * 3.2;
      [1568, 2093, 2637].forEach((f, i) => note(t + i * 0.18, f, 2.2, 0.08));
      [[98, 0.22, 5], [196, 0.12, 4], [294, 0.06, 3]].forEach(([f, v, d]) => note(t + 0.6, f, d, v));
    }
  }
  return { cancel() { try { out.gain.setValueAtTime(0, ac.currentTime); out.disconnect(); } catch { /* 이미 끝남 */ } } };
}

// 천둥: 낮게 우르릉 (거리에 따라 늦고 작게)
export function thunder(delaySec = 0.6, power = 1) {
  if (!ac || !on) return;
  const t = ac.currentTime + delaySec;
  const s = ac.createBufferSource(); s.buffer = noiseBuf(4, true);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + 3);
  const g = ac.createGain(); const v = 0.9 * power;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.06);
  g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.5); g.gain.linearRampToValueAtTime(v * 0.6, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
  s.connect(lp).connect(g).connect(sfxBus); s.start(t); s.stop(t + 4);
}
