import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CartService } from 'app/services/cart.service';

import {
  map,
  catchError,
  finalize,
  switchMap,
} from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import {
  ProductsService,
  Product,
  Category,
} from 'app/services/products.service';
import { MegaMenuService } from 'app/services/mega-menu.service';
interface DecorOption {
  label: string;
  slug: string;
}
@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
  ],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent implements OnInit, OnDestroy {
  @ViewChild('productList') productList!: ElementRef<HTMLElement>;
  private allProducts: Product[] = [];
  public products: Product[] = [];
  categories: CategoryWithChildren[] = [];
  selectedCategory: string | null = null;
  selectedCategorySlug: string | null = null;
  selectedCategoryName: string | null = null;
  selectedCategoryText: string | null = null;
  siblingCategories: CategoryWithChildren[] = [];
  childCategories: CategoryWithChildren[] = [];

  public hasPendingFilterChanges = false;

  private megaTimeoutId: any = null;

  public decorOptions: DecorOption[] = [
    { label: 'Habánsky dekór', slug: 'habansky-dekor' },
    { label: 'Modrý dekór',    slug: 'modry-dekor' },
    { label: 'Pestrý dekór',    slug: 'pestry-dekor' },
    { label: 'Zelený dekór',    slug: 'zeleny-dekor' },
    { label: 'Linky',    slug: 'KRUHY' },
  ];

  // možnosti tvarov
public shapeOptions: { label: string; slug: string }[] = [
  { label: 'Tanier', slug: 'tanier' },
  { label: 'Džbán',  slug: 'dzban' },
  { label: 'Váza',   slug: 'vaza' },
  { label: 'Pohár',  slug: 'pohar' },
  { label: 'Miska',  slug: 'miska' },
];
  
  public selectedDecors: string[] = [];
  public selectedShapes: string[] = [];


  isLoading = false;
  error = false;

  loadingMap: Record<string, boolean> = {};
  isMegaOpen = false;


  public paginatedProducts: Product[] = [];
  public totalPages: number = 1;

  // Paginácia
  pageSizeOptions = [5, 10, 15, 20];
  pageSize = 20;
  currentPage = 1;
  totalCount = 0;

  // Dots loader
  loadingBaseText = '';
  loadingText = '';
  dotCount = 1;
  dotInterval: any;

  // Zoradenie
  sortOptions = [
    { label: 'Najnovšie',  value: 'createdAt:desc' },
    { label: 'Najstaršie', value: 'createdAt:asc' },
    { label: 'Najlacnejšie', value: 'price:asc' },
    { label: 'Najdrahšie',  value: 'price:desc' },
  ];
  selectedSort = this.sortOptions[0].value;

  private productCache: Record<string, Product[]> = {};
  private megaSub!: Subscription;

  constructor(
    public megaMenuService: MegaMenuService,
    public productsService: ProductsService,
    private router: Router,
    private route: ActivatedRoute,
    private cart: CartService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // 1) Načítať uložené nastavenia veľkosti stránky a zoradenia
    const savedPageSize = localStorage.getItem('eshop_pageSize');
    if (savedPageSize) {
      this.pageSize = +savedPageSize;
    }
    const savedSort = localStorage.getItem('eshop_selectedSort');
    if (savedSort) {
      this.selectedSort = savedSort;
    }
  
    // 2) Mega-menu subscription
    this.megaSub = this.megaMenuService.isOpen$.subscribe(open => {
      this.isMegaOpen = open;
    });
  
    // 3) Načítať všetky kategórie a zostaviť strom
    this.productsService
      .getAllCategoriesFlat()
      .pipe(catchError(() => of([] as Category[])))
      .subscribe(allCats => {
        this.categories = this.buildTree(allCats);
        this.updateSelectedCategory();
      });
  
    // 4) Sleduj queryParams 'category' a novinkou 'decor'
    this.route.queryParamMap
      .pipe(
        switchMap(params => {
          // --- category ---
          const catSlug = params.get('category');
          if (catSlug) {
            localStorage.setItem('eshop_selectedCategorySlug', catSlug);
            this.selectedCategory = catSlug;
          } else {
            this.selectedCategorySlug =
              localStorage.getItem('eshop_selectedCategorySlug') || null;
          }
          this.selectedCategorySlug = catSlug;
          this.updateSelectedCategory();

          // načítanie tvarov zo storage
          const savedShapes = localStorage.getItem('eshop_selectedShapes');
          this.selectedShapes = savedShapes
            ? savedShapes.split(',').map(s => s.trim()).filter(s => s)
            : [];

          // synchronizuj s URL
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
              decor: this.selectedDecors.join(','),
              shape: this.selectedShapes.join(',')
            },
            queryParamsHandling: 'merge'
          });

          const saved = localStorage.getItem('eshop_selectedDecors');
          this.selectedDecors = saved
            ? saved.split(',').map(s => s.trim()).filter(s => s)
            : [];
        
          // nech v URL korešponduje query-param (keby niekto reloadol so starým URL)
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { decor: this.selectedDecors.join(',') },
            queryParamsHandling: 'merge'
          });

          // --- decor filter ---
          const decorParam = params.get('decor'); 
          if (decorParam) {
            // očakávame CSV slugov, napr. "modry-dekor,zeleny-dekor"
            this.selectedDecors = decorParam.split(',').filter(s => !!s);
            localStorage.setItem(
              'eshop_selectedDecors',
              this.selectedDecors.join(',')
            );
          } else {
            const saved = localStorage.getItem('eshop_selectedDecors');
            this.selectedDecors = saved ? saved.split(',') : [];
          }


  
          // vždy načítať produkty s aktuálnym sort parametrom
          return of(this.selectedSort);
        })
      )
      .subscribe(() => {
        this.loadProducts();
      });
  }
  
  public clearAllDecorFilters(): void {
    // 1) vyčisti vnútorný stav
    this.selectedDecors = [];
    this.selectedShapes = [];
  
    // 2) odstráň z LocalStorage
    localStorage.removeItem('eshop_selectedDecors');
    localStorage.removeItem('eshop_selectedShapes');
  
    // 3) odstráň query-param
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { decor: null },
      queryParamsHandling: 'merge'
    });
  
    // 4) znovu aplikuj filter (=> zobrazí všetky produkty)
    this.applyFilters();
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
        img: imgToUse
      },
      1 // množstvo
    );
  }



  getDecorFromName(name: string): string | null {
    const parts = name.split(' - ');
    if (parts.length > 1) {
      return parts.slice(1).join(' - ').trim();
    }
    return null;
  }
  
  getWithoutDecorFromName(name: string): string {
    return name.split(' - ')[0].trim();
  }


  onDecorToggle(slug: string, checked: boolean) {
    if (checked) {
      this.selectedDecors.push(slug);
    } else {
      this.selectedDecors = this.selectedDecors.filter(s => s !== slug);
    }
  
    // 1) ulož do storage
    localStorage.setItem(
      'eshop_selectedDecors',
      this.selectedDecors.join(',')
    );
  
    // 2) (voliteľne) synchronizuj URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { decor: this.selectedDecors.join(',') },
      queryParamsHandling: 'merge'
    });
  
    // 3) aplikuj filter
    // this.applyFilters();
    this.hasPendingFilterChanges = true;

  }



  public onShapeToggle(slug: string, checked: boolean): void {
    if (checked) {
      this.selectedShapes.push(slug);
    } else {
      this.selectedShapes = this.selectedShapes.filter(s => s !== slug);
    }
    // ulož do localStorage + do URL
    localStorage.setItem('eshop_selectedShapes', this.selectedShapes.join(','));
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { shape: this.selectedShapes.join(',') },
      queryParamsHandling: 'merge'
    });
    // this.applyFilters();
    this.hasPendingFilterChanges = true;

  }



  public applyFilters(): void {
    // ak nie je žiadna kategória, všetky produkty
    if (this.selectedDecors.length === 0 && this.selectedShapes.length === 0) {
      this.products = [...this.allProducts];
    } else {
      // vyfiltruj všetky variácie, ktoré spĺňajú **obidva** kritériá:
      this.products = this.allProducts.flatMap(prod =>
        (prod.variations ?? []).filter(v => {
          const okDecor = this.selectedDecors.length === 0
            ? true
            : this.selectedDecors.some(dec => v.slug.includes(dec));
          const okShape = this.selectedShapes.length === 0
            ? true
            : this.selectedShapes.some(sh => v.slug.includes(sh));
          return okDecor && okShape;
        })
      );
    }
  
    // reset page, pagination, loadingMap
    this.currentPage = 1;
    this.updatePagination();
    this.loadingMap = {};
    // this.paginatedProducts.forEach(p => (this.loadingMap[p.slug] = true));
    this.paginatedProducts.forEach(prod =>
      (prod.variations ?? []).forEach(v => this.loadingMap[v.slug] = true)
    );
    this.hasPendingFilterChanges = false;

  }

  ngOnDestroy(): void {
    this.megaSub?.unsubscribe();
    clearTimeout(this.megaTimeoutId);
    clearInterval(this.dotInterval);
  }

  /** Fallback cena: parent.price alebo prvá variation.price */
  getProductPrice(p: Product): number | null {
    if (p.price != null) return p.price;
    if (p.variations?.length) {
      const first = p.variations[0];
      if (first.price != null) return first.price;
    }
    return null;
  }

  // Kľúč pre cache
  private get cacheKey(): string {
    return `${this.selectedCategory || 'root'}__${this.selectedSort}`;
  }

  get rootCategories(): CategoryWithChildren[] {
    return this.categories.filter(cat => !cat.parent);
  }

  resetCategory(): void {
    // ak nie je žiadna vybraná kategória, nerob nič
    if (!this.selectedCategory) return;
  
    // nájdeme uzol a jeho rodiča
    const node = this.findCategory(this.selectedCategory, this.categories)!;
    const parentSlug = node.parent?.category_slug ?? null;
  
    // aktualizujeme selectedCategory aj v localStorage
    this.selectedCategory = parentSlug;
    if (parentSlug) {
      localStorage.setItem('eshop_selectedCategorySlug', parentSlug);
    } else {
      localStorage.removeItem('eshop_selectedCategorySlug');
    }
  
    // prepíšeme query-param a znovu nastavíme strom
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: parentSlug },
      queryParamsHandling: 'merge'
    });
    this.updateSelectedCategory();
    this.loadProducts();
  }

  
private updateSelectedCategory(): void {
  // nájdeme uzol aktuálnej kategórie (alebo null ak root)
  const node = this.findCategory(this.selectedCategory, this.categories);

  // 1. Súrodenci: ak mám rodiča, zobrazím všetky jeho deti; inak root
  const parentSlug = node?.parent?.category_slug || null;
  this.siblingCategories = parentSlug
    ? this.getChildCategories(parentSlug)
    : this.rootCategories;

  // 2. Vybraná kategória (name/text)
  this.selectedCategoryName = node?.category_name ?? null;
  this.selectedCategoryText = node?.category_text ?? null;

  // 3. Deti = tie, čo budem ponúkať zvoliť ďalej
  this.childCategories = node?.children ?? [];
}

  get loadingPlaceholders(): any[] {
    return Array(this.pageSize).fill(0);
  }

  startLoadingDots() {
    this.translate.get('ESHOP.LOADING_PRODUCTS').subscribe(base => {
      this.loadingBaseText = base;
      this.loadingText = `${base}...`;
      this.dotCount = 1;
      clearInterval(this.dotInterval);
      this.dotInterval = setInterval(() => {
        this.dotCount = (this.dotCount % 3) + 1;
        this.loadingText = `${this.loadingBaseText}${'.'.repeat(this.dotCount)}`;
      }, 500);
    });
  }

  stopLoadingDots() {
    clearInterval(this.dotInterval);
    this.loadingText = '';
  }

  onImageLoad(slug: string) {
    this.loadingMap[slug] = false;
  }
  onImageError(slug: string) {
    this.loadingMap[slug] = false;
  }

  onCategorySelect(slug: string | null): void {
    this.currentPage = 1;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: slug },
      queryParamsHandling: 'merge',
    });
  }

  /** Zmena zoradenia bez reloadu celej stránky */
  onSortChange(sortValue: string): void {
    this.currentPage = 1;
    this.selectedSort = sortValue;
    localStorage.setItem('eshop_selectedSort', sortValue);
    this.loadProducts();
  }

  /** Načíta produkty a zoradí ich, pri price-sorte s fallbackom */
  private loadProducts(): void {
    const key = this.cacheKey;
  
    // 1) Ak nie je vybraná žiadna kategória, načítaj root produkty
    if (!this.selectedCategory) {
      // Zrušíme clear-storage vetvu
      // zavoláme getRootProducts (napr. s limitom pageSize*totalPages)
      this.isLoading = true;
      this.error = false;
      this.startLoadingDots();
  
      this.productsService
        .getRootProducts(this.selectedSort, 0, 2000)   // alebo iný limit
        .pipe(
          map(res => {
            const list = res.data;
            this.totalCount = list.length;
            return list;
          }),
          catchError(err => {
            console.error('Chyba načítania root produktov', err);
            this.error = true;
            return of([] as Product[]);
          }),
          finalize(() => {
            this.isLoading = false;
            this.stopLoadingDots();
            // loadingMap po aplikovaní filtrov/paginácii
          })
        )
        .subscribe(list => {
          this.allProducts = [...list];
          this.applyPriceFallbackSort();
          this.applyFilters();  // toto aktualizuje aj paginatedProducts
          this.isLoading = false;
        });
  
      return;
    }
  
    // 2) Ak je vybraná kategória, pôvodná logika s cache a getProductsByCategorySlug
    if (this.productCache[key]) {
      this.allProducts = [...this.productCache[key]];
      this.applyPriceFallbackSort();
      this.applyFilters();
      return;
    }
  
    this.isLoading = true;
    this.error = false;
    this.startLoadingDots();
  
    this.productsService
      .getProductsByCategorySlug(
        this.selectedCategory,
        this.selectedSort,
        0,
        3000
      )
      .pipe(
        map(res => {
          const list = res.data;
          this.productCache[key] = [...list];
          this.totalCount = list.length;
          return list;
        }),
        catchError(err => {
          console.error('Chyba načítania produktov', err);
          this.error = true;
          return of([] as Product[]);
        }),
        finalize(() => {
          this.isLoading = false;
          this.stopLoadingDots();
        })
      )
      .subscribe(list => {
        this.allProducts = [...list];
        this.applyPriceFallbackSort();
        this.applyFilters();
      });
  }
  

  private updatePagination(): void {
    // 1) nový počet všetkých položiek
    this.totalCount = this.products.length;
  
    // 2) prepočítať počet strán
    this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  
    // 3) obmedziť currentPage na validný rozsah
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  
    // 4) vypočítať, ktoré produkty sa zobrazia na currentPage
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedProducts = this.products.slice(start, start + this.pageSize);
  }
  

  /** Ak sort je price:asc/desc, prepíše poradie podľa getProductPrice() */
  private applyPriceFallbackSort(): void {
    if (this.selectedSort.startsWith('price:')) {
      const dir = this.selectedSort.split(':')[1];
      this.products.sort((a, b) => {
        const pa = this.getProductPrice(a) ?? 0;
        const pb = this.getProductPrice(b) ?? 0;
        return dir === 'asc' ? pa - pb : pb - pa;
      });
    }
  }

  // Paginácia
  // get totalPages(): number {
  //   return Math.ceil(this.totalCount / this.pageSize);
  // }
  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.updatePagination();
  }
  // get paginatedProducts(): Product[] {
  //   const start = (this.currentPage - 1) * this.pageSize;
  //   return this.products.slice(start, start + this.pageSize);
  // }
  get pagesToDisplay(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    if (range[0] > 2) {
      range.unshift(-1, 1);
    } else if (range[0] === 2) {
      range.unshift(1);
    }
    if (range[range.length - 1] < total - 1) {
      range.push(-1, total);
    } else if (range[range.length - 1] === total - 1) {
      range.push(total);
    }
    return range;
  }

  // Pomocné pre kategórie
  private buildTree(cats: Category[]): CategoryWithChildren[] {
    const map = new Map<string, CategoryWithChildren>();
    cats.forEach(c => map.set(c.category_slug, { ...c, children: [] }));
    const roots: CategoryWithChildren[] = [];
    map.forEach(node => {
      const parentSlug = node.parent?.category_slug;
      if (parentSlug && map.has(parentSlug)) {
        map.get(parentSlug)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }
  private findCategory(
    slug: string | null,
    nodes: CategoryWithChildren[]
  ): CategoryWithChildren | null {
    if (!slug) return null;
    for (const n of nodes) {
      if (n.category_slug === slug) return n;
      const found = this.findCategory(slug, n.children);
      if (found) return found;
    }
    return null;
  }
  private getCategoryName(slug: string | null): string | null {
    return this.findCategory(slug, this.categories)?.category_name ?? null;
  }
  private getCategoryText(slug: string | null): string | null {
    return this.findCategory(slug, this.categories)?.category_text ?? null;
  }
  private getChildCategories(slug: string | null): CategoryWithChildren[] {
    return this.findCategory(slug, this.categories)?.children ?? [];
  }
  
}


interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}
