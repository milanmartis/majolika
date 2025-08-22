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

import { CommonModule }    from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule }     from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CartService } from 'app/services/cart.service';
import { ProductDetailComponent } from './product-detail.component';
import { FavoriteStateService } from 'app/services/favorite-state.service';
import { MatIconModule } from '@angular/material/icon';

import {
  ProductsService,
  Product,
  Category,
  StrapiResp,
} from '../../services/products.service';

import { Subject, of } from 'rxjs';
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
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, MatIconModule   ],
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


  ) {}

  isFav(p: Product): boolean {
    return this.favIds.has(Number(p.id));
  }

  addToFav(product: Product) {
    const wasFav = this.favState.isFavorite(product.id);
    this.favState.toggle(product);
  
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
        next: () => { this.loaded = true; },
        error: () => { this.loaded = true; }
      });
  
    /* 2️⃣ – až potom sleduj ?category= v URL */
    this.route.paramMap
      .pipe(takeUntil(this.destroyed$))
      .subscribe(pm => {
        const slug = pm.get('categorySlug');
        this.applySlugFromUrl(slug);
        this.currentPage = 1;
        this.triggerRefresh();
      });
  
    /* 3️⃣ – načítaj kategórie */
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroyed$.next(); this.destroyed$.complete();
  }



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
          this.router.navigate(['/eshop', 'categories', slug]);
        } else {
          this.router.navigate(['/eshop']);
        }
      }

  onCategorySelect(slug: string): void {
    if (slug === this.selectedCategory) { return; }
    this.isLoading = true; 
    this.applySlugFromUrl(slug);
    this.currentPage = 1;
    this.navigateBySlug(slug);
    this.triggerRefresh();
  }

  resetCategory(): void {
    this.isLoading = true; 
    if (
      this.selectedRootCategorySlug &&
      this.selectedCategory !== this.selectedRootCategorySlug
    ) {
      this.applySlugFromUrl(this.selectedRootCategorySlug);
      this.currentPage = 1;
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
    this.navigateBySlug(null);
    this.triggerRefresh();
  }

  /* =============================================================
   *  Filtrovanie, triedenie, stránkovanie
   * ============================================================= */
  onSortChange(s: string): void { this.selectedSort = s; this.triggerRefresh(); }

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
    this.currentPage = p; this.triggerRefresh();
  }





  
  /* =============================================================
   *  HTTP volania
   * ============================================================= */
  private fetchProducts() {
    this.isLoading = true;
    this.error = false;
  
    return this.productsSrv.getFilteredProducts(
      this.currentPage,
      this.pageSize,
      this.selectedSort,
      this.selectedCategory,
      this.selectedDecors,
      this.selectedShapes
    ).pipe(
      tap((resp: StrapiResp<Product>) => this.handleResponse(resp)),
      catchError(err => {
        console.error('❌ Nepodarilo sa načítať produkty', err);
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
