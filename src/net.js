// 실시간 멀티플레이 (Supabase Realtime: Presence + Broadcast) + 모두에게 똑같이 보이는 NPC 유생
import { createClient } from '@supabase/supabase-js';
import { randomScholar, scholarName } from './character.js';
import { SEATS, BREAK_SPOTS, TEA_SEATS, BEDS } from './scene.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const CAPACITY = 24;
export const ONLINE_CAPABLE = !!(URL && KEY);

export function connect(me, { onPeers, onStatus, onSay, onTheme, onLantern }) {
  const peers = new Map();
  let channel = null, alive = true, lastTrack = 0, pending = null, roomNo = 1, lastKey = '', retry = 0;
  const noop = { peers, update() {}, move() {}, say() {}, npcSay() {}, theme() {}, lantern() {}, close() {}, room: () => 0 };
  if (!ONLINE_CAPABLE) { onStatus({ online: false, room: 0 }); return noop; }
  const client = createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 20 } } });

  function join(n) {
    roomNo = n;
    channel = client.channel(`sgk2030-${n}`, { config: { presence: { key: me.id }, broadcast: { self: false } } });
    let checked = false;
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = Object.keys(state);
        if (!checked) {
          checked = true;
          if (ids.length > CAPACITY) {
            const order = ids.map((id) => ({ id, at: state[id][0]?.online_at || 0 })).sort((a, b) => a.at - b.at);
            if (order.findIndex((o) => o.id === me.id) >= CAPACITY) { channel.__moving = true; channel.unsubscribe(); join(n + 1); return; }
          }
        }
        const seen = new Set();
        ids.forEach((id) => {
          if (id === me.id) return;
          const s = state[id][0]; if (!s) return;
          seen.add(id);
          const prev = peers.get(id);
          peers.set(id, { ...s, x: prev && s.seat == null ? prev.x : s.x, z: prev && s.seat == null ? prev.z : s.z });
          if (s.theme) onTheme?.(s.theme, id);
        });
        [...peers.keys()].forEach((id) => { if (!seen.has(id)) peers.delete(id); });
        onStatus({ online: true, room: n, count: ids.length });
        onPeers(peers);
      })
      .on('broadcast', { event: 'pos' }, ({ payload }) => { const p = peers.get(payload.id); if (p) { p.x = payload.x; p.z = payload.z; } })
      .on('broadcast', { event: 'say' }, ({ payload }) => onSay?.(payload))
      .on('broadcast', { event: 'theme' }, ({ payload }) => onTheme?.(payload, payload.by))
      .on('broadcast', { event: 'lantern' }, ({ payload }) => onLantern?.(payload))
      .subscribe(async (status, err) => {
        console.info('[온라인 성균관]', status, err?.message || '');
        if (status === 'SUBSCRIBED') { retry = 0; lastTrack = Date.now(); lastKey = ''; await channel.track({ ...me.public(), online_at: me.joinedAt }); onStatus({ online: true, room: n, count: 1 }); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          onStatus({ online: false, room: n, retrying: alive, error: `${status}${err?.message ? ' · ' + err.message : ''}` });
          if (alive && status === 'CLOSED' && !channel.__moving) { // 서버가 닫았으면 잠시 뒤 다시 들어감
            const ch = channel; retry++;
            setTimeout(() => { if (!alive || channel !== ch) return; client.removeChannel(ch); join(n); }, Math.min(15000, 2000 * retry));
          }
        }
      });
  }
  join(1);

  return {
    peers, room: () => roomNo,
    // 상태가 바뀔 때만, 최소 3초 간격으로 보냄 (Supabase presence 속도 제한: 너무 자주 보내면 채널이 끊김)
    update() {
      if (!channel || !alive) return;
      const pub = me.public();
      const key = JSON.stringify({ ...pub, x: pub.seat == null ? Math.round(pub.x / 3) : 0, z: pub.seat == null ? Math.round(pub.z / 3) : 0 });
      if (key === lastKey) return;
      const send = () => {
        pending = null; lastTrack = Date.now();
        const p2 = me.public(); lastKey = JSON.stringify({ ...p2, x: p2.seat == null ? Math.round(p2.x / 3) : 0, z: p2.seat == null ? Math.round(p2.z / 3) : 0 });
        channel.track({ ...p2, online_at: me.joinedAt });
      };
      const wait = 3200 - (Date.now() - lastTrack);
      if (wait <= 0) send(); else if (!pending) pending = setTimeout(send, wait);
    },
    move(x, z) { channel?.send({ type: 'broadcast', event: 'pos', payload: { id: me.id, x: +x.toFixed(2), z: +z.toFixed(2) } }); },
    say(text) { channel?.send({ type: 'broadcast', event: 'say', payload: { id: me.id, name: me.name, text } }); },
    npcSay(id, name, text) { channel?.send({ type: 'broadcast', event: 'say', payload: { id, name, text, npc: true } }); },
    theme(t) { channel?.send({ type: 'broadcast', event: 'theme', payload: t }); },
    lantern(p) { channel?.send({ type: 'broadcast', event: 'lantern', payload: { id: me.id, ...p } }); },
    close() { alive = false; channel?.unsubscribe(); },
  };
}

// ---------------- 공용 시계 (정각 종) ----------------
// 매시 :00 ~ :50 공부, :50 ~ :00 쉬는 시간. 모든 사람이 같은 한국 시간을 씀.
export function kst(ms = Date.now()) { const d = new Date(ms + 9 * 3600000); return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), day: d.toISOString().slice(0, 10) }; }
export function bellPhase(ms = Date.now()) {
  const { m, s } = kst(ms);
  const sec = m * 60 + s;
  if (sec < 50 * 60) return { phase: 'study', left: 50 * 60 - sec, total: 50 * 60 };
  return { phase: 'break', left: 3600 - sec, total: 600 };
}

// ---------------- NPC 유생 (모든 접속자에게 같은 유생이 같은 자리) ----------------
const h = (n) => { const x = Math.sin(n * 91.7 + 13.3) * 43758.5453; return x - Math.floor(x); };
const GOALS = ['토익 RC 2세트', '미적분 3단원', '자소서 첫 문단', '전공 레포트', '한국사 기출 50문제', '코테 2문제', '영단어 100개', '논문 한 편 읽기', '행정법 판례', '회계원리 4장', '면접 답변 정리', '책 50쪽', '중간 오답노트', '포트폴리오 수정', '일본어 JLPT N2', '통계 과제'];
const BREAK_LINES = ['아 다리 저려…', '은행잎 진짜 예쁘다', '다음 교시도 화이팅', '훈장님 오늘 기분 좋으신 듯', '매점 가고 싶다', '벌써 한 시간 지났네', '목표 반은 했다!', '물 마시고 와야지', '하늘 좀 봐', '종소리 좋다…', '스트레칭 같이 해요', '오늘 몇 교시째예요?'];
const STUDY_LINES = ['하아암…', '(사각사각)', '(책장 넘기는 소리)', '음… 이거 뭐였더라', '집중 집중', '(끄덕끄덕)'];

const DRINKS = ['녹차', '보리차', '유자차', '대추차', '국화차', '쌍화차'];
export function botScholars(nowMs, humanCount, takenSeats, takenTea = new Set(), takenBeds = new Set()) {
  const nowSec = nowMs / 1000;
  const want = Math.max(0, Math.min(15, 17 - humanCount));
  const { h: hour, m } = kst(nowMs);
  const bell = bellPhase(nowMs);
  const epoch = Math.floor(nowSec / 3600); // 한 시간마다 유생 몇 명이 바뀜
  const bots = [];
  const used = new Set(), usedTea = new Set([0]), usedBed = new Set(); // 0번 찻자리는 훈장님 자리
  for (let i = 0; i < want; i++) {
    const seed = i * 7.7 + Math.floor(epoch / 2 + i * 0.29) * 13.1;
    let k = Math.floor(h(seed) * SEATS.length), tries = 0;
    while ((takenSeats.has(k) || used.has(k)) && tries < SEATS.length) { k = (k + 5) % SEATS.length; tries++; }
    if (tries >= SEATS.length) continue;
    used.add(k);
    let c = 0; const r = () => h(seed + 2 + c++ * 1.31);
    const look = randomScholar(r), name = scholarName(r);
    const personal = h(seed + 5) < 0.25; // 일부는 자기 리듬으로 쉼
    const offset = Math.floor(h(seed + 6) * 1500);
    const onBreak = personal ? ((nowSec + offset) % 1800) > 1500 : bell.phase === 'break';
    const studyStart = 9, studied = Math.max(0, Math.min(14, hour + m / 60 - studyStart));
    const done = Math.floor(studied * (0.6 + h(seed + 7) * 0.5));
    const goal = GOALS[Math.floor(h(seed + 3) * GOALS.length)];
    const r9 = h(seed + 9 + epoch * 0.7);
    if (onBreak && r9 < 0.24) { // 정자에서 차 한 잔
      const k = 1 + (i % 5);
      if (!takenTea.has(k) && !usedTea.has(k)) {
        usedTea.add(k); const t = TEA_SEATS[k];
        bots.push({ id: `bot-${i}`, bot: true, name, look, seat: null, seated: true, sitY: t.y, facing: t.facing, x: t.x, z: t.z, tea: k, hold: Math.sin(nowSec / 3 + i) > -0.3, talk: Math.sin(nowSec / 2.2 + i) > 0.4, goal, done, state: 'tea', drink: DRINKS[i % DRINKS.length] });
        continue;
      }
    }
    if (onBreak && r9 >= 0.24 && r9 < 0.34) { // 동재·서재에서 낮잠
      const k = (i * 5 + epoch) % BEDS.length;
      if (!takenBeds.has(k) && !usedBed.has(k)) {
        usedBed.add(k); const b = BEDS[k];
        bots.push({ id: `bot-${i}`, bot: true, name, look, seat: null, seated: false, x: b.x, z: b.z, lie: b, bed: k, goal, done, state: 'nap', wakeAt: nowMs + bell.left * 1000 });
        continue;
      }
    }
    if (onBreak) {
      const sp = BREAK_SPOTS[(i * 3 + epoch) % BREAK_SPOTS.length];
      const t = nowSec / 9 + i;
      bots.push({ id: `bot-${i}`, bot: true, name, look, seat: null, seated: false, x: sp[0] + Math.sin(t) * 0.9, z: sp[1] + Math.cos(t * 0.8) * 0.7, goal, done, state: 'break', talk: Math.sin(nowSec / 2.5 + i) > 0.5, speed: 1.2 });
    } else {
      const s = SEATS[k];
      const left = personal ? 1500 - ((nowSec + offset) % 1800) : bell.left;
      bots.push({ id: `bot-${i}`, bot: true, name, look, seat: k, seated: true, x: s.x, z: s.z, goal, done, state: 'study', left: Math.max(0, left), read: true });
    }
  }
  return bots;
}
export function botLine(nowSec, bots) {
  const slot = Math.floor(nowSec / 11);
  if (!bots.length || h(slot * 3.1) < 0.45) return null;
  const b = bots[Math.floor(h(slot * 1.7) * bots.length)];
  const list = b.state === 'break' ? BREAK_LINES : STUDY_LINES;
  if (b.state !== 'break' && h(slot * 2.3) < 0.6) return null; // 공부 중엔 조용히
  return { slot, id: b.id, text: list[Math.floor(h(slot * 5.3) * list.length)] };
}
