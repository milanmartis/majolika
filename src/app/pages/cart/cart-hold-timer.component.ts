// cart-hold-timer.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CartService } from 'app/services/cart.service';
import { interval, Subscription } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-cart-hold-timer',
  imports: [CommonModule,DecimalPipe],
  template: `
    <div *ngIf="countdown > 0" class="hold-banner">
      Rezervácia: zostáva <b>{{ min }}:{{ sec | number:'2.0' }}</b> min.
    </div>
  `,
  styles: [`
    .hold-banner {
      width: 100%; background:#e8f0f9; color: #222; padding: 10px 0;
      text-align: center; font-size: 1.2rem; font-weight: 600;
      border-bottom: 2px solid var(--base-blue);
      z-index:1000; position:sticky; top:0;
    }
  `]
})
export class CartHoldTimerComponent implements OnInit, OnDestroy {
  countdown: number = 0; // v sekundách
  timerSub?: Subscription;

  get min() { return Math.floor(this.countdown / 60); }
  get sec() { return this.countdown % 60; }

  constructor(private cart: CartService) {}

  ngOnInit() {
    this.timerSub = interval(1000).subscribe(() => {
      const now = Date.now();
      // nájdi najskorší holdExpires v cart items
      const soonest = this.cart.items
        .map(r => r.holdExpires || 0)
        .filter(t => t > now);
      if (!soonest.length) {
        this.countdown = 0;
        return;
      }
      const minTime = Math.min(...soonest);
      this.countdown = Math.max(0, Math.floor((minTime - now) / 1000));
    });
  }

  ngOnDestroy() {
    this.timerSub?.unsubscribe();
  }
}
