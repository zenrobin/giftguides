/* Classic Guide — the practical presentation: an editorial, scrollable page
 * of every recommendation with its memory-grounded reasoning, plus a
 * browse-more strip from the wider Mixbook catalog.
 */
const Guide = (() => {
  const esc = Mockups.esc;

  function render(root, state) {
    const a = state.analysis;
    const gifts = state.gifts;
    const collage = a.topMoments.slice(0, 5).map(m => m.coverUrl).filter(Boolean);

    // Group gifts by recipient
    const groups = [];
    for (const g of gifts) {
      let grp = groups.find(x => x.name === g.recipient);
      if (!grp) { grp = { name: g.recipient, items: [] }; groups.push(grp); }
      grp.items.push(g);
    }

    const catalogStrip = Object.entries(Gifts.CATALOG).map(([key, c]) => `
      <div class="browse-item">
        ${Mockups.render({ mock: c.mock, cover: a.topMoments[Math.floor(Math.random() * a.topMoments.length)]?.coverUrl, title: '', photos: collage }, 'sm')}
        <div class="bi-name">${esc(c.product)}</div>
        <div class="bi-price">from $${c.price.toFixed(2)}</div>
      </div>`).join('');

    root.innerHTML = `
    <div class="guide">
      <div class="guide-hero">
        <div class="gh-collage">${collage.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>
        <h1>Gifts your year already made</h1>
        <p>Between ${esc(a.meta.startLabel)} and ${esc(a.meta.endLabel)} you captured
        <b>${a.meta.episodeCount} memories</b> across ${a.meta.cityCount} places.
        We matched the best of them to ${gifts.length} Mixbook creations — each one explains
        exactly which memories it's built from. Tap <b>Create & Gift</b> and it lands in your cart, ready to make.</p>
        <div class="gh-links">
          <a class="btn btn-secondary btn-sm" href="#/wrapped">▶ &nbsp;First time? Watch your year, wrapped — it lands right back here</a>
        </div>
      </div>

      ${groups.map(grp => `
      <div class="guide-section">
        <h2 class="serif">${esc(grp.name)}</h2>
        <div class="gs-sub">${grp.items.length} idea${grp.items.length > 1 ? 's' : ''} drawn from your memories</div>
        <div class="guide-grid">
          ${grp.items.map(g => App.giftCardHTML(g)).join('')}
        </div>
      </div>`).join('')}

      <div class="guide-section">
        <h2 class="serif">Or browse the shelves</h2>
        <div class="gs-sub">Everything in the Mixbook catalog can start from your memories — previews below use your own photos.</div>
        <div class="browse-strip">${catalogStrip}</div>
      </div>

      <div class="guide-section guide-handoff">
        <h2 class="serif">Nothing quite it?</h2>
        <p>Tell the assistant what you're actually looking for. It won't start from zero —
        it starts from the same ${a.meta.episodeCount} memories this guide was built on.</p>
        <button class="btn btn-secondary" id="guide-to-story">💬 &nbsp;I'm looking for something different</button>
      </div>
    </div>`;

    root.querySelector('#guide-to-story').addEventListener('click', () => {
      sessionStorage.setItem('gg.storyEntry', 'guide-different');
      location.hash = '#/story';
    });
  }

  return { render };
})();
