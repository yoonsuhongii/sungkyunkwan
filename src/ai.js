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
// 키워드 → 날씨·효과 (GPT 없이도 "천둥번개"라고 치면 천둥번개가 옴)
const WEATHER_KEYS = [
  { k: ['천둥', '번개', '뇌우', '폭풍', '태풍'], w: 'storm' },
  { k: ['눈보라', '폭설', '블리자드'], w: 'blizzard' },
  { k: ['눈', '첫눈', '설경'], w: 'snow' },
  { k: ['비', '장마', '소나기', '장맛비'], w: 'rain' },
  { k: ['안개', '몽환', '물안개'], w: 'fog' },
  { k: ['벚꽃', '꽃잎', '꽃비'], w: 'petals' },
  { k: ['낙엽', '은행잎', '단풍'], w: 'leaves' },
  { k: ['흐림', '흐린', '구름', '먹구름', '우중충'], w: 'cloudy' },
];
const SEASON_KEYS = [{ k: ['봄', '벚꽃', '꽃'], v: 'spring' }, { k: ['여름', '장마', '매미', '반딧불', '소나기'], v: 'summer' }, { k: ['가을', '단풍', '은행', '낙엽'], v: 'autumn' }, { k: ['겨울', '눈', '크리스마스', '설경', '오로라'], v: 'winter' }];
const TIME_KEYS = [{ k: ['새벽', '아침', '일출', '해돋이'], v: 'dawn' }, { k: ['노을', '저녁', '해질', '석양', '황혼'], v: 'sunset' }, { k: ['밤', '야간', '별', '달', '오로라', '반딧불', '별똥별', '유성', '자정'], v: 'night' }, { k: ['낮', '점심', '한낮', '맑은'], v: 'day' }];
const has = (s, list) => list.some((k) => s.includes(k));
export function offlineTheme(prompt) {
  const s = String(prompt);
  let w = (WEATHER_KEYS.find((x) => has(s, x.k)) || {}).w || 'clear';
  if (has(s, ['무지개', '갠', '개인']) && w === 'rain') w = 'clear'; // "비 갠 뒤 무지개"는 맑음
  const season = (SEASON_KEYS.find((x) => has(s, x.k)) || {}).v || (w === 'snow' || w === 'blizzard' ? 'winter' : w === 'petals' ? 'spring' : 'autumn');
  const time = (TIME_KEYS.find((x) => has(s, x.k)) || {}).v || 'day';
  const fx = {};
  if (has(s, ['무지개'])) fx.rainbow = true;
  if (has(s, ['오로라'])) fx.aurora = true;
  if (has(s, ['반딧불'])) fx.fireflies = true;
  if (has(s, ['별똥별', '유성'])) fx.meteors = true;
  if (has(s, ['바람', '태풍', '강풍'])) fx.wind = 1;
  if (has(s, ['번개']) && w !== 'storm') fx.lightning = true;
  return { title: s.slice(0, 14) || '맑은 날', season, time, weather: w, fx };
}
function cleanFx(f = {}, prompt = '') {
  const base = offlineTheme(prompt).fx; // GPT가 빠뜨려도 키워드로 보충
  const b = (v, k) => !!(v ?? base[k]);
  const n = (v, k) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : base[k]);
  const out = { rainbow: b(f.rainbow, 'rainbow'), aurora: b(f.aurora, 'aurora'), fireflies: b(f.fireflies, 'fireflies'), meteors: b(f.meteors, 'meteors'), lightning: b(f.lightning, 'lightning') };
  const wind = n(f.wind, 'wind'), clouds = n(f.clouds, 'clouds');
  if (wind !== undefined) out.wind = wind; if (clouds !== undefined) out.clouds = clouds;
  return out;
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
      weather: ['clear', 'cloudy', 'rain', 'storm', 'snow', 'blizzard', 'fog', 'petals', 'leaves'].includes(t.weather) ? t.weather : 'clear',
      fx: cleanFx(t.fx, prompt),
      ...(sky ? { sky } : {}),
      line: cleanChat(t.line || '', 60),
    };
  } catch { return offlineTheme(prompt); }
}

// ---------------- NPC 유생 대답 ----------------
const NPC_OFF = [
  (n, g) => `저는 ${g} 하다가 잠깐 나왔어요 ㅎㅎ 오늘 몇 교시째세요?`,
  () => '맞아요, 저도 아까부터 집중이 안 돼서… 은행잎 보니까 좀 낫네요',
  () => '오 그거 좋다! 다음 종 치면 같이 들어가요',
  () => '정자에서 유자차 마셔봤어요? 생각보다 맛있어요 🍋',
  (n, g) => `${g}… 끝이 안 보여요 ㅋㅋ 그래도 오늘 향 두 개는 태웠어요`,
  () => '힘내요! 여기 앉아만 있어도 반은 한 거래요, 훈장님이 그러셨어요',
];
export function offlineNpc({ name = '', goal = '공부', text = '' }) {
  if (CRISIS.test(text)) return { text: '많이 힘드셨구나… 혼자 버티지 말고 109에 한번 이야기해봐요. 저도 옆에 있을게요.' };
  return { text: NPC_OFF[Math.floor(Math.random() * NPC_OFF.length)](name, goal) };
}
export async function npcReply(args) {
  try { const r = await post('/api/yusaeng', args, 15000); if (!r?.text) throw new Error('bad'); return { text: cleanChat(r.text, 120) }; }
  catch { return offlineNpc(args); }
}
