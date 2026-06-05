import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, EMPTY } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { Product } from './products.service';

export interface Favorite {
  id: number;
  documentId?: string;
  product: {
    id: number;
    documentId?: string;
    slug: string;
    name: string;
    price: number | null;
    price_sale: number | null;
    inSale: boolean;
    short?: string;
    describe?: string;
    ean: string;

    picture_new?: any;
    pictures_new?: any;

    primaryImageUrl: string;
    galleryUrls: string[];
  } | null;
}

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  /** Jeden bod pravdy – meníš len environment.apiUrl, nie kód. */
  private readonly base = `${environment.apiUrl}/favorites`;

  constructor(private http: HttpClient) {}

  /** GET /favorites?populate=product */
  getAll(): Observable<Favorite[]> {
    return this.http
      .get<{ data: Favorite[] }>(this.base, {
        headers: this.headers(),
      })
      .pipe(map(r => r.data));
  }

  /** POST /favorites – vráti vytvorený Favorite */
  add(product: Product): Observable<Favorite> {
    return this.http
      .post<{ data: Favorite }>(
        this.base,
        { data: { product: product.id } },
        { headers: this.headers() }
      )
      .pipe(map(r => r.data));
  }

  /** DELETE /favorites/:id – nepotrebujeme payload, mapneme na void */
  remove(favorite: Favorite | number): Observable<void> {
    const key = typeof favorite === 'number'
      ? favorite
      : favorite.id;

    return this.http
      .delete<{ data: unknown }>(`${this.base}/${key}`)
      .pipe(map(() => void 0));
  }

  /** Paralelne zmaže viac obľúbených záznamov */
  removeMany(favs: Favorite[]) {
    if (!favs.length) return EMPTY;
    return forkJoin(favs.map(f => this.remove(f)));
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'x-skip-locale': 'true',
    });
  }
}
