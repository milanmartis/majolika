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
    if (this.pending) return;
    this.pending = true;
  
    const prodId = Number(product.id);
  
    // vyfiltruj všetko, čo má user + product, aj tie bez product (null)
    const targets = this.favs$.value.filter(
      f => Number(f.product?.id) === prodId || !f.product
    );
  
    const req$ = targets.length
      ? this.favSrv.removeMany(targets)   // DELETE všetky
      : this.favSrv.add(prodId);          // POST, ak ešte nič nie je
  
    req$
      .pipe(finalize(() => { this.pending = false; this.reload(); }))
      .subscribe();
  }

  /** Lokálne overenie pre UI */
  isFavorite(id: number | string): boolean {
    const key = String(id);
    return this.favs$.value.some(f => String(f.product?.id) === key);
  }
}
