import fs from 'fs';
import path from 'path';

const DIST = 'dist/dashboard/browser';
const SITE_URL = 'https://www.majolika.sk';
const API_URL = 'https://majolika-cms.appdesign.sk';

const indexPath = path.join(DIST, 'index.html');
const baseHtml = fs.readFileSync(indexPath, 'utf8');

function esc(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function stripHtml(s = '') {
  return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function absUrl(url) {
  if (!url) return `${SITE_URL}/assets/img/logo_white_bg.gif`;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function getProducts() {
  const all = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const res = await fetch(
      `${API_URL}/api/products?pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate=*`
    );

    if (!res.ok) {
      throw new Error(`Strapi products failed: ${res.status}`);
    }

    const json = await res.json();
    const data = json.data || [];

    all.push(...data);

    const pagination = json.meta?.pagination;
    const pageCount = pagination?.pageCount || 1;

    console.log(`Fetched products page ${page}/${pageCount}: ${data.length}`);

    if (page >= pageCount) break;
    page++;
  }

  return all;
}

function injectSeo(html, product) {
  const p = product.attributes ?? product;

  const slug = p.slug;
  const name = p.seoTitle || p.name || 'Produkt';
  const desc = stripHtml(p.seoDescription || p.short || p.description || '')
    .slice(0, 300);

  const url = `${SITE_URL}/produkt/${slug}`;

  const img =
    p.seoImage?.data?.attributes?.url ||
    p.images?.data?.[0]?.attributes?.url ||
    p.image?.data?.attributes?.url ||
    p.primaryImageUrl ||
    '';

  const imageUrl = absUrl(img);

  const finalDesc =
    desc || 'Ručne vyrábaná a maľovaná keramika z Modry.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: finalDesc,
    image: imageUrl,
    url,
    brand: {
      '@type': 'Brand',
      name: 'Slovenská ľudová majolika'
    }
  };

  let out = html;

  out = out.replace(/<title>.*?<\/title>/i, `<title>${esc(name)} | Majolika Modra</title>`);

  out = out.replace(
    /<meta name="description" content="[^"]*">/i,
    `<meta name="description" content="${esc(finalDesc)}">`
  );

  out = out.replace(
    /<meta property="og:type" content="[^"]*">/i,
    `<meta property="og:type" content="product">`
  );

  out = out.replace(
    /<meta property="og:title" content="[^"]*">/i,
    `<meta property="og:title" content="${esc(name)} | Majolika Modra">`
  );

  out = out.replace(
    /<meta property="og:description" content="[^"]*">/i,
    `<meta property="og:description" content="${esc(finalDesc)}">`
  );

  out = out.replace(
    /<meta property="og:url" content="[^"]*">/i,
    `<meta property="og:url" content="${url}">`
  );

  out = out.replace(
    /<meta property="og:image" content="[^"]*">/i,
    `<meta property="og:image" content="${imageUrl}">`
  );

  out = out.replace(
    /<meta name="twitter:title" content="[^"]*">/i,
    `<meta name="twitter:title" content="${esc(name)} | Majolika Modra">`
  );

  out = out.replace(
    /<meta name="twitter:description" content="[^"]*">/i,
    `<meta name="twitter:description" content="${esc(finalDesc)}">`
  );

  out = out.replace(
    /<meta name="twitter:image" content="[^"]*">/i,
    `<meta name="twitter:image" content="${imageUrl}">`
  );

  if (!out.includes('rel="canonical"')) {
    out = out.replace('</head>', `<link rel="canonical" href="${url}">\n</head>`);
  } else {
    out = out.replace(
      /<link rel="canonical" href="[^"]*">/i,
      `<link rel="canonical" href="${url}">`
    );
  }

  out = out.replace(
    '</head>',
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n</head>`
  );

  return out;
}

const products = await getProducts();

for (const product of products) {
  const p = product.attributes ?? product;
  if (!p.slug) continue;

  const html = injectSeo(baseHtml, product);
  const dir = path.join(DIST, 'produkt', p.slug);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');

  console.log(`SEO prerender: /produkt/${p.slug}`);
}