// src/app/services/products.service.ts
/* ===============================================================
 *  src/app/services/products.service.ts
 *  „jediný“ zdroj pre produkty a kategórie
 * =============================================================== */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';
import { map as rxMap, map } from 'rxjs/operators';

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
export type MultiMedia  = { data?: MediaData[] } | MediaAttr[];

export interface Category {
  term_id: number;
  category_name: string;
  category_slug: string;
  parent?:   { term_id: number; category_name: string; category_slug: string };
  children?: { term_id: number; category_name: string; category_slug: string }[];
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  price: number | null;
  short?: string;
  describe?: string;

  variations?: Product[];
  categories?: Category[];

  picture_new?: any;
  pictures_new?: any;

  primaryImageUrl: string;
  galleryUrls: string[];
}

export interface StrapiResp<T = any> {
  data: T[];
  meta: any;
}

/* ================================================================= */

type FormatKey = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

@Injectable({ providedIn: 'root' })
export class ProductsService {

  private readonly api  = environment.apiUrl.replace(/\/\/+$/, '');
  private readonly host = this.api.replace(/\/api\/?$/, '');
  private readonly placeholder = '/assets/img/logo-SLM-modre.gif';

  private readonly populateList = [
    'picture_new',
    'pictures_new',
    'variations',
    'variations.picture_new',
    'variations.pictures_new'
  ].join(',');

  constructor(private http: HttpClient) {}

  /* ---------- helpery ---------------------------------------- */

  private absolutize = (url?: string): string =>
    url
      ? /^https?:\/\//i.test(url) ? url : `${this.host}${url}`
      : this.placeholder;

  private attr = (raw: any): MediaAttr | undefined =>
    raw?.data?.attributes ?? raw ?? undefined;

  public imageUrl = (
    raw: any,
    preferred: FormatKey = 'medium',
    fallback: FormatKey[] = ['large', 'medium', 'small', 'thumbnail', 'original']
  ): string => {
    const a = this.attr(raw);
    if (!a) { return this.placeholder; }

    const fm: Record<string, MediaFmt> | undefined = a.formats;
    const pick = (k: FormatKey): string | undefined =>
      k === 'original' ? a.url : fm?.[k]?.url;

    const queue = [preferred, ...fallback.filter(k => k !== preferred)];
    for (const key of queue) {
      const url = pick(key);
      if (url) { return this.absolutize(url); }
    }
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

    const rawVarArr = at.variations?.data ?? at.variations ?? [];
    const variations: Product[] = Array.isArray(rawVarArr)
      ? rawVarArr.map(this.normalize)
      : [];

    const primaryPicObj =
      at.picture_new ||
      variations.find((v: Product) => v.picture_new)?.picture_new ||
      null;

    const primaryGalleryObj =
      at.pictures_new ||
      variations.find((v: Product) =>
        v.pictures_new?.data?.length ||
        (Array.isArray(v.pictures_new) && v.pictures_new.length)
      )?.pictures_new ||
      null;

    const primaryImg = this.imageUrl(primaryPicObj, 'small');

    return {
      id: raw.id,
      slug: at.slug,
      name: at.name,
      price: at.price,
      short: at.short,
      describe: at.describe,

      variations,
      categories: at.categories?.data?.map((c: any) => c.attributes) ?? [],

      picture_new:  primaryPicObj,
      pictures_new: primaryGalleryObj,

      primaryImageUrl: primaryImg,
      galleryUrls: this.gallery(primaryGalleryObj, 'thumbnail'),
    };
  };

  private mapResp = rxMap((r: StrapiResp) => ({
    ...r,
    data: r.data.map(this.normalize),
  }));

  /* ---------- verejné API ------------------------------------ */
  getAllCategories(): Observable<StrapiResp<Category>> {
    const url = `${this.api}/categories?sort=category_name:asc&populate=*`;
    return this.http.get<StrapiResp<Category>>(url);
  }

  getRootProducts(): Observable<StrapiResp<Product>> {
    const q = [
      `filters[parent][id][$null]=true`,
      `filters[public][$eq]=1`,
      `sort=name:asc`,
      `populate=${this.populateList}`
    ].join('&');

    return this.http.get<StrapiResp>(`${this.api}/products?${q}`).pipe(this.mapResp);
  }

  getProductsByCategorySlug(slug: string): Observable<StrapiResp<Product>> {
    const q = [
      `filters[categories][category_slug][$eq]=${slug}`,
      `filters[public][$eq]=1`,
      `sort=name:asc`,
      `populate=${this.populateList}`
    ].join('&');

    return this.http.get<StrapiResp>(`${this.api}/products?${q}`).pipe(this.mapResp);
  }

  getProductWithVariations(slug: string): Observable<StrapiResp<Product>> {
    const q = [
      `filters[slug][$eq]=${slug}`,
      `filters[public][$eq]=true`,
      `populate=${this.populateList}`
    ].join('&');

    return this.http.get<StrapiResp>(`${this.api}/products?${q}`).pipe(this.mapResp);
  }

  getFeaturedProducts(): Observable<Product[]> {
    const q = [
      `filters[isFeatured][$eq]=true`,
      `filters[public][$eq]=true`,
      `sort=name:asc`,
      `populate=${this.populateList}`
    ].join('&');

    return this.http.get<StrapiResp>(`${this.api}/products?${q}`).pipe(
      this.mapResp,
      map(r => r.data.slice(0, 8))
    );
  }

  getRecommended(prod: Product): Observable<Product[]> {
    if (!prod.categories?.length) { return of([]); }
    const catSlug = prod.categories[0].category_slug;

    return this.getProductsByCategorySlug(catSlug).pipe(
      map(r => r.data.filter((p: Product) => p.id !== prod.id).slice(0, 8))
    );
  }
}