// src/app/pages/checkout/checkout-cancel.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';

type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

@Component({
  selector: 'app-checkout-cancel',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <div class="checkout-result">
      <h1>{{ 'CHECKOUT_CANCEL.TITLE' | translate }}</h1>

      <p class="lead">{{ 'CHECKOUT_CANCEL.DESCRIPTION' | translate }}</p>

      <p *ngIf="orderId" class="muted">
        {{ 'CHECKOUT_CANCEL.ORDER' | translate:{ id: orderId } }}
      </p>

      <div class="actions">
        <a routerLink="/checkout" class="btn-back">
          {{ 'CHECKOUT_CANCEL.BACK_TO_CHECKOUT' | translate }}
        </a>
        <a routerLink="/eshop" class="btn-alt">
          {{ 'CHECKOUT_CANCEL.CONTINUE_SHOPPING' | translate }}
        </a>
      </div>
    </div>
  `,
  styles: [`
    .checkout-result {
      max-width: 640px;
      margin: 5rem auto;
      text-align: center;
      background: #fff;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .checkout-result h1 { color: #c0392b; margin-bottom: 0.75rem; }
    .checkout-result .lead { font-size: 1.1rem; margin-bottom: 1rem; }
    .checkout-result .muted { color: #777; margin-bottom: 2rem; }
    .actions { display: flex; justify-content: center; gap: 1rem; }
    .btn-back, .btn-alt {
      padding: 0.8rem 1.2rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      transition: all .2s;
    }
    .btn-back { background: var(--base-blue); color: #fff; }
    .btn-back:hover { background: #1f3796; }
    .btn-alt { background: #eee; color: #333; }
    .btn-alt:hover { background: #ddd; }
  `]
})
export class CheckoutCancelComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private t = inject(TranslateService);

  orderId: number | null = null;

  ngOnInit(): void {
    const qpOrder = this.route.snapshot.queryParamMap.get('order');
    this.orderId = qpOrder ? Number(qpOrder) : null;

    // Pre istotu over stav – ak je už PAID (oneskorený redirect), pošli na success.
    const payload: any = {};
    if (this.orderId) payload.orderId = this.orderId;

    if (!payload.orderId) return;

    this.http.post<any>(`${environment.apiUrl}/payments/status`, payload)
      .subscribe({
        next: (res) => {
          const status = (res?.paymentStatus || 'unpaid') as PaymentStatus;
          if (status === 'paid') {
            this.router.navigate(['/checkout/success'], {
              queryParams: { order: this.orderId },
              replaceUrl: true
            });
          }
        },
        error: () => { /* ignoruj chybu – zostaneme na cancel obrazovke */ }
      });
  }
}