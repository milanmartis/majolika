import { Injectable } from '@angular/core';
import { BehaviorSubject, throwError, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

import { FavoriteService, Favorite } from './favorite.service';
import { Product } from './products.service';

@Injectable({ providedIn: 'root' })
export class FavoriteStateService {
  private readonly favs$ = new BehaviorSubject<Favorite[]>([]);
  readonly favorites$ = this.favs$.asObservable();

  /** jednoduchý lock proti dvojkliku */
  private inFlight = new Set<number | string>();

  constructor(private favSrv: FavoriteService) {
    this.reload();
  }

  /** Verejné opätovné načítanie (napr. po prihlásení) */
  loadFavorites(): void {
    this.reload();
  }

  /** Interné načítanie zo servera */
  private reload(): void {
    this.favSrv.getAll().subscribe({
      next: (favs) => {
        const normalized = favs
          .map(f => this.normalizeFavorite(f))
          .filter((x): x is Favorite => !!x && !!x.product?.id);

        const unique = this.uniqueByProductId(normalized);
        this.favs$.next(unique);
        // console.log('🔹 favorites loaded', unique.map(f => f.product?.id));
      },
      error: (err) => console.error('reload error', err),
    });
  }

  /** Prepnutie obľúbeného stavu – optimisticky + idempotentné správanie pri 409 */
  toggle(product: Product): void {
    const pid = String(product.id);
    if (this.inFlight.has(pid)) return; // blokni spam
    this.inFlight.add(pid);

    const prev = this.favs$.value;
    const existing = prev.find(f => String(f.product?.id) === pid);

    if (existing) {
      // ✅ Optimistické odstránenie
      const next = prev.filter(f => String(f.product?.id) !== pid);
      this.favs$.next(next);

      this.favSrv.remove(existing.id).pipe(
        catchError(err => {
          console.error('remove fav failed -> rollback', err);
          this.favs$.next(prev); // ⬅ rollback
          return throwError(() => err);
        })
      ).subscribe({
        complete: () => this.inFlight.delete(pid),
        error:    () => this.inFlight.delete(pid)
      });

    } else {
      // ➕ Optimistické pridanie (dočasný záznam) – UI sa hneď prepne
      const tempId = -Date.now();
      const temp: Favorite = { id: tempId, product: { ...product } as any } as Favorite;
      this.favs$.next([...prev, temp]);

      this.favSrv.add(product.id).pipe(
        catchError((err: HttpErrorResponse) => {
          if (err?.status === 409) {
            // už existuje → ber ako success, zosynchronizuj serverový stav
            this.reload();
            return of(null);
          }
          // iné chyby -> rollback
          console.error('add fav failed -> rollback', err);
          this.favs$.next(prev);
          return throwError(() => err);
        })
      ).subscribe({
        next: (createdRaw: any) => {
          if (createdRaw === null) return; // 409 branch už spravila reload()
          const created = this.normalizeFavorite(createdRaw, product);
          if (!created || !created.product?.id) {
            // nevieme normalizovať → radšej full reload
            this.reload();
            return;
          }
          // nahradíme dočasný záznam reálnym a deduplikujeme podľa product.id
          const list = this.favs$.value
            .filter(f => f.id !== tempId && String(f.product?.id) !== pid);
          this.favs$.next([...list, created]);
        },
        complete: () => this.inFlight.delete(pid),
        error:    () => this.inFlight.delete(pid)
      });
    }
  }

  /** Lokálna kontrola, či je produkt obľúbený */
  isFavorite(id: number | string): boolean {
    const key = String(id);
    return this.favs$.value.some(f => String(f.product?.id) === key);
  }

  /** Pomocník: dedupe podľa product.id (posledný vyhráva) */
  private uniqueByProductId(items: Favorite[]): Favorite[] {
    const map = new Map<string, Favorite>();
    for (const f of items) {
      const key = String(f.product?.id ?? '');
      if (key) map.set(key, f);
    }
    return Array.from(map.values());
  }

  /**
   * Normalizuj rôzne tvary odpovedí (Strapi často vracia { data: {...} }).
   * Snažíme sa vždy skončiť s objektom, kde je prístupné `favorite.product.id`.
   */
  private normalizeFavorite(raw: any, fallbackProduct?: Product): Favorite | null {
    if (!raw) return null;

    // 1) Ak to už vyzerá ako náš Favorite (má product.id), necháme tak
    if (raw?.product?.id) return raw as Favorite;

    // 2) Strapi tvar: { data: { id, attributes: { product: { data: { id, attributes... }}}}}
    const data = raw?.data ?? raw;
    const id   = data?.id ?? raw?.id;

    // product id sa môže nachádzať tu:
    const prodId =
      data?.attributes?.product?.data?.id ??
      data?.product?.data?.id ??
      data?.product?.id ??
      raw?.product?.data?.id ??
      raw?.product?.id ??
      fallbackProduct?.id;

    if (!id) return null;

    const out: Favorite = {
      id,
      product: prodId ? ({ id: prodId } as any) : (fallbackProduct as any)
    } as Favorite;

    return out;
  }
}
