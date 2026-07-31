/* Gift engine — maps a memory profile onto Mixbook's product catalog.
 * Prices reflect mixbook.com list pricing at time of writing (prototype-approximate).
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

  const uniq = arr => [...new Set(arr)];
  const listWords = arr => arr.length <= 1 ? (arr[0] || '') :
    arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];

  function build(a) {
    const gifts = [];
    const p = a.people;
    const kidNames = p.names.slice(0, 2);
    const add = (id, item, extra) => gifts.push({ id, ...CATALOG[item], itemKey: item, ...extra });

    // 1 — The everything book. Always applicable.
    const best = a.topMoments[0];
    add('yearbook', 'hardcover', {
      title: `The Big Year: ${a.meta.startLabel} – ${a.meta.endLabel}`,
      recipient: 'For the whole family',
      cover: best?.coverUrl, photos: a.topMoments.map(m => m.coverUrl),
      why: [
        `Built from all ${a.meta.episodeCount} memories and ${a.meta.photoCount.toLocaleString()} photos between ${a.meta.startLabel} and ${a.meta.endLabel}.`,
        best ? `Opens with your highest-rated moment: “${best.title}.”` : '',
      ].filter(Boolean),
      chapters: a.topMoments.slice(0, 5).map(m => m.title),
    });

    // 2 — Travel layflat, if they traveled
    const trip = a.clusters.travel[0];
    if (trip) {
      const tripPlaces = uniq(a.clusters.travel.flatMap(e => e.locations)).filter(l => l !== a.homeBase).slice(0, 4);
      add('travelbook', 'layflat', {
        title: trip.title,
        recipient: p.partner ? 'For your partner' : 'For the travelers',
        cover: trip.coverUrl, photos: trip.photoUrls.slice(0, 8),
        why: [
          `Your ${a.clusters.travel.length} adventures away from ${a.homeBase || 'home'} — ${listWords(tripPlaces)} — deserve panoramic, edge-to-edge spreads.`,
          trip.intro ? `“${trip.intro.split('. ')[0]}.”` : '',
        ].filter(Boolean),
        chapters: a.clusters.travel.slice(0, 5).map(e => e.title),
      });
    }

    // 3 — Wall calendar, if the memories span enough months
    if (a.monthlyBest.length >= 4) {
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
    }

    // 4 — Grandparents brag book
    if (p.grandparents || p.grandkids) {
      const kidEps = a.clusters.everyday.filter(e => e.coverUrl).slice(0, 6);
      add('bragbook', 'softcover', {
        title: kidNames.length ? `${listWords(kidNames)}: The Highlights` : 'The Grandkid Chronicles',
        recipient: 'For Grandma & Grandpa',
        cover: kidEps[0]?.coverUrl, photos: kidEps.map(e => e.coverUrl),
        why: [
          `A purse-sized brag book of ${kidNames.length ? listWords(kidNames) + '’s' : 'the kids’'} best moments — school triumphs, holidays, and everyday magic.`,
          'Small enough to carry, dangerous enough to stop strangers in the grocery store.',
        ],
      });
    }

    // 5 — Partner getaways
    if (p.partner && a.clusters.romantic.length) {
      const rom = a.clusters.romantic.filter(e => e.coverUrl);
      const romPlaces = uniq(rom.flatMap(e => e.locations)).slice(0, 4);
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
    }

    // 6 — Milestone framed print
    const mile = a.clusters.milestones.find(e => e.coverUrl);
    if (mile) {
      add('milestoneframe', 'framed', {
        title: `“${mile.snappy || mile.title}” — framed`,
        recipient: p.kids ? 'For the kids’ room' : 'For your wall',
        cover: mile.coverUrl, photos: [mile.coverUrl],
        why: [
          `${mile.summary}`,
          'Milestones fade from feeds. They don’t fade from walls.',
        ],
      });
    }

    // 7 — Canvas of the single best moment
    if (best) {
      add('canvas', 'canvas', {
        title: `The Moment: ${best.snappy || best.title}`,
        recipient: 'For the living room',
        cover: best.coverUrl, photos: [best.coverUrl],
        why: [
          `Your highest-scoring memory (${best.score}/100)${best.locations[0] ? ', captured in ' + best.locations[0] : ''}, at statement size.`,
        ],
      });
    }

    // 8 — Holiday cards
    if (a.clusters.holidays.length) {
      const hol = a.clusters.holidays.filter(e => e.coverUrl);
      add('cards', 'cards', {
        title: 'Next Season’s Holiday Card, Solved',
        recipient: 'For everyone on the list',
        cover: hol[0]?.coverUrl, photos: hol.slice(0, 4).map(e => e.coverUrl),
        why: [
          `You made ${a.clusters.holidays.length} holiday memories this year — the card photo is already taken. We found it.`,
        ],
      });
    }

    return gifts;
  }

  const price = g => (g.from ? 'from ' : '') + '$' + g.price.toFixed(2);

  return { build, price, CATALOG };
})();
