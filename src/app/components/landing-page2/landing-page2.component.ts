/* src/app/landing-page/landing-page2.component.ts */
import {
  Component,
  Input,
  OnInit,
  Inject,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';

import { Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LOCALE_ID } from '@angular/core';
import { LanguageService } from 'app/services/language.service';
import { EventSessionsService, EventSessionWithCapacity, BookingPayload } from 'app/services/event-sessions.service';
import { ProductsService, Product } from 'app/services/products.service';
import { Slide2sService, Slide2 } from 'app/services/slide2s.service';
import { FooterComponent } from 'app/components/footer/footer.component';
import { SafeUrlPipe } from 'app/shared/safe-url.pipe';
import { QueryList, ViewChildren } from '@angular/core';
import { formatDate } from '@angular/common';
import { CartService } from '../../services/cart.service';
import { take } from 'rxjs/operators';
import { AuthService, User } from 'app/services/auth.service';

import {
  trigger,
  state,
  style,
  transition,
  animate,
  stagger,
  query
} from '@angular/animations';

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isOccupied: boolean;
  isToday: boolean;
  isInCurrentMonth: boolean;
  isSelectable: boolean;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
    FooterComponent,
    // SafeUrlPipe
  ],
  animations: [
    trigger('fadeInStagger', [
      transition('* => *', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(15px)' }),
            stagger('100ms', animate('400ms ease-out',
              style({ opacity: 1, transform: 'translateY(0)' })
            )),
          ],
          { optional: true }
        ),
      ]),
    ]),
    trigger('fadeIn', [
      state('visible', style({ opacity: 1 })),
      transition('void => visible', [
        style({ opacity: 0 }),
        animate('0.5s ease-in'),
      ]),
    ]),
    trigger('slideUp', [
      state('visible', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => visible', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('0.4s ease-out'),
      ]),
    ]),
    trigger('slideDownUp', [
      state('closed', style({ height: '0px', opacity: 0, overflow: 'hidden' })),
      state('open', style({ height: '*', opacity: 1, overflow: 'hidden' })),
      transition('closed => open', [
        style({ height: '0px', opacity: 0 }),
        animate('350ms ease-out', style({ height: '*', opacity: 1 })),
      ]),
      transition('open => closed', [
        style({ height: '*', opacity: 1 }),
        animate('300ms ease-in', style({ height: '0px', opacity: 0 })),
      ]),
    ]),
    trigger('overlayAnimation', [
      transition('* => *', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('800ms 600ms ease-out',
                style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
    ]),
  ],
  templateUrl: './landing-page2.component.html',
  styleUrls: ['./landing-page2.component.css'],
})
export class LandingPage2Component implements OnInit, OnChanges, AfterViewInit, OnDestroy {

  // =========================
  // ✅ Locale helpers
  // =========================
  private currentLangCode(): string {
    return (this.lang.getCurrentLanguage() || 'sk').toLowerCase();
  }

  /** ✅ ak máš URL /en/... /de/... (SK bez prefixu) */
  private langPrefixSegments(): string[] {
    const l = this.currentLangCode();
    return l === 'sk' ? [] : [l];
  }

  /** ✅ bezpečný wrapper na navigáciu s prefixom jazyka */
  private nav(commands: any[], extras?: any): void {
    this.router.navigate([...this.langPrefixSegments(), ...commands], extras);
  }


private navigateToProductDetailByDocumentId(
  documentId: string,
  extras?: { date?: string; sessionId?: number }
): void {
  const locale = (this.lang.getCurrentLanguage() || 'sk').toLowerCase();

  this.productsService.getProductByDocumentIdForceLocale(documentId, locale).pipe(
    catchError(() => this.productsService.getProductByDocumentIdForceLocale(documentId, 'sk')),
    map(resp => this.productsService.extractFirst(resp)),
    catchError(() => of(null))
  ).subscribe(prod => {
    const slug = (prod?.slug ?? '').trim();

    console.log('[NAV] docId=', documentId, 'locale=', locale, 'slug=', slug, 'prod=', prod);

    if (!slug) return;

    this.router.navigate(['produkt', slug], {
      queryParams: {
        ...(extras?.date ? { date: extras.date } : {}),
        ...(extras?.sessionId != null ? { sessionId: extras.sessionId } : {}),
        documentId,
      },
      queryParamsHandling: '',
    });
  });
}


  // =========================
  // Date utils
  // =========================
  public toUTCDateString(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  isSameDay(a: Date | string, b: Date | string): boolean {
    const d1 = typeof a === 'string' ? new Date(a) : a;
    const d2 = typeof b === 'string' ? new Date(b) : b;
    return (
      d1.getUTCFullYear() === d2.getUTCFullYear() &&
      d1.getUTCMonth() === d2.getUTCMonth() &&
      d1.getUTCDate() === d2.getUTCDate()
    );
  }

  private toLocalDateString(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  @ViewChildren('slideVideo', { read: ElementRef })
  slideVideos!: QueryList<ElementRef<HTMLVideoElement>>;
  @Input() externalVideo!: string;
  safeUrl!: SafeResourceUrl;

  @ViewChild('slideVideo', { static: false })
  slideVideo!: ElementRef<HTMLVideoElement>;

  /* ---------------- SLIDER ---------------- */
  @ViewChild('sliderScroll', { static: false })
  sliderScroll!: ElementRef<HTMLDivElement>;
  animationState = false;

  slides: Slide2[] = [];
  currentSlideIndex = 0;
  private slidesSub?: Subscription;
  private autoId?: number;

  /** ✅ obrázky viaž radšej na product.documentId (stabilné medzi locale) */
  public sessionProductImages: Record<string, string> = {};

  /* -------- FEATURED‐PRODUCTS SCROLLER -------- */
  @ViewChild('scrollContainer', { static: false })
  scrollContainer!: ElementRef<HTMLDivElement>;
  private autoSlideInterval?: number;
  private resizeObserver?: ResizeObserver;
  private sliderInitialized = false;

  private initSliderIfReady(): void {
    if (this.sliderInitialized) return;
    const el = this.sliderScroll?.nativeElement;
    if (!el) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.scrollToSlide(this.currentSlideIndex);
    });
    this.resizeObserver.observe(el);

    this.sliderInitialized = true;
  }
  private scrollSyncTimeout?: number;

  /* ---------------- PRODUKTY & OSTATNÉ ---------------- */
  saleProducts: Product[] = [];
  featured: Product[] = [];
  experiences: Product[] = [];
  loadingMap: Record<string, boolean> = {};
  private saleSub?: Subscription;
  private expSub?: Subscription;
  imgState = 'hidden';

  /* ---------------- KALENDÁR ---------------- */
  calendarDays: CalendarDay[] = [];
  get weekDayDates(): Date[] {
    const base = new Date(Date.UTC(2021, 10, 1));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }

  currentMonth = new Date();
  selectedDay: CalendarDay | null = null;
  registration = { name: '', email: '' };

  loadingSessions = false;
  selectedSession: EventSessionWithCapacity | null = null;
  loading = false;
  bookingSuccess = false;
  errorMessage = '';
  sessionsForSelectedDay: EventSessionWithCapacity[] = [];
  bookingName = '';
  bookingEmail = '';
  feedback = '';
  feedbackKey='';

  private cartSub?: Subscription;
  holdTimer?: any;
  private cartBookingSub?: Subscription;

  authLoading = true;

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private slide2sService: Slide2sService,
    private sanitizer: DomSanitizer,
    private eventSessionsService: EventSessionsService,
    public lang: LanguageService,
    private cart: CartService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private translate: TranslateService,
    @Inject(LOCALE_ID) public locale: string
  ) {}

  // =========================
  // ✅ Experiences click -> documentId -> localized slug -> navigate with lang prefix
  // =========================
  public openExperienceByDocumentId(p: Product): void {
  const docId = (p as any)?.documentId;
  if (!docId) return;
  this.navigateToProductDetailByDocumentId(docId);
}

  // =========================
  // ✅ Session card: image loader via documentId
  // =========================
  loadProductImageForSession(session: EventSessionWithCapacity) {
    const docId = session.product?.documentId;
    if (!docId || this.sessionProductImages[docId]) return;

    const want = this.currentLangCode();

    this.productsService.getProductByDocumentIdForceLocale(docId, want).pipe(
      catchError(() => this.productsService.getProductByDocumentIdForceLocale(docId, 'sk')),
      map(resp => this.productsService.extractFirst(resp)),
      catchError(() => of(null))
    ).subscribe(prod => {
      if (prod?.primaryImageUrl) this.sessionProductImages[docId] = prod.primaryImageUrl;
    });
  }



public goToSession(session: EventSessionWithCapacity, ev?: Event): void {
  ev?.preventDefault();
  ev?.stopPropagation();

  const documentId = session.product?.documentId;
  if (!documentId) {
    console.warn('Missing session.product.documentId', session);
    return;
  }

  const dateStr = this.selectedDay
    ? this.toUTCDateString(this.selectedDay.date)
    : this.toUTCDateString(session.startDateTime);

  this.navigateToProductDetailByDocumentId(documentId, {
    date: dateStr,
    sessionId: session.id,
  });
}
  // =========================
  // (Optional) localized pick, but now we mainly rely on documentId-based fetches
  // =========================
  private pickLocalizedProduct(masterProduct: any): any {
    if (!masterProduct) return null;

    const want = (this.lang.getCurrentLanguage() || 'sk').toLowerCase();
    const masterLocale = (masterProduct.locale || '').toLowerCase();

    if (masterLocale === want) return masterProduct;

    const locs =
      masterProduct.localizations?.data ??
      masterProduct.localizations ??
      [];

    const hit = locs.find((x: any) =>
      ((x?.attributes?.locale ?? x?.locale ?? '') as string).toLowerCase() === want
    );

    return hit?.attributes ?? hit ?? masterProduct;
  }

  private setActiveVideoProps(): void {
    const videosArray = this.slideVideos.toArray();
    const activeVideo = videosArray[this.currentSlideIndex];
    if (activeVideo?.nativeElement) {
      const el = activeVideo.nativeElement;
      el.muted = true;
      el.volume = 0;
    }
  }

  public onVideoReady(event: Event): void {
    const video = event.target as HTMLVideoElement;
    video.muted = true;
    video.volume = 0;
  }

  public getSessionPrice(session: EventSessionWithCapacity): number {
    if (!session) return 0;
    if (session.product?.inSale === true) {
      return (session as any).price ?? session.product?.price_sale ?? 0;
    } else {
      return (session as any).price ?? session.product?.price ?? 0;
    }
  }

  isSelected(day: CalendarDay): boolean {
    return !!this.selectedDay && this.isSameDay(day.date, this.selectedDay.date);
  }

  public addDays(date: Date | string, days: number): Date {
    const d = typeof date === 'string' ? new Date(date) : new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  public selectDay(day: CalendarDay): void {
    if (!day.isSelectable) return;
    this.selectedDay = day;
    const utcDate = this.toUTCDateString(day.date);
    this.loadSessionsForDay(utcDate, true);
  }

  private loadSessionsForDay(date: string | Date | CalendarDay, forceReload = false) {
  const dateStr =
    typeof date === 'string' ? date :
    date instanceof Date ? this.toUTCDateString(date) :
    this.toUTCDateString(date.date);

  this.loadingSessions = true;

  const wantLocale = this.currentLangCode();

  this.eventSessionsService.listForDay(dateStr, forceReload).pipe(

    // 1) dedupe podľa product.documentId
    map((sessions) => {
      const res: EventSessionWithCapacity[] = [];
      const seen = new Set<string>();

      for (const s of (sessions ?? [])) {
        const docId = s.product?.documentId;
        if (docId) {
          if (seen.has(docId)) continue;
          seen.add(docId);
        }
        res.push(s);
      }

      return res;
    }),

    // 2) pre každý session dotiahni produkt v správnom locale podľa documentId
    switchMap((sessions) => {
      const calls = sessions.map((s) => {
        const docId = s.product?.documentId;
        if (!docId) return of(s);

        return this.productsService.getProductByDocumentIdForceLocale(docId, wantLocale).pipe(
          catchError(() => this.productsService.getProductByDocumentIdForceLocale(docId, 'sk')),
          map(resp => {
            const prod = this.productsService.extractFirst(resp);
            if (prod) s.product = prod; // ✅ prepíš na EN/DE/SK variant
            return s;
          }),
          catchError(() => of(s))
        );
      });

      return forkJoin(calls);
    })

  ).subscribe({
    next: (sessions) => {
      this.sessionsForSelectedDay = sessions ?? [];
      this.loadingSessions = false;
    },
    error: () => {
      this.loadingSessions = false;
      this.sessionsForSelectedDay = [];
    }
  });
}

  public stripSizePrefix(url?: string): string {
    if (!url) return '/assets/img/gall/placeholder.jpg';
    return url.replace(/(^|\/)(?:large_|medium_|small_|thumbnail_)(?=[^/]*$)/, '$1');
  }

  // =========================
  // Booking
  // =========================
  startBooking(session: EventSessionWithCapacity) {
    this.selectedSession = session;
    this.feedback = '';
    this.feedbackKey='';

    if (this.authLoading) {
      this.feedback = this.translate.instant('feedback.checking_auth');
      return;
    }
    if (!this.bookingName || !this.bookingEmail) {
      this.feedbackKey = 'login_required';
      this.feedback = this.translate.instant('feedback.login_required');
      return;
    }

    if ((session.capacity?.available || 0) <= 0) {
      this.feedback = this.translate.instant('feedback.season_full');
      return;
    }

    this.loadingSessions = true;
    const payload: BookingPayload = {
      session: session.id,
      peopleCount: 1,
      customerName: this.bookingName,
      customerEmail: this.bookingEmail,
      status: 'pending',
    };

    this.eventSessionsService.createBooking(payload).subscribe({
      next: (res) => {
        this.loadingSessions = false;
        this.feedback = '';

        if (session.capacity) {
          session.capacity.available = Math.max(0, session.capacity.available - 1);
        }

        const bookingId = res.id;
        const expireAt = Date.now() + 10 * 60 * 1000;

        // ✅ Na cart produkt ber podľa documentId -> správna lokalizácia
        const docId = session.product?.documentId;
        const locale = this.currentLangCode();

        if (docId) {
          this.productsService.getProductByDocumentIdForceLocale(docId, locale).pipe(
            catchError(() => this.productsService.getProductByDocumentIdForceLocale(docId, 'sk')),
            map(resp => this.productsService.extractFirst(resp)),
            catchError(() => of(null))
          ).subscribe(prod => {
            if (!prod) return;

            const variation = (prod as any).variations?.[0] ?? null;
            const img = variation?.primaryImageUrl || prod.primaryImageUrl || '';
            const id = variation?.id ?? prod.id;
            const name = prod.name;
            const productSlug = variation?.slug ?? prod.slug ?? '';

            this.cart.add(
              {
                id,
                name,
                slug: productSlug,
                price: this.getSessionPrice(session),
                img,
                price_sale: undefined,
                inSale: false,
                session,
                bookingId,
                holdExpires: expireAt,
              },
              1
            );
          });
        } else {
          // fallback bez docId
          this.cart.add(
            {
              id: session.id,
              name: session.product?.name || 'Session',
              slug: session.product?.slug || '',
              price: 0,
              img: '',
              price_sale: undefined,
              inSale: false,
              session,
              bookingId,
              holdExpires: expireAt,
            },
            1
          );
        }

        this.holdTimer && clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => {
          this.eventSessionsService.patchBooking(bookingId, { status: 'cancelled' }).subscribe();
          this.cart.removeByBooking(bookingId);

          this.snackBar.open('⏳ Reservation expired.', 'OK', {
            duration: 4000,
            panelClass: ['snack-info']
          });

          if (session.capacity) { session.capacity.available += 1; }
        }, 10 * 60 * 1000);
      },
      error: (_err) => {
        this.loadingSessions = false;
        this.feedback = 'Booking failed.';
      }
    });
  }

  // =========================
  // Angular lifecycle
  // =========================
  ngOnChanges(changes: SimpleChanges) {
    if (changes['externalVideo']) {
      const base = `https://www.youtube-nocookie.com/embed/${this.externalVideo}`;
      const params = [
        'autoplay=1',
        'mute=1',
        'controls=0',
        'modestbranding=1',
        'rel=0',
        'iv_load_policy=3'
      ].join('&');
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`${base}?${params}`);
    }
  }

  ngOnInit(): void {
    this.slide2sService.slides2$.subscribe(s => {
      this.slides = s;
    });

    this.slidesSub = this.slide2sService.getSlides()
      .pipe(catchError(() => of([] as Slide2[])))
      .subscribe(sl => {
        this.slides = sl;
        this.resumeAuto();
        setTimeout(() => this.initSliderIfReady(), 0);
      });

    this.eventSessionsService.bookingChanged$.subscribe(() => {
      if (this.selectedDay) {
        this.loadSessionsForDay(this.toUTCDateString(this.selectedDay.date), true);
      }
    });

    this.cartBookingSub = this.cart.bookingRemoved$.subscribe(_ => {
      if (this.selectedDay) {
        setTimeout(() => {
          if (this.selectedDay) {
            this.loadSessionsForDay(this.toUTCDateString(this.selectedDay!.date), true);
          }
        }, 250);
      }
    });

    this.auth.currentUser$.subscribe(user => {
      if (user) {
        this.bookingName = `${user.firstName} ${user.lastName}`.trim();
        this.bookingEmail = user.email;
        this.authLoading = false;
      } else {
        this.authLoading = false;
      }
    });

    this.loadSaleAndFeatured();
    this.loadExperiences();
    this.generateCalendar(this.currentMonth);

    setTimeout(() => {
      const todayDay = this.calendarDays.find(d => d.isToday);
      if (todayDay) {
        this.selectDay(todayDay);
      }
    }, 0);

    setTimeout(() => (this.imgState = 'visible'), 300);
  }

  ngAfterViewInit(): void {
    setTimeout(() => (this.animationState = true), 0);
    this.startAutoSlide();
    this.initSliderIfReady();
  }

  ngOnDestroy(): void {
    this.pauseAuto();
    this.stopAutoSlide();
    this.slidesSub?.unsubscribe();
    this.saleSub?.unsubscribe();
    this.expSub?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.cartBookingSub?.unsubscribe();
  }

  // =========================
  // Slider navigation
  // =========================
  public nextSlide(): void {
    if (!this.slides.length) return;
    this.pauseAuto();
    this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slides.length;
    this.scrollToSlide(this.currentSlideIndex);
    this.resumeAuto();
  }

  public prevSlide(): void {
    if (!this.slides.length) return;
    this.pauseAuto();
    this.currentSlideIndex = (this.currentSlideIndex - 1 + this.slides.length) % this.slides.length;
    this.scrollToSlide(this.currentSlideIndex);
    this.resumeAuto();
  }

  public goToSlide(index: number): void {
    if (!this.slides.length) return;
    this.pauseAuto();
    this.currentSlideIndex = index;
    this.scrollToSlide(index);
    this.resumeAuto();
  }

  private scrollToSlide(index: number): void {
    const el = this.sliderScroll?.nativeElement;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: 'smooth' });
    this.currentSlideIndex = index;
  }

  public pauseAuto(): void {
    if (this.autoId != null) {
      clearInterval(this.autoId);
      this.autoId = undefined;
    }
  }

  public resumeAuto(): void {
    if (this.autoId == null && this.slides.length) {
      this.autoId = window.setInterval(() => this.nextSlide(), 5000);
    }
  }

  public onSliderScroll = (): void => {
    this.pauseAuto();
    const el = this.sliderScroll?.nativeElement;
    if (!el) return;

    if (this.scrollSyncTimeout != null) clearTimeout(this.scrollSyncTimeout);
    this.scrollSyncTimeout = window.setTimeout(() => {
      const w = el.clientWidth || 1;
      const newIndex = Math.floor((el.scrollLeft + w * 0.3) / w);
      if (newIndex !== this.currentSlideIndex) this.currentSlideIndex = newIndex;
      this.resumeAuto();
    }, 100);
  };

  // =========================
  // Featured products auto-scroll
  // =========================
  public startAutoSlide(): void {
    if (!this.scrollContainer) return;
    if (this.autoSlideInterval != null) return;
    const container = this.scrollContainer.nativeElement;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    this.autoSlideInterval = window.setInterval(() => {
      if (container.scrollLeft >= maxScrollLeft) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: 300, behavior: 'smooth' });
      }
    }, 4000);
  }

  public stopAutoSlide(): void {
    if (this.autoSlideInterval != null) {
      clearInterval(this.autoSlideInterval);
      this.autoSlideInterval = undefined;
    }
  }

  public scrollLeft(): void {
    this.scrollContainer.nativeElement.scrollBy({ left: -300, behavior: 'smooth' });
  }

  public scrollRight(): void {
    this.scrollContainer.nativeElement.scrollBy({ left: 300, behavior: 'smooth' });
  }

  // =========================
  // Load products
  // =========================
  private loadSaleAndFeatured(): void {
    this.saleSub = this.productsService
      .getRootProducts('name:asc')
      .pipe(catchError(() => of({ data: [] } as any)))
      .subscribe(resp => {
        this.saleProducts = resp.data.filter((p: Product) => p.inSale);
        this.saleProducts.forEach(p => (this.loadingMap[p.slug] = true));
      });

    this.productsService.getFeaturedProducts().subscribe(list => {
      this.featured = list;
      setTimeout(() => this.startAutoSlide());
    });
  }

  /** ✅ experiences musí používať locale podľa aktívneho jazyka */
  private loadExperiences(): void {
    const locale = this.currentLangCode();

    this.expSub = this.productsService
      .getProductsByCategorySlug('zazitky', 'name:asc', 1, 20, locale)
      .pipe(
        map(r => r.data.slice(0, 6)),
        catchError(() => of([] as Product[]))
      )
      .subscribe(list => (this.experiences = list));
  }

  public onImageLoad(slug: string): void {
    this.loadingMap[slug] = false;
  }

  public onImageError(slug: string): void {
    this.loadingMap[slug] = false;
  }

  public openInNewTab(url: string): void {
    window.open(url, '_self', 'noopener');
  }

  /** ✅ aj tu zachovaj jazykový prefix */
  public goToLink(url: string): void {
    // pôvodne: this.router.navigateByUrl('/' + url);
    this.nav([url]);
  }

  /** ✅ login tiež s prefixom */
  public goToLogin(_url: string): void {
    // pôvodne: ['/login']
    this.nav(['login'], { queryParams: { returnUrl: this.router.url } });
  }

  // =========================
  // Calendar load helpers
  // =========================
  private loadSessionsForMonth(month: Date) {
    this.eventSessionsService.listForMonth(month).subscribe({
      next: sessions => {
        for (let day of this.calendarDays) {
          day.isOccupied = sessions.some(session => {
            const eventDateStr = this.toUTCDateString(session.startDateTime);
            const calendarDateStr = this.toUTCDateString(day.date);
            return eventDateStr === calendarDateStr;
          });
        }
      }
    });
  }

  private generateCalendar(reference: Date): void {
    const first = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
    const startMonday = new Date(first);
    startMonday.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    this.calendarDays = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startMonday);
      d.setUTCDate(startMonday.getUTCDate() + i);
      d.setUTCHours(0, 0, 0, 0);

      const inMonth = d.getUTCMonth() === reference.getUTCMonth() && d.getUTCFullYear() === reference.getUTCFullYear();
      const isToday = d.getTime() === today.getTime();

      this.calendarDays.push({
        date: d,
        dayOfMonth: d.getUTCDate(),
        isOccupied: false,
        isToday,
        isInCurrentMonth: inMonth,
        isSelectable: inMonth && d.getTime() >= today.getTime(),
      });
    }

    const startRaw = this.toUTCDateString(this.calendarDays[0].date);
    const end = this.toUTCDateString(this.calendarDays[this.calendarDays.length - 1].date);
    const todayStr = this.toUTCDateString(today);
    const start = startRaw < todayStr ? todayStr : startRaw;

    this.eventSessionsService.listForRange(start, end).subscribe({
      next: (sessions) => {
        for (let day of this.calendarDays) {
          const dayStr = this.toUTCDateString(day.date);
          if (dayStr >= todayStr) {
            day.isOccupied = sessions.some((session: any) => {
              const eventDateStr = this.toUTCDateString(session.startDateTime);
              return eventDateStr === dayStr;
            });
          } else {
            day.isOccupied = false;
          }
        }
      },
      error: (_err) => {}
    });
  }

  public prevMonth(): void {
    this.currentMonth = new Date(Date.UTC(
      this.currentMonth.getUTCFullYear(),
      this.currentMonth.getUTCMonth() - 1,
      1
    ));
    this.generateCalendar(this.currentMonth);
    this.selectedDay = this.calendarDays.find(d => d.isInCurrentMonth && d.dayOfMonth === 1) ?? null;

    if (this.selectedDay) {
      this.loadSessionsForDay(this.toUTCDateString(this.selectedDay.date), true);
    }
  }

  public async nextMonth(): Promise<void> {
    const y = this.currentMonth.getUTCFullYear();
    const m = this.currentMonth.getUTCMonth();
    this.currentMonth = new Date(Date.UTC(y, m + 1, 1));

    const prevSelectedDom = this.selectedDay?.dayOfMonth ?? 1;

    await this.generateCalendar(this.currentMonth);

    const inMonth = this.calendarDays.filter(d => d.isInCurrentMonth);
    this.selectedDay =
      inMonth.find(d => d.dayOfMonth === prevSelectedDom) ??
      inMonth.find(d => d.dayOfMonth === 1) ??
      inMonth.at(-1) ??
      null;

    if (this.selectedDay) {
      this.loadSessionsForDay(this.toUTCDateString(this.selectedDay.date), true);
    }
  }

  public submitRegistration(): void {
    if (!this.selectedDay) return;
    alert('Ďakujeme za registráciu!');
    this.registration = { name: '', email: '' };
    this.selectedDay = null;
  }

  /** ✅ aj toto musí ísť cez lang prefix */
  public onSelect(option: 'optionA' | 'optionB'): void {
    const params = option === 'optionB' ? { category: 'zazitky' } : { category: 'kolekcie' };
    this.nav(['produkt'], { queryParams: params });
  }
}