import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // ✅ pridáme snackbar

import { map, firstValueFrom, Observable } from 'rxjs';

import { FooterComponent } from 'app/components/footer/footer.component';
import { AuthService, User } from '../services/auth.service';
import { FavoriteStateService } from '../services/favorite-state.service';
import { ProductsService, Product } from '../services/products.service';
import { UserFormComponent } from 'app/components/user-form/user-form.component';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    MatButtonModule,
    MatCardModule,
    MatSnackBarModule, // ✅ snackbar modul
    FooterComponent,
    UserFormComponent,
    ReactiveFormsModule
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('250ms ease-out', style({ opacity: 1 })),
      ]),
    ]),
  ],
})
export class AccountComponent implements OnInit {
  user$: Observable<User | null>;
  favorites$: Observable<Product[]>;

  accountForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private translate: TranslateService,
    private favState: FavoriteStateService,
    private snackBar: MatSnackBar // ✅ snackbar service
  ) {
    this.user$ = this.auth.currentUser$;

    this.favorites$ = this.favState.favorites$.pipe(
      map(favs => favs.filter(f => !!f.product).map(f => f.product as Product))
    );
  }

  ngOnInit(): void {
    this.accountForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      // address: this.fb.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        zip: ['', Validators.required],
        country: ['Slovakia', Validators.required]
      // })
    });

    // ✅ predvyplníme údaje z user$
    this.user$.subscribe(user => {
      if (user) {
        this.accountForm.patchValue({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email,
          phone: user.phone || '',
          // address: {
            street: user.street || '',
            city: user.city || '',
            zip: user.zip || '',
            country: user.country || 'Slovakia'
          // }
        });
      }
    });
  }

  async saveAccount() {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();

      // ✅ zobrazíme snackbar ak je formulár neplatný
      this.snackBar.open(
        '❌ Vyplňte všetky povinné údaje!',
        'OK',
        { duration: 4000, panelClass: ['snack-error'] }
      );
      return;
    }

    const user = await firstValueFrom(this.user$);
    if (!user) {
      this.snackBar.open(
        '❌ Nie ste prihlásený!',
        'OK',
        { duration: 4000, panelClass: ['snack-error'] }
      );
      return;
    }

    const updated = this.accountForm.value;

    console.log('📤 PUT /users/' + user.id, updated);

    this.auth.updateProfile(user.id, updated).subscribe({
      next: (newUser) => {
        console.log('✅ Profil bol uložený', newUser);
        this.snackBar.open(
          '✅ Údaje boli úspešne uložené.',
          'OK',
          { duration: 3000, panelClass: ['snack-success'] }
        );
      },
      error: (err) => {
        console.error('❌ Chyba pri ukladaní profilu', err);
        this.snackBar.open(
          '❌ Nepodarilo sa uložiť profil.',
          'OK',
          { duration: 4000, panelClass: ['snack-error'] }
        );
      }
    });
  }

  logout(): void {
    this.auth.logout();
    this.snackBar.open('✅ Boli ste odhlásený.', 'OK', {
      duration: 3000,
      panelClass: ['snack-info']
    });
  }

  removeFavorite(product: Product) {
    this.favState.toggle(product);
  }
}
