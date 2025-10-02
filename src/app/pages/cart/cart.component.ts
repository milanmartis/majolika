import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CartService, CartRow } from 'app/services/cart.service';
import { EventSessionsService } from 'app/services/event-sessions.service';
import { CartHoldTimerComponent } from './cart-hold-timer.component';
import { of, finalize, mapTo, Observable, take } from 'rxjs';
import { interval, Subscription } from 'rxjs';

import {
  trigger, transition, animate, style, keyframes, group
} from '@angular/animations';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, CartHoldTimerComponent],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css'],
  animations: [
    trigger('bounceOut', [
      transition(':leave', [
  
        /* Výška, margin, padding → 0  */
        group([
          /*  1) “bounce” transform + opacity  */
          animate('550ms cubic-bezier(.215,.61,.355,1)', keyframes([
            style({ transform: 'scale(1)', offset: 0 }),
            style({ transform: 'scale(.97) translateY(-2px)', offset: 0.3 }),
            style({ transform: 'scale(1.02) translateY(2px)',  offset: 0.55 }),
            style({ transform: 'scale(.3)', opacity: 0,        offset: 1 })
          ])),
  
          /*  2) zároveň plynulé zbalenie výšky a okrajov  */
          animate('550ms ease', style({ height: 0, margin: 0, padding: 0 }))
        ])
  
      ])
    ])
  ]
})
export class CartComponent {
  @Output() productClicked = new EventEmitter<void>();
  @Output() linkClicked = new EventEmitter<void>();     
  @Output() checkoutClicked = new EventEmitter<void>(); 
  onLinkClick() { this.linkClicked.emit(); }
  onCheckoutClick() { this.checkoutClicked.emit(); }
  
  disableAnim = false;
  private holdCleanupSub?: Subscription;

  readonly rows$!: Observable<CartRow[]>;
  readonly total$!: Observable<number>;

  /** ID produktov, ktoré sa majú zvýrazniť */
  highlightedIds = new Set<number>();

  /** ID produktov, ktoré boli v košíku naposledy */
  private prevIds = new Set<number>();

  constructor(
    private readonly cart: CartService,
    private eventSessionsService: EventSessionsService
  ) {
    this.holdCleanupSub = interval(5000).subscribe(() => {
      const now = Date.now();
      this.cart.items.forEach(r => {
        if (r.bookingId && r.holdExpires && r.holdExpires < now) {
          // PATCH na backend (cancelled) a odstránenie z košíka
          this.eventSessionsService.patchBooking(r.bookingId, { status: 'cancelled' }).subscribe({
            complete: () => this.cart.removeByBooking(r.bookingId!)
          });
        }
      });
    });

    this.rows$ = this.cart.cart$;
    this.total$ = this.cart.total$;
  
    // existujúci sledovač na zvýraznenie
    this.cart.cart$.subscribe(rows => {
      const currentIds = new Set(rows.map(r => r.id));
      rows.forEach(r => {
        if (!this.prevIds.has(r.id)) {
          this.highlightedIds.add(r.id);
        }
      });
      this.prevIds = currentIds;
    });
  
    // **TU**: cleanup expirovaných holdov raz pri inicializácii
    this.cart.cart$.pipe(take(1)).subscribe(rows => {
  rows.forEach(r => {
    if (r.bookingId && r.holdExpires && r.holdExpires < Date.now()) {
      this.eventSessionsService.patchBooking(r.bookingId, { status: 'cancelled' }).subscribe({
        complete: () => {
          this.cart.removeByBooking(r.bookingId!);
          if (r.session?.capacity?.available != null) {
            r.session.capacity.available = r.session.capacity.available + (r.qty || 1);
          }
          this.eventSessionsService.notifyBookingChanged();
        }
      });
    }
  });
});
    
  }

  resetHighlights() {
    // Po zatvorení košíka resetujeme zvýraznenie
    this.highlightedIds.clear();
  }

  isHighlighted(row: CartRow): boolean {
    return this.highlightedIds.has(row.id);
  }


  private updating = new Set<number>(); // per-row lock

  inc(row: CartRow) {
    if (this.updating.has(row.id)) return;

    const session = row.session;
    if (session?.capacity?.available != null && session.capacity.available <= 0) return;

    const newQty = row.qty + 1;

    this.updating.add(row.id);
    const prevAvailable = session?.capacity?.available ?? null;

    // optimistická zmena
    this.cart.updateQty(row.id, newQty, row.session?.id);
    if (prevAvailable != null) row.session!.capacity!.available = Math.max(0, prevAvailable - 1);

    let patch$: Observable<void>;
    if (row.bookingId) {
      patch$ = this.eventSessionsService
        .patchBooking(row.bookingId, { peopleCount: newQty })
        .pipe(mapTo(void 0)); // => Observable<void>
    } else {
      patch$ = of(void 0);     // => Observable<void>
    }

    patch$
      .pipe(finalize(() => this.updating.delete(row.id))) // vždy odomkni
      .subscribe({
        next: () => {
          // spusti len pri úspechu
          this.eventSessionsService.notifyBookingChanged();
        },
        error: (err: unknown) => {
          console.error(err);
          // revert UI
          this.cart.updateQty(row.id, newQty - 1, row.session?.id);
          if (prevAvailable != null) row.session!.capacity!.available = prevAvailable;
          // TODO: toast „Kapacita plná“
        }
      });
  }


  dec(row: CartRow) {
    if (row.qty <= 1) return;

    const newQty = row.qty - 1;
    this.cart.updateQty(row.id, newQty, row.session?.id);

    if (row.bookingId) {
      this.eventSessionsService
        .patchBooking(row.bookingId, { peopleCount: newQty })
        .subscribe({
          next: () => {
            this.eventSessionsService.notifyBookingChanged();
            // uvoľnili sme 1 miesto → vráť ho do available (lokálne v UI)
            if (row.session?.capacity?.available != null) {
              row.session.capacity.available = row.session.capacity.available + 1;
            }
          }
        });
    }
  }
  
remove(row: CartRow) {
  const releaseCapacity = () => {
    // navýš kapacitu lokálne (UI feedback okamžite)
    if (row.session?.capacity?.available != null) {
      row.session.capacity.available = row.session.capacity.available + (row.qty || 1);
    }
    // daj ostatným komponentom vedieť, nech si dotiahnu fresh dáta
    this.eventSessionsService.notifyBookingChanged();
  };

  if (row.bookingId) {
    this.eventSessionsService
      .patchBooking(row.bookingId, { status: 'cancelled' })
      .subscribe({
        next: () => {
          this.cart.removeByBooking(row.bookingId!);
          releaseCapacity();
        },
        error: () => {
          // aj pri chybe chceme košík vyčistiť a UI uvoľniť kapacitu
          this.cart.removeByBooking(row.bookingId!);
          releaseCapacity();
        }
      });
  } else {
    this.cart.remove(row.id, row.session?.id);
    releaseCapacity();
  }
}

  clear() {
    this.disableAnim = true;
    this.cart.clear();
    setTimeout(() => this.disableAnim = false);
  }
  onProductClick() { this.productClicked.emit(); }

  trackById = (_: number, row: CartRow) => row.id;

  ngOnDestroy() {
    this.holdCleanupSub?.unsubscribe();
  }
}
