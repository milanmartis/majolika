import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { CartService, CartRow } from 'app/services/cart.service';
import {
  trigger, transition, animate, style, keyframes, group
} from '@angular/animations';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
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

  readonly rows$!: Observable<CartRow[]>;
  readonly total$!: Observable<number>;

  /** ID produktov, ktoré sa majú zvýrazniť */
  highlightedIds = new Set<number>();

  /** ID produktov, ktoré boli v košíku naposledy */
  private prevIds = new Set<number>();

  constructor(private readonly cart: CartService) {
    this.rows$ = this.cart.cart$;
    this.total$ = this.cart.total$;

    // Sledujeme zmeny v košíku
    this.cart.cart$.subscribe(rows => {
      const currentIds = new Set(rows.map(r => r.id));

      // nájdeme len tie, ktoré predtým neboli → nové položky
      rows.forEach(r => {
        if (!this.prevIds.has(r.id)) {
          this.highlightedIds.add(r.id); // zvýrazníme len nové
        }
      });

      // zapamätáme si aktuálne ID ako "predošlé"
      this.prevIds = currentIds;
    });
  }

  resetHighlights() {
    // Po zatvorení košíka resetujeme zvýraznenie
    this.highlightedIds.clear();
  }

  isHighlighted(row: CartRow): boolean {
    return this.highlightedIds.has(row.id);
  }

  inc(row: CartRow) { this.cart.updateQty(row.id, row.qty + 1); }
  dec(row: CartRow) { if (row.qty > 1) this.cart.updateQty(row.id, row.qty - 1); }
  remove(row: CartRow) { this.cart.remove(row.id); }
  clear() {
    this.disableAnim = true;
    this.cart.clear();
    setTimeout(() => this.disableAnim = false);
  }
  onProductClick() { this.productClicked.emit(); }

  trackById = (_: number, row: CartRow) => row.id;
}
