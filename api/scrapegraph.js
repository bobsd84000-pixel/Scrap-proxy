// Proxy ScrapeGraph AI — clé en env var, jamais côté client
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST seulement' });
  }

  const key = process.env.SCRAPEGRAPH_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'SCRAPEGRAPH_API_KEY manquante dans Vercel' });
  }

  const { url, prompt } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'url requise' });
  }

  try {
    const r = await fetch('https://api.scrapegraphai.com/v1/smartscraper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'SGAI-APIKEY': key
      },
      body: JSON.stringify({
        website_url: url,
        user_prompt: prompt || 'Extrais titre, prix, description des produits de cette page'
      })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: data.error || 'Erreur ScrapeGraph', detail: data });
    }

    return res.status(200).json({ ok: true, source: 'scrapegraph', url, data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}