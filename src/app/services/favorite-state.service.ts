import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { FavoriteService, Favorite } from './favorite.service';
import { Product } from './products.service';

@Injectable({ providedIn: 'root' })
export class FavoriteStateService {
  private readonly favs$ = new BehaviorSubject<Favorite[]>([]);
  readonly favorites$    = this.favs$.asObservable();

  private pending = false;

  constructor(private favSrv: FavoriteService) {
    this.reload();                                // init
  }

  /** ----- private helpers ---------------------------------- */

  private reload(): void {
    this.favSrv.getAll().subscribe({
      next: favs => {
        this.favs$.next(favs);
        console.log('🔹 favorites loaded', favs.map(f => f.product?.id));
      },
      error: err => console.error('reload error', err)
    });
  }

  private orphanOrMatches(prodId: number) {
    return (f: Favorite) =>
      (f.product && Number(f.product.id) === prodId) || !f.product;
  }

  /** ----- public API --------------------------------------- */

  toggle(product: Product): void {
    const favorite = this.favs$.value.find(f => f.product?.id === product.id);
  
    const req$ = favorite
      ? this.favSrv.remove(favorite.id)  // DELETE konkrétny záznam
      : this.favSrv.add(product.id);     // POST nový
  
    req$.pipe(finalize(() => this.reload())).subscribe();
  }

  /** Lokálne overenie pre UI */
  isFavorite(id: number | string): boolean {
    const key = String(id);
    return this.favs$.value.some(f => String(f.product?.id) === key);
  }
}
