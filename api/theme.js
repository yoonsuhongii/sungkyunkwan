// 프롬프트 → 성균관의 계절·시간·날씨
import { chat, rateLimited, readBody } from './_shared.js';

const SYSTEM = `너는 2030년 "온라인 성균관" 월드모델의 하늘과 날씨를 맡은 무대감독이다.
사용자가 원하는 풍경을 한 줄로 말하면, 그 말이 "그대로" 화면에 보이도록 서원 마당의 계절·시간·날씨·효과를 JSON으로만 답한다.
{"title":"풍경 이름(12자 이내, 한글)","season":"spring|summer|autumn|winter","time":"dawn|day|sunset|night",
"weather":"clear|cloudy|rain|storm|snow|blizzard|fog|petals|leaves",
"fx":{"clouds":0~1,"wind":0~1,"lightning":true/false,"rainbow":true/false,"aurora":true/false,"fireflies":true/false,"meteors":true/false},
"sky":["하늘 위쪽 #hex","지평선 쪽 #hex"],"line":"훈장님이 이 풍경을 보고 하는 한마디(30자 이내, 사극 말투)"}
규칙:
- 사용자가 말한 현상은 빠짐없이 반영한다. 천둥·번개·폭풍 → weather "storm" + fx.lightning true + clouds 1. 눈보라 → "blizzard" + wind 1.
  무지개 → rainbow true(비 갠 뒤 낮이 어울림). 오로라 → aurora true + time "night". 반딧불 → fireflies true(여름 밤). 별똥별·유성우 → meteors true + time "night". 바람·태풍 → wind 0.8 이상.
- 말하지 않은 효과는 false/0. 시간·계절을 말하지 않았으면 현상에 가장 어울리는 것으로 고른다.
- sky 는 time·날씨에 어울리게(밤이면 어둡게, 폭풍이면 잿빛) 고른다.
- 위험·혐오 요청이면 "맑은 가을 낮"으로 답한다. JSON 외 텍스트 금지.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (rateLimited(req, 8)) return res.status(429).json({ error: 'too many requests' });
  try {
    const { prompt = '' } = readBody(req);
    const text = await chat([{ role: 'system', content: SYSTEM }, { role: 'user', content: String(prompt).slice(0, 120) }], { maxTokens: 300, temperature: 0.9, json: true });
    res.status(200).json(JSON.parse(text.replace(/^```(json)?|```$/g, '')));
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
}
