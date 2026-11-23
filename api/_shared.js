import OpenAI from 'openai';

// 기본: gpt-6-luna (2026 경량 모델). Vercel 환경변수 OPENAI_MODEL 로 바꿀 수 있음
export const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna';

let client = null;
export function getClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY 환경변수가 없습니다');
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** 모델 종류에 맞춰 파라미터를 바꿔 호출 (구형 gpt-4o 계열 / 추론형 신형 모델 모두 지원) */
export async function chat(messages, { maxTokens = 500, temperature = 0.9, json = false } = {}) {
  const legacy = /^gpt-4/.test(MODEL);
  const params = { model: MODEL, messages };
  if (legacy) { params.max_tokens = maxTokens; params.temperature = temperature; }
  else { params.max_completion_tokens = maxTokens + 1500; params.reasoning_effort = 'low'; }
  if (json) params.response_format = { type: 'json_object' };
  try {
    const c = await getClient().chat.completions.create(params);
    return (c.choices[0].message.content || '').trim();
  } catch (e) {
    // 파라미터를 지원하지 않는 모델이면 최소 파라미터로 한 번 더
    if (e?.status === 400) {
      const c = await getClient().chat.completions.create({ model: MODEL, messages, ...(json ? { response_format: { type: 'json_object' } } : {}) });
      return (c.choices[0].message.content || '').trim();
    }
    throw e;
  }
}

// 아주 단순한 IP별 호출 제한 (비용 폭주 방지)
const hits = new Map();
export function rateLimited(req, limit = 40, windowMs = 60_000) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > limit;
}

export function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    if (b.length > 12000) throw new Error('body too large');
    return JSON.parse(b);
  }
  return b;
}
