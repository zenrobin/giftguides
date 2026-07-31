/* App shell — hash router, shared state, front door, hub, cart. */
const App = (() => {
  const esc = Mockups.esc;
  const state = {
    analysis: null,
    gifts: [],
    cart: [],
  };

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
  function addToCart(giftId, { go = true } = {}) {
    const gift = state.gifts.find(g => g.id === giftId);
    if (!gift) return;
    const existing = state.cart.find(i => i.id === giftId);
    if (existing) existing.qty += 1;
    else state.cart.push({ id: gift.id, qty: 1 });
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
        <a class="nav-link" href="#/guide">Guide</a>` : ''}
      <a class="cart-btn" href="#/cart">🛒 Cart ${cartCount() ? `<span class="cart-count">${cartCount()}</span>` : ''}</a>`;
  }

  // ── front door ──
  function viewFrontDoor(root) {
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
    goBtn.addEventListener('click', async () => {
      if (!file) return;
      try {
        await runAnalysis(root, file);
        location.hash = '#/hub';
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
        <a class="hub-card" href="#/story">
          <div class="hc-art hc-art-1">💬</div>
          <h3>Story Mode</h3>
          <p>A conversational gift assistant that already knows your year. It opens with ideas, answers questions, and narrows in on the perfect gift — chat-style.</p>
          <div class="hc-cta">Start the conversation →</div>
        </a>
        <a class="hub-card" href="#/wrapped">
          <div class="hc-art hc-art-2">🎬</div>
          <h3>Your Year, Wrapped</h3>
          <p>A cinematic, tap-through journey in the spirit of Spotify Wrapped — your stats, your top moments, then the gifts they deserve. Full screen, big feelings.</p>
          <div class="hc-cta">Play the journey →</div>
        </a>
        <a class="hub-card" href="#/guide">
          <div class="hc-art hc-art-3">🎁</div>
          <h3>The Classic Guide</h3>
          <p>A beautifully practical page: every recommendation with the memory-grounded “why,” real products, real prices, one tap to cart.</p>
          <div class="hc-cta">Browse the guide →</div>
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
    return `
    <div class="gift-card" data-gift="${g.id}">
      <div class="gc-stage">${Mockups.render(g, 'md')}</div>
      <div class="gc-body">
        <div class="gc-recipient">${esc(g.recipient)}</div>
        <h3>${esc(g.title)}</h3>
        <div class="gc-product">${esc(g.product)} · ${esc(g.spec)}</div>
        <div class="gc-why">${g.why.map(w => `<p>${esc(w)}</p>`).join('')}</div>
        <div class="gc-foot">
          <div class="gc-price">${Gifts.price(g)}<small>ships in 3–5 days</small></div>
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
    const items = state.cart.map(i => ({ ...state.gifts.find(g => g.id === i.id), qty: i.qty })).filter(g => g.id);
    const subtotal = items.reduce((s, g) => s + g.price * g.qty, 0);
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
              <div class="ci-spec">${esc(g.product)} · ${esc(g.spec)}</div>
              <div class="ci-controls">
                <span class="qty">
                  <button data-act="dec" data-id="${g.id}">−</button><span>${g.qty}</span><button data-act="inc" data-id="${g.id}">+</button>
                </span>
                <button class="ci-remove" data-act="rm" data-id="${g.id}">Remove</button>
              </div>
            </div>
            <div class="ci-price">$${(g.price * g.qty).toFixed(2)}</div>
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
      const item = state.cart.find(i => i.id === b.dataset.id);
      if (!item) return;
      if (b.dataset.act === 'inc') item.qty++;
      if (b.dataset.act === 'dec') item.qty = Math.max(1, item.qty - 1);
      if (b.dataset.act === 'rm') state.cart = state.cart.filter(i => i.id !== b.dataset.id);
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

  // Global add-to-cart delegation (works in all experiences)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.add-to-cart');
    if (btn) addToCart(btn.dataset.gift, { go: btn.dataset.stay !== '1' });
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', () => { restore(); route(); });

  return { state, addToCart, giftCardHTML, toast, esc };
})();
