// scripts/prerender-static-seo.mjs
// Prerender SEO hlavičiek (title, description, canonical, OG/Twitter) pre
// NEproduktové routy: statické stránky + kategórie e-shopu.
//
// Produkty rieši prerender-product-seo.mjs. Tu dopĺňame to, čo CSR shell
// nemá v surovom HTML (hlavne canonical) – inak Google vidí pre všetky tieto
// routy identický prázdny shell a hlási „duplicity bez kanonickej adresy".
//
// Pozor: aby Amplify tieto súbory reálne servoval, musia byť v konzole
// Rewrites and redirects príslušné 200-rewrite pravidlá NAD catch-allom
// (pozri sprievodný text / README).

import fs from 'fs';
import path from 'path';

const DIST = 'dist/dashboard/browser';
const SITE_URL = 'https://www.majolika.sk';
const STRAPI_BASE_URL = 'https://majolika-cms.appdesign.sk';
const API_URL = `${STRAPI_BASE_URL}/api`;
const DEFAULT_IMAGE = `${SITE_URL}/assets/img/logo_white_bg.gif`;

// Základ je čistý klientský shell (index.csr.html) – to je presne ten, ktorý
// Amplify servuje na root po `cp index.csr.html index.html`. Má prázdny
// <app-root> (len <noscript> fallback), takže route súbory nedostanú cudzí
// prerenderovaný obsah tela, len vlastnú SEO hlavičku.
const indexPath = [
  path.join(DIST, 'index.csr.html'),
  path.join(DIST, 'index.html'),
].find((candidate) => fs.existsSync(candidate));

if (!indexPath) {
  throw new Error(`Missing browser index in ${DIST}. Run the Angular build before prerendering SEO.`);
}

// Základný shell načítame RAZ do pamäte, až potom prípadne prepisujeme root index.html.
const baseHtml = fs.readFileSync(indexPath, 'utf8');

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function upsertHeadTag(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `${tag}\n</head>`);
}

/** Vloží/prepíše SEO hlavičky pre danú routu. */
function injectSeo(html, { title, description, url, image = DEFAULT_IMAGE, ogType = 'website' }) {
  let out = html.replace(/<title>.*?<\/title>/i, `<title>${esc(title)}</title>`);

  out = upsertHeadTag(out, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(description)}">`);
  out = upsertHeadTag(out, /<meta property="og:type" content="[^"]*"\s*\/?>/i, `<meta property="og:type" content="${esc(ogType)}">`);
  out = upsertHeadTag(out, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${esc(title)}">`);
  out = upsertHeadTag(out, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${esc(description)}">`);
  out = upsertHeadTag(out, /<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${esc(url)}">`);
  out = upsertHeadTag(out, /<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${esc(image)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:card" content="[^"]*"\s*\/?>/i, '<meta name="twitter:card" content="summary_large_image">');
  out = upsertHeadTag(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${esc(title)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${esc(description)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:image" content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${esc(image)}">`);
  out = upsertHeadTag(out, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${esc(url)}">`);

  return out;
}

/** Zapíše <route>/index.html. Pre root ('') prepíše index.html aj index.csr.html. */
function writeRoute(routePath, seo) {
  const html = injectSeo(baseHtml, seo);
  const clean = routePath.replace(/^\/+|\/+$/g, ''); // bez vodiacich/koncových '/'

  if (!clean) {
    // Homepage: zapíš do index.html AJ index.csr.html. amplify.yml po builde
    // kopíruje index.csr.html -> index.html, takže bez tohto by sa homepage
    // canonical po deployi stratil.
    for (const file of ['index.html', 'index.csr.html']) {
      const target = path.join(DIST, file);
      if (fs.existsSync(target)) {
        fs.writeFileSync(target, html, 'utf8');
      }
    }
    console.log('SEO prerender: / (index.html + index.csr.html)');
    return;
  }

  const dir = path.join(DIST, clean);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log(`SEO prerender: /${clean}`);
}

// ---- Statické routy (ručne definované SK texty) --------------------------
const STATIC_PAGES = [
  {
    route: '/', // homepage – do root index.html len doplníme canonical (titulok/OG už má dobré)
    title: 'Slovenská ľudová majolika – uchovávame tradície',
    description:
      'Slovenská ľudová majolika v Modre – ručne maľovaná keramika, vázy, taniere, hrnčeky a darčeky. Tradícia odovzdávaná z generácie na generáciu.',
    url: `${SITE_URL}/`,
  },
  {
    route: '/eshop',
    title: 'E-shop – ručne maľovaná majolika z Modry | Slovenská ľudová majolika',
    description:
      'Objavte originálnu ručne maľovanú keramiku zo Slovenskej ľudovej majoliky v Modre – vázy, taniere, hrnčeky, darčeky a ďalšie.',
    url: `${SITE_URL}/eshop`,
  },
  {
    route: '/dielne',
    title: 'Tvorivé dielne a zážitky | Slovenská ľudová majolika Modra',
    description:
      'Zažite tvorivé dielne v Slovenskej ľudovej majolike v Modre – maľovanie keramiky, exkurzie a zážitky pre deti aj dospelých.',
    url: `${SITE_URL}/dielne`,
  },
  {
    route: '/o-nas',
    title: 'O nás – história a tradícia | Slovenská ľudová majolika Modra',
    description:
      'Spoznajte príbeh Slovenskej ľudovej majoliky v Modre – tradíciu ručne maľovanej keramiky, ktorá sa odovzdáva z generácie na generáciu.',
    url: `${SITE_URL}/o-nas`,
  },
  {
    route: '/aktuality',
    title: 'Aktuality a novinky | Slovenská ľudová majolika Modra',
    description:
      'Novinky, podujatia a aktuality zo Slovenskej ľudovej majoliky v Modre.',
    url: `${SITE_URL}/aktuality`,
  },
  {
    route: '/kontakty',
    title: 'Kontakt | Slovenská ľudová majolika Modra',
    description:
      'Kontaktné údaje, otváracie hodiny a adresa Slovenskej ľudovej majoliky v Modre.',
    url: `${SITE_URL}/kontakty`,
  },
];

// ---- Kategórie z CMS ------------------------------------------------------
async function getCategories() {
  const all = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const params = new URLSearchParams();
    params.set('fields[0]', 'category_name');
    params.set('fields[1]', 'category_slug');
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', String(pageSize));
    params.set('sort', 'category_name:asc');

    const res = await fetch(`${API_URL}/categories?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Strapi categories failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const data = (json.data || [])
      .map((entry) => entry?.attributes ?? entry ?? null)
      .filter((cat) => cat?.category_slug);

    all.push(...data);

    const pageCount = json.meta?.pagination?.pageCount || 1;
    console.log(`Fetched categories page ${page}/${pageCount}: ${data.length}`);
    if (page >= pageCount) break;
    page++;
  }

  return all;
}

// ---- Články (pevná sada – list endpoint /articles je v CMS zablokovaný) ---
// Slugy sú stabilné informačné stránky linkované v header/footer. Nové články
// by sa sem museli doplniť ručne (CMS nedovoľuje vymenovať zoznam).
const ARTICLE_SLUGS = [
  'historia-majoliky',
  'majolika-as',
  'oz-slm',
  'nove-vzory',
  'majolika-na-akcii',
  'informacie',
  'vseobecne-obchodne-podmienky',
  'ochrana-a-spracovanie-osobnych-udajov',
];

async function getArticle(slug) {
  const res = await fetch(`${API_URL}/articles/${slug}?locale=sk`);
  if (!res.ok) return null;
  const json = await res.json();
  const a = json?.data?.attributes ?? json?.data ?? null;
  if (!a) return null;
  return { slug, title: a.title || slug };
}

// ---- Aktuality (list endpoint funguje, dajú sa vymenovať) ------------------
async function getAktuality() {
  const all = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const params = new URLSearchParams();
    params.set('locale', 'sk');
    params.set('fields[0]', 'title');
    params.set('fields[1]', 'slug');
    params.set('fields[2]', 'summary');
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', String(pageSize));
    params.set('sort', 'publishedAt:desc');

    const res = await fetch(`${API_URL}/aktuality?${params.toString()}`);
    if (!res.ok) throw new Error(`Strapi aktuality failed: ${res.status} ${res.statusText}`);

    const json = await res.json();
    const data = (json.data || [])
      .map((entry) => entry?.attributes ?? entry ?? null)
      .filter((a) => a?.slug);

    all.push(...data);

    const pageCount = json.meta?.pagination?.pageCount || 1;
    console.log(`Fetched aktuality page ${page}/${pageCount}: ${data.length}`);
    if (page >= pageCount) break;
    page++;
  }

  return all;
}

// ---- Beh ------------------------------------------------------------------
for (const page of STATIC_PAGES) {
  writeRoute(page.route, page);
}

const categories = await getCategories();
const seen = new Set();
for (const cat of categories) {
  const slug = cat.category_slug;
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);

  const name = cat.category_name || slug;
  writeRoute(`/produkt/kategoria/${slug}`, {
    title: `${name} | Majolika Modra – ručne maľovaná keramika`,
    description: `Ručne maľovaná majolika z Modry – kategória ${name}. Originálne kusy keramiky priamo od výrobcu.`,
    url: `${SITE_URL}/produkt/kategoria/${slug}`,
  });
}

// Články
let articleCount = 0;
for (const slug of ARTICLE_SLUGS) {
  try {
    const art = await getArticle(slug);
    if (!art) {
      console.warn(`Článok preskočený (nenájdený): ${slug}`);
      continue;
    }
    writeRoute(`/article/${slug}`, {
      title: `${art.title} | Slovenská ľudová majolika Modra`,
      description: `${art.title} – Slovenská ľudová majolika z Modry, ručne maľovaná keramika a tradičný modranský dekór.`,
      url: `${SITE_URL}/article/${slug}`,
      ogType: 'article',
    });
    articleCount++;
  } catch (err) {
    console.warn(`Článok zlyhal (${slug}): ${err.message}`);
  }
}

// Aktuality
let aktualityCount = 0;
try {
  const aktuality = await getAktuality();
  const seenAkt = new Set();
  for (const akt of aktuality) {
    if (!akt.slug || seenAkt.has(akt.slug)) continue;
    seenAkt.add(akt.slug);

    const summary = stripHtml(akt.summary || '').slice(0, 300);
    writeRoute(`/aktuality/${akt.slug}`, {
      title: `${akt.title} | Aktuality – Slovenská ľudová majolika Modra`,
      description:
        summary ||
        `${akt.title} – aktuality zo Slovenskej ľudovej majoliky v Modre.`,
      url: `${SITE_URL}/aktuality/${akt.slug}`,
      ogType: 'article',
    });
    aktualityCount++;
  }
} catch (err) {
  console.warn(`Aktuality sa nepodarilo načítať (${err.message}) – prerender bez nich.`);
}

console.log(
  `SEO prerender complete: ${STATIC_PAGES.length} statických + ${seen.size} kategórií + ${articleCount} článkov + ${aktualityCount} aktualít`
);
