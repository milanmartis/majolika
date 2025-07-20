/* ===============================================================
 *  src/app/services/cart.service.ts
 *  Jednoduchý klient-side košík s persistenciou do localStorage
 * =============================================================== */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, map } from 'rxjs';

/* ---------- model jedného riadku košíka ------------------------ */
export interface CartRow {
  id:    number;  // ID produktu alebo variantu
  name:  string;
  slug:  string;
  price: number;  // jednotková cena
  qty:   number;  // množstvo
  img:   string;  // náhľad (URL)
}

@Injectable({ providedIn: 'root' })
export class CartService {

  private readonly LS_KEY = 'eshop.cart.v1';

  /* ---------------------- stav + persistencia ------------------ */
  private rows$    = new BehaviorSubject<CartRow[]>(this.load());
  /** celý obsah košíka (readonly stream) */
  cart$         = this.rows$.asObservable();
  /** počet kusov (na badge) */
  count$        = this.rows$.pipe(
    map(list => list.reduce((sum, r) => sum + r.qty, 0))
  );
  /** celková suma € */
  total$        = this.rows$.pipe(
    map(list => list.reduce((s, r) => s + r.price * r.qty, 0))
  );

  /* ------------- otvorenie bočného panelu ----------------------- */
  private openSidebarSource = new Subject<void>();
  /** stream udalostí na otvorenie sidebaru */
  openSidebar$ = this.openSidebarSource.asObservable();

  /* ---------------------- verejné API -------------------------- */

  /**
   * pridá položku alebo navýši qty,
   * potom pošle event na otvorenie sidebaru
   */
  add(row: Omit<CartRow, 'qty'>, qty = 1) {
    const list = [...this.rows$.value];
    const i = list.findIndex(r => r.id === row.id);

    if (i > -1) {
      list[i] = { ...list[i], qty: list[i].qty + qty };
    } else {
      list.push({ ...row, qty });
    }

    this.update(list);
    this.openSidebarSource.next();
  }

  /** upraví množstvo položky v košíku */
  updateQty(id: number, qty: number) {
    const list = this.rows$.value.map(r =>
      r.id === id ? { ...r, qty } : r
    );
    this.update(list);
  }

  /** odstráni položku z košíka */
  remove(id: number) {
    this.update(this.rows$.value.filter(r => r.id !== id));
  }

  /** vyprázdni košík */
  clear() {
    this.update([]);
  }

  /** manuálne otvoriť bočný panel košíka */
  openCart(): void {
    this.openSidebarSource.next();
  }

  /* ----------------------- interné ----------------------------- */

  /** aktualizuje BehaviorSubject a localStorage */
  private update(list: CartRow[]) {
    this.rows$.next(list);
    localStorage.setItem(this.LS_KEY, JSON.stringify(list));
  }

  /** načíta zoznam z localStorage */
  private load(): CartRow[] {
    try {
      return JSON.parse(localStorage.getItem(this.LS_KEY) || '[]');
    } catch {
      return [];
    }
  }
}
