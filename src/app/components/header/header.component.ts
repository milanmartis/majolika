// src/app/components/header/header.component.ts
import { Component, OnInit, OnDestroy, ChangeDetectorRef, Input, HostListener } from '@angular/core';
import { ViewChild, AfterViewInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from 'app/services/language.service';
import { fadeInOutAnimation } from 'app/animations/route.animations';
import { FormsModule } from '@angular/forms';
import { CartService } from 'app/services/cart.service';
import { Observable, Subscription } from 'rxjs';
import { ProductsService, Category } from 'app/services/products.service';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SearchComponent } from 'app/shared/search/search.component';
import { MegaMenuService } from 'app/services/mega-menu.service';
import { AuthService } from 'app/services/auth.service'; 

import {

  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
    MatToolbarModule,
    SearchComponent  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  animations: [
    trigger('dropdown', [
      // ENTER – plynulé, 350 ms
      transition(':enter', [
        style({ height: '0px', opacity: 0, overflow: 'hidden' }),
        animate('350ms ease-out',
                style({ height: '*',   opacity: 1 }))
      ]),
      // LEAVE – zámietnuto, žiadna animácia
      // (keďže nemáme transition(':leave'), element zmizne okamžite)
    ]),
  ],
})
export class HeaderComponent implements OnInit, OnDestroy, AfterViewInit {

  icons = ['tanier','dzban','vaza','pohar','miska'];

  showPromo = true;


  @HostListener('window:resize', ['$event'])
onResize(event: any) {
  if (event.target.innerWidth > 991 && this.isMobileNavOpen) {
    this.isMobileNavOpen = false;
  }
}
  currentLang = 'sk';

  imgState = 'hidden';
  searchQuery = '';
  isSidebarOpen = false;          // 600–991 px
  isMobileNavOpen = false;        // ≤ 599 px  <-- NOVÉ

  @Input() hidden = false;
  @Input() isAtTop = true;

  categories2 = [
    { name: 'CATEGORIES.HOME', link: '/' },
    { name: 'CATEGORIES.PRODUCTS', link: '/eshop' },
    { name: 'CATEGORIES.WORKSHOPS', link: '/dielne' },
    { name: 'CATEGORIES.TRADITION', link: '/tradicia' },
    { name: 'CATEGORIES.ABOUT', link: '/article/kto-sme' },
    { name: 'CATEGORIES.KONTAKTY', link: '/article/informacie' },
  ];
  @ViewChild(SearchComponent) searchCmp!: SearchComponent;

  // ...tvoj existujúci kód (fields, constructor, ngOnInit, atď.)

  ngAfterViewInit(): void {
    /* Ak by sa searchCmp inicializoval neskôr, môže byť undefined.
       Preto je dobré tu (alebo v onSearchLinkClick) pridať kontrolu: */
  }

  /** ② ► Zavoláme z odkazu v šablóne  */
  onSearchLinkClick(term: string): void {
    // 1) rovno nastavíme a vyhľadáme
   // this.searchCmp?.searchFromLink(term);

    // 2) ak používaš overlay/rozbaľovačku searchu, pridaj vlastné „open()“
    //    alebo nastav stav, napr. this.searchCmp.isOpen = true;
    //    (podľa toho, ako je SearchComponent napísaný)
    // this.onCloseMobileNav();   // zatvor mobilný overlay
    // this.toggleSidebar();      // zatvor sidebar, ak treba
  }

  categories: CategoryWithChildren[] = [];
  filteredCategories: CategoryWithChildren[] = [];
  expanded: Record<string, boolean> = {};

  showProductCategories = false;

  isMegaOpen = false;
  private megaSub!: Subscription;
  private megaTimeoutId: any = null;

  count$: Observable<number>;

  constructor(
    private megaMenuService: MegaMenuService,
    private productsService: ProductsService,
    private languageService: LanguageService,
    private router: Router,
    private cart: CartService,
    private cdr: ChangeDetectorRef,
    public auth: AuthService
  ) {
    this.count$ = this.cart.count$;
  }
  onCartIconClick(): void {
    this.cart.openCart();
  }
  ngOnInit(): void {
    this.megaSub = this.megaMenuService.isOpen$.subscribe((open) => {
      this.isMegaOpen = open;
    });

    this.productsService.getAllCategoriesFlat().subscribe((allCats) => {
      this.categories = this.buildTree(allCats);
      this.filteredCategories = [...this.categories];
    });

    // setTimeout(() => (this.imgState = 'visible'), 450);
    // this.currentLang = this.languageService.getCurrentLanguage();
    this.currentLang = this.languageService.getCurrentLanguage();

   // this.showPromo = localStorage.getItem('hidePromo') !== '1';

  }

  closePromo() {
    this.showPromo = false;
    // voliteľne ulož do localStorage, ak chceš aby zostala zatvorená aj po reload
    localStorage.setItem('hidePromo', '1');
  }

  ngOnDestroy(): void {
    this.megaSub?.unsubscribe();

  }
  toggleCategory(slug: string): void {
    if (slug === 'eshop') {
      // clicking “eshop” opens/closes the whole category tree;
      // make sure no sub‐panels remain open
      this.categories.forEach(cat => {
        this.expanded[cat.category_slug] = false;
      });
    } else {
      // clicking one of the root‐under‐eshop categories:
      // collapse its *siblings* only
      this.categories.forEach(cat => {
        if (cat.category_slug !== slug) {
          this.expanded[cat.category_slug] = false;
        }
      });
    }
  
    // finally toggle *this* one
    this.expanded[slug] = !this.expanded[slug];
  }
  
  isExpanded(slug: string): boolean {
    return !!this.expanded[slug];
  }
  /**
   * Open mega-menu immediately and cancel any pending close/toggle.
   */
  /* ========== MEGA-NAV (desktop) ========== */
  openMegaNav(): void { this.megaMenuService.open(); }
  closeMegaNav2(): void { this.megaMenuService.close(); }
  toggleMegaNav(): void { this.megaMenuService.toggle(); }
  cancelMegaTimeout(): void {
    if (this.megaTimeoutId !== null) {
      clearTimeout(this.megaTimeoutId);
      this.megaTimeoutId = null;
    }
  }

  /* ========== MOBILNÝ ACCORDION NAV (≤599 px) ========== */
  toggleMobileNav(): void {
    if (window.innerWidth <= 991) {
     this.isMobileNavOpen = !this.isMobileNavOpen;
    }  }
  onCloseMobileNav(): void {
    this.isMobileNavOpen = false;
  }



  private buildTree(cats: Category[]): CategoryWithChildren[] {
    const map = new Map<string, CategoryWithChildren>();
    cats.forEach((c) => {
      map.set(c.category_slug, { ...c, children: [] });
    });

    const roots: CategoryWithChildren[] = [];
    map.forEach((cat) => {
      const parentSlug = cat.parent?.category_slug;
      if (parentSlug && map.has(parentSlug)) {
        map.get(parentSlug)!.children.push(cat);
      } else {
        roots.push(cat);
      }
    });

    return roots;
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  switchLanguage(lang: string): void {
    this.languageService.changeLanguage(lang);
    this.currentLang = lang;
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
    this.router.navigate(['/eshop'], { queryParams: { category: slug } });
    this.toggleSidebar();
    // reset _all_ panels:
    this.expanded = {};
  }
  // toggleCategory(slug: string): void {
  //   this.expanded[slug] = !this.expanded[slug];
  // }

  // isExpanded(slug: string): boolean {
  //   return !!this.expanded[slug];
  // }

  search(): void {
    console.log('Searching for:', this.searchQuery);
  }

  get showLogo(): boolean {
    return this.router.url !== '/';
  }
}

interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}
