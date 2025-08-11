import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { CartService, CartRow } from 'app/services/cart.service';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { AuthService, User } from 'app/services/auth.service';
import { FooterComponent } from 'app/components/footer/footer.component';
import { UserFormComponent } from 'app/components/user-form/user-form.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';


@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    TranslateModule,
    FooterComponent,
    UserFormComponent
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  cartItems$: Observable<CartRow[]>;
  total$: Observable<number>;
  isSubmitting = false;
  // temporaryId = '';

  get userId(): number | null {
    return this._userId;
  }
  private _userId: number | null = null;

  private temporaryId = localStorage.getItem('lastBookingTmpId'); // použije sa ten istý!

  checkoutForm!: FormGroup;

  constructor(
    private cart: CartService,
    private fb: FormBuilder,
    private http: HttpClient,
    private auth: AuthService,
    private snack: MatSnackBar,
    private translate: TranslateService
  ) {
    this.cartItems$ = this.cart.cart$;
    this.total$ = this.cart.total$;

    this.checkoutForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      street: ['', Validators.required],
      city: ['', Validators.required],
      zip: ['', Validators.required],
      country: ['Slovensko', Validators.required]
    });
  }

  ngOnInit(): void {
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
  }

  async submitCheckout(items: CartRow[]) {
    console.log('submitCheckout called with items', items);
  
    if (this.checkoutForm.invalid) {
      console.log('form invalid', this.checkoutForm.errors, this.checkoutForm.value);
      this.checkoutForm.markAllAsTouched();
  
      // Príklad s prekladom
      this.translate.get('ESHOP.CHECKOUT_FORM_INVALID').subscribe(msg => {
        this.snack.open(msg, '', {
          duration: 6000,
          panelClass: 'my-snackbar-error',
          verticalPosition: 'bottom',
          horizontalPosition: 'center'
        });
      });
      return;
    }
  
    this.isSubmitting = true;

    const customerData = {
      id: this._userId ?? 0, // Ak nie je prihlásený, backend to vyrieši
      name: `${this.checkoutForm.value.firstName} ${this.checkoutForm.value.lastName}`,
      email: this.checkoutForm.value.email,
      street: this.checkoutForm.value.street,
      city: this.checkoutForm.value.city,
      zip: this.checkoutForm.value.zip,
      country: this.checkoutForm.value.country
    };

    const payload = {
      items: items.map(i => {
        const unitPrice =
          i.inSale && typeof i.price_sale === 'number'
            ? i.price_sale
            : i.price;
        return {
          productId: i.id,
          productName: i.name,
          quantity: i.qty,
          unitPrice  // <-- PRIDAJ!
        };
      }),
      customer: customerData,
      temporaryId: this.temporaryId
    };

    this.http.post<{ checkoutUrl: string }>(
      `${environment.apiUrl}/checkout`,
      payload
    ).subscribe({
      next: res => {
        console.log('Stripe checkout URL:', res.checkoutUrl);
        console.log('Submitting checkout payload:', payload);

        window.location.href = res.checkoutUrl; // ✅ Redirect na Stripe
      },
      error: err => {
        console.error('Checkout failed', err);
        this.isSubmitting = false;
      }
    });
  }
}
