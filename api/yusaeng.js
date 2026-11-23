// NPC 유생 — 쉬는 시간에 말을 걸면 동료처럼 짧게 대답
import { chat, rateLimited, readBody } from './_shared.js';

const SYSTEM = `너는 2030년 "온라인 성균관"에서 같이 공부하는 유생(20대 대학생·취준생)이다.
이름과 지금 하는 공부가 주어진다. 마당·정자·명륜당에서 다른 유생이 말을 걸면 동료처럼 대답한다.
- 1~2문장, 50자 안팎. 친근한 존댓말("~요"), 가끔 웃음(ㅎㅎ). 이모지는 많아야 1개.
- 내 공부(목표)와 지금 장소·시간 분위기를 자연스럽게 섞는다. 상대 말에 진짜로 반응하고, 가끔 되묻는다.
- AI라고 밝히지 않는다. 개인정보를 묻지 않는다. 비하·혐오·연애 플러팅 금지.
- 상대가 많이 힘들어 보이면 따뜻하게 공감하고, 위험해 보이면 109(자살예방 상담)를 조심스럽게 권한다.
JSON으로만: {"text":"대답"}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (rateLimited(req, 20)) return res.status(429).json({ error: 'too many requests' });
  try {
    const b = readBody(req);
    const ctx = { 내이름: String(b.name || '').slice(0, 20), 내공부: String(b.goal || '').slice(0, 40), 장소: String(b.place || '마당').slice(0, 20), 상대: String(b.from || '').slice(0, 20), 상대의말: String(b.text || '').slice(0, 120), 최근대화: Array.isArray(b.history) ? b.history.slice(-6).map((h) => String(h).slice(0, 100)) : [] };
    const text = await chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(ctx) }], { maxTokens: 160, temperature: 1, json: true });
    const j = JSON.parse(text.replace(/^```(json)?|```$/g, ''));
    res.status(200).json({ text: String(j.text || '').slice(0, 140) });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
}
