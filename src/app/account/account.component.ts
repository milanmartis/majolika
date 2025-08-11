import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, Inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, forkJoin, of, Observable, firstValueFrom } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { LOCALE_ID } from '@angular/core';
import { LanguageService } from 'app/services/language.service';
import { ChangeDetectorRef } from '@angular/core';

import { FooterComponent } from 'app/components/footer/footer.component';
import { AuthService, User } from '../services/auth.service';
import { FavoriteStateService } from '../services/favorite-state.service';
import { ProductsService, Product } from '../services/products.service';
import { UserFormComponent } from 'app/components/user-form/user-form.component';
import { trigger, transition, style, animate } from '@angular/animations';
import { OrdersService, Order } from 'app/services/orders.service';


@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    MatButtonModule,
    MatCardModule,
    MatSnackBarModule,
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
        animate('250ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ],
})
export class AccountComponent implements OnInit, OnDestroy {
  user$: Observable<User | null>;
  favorites$: Observable<Product[]>;
  accountForm!: FormGroup;
  orders: Order[] = [];
  totalSpent: number = 0; 
  ordersLoading = true;
  favoritesLoading = true;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private favState: FavoriteStateService,
    private productsService: ProductsService,
    private snackBar: MatSnackBar,
    private router: Router,
    private ordersService: OrdersService,
    public lang: LanguageService,  
    private cdRef: ChangeDetectorRef,
    @Inject(LOCALE_ID) public locale: string
    
  ) {
    this.user$ = this.auth.currentUser$;
    this.favorites$ = of([] as Product[]); // placeholder, bude predefinované v ngOnInit
  }

  ngOnInit(): void {
    // 1. Zapni oba loadery hneď na začiatku
    this.favoritesLoading = true;
    this.ordersLoading = true;

  this.ordersService.getMyOrders().subscribe({
    next: result => {
      console.log('Načítané objednávky:', result.orders);
      this.orders = result.orders;
      this.totalSpent = result.totalSpent;
      this.ordersLoading = false;
      this.cdRef.markForCheck();   // <- Pridaj TOTO!
    },
    error: err => {
      console.error('Chyba pri načítaní objednávok:', err);
      this.ordersLoading = false;
      this.cdRef.markForCheck();   // <- Pridaj TOTO!
    }
  });
  
    // 3. Načítanie obľúbených (favorites)
    this.favState.loadFavorites(); // Spustí obnovu zo storage alebo API
  
    // 4. Inicializácia formulára
    this.accountForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      street: ['', Validators.required],
      city: ['', Validators.required],
      zip: ['', Validators.required],
      country: ['Slovakia', Validators.required]
    });
  
    // 5. Patchni údaje používateľa do formulára, keď sa user objaví
    this.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (user) {
          this.accountForm.patchValue({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email,
            phone: user.phone || '',
            street: user.street || '',
            city: user.city || '',
            zip: user.zip || '',
            country: user.country || 'Slovakia'
          });
        }
      });
  
    // 6. Observable na favorites — loader rieš cez tap() na začiatku aj konci
    this.favorites$ = this.favState.favorites$.pipe(
      tap(() => {
        this.favoritesLoading = true;
        this.cdRef.markForCheck();
      }),
      map(favs =>
        favs
          .filter(f => !!f.product)
          .map(f => (f.product as { id: number }).id)
      ),
      switchMap(ids => {
        if (!ids.length) {
          this.favoritesLoading = false;
          this.cdRef.markForCheck();
          return of([] as Product[]);
        }
        const calls = ids.map(id => this.productsService.getProductById(id));
        return forkJoin(calls).pipe(
          tap(() => {
            this.favoritesLoading = false;
            this.cdRef.markForCheck();
          }),
          map(results => results.filter((p): p is Product => p !== null))
        );
      })
    );
  
    // 7. Debug výpis obľúbených (neovplyvňuje nič, môžeš ponechať)
    this.favorites$
      .pipe(
        takeUntil(this.destroy$),
        tap(favs => {
          console.log(
            'Favorites detailed:',
            favs.map(p => ({
              slug: p.slug,
              primaryImageUrl: p.primaryImageUrl,
              price: p.price
            }))
          );
        })
      )
      .subscribe();
  }
  


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackBySlug(index: number, product: Product): string {
    return product.slug;
  }

  public onFavImageLoad(event: Event, src: string): void {
    console.log('Obrázok načítaný:', src);
  }

  public onFavImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/img/logo-SLM-modre.gif';
  }

  async saveAccount() {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      this.snackBar.open('❌ Vyplňte všetky povinné údaje!', 'OK', {
        duration: 4000,
        panelClass: ['snack-error']
      });
      return;
    }

    const user = await firstValueFrom(this.user$);
    if (!user) {
      this.snackBar.open('❌ Nie ste prihlásený!', 'OK', {
        duration: 4000,
        panelClass: ['snack-error']
      });
      return;
    }

    const updated = this.accountForm.value;
    console.log('📤 PUT /users/' + user.id, updated);

    this.auth.updateProfile(user.id, updated).subscribe({
      next: newUser => {
        this.snackBar.open('✅ Údaje boli úspešne uložené.', 'OK', {
          duration: 3000,
          panelClass: ['snack-success']
        });
      },
      error: err => {
        this.snackBar.open('❌ Nepodarilo sa uložiť profil.', 'OK', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  logout(): void {
    this.auth.logout();
    setTimeout(() => this.router.navigate(['/']), 500);
    this.snackBar.open('✅ Boli ste odhlásený.', 'OK', {
      duration: 5000,
      panelClass: ['snack-info']
    });
  }

  removeFavorite(product: Product) {
    this.favState.toggle(product);
  }
}
