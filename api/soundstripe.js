/* Vercel serverless function — proxies Soundstripe so the API key stays server-side.
 * Set SOUNDSTRIPE_API_KEY in the Vercel project's environment variables.
 *
 * GET /api/soundstripe?q=<search terms>
 * → { title, artist, url, duration }   (url = playable mp3)
 * → 503 { error }                       when no key is configured or upstream fails
 */
const BASE = 'https://api.soundstripe.com/v1';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const key = process.env.SOUNDSTRIPE_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'SOUNDSTRIPE_API_KEY is not configured' });
    return;
  }

  const q = (req.query.q || 'uplifting warm indie').toString().slice(0, 120);
  const headers = {
    Authorization: `Token ${key}`,
    Accept: 'application/vnd.api+json',
  };

  try {
    // Search first; fall back to an unfiltered page if the filter errors.
    const urls = [
      `${BASE}/songs?filter[q]=${encodeURIComponent(q)}&include=audio_files&page[size]=20`,
      `${BASE}/songs?include=audio_files&page[size]=20`,
    ];
    let data = null;
    for (const url of urls) {
      const r = await fetch(url, { headers });
      if (r.ok) { data = await r.json(); break; }
    }
    if (!data || !Array.isArray(data.data) || !data.data.length) {
      res.status(503).json({ error: 'No songs returned from Soundstripe' });
      return;
    }

    // Index included audio files by id, keep only ones with a playable mp3.
    const audioById = new Map();
    for (const inc of data.included || []) {
      if (inc.type !== 'audio_files') continue;
      const mp3 = inc.attributes?.versions?.mp3 || inc.attributes?.versions?.wav;
      if (mp3) audioById.set(inc.id, { url: mp3, duration: inc.attributes?.duration });
    }

    // Prefer instrumental-friendly picks: walk songs in order, take the first with audio.
    const candidates = [];
    for (const song of data.data) {
      const refs = song.relationships?.audio_files?.data || [];
      for (const ref of refs) {
        const af = audioById.get(ref.id);
        if (af) { candidates.push({ song, af }); break; }
      }
    }
    if (!candidates.length) {
      res.status(503).json({ error: 'No playable audio files in Soundstripe response' });
      return;
    }

    // Vary the pick per request so repeat demos don't feel canned.
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).json({
      title: pick.song.attributes?.title || 'Untitled',
      artist: pick.song.attributes?.artist_name || pick.song.attributes?.artist || 'Soundstripe artist',
      url: pick.af.url,
      duration: pick.af.duration || null,
    });
  } catch (err) {
    res.status(503).json({ error: 'Soundstripe request failed: ' + err.message });
  }
};
