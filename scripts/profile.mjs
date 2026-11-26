// Renders the Gumroad profile landing page (custom_html) from the storefront feed.
// Works without JavaScript: products are written into the HTML, the gears turn with CSS.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const priceText = (p) => (p === 0 ? 'Free' : `$${Number.isInteger(p) ? p : p.toFixed(2)}`);

// One spur gear as an SVG path, centred on 0,0.
export function gearPath(teeth, module = 6, holeRatio = 0.28) {
  const r = (module * teeth) / 2, ro = r + module, rr = r - 1.25 * module, step = (Math.PI * 2) / teeth;
  const pt = (rad, a) => `${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`;
  const parts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    parts.push(`${i === 0 ? 'M' : 'L'}${pt(rr, a - step * 0.5)}`, `L${pt(rr, a - step * 0.27)}`, `L${pt(ro, a - step * 0.14)}`, `L${pt(ro, a + step * 0.14)}`, `L${pt(rr, a + step * 0.27)}`);
  }
  const h = r * holeRatio;
  return `${parts.join(' ')} Z M${h},0 A${h},${h} 0 1,0 ${-h},0 A${h},${h} 0 1,0 ${h},0 Z`;
}

function gearsSvg() {
  // Three meshing gears; durations follow the tooth ratio so the teeth stay in step.
  const gears = [
    { t: 36, x: 170, y: 170, dir: 1, phase: 0 },
    { t: 18, x: 170 + 162 * Math.cos(-0.55), y: 170 + 162 * Math.sin(-0.55), dir: -1 },
    { t: 24, x: 170 + 180 * Math.cos(0.95), y: 170 + 180 * Math.sin(0.95), dir: -1 },
  ];
  const base = 60; // seconds per turn for the big gear
  return `<svg class="gears" viewBox="-30 -40 420 420" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="brass" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#f1d692"/><stop offset=".55" stop-color="#c99d43"/><stop offset="1" stop-color="#7d5a1c"/></radialGradient>
  </defs>
  ${gears.map((g, i) => `<g transform="translate(${g.x.toFixed(1)} ${g.y.toFixed(1)})"><g class="spin" style="--dur:${((base * g.t) / 36).toFixed(2)}s;--dir:${g.dir};${i === 0 ? '' : `rotate:${(180 / g.t).toFixed(2)}deg;`}"><path d="${gearPath(g.t)}" fill="url(#brass)" stroke="#7d5a1c" stroke-width="1" fill-rule="evenodd"/><circle r="${(3 * g.t * 0.26).toFixed(1)}" fill="none" stroke="#f1d692" stroke-opacity=".35"/></g><circle r="9" fill="#234a93"/><circle r="4" fill="#a3203a"/></g>`).join('\n  ')}
</svg>`;
}

// Gumroad refuses a profile page with more than 25 images, avatar included.
const MAX_IMAGES = 25;

const card = (p, label, withCover = true) => `<li><a class="card${withCover ? '' : ' text-only'}" href="${esc(p.url)}">
      ${withCover ? `<span class="cover"><img src="${esc(p.coverSource || p.cover)}" alt="" width="800" height="450" loading="lazy"></span>` : ''}
      <span class="body">
        <span class="label">${esc(label)}</span>
        <span class="title">${esc(p.title)}</span>
        <span class="sum">${esc(p.sum)}</span>
        <span class="foot"><span class="price${p.price === 0 ? ' free' : ''}">${priceText(p.price)}</span><span class="go">View on Gumroad</span></span>
      </span>
    </a></li>`;

export function renderProfile(feed, { storefrontUrl } = {}) {
  const products = feed.products || [];
  const books = products.filter((p) => p.kind === 'books');
  const tools = products.filter((p) => p.kind !== 'books');
  // Paid Barnaby books in reading order; the first book carries no "Book N" line, the free pack goes last.
  const paidBooks = books.filter((p) => p.price > 0).sort((a, b) => (a.book ?? 1) - (b.book ?? 1));
  const freeBooks = books.filter((p) => p.price === 0);
  const { name = 'Automata', avatar, url } = feed.profile || {};
  const avatarSrc = feed.profile?.avatarSource || avatar || '';
  const minPrice = Math.min(...products.map((p) => p.price));
  // Books sell on their covers, so they get images first; work tools share what is left, in feed order.
  const toolCovers = Math.max(0, MAX_IMAGES - (avatarSrc ? 1 : 0) - books.length);

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&amp;family=JetBrains+Mono:wght@400;500&amp;family=Young+Serif&amp;display=swap">
<style>
  :root {
    --bg: #eceee9; --surface: #f7f8f4; --raised: #e2e5df;
    --ink: #161a19; --ink-2: #48504d; --ink-3: #626b67;
    --line: rgb(22 26 25 / .10); --line-strong: rgb(22 26 25 / .20);
    --accent: #234a93; --shadow: rgb(30 34 32 / .14);
    --serif: "Young Serif", Georgia, serif; --sans: "Figtree", system-ui, -apple-system, "Segoe UI", sans-serif;
    --mono: "JetBrains Mono", ui-monospace, Consolas, monospace; --ease: cubic-bezier(.22, 1, .36, 1);
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d1215; --surface: #141b1f; --raised: #1c252a; --ink: #e8ebe7; --ink-2: #a8b1ad; --ink-3: #8a9490;
      --line: rgb(232 235 231 / .09); --line-strong: rgb(232 235 231 / .18); --accent: #9db8ef; --shadow: rgb(0 0 0 / .45); color-scheme: dark; }
  }
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 400 16px/1.55 var(--sans); }
  a { color: inherit; }
  a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 8px; }
  img { display: block; max-width: 100%; }
  .wrap { max-width: 1180px; margin-inline: auto; padding-inline: max(16px, 4vw); }
  .mono { font: 400 12px/16px var(--mono); color: var(--ink-3); }
  header.top { border-block-end: 1px solid var(--line); }
  header.top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-block-size: 60px; flex-wrap: wrap; }
  .who { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .who img { inline-size: 32px; block-size: 32px; border-radius: 50%; border: 1px solid var(--line-strong); }
  .who b { font-weight: 600; }
  nav.jump { display: flex; gap: 4px; flex-wrap: wrap; }
  nav.jump a { font-size: 14px; text-decoration: none; padding: 8px 12px; border-radius: 8px; color: var(--ink-2); transition: background-color 160ms var(--ease), color 160ms var(--ease); }
  nav.jump a:hover { background: var(--raised); color: var(--ink); }

  .hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 40px; align-items: center; padding-block: 56px 40px; }
  @media (max-width: 860px) { .hero { grid-template-columns: 1fr; padding-block: 40px 24px; } .gears { max-inline-size: 360px; margin-inline: auto; } }
  .hero h1 { font: 400 clamp(52px, 9vw, 104px)/.95 var(--serif); letter-spacing: -.03em; margin: 0; }
  .lede { font-size: 19px; line-height: 29px; color: var(--ink-2); max-inline-size: 34rem; margin: 20px 0 0; text-wrap: pretty; }
  .facts { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-block: 20px 28px; font: 400 13px/1.4 var(--mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .facts b { color: var(--ink); font-weight: 500; }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; }
  .btn { display: inline-flex; align-items: center; min-block-size: 48px; padding-inline: 20px; border-radius: 10px; font-weight: 500; text-decoration: none; border: 1px solid transparent; transition: background-color 160ms var(--ease); }
  .btn.primary { background: var(--ink); color: var(--bg); }
  .btn.quiet { background: var(--surface); border-color: var(--line-strong); }
  .btn.quiet:hover { background: var(--raised); }
  .gears { inline-size: 100%; block-size: auto; filter: drop-shadow(0 14px 22px var(--shadow)); }
  .spin { transform-box: fill-box; transform-origin: center; }
  @media (prefers-reduced-motion: no-preference) {
    .spin { animation: turn var(--dur) linear infinite; }
    @keyframes turn { to { transform: rotate(calc(360deg * var(--dir))); } }
  }

  section.block { border-block-start: 1px solid var(--line); padding-block: 56px; scroll-margin-top: 16px; }
  .head { display: grid; gap: 8px; max-inline-size: 42rem; margin-block-end: 28px; }
  h2 { font: 400 clamp(30px, 4.2vw, 44px)/1.06 var(--serif); letter-spacing: -.02em; margin: 0; text-wrap: balance; }
  .head p { margin: 0; color: var(--ink-2); font-size: 17px; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); gap: 22px; list-style: none; padding: 0; margin: 0; }
  .card { display: grid; grid-template-rows: auto 1fr; block-size: 100%; text-decoration: none; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; transition: border-color 160ms var(--ease), box-shadow 220ms var(--ease); }
  .card:hover { border-color: var(--line-strong); box-shadow: 0 10px 28px var(--shadow); }
  .cover { aspect-ratio: 16 / 9; background: var(--raised); overflow: hidden; }
  .cover img { inline-size: 100%; block-size: 100%; object-fit: cover; }
  .body { display: grid; grid-template-rows: auto auto 1fr auto; gap: 8px; padding: 16px 20px 20px; }
  .label { font: 400 12px/16px var(--mono); color: var(--ink-3); }
  .title { font-weight: 600; font-size: 18px; line-height: 1.3; text-wrap: balance; }
  .sum { color: var(--ink-2); font-size: 15px; line-height: 22px; }
  .foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-block-start: 12px; border-block-start: 1px solid var(--line); }
  .price { font: 500 16px/1 var(--mono); font-variant-numeric: tabular-nums; }
  .price.free { color: var(--accent); }
  .go { font-size: 14px; color: var(--ink-3); }
  .card:hover .go { color: var(--ink); }
  .card.text-only { border-block-start: 3px solid var(--accent); }
  .card.text-only .body { block-size: 100%; }

  .rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(260px, 31%); gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; list-style: none; margin: 0; padding: 4px 2px 20px; }
  @media (max-width: 700px) { .rail { grid-auto-columns: 84%; } }
  .rail li { scroll-snap-align: start; }
  .rail .card .sum { display: none; }

  footer { border-block-start: 1px solid var(--line); padding-block: 36px 48px; color: var(--ink-3); font-size: 14px; }
  footer .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px 24px; align-items: center; }
</style>

<header class="top"><div class="wrap">
  <a class="who" href="${esc(url || '#')}">${avatarSrc ? `<img src="${esc(avatarSrc)}" alt="" width="32" height="32">` : ''}<b>${esc(name)}</b></a>
  <nav class="jump" aria-label="Sections">
    ${tools.length ? '<a href="#tools">Work tools</a>' : ''}${paidBooks.length ? '<a href="#books">Picture books</a>' : ''}${freeBooks.length ? '<a href="#free">Free</a>' : ''}
  </nav>
</div></header>

<main>
  <div class="wrap hero">
    <div>
      <h1>${esc(name)}</h1>
      <p class="lede">Small digital things that do one job well. Tap-to-play bedtime stories starring Barnaby the clockwork fox, and plain tools for freelancers and first-time store owners.</p>
      <p class="facts"><span><b>${products.length}</b> products</span><span><b>${books.length}</b> picture books</span><span><b>${tools.length}</b> work tools</span><span>from <b>${minPrice === 0 ? '$0' : priceText(minPrice)}</b></span></p>
      <div class="ctas">
        <a class="btn primary" href="#tools">Browse the shelf</a>
        ${storefrontUrl ? `<a class="btn quiet" href="${esc(storefrontUrl)}">Open the interactive shelf</a>` : ''}
      </div>
    </div>
    ${gearsSvg()}
  </div>

  ${tools.length ? `<section class="block" id="tools" aria-labelledby="tools-h"><div class="wrap">
    <div class="head"><span class="mono">Work tools</span><h2 id="tools-h">Guides and calculators for getting paid work done</h2></div>
    <ul class="grid">${tools.map((p, i) => card(p, 'Work tool', i < toolCovers)).join('')}</ul>
  </div></section>` : ''}

  ${paidBooks.length ? `<section class="block" id="books" aria-labelledby="books-h"><div class="wrap">
    <div class="head"><span class="mono">Barnaby the little clockwork fox</span><h2 id="books-h">Bedtime stories, in reading order</h2>
      <p>Each book is a tap-to-play story with read-aloud, a sparkle hunt, a coloring page and a printable PDF. Ages 4 to 8.</p></div>
    <ol class="rail">${paidBooks.map((p) => card(p, `Book ${p.book ?? 1}`)).join('')}</ol>
  </div></section>` : ''}

  ${freeBooks.length ? `<section class="block" id="free" aria-labelledby="free-h"><div class="wrap">
    <div class="head"><span class="mono">Free</span><h2 id="free-h">Meet Barnaby first</h2></div>
    <ul class="grid">${freeBooks.map((p) => card(p, 'Free printable')).join('')}</ul>
  </div></section>` : ''}
</main>

<footer><div class="wrap">
  <span>${esc(name)} · payment, receipts and downloads are handled by Gumroad</span>
  <span class="mono">Updated ${esc((feed.updatedAt || '').slice(0, 10))}</span>
</div></footer>
`;
}
