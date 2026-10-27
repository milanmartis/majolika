// scripts/fetch-sitemap.mjs
//
// Pri builde stiahne čerstvú sitemapu zo Strapi CMS a zapíše ju do
// dist/dashboard/browser/sitemap.xml, aby sa na https://www.majolika.sk/sitemap.xml
// servírovala kompletná a aktuálna sitemapa (všetky produkty/kategórie/aktuality),
// nie stará statická src/sitemap.xml s pár URL.
//
// Keď fetch zlyhá (CMS nedostupné počas buildu), ponechá sa statická kópia
// z src/sitemap.xml ako fallback, build nespadne.

import { writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CMS_SITEMAP = 'https://majolika-cms.appdesign.sk/api/sitemap.xml';
const OUT = resolve('dist/dashboard/browser/sitemap.xml');
const FALLBACK = resolve('src/sitemap.xml');

async function main() {
  try {
    const res = await fetch(CMS_SITEMAP, { headers: { Accept: 'application/xml' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // sanity check: musí to byť XML sitemapa s aspoň jednou <loc> na našej doméne
    if (!xml.includes('<urlset') || !xml.includes('www.majolika.sk')) {
      throw new Error('Neočakávaný obsah sitemapy z CMS');
    }

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
