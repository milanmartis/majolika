// scripts/fetch-sitemap.mjs
//
// Pri builde stiahne čerstvú sitemapu zo Strapi CMS a zapíše ju do
// dist/dashboard/browser/sitemap.xml, aby sa na https://www.majolika.sk/sitemap.xml
// servírovala kompletná a aktuálna sitemapa (všetky produkty/kategórie/aktuality),
// nie stará statická src/sitemap.xml s pár URL.
//
// CMS sitemapa (vlastný controller) obsahuje produkty + pár stránok, ale NIE
// kategórie ani väčšinu statických stránok. Preto ju tu ešte doplníme o:
//   - statické stránky /o-nas, /aktuality, /kontakty
//   - všetky kategórie /produkt/kategoria/<slug> (z CMS API)
// (tieto routy majú teraz vlastné SEO cez prerender-static-seo.mjs).
// Duplicity sa preskakujú podľa <loc>.
//
// Keď fetch zlyhá (CMS nedostupné počas buildu), ponechá sa statická kópia
// z src/sitemap.xml ako fallback, build nespadne.

import { writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_URL = 'https://www.majolika.sk';
const STRAPI_BASE_URL = 'https://majolika-cms.appdesign.sk';
const CMS_SITEMAP = `${STRAPI_BASE_URL}/api/sitemap.xml`;
const CATEGORIES_API = `${STRAPI_BASE_URL}/api/categories`;
const OUT = resolve('dist/dashboard/browser/sitemap.xml');
const FALLBACK = resolve('src/sitemap.xml');

const STATIC_PAGES = [
  { path: '/o-nas', priority: '0.7', changefreq: 'monthly' },
  { path: '/aktuality', priority: '0.7', changefreq: 'monthly' },
  { path: '/kontakty', priority: '0.7', changefreq: 'monthly' },
];

function urlBlock(loc, priority, changefreq) {
  return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function getCategorySlugs() {
  const slugs = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const params = new URLSearchParams();
    params.set('fields[0]', 'category_slug');
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', String(pageSize));
    params.set('sort', 'category_slug:asc');

    const res = await fetch(`${CATEGORIES_API}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    for (const entry of json.data || []) {
      const slug = (entry?.attributes ?? entry)?.category_slug;
      if (slug) slugs.push(slug);
    }

    const pageCount = json.meta?.pagination?.pageCount || 1;
    if (page >= pageCount) break;
    page++;
  }

  return slugs;
}

/** Doplní do stiahnutej CMS sitemapy kategórie + statické stránky (s dedupe). */
async function augment(xml) {
  // existujúce <loc> (bez koncového '/') kvôli dedupe
  const existing = new Set(
    (xml.match(/<loc>([^<]+)<\/loc>/g) || []).map((m) =>
      m.replace(/<\/?loc>/g, '').replace(/\/+$/, '')
    )
  );

  const blocks = [];

  for (const page of STATIC_PAGES) {
    const loc = `${SITE_URL}${page.path}`;
    if (existing.has(loc.replace(/\/+$/, ''))) continue;
    existing.add(loc);
    blocks.push(urlBlock(loc, page.priority, page.changefreq));
  }

  try {
    const slugs = await getCategorySlugs();
    for (const slug of slugs) {
      const loc = `${SITE_URL}/produkt/kategoria/${slug}`;
      if (existing.has(loc)) continue;
      existing.add(loc);
      blocks.push(urlBlock(loc, '0.6', 'weekly'));
    }
    console.log(`[sitemap] doplnených kategórií: ${slugs.length}`);
  } catch (err) {
    console.warn(`[sitemap] Kategórie sa nepodarilo načítať (${err.message}) – sitemapa bude bez nich.`);
  }

  if (!blocks.length) return xml;
  return xml.replace(/\s*<\/urlset>/, `\n${blocks.join('\n')}\n</urlset>`);
}

async function main() {
  try {
    const res = await fetch(CMS_SITEMAP, { headers: { Accept: 'application/xml' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let xml = await res.text();

    // sanity check: musí to byť XML sitemapa s aspoň jednou <loc> na našej doméne
    if (!xml.includes('<urlset') || !xml.includes('www.majolika.sk')) {
      throw new Error('Neočakávaný obsah sitemapy z CMS');
    }

    xml = await augment(xml);

    const count = (xml.match(/<loc>/g) || []).length;
    writeFileSync(OUT, xml, 'utf8');
    console.log(`[sitemap] OK – zapísaných ${count} URL do ${OUT}`);
  } catch (err) {
    console.warn(`[sitemap] Fetch z CMS zlyhal (${err.message}) – ponechávam statický fallback.`);
    if (existsSync(FALLBACK)) {
      copyFileSync(FALLBACK, OUT);
      console.warn(`[sitemap] Použitý fallback: ${FALLBACK}`);
    }
  }
}

main();
