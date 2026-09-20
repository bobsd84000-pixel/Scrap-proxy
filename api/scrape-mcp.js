// Orchestrateur — enchaîne agentreach + scrapegraph, retry 3x, cache mémoire 1h
const cache = new Map();
const TTL = 3600 * 1000;

function getCache(k) {
  const hit = cache.get(k);
  if (!hit) return null;
  if (Date.now() - hit.t > TTL) { cache.delete(k); return null; }
  return hit.v;
}

function setCache(k, v) {
  cache.set(k, { t: Date.now(), v });
}

async function retry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST seulement' });
  }

  const { subreddit, url, prompt, limit = 10, useCache = true } = req.body || {};
  const key = JSON.stringify({ subreddit, url, prompt, limit });

  if (useCache) {
    const hit = getCache(key);
    if (hit) return res.status(200).json({ ...hit, cached: true });
  }

  const root = baseUrl(req);
  const out = { ok: true, source: 'scrape-mcp', steps: [], errors: [], cached: false };

  if (subreddit) {
    try {
      const data = await retry(async () => {
        const r = await fetch(`${root}/api/agentreach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'reddit', query: subreddit, limit })
        });
        if (!r.ok) throw new Error(`agentreach ${r.status}`);
        return r.json();
      });
      out.steps.push({ tool: 'agentreach', status: 'ok', count: data.count, avgScore: data.avgScore, posts: data.posts });
    } catch (e) {
      out.errors.push({ tool: 'agentreach', error: e.message });
    }
  }

  if (url) {
    try {
      const data = await retry(async () => {
        const r = await fetch(`${root}/api/scrapegraph`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, prompt })
        });
        if (!r.ok) throw new Error(`scrapegraph ${r.status}`);
        return r.json();
      });
      out.steps.push({ tool: 'scrapegraph', status: 'ok', data: data.data });
    } catch (e) {
      out.errors.push({ tool: 'scrapegraph', error: e.message });
    }
  }

  if (!subreddit && !url) {
    return res.status(400).json({ error: 'Fournis subreddit et/ou url' });
  }

  out.ok = out.errors.length === 0;
  if (useCache && out.ok) setCache(key, out);

  return res.status(200).json(out);
}