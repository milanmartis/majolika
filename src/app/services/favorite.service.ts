// src/app/services/favorite.service.ts
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Product } from './products.service';
import { environment } from '../../environments/environment';

export interface Favorite { 
  id: number; 
  product: Product; 
}
interface FavoriteResponse {
  data: Favorite[];
  meta: any;
}

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private base = `${environment.apiUrl}/favorites`;

  constructor(private http: HttpClient) {}

  /** Vráti priamo pole Favorite[] */
  getAll() {
    return this.http
      .get<FavoriteResponse>(`${this.base}?populate=product`)
      .pipe(map(res => res.data));
  }

  add(productId: number) {
    return this.http.post<{ data: Favorite }>(this.base, { data: { product: productId } })
      .pipe(map(res => res.data));
  }

  remove(favId: number) {
    return this.http.delete<void>(`${this.base}/${favId}`);
  }
}
