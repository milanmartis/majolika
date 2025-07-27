import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-checkout-cancel',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="checkout-result">
      <h1>Platba bola zrušená ❌</h1>
      <p>Môžete skúsiť znova alebo sa vrátiť do košíka.</p>
      <div class="actions">
        <a routerLink="/checkout" class="btn-back">Späť na pokladňu</a>
        <a routerLink="/eshop" class="btn-alt">Pokračovať v nákupe</a>
      </div>
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
      color: #c0392b;
      margin-bottom: 1rem;
    }
    .checkout-result p {
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }
    .btn-back {
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
    .btn-alt {
      padding: 0.8rem 1.2rem;
      background: #eee;
      color: #333;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
      transition: all 0.2s;
    }
    .btn-alt:hover {
      background: #ddd;
    }
  `]
})
export class CheckoutCancelComponent {}
