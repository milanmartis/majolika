import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, EMPTY } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../environments/environment';

export interface Favorite {
  id: number;
  product: { id: number } | null;
}

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  /** Jeden bod pravdy – meníš len environment.apiUrl, nie kód. */
  private readonly base = `${environment.apiUrl}/favorites`;

  constructor(private http: HttpClient) {}

  /** GET /api/favorites?populate=product */
  getAll(): Observable<Favorite[]> {
    return this.http
      .get<{ data: Favorite[] }>(`${this.base}?populate=product`)
      .pipe(map(r => r.data));
  }

  /** POST /api/favorites */
  add(productId: number) {
    return this.http.post(this.base, { data: { product: productId } });
  }

  /** DELETE /api/favorites/:id */
  remove(favId: number) {
    return this.http.delete(`${this.base}/${favId}`);
  }

  /** Paralelne zmaže viac obľúbených záznamov */
  removeMany(favs: Favorite[]) {
    if (!favs.length) return EMPTY;
    return forkJoin(favs.map(f => this.remove(f.id)));
  }
  
}
