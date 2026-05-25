/* ===============================================================
 *  src/app/components/product-list/product-list.component.ts
 * =============================================================== */
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
  ViewChild,
  Inject,
} from '@angular/core';

import { DomSanitizer, SafeHtml, Meta, Title } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatIconModule } from '@angular/material/icon';

import { CartService } from 'app/services/cart.service';
import { ProductDetailComponent } from './product-detail.component';
import { FavoriteStateService } from 'app/services/favorite-state.service';
import { AuthService } from 'app/services/auth.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { VariationSelectDialogComponent } from './variation-select-dialog.component';
import {
  ProductsService,
  Product,
  Category,
  StrapiResp,
} from '../../services/products.service';

import { Subject, of } from 'rxjs';
import {
  filter,
  take,
  debounceTime,
  switchMap,
  takeUntil,
  tap,
  catchError,
  map,
  distinctUntilChanged,
  finalize,
} from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, MatIconModule, MatDialogModule],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [style({ opacity: 0 }), animate('250ms ease-out', style({ opacity: 1 }))]),
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

  // --- scroll internals ---
  private _scrollRaf: number | null = null;
  private _scrollTimeout: any = null;

  /* ---------- stav UI ----------------------------------------- */
  allCategories: Category[] = [];
  rootCategories: Category[] = [];
  childCategories: Category[] = [];
  @ViewChild(ProductDetailComponent) productDetail!: ProductDetailComponent;
  isContentLoading = true;
  selectedCategory: string | null = null;
  selectedRootCategorySlug: string | null = null;
  selectedCategorySlug: string | null = null;

  // tieto už držíme ako "display" podľa jazyka
  selectedRootCategoryName?: string;
  selectedCategoryName?: string;

  currentCategoryText = '';
  bannerLoading = true;
  categoryImgLoadingMap: Record<string, boolean> = {};

  sortOptions: SelectOption[] = [
    { value: 'name:asc', label: 'ESHOP.SORT_NAME_ASC' },
    { value: 'name:desc', label: 'ESHOP.SORT_NAME_DESC' },
    { value: 'price:asc', label: 'ESHOP.SORT_PRICE_ASC' },
    { value: 'price:desc', label: 'ESHOP.SORT_PRICE_DESC' },
    { value: 'createdAt:desc', label: 'ESHOP.SORT_NEWEST' },
  ];
  selectedSort = this.sortOptions[0].value;

  decorOptions: FilterOption[] = [
    { slug: 'habansky-dekor', label: 'Habánsky dekór' },
    { slug: 'farebny-dekor', label: 'Farebný dekór' },
    { slug: 'modry-dekor', label: 'Modrý dekór' },
    { slug: 'zeleny-dekor', label: 'Zelený dekór' },
  ];
  shapeOptions: FilterOption[] = [
    { slug: 'tanier', label: 'Tanier' },
    { slug: 'dzban', label: 'Džbán' },
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
  private refresh$ = new Subject<void>();

  constructor(
    private productsSrv: ProductsService,
    private cdr: ChangeDetectorRef,
    public route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private cart: CartService,
    private favState: FavoriteStateService,
    private snack: MatSnackBar,
    public translate: TranslateService,
    private auth: AuthService,
    private dialog: MatDialog,
    private meta: Meta,
    private titleSvc: Title,
    @Inject(DOCUMENT) private doc: Document,
  ) {}

  /* ---------- trackBy ----------------------------------------- */
  trackBySlug = (_: number, p: Product) => p.slug;
  trackByCat = (_: number, c: Category) => c.category_slug;

  /* =============================================================
   *  I18N pomocníci pre Category (Strapi fields *_en/_de)
   * ============================================================= */
  private get lang(): 'sk' | 'en' | 'de' {
    const l = (this.translate.currentLang || 'sk').toLowerCase();
    return (l === 'en' || l === 'de') ? (l as any) : 'sk';
  }

  getCatBySlug(slug: string | null | undefined): Category | undefined {
    if (!slug) return undefined;
    return this.allCategories.find(c => c.category_slug === slug);
  }

  catLabel(c: Category | undefined | null): string {
    if (!c) return '';
    const l = this.lang;
    if (l === 'en') return c.category_name_en || c.category_name;
    if (l === 'de') return c.category_name_de || c.category_name;
    return c.category_name;
  }

  catText(c: Category | undefined | null): string {
    if (!c) return '';
    const l = this.lang;
    if (l === 'en') return c.category_text_en || c.category_text || '';
    if (l === 'de') return c.category_text_de || c.category_text || '';
    return c.category_text || '';
  }

  /* ---------- helper computed --------------------------------- */
  get selectedRootCategory(): Category | undefined {
    return this.getCatBySlug(this.selectedRootCategorySlug);
  }

  get selectedCategoryObj(): Category | undefined {
    return this.getCatBySlug(this.selectedCategorySlug);
  }

  /* ---------- favorites ---------------------------------------- */
  isFav(p: Product): boolean {
    return this.favIds.has(Number(p.id));
  }

  addToFav(product: Product, btnEl?: HTMLButtonElement) {
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
    this.snack.open(this.translate.instant(msgKey), this.translate.instant('ESHOP.OK'), {
      duration: 3000,
    });
  }

  /* =============================================================
   *  Lifecycle
   * ============================================================= */
  transformHtml(raw: string): string {
    return raw ?? '';
  }
  private get isBrowser(): boolean { return typeof window !== 'undefined'; }

  promptLogin() {
    this.snack
      .open(this.translate.instant('ESHOP.LOGIN_TO_SAVE_FAV'), this.translate.instant('ESHOP.LOGIN'), {
        duration: 4000,
      })
      .onAction()
      .subscribe(() => {
        this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      });
  }

  ngOnInit(): void {
    this.scrollToTopSmooth();
    this.isContentLoading = true;

    // 0) zmena jazyka → prepočítaj text, názvy, SEO
    this.translate.onLangChange.pipe(takeUntil(this.destroyed$)).subscribe(() => {
      // prepočítaj display names podľa jazyka
      if (this.selectedRootCategorySlug) {
        const root = this.getCatBySlug(this.selectedRootCategorySlug);
        this.selectedRootCategoryName = this.catLabel(root);
      }
      if (this.selectedCategorySlug) {
        const cur = this.getCatBySlug(this.selectedCategorySlug);
        this.selectedCategoryName = this.catLabel(cur);
      }
      this.updateCategoryText();
    });

    // 1) obľúbené
    this.favState.favorites$.pipe(takeUntil(this.destroyed$)).subscribe((favs) => {
      this.favIds = new Set(
        favs.filter((f) => f.product?.id != null).map((f) => Number(f.product!.id))
      );
      this.cdr.markForCheck();
    });

    // 2) refresh spúšťa fetch
    this.refresh$
      .pipe(debounceTime(50), switchMap(() => this.fetchProducts()), takeUntil(this.destroyed$))
      .subscribe({
        next: () => {
          this.loaded = true;
        },
        error: () => {
          this.loaded = true;
        },
      });

    // 3) sleduj zmenu parametra v URL, ale len keď sa reálne zmení
    this.route.paramMap
      .pipe(
        map((pm) => pm.get('categorySlug')),
        distinctUntilChanged(),
        takeUntil(this.destroyed$)
      )
      .subscribe((slug) => {
        this.applySlugFromUrl(slug);
        this.currentPage = 1;
        this.wantScrollTop = true;
        this.triggerRefresh();
      });

    // 4) načítaj kategórie
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /* -------- category text + SEO ------------------------------------- */
  private updateCategoryText() {
    // preferuj aktuálnu (child/root) kategóriu, fallback na root
    const selected = this.getCatBySlug(this.selectedCategorySlug);
    const root = this.getCatBySlug(this.selectedRootCategorySlug);

    const src = selected ?? root;
    this.currentCategoryText = this.catText(src);

    this.cdr.markForCheck();
    this.setCategorySeo();
  }

  /* -------- scroll helpers ------------------------------------ */
  private scrollToTopSmooth(): void {
    if (!this.isBrowser) return;

    // zruš predchádzajúce rozbehnuté scrolly
    if (this._scrollRaf != null) {
      cancelAnimationFrame(this._scrollRaf);
      this._scrollRaf = null;
    }
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout);
      this._scrollTimeout = null;
    }

    const prefersNoMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const instantJump = () => {
      try {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch {
        // ignore
      }
    };

    const smoothTry = () => {
      try {
        if (!prefersNoMotion) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          instantJump();
        }
      } catch {
        instantJump();
      }
    };

    // 1) okamžitý skok hneď
    instantJump();

    // 2) dvojitý rAF a potom smooth
    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollRaf = requestAnimationFrame(() => {
        smoothTry();

        // 3) poistka – dotlač na vrch pár krát
        let tries = 0;
        const maxTries = 10;
        const tick = () => {
          const y =
            window.scrollY ||
            document.documentElement.scrollTop ||
            document.body.scrollTop ||
            0;

          if (y > 0 && tries < maxTries) {
            tries += 1;
            instantJump();
            this._scrollRaf = requestAnimationFrame(tick);
          }
        };
        this._scrollRaf = requestAnimationFrame(tick);
      });
    });

    // 4) bezpečnostný dotyk po ~700 ms
    this._scrollTimeout = setTimeout(() => instantJump(), 700);
  }

  private maybeScrollTop(): void {
    if (this.wantScrollTop) {
      this.wantScrollTop = false;
      requestAnimationFrame(() => this.scrollToTopSmooth());
    }
  }

  private scrollTopAfterNav(): void {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), take(1)).subscribe(() => this.scrollToTopSmooth());
  }

  /* =============================================================
   *  Obrázky – metódy vyžadované šablónou
   * ============================================================= */
  onImageLoad(slug: string): void {
    this.loadingMap[slug] = false;
    this.cdr.markForCheck();
  }

  onImageError(slug: string): void {
    this.loadingMap[slug] = false;
    const p = this.products.find((x) => x.slug === slug);
    if (p) {
      p.primaryImageUrl = '/assets/img/logo-SLM-modre.gif';
    }
    this.cdr.markForCheck();
  }

  /** vracia všetky podkategórie daného root slugu:
   *  - kanonické: c.parent?.category_slug === rootSlug
   *  - extra: c.extra_parents_slugs obsahuje rootSlug
   */
  private getChildrenForRoot(rootSlug: string): Category[] {
    return this.allCategories.filter(c =>
      c.parent?.category_slug === rootSlug ||
      (c.extra_parents_slugs?.includes(rootSlug) ?? false)
    );
  }

  /* =============================================================
   *  URL → stav komponentu
   * ============================================================= */
  private applySlugFromUrl(slug: string | null): void {
    this.selectedCategory = slug;

    // reset display hodnoty
    this.selectedRootCategorySlug = null;
    this.selectedCategorySlug = null;
    this.selectedRootCategoryName = undefined;
    this.selectedCategoryName = undefined;
    this.childCategories = [];

    if (!slug || this.allCategories.length === 0) {
      this.updateCategoryText();
      return;
    }

    const cat = this.getCatBySlug(slug);
    if (!cat) {
      this.updateCategoryText();
      return;
    }

    if (!cat.parent) {
      // root
      this.selectedRootCategorySlug = cat.category_slug;
      this.selectedRootCategoryName = this.catLabel(cat);

      this.selectedCategorySlug = cat.category_slug;
      this.selectedCategoryName = this.catLabel(cat);

      this.childCategories = this.getChildrenForRoot(cat.category_slug);
    } else {
      // child
      this.selectedRootCategorySlug = cat.parent.category_slug;

      const parent = this.getCatBySlug(this.selectedRootCategorySlug);
      if (parent) {
        this.selectedRootCategoryName = this.catLabel(parent);
      }

      this.selectedCategorySlug = cat.category_slug;
      this.selectedCategoryName = this.catLabel(cat);

      this.childCategories = this.getChildrenForRoot(this.selectedRootCategorySlug);
    }

    this.updateCategoryText();
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
    if (slug === this.selectedCategory) {
      return;
    }
    this.isLoading = true;
    this.cdr.markForCheck();
    this.currentPage = 1;
    this.wantScrollTop = true;
    this.navigateBySlug(slug);
    this.scrollToTopSmooth();
  }

  resetCategory(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.currentPage = 1;
    this.wantScrollTop = true;

    if (this.selectedRootCategorySlug && this.selectedCategory !== this.selectedRootCategorySlug) {
      this.navigateBySlug(this.selectedRootCategorySlug);
      return;
    }

    this.navigateBySlug(null);
  }

  /* =============================================================
   *  Filtrovanie, triedenie, stránkovanie
   * ============================================================= */
  onSortChange(s: string): void {
    this.selectedSort = s;
    this.currentPage = 1;
    if (!this.selectedCategory) return;
    this.triggerRefresh();
  }

  onDecorToggle(slug: string, checked: boolean): void {
    this.toggleInArray(this.selectedDecors, slug, checked);
    this.currentPage = 1;
    if (!this.selectedCategory) return;
    this.triggerRefresh();
  }

  onShapeToggle(slug: string, checked: boolean): void {
    this.toggleInArray(this.selectedShapes, slug, checked);
    this.currentPage = 1;
    if (!this.selectedCategory) return;
    this.triggerRefresh();
  }

  clearAllDecorFilters(): void {
    this.selectedDecors = [];
    this.selectedShapes = [];
    this.currentPage = 1;
    if (!this.selectedCategory) return;
    this.triggerRefresh();
  }

  changePage(p: number): void {
    if (p === this.currentPage || p < 1 || p > this.totalPages) {
      return;
    }
    this.currentPage = p;
    this.wantScrollTop = true;
    this.triggerRefresh();
  }

  /* =============================================================
   *  HTTP volania
   * ============================================================= */
  private fetchProducts() {
    this.isLoading = true;
    this.error = false;

    // a) vybraná kategória → zobraz produkty len ak je NAJHLBŠIA úroveň
    if (this.selectedCategory) {
      // Triedenie podľa ceny – všetky produkty, triediť/paginovať na fronte
      if (this.selectedSort.startsWith('price:')) {
        return this.productsSrv.getAllProductsForCategoryDeepest(this.selectedCategory).pipe(
          tap((all: Product[]) => {
            const sorted = this.sortByEffectivePrice(all, this.selectedSort);
            this.handleClientSorted(sorted);
          }),
          catchError((err) => {
            console.error('❌ Načítanie produktov (deepest, price-sort) zlyhalo', err);
            this.error = true;
            this.handleClientSorted([]);
            return of([] as Product[]);
          }),
          finalize(() => {
            this.isLoading = false;
            this.isContentLoading = false;
            this.cdr.markForCheck();
          })
        );
      }

      // Ostatné sorty – nechaj na backende (server-side stránkovanie)
      return this.productsSrv
        .getProductsByCategorySlug(this.selectedCategory, this.selectedSort, this.currentPage, this.pageSize)
        .pipe(
          tap((resp: StrapiResp<Product>) => this.handleResponse(resp)),
          catchError((err) => {
            console.error('❌ Načítanie produktov (deepest, name-sort) zlyhalo', err);
            this.error = true;
            this.handleResponse(null);
            return of(null);
          }),
          finalize(() => {
            this.isLoading = false;
            this.isContentLoading = false;
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

    return of({ data: [], meta: { pagination: { page: 1, pageCount: 1, pageSize: this.pageSize, total: 0 } } } as StrapiResp<Product>);
  }

  private effectivePrice(p: Product): number {
    const pick = (q: Product): number | null => {
      if (q.inSale && q.price_sale != null) return q.price_sale!;
      return q.price ?? null;
    };

    const parentPrice = pick(p);
    if (parentPrice != null) return parentPrice;

    const v = (p.variations ?? []).find(
      (vv) => (vv.inSale && vv.price_sale != null) || vv.price != null
    );
    const vPrice = v ? pick(v) : null;

    return vPrice ?? Number.POSITIVE_INFINITY;
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
    const end = start + this.pageSize;

    this.products = list.slice(start, end);
    this.paginatedProducts = this.products;
    this.loadingMap = Object.fromEntries(
      this.products.map((p) => [p.slug, this.loadingMap[p.slug] ?? true])
    );

    this.buildPagination();
    this.cdr.markForCheck();

    // po načítaní produktov obnov JSON-LD ItemList
    this.setCategorySeo();
  }

  private handleResponse(resp: StrapiResp<Product> | null): void {
    if (!resp) return;

    const meta = resp.meta.pagination;
    this.products = resp.data;
    this.paginatedProducts = resp.data;
    this.totalPages = meta.pageCount || 1;
    this.totalCount = meta.total;
    this.loadingMap = Object.fromEntries(
      resp.data.map((p) => [p.slug, this.loadingMap[p.slug] ?? true])
    );
    this.buildPagination();
    this.cdr.markForCheck();

    // po načítaní produktov obnov JSON-LD ItemList
    this.setCategorySeo();
  }

  private triggerRefresh(): void {
    this.isContentLoading = true;
    this.refresh$.next();
  }

  /* =============================================================
   *  Kategórie
   * ============================================================= */
  get showCategoryGrid(): boolean {
    return !this.isLoading && !this.error && this.products.length === 0;
  }

  get currentBannerUrl(): string | null {
    const current = this.getCatBySlug(this.selectedCategorySlug);

    if (current?.category_image_banner_large) {
      return current.category_image_banner_large;
    }

    const parentSlug =
      current?.parent?.category_slug ?? this.selectedRootCategorySlug ?? null;

    if (!parentSlug) {
      return null;
    }

    const parent = this.getCatBySlug(parentSlug);
    return parent?.category_image_banner_large || null;
  }

  private loadCategories(): void {
    this.productsSrv
      .getAllCategoriesFlat()
      .pipe(
        takeUntil(this.destroyed$),
        catchError((err) => {
          return of([] as Category[]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.isContentLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe((cats) => {
        this.allCategories = cats;
        this.rootCategories = cats.filter((c) => !c.parent);

        // 💡 všetky kategórie označ ako "loading"
        this.categoryImgLoadingMap = Object.fromEntries(
          cats.map((c) => [c.category_slug, true])
        );

        if (this.selectedCategory) {
          this.applySlugFromUrl(this.selectedCategory);
        } else {
          // ak nie je vybraná kategória, aj tak obnov text/seo (root view)
          this.updateCategoryText();
        }

        this.cdr.markForCheck();
      });
  }

  // --------- banner (catmainpic) ----------
  onBannerLoad(): void {
    this.bannerLoading = false;
    this.cdr.markForCheck();
  }

  onBannerError(): void {
    this.bannerLoading = false;
    this.cdr.markForCheck();
  }

  // --------- obrázky kategórií ------------
  onCategoryImageLoad(slug: string): void {
    this.categoryImgLoadingMap[slug] = false;
    this.cdr.markForCheck();
  }

  onCategoryImageError(slug: string): void {
    this.categoryImgLoadingMap[slug] = false;
    this.cdr.markForCheck();
  }

  /* =============================================================
   *  SEO pre kategóriu (/produkt/kategoria/:slug)
   * ============================================================= */
  private setCategorySeo(): void {
    const slug = this.selectedCategorySlug;

    const siteUrl = (environment.frontendUrl || '').replace(/\/$/, '');
    const url = slug
      ? `${siteUrl}/produkt/kategoria/${slug}`
      : `${siteUrl}/produkt`;

    const current = slug ? this.getCatBySlug(slug) : null;
    const root = this.getCatBySlug(this.selectedRootCategorySlug);

    const categoryName = this.catLabel(current ?? root) || '';

    const descHtml = this.catText(current ?? root) || '';




    const lang = (this.translate.currentLang || 'sk').toLowerCase();

    const fallbackDesc =
      lang.startsWith('de')
        ? 'Handgefertigte und handbemalte Keramik aus Modra.'
        : lang.startsWith('en')
        ? 'Handmade and hand-painted ceramics from Modra.'
        : 'Ručne vyrábaná a maľovaná keramika z Modry.';

    const plainDesc =
      descHtml
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300) || fallbackDesc;

    const siteName =
      lang.startsWith('de')
        ? 'Majolika Modra – handbemalte Keramik'
        : lang.startsWith('en')
        ? 'Majolika Modra – hand-painted ceramics'
        : 'Majolika Modra – ručne maľovaná keramika';

    const eshopTitle =
      lang.startsWith('de')
        ? 'Online-Shop'
        : lang.startsWith('en')
        ? 'E-shop'
        : 'E-shop';

    const title = categoryName
      ? `${categoryName} | ${siteName}`
      : `${eshopTitle} | ${siteName}`;

    let ogImage = this.currentBannerUrl || `${siteUrl}/assets/img/logo-SLM-modre.gif`;
    if (!/^https?:\/\//i.test(ogImage)) {
      const sep = ogImage.startsWith('/') ? '' : '/';
      ogImage = `${siteUrl}${sep}${ogImage}`;
    }

    this.titleSvc.setTitle(title);
    this.meta.updateTag({ name: 'description', content: plainDesc });

    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: plainDesc });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: ogImage });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: plainDesc });
    this.meta.updateTag({ name: 'twitter:image', content: ogImage });

    let linkEl = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!linkEl) {
      linkEl = this.doc.createElement('link');
      linkEl.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(linkEl);
    }
    linkEl.setAttribute('href', url);

    this.setCategoryJsonLd(url, title, plainDesc, ogImage);
  }

  private setCategoryJsonLd(url: string, title: string, desc: string, imageUrl: string): void {
    const siteUrl = (environment.frontendUrl || '').replace(/\/$/, '');

    // zmaž staré skripty
    const oldItemList = this.doc.getElementById('category-itemlist-jsonld');
    if (oldItemList && oldItemList.parentNode) oldItemList.parentNode.removeChild(oldItemList);

    const oldBreadcrumbs = this.doc.getElementById('category-breadcrumbs-jsonld');
    if (oldBreadcrumbs && oldBreadcrumbs.parentNode) oldBreadcrumbs.parentNode.removeChild(oldBreadcrumbs);

    // ItemList (zoznam produktov na stránke)
    const itemListScript = this.doc.createElement('script');
    itemListScript.type = 'application/ld+json';
    itemListScript.id = 'category-itemlist-jsonld';

    const itemList = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      itemListElement: this.paginatedProducts.map((p, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `${siteUrl}/produkt/${p.slug}`,
      })),
    };

    itemListScript.textContent = JSON.stringify(itemList);
    this.doc.head.appendChild(itemListScript);

    // BreadcrumbList
    const breadcrumbsScript = this.doc.createElement('script');
    breadcrumbsScript.type = 'application/ld+json';
    breadcrumbsScript.id = 'category-breadcrumbs-jsonld';

    const items: any[] = [
      {
        '@type': 'ListItem',
        position: 1,
        name: this.translate.instant('CATEGORIES.HOME') || 'Domov',
        item: `${siteUrl}/`,
      },
    ];

    let position = 2;

    // root kategória
    if (this.selectedRootCategorySlug) {
      const root = this.getCatBySlug(this.selectedRootCategorySlug);
      if (root) {
        items.push({
          '@type': 'ListItem',
          position,
          name: this.catLabel(root),
          item: `${siteUrl}/produkt/kategoria/${root.category_slug}`,
        });
        position++;
      }
    }

    // aktuálna (child) kategória – ak je iná ako root
    if (this.selectedCategorySlug && this.selectedCategorySlug !== this.selectedRootCategorySlug) {
      const cur = this.getCatBySlug(this.selectedCategorySlug);
      items.push({
        '@type': 'ListItem',
        position,
        name: this.catLabel(cur),
        item: url,
      });
    }

    const breadcrumbs = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items,
    };

    breadcrumbsScript.textContent = JSON.stringify(breadcrumbs);
    this.doc.head.appendChild(breadcrumbsScript);
  }

  /* =============================================================
   *  Pomocníci
   * ============================================================= */
  getDecorFromName(n?: string): string | null {
    if (!n) return null;
    const m = n.match(/\s*-\s*([^\-]+)$/);
    return m ? m[1].trim() : null;
  }

  getWithoutDecorFromName(n?: string): string {
    if (!n) return '';
    const d = this.getDecorFromName(n);
    return d ? n.replace(new RegExp(`\\s*-\\s*${d}$`), '').trim() : n;
  }

  private toggleInArray(arr: string[], slug: string, checked: boolean): void {
    const i = arr.indexOf(slug);
    if (checked && i === -1) arr.push(slug);
    if (!checked && i > -1) arr.splice(i, 1);
  }

  private buildPagination(): void {
    const p: (number | -1)[] = [], t = this.totalPages;
    p.push(1);
    const from = Math.max(2, this.currentPage - 1);
    const to = Math.min(t - 1, this.currentPage + 1);

    if (from > 2) p.push(-1);
    for (let i = from; i <= to; i++) p.push(i);
    if (to < t - 1) p.push(-1);
    if (t > 1) p.push(t);

    this.pagesToDisplay = p;
  }
  onCategoryClick(e: MouseEvent, slug: string) {
    // otvorenie v novej karte / okne => nerob UI select
    if (e.ctrlKey || e.metaKey || e.button === 1) return;

    // bežný klik => tvoja logika (ak ešte stále treba)
    this.onCategorySelect(slug);
  }
  addProductToCart(p: Product): void {
    if (p.isSoldOut || p.isUnavailable === true) return;
    const variations = (p.variations ?? []).filter(v => !!v?.id);
    if (variations.length > 0) {
      const ref = this.dialog.open(VariationSelectDialogComponent, {
        data: { product: p, variations },
        panelClass: 'dialog--sharp',
        autoFocus: false,
        restoreFocus: true,
        width: '760px',
        maxWidth: '95vw'
      });

      ref.afterClosed().subscribe((selected: Product | undefined) => {
        if (!selected) return;
        this.addRowToCart(p, selected);
        this.snack.open(this.translate.instant('ESHOP.ADDED_TO_CART'), this.translate.instant('ESHOP.OK'), { duration: 2200 });
      });
      return;
    }

    this.addRowToCart(p, null);
    this.snack.open(this.translate.instant('ESHOP.ADDED_TO_CART'), this.translate.instant('ESHOP.OK'), { duration: 2200 });
  }

  /** Vytvorí CartRow pre zvolený item (variant alebo parent) a vloží ho do košíka. */
private addRowToCart(parent: Product, variant: Product | null) {
  const v = variant ?? parent;

  const pa = (parent as any).attributes ?? parent;
  const va = (v as any).attributes ?? v;

  const variationImg = va.primaryImageUrl || '';
  const mainImg = pa.primaryImageUrl || '';
  const imgToUse = variationImg || mainImg || '/assets/img/gall/placeholder.jpg';

  const inSale = (va.inSale ?? pa.inSale) ?? false;
  const price = (va.price ?? pa.price) ?? 0;
  const price_sale = (va.price_sale ?? pa.price_sale) ?? undefined;

  const isGiftVoucher =
    !!va.isGiftVoucher ||
    !!pa.isGiftVoucher ||
    va.categories?.some((c: any) => c.category_slug === 'darcekove-poukazy') === true ||
    pa.categories?.some((c: any) => c.category_slug === 'darcekove-poukazy') === true;

  const voucherType = va.voucherType ?? pa.voucherType;
  const voucherValue = va.voucherValue ?? pa.voucherValue;

  this.cart.add(
    {
      id: v.id,
      name: va.name ?? pa.name,
      slug: va.slug ?? pa.slug,
      type: isGiftVoucher ? 'gift_voucher' : 'product',

      price,
      price_sale,
      inSale,
      img: imgToUse,

      isGiftVoucher,
      voucherType: isGiftVoucher ? voucherType : undefined,
      voucherValue:
        isGiftVoucher && voucherType === 'value'
          ? (voucherValue ?? price)
          : null,

      vatPercentage: va.vatPercentage ?? pa.vatPercentage,

      isDigitalProduct: !!(va.isDigitalProduct ?? pa.isDigitalProduct),
      digitalSelected: !!(va.isDigitalProduct ?? pa.isDigitalProduct),
    } as any,
    1
  );
}
}
