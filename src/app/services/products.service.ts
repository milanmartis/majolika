// src/app/services/products.service.ts
/* ===============================================================
 *  src/app/services/products.service.ts
 *  „jediný“ zdroj pre produkty a kategórie
 * =============================================================== */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, of, forkJoin } from 'rxjs';
import { map as rxMap, map, switchMap } from 'rxjs/operators';
import { getLS } from 'app/utils/ssr';
import { throwError } from 'rxjs';
import { shareReplay, catchError } from 'rxjs/operators';
/* ---------- typy (len to, čo na fronte reálne potrebujeme) --- */

export interface MediaFmt {
  url: string;
  width: number;
  height: number;
}
export interface MediaAttr {
  url: string;
  formats?: Record<string, MediaFmt>;
}
export interface MediaData { id: number; attributes: MediaAttr; }
export type SingleMedia = { data?: MediaData | null } | MediaAttr;
export type MultiMedia = { data?: MediaData[] } | MediaAttr[];

export interface Category {
  term_id: number;
  category_name: string;
  category_name_en: string;
  category_name_de: string;
  category_slug: string;
  category_text: string;
  category_text_en: string;
  category_text_de: string;
  category_poradie: number;
  category_image: string;
  category_image_small?: string;
  category_image_large?: string;
  category_image_banner_large?: string;
  parent?: {
    term_id: number;
    category_name: string;
    category_name_en: string;
    category_name_de: string;
    category_slug: string;
    category_text: string;
    category_text_en: string;
    category_text_de: string;
    category_poradie: number;
    category_image: string;
    category_image_small?: string;
    category_image_banner?: string;
    category_image_large?: string;
    category_image_banner_large?: string;
    
  };
  extra_parents_slugs?: string[];
 extra_children_slugs?: string[]; 
}

export interface Product {
  id: number;
  documentId?: string;
  locale?: string; 
  slug: string;
  name: string;
  price: number | null;
  price_sale: number | null;
  inSale: boolean;
  short?: string;
  describe?: string;
  ean: string;
  variations?: Product[];
  categories?: Category[];
  isNew: boolean;
  picture_new?: any;
  pictures_new?: any;
  isSoldOut: boolean;
  isUnavailable: boolean;
  isDigitalProduct?: boolean;   // ✅ pridaj
  supportsDigital?: boolean;    // ✅ (ak chceš prepínač aj keď default je fyzicky)
  // staré „flat“ SEO polia – môžeš nechať ako fallback, ak ich používaš inde
  seoTitle?: string;
  seoDescription?: string;
  voucherType?: 'value' | 'service';
  voucherValue?: number | null;
  isGiftVoucher?: boolean;
  primaryImageUrl: string;
  galleryUrls: string[];
  vatPercentage: number;

  // 👇 Toto doplň – mapuje Strapi component "shared.seo"
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    shareImage?: {
      data?: {
        attributes?: {
          url?: string;
        };
      };
    };
  };
}

export interface StrapiResp<T = any> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

/* ================================================================= */

type FormatKey = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

@Injectable({ providedIn: 'root' })
export class ProductsService {

  invalidateCategoriesCache(): void {
    this.categoriesCache$ = undefined;
  }
  private categoriesCache$?: Observable<Category[]>;
  private readonly api = environment.apiUrl.replace(/\/\/+$/, '');
  private readonly host = this.api.replace(/\/api\/?$/, '');
  private readonly placeholder = 'assets/img/logo-SLM-modre.gif';

   private readonly allowedImageHosts = new Set<string>([
    // povolíme automaticky host Strapi (ak sem niekedy dá obrázky)
    (() => { try { return new URL(this.host).host; } catch { return ''; } })(),
    ...((environment as any).allowedImageHosts ?? []),
  ].filter(Boolean));

  private readonly allowedImageHostSuffixes: string[] =
    (environment as any).allowedImageHostSuffixes ?? [];

  private isAllowedAbsolute(url: string): boolean {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return false; // blokuj http

      // presná zhoda hostu
      if (this.allowedImageHosts.has(u.host)) return true;

      // zhoda na sufix (napr. *.cloudfront.net, *.amplifyapp.com)
      if (this.allowedImageHostSuffixes.some(sfx => u.host.endsWith(sfx))) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private blockSvg(url: string): string {
    // ak SVG chcete povoliť, len vráťte url
    return /\.svg(\?|#|$)/i.test(url) ? this.placeholder : url;
  } 

  // Populate všetky polia a všetky polia variácií, aby slug/name/price boli k dispozícii
  private readonly populateList = ['*', 'variations.*'].join(',');

private readonly listFields = [
  'documentId',
  'locale',
  'slug',
  'name',
  'price',
  'price_sale',
  'inSale',
  'vatPercentage',
  'isNew',
  'isSoldOut',
  'isUnavailable',
  'isDigitalProduct',
  'isGiftVoucher',
  'voucherType',
  'voucherValue',
  'short',
  'ean'
].join(',');


  // private get locale(): string {
  // return localStorage.getItem('language') || 'sk'; // z 'locale' → 'language'
  // a}
  private get locale(): string {
  return getLS('language') || 'sk';
}
  private withLocale(p: HttpParams): HttpParams {
    return p.set('locale', this.locale);
  }

  
  /** Pre zoznamy (karty produktov) – iba to, čo zobrazuješ v liste */
  private readonly listPopulate = [
    // 1 obrázok stačí; Strapi vráti aj formats
    'picture_new',
    // kategórie pre breadcrumb/názov
    'categories',
    'categories.parent'
  ].join(',');

  /** Pre detail produktu – bohatšie dáta, vrátane variácií a galérie */
  private readonly detailPopulate = [
    'picture_new',
    'pictures_new',
    'variations',
    'variations.picture_new',
    'categories',
    'categories.parent'
  ].join(',');

  /** Pre kategórie – ľahká verzia (bez zbytočných polí) */
  private readonly categoryFields = [
    'category_name','category_slug','category_text'
  ].join(',');

  private readonly categoryPopulate = [
    'parent',
    'category_image',
    'category_image_banner'
  ].join(',');


  private listParams(page: number, pageSize: number, sort: string): HttpParams {
    return new HttpParams()
      .set('fields', this.listFields)
      .set('populate', this.listPopulate)
      .set('pagination[page]', String(page))
      .set('pagination[pageSize]', String(pageSize))
      .set('sort', sort)
      .set('filters[parent][id][$null]', 'true') // len parent produkty
      .set('filters[public][$eq]', '1');
  }

  constructor(private http: HttpClient) {}

  /* ---------- helpery ---------------------------------------- */

  private absolutize = (url?: string): string => {
    if (!url) return this.placeholder;

    // Interné assets (ponecháme relatívne; prípadne blokni SVG)
    if (/^(\/)?assets\//i.test(url)) {
      const final = url.startsWith('/') ? url.slice(1) : url;
      return this.blockSvg(final);
    }

    // Zakáž data:/blob: (ak ich fakt nepotrebujete)
    if (/^(data:|blob:)/i.test(url)) {
      return this.placeholder;
    }

    // Absolútna URL: len HTTPS a len whitelisted hosty/sufixy
    if (/^https?:\/\//i.test(url)) {
      return this.isAllowedAbsolute(url) ? this.blockSvg(url) : this.placeholder;
    }

    // Relatívna Strapi cesta → doplň host
    const final = `${this.host}${url}`;
    return this.blockSvg(final);
  };

  private attr = (raw: any): MediaAttr | undefined =>
    raw?.data?.attributes ?? raw ?? undefined;

  public imageUrl = (
    raw: any,
    preferred: FormatKey = 'medium',
    fallback: FormatKey[] = ['large', 'medium', 'small', 'thumbnail', 'original']
  ): string => {
    // plain string path (napr. '/assets/...') alebo úplná URL
    if (typeof raw === 'string') {
      return this.absolutize(raw);
    }
  
    const a = this.attr(raw);
    if (!a) {
     // console.warn('imageUrl: no attributes found, raw=', raw);
      return this.placeholder;
    }
  
    const fm: Record<string, MediaFmt> | undefined = a.formats;
    const pick = (k: FormatKey): string | undefined =>
      k === 'original' ? a.url : fm?.[k]?.url;
  
    const queue = [preferred, ...fallback.filter(k => k !== preferred)];
    for (const key of queue) {
      const url = pick(key);
      if (url) {
        return this.absolutize(url);
      }
    }
  
    //console.warn('imageUrl: could not find any format, attr=', a);
    return this.placeholder;
  };

  /** ✅ Najdôležitejšie: získa lokalizovaný produkt podľa documentId + locale */
 getProductByDocumentIdForceLocale(documentId: string, locale: string) {
  const params = new HttpParams()
    .set('filters[documentId][$eq]', documentId)
    .set('pagination[pageSize]', '1');

  // + populate/fields podľa tvojho mapResp (ak potrebuješ)
  return this.http
    .get<any>(`${this.api}/products?locale=${locale}`, { params })
    .pipe(this.mapResp);
}

// helper: vytiahni prvý produkt
extractFirst(resp: any) {
  return resp?.data?.[0] ?? null;
}


getLocalizedSlugBySlug(sourceSlug: string, targetLocale: string) {
  const base = environment.apiUrl.replace(/\/$/, '');
  const locales = ['sk', 'en', 'de'];
  const want = (targetLocale || 'sk').toLowerCase();

  const reqs = locales.map(l => {
    const url =
      `${base}/products?locale=${l}` +
      `&filters[slug][$eq]=${encodeURIComponent(sourceSlug)}` +
      `&populate=localizations`;

    return this.http.get<any>(url).pipe(catchError(() => of(null)));
  });

  return forkJoin(reqs).pipe(
    map(responses => {
      // nájdi prvý locale kde ten slug existuje
      const hitResp = responses.find(r => r?.data?.length);
      const row = hitResp?.data?.[0];
      const attr = row?.attributes ?? row;
      if (!attr) return null;

      // ak už je to v správnom locale
      if ((attr.locale || '').toLowerCase() === want) return attr.slug as string;

      // localizations
      const locs = attr.localizations?.data ?? [];
      const hit = locs.find((x: any) =>
        ((x?.attributes?.locale ?? x?.locale ?? '') as string).toLowerCase() === want
      );

      return (hit?.attributes?.slug ?? hit?.slug ?? null) as string | null;
    })
  );
}
getProductByIdForceLocale(id: number, locale: string): Observable<Product | null> {
  const params = new HttpParams()
    .set('locale', locale)
    .set('filters[id][$eq]', id.toString())
    .set('filters[public][$eq]', 'true')
    .set('populate', this.detailPopulate)   // alebo this.populateList, ak chceš menej/viac
    .set('pagination[page]', '1')
    .set('pagination[pageSize]', '1');

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products`, { params })
    .pipe(
      this.mapResp,
      map(resp => (resp.data.length ? resp.data[0] : null))
    );
}
getProductWithVariationsForceLocale(
  slug: string,
  locale: string
): Observable<StrapiResp<Product>> {
  const params = new HttpParams()
    .set('filters[$or][0][slug][$eq]', slug)
    .set('filters[$or][1][variations][slug][$eq]', slug)
    .set('filters[public][$eq]', 'true')
    .set('pagination[page]', '1')
    .set('pagination[pageSize]', '1')
    .set('sort', 'name:asc')
    .set('populate', ['*','variations.*','categories','categories.parent','seo','seo.shareImage'].join(','));

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products?locale=${locale}`, { params })
    .pipe(this.mapResp);
}
getLocalizedSlugById(productId: number, locale: string) {
  const base = environment.apiUrl.replace(/\/$/, ''); // napr. https://majolika-cms.appdesign.sk/api
  return this.http
    .get<any>(`${base}/products/${productId}?populate=localizations&locale=all`)
    .pipe(
      map(res => {
        // Strapi v4: res.data.attributes...
        const data = res?.data;
        const attr = data?.attributes ?? data; // fallback ak už máš "flat" model

        if (!attr) return null;

        const target = (locale || 'sk').toLowerCase();

        // ak je už správny locale
        if ((attr.locale || '').toLowerCase() === target) {
          return attr.slug as string;
        }

        // localizations
        const locs = attr.localizations?.data ?? [];
        const hit = locs.find((x: any) =>
          ((x?.attributes?.locale ?? x?.locale ?? '') as string).toLowerCase() === target
        );

        return (hit?.attributes?.slug ?? hit?.slug ?? attr.slug ?? null) as string | null;
      })
    );
}
private stripFormatPrefix = (url: string): string =>
  // odstráni 'large_' | 'medium_' | 'small_' | 'thumbnail_' tesne pred názvom
  url.replace(/\/(large|medium|small|thumbnail)_([^/]+)$/i, '/$2');

public imageUrlBanner = (
  rawBanner: any,
  fallbackRaw: any
): string => {
  // 1) Banner je priamo string (URL)
  if (typeof rawBanner === 'string' && rawBanner.trim()) {
    return this.absolutize(this.stripFormatPrefix(rawBanner));
  }

  // 2) Banner je Strapi media objekt → vezmi originál (a.url)
  const a = this.attr(rawBanner);
  if (a?.url) {
    return this.absolutize(this.stripFormatPrefix(a.url));
  }

  // 3) Fallback na category_image (originál)
  if (typeof fallbackRaw === 'string' && fallbackRaw.trim()) {
    return this.absolutize(this.stripFormatPrefix(fallbackRaw));
  }
  const fb = this.attr(fallbackRaw)?.url;
  if (fb) {
    return this.absolutize(this.stripFormatPrefix(fb));
  }

  // 4) Posledná istota
  return this.placeholder;
};


  public gallery = (raw: any, preferred: FormatKey = 'thumbnail'): string[] => {
    const arr: any[] =
      raw?.data?.map?.((d: any) => d.attributes) ??
      (Array.isArray(raw) ? raw : []);
    return arr.map(a => this.imageUrl(a, preferred));
  };

  /** ------------------ normalize() --------------------------- */
  private normalize = (raw: any): Product => {
    const at = raw.attributes ?? raw;
  

    const documentId =
      (at as any).documentId ??
      (at as any).document_id ??
      (raw as any).documentId ??
      (raw as any).document_id ??
      null;

    const locale =
      (at as any).locale ??
      (raw as any).locale ??
      null;
    // variations (rekurzívne)
    const rawVarArr = at.variations?.data ?? at.variations ?? [];
    const variations: Product[] = Array.isArray(rawVarArr)
      ? rawVarArr.map(this.normalize)
      : [];
  
    // PRIMARY PICTURE fallback: ak je undefined, použijeme placeholder string
    const primaryPicObj = at.picture_new ?? at.primaryImageUrl ?? 'assets/img/logo-SLM-modre.gif';
    const primaryGalleryObj = at.pictures_new ?? [];
  
    const primaryImg = this.imageUrl(primaryPicObj, 'medium');
  
    if (!primaryImg || primaryImg === this.placeholder) {
      // console.warn(
      //   `normalize: resolved primaryImageUrl may be fallback for product id=${raw.id}, slug=${at.slug}`,
      //   { primaryPicObj, primaryImg }
      // );
    }



  
    // logika pre cenu
    let resolvedPrice: number | null = at.price ?? null;
    let resolvedPriceSale: number | null = at.price_sale ?? null;
    if ((resolvedPrice == null) && variations.length > 0) {
      resolvedPrice = variations[0].price;
    }
    if ((resolvedPriceSale == null) && variations.length > 0) {
      resolvedPriceSale = variations[0].price_sale;
    }
  
    // categories
    const catsRawData: any[] = Array.isArray(at.categories)
      ? at.categories
      : (at.categories?.data ?? []);
    const categories: Category[] = catsRawData.map((c: any) => {
      const catAttrs = c.attributes ?? c;
      const parentRaw = catAttrs.parent?.data ?? catAttrs.parent;
      let parentObj: Category['parent'] = undefined;
      if (parentRaw) {
        const pAttrs = parentRaw.attributes ?? parentRaw;
        parentObj = {
          term_id: parentRaw.id ?? pAttrs.term_id,
          category_name: pAttrs.category_name,
          category_name_en: pAttrs.category_name_en,
          category_name_de: pAttrs.category_name_de,
          category_slug: pAttrs.category_slug,
          category_poradie: pAttrs.category_poradie,
          category_text: pAttrs.category_text,
          category_text_en: pAttrs.category_text_en,
          category_text_de: pAttrs.category_text_de,
          category_image: this.imageUrl(pAttrs.category_image, 'small'),
          category_image_small: this.imageUrl(pAttrs.category_image, 'small'),
          category_image_large: this.imageUrl(pAttrs.category_image, 'large'),
          category_image_banner_large: this.imageUrlBanner(
            pAttrs.category_image_banner,            // banner
            pAttrs.category_image,                   // fallback -> large

          ),
        };
      }
      return {
        term_id: c.id ?? catAttrs.term_id,
 
        category_name: catAttrs.category_name,
        category_name_en: catAttrs.category_name_en,
        category_name_de: catAttrs.category_name_de,
        category_slug: catAttrs.category_slug,
        category_poradie: catAttrs.category_poradie,
        category_text: catAttrs.category_text,
        category_text_en: catAttrs.category_text_en,
        category_text_de: catAttrs.category_text_de,
        category_image: this.imageUrl(catAttrs.category_image, 'small'),
        category_image_small: this.imageUrl(catAttrs.category_image, 'small'),
        category_image_large: this.imageUrl(catAttrs.category_image, 'large'),
        category_image_banner_large: this.imageUrlBanner(
          catAttrs.category_image_banner,          // banner
          catAttrs.category_image,                 // fallback -> large
    
        ),
        parent: parentObj
      };
    });
const rawVat =
  (at as any).vatPercentage ??
  (at as any).vat_percentage ??
  (at as any).vat ??
  (raw as any).vatPercentage ??
  (raw as any)?.attributes?.vatPercentage ??
  (raw as any)?.attributes?.vat_percentage ??
  null;

const vat = Number(rawVat);
const vatPercentage = Number.isFinite(vat) ? vat : 23;
    return {
      id: raw.id,
      documentId: documentId ?? undefined,
      locale: locale ?? undefined,     
      slug: at.slug,
      name: at.name,
      isDigitalProduct: !!(at as any).isDigitalProduct,
      supportsDigital: !!(at as any).supportsDigital,
      isGiftVoucher: !!at.isGiftVoucher,
      voucherType: at.voucherType,
      voucherValue: at.voucherValue,
      price: resolvedPrice,
      price_sale: resolvedPriceSale,
      vatPercentage: vatPercentage,
      inSale: at.inSale,
      isNew: at.isNew,
      isSoldOut: at.isSoldOut === true,
      isUnavailable: at.isUnavailable === true,
      short: at.short,
      describe: at.describe,
      ean: at.ean,
      variations,
      categories,
      picture_new: primaryPicObj,
      pictures_new: primaryGalleryObj,
      primaryImageUrl: primaryImg,
      galleryUrls: Array.isArray(primaryGalleryObj)
        ? this.gallery(primaryGalleryObj, 'thumbnail')
        : [],
    };
  };

  private mapResp = rxMap((r: StrapiResp) => ({
    ...r,
    data: r.data.map(this.normalize),
  }));

  

getAllProductsForCategoryDeepest(slug: string): Observable<Product[]> {
  return this.hasChildCategories(slug).pipe(
    switchMap(hasChildren => {
      if (hasChildren) {
        return of([] as Product[]);
      }

      const params = new HttpParams()
        .set('locale', this.locale)
        .set('fields', this.listFields)
        .set('populate', this.listPopulate)
        .set('filters[categories][category_slug][$eq]', slug)
        .set('filters[parent][id][$null]', 'true')
        .set('filters[public][$eq]', '1')
        .set('pagination[page]', '1')
        .set('pagination[pageSize]', '4000');

      return this.http
        .get<StrapiResp<Product>>(`${this.api}/products`, { params })
        .pipe(this.mapResp, map(r => r.data));
    })
  );
}



getAllRootProducts(): Observable<Product[]> {
  const params = new HttpParams()
    .set('filters[parent][id][$null]', 'true')
    .set('filters[public][$eq]', '1')
    .set('populate', this.populateList)
    .set('sort', 'name:asc')
    .set('pagination[page]', '1')
    .set('pagination[pageSize]', '4000');

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products?locale=${this.locale}`, { params })
    .pipe(this.mapResp, map(r => r.data));
}



/** GET produkt podľa ID (vracia normalizovaný Product[]) */
getProductById(id: number): Observable<Product | null> {
  const params = new HttpParams()
    .set('filters[id][$eq]', id.toString())
    .set('filters[public][$eq]', 'true')
    .set('populate', this.populateList)
    .set('pagination[page]', '1')
    .set('pagination[pageSize]', '1');
  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products?locale=${this.locale}`, { params })
    .pipe(
      this.mapResp,
      map(resp => (resp.data.length ? resp.data[0] : null))
    );
}
  /* ---------- verejné API ------------------------------------ */
// private readonly listFields =
//   'slug,name,price,price_sale,inSale,vatPercentage,isNew,short,ean';

private readonly searchPopulate =
  'picture_new,categories,categories.parent,variations,variations.picture_new';

searchProducts(
  query: string,
  page: number = 1,
  pageSize: number = 20,
  locale: string = this.locale
): Observable<StrapiResp<Product>> {

  // multi-locale search, ale vo výsledku zobraz LEN aktuálny jazyk UI
  if (locale === 'all') {
    const locales = ['sk', 'en', 'de'];
    const uiLocale = (this.locale || 'sk').toLowerCase();

    return forkJoin(
      locales.map(l => this.searchProducts(query, page, pageSize, l))
    ).pipe(
      map((responses) => {
        const merged = responses.flatMap(r => r?.data ?? []);

        // group by documentId (ten istý produkt vo viacerých locales)
        const grouped = new Map<string, Product[]>();

        for (const p of merged) {
          const key = p.documentId ?? `id:${p.id}`;
          const arr = grouped.get(key) ?? [];
          arr.push(p);
          grouped.set(key, arr);
        }

        // ✅ zobraz len produkt v aktuálnom locale
        // ak SK verzia neexistuje, produkt sa vôbec nezobrazí
        const data = Array.from(grouped.values())
          .map(group =>
            group.find(p => (p.locale || '').toLowerCase() === uiLocale) ?? null
          )
          .filter((p): p is Product => !!p);

        const hasNext = responses.some(r => {
          const pg = r?.meta?.pagination;
          return !!pg && pg.page < pg.pageCount;
        });

        return {
          data,
          meta: {
            pagination: {
              page,
              pageSize,
              pageCount: hasNext ? page + 1 : page,
              total: data.length
            }
          }
        } as StrapiResp<Product>;
      })
    );
  }

  // single-locale search
  const params = new HttpParams()
    .set('locale', locale)
    .set('fields', this.listFields)
    .set('populate', this.searchPopulate)
    .set('filters[public][$eq]', 'true')
    .set('filters[$or][0][name][$containsi]', query)
    .set('filters[$or][1][ean][$containsi]', query)
    .set('filters[$or][2][slug][$containsi]', query)
    .set('sort', 'name:asc')
    .set('pagination[page]', String(page))
    .set('pagination[pageSize]', String(pageSize));

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products`, { params })
    .pipe(this.mapResp);
}



  getAllCategoriesFlat(): Observable<Category[]> {
    // ak už máme cache, vráť ju
    if (this.categoriesCache$) {
      return this.categoriesCache$;
    }

    const url =
      `${this.api}/categories` +
      `?sort=category_poradie:asc&sort=category_name:asc` +
      `&populate[0]=parent` +
      `&populate[1]=category_image` +
      `&populate[2]=category_image_banner` +
      `&populate[3]=extra_parents` + 
      `&populate[4]=extra_children` +
      `&pagination[limit]=-1`;

    // vytvor cacheovaný stream
    this.categoriesCache$ = this.http.get<StrapiResp>(url).pipe(
      map((r) =>
        r.data
          .map(this.normalizeCategory)
          .sort(
            (a, b) =>
              (a.category_poradie ?? 0) - (b.category_poradie ?? 0) ||
              a.category_name.localeCompare(b.category_name, 'sk', { sensitivity: 'base' })
          )
      ),
      // dôležité: cacheovať len úspešné výsledky
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError((err) => {
        // ak príde chyba, cache neuchovaj
        this.categoriesCache$ = undefined;
        return throwError(() => err);
      })
    );

    return this.categoriesCache$;
  }


private normalizeCategory = (raw: any): Category => {
  const at = raw.attributes ?? raw;

  // --- parent (kanonický) ---
  const parentRaw = at.parent?.data ?? at.parent ?? null;
  const parent = parentRaw
    ? (() => {
        const p = parentRaw.attributes ?? parentRaw;
        return {
          term_id: parentRaw.id ?? p.term_id,
          category_name: p.category_name,
          category_name_en: p.category_name_en,
          category_name_de: p.category_name_de,
          category_slug: p.category_slug,
          category_poradie: p.category_poradie,
          category_text: p.category_text,
          category_text_en: p.category_text_en,
          category_text_de: p.category_text_de,
          category_image: this.imageUrl(p.category_image, 'small'),
          category_image_small: this.imageUrl(p.category_image, 'small'),
          category_image_large: this.imageUrl(p.category_image, 'large'),
          // parent: ak nemá banner → fallback na svoj image
          category_image_banner_large: this.imageUrlBanner(
            p.category_image_banner,
            p.category_image,
          ),
        };
      })()
    : undefined;

  const isChild = !!parent;

  // --- extra_parents (sekundárne rodičovstvá) -> iba slugs ---
  const extraParentsRaw = at.extra_parents?.data ?? at.extra_parents ?? [];
  const extraParentsSlugs: string[] = Array.isArray(extraParentsRaw)
    ? Array.from(
        new Set(
          extraParentsRaw
            .map((e: any) => (e?.attributes ?? e)?.category_slug)
            .filter((s: any) => typeof s === 'string' && s.length > 0)
        )
      )
    : [];

    // --- extra_children (sekundárne deti na rodičovi) -> iba slugs ---
const extraChildrenRaw = at.extra_children?.data ?? at.extra_children ?? [];
const extraChildrenSlugs: string[] = Array.isArray(extraChildrenRaw)
  ? Array.from(
      new Set(
        extraChildrenRaw
          .map((e: any) => (e?.attributes ?? e)?.category_slug)
          .filter((s: any) => typeof s === 'string' && s.length > 0)
      )
    )
  : [];

  // 🔑 rozhodnutie banneru pre túto kategóriu
  let categoryBannerUrl: string | undefined;

  if (at.category_image_banner) {
    // ak má vlastný banner (root aj child) → použijeme ho
    categoryBannerUrl = this.imageUrlBanner(
      at.category_image_banner,
      at.category_image,  // fallback ak by banner URL bola rozbitá
    );
  } else if (!isChild && at.category_image) {
    // ROOT bez banneru → fallback na svoj image
    categoryBannerUrl = this.imageUrlBanner(
      null,
      at.category_image,
    );
  } else {
    // CHILD bez banneru → *žiadny vlastný banner*
    // necháme undefined, aby currentBannerUrl siahol po parent banneri
    categoryBannerUrl = undefined;
  }

  return {
    term_id: raw.id ?? at.term_id,
    category_name: at.category_name,
    category_name_en: at.category_name_en,
    category_name_de: at.category_name_de,
    category_slug: at.category_slug,
    category_poradie: at.category_poradie,
    category_text: at.category_text,
    category_text_en: at.category_text_en,
    category_text_de: at.category_text_de,
    category_image: this.imageUrl(at.category_image, 'small'),
    category_image_small: this.imageUrl(at.category_image, 'small'),
    category_image_large: this.imageUrl(at.category_image, 'large'),
    category_image_banner_large: categoryBannerUrl,
    parent,
    extra_parents_slugs: extraParentsSlugs,
    extra_children_slugs: extraChildrenSlugs,
  };
};



  getRootProducts(
  sort: string,
  page: number = 1,
  pageSize: number = 20
): Observable<StrapiResp<Product>> {
  const params = new HttpParams()
    // ⬇️ menší payload pre list
    .set('fields', this.listFields)
    .set('populate', this.listPopulate)
    // ⬇️ iba parent produkty, len public
    .set('filters[parent][id][$null]', 'true')
    .set('filters[public][$eq]', '1')
    // ⬇️ sort + stránkovanie
    .set('sort', sort)
    .set('pagination[page]', String(page))
    .set('pagination[pageSize]', String(pageSize));

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products?locale=${this.locale}`, { params })
    .pipe(this.mapResp);
}



  private hasChildCategories(slug: string): Observable<boolean> {
  const params = new HttpParams()
    .set('filters[$or][0][parent][category_slug][$eq]', slug)
    .set('filters[$or][1][extra_parents][category_slug][$eq]', slug)
    .set('pagination[page]', '1')
    .set('pagination[pageSize]', '1');

  return this.http
    .get<StrapiResp<Category>>(`${this.api}/categories`, { params })
    .pipe(map(resp => (resp?.meta?.pagination?.total ?? 0) > 0));
}


getProductsByCategorySlug(
  slug: string,
  sort: string,
  page: number = 1,
  pageSize: number = 20,
  locale?: string
): Observable<StrapiResp<Product>> {
  const useLocale = (locale ?? this.locale ?? 'sk');

  return this.hasChildCategories(slug).pipe(
    switchMap(hasChildren => {
      if (hasChildren) {
        // má podkategórie → neukazuj produkty
        return of({
          data: [],
          meta: { pagination: { page, pageSize, pageCount: 0, total: 0 } }
        } as StrapiResp<Product>);
      }

      const params = new HttpParams()
        // ✅ locale ako parameter (nie v URL)
        .set('locale', useLocale)

        // ⬇️ menší payload pre list
        .set('fields', this.listFields)
        .set('populate', this.listPopulate)

        // ⬇️ filtre
        .set('filters[categories][category_slug][$eq]', slug)
        .set('filters[parent][id][$null]', 'true') // iba parent produkty
        .set('filters[public][$eq]', '1')

        // ⬇️ sort + stránkovanie
        .set('sort', sort)
        .set('pagination[page]', String(page))
        .set('pagination[pageSize]', String(pageSize));

      return this.http
        .get<StrapiResp<Product>>(`${this.api}/products`, { params })
        .pipe(this.mapResp);
    })
  );
}


  getProductWithVariations(
  slug: string,
  sort:   string = 'name:asc',   // default
  page:   number = 1,
  pageSize: number = 20
): Observable<StrapiResp<Product>> {
  const params = new HttpParams()
    .set('filters[$or][0][slug][$eq]', slug)
    .set('filters[$or][1][variations][slug][$eq]', slug)
    .set('filters[public][$eq]', 'true')
    .set('pagination[page]',     page.toString())
    .set('pagination[pageSize]', pageSize.toString())
    .set('sort',                 sort)
    .set(
      'populate',
      [
        '*',                       // všetko bežné (pictures, variations atď.)
        'variations.*',
        'categories',
        'categories.parent',
        'seo',                     // 👈 SEO component na produkte
        'seo.shareImage',          // 👈 obrázok z SEO componentu
        // ak máš SEO aj na variáciách, môžeš doplniť:
        // 'variations.seo',
        // 'variations.seo.shareImage',
      ].join(',')
    );

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products?locale=${this.locale}`, { params })
    .pipe(this.mapResp);
}

  getFilteredProducts(
  page: number,
  pageSize: number,
  sort: string,
  categorySlug: string | null,
  decors: string[],
  shapes: string[]
): Observable<StrapiResp<Product>> {
  let params = new HttpParams()
    .set('populate', this.populateList)
    .set('sort', sort)
    .set('pagination[page]', page.toString())
    .set('pagination[pageSize]', pageSize.toString())
    // iba root (parents)
    .set('filters[parent][id][$null]', 'true');

  if (categorySlug) {
    params = params.set('filters[categories][category_slug][$eq]', categorySlug);
  }

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products?locale=${this.locale}`, { params })
    .pipe(
      this.mapResp,
      map(resp => ({
        ...resp,
        // nechávame len parents (žiadne rozbaľovanie variácií)
        data: this.flattenProductsWithVariations(resp.data)
      }))
    );
}

flattenProductsWithVariations(products: Product[]): Product[] {
  return products;
}



  // flattenProductsWithVariations(products: Product[]): Product[] {
  //   const results: Product[] = [];
  //   for (const p of products) {
  //     results.push(p);
  //     for (const v of p.variations ?? []) {
  //       // Ak chceš, môžeš do variácie pridať parentSlug, typ, atď.
  //       results.push({
  //         ...v,
  //         parentId: p.id,
  //         // prípadne aj ďalšie property z parentu, ak potrebuješ
  //       } as Product);
  //     }
  //   }
  //   return results;
  // }

getFeaturedProducts(): Observable<Product[]> {
  const params = new HttpParams()
    .set('filters[isFeatured][$eq]', 'true')
    .set('filters[public][$eq]', 'true')
    .set('sort', 'name:asc')
    .set('populate', this.populateList)
    .set('pagination[page]', '1')
    .set('pagination[pageSize]', '1000');

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products?locale=${this.locale}`, { params })
    .pipe(
      this.mapResp,
      map(resp => resp.data.map(p => ({
        ...p,
        // zabezpečíme obrázok cez primaryImageUrl
        primaryImageUrl: p.primaryImageUrl || 'assets/img/logo-SLM-modre.gif'
      })))
    );
}

  // getRecommended(prod: Product): Observable<Product[]> {
  //   if (!prod.categories?.length) { return of([]); }
  //   const catSlug = prod.categories[0].category_slug;
  //   return this.getProductsByCategorySlug(catSlug)
  //     .pipe(map(r => r.data.filter(p => p.id !== prod.id).slice(0, 8)));
  // }
}
