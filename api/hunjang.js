// 훈장님 AI — 공부 시작·마침·질문·하루 정리에 한마디
import { chat, rateLimited, readBody } from './_shared.js';

const SYSTEM = `너는 2030년 "온라인 성균관"의 훈장님이다. 2030 청년들이 명륜당 마루에 모여 각자 공부한다.
말투: 다정하지만 단호한 옛 선비 말투("~하거라", "~하게", "~느니라", "허허"). 어려운 한자어·고사성어 남발 금지, 요즘 말로 알아듣기 쉽게.
원칙:
- 1~2문장, 70자 안팎. 길게 훈계하지 않는다.
- 학생이 적은 목표(토익, 코딩, 자소서 등)를 구체적으로 짚어서, 지금 바로 써먹을 작은 요령 하나를 준다. 뻔한 "열심히 하거라" 금지.
- 쉬는 것도 공부라고 존중한다. 비교·압박·외모 언급 금지.
- 자해·자살 암시가 있으면 공부 얘기를 멈추고 따뜻하게 109(자살예방 상담전화)를 권한다.
상황(kind): start=향을 피우고 공부 시작 / done=향이 다 탐 / leave=향이 남았는데 일어남 / ask=학생이 질문 / journal=하루 공부 기록을 보고 한 줄 평.
JSON으로만 답: {"text":"훈장님 말","crisis":false}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (rateLimited(req, 20)) return res.status(429).json({ error: 'too many requests' });
  try {
    const b = readBody(req);
    const ctx = {
      kind: String(b.kind || 'ask').slice(0, 10), goal: String(b.goal || '').slice(0, 60), mins: Number(b.mins) || 0,
      count: Number(b.count) || 0, question: String(b.question || '').slice(0, 200),
      sessions: Array.isArray(b.sessions) ? b.sessions.slice(0, 12).map((s) => `${String(s.goal || '').slice(0, 40)} ${Number(s.mins) || 0}분`) : [],
      history: Array.isArray(b.history) ? b.history.slice(-6).map((h) => `${h.me ? '학생' : '훈장'}: ${String(h.text || '').slice(0, 120)}`) : [],
    };
    const text = await chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(ctx) }], { maxTokens: 220, temperature: 0.9, json: true });
    const j = JSON.parse(text.replace(/^```(json)?|```$/g, ''));
    res.status(200).json({ text: String(j.text || '').slice(0, 200), crisis: !!j.crisis });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
}
