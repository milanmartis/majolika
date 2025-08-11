import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, map } from 'rxjs';
import { EventSessionWithCapacity, EventSessionsService } from './event-sessions.service'; // <- pridaj EventSessionsService

export interface CartRow {
  id: number;
  name: string;
  slug: string;
  price: number;
  price_sale?: number; // optional, môže byť bez zľavy
  inSale: boolean;
  qty: number;
  img: string;
  session?: EventSessionWithCapacity;
  bookingId?: number;
  holdExpires?: number; // timestamp ms
}

@Injectable({ providedIn: 'root' })
export class CartService {

  constructor(
    private eventSessionsService: EventSessionsService, // <- pridaj
  ) {}
  private readonly LS_KEY = 'eshop.cart.v1';
  private rows$ = new BehaviorSubject<CartRow[]>(this.load());
  cart$ = this.rows$.asObservable();
  count$ = this.rows$.pipe(map(list => list.reduce((sum, r) => sum + r.qty, 0)));
  total$ = this.rows$.pipe(map(list => list.reduce((s, r) => s + r.price * r.qty, 0)));

  // Opravené - súkromný subject a verejný observable
  private _bookingRemoved$ = new Subject<number>();
  public get bookingRemoved$() {
    return this._bookingRemoved$.asObservable();
  }

  private openSidebarSource = new Subject<void>();
  openSidebar$ = this.openSidebarSource.asObservable();

  get items(): CartRow[] { return this.rows$.value; }

  add(row: Omit<CartRow, 'qty'>, qty = 1) {
    this.cleanupExpiredHolds();
    const list = [...this.rows$.value];
  
    // Vyber správnu cenu podľa inSale a price_sale
    const shouldUseSale =
      row.inSale === true &&
      row.price_sale != null &&  // !== null alebo !== undefined
      row.price_sale !== 0;
  
    // Tu nemusíš riešiť qty, pridáš to nižšie
    const idx = row.session
      ? list.findIndex(r => r.session?.id === row.session?.id)
      : list.findIndex(r => r.id === row.id);
  
    if (idx > -1) {
      list[idx] = { ...list[idx], qty: list[idx].qty + qty };
    } else {
      // Správne – pridáš všetko z row + qty + správnu cenu
      list.push({
        ...row,
        qty,
        price: shouldUseSale ? row.price_sale! : row.price,
      });
    }
    this.update(list);
    this.openSidebarSource.next();
  }

  updateQty(id: number, qty: number, sessionId?: number) {
    // Mapuj len tú položku, ktorá má rovnaké id aj session.id
    const list = this.rows$.value.map(r =>
      r.id === id && (!sessionId || r.session?.id === sessionId)
        ? { ...r, qty }
        : r
    );
    // Nájdi konkrétny row podľa id a sessionId
    const row = this.rows$.value.find(r =>
      r.id === id && (!sessionId || r.session?.id === sessionId)
    );
  
    if (row && row.bookingId) {
      if (qty === 0) {
        this.eventSessionsService.patchBooking(row.bookingId, { status: 'cancelled' }).subscribe({
          next: () => {
            this.removeByBooking(row.bookingId!);
            this.eventSessionsService.notifyBookingChanged();
          }
        });
        return;
      } else {
        this.eventSessionsService.patchBooking(row.bookingId, { peopleCount: qty }).subscribe({
          next: () => {
            this.eventSessionsService.notifyBookingChanged();
          }
        });
      }
    }
  
    this.update(list);
  }
  
  remove(id: number, sessionId?: number) {
    // Odstráň len položku s konkrétnym id + sessionId
    this.update(this.rows$.value.filter(r =>
      !(r.id === id && (!sessionId || r.session?.id === sessionId))
    ));
  }

  removeByBooking(bookingId: number) {
    const filtered = this.rows$.value.filter(r => r.bookingId !== bookingId);
    if (filtered.length !== this.rows$.value.length) {
      this.update(filtered);
      this._bookingRemoved$.next(bookingId);  // Emitni event pre landing-page2!
    }
  }

  clear() { this.update([]); }
  openCart(): void { this.openSidebarSource.next(); }

  private update(list: CartRow[]) {
    this.rows$.next(list);
    localStorage.setItem(this.LS_KEY, JSON.stringify(list));
  }

  private load(): CartRow[] {
    try { return JSON.parse(localStorage.getItem(this.LS_KEY) || '[]'); }
    catch { return []; }
  }

  /** remove expired holds client-side; caller should cancel via backend separately if needed */
  cleanupExpiredHolds() {
    const now = Date.now();
    const filtered = this.rows$.value.filter(r => {
      if (r.holdExpires && r.holdExpires < now) return false;
      return true;
    });
    if (filtered.length !== this.rows$.value.length) {
      this.update(filtered);
    }
  }

  
}