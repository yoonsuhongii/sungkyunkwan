// 프롬프트 → 성균관의 계절·시간·날씨
import { chat, rateLimited, readBody } from './_shared.js';

const SYSTEM = `너는 2030년 "온라인 성균관" 월드모델의 하늘과 계절을 맡은 무대감독이다.
사용자가 원하는 분위기를 한 줄로 말하면, 서원 마당의 계절·시간·날씨를 JSON으로만 답한다.
{"title":"분위기 이름(12자 이내, 한글)","season":"spring|summer|autumn|winter","time":"dawn|day|sunset|night",
"weather":"clear|rain|snow|fog|petals|leaves","sky":["하늘 위쪽 #hex","지평선 쪽 #hex"],
"line":"훈장님이 이 풍경을 보고 하는 한마디(30자 이내, 사극 말투)"}
- 요청에 가장 가까운 값을 고르고, sky 는 time 에 어울리게(밤이면 어둡게) 고른다.
- 공부와 무관하거나 위험·혐오 요청이면 "맑은 가을 낮"으로 답한다. JSON 외 텍스트 금지.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (rateLimited(req, 8)) return res.status(429).json({ error: 'too many requests' });
  try {
    const { prompt = '' } = readBody(req);
    const text = await chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: String(prompt).slice(0, 120) }], { maxTokens: 300, temperature: 0.9, json: true });
    res.status(200).json(JSON.parse(text.replace(/^```(json)?|```$/g, '')));
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
}
