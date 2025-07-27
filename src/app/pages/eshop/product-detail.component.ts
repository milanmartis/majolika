// src/app/pages/eshop/product-detail.component.ts
// © 2025 – Slovenská ľudová majolika

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule }   from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgZone } from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule }    from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { switchMap,  map, filter } from 'rxjs/operators';
import { interval, Subscription } from 'rxjs';
import { take, skip } from 'rxjs/operators';
import { ProductsService, Product, Category } from '../../services/products.service';
import { CartService } from '../../services/cart.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MaterialModule } from 'app/material.module';
import { ZoomPanDirective } from 'app/pages/eshop/zoom-pan.directive';
import { slideFullscreenAnimation } from 'app/animations/route.animations';
import { FavoriteStateService } from 'app/services/favorite-state.service';
import { AuthService } from 'app/services/auth.service';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';


import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    MaterialModule,
    ZoomPanDirective,
    MatProgressSpinnerModule
    ],
  animations: [slideFullscreenAnimation,
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '{{collapsedHeight}}px',
          overflow: 'hidden',
        }),
        { params: { collapsedHeight: 72 } } // default ~3 lines
      ),
      state(
        'expanded',
        style({
          height: '*',
          overflow: 'hidden',
        })
      ),
      transition('collapsed <=> expanded', animate('300ms ease-in-out')),
    ]),
    trigger('fadeSlideInOut', [
      state(
        'void',
        style({ opacity: 0, transform: 'translateY(20px)' })
      ),
      state('*', style({ opacity: 1, transform: 'translateY(0)' })),
      transition('void => *', animate('400ms ease-out')),
      transition('* => void', animate('300ms ease-in'))
    ]),
    trigger('fadeInOut', [
      state('hidden', style({ opacity: 0 })),
      state('visible', style({ opacity: 1 })),
      transition('hidden => visible', animate('500ms ease-in')),
      transition('visible => hidden', animate('500ms ease-out'))
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 }))
      ])
    ])
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css'],
})
export class ProductDetailComponent implements OnInit {
  @ViewChild('contentContainer') contentEl!: ElementRef<HTMLElement>;
  openSection: 'description' | 'short' | 'size' | null = null;
  // your sanitized HTML inputs
  sanitizedDescription: SafeHtml;
  sanitizedShort: SafeHtml;
  sanitizedSize: SafeHtml;

  isExpanded = false;
  isOverflowing = false;
  // you can tweak this to control how many pixels = “collapsed”
  collapsedHeight = 172;
  loadingFavorite = false;
  private touchStartX = 0;
  private readonly swipeThreshold = 50; // v pixeloch
  isFavorite = false;

  animatedTotalPrice = 0;      // tá, ktorú budeme bindovať v šablóne
  private prevTotalPrice = 0;  // predchádzajúca hodnota (pre animáciu)
  private priceAnimSub?: Subscription;
  product: Product | null = null;
  selectedVariation: Product | null = null;
  quantity = 1;
  
  /** Zoznam URL pre galériu (medium aj large) */
  mediumImages: string[] = [];
  largeImages: string[] = [];
  otherImages: string[] = [];
  currentImage = '';
  isLoading = false;
  error = false;
  isFullscreen = false;
  fullscreenImage = '';
  fullscreenIndex = 0;

  loading: boolean = true;
  totalCount = 0;
  loadingBaseText = '';
  loadingText = '';
  dotCount = 1;
  dotInterval: any;
  // sanitizedDescription = '';
  fullscreenState: string = 'hidden'; // Pre animáciu slideUp

  currentIndex = 0;
  featured: Product[] = [];
  recommended: Product[] = [];
  
  /** Mapovanie URL → boolean pre shimmer loading */
  loadingMap: Record<string, boolean> = {};
  uniqueCategories: Category[] = [];

  toggle() {
    this.isExpanded = !this.isExpanded;
  }

  toggle_accordion(section: 'description' | 'short' | 'size') {
    this.openSection = this.openSection === section ? null : section;
  }
  constructor(
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private productsService: ProductsService,
    private cart: CartService,
    private translate: TranslateService,
    public auth: AuthService,
    private favState: FavoriteStateService,
    private router: Router,
    private cd: ChangeDetectorRef,
    private snack: MatSnackBar,
    private zone: NgZone,
    
  ) {
    const rawDesc = '<p>Full product description …</p>';
    const rawShort = '<p>Short summary …</p>';
    const rawSize = '<p>Size chart or info …</p>';

    this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(rawDesc);
    this.sanitizedShort       = this.sanitizer.bypassSecurityTrustHtml(rawShort);
    this.sanitizedSize        = this.sanitizer.bypassSecurityTrustHtml(rawSize);
  }

  showToast() {
    this.snack.open('Pridané do obľúbených', 'OK', { duration: 3000 });
  }
  // info(msg: string) {
  //   this.snack.open(msg, 'OK', { duration: 3000, panelClass: 'snack-info' });
  // }
  ngOnInit(): void {
    this.loading = true;
    this.route.paramMap
      .pipe(
        map(params => params.get('slug')),
        filter((slug): slug is string => !!slug),
        switchMap(slug => this.productsService.getProductWithVariations(slug))
      )
      .subscribe(
        rawResp => {
          const item = rawResp.data[0];
          if (item) {
            this.loadProduct(item);
            this.buildBreadcrumbs(item.categories ?? []);
            this.updateIsFavorite();
          }
          this.loading = false;
        },
        () => {
          this.loading = false;
        }
      );

    this.favState.favorites$.subscribe(() => this.updateIsFavorite());
  }

  private updateIsFavorite(): void {
    this.isFavorite = this.product ? this.favState.isFavorite(this.product.id) : false;
  }

  startLoadingDots() {
    this.translate.get('ESHOP.LOADING_PRODUCTS').subscribe(base => {
      this.loadingBaseText = base;
      this.loadingText = `${base}...`;
      this.dotCount = 1;
      clearInterval(this.dotInterval);
      this.dotInterval = setInterval(() => {
        this.dotCount = (this.dotCount % 3) + 1;
        const dots = '.'.repeat(this.dotCount);
        this.loadingText = `${this.loadingBaseText}${dots}`;
      }, 500);
    });
  }

  stopLoadingDots() {
    clearInterval(this.dotInterval);
    this.loadingText = '';
  }


  get targetTotalPrice(): number {
    return this.displayPrice * this.quantity;
  }


  private runPriceAnimation(from: number, to: number) {
    // ak už beží stará animácia, ukončíme ju
    this.priceAnimSub?.unsubscribe();
  
    const frames = 14;           // počet krokov animácie
    const duration = 500;        // ms celkom
    const stepTime = duration / frames;
    let frame = 0;
    const delta = to - from;
  
    // spustíme RxJS interval, ktorý každých stepTime ms nastaví novú cenu
    this.priceAnimSub = interval(stepTime)
      .pipe(take(frames + 1))
      .subscribe(() => {
        this.animatedTotalPrice = +(from + (delta * (frame / frames))).toFixed(2);
        frame++;
      });
  }

  onToggleFavorite(product: Product): void {
    console.log('🔹 [Component] product.id =', product.id, typeof product.id);

    this.auth.currentUser$.pipe(take(1)).subscribe(user => {
      if (!user) {

        this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
        return;
      }
    });
    
    this.loadingFavorite = true;
    const id = product.id;
    const wasFav = this.favState.isFavorite(id);
  
    this.favState.toggle(product);           // ← pošleme celý objekt
  
    this.favState.favorites$
      .pipe(skip(1), take(1))
      .subscribe({
        next: () => {
          this.loadingFavorite = false;
          this.snack.open(
            wasFav ? 'Položka vyradená z obľúbených'
                   : 'Položka pridaná do obľúbených',
            'OK',
            { duration: 3000 }
          );
        },
        error: () => (this.loadingFavorite = false)
      });
  }



  private loadProduct(item: Product) {
    // Resetting open sections and quantities
    this.openSection = null;
    this.quantity = 1;
    this.priceAnimSub?.unsubscribe();
  
    // Assign the fetched product
    this.product = item;
  
    // Determine the slug from the route
    const urlSlug = this.route.snapshot.paramMap.get('slug');
  
    // Select the appropriate variation based on the URL slug,
    // or fallback to the first variation if no match is found
    if (item.variations?.length) {
      if (urlSlug) {
        const matched = item.variations.find(v => v.slug === urlSlug);
        this.selectedVariation = matched ?? item.variations[0];
      } else {
        this.selectedVariation = item.variations[0];
      }
    } else {
      this.selectedVariation = null;
    }
  
    // Prepare sanitized HTML for UI
    this.prepareDescription();
    this.prepareShort();
  
    // Initialize animated price
    this.animatedTotalPrice = this.displayPrice * this.quantity;
  
    // Preload images to avoid shimmer on variation switch
    this.preloadAllVariationImages(item);
  
    // Build image galleries
    this.buildImageSets(item);
  
    // Set currentImage based on selected variation (or placeholder)
    if (this.selectedVariation) {
      const raw = this.selectedVariation.picture_new ?? null;
      if (raw) {
        // Pass empty fallback array so it won't pick parent images
        this.currentImage = this.productsService.imageUrl(raw, 'medium', []);
      } else {
        this.currentImage = '/assets/img/logo-SLM-modre.gif';
      }
    } else {
      this.currentImage = this.mediumImages[0] ?? '/assets/img/logo-SLM-modre.gif';
    }
    this.otherImages = [...this.mediumImages];
  
    // Show loading shimmer and dots
    this.isLoading = true;
    this.error = false;
    this.startLoadingDots();
  
    // Mark each medium image URL as loading
    this.loadingMap = {};
    this.mediumImages.forEach(url => {
      this.loadingMap[url] = true;
    });
  
    // Fetch related products
    this.productsService.getFeaturedProducts().subscribe(list => this.featured = list);
    // this.productsService.getRecommended(item).subscribe(list => this.recommended = list);
  
    // Scroll to top of the page
    window.scrollTo({ top: 0 });
  }
  
  


  incQuantity() {
    if (this.quantity < 99) {
      const oldQty = this.quantity;
      const newQty = oldQty + 1;
      const from = this.animatedTotalPrice;
      const to   = this.displayPrice * newQty;
      this.quantity = newQty;
      this.runPriceAnimation(from, to);
    }
  }
  
  decQuantity() {
    if (this.quantity > 1) {
      const oldQty = this.quantity;
      const newQty = oldQty - 1;
      const from = this.animatedTotalPrice;
      const to   = this.displayPrice * newQty;
      this.quantity = newQty;
      this.runPriceAnimation(from, to);
    }
  }
  
  /** 
   * Prednačíta do cache všetky obrázky z hlavného produktu aj zo všetkých variácií 
   * (medium i large), aby sme neskôr nemuseli zakaždým shimmerovať.
   */
  private preloadAllVariationImages(src: Product) {
    const allUrls = new Set<string>();

    const gatherUrls = (prod: Product) => {
      // primárny obrázok (medium + large)
      const picObj = this.findFirst(prod, p => p.picture_new) ?? null;
      if (picObj) {
        allUrls.add(this.productsService.imageUrl(picObj, 'medium'));
        allUrls.add(this.productsService.imageUrl(picObj, 'large'));
      }
      // galéria (medium + large)
      const galObj = this.findFirst(
        prod,
        p => (p.pictures_new?.data?.length || (Array.isArray(p.pictures_new) && p.pictures_new.length))
          ? p.pictures_new
          : null
      ) ?? null;
      if (galObj) {
        this.productsService.gallery(galObj, 'medium').forEach(u => allUrls.add(u));
        this.productsService.gallery(galObj, 'large').forEach(u => allUrls.add(u));
      }
    };

    gatherUrls(src);
    const recurse = (prod: Product) => {
      prod.variations?.forEach(v => {
        gatherUrls(v);
        recurse(v);
      });
    };
    recurse(src);

    // Vytvoríme JavaScriptové Image objekty, aby sa URL uložili do cache
    allUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }

  /** 
   * Vráti pár URL { medium, large } pre daný produkt (alebo z fallbacku, ak variácia nemá).
   */
  private collectImagePair(prod: Product, fallbackProd: Product): { medium: string; large: string } {
    const picObj = prod.picture_new ?? fallbackProd.picture_new ?? null;
    const medium = this.productsService.imageUrl(picObj, 'medium');
    const large = this.productsService.imageUrl(picObj, 'large');
    return { medium, large };
  }

  /**
   * Zostaví dve polia mediumImages[] a largeImages[] tak, aby obsahovali:
   * 1) obrázky z hlavného produktu,
   * 2) následne obrázky z každej variácie (alebo z fallbacku, ak variácia obrázok nemá),
   * 3) potom z prípadnej galérie (pictures_new) hlavného produktu a variácií,
   * pričom duplicitné URL odstráni.
   */
  private buildImageSets(src: Product) {
    // 1) Najprv vložíme primárny pair z hlavného produktu
    const allPairs: { medium: string; large: string }[] = [];
    const basePair = this.collectImagePair(src, src);
    allPairs.push(basePair);

    // 2) Z variácií – pre každú variáciu vložíme buď jej vlastný obrázok, alebo fallback (src)
    if (src.variations) {
      src.variations.forEach(v => {
        const pair = this.collectImagePair(v, src);
        allPairs.push(pair);
      });
    }

    // 3) Teraz vložíme “galériu” – najprv galéria hlavného produktu
    const mainGalleryObj = this.findFirst(
      src,
      p =>
        p.pictures_new?.data?.length ||
        (Array.isArray(p.pictures_new) && p.pictures_new.length)
          ? p.pictures_new
          : null
    );
    if (mainGalleryObj) {
      const medList = this.productsService.gallery(mainGalleryObj, 'medium');
      const largeList = this.productsService.gallery(mainGalleryObj, 'large');
      medList.forEach((m, i) => {
        allPairs.push({ medium: m, large: largeList[i] || m });
      });
    }

    // 4) Galéria z každej variácie (alebo obrázok fallbacku, ak variácia nemá galériu)
    if (src.variations) {
      src.variations.forEach(v => {
        const galObj = this.findFirst(
          v,
          p =>
            p.pictures_new?.data?.length ||
            (Array.isArray(p.pictures_new) && p.pictures_new.length)
              ? p.pictures_new
              : null
        );
        if (galObj) {
          const medList = this.productsService.gallery(galObj, 'medium');
          const largeList = this.productsService.gallery(galObj, 'large');
          medList.forEach((m, i) => {
            allPairs.push({ medium: m, large: largeList[i] || m });
          });
        }
      });
    }

    // 5) Odstránime duplicitné medium URL
    const seen = new Set<string>();
    this.mediumImages = [];
    this.largeImages = [];
    allPairs.forEach(pair => {
      if (!seen.has(pair.medium)) {
        seen.add(pair.medium);
        this.mediumImages.push(pair.medium);
        this.largeImages.push(pair.large);
      }
    });

    this.currentImage = this.mediumImages.length ? this.mediumImages[0] : '';
    this.otherImages = this.mediumImages.slice(0);
  }

  changeImage(url: string) {
    if (!url) return;
    this.currentImage = url;
  }
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;
  
  autoSlideInterval: any;
  startAutoSlide() {
    this.autoSlideInterval = setInterval(() => {
      const container = this.scrollContainer.nativeElement;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
  
      // Ak je na konci, skočí späť na začiatok
      if (container.scrollLeft >= maxScrollLeft) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: 300, behavior: 'smooth' });
      }
    }, 4000); // každé 4 sekundy
  }
  
  stopAutoSlide() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
  }
  scrollLeft() {
    this.scrollContainer.nativeElement.scrollBy({ left: -300, behavior: 'smooth' });
  }
  
  scrollRight() {
    this.scrollContainer.nativeElement.scrollBy({ left: 300, behavior: 'smooth' });
  }
  openFullscreen(url: string) {
    this.fullscreenIndex = this.mediumImages.indexOf(url);
    this.currentIndex = this.mediumImages.indexOf(url);
    if (this.fullscreenIndex === -1) this.fullscreenIndex = 0;
    this.fullscreenImage = this.largeImages[this.fullscreenIndex];
    this.isFullscreen = true;
    this.fullscreenState = 'visible'; // Spustí animáciu

  }
  
  closeFullscreen() {
    this.isFullscreen = false;
    this.fullscreenState = 'hidden';

  }
  prev(e: Event) {
    e.stopPropagation();
    this.fullscreenIndex =
      (this.fullscreenIndex - 1 + this.largeImages.length) % this.largeImages.length;
    this.fullscreenImage = this.largeImages[this.fullscreenIndex];
    this.currentIndex =  (this.currentIndex - 1 + this.largeImages.length) % this.largeImages.length;
  }
  next(e: Event) {
    e.stopPropagation();
    this.fullscreenIndex = (this.fullscreenIndex + 1) % this.largeImages.length;
    this.fullscreenImage = this.largeImages[this.fullscreenIndex];
    this.currentIndex = (this.currentIndex + 1) % this.largeImages.length;
  }
  // zachytí začiatok dotyku (iba keď je fullscreen otvorený)

  @HostListener('touchstart', ['$event'])
onTouchStart(e: TouchEvent) {
  if (this.isFullscreen) {
    this.touchStartX = e.changedTouches[0].clientX;
  }
}

// zachytí koniec dotyku a ak prekročíme prah, zavolá prev/next
@HostListener('touchend', ['$event'])
onTouchEnd(e: TouchEvent) {
  if (!this.isFullscreen) return;
  const endX = e.changedTouches[0].clientX;
  const delta = endX - this.touchStartX;
  if (delta > this.swipeThreshold) {
    this.prev(e);
  } else if (delta < -this.swipeThreshold) {
    this.next(e);
  }
}

  @HostListener('document:keydown.arrowleft', ['$event'])
  onLeft(e: KeyboardEvent) {
    if (this.isFullscreen) {
      e.preventDefault();
      this.prev(e);
    }
  }
  @HostListener('document:keydown.arrowright', ['$event'])
  onRight(e: KeyboardEvent) {
    if (this.isFullscreen) {
      e.preventDefault();
      this.next(e);
    }
  }
  @HostListener('document:keydown.escape')
  onEsc() {
    this.closeFullscreen();
  }

  /** ---------- VARIANTY ---------- */
  onVariationChange(v: Product) {
    this.selectedVariation = v;
    if (!this.product) return;

    // Pri prepnutí variácie meníme len currentImage, galériu nerezetujeme
    const pair = this.collectImagePair(v, this.product);
    this.currentImage = pair.medium;
  }

  // incQuantity() {
  //   if (this.quantity < 99) this.quantity++;
  // }
  // decQuantity() {
  //   if (this.quantity > 1) this.quantity--;
  // }

  get displayPrice(): number {
    return this.selectedVariation?.price ?? this.product?.price ?? 0;
  }
  get displayPriceFormatted(): string {
    return this.displayPrice.toFixed(2);
  }
  get totalPriceFormatted(): string {
    return (this.displayPrice * this.quantity).toFixed(2);
  }

  get IfProductInSale(): boolean {
    return this.selectedVariation?.inSale ?? false;
  }
  get displayPriceSale(): number {
    return this.selectedVariation?.price_sale ?? this.product?.price_sale ?? 0;
  }
  get displayPriceSaleFormatted(): string {
    return this.displayPriceSale.toFixed(2);
  }
  get totalPriceSaleFormatted(): string {
    if (this.IfProductInSale) {
      return (this.displayPriceSale * this.quantity).toFixed(2);
    } else {
      return '';
    }
  }

  getVariationLabel(name: string): string {
    const parts = name.split('-');
    return parts.length > 1 ? parts.slice(1).join(' ').trim() : '';
  }


  addToCart() {
    if (!this.product) return;
  
    // --- TU JE NOVÁ ČASŤ: fallback variácie → hlavný produkt → prvá galéria ---
    const variationImg = this.selectedVariation?.primaryImageUrl || '';
    const mainImg      = this.product.primaryImageUrl      || '';
    const galleryImg   = this.mediumImages.length 
                         ? this.mediumImages[0] 
                         : '';
  
    const imgToUse = variationImg || mainImg || galleryImg;
    // -----------------------------------------------------------------------
  
    const p = this.selectedVariation ?? this.product;
    this.cart.add(
      {
        id:    p.id,
        name:  p.name,
        slug:  p.slug,
        price: p.price ?? 0,
        img:   imgToUse
      },
      this.quantity
    );
  
    // Reset množstva a animácia ceny
    const from = this.animatedTotalPrice;
    this.quantity = 1;
    this.runPriceAnimation(from, this.displayPrice * this.quantity);
  }

  onImageLoad(url: string): void {
    this.loadingMap[url] = false;
  }
  onImageError(url: string): void {
    this.loadingMap[url] = false;
  }

  /** Pripraví čistý popis (čistí <span> tagy a "\n") */
  private prepareShort() {
    const raw = this.product?.short || '';
    const cleaned = raw
      .replace(/<span[^>]*>/gi, '')
      .replace(/<\/span>/gi, '')
      .replace(/\\n/g, '<br>')
      .trim();

    this.sanitizedShort = this.sanitizer.bypassSecurityTrustHtml(cleaned);

    this.zone.onStable.pipe(take(1)).subscribe(() => {
      const el = this.contentEl?.nativeElement;
      if (!el) return;

      this.isOverflowing = el.scrollHeight > this.collapsedHeight;
      this.cd.detectChanges();
    });
  }


  private prepareDescription() {
    const raw = this.product?.describe || '';
    const cleaned = raw
      .replace(/<span[^>]*>/gi, '')
      .replace(/<\/span>/gi, '')
      .replace(/\\n/g, '<br>')
      .trim();

    // stále vraciame SafeHtml
    this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(cleaned);

    /** 🔽 Spusti po tom, ako Angular dokončí vykreslenie */
    this.zone.onStable.pipe(take(1)).subscribe(() => {
      const el = this.contentEl?.nativeElement;
      if (!el) return;

      this.isOverflowing = el.scrollHeight > this.collapsedHeight;
      this.cd.detectChanges();      // ak používate ChangeDetectionStrategy.OnPush
    });
  }






  /** Pomocná metóda: rekurzívne hľadá prvú variáciu, ktorá má dané políčko */
  private findFirst<T>(
    root: Product,
    predicate: (p: Product) => T | null | undefined
  ): T | null {
    const res = predicate(root);
    if (res) return res;
    for (const v of root.variations ?? []) {
      const deep = this.findFirst(v, predicate);
      if (deep) return deep;
    }
    return null;
  }

  /**
   *  Vráti pole unikátnych (parent→child) kategórií, aby sme
   *  nevyhodili ten istý parent viackrát.
   */
  private buildBreadcrumbs(allCats: Category[]) {
    const seenPairs = new Set<string>();
    this.uniqueCategories = [];
  
    allCats.forEach(cat => {
      if (!cat.parent) {
        return;
      }
      // vytvoríme unikátny string „parentSlug→childSlug“
      const key = `${cat.parent.category_slug}→${cat.category_slug}`;
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        this.uniqueCategories.push(cat);
      }
    });
  }




}

/** Rozšírený typ Category, ktorý garantuje vlastnosť children */
interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}
