/* ===============================================================
 *  src/app/components/product-list/product-list.component.ts
 * =============================================================== */
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ParallaxImgDirective} from 'app/shared/parallax.directive';
import { CommonModule }    from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule }     from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CartService } from 'app/services/cart.service';
import { ProductDetailComponent } from './product-detail.component';
import { FavoriteStateService } from 'app/services/favorite-state.service';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from 'app/services/auth.service';
import {
  ProductsService,
  Product,
  Category,
  StrapiResp,
} from '../../services/products.service';

import { Subject, of } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';
import {
  debounceTime,
  switchMap,
  takeUntil,
  tap,
  catchError,
} from 'rxjs/operators';

/* ---------- pomocné typy -------------------------------------- */
interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}
interface FilterOption {
  slug: string;
  label: string;
}

/* ---------- komponent ----------------------------------------- */
@Component({
  selector: 'app-product-list',
  standalone: true,
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, MatIconModule ],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('250ms ease-out', style({ opacity: 1 })),
      ]),
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'none' })),
      ]),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductListComponent implements OnInit, OnDestroy {

  /* ---------- stav UI ----------------------------------------- */
  allCategories:   Category[] = [];
  rootCategories:  Category[] = [];
  childCategories: Category[] = [];
  @ViewChild(ProductDetailComponent) productDetail!: ProductDetailComponent;

  selectedCategory:         string | null = null;
  selectedRootCategorySlug: string | null = null;
  selectedCategorySlug:     string | null = null;
  selectedRootCategoryName?: string;                 // ➊ nový
  selectedRootCategoryText?: string;                 // ➊ nový

  selectedCategoryName?: string;
  selectedCategoryText?: string;

  sortOptions: SelectOption[] = [
    { value: 'name:asc',       label: 'ESHOP.SORT_NAME_ASC'   },
    { value: 'name:desc',      label: 'ESHOP.SORT_NAME_DESC'  },
    { value: 'price:asc',      label: 'ESHOP.SORT_PRICE_ASC'  },
    { value: 'price:desc',     label: 'ESHOP.SORT_PRICE_DESC' },
    { value: 'createdAt:desc', label: 'ESHOP.SORT_NEWEST'     },
  ];
  selectedSort = this.sortOptions[0].value;

  decorOptions: FilterOption[] = [
    { slug: 'habansky-dekor',      label: 'Habánsky dekór'     },
    { slug: 'farebny-dekor',     label: 'Farebný dekór'     },
    { slug: 'modry-dekor', label: 'Modrý dekór' },
    { slug: 'zeleny-dekor',      label: 'Zelený dekór'     },
  ];
  shapeOptions: FilterOption[] = [
    { slug: 'tanier',  label: 'Tanier'   },
    { slug: 'dzban',   label: 'Džbán'     },
    { slug: 'vaza', label: 'Váza' },
    { slug: 'pohar', label: 'Pohár' },
    { slug: 'miska', label: 'Miska' },
  ];
  selectedDecors: string[] = [];
  selectedShapes: string[] = [];
  
  private wantScrollTop = false;
  products: Product[] = [];
  paginatedProducts: Product[] = [];
  loadingMap: Record<string, boolean> = {};
  isLoading = false;
  error = false;
  loaded = false;
  favIds = new Set<number>();
  readonly pageSize = 20;
  currentPage = 1;
  totalPages = 1;
  totalCount = 0;
  pagesToDisplay: (number | -1)[] = [];

  /* ---------- private ----------------------------------------- */
  private destroyed$ = new Subject<void>();
  private refresh$   = new Subject<void>();

  constructor(
    private productsSrv: ProductsService,
    private cdr: ChangeDetectorRef,
    public route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private cart: CartService,
    private favState: FavoriteStateService,
    private snack: MatSnackBar,
    private translate: TranslateService,
    private auth: AuthService,



  ) {}

  isFav(p: Product): boolean {
    return this.favIds.has(Number(p.id));
  }

  addToFav(product: Product, btnEl?: HTMLButtonElement) {
  // guard – len pre prihlásených
  if (!this.auth.isLoggedIn()) {
    this.promptLogin();
    return;
  }

  const wasFav = this.favState.isFavorite(product.id);
  this.favState.toggle(product);

  if (btnEl) {
    btnEl.classList.remove('pop');
    void btnEl.offsetWidth;
    btnEl.classList.add('pop');
    setTimeout(() => btnEl.classList.remove('pop'), 400);
  }

  const msgKey = wasFav ? 'ESHOP.FAVORITE_REMOVED' : 'ESHOP.FAVORITE_ADDED';
  this.snack.open(
    this.translate.instant(msgKey),
    this.translate.instant('ESHOP.OK'),
    { duration: 3000 }
  );
}
  /* =============================================================
   *  Lifecycle
   * ============================================================= */

  transformHtml(raw: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  }

  promptLogin() {
    this.snack.open(
      this.translate.instant('ESHOP.LOGIN_TO_SAVE_FAV'), // napr. "Prihlás sa, aby si mohol ukladať obľúbené"
      this.translate.instant('ESHOP.LOGIN'),              // napr. "Prihlásiť"
      { duration: 4000 }
    ).onAction().subscribe(() => {
      this.router.navigate(
        ['/login'],
        { queryParams: { returnUrl: this.router.url } }
      );
    });
  }


  ngOnInit(): void {
    /* 1️⃣ – najprv pripoj odber na refresh$ */
     this.favState.favorites$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(favs => {
        this.favIds = new Set(
          favs
            .filter(f => f.product?.id != null)
            .map(f => Number(f.product!.id))
        );
        this.cdr.markForCheck();
      });



      this.refresh$
      .pipe(
        debounceTime(50),
        switchMap(() => this.fetchProducts()),
        takeUntil(this.destroyed$),)
      .subscribe({
        next: () => { this.loaded = true;  this.maybeScrollTop();   },
        error: () => { this.loaded = true;  this.maybeScrollTop();   }
      });
  
    /* 2️⃣ – až potom sleduj ?category= v URL */
    this.route.paramMap
      .pipe(takeUntil(this.destroyed$))
      .subscribe(pm => {
        const slug = pm.get('categorySlug');
        this.applySlugFromUrl(slug);
        this.currentPage = 1;
        this.wantScrollTop = true;
        this.triggerRefresh();
      });
  
    /* 3️⃣ – načítaj kategórie */
    this.loadCategories();
    this.scrollToTopSmooth();
  }

  ngOnDestroy(): void {
    this.destroyed$.next(); this.destroyed$.complete();
  }

  private scrollToTopSmooth(): void {
    // moderné prehliadače
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // fallback
      window.scrollTo(0, 0);
    }
  }
  private maybeScrollTop(): void {
    if (this.wantScrollTop) {
      this.wantScrollTop = false;
      requestAnimationFrame(() => this.scrollToTopSmooth());
    }
  }

  private scrollTopAfterNav(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), take(1))
      .subscribe(() => this.scrollToTopSmooth());
  }

  // private scrollTopAfterNav(): void {
  //   this.router.events
  //     .pipe(
  //       filter(e => e instanceof NavigationEnd),
  //       take(1)
  //     )
  //     .subscribe(() => this.scrollToTopSmooth());
  // }
  /* =============================================================
   *  Obrázky – metódy vyžadované šablónou
   * ============================================================= */
  onImageLoad(slug: string): void {
    this.loadingMap[slug] = false;
  }

  onImageError(slug: string): void {
    this.loadingMap[slug] = false;
    const p = this.products.find(x => x.slug === slug);
    if (p) { p.primaryImageUrl = '/assets/img/logo-SLM-modre.gif'; }
  }

  /* =============================================================
   *  URL → stav komponentu
   * ============================================================= */
  private applySlugFromUrl(slug: string | null): void {
    this.selectedCategory = slug;
  
    /* ak slug = null alebo ešte nemáme kategórie → počkáme */
    if (!slug || this.allCategories.length === 0) { return; }
  
    const cat = this.allCategories.find(c => c.category_slug === slug);
    if (!cat) { return; }
  
    /* -------- root alebo child ------------------------------- */
    if (!cat.parent) {
      // => root klik / URL
      this.selectedRootCategorySlug = cat.category_slug;
      this.selectedRootCategoryName = cat.category_name;   // ➋
      this.selectedRootCategoryText = cat.category_text;   // ➋
  
      this.childCategories = this.allCategories.filter(
        c => c.parent?.category_slug === cat.category_slug,
      );
    } else {
      // => child klik / URL
      this.selectedRootCategorySlug = cat.parent.category_slug;
  
      /* nájdeme parent objekt, aby sme mali aj názov + text rootu */
      const parent = this.allCategories.find(
        c => c.category_slug === this.selectedRootCategorySlug
      );
      if (parent) {
        this.selectedRootCategoryName = parent.category_name; // ➋
        this.selectedRootCategoryText = parent.category_text; // ➋
      }
  
      this.childCategories = this.allCategories.filter(
        c => c.parent?.category_slug === this.selectedRootCategorySlug,
      );
    }
  
    /* údaje o aktuálnej (root alebo child) */
    this.selectedCategoryName = cat.category_name;
    this.selectedCategoryText = cat.category_text;
    this.selectedCategorySlug = cat.category_slug;
  }
  /* =============================================================
   *  Handlery klikov
   * ============================================================= */
    private navigateBySlug(slug: string | null): void {
        if (slug) {
          this.router.navigate(['/produkt', 'kategoria', slug]);
        } else {
          this.router.navigate(['/produkt']);
        }
      }

  onCategorySelect(slug: string): void {
    if (slug === this.selectedCategory) { return; }
    this.isLoading = true; 
    this.applySlugFromUrl(slug);
    this.cdr.markForCheck(); 
    this.currentPage = 1;
    this.wantScrollTop = true;
    this.navigateBySlug(slug);
    this.triggerRefresh();
  }

  resetCategory(): void {
    this.isLoading = true; 
    this.cdr.markForCheck(); 
    if (
      this.selectedRootCategorySlug &&
      this.selectedCategory !== this.selectedRootCategorySlug
    ) {
      this.applySlugFromUrl(this.selectedRootCategorySlug);
      this.currentPage = 1;
      this.wantScrollTop = true;
      this.navigateBySlug(this.selectedRootCategorySlug);
      this.triggerRefresh();
      return;
    }

    this.selectedCategory =
    this.selectedRootCategorySlug =
    this.selectedCategorySlug = null;
    this.childCategories = [];
    this.selectedCategoryName =
    this.selectedCategoryText = undefined;
    this.currentPage = 1;
    this.wantScrollTop = true;
    this.navigateBySlug(null);
    this.triggerRefresh();
  }

  /* =============================================================
   *  Filtrovanie, triedenie, stránkovanie
   * ============================================================= */
onSortChange(s: string): void {
  this.selectedSort = s;
  this.currentPage = 1;
  this.triggerRefresh();
}
  onDecorToggle(slug: string, checked: boolean): void {
    this.toggleInArray(this.selectedDecors, slug, checked);
    this.currentPage = 1; this.triggerRefresh();
  }
  onShapeToggle(slug: string, checked: boolean): void {
    this.toggleInArray(this.selectedShapes, slug, checked);
    this.currentPage = 1; this.triggerRefresh();
  }
  clearAllDecorFilters(): void {
    this.selectedDecors = []; this.selectedShapes = [];
    this.currentPage = 1; this.triggerRefresh();
  }


  changePage(p: number): void {
  if (p === this.currentPage || p < 1 || p > this.totalPages) { return; }
  this.currentPage = p;
  this.wantScrollTop = true;     // <— pridaj toto
  this.triggerRefresh();
  // this.scrollTopAfterNav();    // <— toto zruš
}





  
  /* =============================================================
   *  HTTP volania
   * ============================================================= */
private fetchProducts() {
  this.isLoading = true;
  this.error = false;

  // a) vybraná kategória → zobraz produkty len ak je NAJHLBŠIA úroveň
  if (this.selectedCategory) {
    // Triedenie podľa ceny – potrebujeme všetky produkty, triedime/paginujeme na fronte
    if (this.selectedSort.startsWith('price:')) {
      return this.productsSrv
        .getAllProductsForCategoryDeepest(this.selectedCategory)
        .pipe(
          tap((all: Product[]) => {
            const sorted = this.sortByEffectivePrice(all, this.selectedSort);
            this.handleClientSorted(sorted);
          }),
          catchError(err => {
            console.error('❌ Načítanie produktov (deepest, price-sort) zlyhalo', err);
            this.error = true;
            this.handleClientSorted([]); // prázdny výsledok
            return of(null);
          }),
          tap(() => {
            this.isLoading = false;
            this.cdr.markForCheck();
          })
        );
    }

    // Ostatné sorty (napr. name:asc/desc) – nechaj na backende (server-side stránkovanie)
    return this.productsSrv
      .getProductsByCategorySlug(
        this.selectedCategory,
        this.selectedSort,
        this.currentPage,
        this.pageSize
      )
      .pipe(
        tap((resp: StrapiResp<Product>) => this.handleResponse(resp)),
        catchError(err => {
          console.error('❌ Načítanie produktov (deepest, name-sort) zlyhalo', err);
          this.error = true;
          this.handleResponse(null);
          return of(null);
        }),
        tap(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      );
  }

  // b) ROOT VIEW – neťahaj produkty, zobraz len root kategórie
  this.products = [];
  this.paginatedProducts = [];
  this.totalPages = 1;
  this.totalCount = 0;
  this.loadingMap = {};
  this.isLoading = false;
  this.cdr.markForCheck();
 this.wantScrollTop = true;
  // this.scrollTopAfterNav();


  return of(null);
}


  private effectivePrice(p: Product): number {
    const pick = (q: Product): number | null => {
      if (q.inSale && q.price_sale != null) return q.price_sale!;
      return q.price ?? null;
    };

    // 1) preferujeme cenu na parentovi (ak ju má)
    const parentPrice = pick(p);
    if (parentPrice != null) return parentPrice;

    // 2) inak prvú variáciu, ktorá má cenu (alebo sale cenu s inSale)
    const v = (p.variations ?? []).find(vv =>
      (vv.inSale && vv.price_sale != null) || (vv.price != null)
    );
    const vPrice = v ? pick(v) : null;

    return vPrice ?? Number.POSITIVE_INFINITY; // produkty bez ceny na koniec
  }

  private sortByEffectivePrice(list: Product[], order: string): Product[] {
    const asc = order.endsWith(':asc');
    return [...list].sort((a, b) => {
      const pa = this.effectivePrice(a);
      const pb = this.effectivePrice(b);
      if (pa === pb) return (a.name || '').localeCompare(b.name || '');
      return asc ? pa - pb : pb - pa;
    });
  }

  private handleClientSorted(list: Product[]): void {
    this.totalCount = list.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
    const start = (this.currentPage - 1) * this.pageSize;
    const end   = start + this.pageSize;

    this.products          = list.slice(start, end);
    this.paginatedProducts = this.products;
    this.loadingMap        = Object.fromEntries(this.products.map(p => [p.slug, true]));

    this.buildPagination();
    this.cdr.markForCheck();
  }


  private handleResponse(resp: StrapiResp<Product> | null): void {
    if (!resp) { return; }
  
    const meta = resp.meta.pagination;
    this.products          = resp.data;
    this.paginatedProducts = resp.data;
    this.totalPages        = meta.pageCount || 1;
    this.totalCount        = meta.total;
    this.loadingMap        = Object.fromEntries(resp.data.map(p => [p.slug, true]));
    this.buildPagination();
    this.cdr.markForCheck();
  }

  private triggerRefresh(): void { this.refresh$.next(); }

  /* =============================================================
   *  Kategórie
   * ============================================================= */

  get showCategoryGrid(): boolean {
      // panel kategórií zobraz len keď nie je chyba, neloaduje sa a nie sú produkty
      return !this.isLoading && !this.error && this.products.length === 0;
  }
  
  private loadCategories(): void {
    this.productsSrv.getAllCategoriesFlat()
      .pipe(
        takeUntil(this.destroyed$),
        catchError(err => {
          console.error('Nepodarilo sa načítať kategórie', err);
          return of([] as Category[]);
        }),
      )
      .subscribe(cats => {
        this.allCategories  = cats;
        this.rootCategories = cats.filter(c => !c.parent);

        if (this.selectedCategory) { this.applySlugFromUrl(this.selectedCategory); }
        this.cdr.markForCheck();
      });
  }

  private resolveSelectedCategoryMeta(): void {
    if (!this.selectedCategory) { return; }
    const sel = this.allCategories.find(c => c.category_slug === this.selectedCategory);
    if (sel) {
      this.selectedCategoryName  = sel.category_name;
      this.selectedCategoryText  = sel.category_text;
      this.selectedCategorySlug  = sel.category_slug;
    }
  }

  /* =============================================================
   *  Pomocníci
   * ============================================================= */
  getDecorFromName(n?: string): string | null {
    if (!n) { return null; }
    const m = n.match(/\s*-\s*([^\-]+)$/); return m ? m[1].trim() : null;
  }
  getWithoutDecorFromName(n?: string): string {
    if (!n) { return ''; }
    const d = this.getDecorFromName(n);
    return d ? n.replace(new RegExp(`\\s*-\\s*${d}$`), '').trim() : n;
  }

  private toggleInArray(arr: string[], slug: string, checked: boolean): void {
    const i = arr.indexOf(slug);
    if (checked && i === -1) arr.push(slug);
    if (!checked && i > -1)  arr.splice(i, 1);
  }

  private buildPagination(): void {
    const p: (number | -1)[] = [], t = this.totalPages;
    p.push(1);
    const from = Math.max(2, this.currentPage - 1);
    const to   = Math.min(t - 1, this.currentPage + 1);

    if (from > 2) p.push(-1);
    for (let i = from; i <= to; i++) p.push(i);
    if (to < t - 1) p.push(-1);
    if (t > 1) p.push(t);

    this.pagesToDisplay = p;
  }


    addProductToCart(p: Product): void {
    const variation = p.variations?.[0] ?? null;
  
    const variationImg = variation?.primaryImageUrl || '';
    const mainImg = p.primaryImageUrl || '';
    const imgToUse = variationImg || mainImg;
  
    this.cart.add(
      {
        id: variation?.id ?? p.id,
        name: variation?.name ?? p.name,
        slug: variation?.slug ?? p.slug,
        price: variation?.price ?? p.price ?? 0,
        price_sale: variation?.price_sale ?? p.price_sale ?? undefined,
        inSale: variation?.inSale ?? p.inSale ?? false,
        img: imgToUse
      },
      1 // množstvo
    );
  }
}
