import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CartService } from 'app/services/cart.service';
import { FooterComponent } from 'app/components/footer/footer.component';

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [RouterModule, TranslateModule, FooterComponent],
  template: `
    <div class="checkout-result">
      <h1>{{ 'CHECKOUT.SUCCESS.TITLE' | translate }}</h1>
      <p>{{ 'CHECKOUT.SUCCESS.BODY' | translate }}</p>
      <a routerLink="/" class="btn-back">{{ 'CHECKOUT.SUCCESS.BACK' | translate }}</a>
    </div>
    <app-footer class="mt-8"></app-footer>

  `,
  styles: [`
    .checkout-result {
      max-width: 500px;
      margin: 5rem auto;
      text-align: center;
      background: #fff;
      padding: 2rem;
      border-radius: var(--corners);
      // box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .checkout-result h1 {
      color: var(--base-blue);
      margin-bottom: 1rem;
    }
    .checkout-result p {
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }
    .btn-back {
      display: inline-block;
      padding: 0.8rem 1.2rem;
      background: var(--base-blue);
      color: #fff;
      border-radius: var(--corners);
      text-decoration: none;
      font-weight: bold;
      transition: all 0.2s;
    }
    .btn-back:hover {
      background: #1f3796;
    }
  `]
})
export class CheckoutSuccessComponent {

  private cart = inject(CartService);

  ngOnInit(): void {
    this.cart.clear(); // 🧹 vymaže košík po návrate z platby
    localStorage.removeItem('lastBookingTmpId');
  }
}
