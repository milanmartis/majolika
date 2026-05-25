// src/app/components/header/header.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  Input,
  HostListener,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationStart } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

import { Observable, Subscription } from 'rxjs';
import { finalize, filter } from 'rxjs/operators';

import { MatToolbarModule } from '@angular/material/toolbar';

import { LanguageService } from 'app/services/language.service';
import { CartService } from 'app/services/cart.service';
import { ProductsService, Category } from 'app/services/products.service';
import { SearchComponent } from 'app/shared/search/search.component';
import { MegaMenuService } from 'app/services/mega-menu.service';
import { AuthService } from 'app/services/auth.service';
import { SearchService } from 'app/services/search.service';

import { trigger, style, transition, animate } from '@angular/animations';

type NavChild = { name: string; link: string };
type NavItem = { name: string; link: string; children?: NavChild[] };

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
    MatToolbarModule,
    SearchComponent,
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  animations: [
    trigger('dropdown', [
      transition(':enter', [
        style({ height: '0px', opacity: 0, overflow: 'hidden' }),
        animate('350ms ease-out', style({ height: '*', opacity: 1 })),
      ]),
    ]),
    // malé dropdown pre O-NÁS (desktop)
    trigger('aboutDrop', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(6px)' })),
      ]),
    ]),
  ],
})
export class HeaderComponent implements OnInit, OnDestroy, AfterViewInit {
  icons = ['tanier', 'dzban', 'vaza', 'pohar', 'miska'];

  isCategoriesLoading = true;

  // ✅ FIX: promo sa nevyrenderuje "na chvíľu" a potom nezmizne v ngOnInit (layout shift)
  showPromo = localStorage.getItem('hidePromo') !== '1';

  currentLang = 'sk';

  imgState = 'hidden';
  searchQuery = '';
  isSidebarOpen = false; // 600–991 px
  isMobileNavOpen = false; // ≤ 991 px (tvoje správanie)

  @Input() hidden = false;
  @Input() isAtTop = true;

  // ======= DESKTOP NAV ITEMS =======
  categories2: NavItem[] = [];

  @ViewChild(SearchComponent) searchCmp!: SearchComponent;

  // ======= Mega nav =======
  @ViewChild('megaNav', { static: false }) megaNav!: ElementRef;
  isMegaOpen = false;
  private megaSub!: Subscription;
  private megaTimeoutId: any = null;

  // ✅ FIX: zavri dropdowny hneď pri navigácii (aby neodtlačili obsah dole)
  private navStartSub!: Subscription;

  // ======= About dropdown =======
  aboutOpen = false;
  @ViewChild('aboutMenuWrap', { static: false }) aboutMenuWrap?: ElementRef<HTMLElement>;

  // ======= Categories tree =======
  categories: CategoryWithChildren[] = [];
  filteredCategories: CategoryWithChildren[] = [];
  expanded: Record<string, boolean> = {};
  showProductCategories = false;

  count$: Observable<number>;

  constructor(
    private megaMenuService: MegaMenuService,
    private productsService: ProductsService,
    private languageService: LanguageService,
    private router: Router,
    private cart: CartService,
    private cdr: ChangeDetectorRef,
    public auth: AuthService,
    private searchService: SearchService
  ) {
    this.count$ = this.cart.count$;
  }

  ngAfterViewInit(): void {
    // nič špeciálne
  }

  // ===== Click outside: zavri mega aj about dropdown =====
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const target = ev.target as Node;

    // mega
    if (this.isMegaOpen) {
      if (!this.megaNav?.nativeElement?.contains(target)) {
        this.closeMegaNav2();
      }
    }

    // about dropdown
    if (this.aboutOpen) {
      const wrap = this.aboutMenuWrap?.nativeElement;
      if (wrap && !wrap.contains(target)) {
        this.closeAboutMenu();
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (event.target.innerWidth > 991 && this.isMobileNavOpen) {
      this.isMobileNavOpen = false;
    }
    // pri resize zavri desktop dropdowny
    if (event.target.innerWidth < 992) {
      this.aboutOpen = false;
    }
  }

  ngOnInit(): void {
  
    this.showPromo = false;
    localStorage.setItem('hidePromo', '1');

    this.megaSub = this.megaMenuService.isOpen$.subscribe((open) => {
      this.isMegaOpen = open;
    });

    // ✅ FIX: pri začiatku navigácie okamžite zavri dropdowny,
    // aby dropdown neodtlačil obsah počas načítania route
    this.navStartSub = this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => {
        this.aboutOpen = false;
        this.megaMenuService.close();
        this.isMobileNavOpen = false;
        this.isSidebarOpen = false;
        this.expanded = {};
      });

    this.productsService
      .getAllCategoriesFlat()
      .pipe(finalize(() => (this.isCategoriesLoading = false)))
      .subscribe((allCats) => {
        this.categories = this.buildTree(allCats);
        this.filteredCategories = [...this.categories];
      });

    // jazyk + build nav
    this.currentLang = this.languageService.getCurrentLanguage();
    this.buildNav();
  }

  ngOnDestroy(): void {
    this.megaSub?.unsubscribe();
    this.navStartSub?.unsubscribe();
  }

  closePromo() {
  this.showPromo = false;
  localStorage.setItem('hidePromo', '1');
  }

  // ======= DESKTOP NAV BUILDER (podľa jazyka) =======
  private buildNav(): void {
    const isSk = this.currentLang === 'sk';

    this.categories2 = [
      { name: 'CATEGORIES.HOME', link: '/' },
      { name: 'CATEGORIES.AKTUALITY', link: '/aktuality' },
      { name: 'CATEGORIES.PRODUCTS', link: '/eshop' },
      { name: 'CATEGORIES.WORKSHOPS', link: '/dielne' },
      { name: 'CATEGORIES.TRADITION', link: '/article/historia-majoliky' },

      // 👇 DESKTOP hover dropdown
      {
        name: 'CATEGORIES.ABOUT',
        link: '/o-nas',
        children: isSk
          ? [
              { name: 'CATEGORIES.ABOUT', link: '/o-nas' },
              { name: 'Slovenská Ľudová Majolika, a. s.', link: '/article/majolika-as' },
              { name: 'OZ Slovenská Ľudová Majolika', link: '/article/oz-slm' },
              { name: 'FOOTER.INFO.NEW_MODELS', link: '/article/nove-vzory' },
            ]
          : [
              { name: 'CATEGORIES.ABOUT', link: '/o-nas' },
              { name: 'FOOTER.INFO.NEW_MODELS', link: '/article/nove-vzory' },
            ],
      },

      { name: 'CATEGORIES.KONTAKTY', link: '/article/informacie' },
    ];
  }

  getCategoryLabel(c: any): string {
    if (!c) return '';
    if (this.currentLang === 'en') return c.category_name_en || c.category_name;
    if (this.currentLang === 'de') return c.category_name_de || c.category_name;
    return c.category_name;
  }

  onClickSearch() {
    this.searchService.triggerOpenOverlay();
  }

  onCartIconClick(): void {
    this.cart.openCart();
  }

  /** ② ► Zavoláme z odkazu v šablóne  */
  onSearchLinkClick(term: string): void {
    // this.searchCmp?.searchFromLink(term);
  }

  // ===== Mega-nav (desktop) =====
  openMegaNav(): void {
    this.megaMenuService.open();
  }
  closeMegaNav2(): void {
    this.megaMenuService.close();
  }
  toggleMegaNav(): void {
    this.megaMenuService.toggle();
  }
  cancelMegaTimeout(): void {
    if (this.megaTimeoutId !== null) {
      clearTimeout(this.megaTimeoutId);
      this.megaTimeoutId = null;
    }
  }

  // ===== About dropdown (desktop hover/focus) =====
  openAboutMenu(): void {
    this.aboutOpen = true;
  }
  closeAboutMenu(): void {
    this.aboutOpen = false;
  }
  toggleAboutMenu(): void {
    this.aboutOpen = !this.aboutOpen;
  }

  // ===== Mobilný overlay nav =====
  toggleMobileNav(): void {
    if (window.innerWidth <= 991) {
      this.isMobileNavOpen = !this.isMobileNavOpen;
    }
  }
  onCloseMobileNav(): void {
    this.isMobileNavOpen = false;
    this.expanded = {};
  }

  // ===== Accordion tree (mobil) =====
  toggleCategory(slug: string): void {
    if (slug === 'eshop') {
      this.categories.forEach((cat) => {
        this.expanded[cat.category_slug] = false;
      });
    } else {
      this.categories.forEach((cat) => {
        if (cat.category_slug !== slug) {
          this.expanded[cat.category_slug] = false;
        }
      });
    }
    this.expanded[slug] = !this.expanded[slug];
  }

  isExpanded(slug: string): boolean {
    return !!this.expanded[slug];
  }

  private buildTree(cats: Category[]): CategoryWithChildren[] {
  const map = new Map<string, CategoryWithChildren>();

  cats.forEach((c) => {
    map.set(c.category_slug, { ...c, children: [] });
  });

  const childSlugs = new Set<string>();

  // 1) klasický parent
  map.forEach((cat) => {
    const parentSlug = cat.parent?.category_slug;

    if (parentSlug && map.has(parentSlug)) {
      const parent = map.get(parentSlug)!;

      if (!parent.children.some(ch => ch.category_slug === cat.category_slug)) {
        parent.children.push(cat);
      }

      childSlugs.add(cat.category_slug);
    }
  });

  // 2) extra_parents
  map.forEach((cat) => {
    for (const parentSlug of cat.extra_parents_slugs ?? []) {
      const parent = map.get(parentSlug);

      if (parent && !parent.children.some(ch => ch.category_slug === cat.category_slug)) {
        parent.children.push(cat);
        childSlugs.add(cat.category_slug);
      }
    }
  });

  // 3) extra_children
  map.forEach((parent) => {
    for (const childSlug of parent.extra_children_slugs ?? []) {
      const child = map.get(childSlug);

      if (child && !parent.children.some(ch => ch.category_slug === child.category_slug)) {
        parent.children.push(child);
        childSlugs.add(child.category_slug);
      }
    }
  });

  // zoradenie detí
  map.forEach((cat) => {
    cat.children.sort(
      (a, b) =>
        (a.category_poradie ?? 0) - (b.category_poradie ?? 0) ||
        a.category_name.localeCompare(b.category_name, 'sk', { sensitivity: 'base' })
    );
  });

  // root sú tie, ktoré nie sú dieťaťom
  return Array.from(map.values()).filter(cat => !childSlugs.has(cat.category_slug));
}

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  switchLanguage(lang: string): void {
    this.languageService.changeLanguage(lang);
    this.currentLang = lang;

    // 🔥 prepočítaj desktop menu
    this.buildNav();

    // zavri dropdown pri prepnutí jazyka
    this.aboutOpen = false;

    this.cdr.detectChanges();
  }

  isActive(lang: string): boolean {
    return this.currentLang === lang;
  }

  onProductsNavClick(): void {
    this.showProductCategories = true;
    this.isSidebarOpen = true;
    this.filteredCategories = this.categories.filter((c) => !c.parent);
  }

  onCategorySelect(slug: string): void {
    this.router.navigate(['/produkt', 'kategoria', slug]);
    this.toggleSidebar();
    this.expanded = {};
  }

  get showLogo(): boolean {
    return this.router.url !== '/';
  }
}

interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}