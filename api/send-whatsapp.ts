import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const baseURL = process.env.VITE_EVO_BASE_URL;
  const apiKey = process.env.VITE_EVO_API_KEY;
  const instance = process.env.VITE_EVO_INSTANCE;

  if (!baseURL || !apiKey || !instance) {
    return res.status(500).json({ error: 'EVO API credentials not configured' });
  }

  try {
    const response = await fetch(`${baseURL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKey
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.text();

    res.status(response.status).send(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Failed to forward request to Evolution API' });
  }
}
