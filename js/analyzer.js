/* Analyzer — turns a Juniper memory-episode export into a structured profile
 * that the gift engine and all three experiences run on.
 * Everything is computed client-side from the uploaded zip; nothing is hard-coded
 * to a particular user's data.
 */
const Analyzer = (() => {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const NON_NAMES = new Set(['Family','Kids','Kid','Children','Child','Daughter','Son','Partner','Friends','Friend',
    'Grandparents','Grandkids','Grandma','Grandpa','Students','Teachers','Boys','Girls','Dog','Cat','My','The','A','And','Her','His']);

  function parseEpisodes(files) {
    // Group zip entries by episode id, tolerating any path prefix
    const byId = new Map();
    for (const [path, text] of files) {
      const m = path.match(/memory-episode-(\d+)\/memory-episode-\1(?:-(photos|videos))?\.json$/);
      if (!m) continue;
      const id = m[1];
      if (!byId.has(id)) byId.set(id, {});
      byId.get(id)[m[2] || 'main'] = text;
    }

    const episodes = [];
    for (const [id, parts] of byId) {
      if (!parts.main) continue; // some exports have folders with no main json — skip
      let ep, photos = [];
      try { ep = JSON.parse(parts.main); } catch { continue; }
      try { photos = parts.photos ? JSON.parse(parts.photos) : []; } catch { photos = []; }

      const photoById = new Map(photos.map(p => [p.id, p]));
      const thumb = pid => photoById.get(pid)?.thumbnail_url || photoById.get(pid)?.url || null;

      const dates = (ep.timeline || []).map(t => t.timestamp).filter(Boolean).sort();
      const locations = [...new Set((ep.timeline || []).map(t => t.location).filter(Boolean))];
      const mapLocs = (ep.map?.locations || []).map(l => l.name).filter(Boolean);

      episodes.push({
        id,
        title: ep.medium_title || ep.snappy_title || ep.one_word_title || 'Untitled',
        snappy: ep.snappy_title || '',
        detailed: ep.detailed_title || '',
        descriptive: ep.descriptive_title || '',
        oneWord: ep.one_word_title || '',
        summary: ep.memory_summary || '',
        narrative: ep.memory_narrative || '',
        intro: ep.editorial_intro || '',
        score: ep.score || 0,
        tone: ep.emotional_tone || '',
        categories: (ep.categories || []).map(c => c.main),
        subcategories: (ep.categories || []).flatMap(c => c.subcategories || []),
        date: dates[0] || null,
        locations,
        mapLocations: mapLocs,
        coverUrl: thumb(ep.cover_photo_id) || (photos[0] && (photos[0].thumbnail_url || photos[0].url)) || null,
        photoUrls: photos.map(p => p.thumbnail_url || p.url).filter(Boolean),
        photoCount: photos.length,
        pullQuotes: (ep.magazine_sections || []).map(s => s.pull_quote).filter(Boolean),
      });
    }
    episodes.sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
    return episodes;
  }

  function extractPeople(episodes) {
    const blob = episodes.map(e => [e.descriptive, e.summary, e.narrative].join(' ')).join(' ');
    const people = {
      partner: /\bpartner\b/i.test(blob),
      kids: /\b(kids?|children|child)\b/i.test(blob),
      daughter: /\bdaughters?\b/i.test(blob),
      son: /\bsons?\b/i.test(blob),
      grandparents: /\bgrand(parents|ma|pa|mother|father)\b/i.test(blob),
      grandkids: /\bgrand(kids|children|sons|daughters)\b/i.test(blob),
      friends: /\bfriends?\b/i.test(blob),
      pets: /\b(dog|puppy|cat|kitten)\b/i.test(blob),
      names: [],
    };
    // Names from "with X and Y" phrases in descriptive titles
    const nameCounts = new Map();
    for (const e of episodes) {
      const m = (e.descriptive || '').match(/\bwith\s+([A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)*)\s*$/);
      if (!m) continue;
      for (const n of m[1].split(/\s+and\s+/)) {
        if (!NON_NAMES.has(n)) nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
      }
    }
    // Also scan summaries/narratives for names paired with kid words ("Evie's science fair")
    const nameRe = /\b([A-Z][a-z]{2,})(?:'s)?\b/g;
    for (const e of episodes) {
      const text = e.summary + ' ' + e.narrative;
      let m;
      while ((m = nameRe.exec(text))) {
        const n = m[1];
        if (NON_NAMES.has(n)) continue;
        if (nameCounts.has(n)) nameCounts.set(n, nameCounts.get(n) + 1);
      }
    }
    people.names = [...nameCounts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 4);
    return people;
  }

  function analyze(files) {
    const episodes = parseEpisodes(files);
    if (!episodes.length) throw new Error('No memory episodes found in this zip. Expected folders like memory-episode-12345/.');

    // --- counts, dates, places ---
    const catCounts = new Map(), locCounts = new Map(), toneCounts = new Map(), monthBest = new Map();
    let photoCount = 0;
    for (const e of episodes) {
      photoCount += e.photoCount;
      e.categories.forEach((c, i) => catCounts.set(c, (catCounts.get(c) || 0) + (3 - Math.min(i, 2))));
      e.locations.forEach(l => locCounts.set(l, (locCounts.get(l) || 0) + 1));
      if (e.tone) toneCounts.set(e.tone, (toneCounts.get(e.tone) || 0) + 1);
      if (e.date && e.coverUrl) {
        const key = e.date.slice(0, 7);
        const cur = monthBest.get(key);
        if (!cur || e.score > cur.score) monthBest.set(key, e);
      }
    }
    const dates = episodes.map(e => e.date).filter(Boolean).sort();
    const sortedLocs = [...locCounts.entries()].sort((a, b) => b[1] - a[1]);
    const homeBase = sortedLocs[0] ? sortedLocs[0][0] : null;
    const topCategories = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const topTone = [...toneCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    // --- clusters ---
    const has = (e, cat) => e.categories.includes(cat);
    const clusters = {
      travel: episodes.filter(e => has(e, 'Travel')).sort((a, b) => b.score - a.score),
      holidays: episodes.filter(e => has(e, 'National & Faith Holidays')).sort((a, b) => b.score - a.score),
      celebrations: episodes.filter(e => has(e, 'Celebrations')).sort((a, b) => b.score - a.score),
      milestones: episodes.filter(e => has(e, 'Milestones') || has(e, 'Achievements')).sort((a, b) => b.score - a.score),
      everyday: episodes.filter(e => has(e, 'Everyday Life') || has(e, 'Family')).sort((a, b) => b.score - a.score),
      friends: episodes.filter(e => has(e, 'Friendships')).sort((a, b) => b.score - a.score),
      romantic: episodes.filter(e => has(e, 'Relationships (Romantic)')).sort((a, b) => b.score - a.score),
    };

    const topMoments = [...episodes].sort((a, b) => b.score - a.score).filter(e => e.coverUrl).slice(0, 8);

    const TONE_LABELS = {
      joyful_and_playful: { label: 'Joyful & Playful', line: 'If your months had a soundtrack, it would be laughter.' },
      tender_and_intimate: { label: 'Tender & Intimate', line: 'The quiet moments carried the most weight.' },
      sensory_and_embodied: { label: 'Sensory & Alive', line: 'You lived it with all five senses.' },
      transformational_and_identity_based: { label: 'Transformational', line: 'This was a season of becoming.' },
      nostalgic_and_reflective: { label: 'Nostalgic & Reflective', line: 'You looked back as much as forward.' },
    };

    const fmt = iso => { const d = new Date(iso); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };

    return {
      meta: {
        episodeCount: episodes.length,
        photoCount,
        cityCount: sortedLocs.length,
        start: dates[0], end: dates[dates.length - 1],
        startLabel: dates[0] ? fmt(dates[0]) : '', endLabel: dates.length ? fmt(dates[dates.length - 1]) : '',
        monthSpan: monthBest.size,
      },
      episodes,
      people: extractPeople(episodes),
      homeBase,
      places: sortedLocs.map(([name, count]) => ({ name, count })),
      awayPlaces: sortedLocs.slice(1).filter(([, c]) => c >= 2).map(([n]) => n),
      topCategories,
      tone: topTone ? {
        key: topTone[0],
        share: Math.round(100 * topTone[1] / episodes.length),
        ...(TONE_LABELS[topTone[0]] || { label: topTone[0].replace(/_/g, ' '), line: '' }),
      } : null,
      clusters,
      topMoments,
      monthlyBest: [...monthBest.entries()].sort().map(([month, e]) => ({
        month, label: MONTHS[+month.slice(5, 7) - 1], url: e.coverUrl, title: e.title,
      })),
    };
  }

  return { analyze };
})();
