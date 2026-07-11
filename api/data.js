// Vercel Serverless Function: /api/data
// Reads/writes key-value data in Upstash Redis (via Vercel Storage integration)
// so the Talk Lab app's saved data (progress, custom phrases, paragraphs)
// syncs across devices instead of staying in one browser's localStorage.
//
// Setup required (one-time): In the Vercel dashboard, open this project ->
// Storage tab -> add an "Upstash for Redis" integration (free tier). Vercel
// will automatically inject the REST URL/token as environment variables.

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return res.status(500).json({
      error: 'Storage not configured yet. Add an Upstash Redis integration in the Vercel dashboard (Storage tab), then redeploy.'
    });
  }

  async function redis(command) {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command)
    });
    return r.json();
  }

  try {
    if (req.method === 'GET') {
      const key = req.query.key;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      const data = await redis(['GET', `talklab:${key}`]);
      return res.status(200).json({ value: data.result ?? null });
    }

    if (req.method === 'POST') {
      const { key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: 'Missing key' });
      await redis(['SET', `talklab:${key}`, value]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
