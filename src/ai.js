// GPT 호출 (Vercel /api) + 오프라인 대체 (키가 없거나 미리보기에서도 동작)
let calls = 0;
const MAX_CALLS = 60;
async function post(path, body, ms = 15000) {
  if (calls >= MAX_CALLS) throw new Error('limit');
  calls++;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

const BAD = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새', '닥쳐', '꺼져', '미친놈', '미친년', '애미', '느금'];
export function cleanChat(t, max = 80) {
  let s = String(t).replace(/\s+/g, ' ').trim().slice(0, max);
  BAD.forEach((w) => { s = s.split(w).join('♡'.repeat(w.length)); });
  return s;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ---------------- 훈장님 ----------------
const CRISIS = /(죽고\s*싶|자살|자해|사라지고\s*싶|살기\s*싫|끝내고\s*싶)/;
const OFF = {
  start: [
    (g, m) => `"${g}"라… ${m}분이면 넉넉하네. 처음 십 분만 버티면 나머지는 따라오느니라.`,
    (g) => `좋다. "${g}", 오늘은 그것 하나만 붙들거라. 욕심은 향 다 탄 뒤에 내도 늦지 않네.`,
    (g, m) => `허허, ${m}분짜리 향이로구나. "${g}" 끝나면 마당에서 바람 한번 쐬거라.`,
    () => '자세부터 바로 하거라. 허리가 서야 글이 서느니라.',
  ],
  done: [
    (g, m, n) => `수고했네. 오늘 벌써 향 ${n}개째로구나. 등불 하나가 자네 덕에 켜졌네.`,
    (g, m) => `${m}분을 다 채웠구먼. 다 못 했어도 괜찮네, 앉아 있었던 것이 공부니라.`,
    (g) => `"${g}" 마쳤는가? 잠깐 일어나 은행나무 아래서 숨 좀 고르게.`,
  ],
  leave: ['어허, 향이 아직 남았거늘. 급한 일이면 다녀오게, 자리는 지켜두마.', '벌써 일어나는가? 물 한 잔 마시고 다시 앉게나.'],
  ask: [
    '막힐 땐 붓을 내려놓고 마당을 한 바퀴 돌게. 머리가 아니라 다리가 답을 주는 날도 있느니.',
    '한 번에 다 하려 들지 말게. 오늘은 딱 한 장만, 대신 끝까지.',
    '모르는 것을 부끄러워 말게. 표시해 두고 넘어가면, 내일의 자네가 풀 것이야.',
    '쉬는 것도 공부의 일부니라. 종이 울리면 꼭 일어나게.',
  ],
  welcome: ['어서 오게. 빈자리 아무 데나 앉으면 향을 피워주마.', '오늘도 왔구먼. 마루가 따뜻하니 앉게나.'],
};
export function offlineHunjang({ kind, goal = '', mins = 25, count = 1, question = '' }) {
  if (kind === 'ask' && CRISIS.test(question)) return { text: '그런 마음이 들 만큼 힘들었구먼. 혼자 견디지 말고 지금 109(자살예방 상담)에 이야기해 보게. 자네는 소중한 사람이네.', crisis: true };
  const f = pick(OFF[kind] || OFF.ask);
  return { text: typeof f === 'function' ? f(goal, mins, count) : f };
}
export async function hunjang(args) {
  try {
    const r = await post('/api/hunjang', args, 20000);
    if (!r?.text) throw new Error('bad');
    return { text: cleanChat(r.text, 160), crisis: !!r.crisis };
  } catch { return offlineHunjang(args); }
}

// ---------------- 계절·시간·날씨 프롬프트 ----------------
const PRESETS = [
  { k: ['벚꽃', '봄'], t: { title: '벚꽃 핀 봄날', season: 'spring', time: 'day', weather: 'petals' } },
  { k: ['시험 전날', '시험'], t: { title: '시험 전날 밤', season: 'spring', time: 'night', weather: 'petals' } },
  { k: ['여름', '매미', '장마'], t: { title: '한여름 장맛비', season: 'summer', time: 'day', weather: 'rain' } },
  { k: ['비'], t: { title: '비 오는 서원', season: 'summer', time: 'sunset', weather: 'rain' } },
  { k: ['가을', '은행', '단풍'], t: { title: '은행잎 지는 가을', season: 'autumn', time: 'day', weather: 'leaves' } },
  { k: ['눈', '겨울', '첫눈', '크리스마스'], t: { title: '눈 내리는 겨울밤', season: 'winter', time: 'night', weather: 'snow' } },
  { k: ['안개', '몽환'], t: { title: '안개 낀 새벽', season: 'autumn', time: 'dawn', weather: 'fog' } },
  { k: ['새벽', '아침', '일출'], t: { title: '첫 종 울리는 새벽', season: 'autumn', time: 'dawn', weather: 'clear' } },
  { k: ['노을', '저녁', '해질'], t: { title: '노을 지는 마당', season: 'autumn', time: 'sunset', weather: 'leaves' } },
  { k: ['밤', '야간', '별'], t: { title: '별 뜬 밤의 서원', season: 'autumn', time: 'night', weather: 'clear' } },
];
export function offlineTheme(prompt) {
  const s = String(prompt);
  const hit = PRESETS.find((x) => x.k.some((k) => s.includes(k)));
  return { ...(hit ? hit.t : { title: s.slice(0, 12) || '맑은 날', season: 'autumn', time: 'day', weather: 'clear' }) };
}
export async function makeTheme(prompt) {
  try {
    const t = await post('/api/theme', { prompt }, 25000);
    if (!t?.season) throw new Error('bad');
    const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : null);
    const sky = Array.isArray(t.sky) && hex(t.sky[0]) && hex(t.sky[1]) ? [t.sky[0], t.sky[1]] : null;
    return {
      title: cleanChat(t.title || prompt, 16),
      season: ['spring', 'summer', 'autumn', 'winter'].includes(t.season) ? t.season : 'autumn',
      time: ['dawn', 'day', 'sunset', 'night'].includes(t.time) ? t.time : 'day',
      weather: ['clear', 'rain', 'snow', 'fog', 'petals', 'leaves'].includes(t.weather) ? t.weather : 'clear',
      ...(sky ? { sky } : {}),
      line: cleanChat(t.line || '', 60),
    };
  } catch { return offlineTheme(prompt); }
}
