import { Component, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, AbstractControl } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { Observable } from 'rxjs';
// Angular Material
import { NavigationEnd, UrlTree } from '@angular/router';
import { filter, take, pairwise } from 'rxjs/operators';
import { GoogleLoginPromptComponent } from 'app/components/google-login-prompt/google-login-prompt.component';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CartService, CartRow } from 'app/services/cart.service';
import { AuthService, User } from 'app/services/auth.service';
import { FooterComponent } from 'app/components/footer/footer.component';
import { UserFormComponent } from 'app/components/user-form/user-form.component';
import { environment } from 'environments/environment';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { distinctUntilChanged } from 'rxjs/operators';
import { ProductsService, Product as ShopProduct } from 'app/services/products.service';

type PaymentMethod = 'card' | 'cod' | 'bank' | 'onsite' | 'post';
type DeliveryMethod = 'pickup' | 'post_office' | 'packeta_box' | 'post_courier';

type SlpostaPickupPoint = {
  id: string;
  kind?: 'office' | 'bbox' | 'point';
  label?: string;
  deliveryAddress?: { street?: string; city?: string; zip?: string };
};
declare global { interface Window { slposta?: any; } }

// POZOR na dvojité /api – toto je bez /api, lebo environment.apiUrl ho už typicky obsahuje
const NEWSLETTER_ENDPOINT = `${environment.apiUrl}/newsletter/subscribe`;


// Sadzby si pokojne uprav
const SHIPPING_FEE: Record<DeliveryMethod, number> = {
  pickup: 0,
  post_office: 3.9,
  packeta_box: 2.9,
  post_courier: 4.9,
};
const PAYMENT_FEE: Record<PaymentMethod, number> = {
  card: 0,
  bank: 0,
  post: 0,
  onsite: 0, // na mieste
  cod: 1.5,    // dobierka
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
    GoogleLoginPromptComponent
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {

  @ViewChild('submitBtn') submitBtnRef!: ElementRef<HTMLButtonElement>;
  submitBtnWidth = 0;
  cartItems$: Observable<CartRow[]>;
  total$: Observable<number>;
  isSubmitting = false;
  
  private _userId: number | null = null;
  get userId(): number | null { return this._userId; }
  readonly TAX_RATE = 0.23;
  /** DPH zahrnutá v sume (amount je už vrátane DPH) */
  private taxFromIncluded(amount: number): number {
    if (!amount || amount <= 0) return 0;
    return amount - amount / (1 + this.TAX_RATE);
  }

  // uložím posledný prepočet, aby si ho vedel zobraziť v šablóne ak chceš
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
  
  /** DPH zo súčasného GRAND totalu (grand už nič nemeníme) */
  /** Celková DPH + pripravený sumár položiek (vracia len celkovú DPH kvôli šablóne) */
  taxIncluded(_total: number | null): number {
    const items: CartRow[] = this.cart.items || [];

    // vyrobím riadky (unit + line sumy) z cien S DPH
    const lines = items.map(i => {
      const ratePct = this.normalizeVat(i.vatPercentage);      // napr. 20
      const rate = ratePct / 100;                               // 0.20
      const unitGross = i.price;                                // i.price už je finálna cena s DPH / ks
      const unitNet   = rate > 0 ? unitGross / (1 + rate) : unitGross;
      const unitTax   = unitGross - unitNet;

      const sumNet    = unitNet * i.qty;
      const sumTax    = unitTax * i.qty;
      const sumGross  = unitGross * i.qty;

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

    // agregácia podľa sadzby
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

    // celkové sumáre
    const totals = lines.reduce((a, l) => {
      a.net  += l.sumNet;
      a.tax  += l.sumTax;
      a.gross+= l.sumGross;
      return a;
    }, { net: 0, tax: 0, gross: 0 });
    totals.net   = this.round2(totals.net);
    totals.tax   = this.round2(totals.tax);
    totals.gross = this.round2(totals.gross);

    // uložím si rozpis pre UI / debug
    this.vatSummary = { lines, byRate, totals };

    // šablóna očakáva číslo = celková DPH
    return totals.tax;
  }

  private temporaryId = localStorage.getItem('lastBookingTmpId') || null;

  checkoutForm!: FormGroup;

  // UI stav (pre dynamické poplatky a zobrazenia)
  selectedDeliveryMethod = signal<DeliveryMethod>('pickup');
  selectedPaymentMethod = signal<PaymentMethod>('card');

  shippingFee = computed(() => SHIPPING_FEE[this.selectedDeliveryMethod()]);
  paymentFee  = computed(() => PAYMENT_FEE[this.selectedPaymentMethod()]);

  // 🔹 VZOROVÉ BANKOVÉ ÚDAJE – uprav podľa seba / alebo načítaj z environmentu
  readonly BANK_INFO = {
    accountName: 'Majolika eShop',
    iban: 'SK12 3456 7890 1234 5678 9012',
    bic: 'BANKSKBX',
    note: 'Prosím uveďte svoje meno do správy pre príjemcu.'
  };

  // Promise, ktorá garantuje pripravenosť Packeta widgetu
  private packetaReady?: Promise<void>;

  constructor(
    private cart: CartService,
    private fb: FormBuilder,
    private http: HttpClient,
    private auth: AuthService,
    private snack: MatSnackBar,
    public translate: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private products: ProductsService,
  ) {
    this.cartItems$ = this.cart.cart$;
    this.total$ = this.cart.total$;

    this.checkoutForm = this.fb.group({
      // ĽAVÝ box – zákazník
      firstName: ['', [Validators.required, Validators.minLength(3)]],
      lastName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      street: ['', Validators.required],
      city: ['', Validators.required],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      country: ['Slovensko', Validators.required],

      // PRAVÝ box – platba + doručenie
      paymentMethod: ['card' as PaymentMethod, Validators.required],

      delivery: this.fb.group({
        method: ['pickup' as DeliveryMethod, Validators.required],
        useDifferentAddress: [false],
        address: this.fb.group({
          street: [''],
          city: [''],
          zip: [''],
          country: ['Slovensko'],
        }),
        details: this.fb.group({
          provider: [''],
          postOfficeId: [''],
          packetaBoxId: [''],
          notes: [''], 
        }),
      }),

      notes: [''],

      consents: this.fb.group({
        terms: [false, Validators.requiredTrue],
        // privacy: [false, Validators.requiredTrue],
        // cookies: [false],
        marketing: [false],
      }),
    });

    this.checkoutForm.setValidators(this.paymentDeliveryCompatibilityValidator());
  }


  private sendNewsletterEmail(email: string) {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) return;

    const locale = (this.translate.currentLang || navigator.language || 'sk').slice(0,2);

    const body = {
      email: normalized,
      source: 'checkout',
      consent_text_version: 'v1', // pozri bod 3 nižšie
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
    document.head.appendChild(s);
  }

  /** Istí, že Packeta.Widget je k dispozícii pred volaním pick() */
  private ensurePacketaReady(): Promise<void> {
    if (this.packetaReady) return this.packetaReady;

    this.packetaReady = new Promise<void>((resolve) => {
      const w = (window as any);
      // 1) Už načítané
      if (w?.Packeta?.Widget) return resolve();

      // 2) Skript už v DOM – počkaj na load
      const existing = document.getElementById('packeta-widget') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        // fallback – ak už nabehol medzičasom
        setTimeout(() => { if (w?.Packeta?.Widget) resolve(); }, 0);
        return;
      }

      // 3) Skript ešte nie je – vlož a čakaj
      const s = document.createElement('script');
      s.id = 'packeta-widget';
      s.src = 'https://widget.packeta.com/v6/www/js/library.js';
      s.async = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

    return this.packetaReady;
  }

  private slpostaReady?: Promise<void>;

  private loadSlpostaScript() {
    if (document.getElementById('slposta-widget')) return;
    const s = document.createElement('script');
    s.id = 'slposta-widget';
    s.src = 'https://static.posta.sk/pickup-widget/v1/lib.js'; // ak chceš test: lib-test1.js
    s.async = true;
    document.head.appendChild(s);
  }

  private showLoginSnackOnce() {
    if (sessionStorage.getItem('loginSnackShown')) return;
    sessionStorage.setItem('loginSnackShown', '1');
    this.snack.open(
      this.translate.instant('AUTH.LOGIN.SUCCESS') || 'Prihlásenie prebehlo úspešne.',
      this.translate.instant('COMMON.OK') || 'OK',
      { duration: 4000 }
    );
  }
  
  private checkLoginSnackFromUrl() {
    const tree: UrlTree = this.router.parseUrl(this.router.url);
    const qp = tree.queryParams;

    // podpora aj pre prípad, že token je vo fragmente: #access_token=...
    const frag = this.route.snapshot.fragment ?? '';
    const fragParams = new URLSearchParams(frag);
    const accessToken = qp['access_token'] || fragParams.get('access_token');
    const loginSuccess = qp['login'] === 'success' || fragParams.get('login') === 'success';

    if (accessToken || loginSuccess) {
      this.showLoginSnackOnce();

      // očisti URL bez reloadu
      delete tree.queryParams['access_token'];
      delete tree.queryParams['refresh_token'];
      delete tree.queryParams['login'];
      this.router.navigateByUrl(tree, { replaceUrl: true });
    }
  }

  private ensureSlpostaReady(): Promise<void> {
    if (this.slpostaReady) return this.slpostaReady;

    this.slpostaReady = new Promise<void>((resolve) => {
      const w = window as any;
      // 1) už je načítané
      if (w?.slposta?.PickupWidget) return resolve();

      // 2) skript v DOM
      const existing = document.getElementById('slposta-widget') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        setTimeout(() => { if (w?.slposta?.PickupWidget) resolve(); }, 0);
        return;
      }

      // 3) vlož skript a čakaj
      const s = document.createElement('script');
      s.id = 'slposta-widget';
      s.src = 'https://static.posta.sk/pickup-widget/v1/lib.js';
      s.async = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });

    return this.slpostaReady;
  }


  private attachZipSanitizer(ctrl: AbstractControl) {
    ctrl.valueChanges.subscribe((raw: unknown) => {
      if (typeof raw !== 'string') return;
      let digits = raw.replace(/\D+/g, ''); // zmaž písmená, medzery, znaky
      if (digits.length > 5) digits = digits.slice(0, 5); // max 5
      if (digits !== raw) {
        ctrl.setValue(digits, { emitEvent: false }); // zabráni loopu
      }
    });
  }


  ngOnInit(): void {

    this.checkLoginSnackFromUrl();

    this.cart.items.forEach(row => {
      this.products.getProductById(row.id).subscribe((p: ShopProduct | null) => {
        if (!p) return;
        const newVat = Number(p.vatPercentage);
        if (Number.isFinite(newVat) && newVat !== row.vatPercentage) {
          this.cart.patchVat(row.id, newVat, row.session?.id);
        }
      });
    });
    // predvyplnenie používateľa
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
      }
    });

    const deliveryGroup = this.checkoutForm.get('delivery') as FormGroup;
    const address = deliveryGroup.get('address') as FormGroup;
    const details = deliveryGroup.get('details') as FormGroup;

    // init signálov
    this.selectedDeliveryMethod.set(deliveryGroup.get('method')!.value as DeliveryMethod);
    this.selectedPaymentMethod.set(this.checkoutForm.get('paymentMethod')!.value as PaymentMethod);

    // zmena platby → prepočet payment fee
    this.checkoutForm.get('paymentMethod')!.valueChanges.subscribe((m: PaymentMethod) => {
      this.selectedPaymentMethod.set(m);
      // NEW: ak je 'onsite' a delivery nie je 'pickup', oprav
      this.ensurePaymentCompatibleWithDelivery();
    });

    // zmena doručenia → validácie + prepočet shipping

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


    // toggle „iná adresa“
    deliveryGroup.get('useDifferentAddress')!.valueChanges.subscribe(() => {
      this.applyCourierAddressMode();
    });

    // sync adresa: ak kuriér a „nepoužiť inú adresu“, kopíruj ľavú adresu
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

    // ZIP v doručovacej adrese (pri kuriérovi / inej adrese)
    const deliveryZipCtrl = this.checkoutForm.get('delivery.address.zip')!;
    this.attachZipSanitizer(deliveryZipCtrl);

    // návrat z externých pickerov (query params)
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

    // Načítaj widget (ak ešte nie je) – a priprav Promise na istotu
    this.loadPacketaScript();
    this.ensurePacketaReady();
    this.loadSlpostaScript();
    this.ensureSlpostaReady();  
  }


  async openSlposta() {
    await this.ensureSlpostaReady();

    const config = {
      // iba klasické pobočky Pošty; môžeš pridať 'bbox' (BalíkoBOX) alebo 'point' (PoštaPOINT)
      branchKinds: ['office'],
      // voliteľne: shipmentType: 'b' | 'ex' | 'zb', shipmentWeight: 2.3
      callback: (pickupPoint: SlpostaPickupPoint | null) => {
        if (!pickupPoint) return;

        // nastav metódu doručenia + detaily
        this.checkoutForm.patchValue({
          delivery: {
            method: 'post_office',
            details: {
              provider: 'slposta',
              postOfficeId: pickupPoint.id,
              notes: pickupPoint.label
                || `${pickupPoint.deliveryAddress?.street ?? ''} ${pickupPoint.deliveryAddress?.city ?? ''} ${pickupPoint.deliveryAddress?.zip ?? ''}`.trim()
            },
            // adresa sa často hodí aspoň pre rekapituláciu (nie je povinné)
            address: {
              street: pickupPoint.deliveryAddress?.street ?? '',
              city: pickupPoint.deliveryAddress?.city ?? '',
              zip: pickupPoint.deliveryAddress?.zip ?? '',
              country: 'Slovensko'
            }
          }
        });

        // spusti validátory pre post_office
        const deliveryGroup = this.checkoutForm.get('delivery') as FormGroup;
        const details = deliveryGroup.get('details') as FormGroup;
        this.applyPerMethodValidators('post_office', deliveryGroup.get('address') as FormGroup, details);
      }
    };

    (window as any).slposta.PickupWidget.open(config);
  }



  async openPacketa() {
    // Počkaj, kým je Packeta.Widget dostupný
    await this.ensurePacketaReady();

    const apiKey = environment.PACKETA_WIDGET_KEY; // verejný widget key
    const options = {
      language: 'sk',
      view: 'modal',
      vendors: [
        { country: 'sk' },                // výdajné miesta Packeta
        { country: 'sk', group: 'zbox' }  // Z-BOXy
      ],
      valueFormat: '"Packeta",id,carrierId,carrierPickupPointId,name,city,street'
    };

    const onSelect = (point: any) => {
      if (!point) return;

      // Rozlíš: ak je to čistá Packeta pobočka (id), alebo carrier PUDO (carrierId + carrierPickupPointId)
      const provider = point.carrierId ? `carrier:${point.carrierId}` : 'packeta';
      const pickupId = point.carrierId ? point.carrierPickupPointId : point.id;

      // nastav metódu a detaily podľa tvojej schémy
      this.checkoutForm.patchValue({
        delivery: {
          method: 'packeta_box',
          details: {
            provider: provider,
            packetaBoxId: pickupId,
            // voliteľne uložíme aj zhrnutie do poznámky (máš v detaile field notes)
            notes: point.formatedValue || `${point.name}, ${point.street || ''} ${point.city || ''}`.trim()
          }
        }
      });
    };

    (window as any).Packeta.Widget.pick(apiKey, onSelect, options);
  }

  // helpers
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
    // reset
    ['street','city','zip','country'].forEach(c => {
      address.get(c)!.clearValidators();
      address.get(c)!.updateValueAndValidity({ emitEvent: false });
    });
    details.get('postOfficeId')!.clearValidators();
    details.get('postOfficeId')!.updateValueAndValidity({ emitEvent: false });
    details.get('packetaBoxId')!.clearValidators();
    details.get('packetaBoxId')!.updateValueAndValidity({ emitEvent: false });

    if (m === 'post_courier') {
      this.applyCourierAddressMode(); // validátory podľa toggle
    }
    if (m === 'post_office') {
      details.get('postOfficeId')!.setValidators([Validators.required]);
      details.get('postOfficeId')!.updateValueAndValidity({ emitEvent: false });
    }
    if (m === 'packeta_box') {
      details.get('packetaBoxId')!.setValidators([Validators.required]);
      details.get('packetaBoxId')!.updateValueAndValidity({ emitEvent: false });
    }
  }


  private supportsOnsitePayment(method: DeliveryMethod): boolean {
    return method === 'pickup';
  }

  /** Ak je payment=onsite a delivery ≠ pickup, prepne payment na 'card' a upozorní. */
  private ensurePaymentCompatibleWithDelivery(showSnack = true) {
    const method = this.ctrl('delivery.method').value as DeliveryMethod;
    const payment = this.ctrl('paymentMethod').value as PaymentMethod;

    if (payment === 'onsite' && !this.supportsOnsitePayment(method)) {
      this.ctrl('paymentMethod').setValue('card', { emitEvent: false });
      this.selectedPaymentMethod.set('card');
      if (showSnack) {
        this.snack.open(
          this.translate.instant('ESHOP.ONSITE_ONLY_PICKUP') || 'Platba na mieste je možná len pri osobnom odbere.',
          this.translate.instant('COMMON.OK') || 'OK',
          { duration: 4000 }
        );
      }
    }
  }

  /** Form-level validator: onsite povolené iba pri pickup. */
  private paymentDeliveryCompatibilityValidator() {
    return (ctrl: AbstractControl) => {
      const method = ctrl.get('delivery.method')?.value as DeliveryMethod;
      const payment = ctrl.get('paymentMethod')?.value as PaymentMethod;
      if (payment === 'onsite' && method !== 'pickup') {
        return { incompatiblePaymentDelivery: true };
      }
      return null;
    };
  }

  // výpočet grand total
  grand(total: number | null): number {
    return (total || 0) + this.shippingFee() + this.paymentFee();
  }

  // blokuj submit, kým chýba výber pre konkrétnu metódu
  get isDeliverySelectionMissing(): boolean {
    const method = this.checkoutForm.get('delivery.method')?.value as DeliveryMethod;
    const det = this.checkoutForm.get('delivery.details')?.value || {};
    if (method === 'post_office') return !det.postOfficeId;
    if (method === 'packeta_box') return !det.packetaBoxId;
    if (method === 'post_courier') {
      const useDiff = !!this.checkoutForm.get('delivery.useDifferentAddress')?.value;
      if (!useDiff) return false; // použije sa ľavá adresa
      const addr = this.checkoutForm.get('delivery.address')?.value || {};
      return !addr.street || !addr.city || !addr.zip || !addr.country;
    }
    return false;
  }
  // --- helpers pre šablónu ---
  get isPostOffice(): boolean {
    return this.ctrl('delivery.method').value === 'post_office';
  }
  get postOfficeId(): string {
    return this.ctrl('delivery.details.postOfficeId').value || '';
  }
  get postOfficeLabel(): string {
    // najprv "notes" z widgetu, fallback na adresu, napokon ID
    const notes = this.ctrl('delivery.details.notes').value || '';
    if (notes) return notes;
    const street = this.ctrl('delivery.address.street').value || '';
    const city   = this.ctrl('delivery.address.city').value || '';
    const zip    = this.ctrl('delivery.address.zip').value || '';
    const addr = [street, city, zip].filter(Boolean).join(', ');
    return addr || `Pošta #${this.postOfficeId}`;
  }

  changePostOffice() {
    // znovu otvorí widget a prepíše hodnoty cez callback v openSlposta()
    this.openSlposta();
  }

  clearPostOffice() {
    // vynulovanie výberu
    const details = this.ctrl('delivery.details') as FormGroup;
    const address = this.ctrl('delivery.address') as FormGroup;
    details.patchValue({ postOfficeId: '', notes: '' }, { emitEvent: true });
    address.patchValue({ street: '', city: '', zip: '' }, { emitEvent: true });
  }
  // presmerovania na pickery (uprav si endpointy podľa BE)
  choosePostOffice() {
    const returnUrl = window.location.href;
    const url = `${environment.apiUrl}/integrations/post-office/select?return=${encodeURIComponent(returnUrl)}`;
    window.location.href = url;
  }

  choosePacketaBox() {
    // Priamo otvor widget (bez redirectu)
    this.openPacketa();

    // Ak by si chcel pôvodný redirect cez Strapi endpoint, nechávam pre istotu:
    // const returnUrl = window.location.href;
    // const url = `${environment.apiUrl}/integrations/packeta/select?return=${encodeURIComponent(returnUrl)}`;
    // window.location.href = url;
  }

  // copy helper (IBAN/BIC atď.)
  copy(text: string) {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      this.snack.open(this.translate.instant('COMMON.COPIED') || 'Copied', '', { duration: 2500 });
    });
  }

  // Submit: košík berieme priamo zo služby
  submitCheckout() {
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

    // ✱ newsletter: až keď je form OK a tesne pred volaním /checkout
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
    const customerData = {
      id: this._userId ?? 0,
      name: `${f.firstName} ${f.lastName}`,
      email: f.email,
      street: f.street,
      city: f.city,
      zip: f.zip,
      country: f.country
    };

    const isCourier = f.delivery.method === 'post_courier';
    const useDiff   = !!f.delivery.useDifferentAddress;
    // pomocné funkcie (môžeš dať hore do súboru)
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const normVat = (v: unknown) => {
      const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : 0);
      return isNaN(n) ? 0 : n;
    };

    const isEventItem = (i: CartRow) =>
      !!i.session && (i.session.type === 'tour' || i.session.type === 'workshop');

    const toIso = (v: any) => v ? new Date(v).toISOString() : null;

    const payload = {
      locale: (this.translate.currentLang || navigator.language || 'sk').slice(0,2),
      shippingFee: +this.shippingFee().toFixed(2),
      paymentFee: +this.paymentFee().toFixed(2),
      items: items.map(i => {
        const ratePct = normVat(i.vatPercentage);     // napr. 20
        const rate = ratePct / 100;                   // 0.20
        const unitGross = (i.inSale && typeof i.price_sale === 'number') ? i.price_sale! : i.price; // cena s DPH / ks
        const unitNet   = rate > 0 ? unitGross / (1 + rate) : unitGross; // cena bez DPH / ks
        const unitTax   = unitGross - unitNet;        // DPH / ks

        const lineNet   = unitNet * i.qty;            // suma bez DPH (riadok)
        const lineTax   = unitTax * i.qty;            // DPH (riadok)
        const lineGross = unitGross * i.qty;          // suma s DPH (riadok)

        return {
          productId: i.id,
          productName: i.name,
          quantity: i.qty,
          vatPercentage: ratePct,

          // pôvodné pole – ak ho backend očakáva, nechaj ho (je to jednotková cena s DPH)
          unitPrice: unitGross,

          // nové polia – ak nechceš, kľudne premenuj/odstráň
          unitNet:   round2(unitNet),
          unitTax:   round2(unitTax),
          unitGross: round2(unitGross),

          sumNet:    round2(lineNet),   // "suma bez dph"
          sumTax:    round2(lineTax),   // DPH spolu
          sumGross:  round2(lineGross), // "suma s dph"

          ...(isEventItem(i) ? {
            event: {
              sessionId: i.session!.id,                 // ID session / slotu
              type: i.session!.type,                    // 'tour' | 'workshop'
              startDateTime: toIso(i.session!.startDateTime), // ISO čas, na ktorý si zákazník objednal
              peopleCount: i.qty,                       // počet osôb = množstvo v košíku
              bookingId: i.bookingId ?? null            // ak máš (držiteľ rezervácie)
            }
          } : {})
        };
      }),
      customer: customerData,
      temporaryId: this.temporaryId,
      paymentMethod: f.paymentMethod as PaymentMethod,
      delivery: {
        method: f.delivery.method as DeliveryMethod,
        address: isCourier && !useDiff ? {
          street: f.street, city: f.city, zip: f.zip, country: f.country
        } : f.delivery.address,
        details: f.delivery.details
      }
    };

    this.http.post<any>(`${environment.apiUrl}/checkout`, payload).subscribe({
      next: (res) => {
        const formVal = this.checkoutForm.value as any;
        const payMethod = formVal.paymentMethod as PaymentMethod;

        const checkoutUrl: string | undefined = res?.checkoutUrl;

        /* =============== NE-KARTA =============== */
        if (payMethod !== 'card') {
          // 1) ak BE poslalo URL (napr. /checkout/success?order=123), rovno na ňu prejdi
          if (checkoutUrl) {
            const isStripe = typeof checkoutUrl === 'string' && checkoutUrl.includes('stripe.com');
            if (!isStripe) {
              window.location.href = checkoutUrl;
              return;
            }
          }
          // 2) fallback: ak BE neposlalo URL, ale poslalo orderId, prejdi lokálne
          const orderId = res?.orderId ?? res?.id ?? res?.order?.id ?? null;
          if (orderId) {
            this.router.navigate(['/checkout/success'], { queryParams: { order: orderId }});
            return;
          }

          // 3) žiadne z vyššieho – ukáž chybu a zruš spinner
          this.isSubmitting = false;
          this.submitBtnWidth = 0;
          //console.error('Missing checkoutUrl / orderId in /checkout response (non-card):', res);
          this.snack.open('Chýba odpoveď pre dokončenie objednávky.', '', { duration: 6000 });
          return;
        }

        /* =============== KARTA (Comgate) =============== */
        // pre kartu orderId potrebujeme (ak by neprišlo checkoutUrl z BE)
        const orderId = res?.orderId ?? res?.id ?? res?.order?.id ?? null;

        // BE by už mal posielať Comgate redirect v checkoutUrl – použi ho hneď
        if (checkoutUrl && !checkoutUrl.includes('stripe.com')) {
          window.location.href = checkoutUrl;
          return;
        }

        // Fallback: ak by checkoutUrl chýbalo, ešte skús starý 2-krokový flow /payments/create
        if (!orderId) {
          this.isSubmitting = false;
          this.submitBtnWidth = 0;
          console.error('Missing orderId in /checkout response (card):', res);
          this.snack.open(this.translate.instant('ESHOP.CHECKOUT_FAILED') || 'Checkout failed', '', { duration: 5000 });
          return;
        }

        // výpočet sumy v centoch (preferuj z BE, inak dopočítaj)
        let amountCents: number | null =
          typeof res?.totalWithShippingCents === 'number' ? res.totalWithShippingCents :
          (typeof res?.totalWithShipping === 'number' ? Math.round(res.totalWithShipping * 100) : null);

        if (amountCents == null) {
          const itemsTotal = (this.cart.items || []).reduce((sum, i) => {
            const unit = (i.inSale && typeof i.price_sale === 'number') ? i.price_sale! : i.price;
            return sum + unit * i.qty;
          }, 0);
          const grand = (itemsTotal || 0) + this.shippingFee() + this.paymentFee();
          amountCents = Math.round(grand * 100);
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
          next: r2 => { window.location.href = r2.paymentUrl; },
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
