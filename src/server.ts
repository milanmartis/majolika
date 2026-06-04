import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from 'main.server';
import { environment } from './environments/environment';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const app = express();
const commonEngine = new CommonEngine();

type ProductSeo = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  sku: string;
  price: number;
  availability: 'InStock' | 'OutOfStock';
};

const siteUrl = (environment.frontendUrl || 'https://www.majolika.sk').replace(/\/$/, '');
const apiUrl = (environment.apiUrl || 'https://majolika-cms.appdesign.sk/api').replace(/\/$/, '');
const strapiBaseUrl = (environment.strapiBaseUrl || apiUrl.replace(/\/api$/, '')).replace(/\/$/, '');

function escapeHtml(value: string): string {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function stripHtml(value: unknown): string {
  return String(value || '')
    .replace(/\\n/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteMediaUrl(url: string | null | undefined): string {
  if (!url) return `${siteUrl}/assets/img/logo-SLM-modre.gif`;
  if (/^https?:\/\//i.test(url)) return url;
  return `${strapiBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function unwrapEntry(entry: any): any {
  return entry?.attributes ?? entry ?? null;
}

function unwrapMedia(media: any): any {
  if (!media) return null;
  if (Array.isArray(media)) return unwrapMedia(media[0]);
  if (Array.isArray(media?.data)) return unwrapMedia(media.data[0]);
  if (media?.data) return unwrapMedia(media.data);
  return unwrapEntry(media);
}

function mediaUrl(media: any): string | null {
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

function firstMediaUrl(...candidates: any[]): string {
  for (const candidate of candidates) {
    const url = mediaUrl(candidate);
    if (url) return absoluteMediaUrl(url);
    if (typeof candidate === 'string' && candidate.trim()) {
      return absoluteMediaUrl(candidate.trim());
    }
  }
  return absoluteMediaUrl(null);
}

function numericPrice(...values: unknown[]): number {
  for (const value of values) {
    const price = Number(value);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return 0;
}

function productPrice(product: any): number {
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

function productSlugFromPath(pathname: string): string | null {
  const match = /^\/produkt\/([^/?#]+)\/?$/.exec(pathname);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]);
}

async function fetchProductSeo(slug: string): Promise<ProductSeo | null> {
  const params = new URLSearchParams();
  params.set('locale', 'sk');
  params.set('filters[$or][0][slug][$eq]', slug);
  params.set('filters[$or][1][variations][slug][$eq]', slug);
  params.set('filters[public][$eq]', 'true');
  params.set('pagination[page]', '1');
  params.set('pagination[pageSize]', '1');
  params.set('sort', 'name:asc');
  params.set('populate', [
    '*',
    'variations.*',
    'categories',
    'categories.parent',
    'seo',
    'seo.shareImage',
  ].join(','));

  try {
    const response = await fetch(`${apiUrl}/products?${params.toString()}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const json: any = await response.json();
    const product = unwrapEntry(json?.data?.[0]);
    if (!product?.slug) return null;

    const seo = product.seo || {};
    const title = String(seo.metaTitle || product.name || 'Produkt');
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
      title,
      description,
      imageUrl,
      url: `${siteUrl}/produkt/${product.slug}`,
      sku: String(product.sku || product.slug),
      price: productPrice(product),
      availability: product.isSoldOut || product.isUnavailable ? 'OutOfStock' : 'InStock',
    };
  } catch {
    return null;
  }
}

function upsertHeadTag(html: string, pattern: RegExp, tag: string): string {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `${tag}\n</head>`);
}

function injectProductSeo(html: string, seo: ProductSeo): string {
  const title = `${seo.title} | Majolika Modra - ručne maľovaná keramika`;
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: seo.title,
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

  let out = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  out = upsertHeadTag(out, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeHtml(seo.description)}">`);
  out = upsertHeadTag(out, /<meta property="og:type" content="[^"]*"\s*\/?>/i, '<meta property="og:type" content="product">');
  out = upsertHeadTag(out, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(seo.title)}">`);
  out = upsertHeadTag(out, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(seo.description)}">`);
  out = upsertHeadTag(out, /<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${escapeHtml(seo.url)}">`);
  out = upsertHeadTag(out, /<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${escapeHtml(seo.imageUrl)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:card" content="[^"]*"\s*\/?>/i, '<meta name="twitter:card" content="summary_large_image">');
  out = upsertHeadTag(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${escapeHtml(seo.title)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${escapeHtml(seo.description)}">`);
  out = upsertHeadTag(out, /<meta name="twitter:image" content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${escapeHtml(seo.imageUrl)}">`);
  out = upsertHeadTag(out, /<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${escapeHtml(seo.url)}">`);
  out = out.replace(/<script id="product-jsonld" type="application\/ld\+json">.*?<\/script>\n?/is, '');

  return out.replace(
    '</head>',
    `<script id="product-jsonld" type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n</head>`
  );
}

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.get(
  '**',
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html'
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.get('**', (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;
  const requestUrl = `${protocol}://${headers.host}${originalUrl}`;
  const productSlug = productSlugFromPath(new URL(requestUrl).pathname);

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: requestUrl,
      publicPath: browserDistFolder,
      providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
    })
    .then(async (html) => {
      if (!productSlug) return html;
      const productSeo = await fetchProductSeo(productSlug);
      return productSeo ? injectProductSeo(html, productSeo) : html;
    })
    .then((html) => res.send(html))
    .catch((err) => next(err));
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default app;
