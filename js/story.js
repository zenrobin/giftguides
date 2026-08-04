/* Story Mode — a conversational gift assistant that opens the conversation
 * already knowing the user's memories. Deterministic dialog engine for the
 * prototype: chips + free-text keyword intents, all responses grounded in
 * the analyzed data.
 */
const Story = (() => {
  const esc = Mockups.esc;
  let thread, chipsEl, a, gifts, shown;

  const delay = ms => new Promise(r => setTimeout(r, ms));

  function scroll() { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }

  async function bot(html, ms = 700) {
    const t = document.createElement('div');
    t.className = 'msg msg-bot';
    t.innerHTML = '<div class="bubble typing"><i></i><i></i><i></i></div>';
    thread.appendChild(t); scroll();
    await delay(ms);
    t.innerHTML = `<div class="bubble">${html}</div>`;
    scroll();
  }

  function user(text) {
    const m = document.createElement('div');
    m.className = 'msg msg-user';
    m.innerHTML = `<div class="bubble">${esc(text)}</div>`;
    thread.appendChild(m); scroll();
  }

  async function giftCard(g) {
    if (!g) return;
    shown.add(g.id);
    await delay(500);
    const wrap = document.createElement('div');
    wrap.className = 'story-gift';
    wrap.innerHTML = App.giftCardHTML(g);
    thread.appendChild(wrap); scroll();
  }

  function chips(list) {
    chipsEl.innerHTML = '';
    list.forEach(([label, handler], i) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = label;
      b.style.animationDelay = (i * 70) + 'ms';
      b.addEventListener('click', () => { user(label); chipsEl.innerHTML = ''; handler(); });
      chipsEl.appendChild(b);
    });
    scroll();
  }

  const g = id => gifts.find(x => x.id === id);
  const unseen = () => gifts.filter(x => !shown.has(x.id));

  // ── conversation nodes ──
  async function openingFromGuide() {
    await bot(`So the guide didn't nail it — good, I like a challenge. You browsed the whole list, which tells me the obvious picks (the year book, the trip book) aren't what you're after.`, 1000);
    await bot(`Help me narrow it: what was off? Too predictable, too big, or is it for someone the guide didn't cover?`, 1100);
    chips([
      ['Too predictable — surprise me', surprise],
      ['Something smaller / cheaper', budget],
      ['It’s for someone specific', () => { botThen('Tell me who — or pick from your usual suspects:', mainChips); }],
      ['Actually, show me the classics', forFamily],
    ]);
  }

  async function opening() {
    const p = a.people;
    const names = p.names.slice(0, 2);
    const top = a.topMoments[0];
    await bot(`Hi! I'm your Mixbook gift assistant. I've been looking back through your year — <b>${a.meta.episodeCount} memories</b> between ${esc(a.meta.startLabel)} and ${esc(a.meta.endLabel)}. ${top ? `That “${esc(top.title)}” moment? Genuinely great.` : ''}`, 900);
    await bot(`I already have gift ideas for ${names.length ? `<b>${esc(names.join(' and '))}</b>, ` : ''}${p.partner ? 'your partner, ' : ''}${p.grandparents || p.grandkids ? 'the grandparents, ' : ''}and the whole family — all built from your own photos. Who are we gifting for?`, 1100);
    mainChips();
  }

  function mainChips() {
    const p = a.people;
    const list = [];
    if (p.partner) list.push(['💜 My partner', forPartner]);
    if (p.kids || p.names.length) list.push(['🧒 The kids', forKids]);
    if (p.grandparents || p.grandkids) list.push(['👵 The grandparents', forGrandparents]);
    list.push(['🏠 The whole family', forFamily]);
    list.push(['✨ Surprise me', surprise]);
    chips(list);
  }

  function followUps() {
    const list = [];
    if (unseen().length) list.push(['Show me another idea', another]);
    list.push(['Something under $30', budget]);
    if (a.clusters.travel.length) list.push([`What about “${a.clusters.travel[0].title}”?`, travel]);
    list.push(['Gift for someone else', () => { botThen('Of course — who else is on your list?', mainChips); }]);
    chips(list);
  }

  async function botThen(html, next, ms = 800) { await bot(html, ms); next(); }

  async function forPartner() {
    const rom = a.clusters.romantic[0];
    await bot(`Good choice. You two logged <b>${a.clusters.romantic.length || 'a few'} just-the-two-of-you memories</b> this year${rom ? ` — including “${esc(rom.title)}”` : ''}. This is the one I'd make:`, 1000);
    await giftCard(g('partnerbook') || g('travelbook') || g('yearbook'));
    await bot(`Layflat pages, because getaway photos deserve full spreads. Want it in the cart, or should I keep looking?`, 900);
    followUps();
  }

  async function forKids() {
    const mile = a.clusters.milestones[0];
    await bot(`${mile ? `They had a big year — “${esc(mile.title)}” alone is worth framing. Literally:` : 'Here’s what I’d make for them:'}`, 1000);
    await giftCard(g('milestoneframe') || g('yearbook'));
    if (g('calendar')) {
      await bot(`And if you want something the whole family opens every day, this calendar uses their best moment from each month:`, 900);
      await giftCard(g('calendar'));
    }
    followUps();
  }

  async function forGrandparents() {
    await bot(`Grandparents are the easiest audience in the world — they want <b>the kids, in their hands, at all times</b>. This one is purse-sized on purpose:`, 1000);
    await giftCard(g('bragbook') || g('yearbook'));
    await bot(`At ${Gifts.price(g('bragbook') || g('yearbook'))} it's an easy “just because” gift. Ship it straight to their door.`, 900);
    followUps();
  }

  async function forFamily() {
    await bot(`Then let's go big. Every memory from ${esc(a.meta.startLabel)} to ${esc(a.meta.endLabel)}, in one book:`, 1000);
    await giftCard(g('yearbook'));
    if (g('canvas')) {
      await bot(`Or make the single best moment of the year impossible to miss:`, 800);
      await giftCard(g('canvas'));
    }
    followUps();
  }

  async function surprise() {
    const pick = unseen()[Math.floor(Math.random() * Math.max(1, unseen().length))] || gifts[0];
    await bot(`Okay — my wildcard. Based on ${esc((pick.why[0] || '').toLowerCase().replace(/\.$/, ''))}:`, 1100);
    await giftCard(pick);
    followUps();
  }

  async function another() {
    const pick = unseen()[0];
    if (!pick) { await bot(`That's my whole shortlist! The <b>Classic Guide</b> lays them all out side by side if you'd like to compare.`, 800); chips([['Open the Classic Guide', () => location.hash = '#/guide']]); return; }
    await bot(`Here's another one — ${esc(pick.recipient.toLowerCase())}:`, 900);
    await giftCard(pick);
    followUps();
  }

  async function budget() {
    const cheap = [...gifts].sort((x, y) => x.price - y.price)[0];
    await bot(`The most giftable thing under $30 is this one — small price, disproportionate emotional damage (the good kind):`, 1000);
    await giftCard(cheap);
    followUps();
  }

  async function travel() {
    const trip = a.clusters.travel[0];
    await bot(`“${esc(trip.title)}” — ${esc(trip.summary)}`, 1000);
    await giftCard(g('travelbook') || g('yearbook'));
    followUps();
  }

  async function holidays() {
    await bot(`You made ${a.clusters.holidays.length} holiday memories this year. Which means next season's card photo already exists — I found it:`, 1000);
    await giftCard(g('cards') || g('yearbook'));
    followUps();
  }

  // free-text intents
  function handleFreeText(text) {
    user(text);
    const t = text.toLowerCase();
    if (/(partner|wife|husband|spouse|anniversary|date)/.test(t)) return forPartner();
    if (/(kid|child|son|daughter|school)/.test(t) || a.people.names.some(n => t.includes(n.toLowerCase()))) return forKids();
    if (/(grand)/.test(t)) return forGrandparents();
    if (/(family|everyone|year ?book|big book)/.test(t)) return forFamily();
    if (/(trip|travel|vacation|getaway|road)/.test(t)) return travel();
    if (/(holiday|christmas|card)/.test(t)) return holidays();
    if (/(cheap|budget|under|affordable|\$)/.test(t)) return budget();
    if (/(calendar)/.test(t) && g('calendar')) return (async () => { await bot('A calendar is the sleeper hit of photo gifts — 365 days of shelf time:', 900); await giftCard(g('calendar')); followUps(); })();
    if (/(collage|magnet|set of|everyone|each kid|whole family photo)/.test(t) && g('memberset'))
      return (async () => { await bot('You want everyone in one gift — that’s exactly what “the set” is for. One photo per person, one moment, your pick of format:', 900); await giftCard(g('memberset')); followUps(); })();
    if (/(canvas|wall|print|frame)/.test(t)) return (async () => { await bot('For walls, I have two favorites from your year:', 900); await giftCard(g('canvas') || g('milestoneframe')); followUps(); })();
    if (/(surprise|idea|another|more|else)/.test(t)) return another();
    return (async () => {
      await bot(`I can help with gifts for <b>your partner, the kids, grandparents, or the whole family</b> — or ask me about the trips, the holidays, or something on a budget.`, 900);
      mainChips();
    })();
  }

  function render(root, state) {
    a = state.analysis; gifts = state.gifts; shown = new Set();
    root.innerHTML = `
      <div class="story">
        <div class="story-thread" id="story-thread"></div>
        <div class="chips" id="story-chips"></div>
        <form class="story-input" id="story-form">
          <input id="story-text" type="text" placeholder="Ask me anything about gifting your year…" autocomplete="off">
          <button class="btn btn-primary btn-sm" type="submit">Send</button>
        </form>
      </div>`;
    thread = root.querySelector('#story-thread');
    chipsEl = root.querySelector('#story-chips');
    root.querySelector('#story-form').addEventListener('submit', e => {
      e.preventDefault();
      const input = root.querySelector('#story-text');
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      chipsEl.innerHTML = '';
      handleFreeText(v);
    });
    const entry = sessionStorage.getItem('gg.storyEntry');
    sessionStorage.removeItem('gg.storyEntry');
    if (entry === 'guide-different') openingFromGuide();
    else opening();
  }

  return { render };
})();
