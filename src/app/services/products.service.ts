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
  category_slug: string;
  category_text: string;
  category_image: string;
  category_image_small?: string;
  category_image_large?: string;
  parent?: {
    term_id: number;
    category_name: string;
    category_slug: string;
    category_text: string;
    category_image: string;
    category_image_small?: string;
    category_image_large?: string;

  };
}

export interface Product {
  id: number;
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

  primaryImageUrl: string;
  galleryUrls: string[];
  vatPercentage: number;
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


  private readonly api = environment.apiUrl.replace(/\/\/+$/, '');
  private readonly host = this.api.replace(/\/api\/?$/, '');
  private readonly placeholder = 'assets/img/logo-SLM-modre.gif';

  // Populate všetky polia a všetky polia variácií, aby slug/name/price boli k dispozícii
  private readonly populateList = ['*', 'variations.*'].join(',');

  constructor(private http: HttpClient) {}

  /* ---------- helpery ---------------------------------------- */

  private absolutize = (url?: string): string => {
    if (!url) return this.placeholder;

    if (/^https?:\/\//i.test(url)) return url;          // už absolútna URL
    if (/^(\/)?assets\//i.test(url)) {
      return url.startsWith('/') ? url.slice(1) : url;  // → 'assets/...'
    }
    if (/^(data:|blob:)/i.test(url)) return url;        // data/blob nechaj tak

    return `${this.host}${url}`;                        // Strapi relatívna
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
      console.warn('imageUrl: no attributes found, raw=', raw);
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
  
    console.warn('imageUrl: could not find any format, attr=', a);
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
  
    // variations (rekurzívne)
    const rawVarArr = at.variations?.data ?? at.variations ?? [];
    const variations: Product[] = Array.isArray(rawVarArr)
      ? rawVarArr.map(this.normalize)
      : [];
  
    // PRIMARY PICTURE fallback: ak je undefined, použijeme placeholder string
    const primaryPicObj = at.picture_new ?? at.primaryImageUrl ?? 'assets/img/logo-SLM-modre.gif';
    const primaryGalleryObj = at.pictures_new ?? [];
  
    const primaryImg = this.imageUrl(primaryPicObj, 'small');
  
    if (!primaryImg || primaryImg === this.placeholder) {
      console.warn(
        `normalize: resolved primaryImageUrl may be fallback for product id=${raw.id}, slug=${at.slug}`,
        { primaryPicObj, primaryImg }
      );
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
          category_slug: pAttrs.category_slug,
          category_text: pAttrs.category_text,
          category_image: this.imageUrl(pAttrs.category_image, 'medium'),
          category_image_small: this.imageUrl(pAttrs.category_image, 'small'),
          category_image_large: this.imageUrl(pAttrs.category_image, 'large'),
        };
      }
      return {
        term_id: c.id ?? catAttrs.term_id,
        category_name: catAttrs.category_name,
        category_slug: catAttrs.category_slug,
        category_text: catAttrs.category_text,
        category_image: this.imageUrl(catAttrs.category_image, 'medium'),
        category_image_small: this.imageUrl(catAttrs.category_image, 'small'),
        category_image_large: this.imageUrl(catAttrs.category_image, 'large'),
        parent: parentObj
      };
    });
  
    return {
      id: raw.id,
      slug: at.slug,
      name: at.name,
      price: resolvedPrice,
      price_sale: resolvedPriceSale,
      vatPercentage: Number.isFinite(+at.vatPercentage) ? +at.vatPercentage : 23,
      inSale: at.inSale,
      isNew: at.isNew,
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

  

getAllProductsForCategoryDeepest(
  slug: string
): Observable<Product[]> {
  return this.hasChildCategories(slug).pipe(
    switchMap(hasChildren => {
      if (hasChildren) {
        // má podkategórie → na tejto úrovni produkty NEukazujeme
        return of([] as Product[]);
      }
      const params = new HttpParams()
        .set('filters[categories][category_slug][$eq]', slug)
        .set('filters[parent][id][$null]', 'true') // iba parents
        .set('filters[public][$eq]', '1')
        .set('populate', this.populateList)
        .set('pagination[page]', '1')
        .set('pagination[pageSize]', '4000'); // „všetko“ pre klientské triedenie

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
    .set('pagination[pageSize]', '1000');

  return this.http
    .get<StrapiResp<Product>>(`${this.api}/products`, { params })
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
    .get<StrapiResp<Product>>(`${this.api}/products`, { params })
    .pipe(
      this.mapResp,
      map(resp => (resp.data.length ? resp.data[0] : null))
    );
}
  /* ---------- verejné API ------------------------------------ */

  searchProducts(query: string): Observable<Product[]> {
    const params = new HttpParams()
    .set('filters[public][$eq]', 'true')
    .set('filters[$or][0][name][$containsi]', query)
    .set('filters[$or][1][variations][name][$containsi]', query)
    .set('filters[$or][2][describe][$containsi]', query)
    .set('filters[$or][3][ean][$containsi]', query)
    .set('filters[$or][4][short][$containsi]', query)
    .set('filters[$or][5][slug][$containsi]', query)
    .set('filters[$or][6][categories][category_slug][$containsi]', query)
    .set('filters[$or][7][variations][slug][$containsi]', query)
    // .set('filters[$or][8][dekory][slug][$containsi]', query)
    // .set('filters[$or][9][tvar][slug][$containsi]', query)
    .set('sort', 'name:asc') // default sort
    .set('populate', this.populateList)
    .set('pagination[page]', '1')
    .set('pagination[pageSize]', '4000');
  
    console.log(
      'ProductsService.searchProducts(): volám URL =',
      `${this.api}/products?${params.toString()}`
    );
  
    return this.http.get<StrapiResp>(`${this.api}/products`, { params }).pipe(
      this.mapResp,
      map(r => r.data),
      map((products: Product[]) => {
      // helper: zjemní reťazec (diakritika → ASCII, lower-case)
      const norm = (s?: string) =>
        (s ?? '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

      const qN = norm(query.trim());

      const results: Product[] = [];
      const seen = new Set<string>();
      const keyOf = (x: Product) =>
        x?.id != null ? `id:${x.id}` : `slug:${x.slug ?? ''}`;

      for (const p of products) {
        // 1) Zápas parenta
        const prodFields = [p.name, p.short, p.describe, p.ean].map(norm);
        const matchesProduct = prodFields.some(f => f.includes(qN));

        // 2) Zápasy variácií
        const matchedVars = (p.variations ?? []).filter(v => {
          const varFields = [v.name, v.short, v.describe, v.ean].map(norm);
          return varFields.some(f => f.includes(qN));
        });

        // 3) Push parent (ak sedí) – bez duplicít
        if (matchesProduct && !seen.has(keyOf(p))) {
          seen.add(keyOf(p));
          results.push(p);
        }

        // 4) Push každú zodpovedajúcu variáciu – bez duplicít
        for (const v of matchedVars) {
          const k = keyOf(v as Product);
          if (!seen.has(k)) {
            seen.add(k);
            results.push(v as Product);
          }
        }
      }

      return results;
    })
    );
  }


  getAllCategoriesFlat(): Observable<Category[]> {
    const url =
      `${this.api}/categories` +
      `?sort=category_name:asc` +
      `&populate[0]=parent` +   // ⬅️ dôležité
      `&populate[1]=category_image` +   // ⬅️ dôležité
      `&pagination[limit]=-1`;

    return this.http.get<StrapiResp>(url).pipe(
      map(r => r.data.map(this.normalizeCategory))        // ⬅️ normalizácia
    );
  }


  private normalizeCategory = (raw: any): Category => {
    const at = raw.attributes ?? raw;

    const parentRaw = at.parent?.data ?? at.parent ?? null;
    const parent = parentRaw
      ? (() => {
          const p = parentRaw.attributes ?? parentRaw;
          return {
            term_id: parentRaw.id ?? p.term_id,
            category_name: p.category_name,
            category_slug: p.category_slug,
            category_text: p.category_text,
            category_image: this.imageUrl(p.category_image, 'medium'), // URL
            category_image_small: this.imageUrl(p.category_image, 'small'),
            category_image_large: this.imageUrl(p.category_image, 'large'),
          };
        })()
      : undefined;

    return {
      term_id: raw.id ?? at.term_id,
      category_name: at.category_name,
      category_slug: at.category_slug,
      category_text: at.category_text,
      category_image: this.imageUrl(at.category_image, 'medium'), // URL
      category_image_small: this.imageUrl(at.category_image, 'small'),
      category_image_large: this.imageUrl(at.category_image, 'large'),
      parent,
    };
  };

  getRootProducts(
    sort: string,
    page: number = 1,
    pageSize: number = 20
  ): Observable<StrapiResp<Product>> {
    const params = new HttpParams()
      .set('filters[parent][id][$null]', 'true')
      .set('filters[public][$eq]', '1')
      .set('populate', this.populateList)
      .set('sort', sort)
      .set('pagination[page]', page.toString())
      .set('pagination[pageSize]', pageSize.toString());
  
    return this.http
      .get<StrapiResp<Product>>(`${this.api}/products`, { params })
      .pipe(this.mapResp);
  }



  private hasChildCategories(slug: string): Observable<boolean> {
  const params = new HttpParams()
    .set('filters[parent][category_slug][$eq]', slug)
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
  pageSize: number = 20
): Observable<StrapiResp<Product>> {
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
        .set('filters[categories][category_slug][$eq]', slug)
        .set('filters[parent][id][$null]', 'true') // iba parents
        .set('filters[public][$eq]', '1')
        .set('populate', this.populateList)
        .set('sort', sort)
        .set('pagination[page]', page.toString())
        .set('pagination[pageSize]', pageSize.toString());

      return this.http
        .get<StrapiResp<Product>>(`${this.api}/products`, { params })
        .pipe(this.mapResp);
    })
  );
}


  getProductWithVariations(
    slug: string,
    sort:   string = 'name:asc',        // ← default here
    page:   number = 1,
    pageSize: number = 20
  ): Observable<StrapiResp<Product>> {
    const params = new HttpParams()
      .set('filters[$or][0][slug][$eq]', slug)
      .set('filters[$or][1][variations][slug][$eq]', slug)
      .set('filters[public][$eq]', 'true')
      .set('pagination[page]',     page.toString())
      .set('pagination[pageSize]', pageSize.toString())
      .set('sort',                  sort)            // now always set
      .set('populate', [
         '*',
         'variations.*',
         'categories',
         'categories.parent'
      ].join(','));
  
    return this.http
      .get<StrapiResp<Product>>(`${this.api}/products`, { params })
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
    .get<StrapiResp<Product>>(`${this.api}/products`, { params })
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
    .get<StrapiResp<Product>>(`${this.api}/products`, { params })
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
