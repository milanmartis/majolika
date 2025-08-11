import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { FavoriteService, Favorite } from './favorite.service';
import { Product } from './products.service';

@Injectable({ providedIn: 'root' })
export class FavoriteStateService {
  private readonly favs$ = new BehaviorSubject<Favorite[]>([]);
  readonly favorites$    = this.favs$.asObservable();

  constructor(private favSrv: FavoriteService) {
    // prvotné načítanie
    this.reload();
  }

  /** 
   * Verejná metóda na explicitné opätovné načítanie obľúbených 
   * (volaj z komponentu, napr. po prihlásení)
   */
  loadFavorites(): void {
    this.reload();
  }

  /** ----- interné načítanie zo servera -------------------- */
  private reload(): void {
    this.favSrv.getAll().subscribe({
      next: favs => {
        this.favs$.next(favs);
        console.log('🔹 favorites loaded', favs.map(f => f.product?.id));
      },
      error: err => console.error('reload error', err)
    });
  }

  /** ----- prepínanie obľúbeného stavu a re–load ----------- */
  toggle(product: Product): void {
    const existing = this.favs$.value.find(f => f.product?.id === product.id);
    const req$ = existing
      ? this.favSrv.remove(existing.id)  // odstrániť
      : this.favSrv.add(product.id);     // pridať
    req$.pipe(finalize(() => this.reload())).subscribe();
  }

  /** Lokálna kontrola, či je produkt obľúbený */
  isFavorite(id: number | string): boolean {
    const key = String(id);
    return this.favs$.value.some(f => String(f.product?.id) === key);
  }
}
