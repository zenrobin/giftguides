/* Gift engine — maps a memory profile onto Mixbook's product catalog.
 * Prices reflect mixbook.com list pricing at time of writing (prototype-approximate).
 * Products marked concept:true are new-product ideas this prototype is exploring —
 * ways to leverage existing print capabilities into gifts that are a pain to
 * assemble manually (multi-person sets, collage layouts, group copies).
 *
 * Every rule decision is recorded in Gifts.trace for the transparency console.
 */
const Gifts = (() => {

  const CATALOG = {
    hardcover: { product: 'Hardcover Photo Book', spec: '8.5×11″ · 20 pages · matte finish', price: 36.99, from: true, mock: 'book' },
    layflat: { product: 'Premium Layflat Photo Book', spec: '11×8.5″ landscape · thick layflat pages', price: 74.99, from: true, mock: 'layflat' },
    softcover: { product: 'Softcover Photo Book', spec: '6×6″ · 20 pages · travel-size', price: 16.99, from: true, mock: 'minibook' },
    calendar: { product: 'Wall Calendar', spec: '8.5×11″ · 12 months · start any month', price: 24.99, from: true, mock: 'calendar' },
    canvas: { product: 'Canvas Print', spec: '16×20″ · gallery wrap · ready to hang', price: 49.99, from: true, mock: 'canvas' },
    framed: { product: 'Framed Print', spec: '11×14″ · matted · black gallery frame', price: 59.99, from: true, mock: 'frame' },
    cards: { product: 'Foil Holiday Cards', spec: 'Set of 25 · 5×7″ flat · envelopes included', price: 61.25, from: true, mock: 'cards' },
    prints: { product: 'Photo Prints Set', spec: '25 prints · 4×6″ · matte', price: 12.25, from: true, mock: 'prints' },
  };

  // Format options for "the set" — one moment, one photo per person,
  // offered across products. The collage/stairway/magnet formats are concepts.
  const SET_VARIANTS = [
    { key: 'collage', product: 'Collage Frame', spec: 'One frame · single matte board · one cut-out opening per person', price: 89.99, mock: 'collage', concept: true },
    { key: 'canvascollage', product: 'Canvas Collage Print', spec: '20×24″ single canvas · grid layout printed as one image', price: 64.99, mock: 'canvas', concept: true },
    { key: 'stairway', product: 'Stairway Gallery Set', spec: 'One framed print per person · stepped layout for the stairway wall', price: 129.99, mock: 'stairfames', concept: true },
    { key: 'magnets', product: 'Photo Magnet Set', spec: 'One magnet per person · 3×3″ · thick matte board', price: 24.99, mock: 'magnets', concept: true },
    { key: 'prints', product: 'Framed Print Set', spec: 'One 5×7″ frame per person · mix & match', price: 74.99, mock: 'prints', concept: true },
  ];

  const uniq = arr => [...new Set(arr)];
  const listWords = arr => arr.length <= 1 ? (arr[0] || '') :
    arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];

  let trace = [];
  const fired = (rule, reason) => trace.push({ rule, fired: true, reason });
  const skipped = (rule, reason) => trace.push({ rule, fired: false, reason });

  function build(a) {
    trace = [];
    const gifts = [];
    const p = a.people;
    const kidNames = p.names.slice(0, 2);
    const stage = p.kidStage; // baby | young | teen | null
    const add = (id, item, extra) => gifts.push({ id, ...CATALOG[item], itemKey: item, ...extra });

    // 1 — The everything book. Always applicable, adapts to archive size.
    const best = a.topMoments[0];
    const smallArchive = a.meta.episodeCount < 12;
    fired('yearbook', `always on — ${a.meta.episodeCount} memories in window${smallArchive ? ' (small archive: framed as a keepsake, not a “big year”)' : ''}`);
    add('yearbook', 'hardcover', {
      title: smallArchive ? 'The Moments That Made It' : `The Big Year: ${a.meta.startLabel} – ${a.meta.endLabel}`,
      recipient: p.kids || p.partner ? 'For the whole family' : 'For you',
      cover: best?.coverUrl, photos: a.topMoments.map(m => m.coverUrl),
      why: [
        `Built from ${smallArchive ? 'every one of' : 'all'} ${a.meta.episodeCount} memories and ${a.meta.photoCount.toLocaleString()} photos between ${a.meta.startLabel} and ${a.meta.endLabel}.`,
        best ? `Opens with your highest-rated moment: “${best.title}.”` : '',
      ].filter(Boolean),
      chapters: a.topMoments.slice(0, 5).map(m => m.title),
    });

    // 2 — The Set: one photo per person from a single event, in your pick of format.
    if (a.memberSet && a.memberSet.photos.length >= 3) {
      fired('memberset', `found ${a.memberSet.photos.length} solo portraits in “${a.memberSet.episodeTitle}” — offered across ${SET_VARIANTS.length} formats`);
      const ms = a.memberSet;
      add('memberset', 'framed', {
        title: `The Set: Everyone at “${ms.episodeTitle}”`,
        recipient: 'For the wall (or the fridge)',
        cover: ms.photos[0].url, photos: ms.photos.map(x => x.url),
        variants: SET_VARIANTS,
        variantKey: 'collage',
        why: [
          `${ms.photos.length} solo portraits, all from the same day${kidNames.length ? ` — starring ${listWords(kidNames)} & co.` : ''} — one opening per person, matching light, matching mood.`,
          'The kind of gift people mean to assemble by hand and never do: matching photos, matching crops, one layout.',
        ],
        concept: true,
      });
    } else {
      skipped('memberset', 'needs ≥3 solo portraits from one event (per-photo person detection)');
    }

    // 3 — Travel layflat, with group copies for everyone on the trip
    const trip = a.clusters.travel[0];
    if (trip) {
      const tripPlaces = uniq(a.clusters.travel.flatMap(e => e.locations)).filter(l => l !== a.homeBase).slice(0, 4);
      const travelers = 1 + (p.partner ? 1 : 0) + (kidNames.length || (p.kids ? 2 : 0));
      fired('travelbook', `${a.clusters.travel.length} travel memories; ~${travelers} travelers → group-copy offer (15% volume discount)`);
      add('travelbook', 'layflat', {
        title: trip.title,
        recipient: p.partner ? 'For your partner' : 'For the travelers',
        cover: trip.coverUrl, photos: trip.photoUrls.slice(0, 8),
        group: travelers >= 3 ? {
          copies: travelers,
          discountPct: 15,
          note: `${travelers} of you were on this trip — everyone gets their own copy. Group pages (like our school book program) let trip-mates or party guests buy theirs.`,
        } : null,
        why: [
          `Your ${a.clusters.travel.length} adventures away from ${a.homeBase || 'home'} — ${listWords(tripPlaces)} — deserve panoramic, edge-to-edge spreads.`,
          trip.intro ? `“${trip.intro.split('. ')[0]}.”` : '',
        ].filter(Boolean),
        chapters: a.clusters.travel.slice(0, 5).map(e => e.title),
      });
    } else {
      skipped('travelbook', 'no travel-category memories inside the guardrail window');
    }

    // 4 — Wall calendar, if the memories span enough months
    if (a.monthlyBest.length >= 4) {
      fired('calendar', `${a.monthlyBest.length} months with a standout memory`);
      add('calendar', 'calendar', {
        title: `${a.homeBase || 'Our'} Days: A Year of Us`,
        recipient: 'For the kitchen wall',
        cover: a.monthlyBest[0].url, photos: a.monthlyBest.map(m => m.url),
        why: [
          `One standout memory for each of the ${a.monthlyBest.length} months we found — ${a.monthlyBest[0].label} kicks off with “${a.monthlyBest[0].title}.”`,
          'The gift that gets looked at every single day.',
        ],
        months: a.monthlyBest,
      });
    } else {
      skipped('calendar', `only ${a.monthlyBest.length} months covered — needs ≥4`);
    }

    // 5 — Grandparents. Babies make this the HEADLINE gift: the gifting is for them.
    if (p.grandparents || p.grandkids || stage === 'baby') {
      const kidEps = a.clusters.everyday.filter(e => e.coverUrl).slice(0, 6);
      fired('bragbook', stage === 'baby'
        ? 'baby detected — at this age the gift is really for the grandparents'
        : 'grandparents/grandkids detected in memories');
      add('bragbook', 'softcover', {
        title: kidNames.length ? `${listWords(kidNames)}: The Highlights` : 'The Grandkid Chronicles',
        recipient: 'For Grandma & Grandpa',
        cover: kidEps[0]?.coverUrl, photos: kidEps.map(e => e.coverUrl),
        why: [
          stage === 'baby'
            ? 'Babies won’t remember this year — the grandparents never forget it. A purse-sized brag book of every best moment so far.'
            : `A purse-sized brag book of ${kidNames.length ? listWords(kidNames) + '’s' : 'the kids’'} best moments — school triumphs, holidays, and everyday magic.`,
          'Small enough to carry, dangerous enough to stop strangers in the grocery store.',
        ],
      });
    } else {
      skipped('bragbook', 'no grandparents, grandkids, or baby signals found');
    }

    // 6 — Partner getaways
    if (p.partner && a.clusters.romantic.length) {
      const rom = a.clusters.romantic.filter(e => e.coverUrl);
      const romPlaces = uniq(rom.flatMap(e => e.locations)).slice(0, 4);
      fired('partnerbook', `partner + ${a.clusters.romantic.length} romantic-category memories`);
      add('partnerbook', 'layflat', {
        title: 'Just Us: Date Nights & Getaways',
        recipient: 'For your partner',
        cover: rom[0]?.coverUrl, photos: rom.flatMap(e => e.photoUrls.slice(0, 2)).slice(0, 8),
        why: [
          `${rom.length} memories that were just the two of you${romPlaces.length ? ' — ' + listWords(romPlaces) : ''}.`,
          rom[0]?.pullQuotes?.[0] ? `“${rom[0].pullQuotes[0]}”` : 'Proof you still date each other.',
        ],
        chapters: rom.slice(0, 5).map(e => e.title),
      });
    } else {
      skipped('partnerbook', p.partner ? 'no romantic-category memories in window' : 'no partner detected');
    }

    // 7 — Milestone framed print, tuned by kid stage
    const mile = a.clusters.milestones.find(e => e.coverUrl);
    if (mile) {
      fired('milestoneframe', `top milestone “${mile.title}”${stage ? ` · kid stage: ${stage}` : ''}`);
      add('milestoneframe', 'framed', {
        title: `“${mile.snappy || mile.title}” — framed`,
        recipient: stage === 'teen' ? 'For their room (dorm-proof)' : p.kids ? 'For the kids’ room' : 'For your wall',
        cover: mile.coverUrl, photos: [mile.coverUrl],
        why: [
          `${mile.summary}`,
          stage === 'teen'
            ? 'Teens decorate their own walls — prints and frames they pick beat anything you pick for them.'
            : 'Milestones fade from feeds. They don’t fade from walls.',
        ],
      });
    } else {
      skipped('milestoneframe', 'no milestone/achievement memories with a usable photo');
    }

    // 8 — Canvas of the single best moment
    if (best) {
      fired('canvas', `top moment “${best.title}” scored ${best.score}/100`);
      add('canvas', 'canvas', {
        title: `The Moment: ${best.snappy || best.title}`,
        recipient: 'For the living room',
        cover: best.coverUrl, photos: [best.coverUrl],
        why: [
          `Your highest-scoring memory (${best.score}/100)${best.locations[0] ? ', captured in ' + best.locations[0] : ''}, at statement size.`,
        ],
      });
    }

    // 9 — Holiday cards
    if (a.clusters.holidays.length) {
      const hol = a.clusters.holidays.filter(e => e.coverUrl);
      fired('cards', `${a.clusters.holidays.length} holiday memories`);
      add('cards', 'cards', {
        title: 'Next Season’s Holiday Card, Solved',
        recipient: 'For everyone on the list',
        cover: hol[0]?.coverUrl, photos: hol.slice(0, 4).map(e => e.coverUrl),
        why: [
          `You made ${a.clusters.holidays.length} holiday memories this year — the card photo is already taken. We found it.`,
        ],
      });
    } else {
      skipped('cards', 'no holiday-category memories in window');
    }

    // 10 — Friends, for people whose year wasn't a family year
    if (!p.kids && !p.partner && a.clusters.friends.length) {
      const fr = a.clusters.friends.filter(e => e.coverUrl);
      fired('friendsbook', 'no partner/kids detected — friends cluster becomes a headline gift');
      add('friendsbook', 'softcover', {
        title: 'The Ones Who Showed Up',
        recipient: 'For your people',
        cover: fr[0]?.coverUrl, photos: fr.map(e => e.coverUrl).slice(0, 6),
        why: [
          `${a.clusters.friends.length} memories with friends — chosen family counts double.`,
          'One copy for you. More for the group chat.',
        ],
      });
    } else if (a.clusters.friends.length) {
      skipped('friendsbook', 'friends cluster exists but family gifts take precedence for this profile');
    }

    // 11 — Fallback: a personal keepsake so nobody gets an empty guide.
    if (gifts.length < 3) {
      fired('printsfallback', `only ${gifts.length} gifts generated — adding a universal personal pick`);
      add('printsfallback', 'prints', {
        title: 'The Shoebox, Curated',
        recipient: 'For you',
        cover: best?.coverUrl, photos: a.topMoments.map(m => m.coverUrl).slice(0, 3),
        why: [
          'Your best photos as real prints — for the desk, the mirror, the wallet, the people you visit.',
          'The smallest meaningful gift we make, and the one everyone actually keeps.',
        ],
      });
    }

    return gifts;
  }

  // Variant helpers — a gift with variants derives product/spec/price/mock from the pick.
  function resolve(g, variantKey) {
    if (!g.variants) return g;
    const v = g.variants.find(x => x.key === (variantKey || g.variantKey)) || g.variants[0];
    return { ...g, product: v.product, spec: v.spec, price: v.price, mock: v.mock, from: false, concept: v.concept };
  }

  const price = g => (g.from ? 'from ' : '') + '$' + g.price.toFixed(2);

  return { build, price, resolve, CATALOG, SET_VARIANTS, get trace() { return trace; } };
})();
