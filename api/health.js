// Health check endpoint for uptime monitoring
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET seulement' });
  }

  const startTime = Date.now();

  try {
    // Test ExchangeRate-API connectivity
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        status: 'degraded',
        message: 'EXCHANGE_RATE_API_KEY manquante',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    }

    const r = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`, {
      signal: AbortSignal.timeout(5000)
    });

    const responseTime = Date.now() - startTime;

    if (!r.ok) {
      return res.status(503).json({
        status: 'degraded',
        message: `ExchangeRate-API error: ${r.status}`,
        responseTime: responseTime,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      status: 'healthy',
      service: 'scrap-proxy',
      uptime: process.uptime(),
      responseTime: responseTime,
      timestamp: new Date().toISOString(),
      endpoints: {
        rates: '/api/rates',
        health: '/api/health',
        scrapegraph: '/api/scrapegraph',
        agentreach: '/api/agentreach'
      }
    });
  } catch (e) {
    const responseTime = Date.now() - startTime;
    return res.status(503).json({
      status: 'unhealthy',
      error: e.message,
      responseTime: responseTime,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }
}
