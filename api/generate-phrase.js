// Vercel Serverless Function: /api/generate-phrase
// Takes a short Korean expression (e.g. "~를 부탁해") and asks Claude to turn
// it into an English expression pattern + example sentences, in the same
// shape as the app's built-in PHRASE_CATEGORIES.
//
// Setup required (one-time): In the Vercel dashboard, open this project ->
// Settings -> Environment Variables -> add ANTHROPIC_API_KEY (from
// console.anthropic.com, requires a payment method on file).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY가 설정되지 않았어요. Vercel 프로젝트 Settings > Environment Variables에 추가한 뒤 다시 배포해주세요.'
    });
  }

  const { ko } = req.body || {};
  if (!ko || !String(ko).trim()) {
    return res.status(400).json({ error: '한국어 표현을 입력해주세요.' });
  }

  const systemPrompt = `You help Korean English-learners turn a short Korean expression or sentence pattern into an English expression pattern with example sentences, for a phrase-practice app.

Given a Korean phrase or pattern (e.g. "~를 부탁해"), respond with ONLY a JSON object — no markdown, no code fences, no extra commentary — in exactly this shape:
{
  "icon": "<one emoji that fits the feeling or function of this pattern>",
  "pattern": "<one or two natural English patterns using ~ for the blank, e.g. 'Could you ~, please? / I'd appreciate it if you could ~'>",
  "titleKo": "<short Korean label for this pattern, 2-6 characters, e.g. '부탁 표현'>",
  "examples": [
    { "en": "<natural, conversational English example sentence using the pattern>", "ko": "<natural Korean translation, not overly literal>" },
    { "en": "...", "ko": "..." },
    { "en": "...", "ko": "..." }
  ]
}
Always provide exactly 3 examples. Keep English natural and conversational (everyday spoken register, not formal/written). Keep Korean translations natural rather than word-for-word literal.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: String(ko).trim() }]
      })
    });

    const data = await r.json();

    if (!r.ok) {
      const message = (data && data.error && data.error.message) || 'Anthropic API 호출에 실패했어요.';
      return res.status(r.status).json({ error: message });
    }

    const text = (data.content || [])
      .map(block => block.text || '')
      .join('')
      .trim();

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      return res.status(502).json({ error: 'AI 응답을 해석하지 못했어요. 다시 시도해주세요.' });
    }

    if (!parsed.pattern || !Array.isArray(parsed.examples)) {
      return res.status(502).json({ error: 'AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.' });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
