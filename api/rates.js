// Proxy taux de change — clé en env var, jamais côté client
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET seulement' });
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'EXCHANGE_RATE_API_KEY manquante dans Vercel' });
  }

  const { base = 'USD', targets = 'EUR,GBP,CHF,JPY,CAD' } = req.query;

  try {
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`;
    const r = await fetch(url);

    if (!r.ok) {
      return res.status(r.status).json({ error: 'Erreur ExchangeRate-API', status: r.status });
    }

    const data = await r.json();

    if (data.result !== 'success') {
      return res.status(400).json({ error: data['error-type'] || 'Erreur API' });
    }

    // Filtrer seulement les taux demandés
    const targetList = targets.split(',').map(t => t.trim().toUpperCase());
    const rates = {};
    targetList.forEach(target => {
      if (data.conversion_rates[target]) {
        rates[target] = data.conversion_rates[target];
      }
    });

    return res.status(200).json({
      ok: true,
      base: data.base_code,
      timestamp: data.time_last_update_utc,
      rates
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
