/* Wrapped — a full-screen, tap-through cinematic recap of the user's year
 * that crescendos into personalized gift reveals. Spotify-Wrapped-inspired.
 */
const Wrapped = (() => {
  const esc = Mockups.esc;
  let slides = [], idx = 0, container;

  function buildSlides(a, gifts) {
    const s = [];
    const p = a.people;
    const top = a.topMoments[0];

    s.push({ bg: 'bg-1', html: `
      <div class="wr-kicker">Mixbook presents</div>
      <h1>Your Year,<br>Wrapped in Memories</h1>
      <div class="wr-sub">${esc(a.meta.startLabel)} → ${esc(a.meta.endLabel)}. We watched the whole thing. Tap through.</div>` });

    s.push({ bg: 'bg-4', html: `
      <div class="wr-kicker">The numbers</div>
      <div class="wr-big" data-count="${a.meta.episodeCount}">0</div>
      <h1>memories captured</h1>
      <div class="wr-sub">${a.meta.photoCount.toLocaleString()} photos · ${a.meta.cityCount} places · ${a.clusters.holidays.length} holidays · ${a.clusters.travel.length} trips</div>` });

    if (a.homeBase) {
      const home = a.clusters.everyday.filter(e => e.coverUrl).slice(0, 4);
      s.push({ bg: 'bg-2', html: `
        ${home.length ? `<div class="wr-strip">${home.map(e => `<img src="${esc(e.coverUrl)}" alt="">`).join('')}</div>` : ''}
        <div class="wr-kicker">Home base</div>
        <h1>${esc(a.homeBase)} was your stage</h1>
        <div class="wr-sub">${a.clusters.everyday.length} everyday moments — proof the best material never needed a plane ticket.</div>` });
    }

    if (a.clusters.travel.length) {
      const places = [...new Set(a.clusters.travel.flatMap(e => e.locations))].filter(pl => pl !== a.homeBase).slice(0, 4);
      s.push({ bg: 'bg-3', html: `
        <div class="wr-kicker">But when you left town…</div>
        <h1>You really left town</h1>
        <div class="wr-list">${places.map((pl, i) => `<div class="wr-li" style="animation-delay:${.2 + i * .18}s">${esc(pl)}</div>`).join('')}</div>` });
    }

    if (top) {
      s.push({ bg: 'bg-5', html: `
        <img class="wr-photo" src="${esc(top.coverUrl)}" alt="">
        <div class="wr-kicker">Your #1 moment</div>
        <h1>${esc(top.title)}</h1>
        <div class="wr-sub">${esc(top.summary)}</div>` });
    }

    if (a.tone) {
      s.push({ bg: 'bg-1', html: `
        <div class="wr-kicker">Your year's mood</div>
        <h1>${esc(a.tone.label)}</h1>
        <div class="wr-big">${a.tone.share}%</div>
        <div class="wr-sub">${esc(a.tone.line)}</div>` });
    }

    const cast = [
      p.partner && '💜 Your partner',
      ...p.names.map(n => '🌟 ' + n),
      (p.grandparents || p.grandkids) && '🏡 The grandparents',
      p.friends && '🎉 The friends',
      p.pets && '🐾 One very good dog',
    ].filter(Boolean).slice(0, 5);
    if (cast.length) {
      s.push({ bg: 'bg-4', html: `
        <div class="wr-kicker">The cast of your year</div>
        <h1>It was never a solo show</h1>
        <div class="wr-list">${cast.map((c, i) => `<div class="wr-li" style="animation-delay:${.2 + i * .16}s">${esc(c)}</div>`).join('')}</div>` });
    }

    s.push({ bg: 'bg-3', html: `
      <div class="wr-kicker">Now the good part</div>
      <h1>A year this good<br>deserves to be gifted</h1>
      <div class="wr-sub">We turned your memories into real Mixbook gifts. Three reveals. Keep tapping.</div>` });

    const reveals = ['travelbook', 'yearbook', 'bragbook', 'partnerbook', 'calendar', 'canvas']
      .map(id => gifts.find(x => x.id === id)).filter(Boolean).slice(0, 3);
    const revealBgs = ['bg-2', 'bg-5', 'bg-1'];
    reveals.forEach((gift, i) => {
      s.push({ bg: revealBgs[i % 3], html: `
        ${Mockups.render(gift, 'lg')}
        <div class="wr-gift-meta">
          <div class="wr-kicker">Gift reveal ${i + 1} of ${reveals.length} · ${esc(gift.recipient)}</div>
          <h1 style="font-size:clamp(26px,4.5vw,42px)">${esc(gift.title)}</h1>
          <div class="wr-sub">${esc(gift.why[0] || '')}</div>
          <div class="wr-price">${esc(gift.product)} — ${Gifts.price(gift)}</div>
        </div>
        <div class="wr-cta-row">
          <button class="btn btn-primary add-to-cart" data-gift="${gift.id}">Create & Gift →</button>
        </div>` });
    });

    s.push({ bg: 'bg-5', html: `
      <div class="wr-kicker">That's a wrap</div>
      <h1>${a.meta.episodeCount} memories.<br>${gifts.length} gifts, ready to make.</h1>
      <div class="wr-sub">Every one starts from photos you already took, and people you already love.</div>
      <div class="wr-cta-row">
        <a class="btn btn-primary" href="#/guide">See the full gift guide</a>
        <a class="btn btn-secondary" style="color:#fff;border-color:#fff" href="#/cart">Go to cart</a>
      </div>` });

    return s;
  }

  function show(i) {
    idx = Math.max(0, Math.min(i, slides.length - 1));
    const slide = slides[idx];
    const stage = container.querySelector('#wr-stage');
    stage.className = 'wr-slide ' + slide.bg;
    stage.innerHTML = slide.html;
    container.querySelectorAll('.wr-progress i').forEach((bar, bi) => {
      bar.className = bi < idx ? 'done' : bi === idx ? 'active' : '';
    });
    // count-up animation
    const counter = stage.querySelector('[data-count]');
    if (counter) {
      const target = +counter.dataset.count;
      const t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / 1200);
        counter.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }

  function render(root, state) {
    slides = buildSlides(state.analysis, state.gifts);
    idx = 0;
    root.innerHTML = `
      <div class="wrapped" id="wrapped">
        <div class="wr-progress">${slides.map(() => '<i></i>').join('')}</div>
        <button class="wr-close" id="wr-close" aria-label="Close">✕</button>
        <div class="wr-slide" id="wr-stage"></div>
        <button class="wr-nav wr-nav-prev" id="wr-prev" aria-label="Previous"></button>
        <button class="wr-nav wr-nav-next" id="wr-next" aria-label="Next"></button>
        <div class="wr-tap">tap right to continue · left to go back</div>
      </div>`;
    container = root.querySelector('#wrapped');
    container.querySelector('#wr-prev').addEventListener('click', () => show(idx - 1));
    container.querySelector('#wr-next').addEventListener('click', () => show(idx + 1));
    container.querySelector('#wr-close').addEventListener('click', () => location.hash = '#/hub');

    const keys = e => {
      if (location.hash !== '#/wrapped') { document.removeEventListener('keydown', keys); return; }
      if (e.key === 'ArrowRight' || e.key === ' ') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'Escape') location.hash = '#/hub';
    };
    document.addEventListener('keydown', keys);

    // swipe support
    let x0 = null;
    container.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    container.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });

    show(0);
  }

  return { render };
})();
