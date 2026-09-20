// Agent Reach — collecte posts publics (Reddit d'abord, pas d'API officielle requise)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST seulement' });
  }

  const { platform = 'reddit', query, limit = 10, sort = 'hot' } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: 'query requise (ex: dropshipping)' });
  }

  if (platform !== 'reddit') {
    return res.status(400).json({ error: `platform "${platform}" non supportée. Reddit seulement pour l'instant.` });
  }

  const sub = String(query).replace(/^r\//, '').trim();
  const n = Math.min(Number(limit) || 10, 50);
  const target = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}.json?limit=${n}`;

  try {
    const r = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!r.ok) {
      return res.status(r.status).json({ error: `Reddit a répondu ${r.status}` });
    }

    const json = await r.json();
    const children = (json.data && json.data.children) || [];

    const posts = children.map(c => {
      const d = c.data;
      return {
        title: d.title,
        score: d.score,
        comments: d.num_comments,
        author: d.author,
        created: new Date(d.created_utc * 1000).toISOString(),
        flair: d.link_flair_text || null,
        url: 'https://reddit.com' + d.permalink,
        selftext: (d.selftext || '').slice(0, 400)
      };
    });

    const avgScore = posts.length
      ? Math.round(posts.reduce((a, p) => a + p.score, 0) / posts.length)
      : 0;

    return res.status(200).json({
      ok: true,
      source: 'agentreach',
      platform,
      subreddit: sub,
      count: posts.length,
      avgScore,
      posts
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}