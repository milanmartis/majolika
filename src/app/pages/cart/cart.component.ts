import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { CartService, CartRow } from 'app/services/cart.service';
import { EventSessionsService } from 'app/services/event-sessions.service';
import { CartHoldTimerComponent } from './cart-hold-timer.component';
import { take } from 'rxjs';
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
          // zrušíme backend pending a odstránime z košíka
          this.eventSessionsService.patchBooking(r.bookingId, { status: 'cancelled' }).subscribe({
            complete: () => this.cart.removeByBooking(r.bookingId!)
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

  inc(row: CartRow) {
    const session = row.session;
    if (session && session.capacity?.available != null) {
      if (session.capacity.available <= 0) {
        return; // nič voľné → stop
      }
    }

    const newQty = row.qty + 1;
    this.cart.updateQty(row.id, newQty, row.session?.id);

    if (row.bookingId) {
      this.eventSessionsService.patchBooking(row.bookingId, { peopleCount: newQty }).subscribe({
        next: () => {
          this.eventSessionsService.notifyBookingChanged();

          // (voliteľné, ale praktické) drž dostupné miesta v UI v synchronizácii:
          if (row.session?.capacity?.available != null) {
            row.session.capacity.available = Math.max(0, row.session.capacity.available - 1);
          }
        },
        error: (err) => {
          // TODO: ošetriť chybu (409 Conflict, capacity full...)
        }
      });
    }
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
    if (row.bookingId) {
      this.eventSessionsService.patchBooking(row.bookingId, { status: 'cancelled' }).subscribe({
        next: () => {
          this.cart.removeByBooking(row.bookingId!);
          this.eventSessionsService.notifyBookingChanged();
        }
      });
    } else {
      this.cart.remove(row.id, row.session?.id);
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
