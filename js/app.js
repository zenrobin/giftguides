/* App shell — hash router, shared state, front door, hub, cart. */
const App = (() => {
  const esc = Mockups.esc;
  const state = {
    analysis: null,
    gifts: [],
    cart: [],
    startPoint: 'auto', // front-door demo control: auto (A/B/C assign) | story | wrapped | guide | hub
  };

  // Analytics stub — in production these become real experiment events.
  function track(event, props = {}) {
    const entry = { event, ...props, at: new Date().toISOString() };
    console.log('[track]', entry);
    try {
      const log = JSON.parse(sessionStorage.getItem('gg.events') || '[]');
      log.push(entry);
      sessionStorage.setItem('gg.events', JSON.stringify(log));
    } catch { /* non-essential */ }
  }

  // A/B/C experiment: which experience greets the user first.
  const VARIANTS = { a: 'guide', b: 'wrapped', c: 'story' };
  function assignVariant() {
    let v = localStorage.getItem('gg.variant');
    if (!VARIANTS[v]) {
      v = 'abc'[Math.floor(Math.random() * 3)];
      localStorage.setItem('gg.variant', v);
    }
    return v;
  }

  // ── persistence (survive reloads within the tab) ──
  function save() {
    try {
      sessionStorage.setItem('gg.analysis', JSON.stringify(state.analysis));
      sessionStorage.setItem('gg.cart', JSON.stringify(state.cart));
    } catch { /* oversized — in-memory only is fine for a prototype */ }
  }
  function restore() {
    try {
      const a = sessionStorage.getItem('gg.analysis');
      if (a) { state.analysis = JSON.parse(a); state.gifts = Gifts.build(state.analysis); }
      const c = sessionStorage.getItem('gg.cart');
      if (c) state.cart = JSON.parse(c);
    } catch { /* start fresh */ }
  }

  // ── cart ──
  // Items: { id, qty, variant?, group? } — variant picks a format for set-style
  // gifts; group applies the volume discount for everyone-on-the-trip copies.
  function addToCart(giftId, { go = true, variant = null, qty = 1, group = false } = {}) {
    const gift = state.gifts.find(g => g.id === giftId);
    if (!gift) return;
    const key = giftId + ':' + (variant || '') + (group ? ':group' : '');
    const existing = state.cart.find(i => i.key === key);
    if (existing) existing.qty += qty;
    else state.cart.push({ key, id: gift.id, qty, variant, group });
    track('add_to_cart', { gift: giftId, variant, qty, group });
    save();
    renderChrome();
    if (go) location.hash = '#/cart';
    else toast('Added to cart — “' + gift.title + '”');
  }
  function cartCount() { return state.cart.reduce((n, i) => n + i.qty, 0); }

  function toast(msg) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ── chrome ──
  function renderChrome() {
    const bar = document.getElementById('topbar');
    const hasData = !!state.analysis;
    bar.innerHTML = `
      <a class="logo" href="#/">mixbook <em>gift guides</em></a>
      <span class="proto-tag">Prototype</span>
      <span class="spacer"></span>
      ${hasData ? `
        <a class="nav-link" href="#/hub">Experiences</a>
        <a class="nav-link" href="#/story">Story Mode</a>
        <a class="nav-link" href="#/wrapped">Wrapped</a>
        <a class="nav-link" href="#/guide">Guide</a>
        <button class="nav-link nav-gear" id="gear-btn" title="How this guide was built">⚙</button>` : ''}
      <a class="cart-btn" href="#/cart">🛒 Cart ${cartCount() ? `<span class="cart-count">${cartCount()}</span>` : ''}</a>`;
    const gear = bar.querySelector('#gear-btn');
    if (gear) gear.addEventListener('click', showConsole);
  }

  // ── transparency console — the "how" behind the guide, for tech folks ──
  function showConsole() {
    const a = state.analysis;
    const pretty = obj => esc(JSON.stringify(obj, null, 2));
    const profile = {
      meta: a.meta,
      people: a.people,
      homeBase: a.homeBase,
      tone: a.tone,
      topCategories: a.topCategories.slice(0, 6),
      clusterSizes: Object.fromEntries(Object.entries(a.clusters).map(([k, v]) => [k, v.length])),
      memberSet: a.memberSet ? {
        fromEpisode: a.memberSet.episodeTitle,
        people: a.memberSet.photos.map(x => x.who),
      } : null,
      topMoments: a.topMoments.slice(0, 5).map(m => ({ title: m.title, score: m.score })),
    };
    const events = (() => { try { return JSON.parse(sessionStorage.getItem('gg.events') || '[]'); } catch { return []; } })();

    const veil = document.createElement('div');
    veil.className = 'modal-veil console-veil';
    veil.innerHTML = `
    <div class="console">
      <div class="console-head">
        <h2>⚙ Behind the guide</h2>
        <span>How your memories became these gifts — every rule, score, and guardrail.</span>
        <button class="wr-close" id="console-close">✕</button>
      </div>
      <div class="console-body">
        <details open>
          <summary>Guardrails <em>what's allowed to drive a gift</em></summary>
          <pre>${pretty(a.guardrails)}</pre>
        </details>
        <details open>
          <summary>Gift rules fired / skipped <em>${Gifts.trace.filter(t => t.fired).length} fired · ${Gifts.trace.filter(t => !t.fired).length} skipped</em></summary>
          <div class="trace">
            ${Gifts.trace.map(t => `<div class="trace-row ${t.fired ? 'hit' : 'miss'}">
              <b>${t.fired ? '✓' : '✗'} ${esc(t.rule)}</b><span>${esc(t.reason)}</span></div>`).join('')}
          </div>
        </details>
        <details>
          <summary>Gifting profile <em>what we extracted from your zip</em></summary>
          <pre>${pretty(profile)}</pre>
        </details>
        <details>
          <summary>Upstream Juniper prompt <em>how the memory narratives themselves were generated</em></summary>
          <pre>${a.upstreamPrompt ? esc(a.upstreamPrompt) : '(no narrative-prompt.txt found in this export)'}</pre>
        </details>
        <details>
          <summary>Session events <em>the A/B/C + interaction log (${events.length})</em></summary>
          <pre>${pretty(events)}</pre>
        </details>
        <p class="console-note">All of this runs client-side on your zip. In production, the same profile would ground an
        LLM-backed assistant — these rules are the prototype's stand-in for that prompt.</p>
      </div>
    </div>`;
    document.body.appendChild(veil);
    veil.addEventListener('click', e => { if (e.target === veil) veil.remove(); });
    veil.querySelector('#console-close').addEventListener('click', () => veil.remove());
    track('console_open', {});
  }

  // ── front door ──
  function viewFrontDoor(root) {
    state.startPoint = 'auto'; // reset so a stale choice never leaks into a new run
    root.innerHTML = `
    <div class="frontdoor">
      <div class="fd-hero">
        <div class="fd-kicker">Internal prototype · Juniper memories × Mixbook catalog</div>
        <h1>What if your memories could <em>do the gift shopping?</em></h1>
        <p class="lede">Mixbook already understands your year — the trips, the milestones, the people
        who showed up in frame. This prototype turns that understanding into a personalized,
        Spotify-Wrapped-style gift guide: browsable, conversational, and ready to buy.
        Upload a Juniper memory export to see it built around <b>your</b> life.</p>
      </div>
      <div class="fd-steps">
        <div class="fd-step"><div class="num">1</div><h3>Drop in a memory export</h3><p>A zip of Juniper memory episodes stands in for the memory data we already hold for app users. It never leaves this browser.</p></div>
        <div class="fd-step"><div class="num">2</div><h3>We read your year</h3><p>Episodes, photos, places, people and emotional tone are distilled into a gifting profile — then matched to real Mixbook products and prices.</p></div>
        <div class="fd-step"><div class="num">3</div><h3>Pick an experience</h3><p>Demo three ways to present the same guide: a conversational assistant, a cinematic “year wrapped” journey, or a classic curated page.</p></div>
      </div>
      <div class="dropzone" id="dropzone">
        <div class="dz-icon">📦</div>
        <h3>Drop your memory zip here</h3>
        <p>or click to choose a file<br><small>Expected: a zip of <code>memory-episode-*</code> folders</small></p>
        <div class="dz-file" id="dz-file"></div>
        <input type="file" id="zip-input" accept=".zip,application/zip" hidden>
      </div>
      <div id="fd-error"></div>
      <div class="fd-go"><button class="btn btn-primary" id="go-btn" disabled style="opacity:.45">✨ &nbsp;Build my gift guide</button></div>
      <p class="fd-privacy">🔒 Everything is processed locally in your browser. Nothing is uploaded anywhere.</p>
      <div class="fd-experiment">
        <span class="fd-exp-label">Demo control · start point:</span>
        <div class="fd-exp-opts">
          <button data-sp="auto" class="exp-opt active">A/B/C auto</button>
          <button data-sp="guide" class="exp-opt">A · Guide</button>
          <button data-sp="wrapped" class="exp-opt">B · Wrapped</button>
          <button data-sp="story" class="exp-opt">C · Story</button>
          <button data-sp="hub" class="exp-opt">Hub (all three)</button>
        </div>
      </div>
    </div>`;

    const dz = root.querySelector('#dropzone');
    const input = root.querySelector('#zip-input');
    const goBtn = root.querySelector('#go-btn');
    let file = null;

    const setFile = f => {
      if (!f) return;
      file = f;
      root.querySelector('#dz-file').textContent = '✓ ' + f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)';
      goBtn.disabled = false; goBtn.style.opacity = 1;
    };
    dz.addEventListener('click', () => input.click());
    input.addEventListener('change', () => setFile(input.files[0]));
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('dragover');
      setFile(e.dataTransfer.files[0]);
    });
    root.querySelectorAll('.exp-opt').forEach(b => b.addEventListener('click', () => {
      state.startPoint = b.dataset.sp;
      root.querySelectorAll('.exp-opt').forEach(x => x.classList.toggle('active', x === b));
    }));
    goBtn.addEventListener('click', async () => {
      if (!file) return;
      try {
        await runAnalysis(root, file);
        let dest = state.startPoint, variant = null;
        if (dest === 'auto') { variant = assignVariant(); dest = VARIANTS[variant]; }
        track('experiment_start', { variant: variant || 'forced', startPoint: dest });
        location.hash = '#/' + dest;
        if (variant) toast(`A/B/C experiment — variant ${variant.toUpperCase()}: starting in ${dest[0].toUpperCase() + dest.slice(1)}`);
      } catch (err) {
        route(); // back to front door
        setTimeout(() => {
          const box = document.getElementById('fd-error');
          if (box) box.innerHTML = `<div class="err-banner"><b>Couldn’t read that zip.</b> ${esc(err.message)}</div>`;
        }, 0);
      }
    });
  }

  async function runAnalysis(root, file) {
    const steps = [
      'Unpacking your memories…',
      'Reading every episode…',
      'Meeting the people in your photos…',
      'Mapping where your year took you…',
      'Listening for the emotional throughline…',
      'Matching moments to the Mixbook catalog…',
      'Wrapping your guide…',
    ];
    root.innerHTML = `
      <div class="analyzing">
        <div class="pulse-ring"></div>
        <h2 class="serif">Reading your year…</h2>
        <div class="step-line" id="step-line">${steps[0]}</div>
      </div>`;
    let i = 0;
    const tick = setInterval(() => {
      i = (i + 1) % steps.length;
      const el = document.getElementById('step-line');
      if (el) el.textContent = steps[i];
    }, 900);

    try {
      const buf = await file.arrayBuffer();
      const files = await ZipReader.readTextEntries(buf);
      const analysis = Analyzer.analyze(files);
      state.analysis = analysis;
      state.gifts = Gifts.build(analysis);
      save();
      // let the animation breathe so the moment lands
      await new Promise(r => setTimeout(r, 2400));
    } finally {
      clearInterval(tick);
    }
  }

  // ── hub ──
  function viewHub(root) {
    const a = state.analysis;
    const p = a.people;
    const cast = [
      p.partner && 'your partner',
      ...(p.names.length ? [p.names.join(' & ')] : (p.kids ? ['the kids'] : [])),
      (p.grandparents || p.grandkids) && 'the grandparents',
      p.friends && 'your friends',
      p.pets && 'a very good dog',
    ].filter(Boolean);

    root.innerHTML = `
    <div class="hub">
      <div class="hub-head">
        <h1 class="serif">We read your year. It was a good one.</h1>
        <p>${a.meta.episodeCount} memories between <b>${esc(a.meta.startLabel)}</b> and <b>${esc(a.meta.endLabel)}</b>,
        mostly around <b>${esc(a.homeBase || 'home')}</b> — starring ${esc(cast.join(', ') || 'your family')}.
        We turned them into <b>${state.gifts.length} gift ideas</b>. Now choose how you'd like them presented.</p>
      </div>
      <div class="hub-stats">
        <span class="stat-chip"><b>${a.meta.episodeCount}</b> memories</span>
        <span class="stat-chip"><b>${a.meta.photoCount.toLocaleString()}</b> photos</span>
        <span class="stat-chip"><b>${a.meta.cityCount}</b> places</span>
        <span class="stat-chip"><b>${a.clusters.travel.length}</b> trips</span>
        <span class="stat-chip">mood: <b>${esc(a.tone ? a.tone.label : '—')}</b></span>
      </div>
      <div class="hub-cards">
        <a class="hub-card" href="#/guide">
          <div class="hc-fav">★ Team favorite</div>
          <div class="hc-art hc-art-3">🎁</div>
          <h3>The Classic Guide</h3>
          <p>A beautifully practical page: every recommendation with the memory-grounded “why,” real products, real prices, one tap to cart.</p>
          <div class="hc-cta">Browse the guide →</div>
        </a>
        <a class="hub-card" href="#/wrapped">
          <div class="hc-art hc-art-2">🎬</div>
          <h3>Your Year, Wrapped</h3>
          <p>A cinematic, tap-through journey in the spirit of Spotify Wrapped — now with a soundtrack matched to your year's mood. Full screen, big feelings.</p>
          <div class="hc-cta">Play the journey →</div>
        </a>
        <a class="hub-card" href="#/story">
          <div class="hc-art hc-art-1">💬</div>
          <h3>Story Mode</h3>
          <p>A conversational gift assistant that already knows your year. It opens with ideas, answers questions, and narrows in on the perfect gift — chat-style.</p>
          <div class="hc-cta">Start the conversation →</div>
        </a>
      </div>
      <div class="hub-reset"><button class="btn btn-ghost" id="reset-btn">↺ Start over with a different memory zip</button></div>
    </div>`;
    root.querySelector('#reset-btn').addEventListener('click', () => {
      sessionStorage.clear();
      state.analysis = null; state.gifts = []; state.cart = [];
      location.hash = '#/';
      route();
    });
  }

  // ── shared gift card ──
  function giftCardHTML(g, { cta = 'Create & Gift' } = {}) {
    const r = Gifts.resolve(g);
    return `
    <div class="gift-card" data-gift="${g.id}">
      <div class="gc-stage">${r.concept ? '<span class="gc-concept">Concept product</span>' : ''}${Mockups.render(r, 'md')}</div>
      <div class="gc-body">
        <div class="gc-recipient">${esc(g.recipient)}</div>
        <h3>${esc(g.title)}</h3>
        <div class="gc-product">${esc(r.product)} · ${esc(r.spec)}</div>
        ${g.variants ? `
        <div class="gc-variants">
          ${g.variants.map(v => `<button class="gc-variant ${v.key === (g.variantKey || g.variants[0].key) ? 'active' : ''}"
            data-gift="${g.id}" data-variant="${v.key}">${esc(v.product)}</button>`).join('')}
        </div>` : ''}
        <div class="gc-why">${g.why.map(w => `<p>${esc(w)}</p>`).join('')}</div>
        ${g.group ? `
        <div class="gc-group">
          <b>Group idea:</b> ${esc(g.group.note)}
          <div class="gc-group-row">
            <button class="btn btn-secondary btn-sm add-to-cart" data-gift="${g.id}" data-qty="${g.group.copies}" data-group="1">
              Add ${g.group.copies} copies · save ${g.group.discountPct}%
            </button>
            <button class="btn btn-ghost btn-sm gc-share" data-gift="${g.id}">Share a purchase page</button>
          </div>
        </div>` : ''}
        <div class="gc-foot">
          <div class="gc-price">${Gifts.price(r)}<small>ships in 3–5 days</small></div>
          <button class="btn btn-primary btn-sm add-to-cart" data-gift="${g.id}">${esc(cta)}</button>
        </div>
      </div>
    </div>`;
  }

  // ── cart ──
  function viewCart(root) {
    if (!state.cart.length) {
      root.innerHTML = `
      <div class="cart"><div class="cart-empty">
        <h2 class="serif">Your cart is empty</h2>
        <p>Every experience ends here — pick a gift in any of the demos and it lands in this cart.</p>
        <a class="btn btn-primary" href="${state.analysis ? '#/hub' : '#/'}">${state.analysis ? 'Back to the experiences' : 'Start the prototype'}</a>
      </div></div>`;
      return;
    }
    const items = state.cart
      .map(i => {
        const g = state.gifts.find(x => x.id === i.id);
        if (!g) return null;
        const r = Gifts.resolve(g, i.variant);
        const mult = i.group && g.group ? 1 - g.group.discountPct / 100 : 1;
        return { ...r, key: i.key || r.id, qty: i.qty, groupItem: !!i.group, groupPct: g.group?.discountPct, line: r.price * i.qty * mult };
      })
      .filter(Boolean);
    const subtotal = items.reduce((s, g) => s + g.line, 0);
    const shipping = subtotal >= 99 ? 0 : 8.99;
    const promo = subtotal * .5;
    const total = subtotal - promo + shipping;

    root.innerHTML = `
    <div class="cart">
      <h1>Your cart</h1>
      <div class="cart-sub">The end state of every demo: a memory, turned into a gift, one click from checkout.</div>
      <div class="cart-layout">
        <div class="cart-items">
          ${items.map(g => `
          <div class="cart-item">
            <div class="ci-stage">${Mockups.render(g, 'sm')}</div>
            <div>
              <h3>${esc(g.title)}</h3>
              <div class="ci-spec">${esc(g.product)} · ${esc(g.spec)}${g.concept ? ' · <b>concept</b>' : ''}</div>
              ${g.groupItem ? `<div class="ci-group">👥 Group set — ${g.qty} copies, ${g.groupPct}% volume discount applied</div>` : ''}
              <div class="ci-controls">
                <span class="qty">
                  <button data-act="dec" data-id="${g.key}">−</button><span>${g.qty}</span><button data-act="inc" data-id="${g.key}">+</button>
                </span>
                <button class="ci-remove" data-act="rm" data-id="${g.key}">Remove</button>
              </div>
            </div>
            <div class="ci-price">$${g.line.toFixed(2)}</div>
          </div>`).join('')}
        </div>
        <div class="cart-summary">
          <h3>Order summary</h3>
          <div class="cs-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
          <div class="cs-promo">🎉 Code <b>GIFT50</b> applied — 50% off your first creation (−$${promo.toFixed(2)})</div>
          <div class="cs-row"><span>Shipping</span><span>${shipping ? '$' + shipping.toFixed(2) : 'FREE'}</span></div>
          <div class="cs-row cs-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
          <button class="btn btn-primary" id="checkout-btn">Checkout →</button>
          <button class="btn btn-ghost" id="keep-btn" style="width:100%">← Keep browsing</button>
        </div>
      </div>
    </div>`;

    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const keyOf = i => i.key || i.id;
      const item = state.cart.find(i => keyOf(i) === b.dataset.id);
      if (!item && b.dataset.act !== 'rm') return;
      if (b.dataset.act === 'inc') item.qty++;
      if (b.dataset.act === 'dec') item.qty = Math.max(1, item.qty - 1);
      if (b.dataset.act === 'rm') state.cart = state.cart.filter(i => keyOf(i) !== b.dataset.id);
      save(); renderChrome(); viewCart(root);
    }));
    root.querySelector('#keep-btn').addEventListener('click', () => history.back());
    root.querySelector('#checkout-btn').addEventListener('click', () => {
      const veil = document.createElement('div');
      veil.className = 'modal-veil';
      veil.innerHTML = `<div class="modal">
        <div class="m-icon">🏁</div>
        <h2 class="serif">End of the prototype!</h2>
        <p>In the real product, this flows straight into Mixbook checkout — the project is already
        created from the user's memories and drops into the editor for a final personal touch before ordering.</p>
        <button class="btn btn-primary btn-sm" id="m-close">Nice — back to the demos</button>
      </div>`;
      document.body.appendChild(veil);
      veil.querySelector('#m-close').addEventListener('click', () => { veil.remove(); location.hash = '#/hub'; });
    });
  }

  // ── router ──
  const routes = {
    '': viewFrontDoor,
    '#/': viewFrontDoor,
    '#/hub': viewHub,
    '#/cart': viewCart,
    '#/story': (root) => Story.render(root, state),
    '#/wrapped': (root) => Wrapped.render(root, state),
    '#/guide': (root) => Guide.render(root, state),
  };
  const needsData = new Set(['#/hub', '#/story', '#/wrapped', '#/guide']);

  function route() {
    const hash = location.hash || '#/';
    const root = document.getElementById('view');
    document.body.classList.toggle('mode-wrapped', hash === '#/wrapped');
    if (needsData.has(hash) && !state.analysis) { location.hash = '#/'; return; }
    (routes[hash] || viewFrontDoor)(root);
    renderChrome();
    window.scrollTo(0, 0);
  }

  // Global delegation (works in all experiences)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.add-to-cart');
    if (btn) {
      const card = btn.closest('.gift-card');
      const variant = card?.querySelector('.gc-variant.active')?.dataset.variant || null;
      addToCart(btn.dataset.gift, {
        go: btn.dataset.stay !== '1',
        variant,
        qty: +(btn.dataset.qty || 1),
        group: btn.dataset.group === '1',
      });
      return;
    }
    const vbtn = e.target.closest('.gc-variant');
    if (vbtn) {
      // Swap the card's format in place: selector state, product line, price, mockup
      const card = vbtn.closest('.gift-card');
      const gift = state.gifts.find(g => g.id === vbtn.dataset.gift);
      if (!card || !gift) return;
      card.querySelectorAll('.gc-variant').forEach(x => x.classList.toggle('active', x === vbtn));
      const r = Gifts.resolve(gift, vbtn.dataset.variant);
      card.querySelector('.gc-product').textContent = `${r.product} · ${r.spec}`;
      card.querySelector('.gc-price').innerHTML = `${Gifts.price(r)}<small>ships in 3–5 days</small>`;
      card.querySelector('.gc-stage').innerHTML =
        (r.concept ? '<span class="gc-concept">Concept product</span>' : '') + Mockups.render(r, 'md');
      track('variant_view', { gift: gift.id, variant: vbtn.dataset.variant });
      return;
    }
    const share = e.target.closest('.gc-share');
    if (share) toast('Concept: a shareable purchase page (like our school book program) — trip-mates and party guests buy their own copies.');
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => { restore(); route(); });

  return { state, addToCart, giftCardHTML, toast, esc, track };
})();
