/* Product mockups — pure CSS renderings of Mixbook products, personalized
 * with the user's own memory photos. No product imagery is downloaded.
 */
const Mockups = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function render(gift, size = 'md') {
    const cover = gift.cover ? `style="background-image:url('${esc(gift.cover)}')"` : '';
    const title = esc(gift.title.length > 34 ? gift.title.slice(0, 32) + '…' : gift.title);
    switch (gift.mock) {
      case 'book':
      case 'minibook':
        return `<div class="mock mock-${size} mock-book ${gift.mock === 'minibook' ? 'mock-mini' : ''}">
          <div class="book-spine"></div>
          <div class="book-cover" ${cover}><div class="book-label"><span>${title}</span></div></div>
        </div>`;
      case 'layflat':
        return `<div class="mock mock-${size} mock-layflat">
          <div class="lf-page lf-left" ${cover}></div>
          <div class="lf-page lf-right" ${gift.photos?.[1] ? `style="background-image:url('${esc(gift.photos[1])}')"` : cover}></div>
        </div>`;
      case 'calendar': {
        const cells = Array.from({ length: 21 }, (_, i) => `<i${i === 9 ? ' class="cal-dot"' : ''}></i>`).join('');
        return `<div class="mock mock-${size} mock-calendar">
          <div class="cal-photo" ${cover}></div>
          <div class="cal-rings"><i></i><i></i><i></i></div>
          <div class="cal-grid">${cells}</div>
        </div>`;
      }
      case 'canvas':
        return `<div class="mock mock-${size} mock-canvas"><div class="canvas-face" ${cover}></div></div>`;
      case 'frame':
        return `<div class="mock mock-${size} mock-frame"><div class="frame-mat"><div class="frame-photo" ${cover}></div></div></div>`;
      case 'cards': {
        const backs = (gift.photos || [gift.cover]).slice(0, 3);
        return `<div class="mock mock-${size} mock-cards">
          ${backs.map((u, i) => `<div class="card-item card-${i}" style="background-image:url('${esc(u)}')"></div>`).join('')}
          <div class="card-env"></div>
        </div>`;
      }
      case 'prints': {
        const ph = (gift.photos || [gift.cover]).slice(0, 3);
        return `<div class="mock mock-${size} mock-prints">
          ${ph.map((u, i) => `<div class="print-item print-${i}" style="background-image:url('${esc(u)}')"></div>`).join('')}
        </div>`;
      }
      case 'collage': {
        // Single matte board, one cut-out opening per person — grandma's knife-and-photo-board trick, productized
        const ph = (gift.photos || [gift.cover]).slice(0, 6);
        return `<div class="mock mock-${size} mock-collage">
          <div class="collage-mat">
            ${ph.map(u => `<div class="collage-opening" style="background-image:url('${esc(u)}')"></div>`).join('')}
          </div>
        </div>`;
      }
      case 'stairfames': {
        const ph = (gift.photos || [gift.cover]).slice(0, 4);
        return `<div class="mock mock-${size} mock-stairs">
          ${ph.map((u, i) => `<div class="stair-frame stair-${i}" style="background-image:url('${esc(u)}')"></div>`).join('')}
          <div class="stair-steps"></div>
        </div>`;
      }
      case 'magnets': {
        const ph = (gift.photos || [gift.cover]).slice(0, 5);
        return `<div class="mock mock-${size} mock-magnets">
          ${ph.map((u, i) => `<div class="magnet-item magnet-${i}" style="background-image:url('${esc(u)}')"></div>`).join('')}
        </div>`;
      }
      default:
        return `<div class="mock mock-${size} mock-book"><div class="book-cover" ${cover}></div></div>`;
    }
  }

  return { render, esc };
})();
