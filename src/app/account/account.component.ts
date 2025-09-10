import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  Inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, forkJoin, of, Observable, firstValueFrom } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { LOCALE_ID } from '@angular/core';
import { LanguageService } from 'app/services/language.service';
import { ChangeDetectorRef } from '@angular/core';

import { keyframes, trigger, transition, style, animate } from '@angular/animations';

import { FooterComponent } from 'app/components/footer/footer.component';
import { AuthService, User } from '../services/auth.service';
import { FavoriteStateService } from '../services/favorite-state.service';
import { ProductsService, Product } from '../services/products.service';
import { UserFormComponent } from 'app/components/user-form/user-form.component';
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
    ]),
    trigger('favLeave', [
      transition(':leave', [
        animate('320ms ease', keyframes([
          style({ transform: 'scale(1)',    opacity: 1, offset: 0 }),
          style({ transform: 'scale(1.04)', opacity: 1, offset: 0.4 }),
          style({ transform: 'scale(0.8)',  opacity: 0, offset: 1 })
        ]))
      ])
    ])
  ],
})
export class AccountComponent implements OnInit, OnDestroy {
  user$: Observable<User | null>;
  /** Lokálny zoznam – hneď z neho odstraňujeme kvôli :leave animácii */
  favoriteProducts: Product[] = [];
  private firstFavLoadDone = false;

  favorites$: Observable<Product[]>;
  accountForm!: FormGroup;
  orders: Order[] = [];
  totalSpent = 0;
  ordersLoading = true;
  favoritesLoading = true;

  /** Rozbalené objednávky (kľúč ako string kvôli robustnosti) */
  expandedOrders = new Set<string>();

  private destroy$ = new Subject<void>();

  private t(key: string, params?: Record<string, any>) {
    return this.translate.instant(key, params);
  }

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
    @Inject(LOCALE_ID) public locale: string,
    private translate: TranslateService,
  ) {
    this.user$ = this.auth.currentUser$;
    this.favorites$ = of([] as Product[]); // placeholder, bude predefinované v ngOnInit
  }

  ngOnInit(): void {
    // 1) loadery
    this.ordersLoading = true;
    this.favoritesLoading = true;

    // 2) objednávky
    this.ordersService.getMyOrders().subscribe({
      next: result => {
        this.orders = result.orders;
        this.totalSpent = result.totalSpent;
        this.ordersLoading = false;
        this.cdRef.markForCheck();
      },
      error: err => {
        console.error('Chyba pri načítaní objednávok:', err);
        this.ordersLoading = false;
        this.cdRef.markForCheck();
      }
    });

    // 3) favorites – prvotné načítanie
    this.favState.loadFavorites();

    // 4) formulár
    this.accountForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      street: ['', Validators.required],
      city: ['', Validators.required],
      zip: ['', Validators.required],
      country: ['Slovensko', Validators.required]
    });

    // 5) patch user -> form
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
            country: user.country || 'Slovensko'
          });
        }
      });

    // 6) stream obľúbených -> lokálny zoznam (loader vypni len po prvom loade)
    this.favorites$ = this.favState.favorites$.pipe(
      map(favs => favs.filter(f => !!f.product).map(f => (f.product as { id: number }).id)),
      switchMap(ids => ids.length
        ? forkJoin(ids.map(id => this.productsService.getProductById(id)))
        : of([] as Product[])
      ),
      map(results => results.filter((p): p is Product => p !== null)),
      tap(list => {
        this.favoriteProducts = list;
        if (!this.firstFavLoadDone) {
          this.favoritesLoading = false;
          this.firstFavLoadDone = true;
        }
        this.cdRef.markForCheck();
      })
    );

    // 7) debug (nepovinné)
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

  /** Odstránenie jednej karty s :leave animáciou */
  removeFavorite(product: Product) {
    // 1) okamžite odhoď z lokálneho zoznamu -> spustí :leave animáciu
    this.favoriteProducts = this.favoriteProducts.filter(p => p.slug !== product.slug);
    this.cdRef.markForCheck();

    // 2) pošli požiadavku – služba už robí optimistic+rollback
    this.favState.toggle(product);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackBySlug(index: number, product: Product): string {
    return product.slug;
  }

  public onFavImageLoad(event: Event, src: string): void {
    // noop
  }

  public onFavImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/img/logo-SLM-modre.gif';
  }

  async saveAccount() {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      this.snackBar.open(this.t('ACCOUNT.FORM.REQUIRED_FIELDS'), this.t('COMMON.OK'), {
        duration: 4000,
        panelClass: ['snack-error']
      });
      return;
    }

    const user = await firstValueFrom(this.user$);
    if (!user) {
      this.snackBar.open(this.t('ACCOUNT.ERRORS.NOT_LOGGED_IN'), this.t('COMMON.OK'), {
        duration: 4000,
        panelClass: ['snack-error']
      });
      return;
    }

    const updated = this.accountForm.value;
    console.log('📤 PUT /users/' + user.id, updated);

    this.auth.updateProfile(user.id, updated).subscribe({
      next: () => {
        this.snackBar.open(this.t('ACCOUNT.SAVE.SUCCESS'), this.t('COMMON.OK'), {
          duration: 3000,
          panelClass: ['snack-success']
        });
      },
      error: () => {
        this.snackBar.open(this.t('ACCOUNT.SAVE.FAIL'), this.t('COMMON.OK'), {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  logout(): void {
    this.auth.logout();
    setTimeout(() => this.router.navigate(['/']), 500);
    this.snackBar.open(this.t('ACCOUNT.LOGOUT2.SUCCESS'), this.t('COMMON.OK'), {
      duration: 5000,
      panelClass: ['snack-info']
    });
  }

  /* ===== Toggle objednávok ===== */
  isExpanded(o: Order): boolean {
    return this.expandedOrders.has(String(o.id));
  }

  toggleOrder(o: Order): void {
    const key = String(o.id);
    const next = new Set(this.expandedOrders);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.expandedOrders = next; // nová referencia pre OnPush
    this.cdRef.markForCheck();
  }
}
