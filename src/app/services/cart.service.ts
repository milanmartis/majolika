import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, map } from 'rxjs';
import { EventSessionWithCapacity, EventSessionsService } from './event-sessions.service';

export interface CartRow {
  id: number;
  name: string;
  slug: string;
  price: number;
  price_sale?: number;
  inSale: boolean;
  qty: number;
  img: string;
  session?: EventSessionWithCapacity;
  bookingId?: number;
  holdExpires?: number;
  vatPercentage?: number;

  isGiftVoucher?: boolean;
  voucherType?: 'value' | 'service';
  voucherValue?: number | null;
  type?: 'product' | 'gift_voucher' | 'event' | 'service';
  // ✅ NOVÉ:
  isDigitalProduct?: boolean;   // = "má možnosť byť digitálny"
  digitalSelected?: boolean;    // = "užívateľ zvolil digitálne"
}

@Injectable({ providedIn: 'root' })
export class CartService {

  constructor(
    private eventSessionsService: EventSessionsService,
  ) {}

  private readonly LS_KEY = 'eshop.cart.v1';
  private rows$ = new BehaviorSubject<CartRow[]>(this.load());
  cart$ = this.rows$.asObservable();
  count$ = this.rows$.pipe(map(list => list.reduce((sum, r) => sum + r.qty, 0)));
  total$ = this.rows$.pipe(map(list => list.reduce((s, r) => s + r.price * r.qty, 0)));

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

    const shouldUseSale =
      row.inSale === true &&
      row.price_sale != null &&
      row.price_sale !== 0;

    const idx = row.session
      ? list.findIndex(r => r.session?.id === row.session?.id)
      : list.findIndex(r => r.id === row.id);

    if (idx > -1) {
      list[idx] = { ...list[idx], qty: list[idx].qty + qty };
    } else {
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
    const list = this.rows$.value.map(r =>
      r.id === id && (!sessionId || r.session?.id === sessionId)
        ? { ...r, qty }
        : r
    );
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
    this.update(this.rows$.value.filter(r =>
      !(r.id === id && (!sessionId || r.session?.id === sessionId))
    ));
  }

  removeByBooking(bookingId: number) {
    const filtered = this.rows$.value.filter(r => r.bookingId !== bookingId);
    if (filtered.length !== this.rows$.value.length) {
      this.update(filtered);
      this._bookingRemoved$.next(bookingId);
    }
  }

  clear() { this.update([]); }
  openCart(): void { this.openSidebarSource.next(); }

  private update(list: CartRow[]) {
    this.rows$.next(list);
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.LS_KEY, JSON.stringify(list));
  }

  patchVat(productId: number, vatPercentage: number, sessionId?: number) {
    const list = this.rows$.value.map(r =>
      r.id === productId && (!sessionId || r.session?.id === sessionId)
        ? { ...r, vatPercentage }
        : r
    );
    this.update(list);
  }

  toggleDigital(productId: number, checked: boolean, sessionId?: number) {
  const list = this.rows$.value.map(r =>
    r.id === productId && (!sessionId || r.session?.id === sessionId)
      ? { ...r, digitalSelected: checked }
      : r
  );
  this.update(list);
}

  private load(): CartRow[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const parsed: CartRow[] = JSON.parse(localStorage.getItem(this.LS_KEY) || '[]');
    return Array.isArray(parsed)
  ? parsed.map(r => ({
      ...r,
      vatPercentage: Number.isFinite(r.vatPercentage) ? r.vatPercentage : 23,
      isGiftVoucher: !!r.isGiftVoucher,
      voucherType: (r as any).voucherType,
      voucherValue: (r as any).voucherValue ?? null,

      // ✅ nové
      isDigitalProduct: !!(r as any).isDigitalProduct,
      digitalSelected: !!(r as any).digitalSelected,       // user voľba
    }))
  : [];
  } catch {
    return [];
  }
}

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
