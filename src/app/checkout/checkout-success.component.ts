// src/app/pages/checkout/checkout-success.component.ts
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { CartService } from 'app/services/cart.service';
import { FooterComponent } from 'app/components/footer/footer.component';
import { environment } from 'environments/environment';

type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

type OrderItem = {
  productId?: number;
  id?: number;
  name: string;
  slug?: string;
  variant?: string;
  qty: number;
  unitPrice: number;
  imageUrl?: string;
  isDigitalProduct?: boolean;
  isGiftVoucher?: boolean;
  isGiftWrapProduct?: boolean;
  event?: any;
};

type GiftWrapSummary = {
  enabled?: boolean;
  mode?: string;
  selectedQty?: number;
  note?: string | null;
  lines?: Array<{ productId: number; productName?: string; wrapQty: number }>;
} | null;

type OrderSummary = {
  id: number;
  number?: string | null;
  invoiceNumber?: string | null;

  email?: string | null;
  customerEmail?: string | null;

  total: number;
  totalWithShipping?: number;
  currency: string;
  status?: string;
  paymentStatus?: PaymentStatus | string;
  orderStatus?: string;
  createdAt?: string;

  deliveryMethod?: string;
  deliverySummary?: string;

  items: OrderItem[];
  giftWrap?: GiftWrapSummary;

  invoiceUrl?: string | null;
};

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FooterComponent],
  template: `
    <div class="checkout-result">
      <h1>{{ title }}</h1>

      <p *ngIf="loading" class="muted">
        {{ tr('CHECKOUT.SUCCESS.CHECKING', 'Overujeme stav platby...') }}
      </p>
      <p *ngIf="!loading">{{ body }}</p>

      <!-- Order summary -->
      <div *ngIf="order" class="order-card">
        <h2>{{ tr('CHECKOUT.SUCCESS.ORDER_SUMMARY', 'Sumár objednávky') }}</h2>

        <div class="order-meta">
          <div>
            <strong>{{ tr('ORDER.NO','Objednávka') }}:</strong>
            {{ orderDisplayNumber }}
          </div>

          <div *ngIf="order.createdAt">
            <strong>{{ tr('ORDER.DATE','Dátum') }}:</strong>
            {{ order.createdAt | date:'short' }}
          </div>

          <div *ngIf="orderEmail">
            <strong>{{ tr('ORDER.EMAIL','E-mail') }}:</strong>
            {{ orderEmail }}
          </div>
        </div>

        <div *ngIf="giftWrapInfo" class="giftwrap-box">
          <div class="gw-title">{{ tr('ORDER.GIFTWRAP','Darčekové balenie') }}</div>

          <div class="gw-row">
            <span>{{ tr('ORDER.GIFTWRAP_QTY','Počet balení') }}</span>
            <strong>{{ giftWrapInfo.qty }}</strong>
          </div>

          <div class="gw-row" *ngIf="giftWrapInfo.modeKey">
            <span>{{ tr('ORDER.GIFTWRAP_MODE','Ako zabaliť') }}</span>
            <strong>{{ tr(giftWrapInfo.modeKey, '') }}</strong>
          </div>

          <div class="gw-note" *ngIf="giftWrapInfo.note">
            <strong>{{ tr('ORDER.NOTE','Poznámka') }}:</strong>
            <div>{{ giftWrapInfo.note }}</div>
          </div>
        </div>

        <ul class="order-items" *ngIf="order.items?.length">
          <li *ngFor="let it of order.items">
            <img *ngIf="it.imageUrl" [src]="it.imageUrl" alt="" />
            <div class="txt">
              <div class="name">
                {{ it.name }}
                <span *ngIf="it.variant">— {{ it.variant }}</span>
              </div>

              <div class="badges">
                <span class="badge" *ngIf="it.isGiftWrapProduct">
                  {{ tr('ORDER.BADGE_GIFTWRAP','Darčekové balenie') }}
                </span>
                <span class="badge" *ngIf="it.isDigitalProduct || it.isGiftVoucher">
                  {{ tr('ORDER.BADGE_DIGITAL','Digitálny produkt') }}
                </span>
              </div>

              <div class="sub">
                {{ it.qty }} ×
                {{ it.unitPrice | currency:order.currency:'symbol-narrow' }}
              </div>
            </div>

            <div class="price">
              {{ (it.qty * it.unitPrice) | currency:order.currency:'symbol-narrow' }}
            </div>
          </li>
        </ul>

        <div class="total">
          <span>{{ tr('ORDER.TOTAL','Spolu na úhradu') }}</span>
          <strong>{{ orderTotal | currency:order.currency:'symbol-narrow' }}</strong>
        </div>

        <a *ngIf="order.invoiceUrl"
           [href]="order.invoiceUrl"
           target="_blank" rel="noopener"
           class="btn-secondary">
          {{ tr('ORDER.DOWNLOAD_INVOICE','Stiahnuť faktúru') }}
        </a>
      </div>

      <a routerLink="/" class="btn-back">{{ backLabel }}</a>
    </div>

    <app-footer class="mt-8"></app-footer>
  `,
  styles: [`
    .checkout-result {
      max-width: 720px;
      margin: 5rem auto;
      text-align: center;
      background: #fff;
      padding: 2rem;
      border-radius: var(--corners);
    }
    .checkout-result h1 {
      color: var(--base-blue);
      margin-bottom: 1rem;
    }
    .checkout-result p {
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }
    .checkout-result .muted { color: #666; }

    .order-card { text-align: left; margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem; }
    .order-card h2 { margin: .25rem 0 1rem; color: #111; }

    .order-meta {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: .5rem 1rem;
      margin-bottom: 1rem;
      font-size: .98rem;
    }

    .giftwrap-box {
      margin: 12px 0 10px;
      padding: 12px;
      border: 1px solid #eaeaea;
      border-radius: var(--corners);
      background: #fcfcfc;
    }
    .gw-title { font-weight: 700; color: var(--base-blue); margin-bottom: 6px; }
    .gw-row { display:flex; justify-content: space-between; padding: 2px 0; }
    .gw-note { margin-top: 8px; color:#333; font-size: .95rem; }
    .gw-note > div { color:#444; margin-top: 2px; white-space: pre-wrap; }

    .order-items { list-style: none; padding: 0; margin: 0; }
    .order-items li {
      display: grid;
      grid-template-columns: 56px 1fr auto;
      align-items: center;
      gap: .75rem;
      padding: .5rem 0;
      border-bottom: 1px solid #f3f3f3;
    }
    .order-items img {
      width: 56px;
      height: 56px;
      object-fit: cover;
      border-radius: .5rem;
      background: #fafafa;
    }
    .order-items .name { font-weight: 600; }
    .order-items .sub { color: #666; font-size: .95rem; }

    .badges { display:flex; gap: 6px; flex-wrap: wrap; margin: 2px 0 4px; }
    .badge {
      display:inline-block;
      font-size: 12px;
      border: 1px solid #d7d7d7;
      border-radius: 999px;
      padding: 2px 8px;
      color: #333;
      background: #fff;
    }

    .price { white-space: nowrap; }
    .total { display: flex; justify-content: space-between; align-items: center; padding-top: .75rem; font-size: 1.1rem; }

    .btn-secondary {
      display: inline-block;
      margin-top: .75rem;
      padding: .6rem 1rem;
      border: 1px solid var(--base-blue);
      color: var(--base-blue);
      border-radius: var(--corners);
      text-decoration: none;
    }
    .btn-secondary:hover { background: #f3f7ff; }

    .btn-back {
      display: inline-block;
      margin-top: 1.25rem;
      padding: 0.8rem 1.2rem;
      background: var(--base-blue);
      color: #fff;
      border-radius: var(--corners);
      text-decoration: none;
      font-weight: bold;
      transition: all 0.2s;
    }
    .btn-back:hover { background: #1f3796; }

    @media (max-width: 540px) {
      .order-meta { grid-template-columns: 1fr; }
      .order-items li { grid-template-columns: 48px 1fr auto; }
      .order-items img { width: 48px; height: 48px; }
    }
  `]
})
export class CheckoutSuccessComponent implements OnInit, OnDestroy {
  private cart = inject(CartService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private t = inject(TranslateService);

  // UI
  loading = true;
  title = '';
  body  = '';
  backLabel = '';

  // technický stav
  orderId: number | null = null;
  transId: string | null = null;
  isCardFlow = false; // pomocná — ale finálne sa rozhodujeme podľa paymentStatus
  paymentStatus: PaymentStatus | null = null;

  // public token (ot)
  publicToken: string | null = null;

  // order summary
  order?: OrderSummary;
  orderLoadError = false;

  // internal
  private pendingTimer: any = null;
  private destroyed = false;

  ngOnInit(): void {
    this.title = this.tr('CHECKOUT.SUCCESS.TITLE', 'Ďakujeme za objednávku');
    this.body = this.tr('CHECKOUT.SUCCESS.BODY', 'Vaša objednávka bola úspešne vytvorená.');
    this.backLabel = this.tr('CHECKOUT.SUCCESS.BACK', 'Späť na úvod');

    try { localStorage.removeItem('lastBookingTmpId'); } catch {}

    const qpOrder = this.route.snapshot.queryParamMap.get('order');
    const qpOt    = this.route.snapshot.queryParamMap.get('ot');
    const storedOrder = this.safeGetSS('lastOrderId');
    const storedTrans = this.safeGetSS('lastTransId');
    const storedOt    = this.safeGetSS('orderPublicToken');

    this.orderId = qpOrder ? Number(qpOrder) : (storedOrder ? Number(storedOrder) : null);
    this.transId = storedTrans || null;
    this.isCardFlow = !!this.transId; // zatiaľ len predpoklad

    // ot: query > sessionStorage
    const ot = (qpOt && String(qpOt).trim()) ? String(qpOt).trim() : (storedOt ? String(storedOt).trim() : '');
    this.publicToken = ot || null;
    if (this.publicToken) this.safeSetSS('orderPublicToken', this.publicToken);

    if (!this.orderId && !this.transId) {
      this.setOrderOnlyMessage(null);
      this.loading = false;
      return;
    }

    this.checkStatus();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
  }

  // ====== computed helpers ======
  get orderDisplayNumber(): string {
    if (!this.order) return this.orderId ? `#${this.orderId}` : '';
    const inv = String(this.order.invoiceNumber || '').trim();
    if (inv) return inv;
    const num = String(this.order.number || '').trim();
    if (num) return num;
    return this.order.id ? `#${this.order.id}` : (this.orderId ? `#${this.orderId}` : '');
  }

  get orderEmail(): string | null {
    if (!this.order) return null;
    return (this.order.email || this.order.customerEmail || null);
  }

  get orderTotal(): number {
    if (!this.order) return 0;
    const v = Number(this.order.totalWithShipping ?? this.order.total ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  get giftWrapInfo(): { qty: number; modeKey?: string; note?: string | null } | null {
    const gw = this.order?.giftWrap ?? null;
    if (!gw) return null;

    const qty = Number((gw as any).selectedQty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) return null;

    const mode = String((gw as any).mode || '');
    const modeKey =
      mode === 'each_item' ? 'ORDER.GIFTWRAP_MODE_EACH_ITEM' :
      mode === 'by_product' ? 'ORDER.GIFTWRAP_MODE_BY_PRODUCT' :
      mode === 'all_together' ? 'ORDER.GIFTWRAP_MODE_ALL_TOGETHER' :
      mode === 'all' ? 'ORDER.GIFTWRAP_MODE_ALL' :
      mode === 'selected' ? 'ORDER.GIFTWRAP_MODE_SELECTED' :
      undefined;

    const note = typeof (gw as any).note === 'string' ? (gw as any).note : null;
    return { qty, modeKey, note };
  }

  // ====== Status flow ======
  private checkStatus(): void {
    const payload: any = {};
    if (this.transId) payload.transId = this.transId;
    if (this.orderId) payload.orderId = this.orderId;

    this.http.post<any>(`${environment.apiUrl}/payments/status`, payload).subscribe({
      next: (res) => {
        const status = (res?.paymentStatus || 'unpaid') as PaymentStatus;
        this.paymentStatus = status;

        // ✅ rozhoduj podľa statusu (nie podľa transId)
        this.isCardFlow = (status === 'paid' || status === 'refunded') || !!this.transId;

        if (res?.order) {
          this.order = this.mapOrder(res.order);
          if (!this.orderId && this.order?.id) this.orderId = Number(this.order.id);
        }

        const orderStatus = String(res?.orderStatus || '').toLowerCase();
        if (orderStatus === 'cancelled' && this.orderId) {
          this.safeRemoveSS('lastTransId');
          this.loading = false;
          this.router.navigate(['/checkout/cancelled'], { queryParams: { order: this.orderId }, replaceUrl: true });
          return;
        }

        // ✅ NON-CARD / alebo card bez transId: ak je už PAID -> ukáž paid
        if (!this.isCardFlow) {
          this.cart.clear();
          try { localStorage.removeItem('lastBookingTmpId'); } catch {}

          if (status === 'paid') this.setPaidCardMessage(this.orderDisplayNumber);
          else if (status === 'refunded') this.setRefundedMessage(this.orderDisplayNumber);
          else this.setOrderOnlyMessage(this.orderDisplayNumber);

          this.safeRemoveSS('lastTransId');

          if (this.orderId && !this.order) this.loadOrder();
          this.loading = false;
          return;
        }

        // CARD
        if (status === 'paid') {
          this.cart.clear();
          try { localStorage.removeItem('lastBookingTmpId'); } catch {}
          this.setPaidCardMessage(this.orderDisplayNumber);
        } else if (status === 'refunded') {
          this.setRefundedMessage(this.orderDisplayNumber);
        } else {
          this.setCardPendingMessage(this.orderDisplayNumber);
          this.schedulePendingRetry();
        }

        if (this.orderId && !this.order) this.loadOrder();

        this.safeRemoveSS('lastTransId');
        this.loading = false;
      },
      error: () => {
        // keď padne status endpoint, aspoň načítaj order cez public token (ak je)
        if (this.isCardFlow) this.setCardPendingMessage(this.orderId ? `#${this.orderId}` : null);
        else this.setOrderOnlyMessage(this.orderId ? `#${this.orderId}` : null);

        if (this.orderId && !this.order) this.loadOrder();

        this.loading = false;
        this.schedulePendingRetry();
      }
    });
  }

  private schedulePendingRetry() {
    if (this.destroyed) return;
    if (this.paymentStatus !== 'paid' && this.isCardFlow) {
      if (this.pendingTimer) clearTimeout(this.pendingTimer);
      this.pendingTimer = setTimeout(() => this.checkStatus(), 3500);
    }
  }

  // ====== Order GET (PUBLIC) ======
  private loadOrder(): void {
    if (!this.orderId) return;

    const qpOt = this.route.snapshot.queryParamMap.get('ot');
    const ssOt = this.safeGetSS('orderPublicToken');
    const ot =
      (qpOt && qpOt.trim()) ? qpOt.trim()
      : (ssOt && ssOt.trim()) ? ssOt.trim()
      : (this.publicToken || '');

    if (!ot) {
      this.orderLoadError = true;
      return;
    }

    this.publicToken = ot;
    this.safeSetSS('orderPublicToken', ot);

    const url = `${environment.apiUrl}/orders/${this.orderId}/public?ot=${encodeURIComponent(ot)}`;

    this.http.get<any>(url).subscribe({
      next: (raw) => {
        this.order = this.mapOrder(raw);

        // ✅ po načítaní orderu uprav message podľa paymentStatus z orderu (ak existuje)
        const ps = String(this.order?.paymentStatus || this.paymentStatus || '').toLowerCase();
        if (ps === 'paid') this.setPaidCardMessage(this.orderDisplayNumber);
        else if (ps === 'refunded') this.setRefundedMessage(this.orderDisplayNumber);
        else this.setOrderOnlyMessage(this.orderDisplayNumber);

        try { sessionStorage.removeItem('lastOrderId'); } catch {}
      },
      error: () => {
        this.orderLoadError = true;
      }
    });
  }

  // ====== Map / normalize order from any backend shape ======
  private mapOrder(raw: any): OrderSummary {
    const base = raw?.data?.attributes ? { id: raw.data.id, ...raw.data.attributes } : raw;
    const id = Number(base?.id || 0);

    const currency = String(base?.currency || 'EUR');
    const total = Number(base?.total ?? 0);
    const totalWithShipping = base?.totalWithShipping != null ? Number(base.totalWithShipping) : undefined;

    const invoiceNumber = (base?.invoiceNumber ?? null) as string | null;
    const number = (base?.number ?? null) as string | null;

    const createdAt = base?.createdAt ? String(base.createdAt) : undefined;

    const email = (base?.email ?? base?.customerEmail ?? null) as string | null;
    const giftWrap = (base?.giftWrap ?? null) as GiftWrapSummary;

    const itemsRaw = Array.isArray(base?.items) ? base.items : [];
    const items: OrderItem[] = itemsRaw.map((it: any) => ({
      productId: it?.productId ?? undefined,
      id: it?.id ?? undefined,
      name: String(it?.name ?? it?.productName ?? `Produkt #${it?.productId ?? ''}`),
      slug: it?.slug ? String(it.slug) : undefined,
      variant: it?.variant ? String(it.variant) : undefined,
      qty: Number(it?.qty ?? it?.quantity ?? 1),
      unitPrice: Number(it?.unitPrice ?? 0),
      imageUrl: it?.imageUrl ? String(it.imageUrl) : undefined,
      isDigitalProduct: !!(it?.isDigitalProduct),
      isGiftVoucher: !!(it?.isGiftVoucher),
      isGiftWrapProduct: !!(it?.isGiftWrapProduct),
      event: it?.event ?? null,
    }));

    return {
      id,
      number,
      invoiceNumber,
      email,
      customerEmail: email,
      total,
      totalWithShipping,
      currency,
      paymentStatus: base?.paymentStatus ?? undefined,
      orderStatus: base?.orderStatus ?? undefined,
      createdAt,
      deliveryMethod: base?.deliveryMethod ?? undefined,
      deliverySummary: base?.deliverySummary ?? undefined,
      items,
      giftWrap,
      invoiceUrl: base?.invoiceUrl ?? null,
    };
  }

  // ====== Text helper ======
  tr(key: string, fallback: string, params?: any): string {
    const v = this.t.instant(key, params);
    return v && v !== key ? v : fallback;
  }

  // ====== Messages ======
  private setPaidCardMessage(orderNo: string | null) {
    this.title = this.tr('CHECKOUT.SUCCESS.PAID_TITLE', 'Ďakujeme, platba prijatá');
    const o = orderNo ? ` ${orderNo}` : '';
    this.body = this.tr(
      'CHECKOUT.SUCCESS.PAID_BODY',
      `Platba za vašu objednávku${o} prebehla úspešne. Potvrdenie a detaily sme poslali na e-mail.`
    );
  }

  private setCardPendingMessage(orderNo: string | null) {
    this.title = this.tr('CHECKOUT.SUCCESS.PENDING_TITLE', 'Platba prebieha');
    const o = orderNo ? ` ${orderNo}` : '';
    this.body = this.tr(
      'CHECKOUT.SUCCESS.PENDING_BODY',
      `Platba za objednávku${o} ešte nie je potvrdená. Skúšame overiť stav automaticky. Ak sa stránka sama neobnoví, skontrolujte prosím e-mail.`
    );
  }

  private setRefundedMessage(orderNo: string | null) {
    this.title = this.tr('CHECKOUT.SUCCESS.REFUNDED_TITLE', 'Platba bola vrátená');
    const o = orderNo ? ` ${orderNo}` : '';
    this.body = this.tr(
      'CHECKOUT.SUCCESS.REFUNDED_BODY',
      `Platba za objednávku${o} bola vrátená. Viac informácií sme poslali na e-mail.`
    );
  }

  private setOrderOnlyMessage(orderNo: string | null) {
    this.title = this.tr('CHECKOUT.SUCCESS.ORDER_OK_TITLE', 'Objednávka bola prijatá');
    const no = orderNo || (this.orderId ? `#${this.orderId}` : '');
    this.body = this.tr(
      'CHECKOUT.SUCCESS.ORDER_OK_BODY',
      `Vaša objednávka ${no} bola prijatá. Potvrdenie a ďalšie informácie sme poslali na e-mail.`,
      { orderNo: no }
    );
  }

  // ====== sessionStorage helpers ======
  private safeGetSS(key: string): string | null {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  private safeSetSS(key: string, value: string) {
    try { sessionStorage.setItem(key, value); } catch {}
  }
  private safeRemoveSS(key: string) {
    try { sessionStorage.removeItem(key); } catch {}
  }
}