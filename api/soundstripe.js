/* Vercel serverless function — proxies Soundstripe so the API key stays server-side.
 * Set SOUNDSTRIPE_API_KEY in the Vercel project's environment variables.
 * NOTE: env vars only apply to deployments created AFTER they were added — redeploy.
 *
 * GET /api/soundstripe?q=<search terms>
 * → { title, artist, url, duration }   (url = playable mp3)
 * → 503 { error, attempts }             when no key is configured or upstream fails
 * GET /api/soundstripe?debug=1          includes the attempt log even on success
 */
const BASE = 'https://api.soundstripe.com/v1';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const debug = req.query.debug === '1';
  const key = process.env.SOUNDSTRIPE_API_KEY;
  if (!key) {
    res.status(503).json({
      error: 'SOUNDSTRIPE_API_KEY is not set in this deployment. If you added it recently, redeploy — env vars only apply to new deployments.',
    });
    return;
  }

  const q = (req.query.q || 'uplifting warm indie').toString().slice(0, 120);
  const attempts = [];

  // Try both documented auth spellings and progressively simpler queries, so a
  // rejected filter or include param can never take the whole feature down.
  const authSchemes = [`Token ${key}`, `Bearer ${key}`];
  const urls = [
    `${BASE}/songs?filter[q]=${encodeURIComponent(q)}&include=audio_files&page[size]=20`,
    `${BASE}/songs?include=audio_files&page[size]=20`,
    `${BASE}/songs?page[size]=20`,
  ];

  const extract = data => {
    if (!data || !Array.isArray(data.data) || !data.data.length) return null;
    const audioById = new Map();
    for (const inc of data.included || []) {
      if (inc.type !== 'audio_files') continue;
      const mp3 = inc.attributes?.versions?.mp3 || inc.attributes?.versions?.wav;
      if (mp3) audioById.set(inc.id, { url: mp3, duration: inc.attributes?.duration });
    }
    const candidates = [];
    for (const song of data.data) {
      // Preferred: audio files sideloaded via ?include=
      for (const ref of song.relationships?.audio_files?.data || []) {
        const af = audioById.get(ref.id);
        if (af) { candidates.push({ song, af }); break; }
      }
      // Fallback: some responses inline audio files in attributes
      const inline = song.attributes?.audio_files;
      if (Array.isArray(inline)) {
        const mp3 = inline.map(f => f.versions?.mp3 || f.url).find(Boolean);
        if (mp3) candidates.push({ song, af: { url: mp3, duration: null } });
      }
    }
    return candidates.length ? candidates : null;
  };

  try {
    for (const auth of authSchemes) {
      for (const url of urls) {
        let r, bodyText;
        try {
          r = await fetch(url, { headers: { Authorization: auth, Accept: 'application/vnd.api+json' } });
          bodyText = await r.text();
        } catch (err) {
          attempts.push({ url: url.replace(BASE, ''), auth: auth.split(' ')[0], error: err.message });
          continue;
        }
        if (!r.ok) {
          attempts.push({ url: url.replace(BASE, ''), auth: auth.split(' ')[0], status: r.status, body: bodyText.slice(0, 300) });
          continue;
        }
        let data;
        try { data = JSON.parse(bodyText); } catch {
          attempts.push({ url: url.replace(BASE, ''), auth: auth.split(' ')[0], status: r.status, error: 'non-JSON response' });
          continue;
        }
        const candidates = extract(data);
        if (!candidates) {
          attempts.push({
            url: url.replace(BASE, ''), auth: auth.split(' ')[0], status: r.status,
            error: 'no playable audio in response',
            songCount: (data.data || []).length,
            includedTypes: [...new Set((data.included || []).map(i => i.type))],
          });
          continue;
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
        res.status(200).json({
          title: pick.song.attributes?.title || 'Untitled',
          artist: pick.song.attributes?.artist_name || pick.song.attributes?.artist || 'Soundstripe artist',
          url: pick.af.url,
          duration: pick.af.duration || null,
          ...(debug ? { attempts } : {}),
        });
        return;
      }
    }
    res.status(503).json({ error: 'All Soundstripe request variants failed', attempts });
  } catch (err) {
    res.status(503).json({ error: 'Soundstripe request failed: ' + err.message, attempts });
  }
};
