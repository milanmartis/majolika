import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FavoriteService, Favorite } from './favorite.service';
import { Product } from './products.service';

@Injectable({ providedIn: 'root' })
export class FavoriteStateService {
  private favs$ = new BehaviorSubject<Favorite[]>([]);
  favorites$ = this.favs$.asObservable();

  constructor(private favSrv: FavoriteService) {
    this.load();
  }

  load(): void {
    this.favSrv.getAll().subscribe(favs => this.favs$.next(favs));
  }

  toggle(product: Product): void {
    // Získame numerické ID pre Strapi (odstránime prípadné ean či slug)
    const prodId = typeof product.id === 'string'
      ? Number(product.id)
      : product.id;

    const existing = this.favs$.value.find(f => f.product.id === prodId);
    if (existing) {
      this.favSrv.remove(existing.id).subscribe(() => this.load());
    } else {
      this.favSrv.add(prodId).subscribe(() => this.load());
    }
  }

  isFavorite(id: number): boolean {
    return this.favs$.value.some(f => f.product.id === id);
  }
}
