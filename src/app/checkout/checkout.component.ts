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

  /** Checkout form je teraz typu FormGroup a vytvorí sa v konštruktore */
  checkoutForm!: FormGroup;

  constructor(
    private cart: CartService,
    private fb: FormBuilder,
    private http: HttpClient,
    private auth: AuthService
  ) {
    this.cartItems$ = this.cart.cart$;
    this.total$ = this.cart.total$;

    // ✅ Vytvoríme formulár až v konštruktore, kde je `fb` už inicializovaný
    this.checkoutForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
    //   address: this.fb.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        zip: ['', Validators.required],
        country: ['Slovensko', Validators.required]
    //   })
    });
  }

  ngOnInit(): void {
    // ✅ predvyplníme údaje, ak je user prihlásený
    this.auth.currentUser$.subscribe((user: User | null) => {
      if (user) {
        this.checkoutForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
        //   address: {
            street: user.street ?? '',
            city: user.city ?? '',
            zip: user.zip ?? '',
            country: user.country ?? 'Slovensko'
        //   }
        });
      }
    });
  }

  async submitCheckout(items: CartRow[]) {
    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    const customerData = {
      firstName: this.checkoutForm.value.firstName!,
      lastName: this.checkoutForm.value.lastName!,
      email: this.checkoutForm.value.email!,
      phone: this.checkoutForm.value.phone!,
      street: this.checkoutForm.value.street,
      city: this.checkoutForm.value.city,
      zip: this.checkoutForm.value.zip,
      country: this.checkoutForm.value.country
    };

    const payload = {
      items: items.map(i => ({
        productId: i.id,
        quantity: i.qty
      })),
      customer: customerData
    };

    this.http.post<{ checkoutUrl: string }>(
      `${environment.apiUrl}/checkout`,
      payload
    ).subscribe({
      next: res => {
        window.location.href = res.checkoutUrl;
      },
      error: err => {
        console.error('Checkout failed', err);
        this.isSubmitting = false;
      }
    });
  }
}
