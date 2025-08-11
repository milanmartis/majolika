import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CartService } from 'app/services/cart.service';

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [RouterModule],  // aby fungoval routerLink
  template: `
    <div class="checkout-result">
      <h1>Ďakujeme za objednávku! 🎉</h1>
      <p>Vaša platba prebehla úspešne. Potvrdenie vám príde emailom.</p>
      <a routerLink="/" class="btn-back">Späť na úvod</a>
    </div>
  `,
  styles: [`
    .checkout-result {
      max-width: 600px;
      margin: 5rem auto;
      text-align: center;
      background: #fff;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
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
      border-radius: 6px;
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
