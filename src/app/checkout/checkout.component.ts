// checkout.component.ts
import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, AbstractControl } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router, UrlTree } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { filter, take, pairwise, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { GoogleLoginPromptComponent } from 'app/components/google-login-prompt/google-login-prompt.component';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CartService, CartRow } from 'app/services/cart.service';
import { AuthService, User } from 'app/services/auth.service';
import { FooterComponent } from 'app/components/footer/footer.component';
import { UserFormComponent } from 'app/components/user-form/user-form.component';
import { environment } from 'environments/environment';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { trigger, transition, style, animate } from '@angular/animations';

type PaymentMethod = 'card' | 'cod' | 'bank' | 'onsite' | 'post';
type DeliveryMethod = 'pickup' | 'post_office' | 'packeta_box' | 'post_courier' | 'digital_product';
type DeliveryUrgency = 'standard' | 'rush';

type GiftWrapMode = 'each_item' | 'by_product' | 'all_together';
type CountryCode = 'SK' | 'CZ' | 'WORLD';
type GiftWrapItem = {
  key: string;              // productId:sessionId
  productId: number;
  sessionId?: number | null;
  cartQty: number;
  wrapQty: number;          // 0..cartQty
};


type CheckoutPayloadItem = {
  productId: number;
  productName: string;
  slug?: string;
  type?: 'product' | 'gift_voucher' | 'event' | 'service';
  quantity: number;

  vatPercentage: number;
  unitPrice: number;
  unitNet: number;
  unitTax: number;
  unitGross: number;
  sumNet: number;
  sumTax: number;
  sumGross: number;

  isDigitalProduct: boolean;
  isGiftVoucher: boolean;
  voucherType?: 'value' | 'service';
  voucherValue?: number | null;

  // voliteľné – len ak je event
  event?: {
    sessionId: number;
    type: 'tour' | 'workshop';
    startDateTime: string | null;
    peopleCount: number;
    bookingId: number | null;
  };

  // ✅ toto je nové – iba pre giftwrap product item
  isGiftWrapProduct?: boolean;
};

type SlpostaPickupPoint = {
  id: string;
  kind?: 'office' | 'bbox' | 'point';
  label?: string;
  deliveryAddress?: { street?: string; city?: string; zip?: string };
};

declare global {
  interface Window {
    slposta?: any;
  }
}

const NEWSLETTER_ENDPOINT = `${environment.apiUrl}/newsletter/subscribe`;

const SHIPPING_FEE: Record<DeliveryMethod, number> = {
  pickup: 0,
  post_office: 5.0,
  packeta_box: 5.0,
  post_courier: 7.0,
  digital_product: 0.0
};

const PAYMENT_FEE: Record<PaymentMethod, number> = {
  card: 0,
  bank: 0,
  post: 1.5,
  onsite: 0,
  cod: 1.5,
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    MatChipsModule,
    FooterComponent,
    UserFormComponent,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    GoogleLoginPromptComponent,
    MatRadioModule,
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
  styles: [`
    .checkout-form {
      background: #fff;
      padding: 2rem;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .checkout-form h3 {
      margin-top: 2rem;
      margin-bottom: 1rem;
      font-size: 1.4rem;
      font-weight: 600;
      color: #333;
    }

    .form-row {
      display: flex;
      flex-direction: column;
      margin-bottom: 1rem;
    }

    .form-row label {
      font-weight: 600;
      margin-bottom: 1.4rem;
      color: #444;
    }

    .form-row input {
      padding: 0.8rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .form-row input:focus {
      border-color: var(--base-blue);
      box-shadow: 0 0 0 3px rgba(41, 68, 186, 0.15);
      outline: none;
    }

    .address-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem 1.5rem;
    }

    .address-grid .full-width {
      grid-column: span 2;
    }

    @media (max-width: 768px) {
      .address-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
  animations: [
    trigger('cartItemAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(5px)' }),
        animate('150ms ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ]),
      transition(':leave', [
        animate('180ms ease-in',
          style({ opacity: 0, transform: 'translateY(-4px)' })
        )
      ])
    ])
  ]
})
export class CheckoutComponent implements OnInit, OnDestroy {

  // ======================
  // 🎁 DARČEKOVÉ BALENIE (produkt zo shopu)
  // ======================
  readonly GIFT_WRAP_SLUG = 'darcekove-balenie';

  // načítaný produkt (id + fields)
  giftWrapProduct: any | null = null;

  // cena a DPH načítané z produktu
  giftWrapUnitPrice = signal<number>(0);
  giftWrapVatPct = signal<number>(0);

  // stav v UI (koľko kusov zabaliť na riadok)
  private giftWrapMap = new Map<string, GiftWrapItem>();

  giftWrapTotalQty = signal<number>(0);
  giftWrapFee = signal<number>(0);

  voucherMessage = '';
  voucherMessageType: 'success' | 'error' | 'info' | '' = '';

  appliedGiftVoucher: {
    code: string;
    voucherType: 'value' | 'service';
    remainingValue: number;
    discount: number;
    newRemainingValue: number;
  } | null = null;

  giftVoucherApplying = false;

  private rowKey(row: CartRow): string {
    const sid = row.session?.id ?? '0';
    return `${row.id}:${sid}`;
  }
private clearGiftWrap(row: CartRow) {
  const key = this.rowKey(row);
  const it = this.giftWrapMap.get(key);
  if (it) {
    it.wrapQty = 0;
    it.cartQty = row.qty;
    this.giftWrapMap.set(key, it);
    this.recomputeGiftWrapTotals();
  }
}

digitalDisabled(row: CartRow): boolean {
  // digitál vypni, ak je na riadku zvolené darčekové balenie
  return this.giftWrapQty(row) > 0;
}

giftWrapDisabled(row: CartRow): boolean {
  // darčekové balenie vypni, ak je na riadku zvolený digitál
  return row.digitalSelected === true;
}
  qtyRange(max: number): number[] {
    const m = Math.max(1, max || 1);
    return Array.from({ length: m }, (_, i) => i + 1);
  }

  private async loadGiftWrapProduct() {
    // Skúsi viac možností endpointov – aby to fungovalo aj pri custom BE.
    const slug = this.GIFT_WRAP_SLUG;

    // 1) custom: /products/by-slug/:slug
    const tryUrls = [
    //  `${environment.apiUrl}/products/by-slug/${encodeURIComponent(slug)}`,
      // 2) strapi v4/v5 style query (ak máš priamo proxy na /products)
      `${environment.apiUrl}/products?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`,
      // 3) strapi /api/products...
      `${environment.apiUrl}/api/products?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`,
    ];

    for (const url of tryUrls) {
      try {
        const res: any = await firstValueFrom(this.http.get<any>(url));

        // normalize: custom endpoint môže vrátiť priamo product alebo {data}
        const candidate =
          res?.data?.[0] ?? res?.data ?? res?.[0] ?? res ?? null;

        if (!candidate) continue;

        // strapi entity: {id, attributes}
        const id = candidate?.id ?? candidate?.data?.id ?? null;
        const at = candidate?.attributes ?? candidate;

        if (!id || !at) continue;

        this.giftWrapProduct = { id, ...at };

        const unit = (at.inSale && typeof at.price_sale === 'number')
          ? at.price_sale
          : at.price;

        this.giftWrapUnitPrice.set(typeof unit === 'number' ? unit : 0);

        const vatPct = typeof at.vatPercentage === 'number'
          ? at.vatPercentage
          : (typeof at.vatPercentage === 'string' ? parseFloat(at.vatPercentage) : 0);

        this.giftWrapVatPct.set(isNaN(vatPct) ? 0 : vatPct);

        this.recomputeGiftWrapTotals();
        return;
      } catch {
        // ignore and continue
      }
    }

    console.warn('Gift wrap product not found by slug:', slug);
  }

  private getManualGiftWrapQty(items: CartRow[]): number {
    const gwId = this.giftWrapProduct?.id;
    if (!gwId) return 0;
    const row = items.find(i => i.id === gwId && !i.session);
    return row?.qty ?? 0;
  }

isWrappable(row: CartRow): boolean {
  if (row.isGiftVoucher) return false;

  // ✅ už neblokuj event:
  // const isEvent = ...
  // if (isEvent) return false;

  if (this.giftWrapProduct?.id && row.id === this.giftWrapProduct.id) return false;
  return true;
}

  giftWrapQty(row: CartRow): number {
    return this.giftWrapMap.get(this.rowKey(row))?.wrapQty ?? 0;
  }

 toggleRowDigital(row: CartRow, checked: boolean) {
    // ak user zapína digitál, zruš darčekové balenie na tom riadku
    if (checked) {
      this.clearGiftWrap(row);
    }

    this.cart.toggleDigital(row.id, checked, row.session?.id);
  }

  toggleGiftWrap(row: CartRow, checked: boolean) {
    if (!this.isWrappable(row)) return;
    if (checked && row.digitalSelected === true) {
      this.cart.toggleDigital(row.id, false, row.session?.id);
    }

    const key = this.rowKey(row);
    const current = this.giftWrapMap.get(key);

    if (!checked) {
      if (current) {
        current.wrapQty = 0;
        current.cartQty = row.qty;
        this.giftWrapMap.set(key, current);
      }
    } else {
      const item: GiftWrapItem = current ?? {
        key,
        productId: row.id,
        sessionId: row.session?.id ?? null,
        cartQty: row.qty,
        wrapQty: 1,
      };
      item.cartQty = row.qty;
      item.wrapQty = Math.min(Math.max(1, item.wrapQty), row.qty);
      this.giftWrapMap.set(key, item);
    }

    this.recomputeGiftWrapTotals();
  }

  setGiftWrapQty(row: CartRow, qty: number) {
    if (!this.isWrappable(row)) return;

    const key = this.rowKey(row);
    const q = Math.max(0, Math.min(row.qty, Number(qty || 0)));

    const item: GiftWrapItem = this.giftWrapMap.get(key) ?? {
      key,
      productId: row.id,
      sessionId: row.session?.id ?? null,
      cartQty: row.qty,
      wrapQty: 0,
    };

    item.cartQty = row.qty;
    item.wrapQty = q;

    this.giftWrapMap.set(key, item);
    this.recomputeGiftWrapTotals();
  }

  private rebuildGiftWrapFromCart(items: CartRow[]) {
    const keysInCart = new Set(items.map(i => this.rowKey(i)));

    for (const k of Array.from(this.giftWrapMap.keys())) {
      if (!keysInCart.has(k)) this.giftWrapMap.delete(k);
    }

    for (const row of items) {
      const key = this.rowKey(row);
      const it = this.giftWrapMap.get(key);
      if (!it) continue;

      it.cartQty = row.qty;
      it.wrapQty = Math.min(it.wrapQty, row.qty);

      if (!this.isWrappable(row)) it.wrapQty = 0;

      this.giftWrapMap.set(key, it);
    }

    this.recomputeGiftWrapTotals();
  }

  private recomputeGiftWrapTotals() {
    let qty = 0;
    for (const it of this.giftWrapMap.values()) qty += (it.wrapQty || 0);

    const unit = this.giftWrapUnitPrice();
    const fee = Math.round((qty * unit + Number.EPSILON) * 100) / 100;

    this.giftWrapTotalQty.set(qty);
    this.giftWrapFee.set(fee);
  }

  // ======================
  // OSTATNÉ – tvoj pôvodný kód
  // ======================

  get isFreeShipping(): boolean {
    return this.orderTotal() >= 100;
  }

  private destroy$ = new Subject<void>();
  hasGiftVoucherProduct = false;
  onlyGiftVouchersInCart = false;

  @ViewChild('submitBtn') submitBtnRef!: ElementRef<HTMLButtonElement>;
  submitBtnWidth = 0;

  cartItems$: Observable<CartRow[]>;
  total$: Observable<number>;
  isSubmitting = false;
  vatTotal = signal<number>(0);

  private _userId: number | null = null;
  get userId(): number | null { return this._userId; }

  readonly COUNTRIES = [
    'Slovensko',
    'Česká republika',
    'Zvyšok sveta (prosím, kontaktujte nás)',
  ] as const;

  vatSummary: {
    lines: Array<{
      productId: number; name: string; qty: number; rate: number;
      unitNet: number; unitTax: number; unitGross: number;
      sumNet: number; sumTax: number; sumGross: number;
    }>;
    byRate: Array<{ rate: number; base: number; tax: number; gross: number }>;
    totals: { net: number; tax: number; gross: number };
  } = { lines: [], byRate: [], totals: { net: 0, tax: 0, gross: 0 } };

  private round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  private normalizeVat(v: unknown): number {
    const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : 0);
    return isNaN(n) ? 0 : n;
  }

  private recomputeVat(items: CartRow[]) {
    console.log('VAT DEBUG', items.map(i => ({
      name: i.name,
      grossUsed: (i.inSale && typeof i.price_sale === 'number') ? i.price_sale : i.price,
      vatPercentage: i.vatPercentage,
    })));

    const lines = (items || []).map(i => {
      const ratePct = this.normalizeVat(i.vatPercentage);
      const rate = ratePct / 100;

      const unitGross =
        (i.inSale && typeof i.price_sale === 'number') ? i.price_sale : i.price;

      const unitNet = rate > 0 ? unitGross / (1 + rate) : unitGross;
      const unitTax = unitGross - unitNet;

      const sumNet   = unitNet * i.qty;
      const sumTax   = unitTax * i.qty;
      const sumGross = unitGross * i.qty;

      return {
        productId: i.id,
        name: i.name,
        qty: i.qty,
        rate: ratePct,
        unitNet:   this.round2(unitNet),
        unitTax:   this.round2(unitTax),
        unitGross: this.round2(unitGross),
        sumNet:    this.round2(sumNet),
        sumTax:    this.round2(sumTax),
        sumGross:  this.round2(sumGross),
      };
    });

    const byRateMap = new Map<number, { base: number; tax: number; gross: number }>();
    for (const l of lines) {
      const acc = byRateMap.get(l.rate) ?? { base: 0, tax: 0, gross: 0 };
      acc.base  += l.sumNet;
      acc.tax   += l.sumTax;
      acc.gross += l.sumGross;
      byRateMap.set(l.rate, acc);
    }

    const byRate = [...byRateMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, v]) => ({
        rate,
        base:  this.round2(v.base),
        tax:   this.round2(v.tax),
        gross: this.round2(v.gross),
      }));

    const totals = lines.reduce((a, l) => {
      a.net  += l.sumNet;
      a.tax  += l.sumTax;
      a.gross+= l.sumGross;
      return a;
    }, { net: 0, tax: 0, gross: 0 });

    const fixedTotals = {
      net: this.round2(totals.net),
      tax: this.round2(totals.tax),
      gross: this.round2(totals.gross),
    };

    this.vatSummary = { lines, byRate, totals: fixedTotals };
    this.vatTotal.set(fixedTotals.tax);
  }

  private temporaryId =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('lastBookingTmpId') || null
      : null;
  checkoutForm!: FormGroup;

  selectedDeliveryMethod = signal<DeliveryMethod>('pickup');
  selectedPaymentMethod = signal<PaymentMethod>('card');

  orderTotal = signal<number>(0);
 

  countrySignal = signal<CountryCode>('SK');

  canUseSkPickupServices(): boolean {
    return this.countrySignal() === 'SK';
  }

  shippingFee = computed(() => {
    const method = this.selectedDeliveryMethod();
    const total = this.orderTotal();
    const country = this.countrySignal();

    if (method === 'pickup' || method === 'digital_product') {
      return 0;
    }

    if (total >= 100) {
      return 0;
    }

    if (country === 'SK') {
      if (method === 'post_office' || method === 'packeta_box') return 5;
      if (method === 'post_courier') return 7;
      return 0;
    }

    if (country === 'CZ') {
      if (method === 'post_courier') return 15;
      return 0;
    }

    return 0;

  });

  paymentFee  = computed(() => PAYMENT_FEE[this.selectedPaymentMethod()]);

  readonly BANK_INFO = {
    accountName: 'Majolika eShop',
    iban: 'SK97 0900 0000 0051 3558 7112 (Slovenská sporiteľňa)',
    iban2: 'SK17 0200 0000 0000 0241 9112 (VUB banka)',
    note: 'Prosím uveďte svoje meno do správy pre príjemcu.'
  };

  private packetaReady?: Promise<void>;
  private slpostaReady?: Promise<void>;

  constructor(
    private cart: CartService,
    private fb: FormBuilder,
    private http: HttpClient,
    private auth: AuthService,
    private snack: MatSnackBar,
    public translate: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.cartItems$ = this.cart.cart$;
    this.total$ = this.cart.total$;

    this.checkoutForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(3)]],
      lastName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      street: ['', Validators.required],
      city: ['', Validators.required],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      country: ['SK' as CountryCode, Validators.required],

      billing: this.fb.group({
        companyPurchase: [false],
        companyName: [''],
        ico: [''],
        dic: [''],
        icDph: [''],
        useDifferentAddress: [false],
        address: this.fb.group({
          street: [''],
          city: [''],
          zip: [''],
          country: ['SK' as CountryCode],
        }),
      }),

      giftVoucherCode: [''],

      paymentMethod: ['card' as PaymentMethod, Validators.required],

      delivery: this.fb.group({
        method: ['pickup' as DeliveryMethod, Validators.required],
        useDifferentAddress: [false],
        address: this.fb.group({
          street: [''],
          city: [''],
          zip: [''],
          country: ['SK' as CountryCode],
        }),
        details: this.fb.group({
          provider: [''],
          postOfficeId: [''],
          packetaBoxId: [''],
          notes: [''],
        }),
      }),

      // 🎁 gift wrap controls
      giftWrapMode: ['each_item' as GiftWrapMode, Validators.required],
      giftWrapNote: [''],

      deliveryUrgency: ['standard' as DeliveryUrgency, Validators.required],
      notes: [''],

      consents: this.fb.group({
        terms: [false, Validators.requiredTrue],
        marketing: [false],
      }),
    });

    this.checkoutForm.setValidators(this.paymentDeliveryCompatibilityValidator());
  }

  private enforceDigitalProductRules() {
    if (!this.onlyGiftVouchersInCart) return;

    const currentDelivery = this.selectedDeliveryMethod();
    if (currentDelivery !== 'digital_product') {
      this.ctrl('delivery.method').setValue('digital_product', { emitEvent: true });
      this.selectedDeliveryMethod.set('digital_product');
    }

    const currentPayment = this.selectedPaymentMethod();
    const allowedPayments: PaymentMethod[] = ['card', 'bank'];

    if (!allowedPayments.includes(currentPayment)) {
      this.ctrl('paymentMethod').setValue('card', { emitEvent: true });
      this.selectedPaymentMethod.set('card');
    }
  }

  private sendNewsletterEmail(email: string) {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return;

    const locale = (this.translate.currentLang || navigator.language || 'sk').slice(0,2);

    const body = {
      email: normalized,
      source: 'checkout',
      consent_text_version: 'v1',
      double_opt_in: false,
      locale,
    };

    try {
      if ('sendBeacon' in navigator) {
        const ok = navigator.sendBeacon(
          NEWSLETTER_ENDPOINT,
          new Blob([JSON.stringify(body)], { type: 'application/json' })
        );
        if (ok) return;
      }
    } catch {}

    try {
      fetch(NEWSLETTER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
      return;
    } catch {}

    this.http.post(NEWSLETTER_ENDPOINT, body).subscribe({ next: () => {}, error: () => {} });
  }

  loadPacketaScript() {
    if (document.getElementById('packeta-widget')) return;
    const s = document.createElement('script');
    s.id = 'packeta-widget';
    s.src = 'https://widget.packeta.com/v6/www/js/library.js';
    s.async = true;
    document.head.appendChild(s);
  }

  private ensurePacketaReady(): Promise<void> {
    if (this.packetaReady) return this.packetaReady;

    this.packetaReady = new Promise<void>((resolve) => {
      const w = window as any;
      if (w?.Packeta?.Widget) return resolve();

      const existing = document.getElementById('packeta-widget') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        setTimeout(() => { if (w?.Packeta?.Widget) resolve(); }, 0);
        return;
      }

      const s = document.createElement('script');
      s.id = 'packeta-widget';
      s.src = 'https://widget.packeta.com/v6/www/js/library.js';
      s.async = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

    return this.packetaReady;
  }

  private loadSlpostaScript() {
    if (document.getElementById('slposta-widget')) return;
    const s = document.createElement('script');
    s.id = 'slposta-widget';
    s.src = 'https://static.posta.sk/pickup-widget/v1/lib.js';
    s.async = true;
    document.head.appendChild(s);
  }

  private ensureSlpostaReady(): Promise<void> {
    if (this.slpostaReady) return this.slpostaReady;

    this.slpostaReady = new Promise<void>((resolve) => {
      const w = window as any;
      if (w?.slposta?.PickupWidget) return resolve();

      const existing = document.getElementById('slposta-widget') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        setTimeout(() => { if (w?.slposta?.PickupWidget) resolve(); }, 0);
        return;
      }

      const s = document.createElement('script');
      s.id = 'slposta-widget';
      s.src = 'https://static.posta.sk/pickup-widget/v1/lib.js';
      s.async = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

    return this.slpostaReady;
  }

  private showLoginSnackOnce() {
    if (typeof sessionStorage === 'undefined') return;

    if (sessionStorage.getItem('loginSnackShown')) return;
    sessionStorage.setItem('loginSnackShown', '1');
    this.snack.open(
      this.translate.instant('AUTH.LOGIN.SUCCESS') || 'Prihlásenie prebehlo úspešne.',
      this.translate.instant('COMMON.OK') || 'OK',
      { duration: 4000 }
    );
  }

  private checkLoginSnackFromUrl() {
    if (typeof window === 'undefined') return;

    const tree: UrlTree = this.router.parseUrl(this.router.url);
    const qp = tree.queryParams;

    const frag = this.route.snapshot.fragment ?? '';
    const fragParams = new URLSearchParams(frag);
    const accessToken = qp['access_token'] || fragParams.get('access_token');
    const loginSuccess = qp['login'] === 'success' || fragParams.get('login') === 'success';

    if (accessToken || loginSuccess) {
      this.showLoginSnackOnce();

      delete tree.queryParams['access_token'];
      delete tree.queryParams['refresh_token'];
      delete tree.queryParams['login'];
      this.router.navigateByUrl(tree, { replaceUrl: true });
    }
  }

  private attachZipSanitizer(ctrl: AbstractControl) {
    ctrl.valueChanges.subscribe((raw: unknown) => {
      if (typeof raw !== 'string') return;
      let digits = raw.replace(/\D+/g, '');
      if (digits.length > 5) digits = digits.slice(0, 5);
      if (digits !== raw) {
        ctrl.setValue(digits, { emitEvent: false });
      }
    });
  }

  removeItem(row: CartRow) {
    this.cart.remove(row.id, row.session?.id);
  }

  ngOnInit(): void {
    if (this.cart.items.length === 0) {
      this.router.navigateByUrl('/produkt');
      return;
    }

    this.checkLoginSnackFromUrl();

    // načítaj produkt darčekového balenia
    this.loadGiftWrapProduct();

    this.cart.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe(items => {
        // vždy prepočítať DPH pri každej zmene košíka
        this.recomputeVat(items);

        // udrž gift wrap state konzistentný s košíkom
        this.rebuildGiftWrapFromCart(items);

        if (items.length === 0) {
          this.router.navigateByUrl('/produkt');
          return;
        }

        this.hasGiftVoucherProduct = items.some(r => r.isGiftVoucher === true);
        const isRowDigital = (r: CartRow) =>
          r.digitalSelected === true;

        this.onlyGiftVouchersInCart =
          items.length > 0 && items.every(isRowDigital);

        this.enforceDigitalProductRules();

        if (!this.onlyGiftVouchersInCart && this.selectedDeliveryMethod() === 'digital_product') {
          this.ctrl('delivery.method').setValue('pickup', { emitEvent: true });
        }
      });

    this.total$
      .pipe(takeUntil(this.destroy$))
      .subscribe(t => this.orderTotal.set(t || 0));

    this.auth.currentUser$.subscribe((user: User | null) => {
      if (user) {
        this._userId = user.id;
        this.checkoutForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          street: user.street ?? '',
          city: user.city ?? '',
          zip: user.zip ?? '',
          country: user.country ?? 'Slovensko'
        });

        const countryFromForm = this.checkoutForm.get('country')!.value as CountryCode;
        this.countrySignal.set(countryFromForm || 'SK');
      }
    });

    const deliveryGroup = this.checkoutForm.get('delivery') as FormGroup;
    const address = deliveryGroup.get('address') as FormGroup;
    const details = deliveryGroup.get('details') as FormGroup;

    const billingGroup = this.checkoutForm.get('billing') as FormGroup;
    const billingAddress = billingGroup.get('address') as FormGroup;

    this.selectedDeliveryMethod.set(deliveryGroup.get('method')!.value as DeliveryMethod);
    this.selectedPaymentMethod.set(this.checkoutForm.get('paymentMethod')!.value as PaymentMethod);

    const paymentCtrl = this.checkoutForm.get('paymentMethod')!;
    paymentCtrl.valueChanges
      .pipe(distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((method: PaymentMethod) => {
        this.selectedPaymentMethod.set(method);
        this.ensurePaymentCompatibleWithDelivery();
      });

    const countryCtrl = this.checkoutForm.get('country')!;
    this.countrySignal.set((countryCtrl.value || 'SK') as CountryCode);
    countryCtrl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        const country = (val || 'SK') as CountryCode;
        this.countrySignal.set(country);

        if (country !== 'SK') {
          const currentMethod = this.selectedDeliveryMethod();
          if (currentMethod === 'post_office' || currentMethod === 'packeta_box') {
            this.ctrl('delivery.method').setValue('post_courier', { emitEvent: true });
          }
        }
      });

    deliveryGroup.get('method')!
      .valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((m: DeliveryMethod) => {
        this.selectedDeliveryMethod.set(m);
        this.applyCourierAddressMode();
        this.applyPerMethodValidators(m, address, details);

        if (m === 'post_office') {
          const alreadySelected = !!details.get('postOfficeId')!.value;
          if (!alreadySelected) {
            this.openSlposta();
          }
        }
        this.ensurePaymentCompatibleWithDelivery(false);
      });

    deliveryGroup.get('useDifferentAddress')!.valueChanges.subscribe(() => {
      this.applyCourierAddressMode();
    });

    billingGroup.get('companyPurchase')!.valueChanges.subscribe((isCompany: boolean) => {
      const companyNameCtrl = billingGroup.get('companyName')!;
      const icoCtrl = billingGroup.get('ico')!;
      if (isCompany) {
        companyNameCtrl.setValidators([Validators.required]);
        icoCtrl.setValidators([Validators.required]);
      } else {
        companyNameCtrl.clearValidators();
        icoCtrl.clearValidators();
      }
      companyNameCtrl.updateValueAndValidity({ emitEvent: false });
      icoCtrl.updateValueAndValidity({ emitEvent: false });
    });

    billingGroup.get('useDifferentAddress')!.valueChanges.subscribe((useDiff: boolean) => {
      ['street', 'city', 'zip', 'country'].forEach(key => {
        const c = billingAddress.get(key)!;
        if (useDiff) {
          c.setValidators([Validators.required]);
        } else {
          c.clearValidators();
        }
        c.updateValueAndValidity({ emitEvent: false });
      });
    });

    ['street','city','zip','country'].forEach(key => {
      this.checkoutForm.get(key)!.valueChanges.subscribe(() => {
        const m = (deliveryGroup.get('method')!.value as DeliveryMethod);
        const useDiff = !!deliveryGroup.get('useDifferentAddress')!.value;
        if (m === 'post_courier' && !useDiff) {
          this.syncAddressFromCustomer();
        }
      });
    });

    const zipCtrl = this.checkoutForm.get('zip')!;
    this.attachZipSanitizer(zipCtrl);
    const deliveryZipCtrl = this.checkoutForm.get('delivery.address.zip')!;
    this.attachZipSanitizer(deliveryZipCtrl);
    const billingZipCtrl = this.checkoutForm.get('billing.address.zip')!;
    this.attachZipSanitizer(billingZipCtrl);

    this.route.queryParamMap.subscribe((qp) => {
      const postOfficeId = qp.get('postOfficeId');
      const packetaBoxId = qp.get('packetaBoxId');

      if (postOfficeId) {
        details.get('postOfficeId')!.setValue(postOfficeId);
        this.router.navigate([], { queryParams: { postOfficeId: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
      if (packetaBoxId) {
        details.get('packetaBoxId')!.setValue(packetaBoxId);
        this.router.navigate([], { queryParams: { packetaBoxId: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });

    this.auth.currentUser$
      .pipe(
        pairwise(),
        filter(([prev, curr]) => !prev && !!curr),
        take(1)
      )
      .subscribe(() => this.showLoginSnackOnce());

    this.loadPacketaScript();
    this.ensurePacketaReady();
    this.loadSlpostaScript();
    this.ensureSlpostaReady();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openSlposta() {
    const w = window as any;

    if (!w?.slposta?.PickupWidget) {
      this.snack.open('Výber pošty sa ešte načítava, skúste znova o chvíľu.', 'OK', {
        duration: 3000,
      });
      return;
    }

    const config = {
      branchKinds: ['office'],
      callback: (pickupPoint: SlpostaPickupPoint | null) => {
        if (!pickupPoint) return;

        this.checkoutForm.patchValue({
          delivery: {
            method: 'post_office',
            details: {
              provider: 'slposta',
              postOfficeId: pickupPoint.id,
              notes: pickupPoint.label
                || `${pickupPoint.deliveryAddress?.street ?? ''} ${pickupPoint.deliveryAddress?.city ?? ''} ${pickupPoint.deliveryAddress?.zip ?? ''}`.trim()
            },
            address: {
              street: pickupPoint.deliveryAddress?.street ?? '',
              city: pickupPoint.deliveryAddress?.city ?? '',
              zip: pickupPoint.deliveryAddress?.zip ?? '',
              country: 'Slovensko'
            }
          }
        });

        const deliveryGroup = this.checkoutForm.get('delivery') as FormGroup;
        const details = deliveryGroup.get('details') as FormGroup;
        this.applyPerMethodValidators('post_office', deliveryGroup.get('address') as FormGroup, details);
      }
    };

    (window as any).slposta.PickupWidget.open(config);
  }

  

  private ctrl(path: string): AbstractControl {
    const c = this.checkoutForm.get(path);
    if (!c) throw new Error(`Missing control: ${path}`);
    return c;
  }

  private syncAddressFromCustomer() {
    const deliveryAddr = this.ctrl('delivery.address') as FormGroup;
    deliveryAddr.patchValue({
      street: this.ctrl('street').value,
      city: this.ctrl('city').value,
      zip: this.ctrl('zip').value,
      country: this.ctrl('country').value
    }, { emitEvent: false });
  }

  private applyCourierAddressMode() {
    const method = this.ctrl('delivery.method').value as DeliveryMethod;
    const useDifferent = !!this.ctrl('delivery.useDifferentAddress').value;
    const address = this.ctrl('delivery.address') as FormGroup;

    if (method !== 'post_courier') return;

    if (useDifferent) {
      ['street','city','zip','country'].forEach(k => {
        address.get(k)!.setValidators([Validators.required]);
        address.get(k)!.updateValueAndValidity({ emitEvent: false });
      });
    } else {
      ['street','city','zip','country'].forEach(k => {
        address.get(k)!.clearValidators();
        address.get(k)!.updateValueAndValidity({ emitEvent: false });
      });
      this.syncAddressFromCustomer();
    }
  }

  private applyPerMethodValidators(m: DeliveryMethod, address: FormGroup, details: FormGroup) {
    ['street','city','zip','country'].forEach(c => {
      address.get(c)!.clearValidators();
      address.get(c)!.updateValueAndValidity({ emitEvent: false });
    });
    details.get('postOfficeId')!.clearValidators();
    details.get('postOfficeId')!.updateValueAndValidity({ emitEvent: false });
    details.get('packetaBoxId')!.clearValidators();
    details.get('packetaBoxId')!.updateValueAndValidity({ emitEvent: false });

    if (m === 'post_courier') this.applyCourierAddressMode();

    if (m === 'post_office') {
      details.get('postOfficeId')!.setValidators([Validators.required]);
      details.get('postOfficeId')!.updateValueAndValidity({ emitEvent: false });
    }
    if (m === 'packeta_box') {
      details.get('packetaBoxId')!.setValidators([Validators.required]);
      details.get('packetaBoxId')!.updateValueAndValidity({ emitEvent: false });
    }
  }

  private ensurePaymentCompatibleWithDelivery(showSnack = true) {
    const method = this.ctrl('delivery.method').value as DeliveryMethod;
    const payment = this.ctrl('paymentMethod').value as PaymentMethod;

    if (payment === 'onsite' && method !== 'pickup') {
      this.ctrl('paymentMethod').setValue('card', { emitEvent: false });
      this.selectedPaymentMethod.set('card');

      if (showSnack) {
        this.snack.open(
          this.translate.instant('ESHOP.ONSITE_ONLY_PICKUP') || 'Platba na mieste je možná len pri osobnom odbere.',
          this.translate.instant('COMMON.OK') || 'OK',
          { duration: 4000 }
        );
      }
      return;
    }

    if (payment === 'cod' && method === 'pickup') {
      this.ctrl('paymentMethod').setValue('card', { emitEvent: false });
      this.selectedPaymentMethod.set('card');

      if (showSnack) {
        this.snack.open(
          this.translate.instant('ESHOP.COD_NOT_FOR_PICKUP') || 'Dobierka nie je možná pri osobnom odbere.',
          this.translate.instant('COMMON.OK') || 'OK',
          { duration: 4000 }
        );
      }
      return;
    }
  }

  private paymentDeliveryCompatibilityValidator() {
    return (ctrl: AbstractControl) => {
      const method = ctrl.get('delivery.method')?.value as DeliveryMethod;
      const payment = ctrl.get('paymentMethod')?.value as PaymentMethod;

      if (payment === 'onsite' && method !== 'pickup') {
        return { incompatiblePaymentDelivery: true };
      }
      if (payment === 'cod' && method === 'pickup') {
        return { incompatiblePaymentDelivery: true };
      }
      return null;
    };
  }

  grand(total: number | null): number {
    const discount = this.appliedGiftVoucher?.discount ?? 0;

    return Math.max(
      0,
      (total || 0) +
        this.shippingFee() +
        this.paymentFee() +
        this.giftWrapFee() -
        discount
    );
  }

 applyGiftVoucher() {
    this.voucherMessage = '';
    this.voucherMessageType = '';

    const code = String(this.checkoutForm.get('giftVoucherCode')?.value || '').trim();

    if (!code) {
      this.appliedGiftVoucher = null;
      this.voucherMessage = this.translate.instant('ESHOP.VOUCHER.ERROR_EMPTY');
      this.voucherMessageType = 'error';
      return;
    }

    const itemsTotal = this.cart.items.reduce((sum, i) => {
      const unit = (i.inSale && typeof i.price_sale === 'number') ? i.price_sale : i.price;
      return sum + unit * i.qty;
    }, 0);

    const orderTotal =
      itemsTotal +
      this.shippingFee() +
      this.paymentFee() +
      this.giftWrapFee();

    this.giftVoucherApplying = true;

    this.http.post<any>(`${environment.apiUrl}/gift-vouchers/validate`, {
      code,
      orderTotal: this.round2(orderTotal),
    }).subscribe({
      next: (res) => {
        this.giftVoucherApplying = false;

        if (!res?.valid || !res?.voucher) {
          this.appliedGiftVoucher = null;
          this.voucherMessage = res?.message || this.translate.instant('ESHOP.VOUCHER.ERROR_INVALID');
          this.voucherMessageType = 'error';
          return;
        }

        const voucher = res.voucher;

        if (voucher.voucherType !== 'value') {
          this.appliedGiftVoucher = null;
          this.voucherMessage = this.translate.instant('ESHOP.VOUCHER.ERROR_NOT_VALUE');
          this.voucherMessageType = 'error';
          return;
        }

        const remainingValue = Number(voucher.remainingValue ?? voucher.amount ?? 0);
        const discount = Math.min(remainingValue, orderTotal);

        if (discount <= 0) {
          this.appliedGiftVoucher = null;
          this.voucherMessage = this.translate.instant('ESHOP.VOUCHER.ERROR_NO_BALANCE');
          this.voucherMessageType = 'error';
          return;
        }

        this.appliedGiftVoucher = {
          code: voucher.code,
          voucherType: voucher.voucherType,
          remainingValue,
          discount,
          newRemainingValue: Math.max(0, remainingValue - discount),
        };

        this.voucherMessage = this.translate.instant('ESHOP.VOUCHER.SUCCESS_APPLIED', {
          discount: discount.toFixed(2),
        });
        this.voucherMessageType = 'success';

        this.snack.open(
          this.translate.instant('ESHOP.VOUCHER.SNACK_APPLIED', {
            discount: discount.toFixed(2),
          }),
          '',
          { duration: 4000 }
        );
      },
      error: (err) => {
        this.giftVoucherApplying = false;
        this.appliedGiftVoucher = null;

        this.voucherMessage =
          err?.error?.message ||
          err?.error?.error ||
          this.translate.instant('ESHOP.VOUCHER.ERROR_INVALID_OR_USED');

        this.voucherMessageType = 'error';

        this.snack.open(
          this.voucherMessage,
          '',
          { duration: 5000, panelClass: 'my-snackbar-error' }
        );
      }
    });
  }

    removeGiftVoucher() {
      this.appliedGiftVoucher = null;
      this.voucherMessage = '';
      this.voucherMessageType = '';
      this.checkoutForm.get('giftVoucherCode')?.setValue('');
    }

  get isDeliverySelectionMissing(): boolean {
    const method = this.checkoutForm.get('delivery.method')?.value as DeliveryMethod;
    const det = this.checkoutForm.get('delivery.details')?.value || {};
    if (method === 'post_office') return !det.postOfficeId;
    if (method === 'packeta_box') return !det.packetaBoxId;
    if (method === 'digital_product') return false;

    if (method === 'post_courier') {
      const useDiff = !!this.checkoutForm.get('delivery.useDifferentAddress')?.value;
      if (!useDiff) return false;
      const addr = this.checkoutForm.get('delivery.address')?.value || {};
      return !addr.street || !addr.city || !addr.zip || !addr.country;
    }
    return false;
  }

  get isPostOffice(): boolean {
    return this.ctrl('delivery.method').value === 'post_office';
  }
  get postOfficeId(): string {
    return this.ctrl('delivery.details.postOfficeId').value || '';
  }
  get postOfficeLabel(): string {
    const notes = this.ctrl('delivery.details.notes').value || '';
    if (notes) return notes;
    const street = this.ctrl('delivery.address.street').value || '';
    const city   = this.ctrl('delivery.address.city').value || '';
    const zip    = this.ctrl('delivery.address.zip').value || '';
    const addr = [street, city, zip].filter(Boolean).join(', ');
    return addr || `Pošta #${this.postOfficeId}`;
  }

  changePostOffice() {
    this.openSlposta();
  }

  clearPostOffice() {
    const details = this.ctrl('delivery.details') as FormGroup;
    const address = this.ctrl('delivery.address') as FormGroup;
    details.patchValue({ postOfficeId: '', notes: '' }, { emitEvent: true });
    address.patchValue({ street: '', city: '', zip: '' }, { emitEvent: true });
  }

  choosePostOffice() {
    const returnUrl = window.location.href;
    const url = `${environment.apiUrl}/integrations/post-office/select?return=${encodeURIComponent(returnUrl)}`;
    window.location.href = url;
  }

 choosePacketaBox() {
  const w = window as any;

  if (!w?.Packeta?.Widget) {
    this.snack.open('Packeta sa ešte načítava, skúste znova o chvíľu.', 'OK', {
      duration: 3000,
    });
    return;
  }

  this.openPacketaNow();
}

private openPacketaNow() {
  const apiKey = environment.PACKETA_WIDGET_KEY;

  const options = {
    language: (this.translate.currentLang || 'sk').slice(0, 2),
    view: 'modal',
    vendors: [
      { country: 'sk' },
      { country: 'sk', group: 'zbox' },
    ],
  };

  const onSelect = (point: any) => {
    if (!point) return;

    const provider = point.carrierId ? `carrier:${point.carrierId}` : 'packeta';
    const pickupId = point.carrierId ? point.carrierPickupPointId : point.id;

    const humanLabel = [
      point.name,
      point.street,
      point.city,
    ].filter(Boolean).join(', ');

    this.checkoutForm.patchValue({
      delivery: {
        method: 'packeta_box',
        details: {
          provider,
          packetaBoxId: pickupId,
          notes: humanLabel,
        },
      },
    });
  };

  (window as any).Packeta.Widget.pick(apiKey, onSelect, options);
}
  
  
  copy(text: string) {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      this.snack.open(this.translate.instant('COMMON.COPIED') || 'Copied', '', { duration: 2500 });
    });
  }

  submitCheckout() {
    const rawVoucherCode = String(this.checkoutForm.get('giftVoucherCode')?.value || '').trim();

    if (rawVoucherCode && !this.appliedGiftVoucher) {
      this.voucherMessage = this.translate.instant('ESHOP.VOUCHER.ERROR_NOT_APPLIED');
      this.voucherMessageType = 'error';

      this.snack.open(
        this.voucherMessage,
        '',
        { duration: 5000, panelClass: 'my-snackbar-error' }
      );

      return;
    }

    const items: CartRow[] = this.cart.items;

    if (this.checkoutForm.invalid || this.isDeliverySelectionMissing) {
      this.checkoutForm.markAllAsTouched();
      this.snack.open(
        this.translate.instant('ESHOP.CHECKOUT_FORM_INVALID'),
        '',
        { duration: 6000, panelClass: 'my-snackbar-error', verticalPosition: 'bottom', horizontalPosition: 'center' }
      );
      return;
    }

    const wantsMarketing = !!this.checkoutForm.get('consents.marketing')?.value;
    const emailCtrl = this.checkoutForm.get('email');
    if (wantsMarketing && emailCtrl?.valid) {
      this.sendNewsletterEmail(emailCtrl.value as string);
    }

    if (this.submitBtnRef?.nativeElement) {
      this.submitBtnWidth = this.submitBtnRef.nativeElement.offsetWidth;
    }
    this.isSubmitting = true;

    const f = this.checkoutForm.value as any;

    const itemsTotal = (items || []).reduce((sum, i) => {
      const unit = (i.inSale && typeof i.price_sale === 'number') ? i.price_sale! : i.price;
      return sum + unit * i.qty;
    }, 0);

    const customerData = {
      id: this._userId ?? 0,
      name: `${f.firstName} ${f.lastName}`,
      email: f.email,
      phone: f.phone,
      street: f.street,
      city: f.city,
      zip: f.zip,
      country: f.country
    };

    const billing = f.billing || {};
    const isCompany = !!billing.companyPurchase;
    const useBillingAddress = !!billing.useDifferentAddress && !!billing.address;
    const billingAddress = useBillingAddress
      ? billing.address
      : {
          street: f.street,
          city: f.city,
          zip: f.zip,
          country: f.country,
        };

    const isCourier = f.delivery.method === 'post_courier';
    const useDiff   = !!f.delivery.useDifferentAddress;

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const normVat = (v: unknown) => {
      const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : 0);
      return isNaN(n) ? 0 : n;
    };

    const isEventItem = (i: CartRow) =>
      !!i.session && (i.session.type === 'tour' || i.session.type === 'workshop');

    const toIso = (v: any) => v ? new Date(v).toISOString() : null;
    const isPostOffice = f.delivery.method === 'post_office';

    const shippingValue = this.shippingFee();

    const country = f.country as CountryCode;
    const method = f.delivery.method as DeliveryMethod;
    const shippingFeeForBackend =
      country === 'WORLD' &&
          method !== 'pickup' &&
          method !== 'digital_product'
            ? null
            : +shippingValue.toFixed(2);

    // ==========================
    // 🎁 Gift wrap: zluč s manuálnym produktom (ak je už v košíku)
    // ==========================
    const giftWrapSelectedQty = this.giftWrapTotalQty();
    const manualGiftWrapQty = this.getManualGiftWrapQty(items);
    const giftWrapAutoQty = Math.max(0, giftWrapSelectedQty - manualGiftWrapQty);

    const payloadItems: CheckoutPayloadItem[] = items.map(i => {
  const ratePct = normVat(i.vatPercentage);
  const rate = ratePct / 100;
  const unitGross = (i.inSale && typeof i.price_sale === 'number') ? i.price_sale! : i.price;
  const unitNet   = rate > 0 ? unitGross / (1 + rate) : unitGross;
  const unitTax   = unitGross - unitNet;

  const lineNet   = unitNet * i.qty;
  const lineTax   = unitTax * i.qty;
  const lineGross = unitGross * i.qty;
  const isDigital = !!i.digitalSelected;

  const base: CheckoutPayloadItem = {
    productId: i.id,
    productName: i.name,
    slug: i.slug,
    type: i.isGiftVoucher ? 'gift_voucher' : (isEventItem(i) ? 'event' : 'product'),

    quantity: i.qty,
    vatPercentage: ratePct,
    unitPrice: unitGross,
    unitNet: round2(unitNet),
    unitTax: round2(unitTax),
    unitGross: round2(unitGross),
    sumNet: round2(lineNet),
    sumTax: round2(lineTax),
    sumGross: round2(lineGross),

    isDigitalProduct: isDigital,
    isGiftVoucher: !!i.isGiftVoucher,
    voucherType: i.isGiftVoucher ? i.voucherType : undefined,
    voucherValue:
      i.isGiftVoucher && i.voucherType === 'value'
        ? (i.voucherValue ?? unitGross)
        : null,
  };

  if (isEventItem(i)) {
    base.event = {
      sessionId: i.session!.id,
      type: i.session!.type,
      startDateTime: toIso(i.session!.startDateTime),
      peopleCount: i.qty,
      bookingId: i.bookingId ?? null
    };
  }

  return base;
});


    // ✅ pridať produkt darčekové balenie automaticky (iba ak treba)
    if (giftWrapAutoQty > 0) {
      const gw = this.giftWrapProduct;
      if (!gw?.id) {
        console.warn('Gift wrap product not loaded; skipping auto add.');
      } else {
        const unitGross = this.giftWrapUnitPrice();
        const ratePct = this.giftWrapVatPct();
        const rate = (ratePct || 0) / 100;

        const unitNet = rate > 0 ? unitGross / (1 + rate) : unitGross;
        const unitTax = unitGross - unitNet;

        payloadItems.push({
          productId: gw.id,
          productName: gw.title ?? gw.name ?? 'Darčekové balenie',
          quantity: giftWrapAutoQty,

          vatPercentage: ratePct || 0,
          unitPrice: unitGross,
          unitNet: round2(unitNet),
          unitTax: round2(unitTax),
          unitGross: round2(unitGross),

          sumNet: round2(unitNet * giftWrapAutoQty),
          sumTax: round2(unitTax * giftWrapAutoQty),
          sumGross: round2(unitGross * giftWrapAutoQty),

          isDigitalProduct: false,
          isGiftVoucher: false,

          isGiftWrapProduct: true,
        });
      }
    }

    const payload = {
      locale: (this.translate.currentLang || navigator.language || 'sk').slice(0,2),
      shippingFee: shippingFeeForBackend,
      paymentFee: +this.paymentFee().toFixed(2),

      giftVoucher: this.appliedGiftVoucher ? {
        code: this.appliedGiftVoucher.code,
        discount: this.appliedGiftVoucher.discount,
        newRemainingValue: this.appliedGiftVoucher.newRemainingValue,
      } : null,

      //  instrukcie k baleniu (produkt je reálny item)
      giftWrap: giftWrapSelectedQty > 0 ? {
        productId: this.giftWrapProduct?.id ?? null,
        slug: this.GIFT_WRAP_SLUG,
        unitPrice: this.giftWrapUnitPrice(),
        selectedQty: giftWrapSelectedQty,
        mode: f.giftWrapMode as GiftWrapMode,
        note: (f.giftWrapNote || '').trim() || null,
        perProduct: Array.from(this.giftWrapMap.values())
          .filter(x => (x.wrapQty || 0) > 0)
          .map(x => ({ productId: x.productId, wrapQty: x.wrapQty })),
        autoAddedQty: giftWrapAutoQty,
        alreadyInCartQty: manualGiftWrapQty,
      } : null,

      notes: (f.notes || '').trim(),
      deliveryUrgency: f.deliveryUrgency as DeliveryUrgency,

      billing: {
        isCompany,
        companyName: billing.companyName || null,
        ico: billing.ico || null,
        dic: billing.dic || null,
        icDph: billing.icDph || null,
        address: billingAddress,
      },

      items: payloadItems,
      customer: customerData,
      temporaryId: this.temporaryId,
      paymentMethod: f.paymentMethod as PaymentMethod,
      delivery: {
        method: f.delivery.method as DeliveryMethod,
        address: isCourier && !useDiff
          ? { street: f.street, city: f.city, zip: f.zip, country: f.country }
          : f.delivery.address,
        details: {
          ...f.delivery.details,

          ...(isPostOffice ? {
            postOfficeStreet:  f.delivery.address?.street  || null,
            postOfficeCity:    f.delivery.address?.city    || null,
            postOfficeZip:     f.delivery.address?.zip     || null,
            postOfficeCountry: f.delivery.address?.country || null,
          } : {})
        }
      }
    };

    this.http.post<any>(`${environment.apiUrl}/checkout`, payload).subscribe({
      next: (res) => {
        const formVal = this.checkoutForm.value as any;
        const payMethod = formVal.paymentMethod as PaymentMethod;

        const checkoutUrl: string | undefined = res?.checkoutUrl;

        if (payMethod !== 'card') {
          if (checkoutUrl) {
            const isStripe = typeof checkoutUrl === 'string' && checkoutUrl.includes('stripe.com');
            if (!isStripe) {
              window.location.href = checkoutUrl;
              return;
            }
          }
          const nonCardOrderId = res?.orderId ?? res?.id ?? res?.order?.id ?? null;
          if (nonCardOrderId) {
            this.router.navigate(['/checkout/success'], { queryParams: { order: nonCardOrderId }});
            return;
          }

          this.isSubmitting = false;
          this.submitBtnWidth = 0;
          this.snack.open('Chýba odpoveď pre dokončenie objednávky.', '', { duration: 6000 });
          return;
        }

        const orderId = res?.orderId ?? res?.id ?? res?.order?.id ?? null;

        if (orderId) {
          try { sessionStorage.setItem('lastOrderId', String(orderId)); } catch {}
        }

        if (checkoutUrl && !checkoutUrl.includes('stripe.com')) {
          window.location.href = checkoutUrl;
          return;
        }

        if (!orderId) {
          this.isSubmitting = false;
          this.submitBtnWidth = 0;
          console.error('Missing orderId in /checkout response (card):', res);
          this.snack.open(this.translate.instant('ESHOP.CHECKOUT_FAILED') || 'Checkout failed', '', { duration: 5000 });
          return;
        }

        let amountCents: number | null =
          typeof res?.totalWithShippingCents === 'number' ? res.totalWithShippingCents :
          (typeof res?.totalWithShipping === 'number' ? Math.round(res.totalWithShipping * 100) : null);

        if (amountCents == null) {
          // zahrň gift wrap aj vo fallback sume
          const grandTotal = this.grand(itemsTotal || 0);
          amountCents = Math.round(grandTotal * 100);
        }

        const body = {
          amountCents,
          currency: 'EUR',
          orderId,
          email: formVal.email,
          phone: formVal.phone,
          fullName: `${formVal.firstName} ${formVal.lastName}`,
          country: 'SK',
          label: 'Order',
        };

        this.http.post<{ transId: string; paymentUrl: string }>(
          `${environment.apiUrl}/payments/create`,
          body
        ).subscribe({
          next: r2 => {
            try { sessionStorage.setItem('lastTransId', r2.transId); } catch {}
            window.location.href = r2.paymentUrl;
          },
          error: err2 => {
            console.error('Comgate create failed', err2);
            this.isSubmitting = false;
            this.submitBtnWidth = 0;
            this.snack.open(this.translate.instant('ESHOP.CHECKOUT_FAILED') || 'Checkout failed', '', { duration: 5000 });
          }
        });
      },
      error: err => {
        console.error('Checkout failed', err);
        this.isSubmitting = false;
        this.submitBtnWidth = 0;
        this.snack.open(this.translate.instant('ESHOP.CHECKOUT_FAILED') || 'Checkout failed', '', { duration: 5000 });
      }
    });
  }
}
