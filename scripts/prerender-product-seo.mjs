import fs from 'fs';
import path from 'path';

const DIST = 'dist/dashboard/browser';
const SITE_URL = 'https://www.majolika.sk';
const STRAPI_BASE_URL = 'https://majolika-cms.appdesign.sk';
const API_URL = `${STRAPI_BASE_URL}/api`;

const indexPath = [
  path.join(DIST, 'index.html'),
  path.join(DIST, 'index.csr.html'),
].find((candidate) => fs.existsSync(candidate));

if (!indexPath) {
  throw new Error(`Missing browser index in ${DIST}. Run the Angular build before prerendering SEO.`);
}

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
    .replace(/\\n/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absUrl(url) {
  if (!url) return `${SITE_URL}/assets/img/logo-SLM-modre.gif`;
  if (/^https?:\/\//i.test(url)) return url;
  return `${STRAPI_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function unwrapEntry(entry) {
  return entry?.attributes ?? entry ?? null;
}

function unwrapMedia(media) {
  if (!media) return null;
  if (Array.isArray(media)) return unwrapMedia(media[0]);
  if (Array.isArray(media?.data)) return unwrapMedia(media.data[0]);
  if (media?.data) return unwrapMedia(media.data);
  return unwrapEntry(media);
}

function mediaUrl(media) {
  const item = unwrapMedia(media);
  if (!item) return null;

  const formats = item.formats || {};
  return (
    formats.large?.url ||
    formats.medium?.url ||
    formats.small?.url ||
    formats.thumbnail?.url ||
    item.url ||
    null
  );
}

function firstMediaUrl(...candidates) {
  for (const candidate of candidates) {
    const url = mediaUrl(candidate);
    if (url) return absUrl(url);

    if (typeof candidate === 'string' && candidate.trim()) {
      return absUrl(candidate.trim());
    }
  }

  return absUrl(null);
}

function numericPrice(...values) {
  for (const value of values) {
    const price = Number(value);
    if (Number.isFinite(price) && price > 0) return price;
  }

  return 0;
}

function productPrice(product) {
  const ownPrice = numericPrice(product.price_sale, product.price);
  if (ownPrice > 0) return ownPrice;

  const variations = product.variations?.data ?? product.variations ?? [];
  if (!Array.isArray(variations)) return 0;

  for (const variation of variations) {
    const v = unwrapEntry(variation);
    const variationPrice = numericPrice(v?.price_sale, v?.price);
    if (variationPrice > 0) return variationPrice;
  }

  return 0;
}

function upsertHeadTag(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `${tag}\n</head>`);
}

function productSeo(product) {
  const seo = product.seo || {};
  const name = String(seo.metaTitle || product.name || 'Produkt');
  const description = stripHtml(
    seo.metaDescription ||
    product.short ||
    product.describe ||
    product.description ||
    'Ručne maľovaná keramika z Majoliky Modra.'
  ).slice(0, 300);

  const imageUrl = firstMediaUrl(
    seo.shareImage,
    product.picture_new,
    product.pictures_new,
    product.image,
    product.images,
    product.primaryImageUrl
  );

  return {
    slug: product.slug,
    name,
    description,
    imageUrl,
    url: `${SITE_URL}/produkt/${product.slug}`,
    sku: String(product.sku || product.slug),
    price: productPrice(product),
    availability: product.isSoldOut || product.isUnavailable ? 'OutOfStock' : 'InStock',
  };
}

async function getProducts() {
  const all = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const params = new URLSearchParams();
    params.set('locale', 'sk');
    params.set('filters[public][$eq]', 'true');
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', String(pageSize));
    params.set('sort', 'name:asc');
    params.set('populate', [
      '*',
      'variations.*',
      'categories',
      'categories.parent',
      'seo',
      'seo.shareImage',
    ].join(','));

    const res = await fetch(`${API_URL}/products?${params.toString()}`);

    if (!res.ok) {
      throw new Error(`Strapi products failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const data = (json.data || []).map(unwrapEntry).filter((product) => product?.slug);

    all.push(...data);

    const pagination = json.meta?.pagination;
    const pageCount = pagination?.pageCount || 1;

    console.log(`Fetched public products page ${page}/${pageCount}: ${data.length}`);

    if (page >= pageCount) break;
    page++;
  }

  return all;
}

function injectSeo(html, product) {
  const seo = productSeo(product);
  const title = `${seo.name} | Majolika Modra - ručne maľovaná keramika`;
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: seo.name,
    image: [seo.imageUrl],
    description: seo.description,
    sku: seo.sku,
    brand: {
      '@type': 'Brand',
      name: 'Majolika Modra',
    },
    offers: {
      '@type': 'Offer',
      url: seo.url,
      priceCurrency: 'EUR',
      price: seo.price.toFixed(2),
      availability: `https://schema.org/${seo.availability}`,
    },
  };

  let out = html.replace(/<title>.*?<\/title>/i, `<title>${esc(title)}</title>`);

  out = upsertHeadTag(out, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(seo.description)}">`);
  out = upsertHeadTag(out, /<meta property="og:type" content="[^"]*"\s*\/?>/i, '<meta property="og:type" content="product">');
  out = upsertHeadTag(out, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${esc(seo.name)}">`);
  out = upsertHeadTag(out, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${esc(seo.description)}">`);
  out = upsertHeadTag(out, /<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${esc(seo.url)}">`);
  out = upsertHeadTag(out, /<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${esc(seo.imageUrl)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:card" content="[^"]*"\s*\/?>/i, '<meta name="twitter:card" content="summary_large_image">');
  out = upsertHeadTag(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${esc(seo.name)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${esc(seo.description)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:image" content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${esc(seo.imageUrl)}">`);
  out = upsertHeadTag(out, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${esc(seo.url)}">`);
  out = out.replace(/<script id="product-jsonld" type="application\/ld\+json">.*?<\/script>\n?/is, '');

  return out.replace(
    '</head>',
    `<script id="product-jsonld" type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n</head>`
  );
}

const products = await getProducts();
const seen = new Set();

for (const product of products) {
  if (!product.slug || seen.has(product.slug)) continue;
  seen.add(product.slug);

  const html = injectSeo(baseHtml, product);
  const dir = path.join(DIST, 'produkt', product.slug);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');

  console.log(`SEO prerender: /produkt/${product.slug}`);
}

console.log(`SEO prerender complete: ${seen.size} public product pages`);
