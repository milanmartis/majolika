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

type PaymentMethod = 'card' | 'cod' | 'bank' | 'onsite' | 'post';
type DeliveryMethod = 'pickup' | 'post_office' | 'packeta_box' | 'post_courier';

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
  onsite: 1.0, // na mieste
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
    MatProgressSpinnerModule
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
    private translate: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.cartItems$ = this.cart.cart$;
    this.total$ = this.cart.total$;

    this.checkoutForm = this.fb.group({
      // ĽAVÝ box – zákazník
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      street: ['', Validators.required],
      city: ['', Validators.required],
      zip: ['', Validators.required],
      country: ['Slovensko', Validators.required],

      // PRAVÝ box – platba + doručenie
      paymentMethod: ['card' as PaymentMethod, Validators.required],
      delivery: this.fb.group({
        method: ['pickup' as DeliveryMethod, Validators.required],
        useDifferentAddress: [false], // len pre kuriéra
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
    });
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

  ngOnInit(): void {
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
    });

    // zmena doručenia → validácie + prepočet shipping
    deliveryGroup.get('method')!.valueChanges.subscribe((m: DeliveryMethod) => {
      this.selectedDeliveryMethod.set(m);
      this.applyCourierAddressMode();
      this.applyPerMethodValidators(m, address, details);
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

    // Načítaj widget (ak ešte nie je) – a priprav Promise na istotu
    this.loadPacketaScript();
    this.ensurePacketaReady();
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

    const payload = {
      items: items.map(i => ({
        productId: i.id,
        productName: i.name,
        quantity: i.qty,
        unitPrice: (i.inSale && typeof i.price_sale === 'number') ? i.price_sale : i.price
      })),
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

    this.http.post<{ checkoutUrl: string }>(
      `${environment.apiUrl}/checkout`,
      payload
    ).subscribe({
      next: res => window.location.href = res.checkoutUrl,
      error: err => {
        console.error('Checkout failed', err);
        this.isSubmitting = false;
        this.submitBtnWidth = 0;
        this.snack.open(this.translate.instant('ESHOP.CHECKOUT_FAILED') || 'Checkout failed', '', { duration: 5000 });
      }
    });
  }
}
