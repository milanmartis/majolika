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



  public toUTCDateString(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  isSameDay(a: Date | string, b: Date | string): boolean {
    const d1 = typeof a === 'string' ? new Date(a) : a;
    const d2 = typeof b === 'string' ? new Date(b) : b;
    // Porovnávaj podľa UTC, nie lokálne!
    return (
      d1.getUTCFullYear() === d2.getUTCFullYear() &&
      d1.getUTCMonth() === d2.getUTCMonth() &&
      d1.getUTCDate() === d2.getUTCDate()
    );
  }
  

  private toLocalDateString(date: Date | string): string {
    // Premeň na Date, ak je string
    const d = typeof date === 'string' ? new Date(date) : date;
    // Vezmi YYYY-MM-DD v lokálnom čase
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
  public sessionProductImages: Record<number, string> = {}; // podľa ID

  /* -------- FEATURED‐PRODUCTS SCROLLER -------- */
  @ViewChild('scrollContainer', { static: false })
  scrollContainer!: ElementRef<HTMLDivElement>;
  private autoSlideInterval?: number;

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

  // sessionsForSelectedDay: any[] = [];
  loadingSessions = false;
  selectedSession: EventSessionWithCapacity | null = null;
  // registration = { name: '', email: '' };
  loading = false;
  bookingSuccess = false;
  errorMessage = '';
  sessionsForSelectedDay: EventSessionWithCapacity[] = [];
  // loadingSessions = false;
  bookingName = '';
  bookingEmail = '';
  feedback = '';
  feedbackKey=''; 

  private cartSub?: Subscription;
  holdTimer?: any;
  private cartBookingSub?: Subscription;
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
  loadProductImageForSession(session: EventSessionWithCapacity) {
    const prod = session.product;
    if (!prod || !prod.id || this.sessionProductImages[prod.id]) return;
    this.productsService.getProductById(prod.id).subscribe(product => {
      if (product && product.primaryImageUrl) {
        this.sessionProductImages[prod.id] = product.primaryImageUrl;
      }
    });
  }
  private setActiveVideoProps(): void {
    // assuming currentSlideIndex corresponds to a slide that has a video
    const videosArray = this.slideVideos.toArray();
    const activeVideo = videosArray[this.currentSlideIndex];
    if (activeVideo?.nativeElement) {
      const el = activeVideo.nativeElement;
      el.muted = true;
      el.volume = 0;
      // you can also ensure autoplay/play etc. here if needed
    }
  }
  public onVideoReady(event: Event): void {
    const video = event.target as HTMLVideoElement;
    // istota že sa správne nastaví, zvlášť ak nechceš manipulovať cez ViewChild
    video.muted = true;
    video.volume = 0;
  }

  public getSessionPrice(session: EventSessionWithCapacity): number {
    // priorita: session.price > session.product.price > 0
    // ak session.price neexistuje, použije cenu produktu
    if (!session) return 0;
  if (session.product?.inSale === true) {
    return (session as any).price ?? session.product?.price_sale ?? 0;
  }else{
    return (session as any).price ?? session.product?.price ?? 0;
  }
    // return session.price;
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
  // pre filter použijeme UTC dátum (len deň, bez času)
  const utcDate = this.toUTCDateString(day.date);
  this.loadSessionsForDay(utcDate, true);
}

private loadSessionsForDay(date: string, forceReload = false) {
  this.loadingSessions = true;
  this.eventSessionsService.listForDay(date, forceReload).subscribe({
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



  startBooking(session: EventSessionWithCapacity) {
    this.selectedSession = session;
    this.feedback = '';
    this.feedbackKey=''; 

  if (this.authLoading) {
    this.feedback = this.translate.instant('feedback.checking_auth'); // kľúč podľa tvojho i18n
    return;
  }
  if (!this.bookingName || !this.bookingEmail) {
    this.feedbackKey = 'login_required'; // ... atď.

    this.feedback = this.translate.instant('feedback.login_required');
    return;
  }
  
    if ((session.capacity?.available || 0) <= 0) {
      this.feedback =  this.translate.instant('feedback.season_full');
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
  
        // Načítaj produkt, ak je k session priradený
        const slug = session.product?.slug;
        console.log('Session product slug:', slug);
        if (slug) {
          this.productsService.getProductWithVariations(slug).pipe(
            catchError(() => of(null))
          ).subscribe(prodResp => {
            const prod: Product | null = prodResp?.data?.[0] ?? null;
            if (!prod) return;
  
            const variation = prod.variations?.[0] ?? null;
            const price = variation?.price ?? prod.price ?? 0;
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
                price_sale: undefined, // alebo cenu ak vieš
                inSale: false, // alebo true podľa logiky, session zvyčajne false
                session,
                bookingId,
                holdExpires: expireAt,
              },
              1
            );
          });
        } else {
          // fallback bez detailu produktu
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
  
        // automatické uvoľnenie po 10 minútach
        this.holdTimer && clearTimeout(this.holdTimer);
this.holdTimer = setTimeout(() => {
  this.eventSessionsService.patchBooking(bookingId, { status: 'cancelled' }).subscribe();
  this.cart.removeByBooking(bookingId);

  // Zobraz snack bar informáciu
  this.snackBar.open('⏳ Reservation expired.', 'OK', {
    duration: 4000,
    panelClass: ['snack-info'] // alebo snack-error, podľa dizajnu
  });

  if (session.capacity) { session.capacity.available += 1; }
}, 10 * 60 * 1000); // alebo 1 * 60 * 1000 pre 1 minutu na testovanie
      },
      error: (err) => {
        this.loadingSessions = false;
        this.feedback = 'Booking failed.';
        console.error(err);
      }
    });
  }
  
  

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

  authLoading = true;

  ngOnInit(): void {

    this.slide2sService.slides2$.subscribe(slides2 => {
      this.slides = slides2;
      this.resumeAuto(); // ak treba reštartovať auto-slide pri zmene
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




    // this.slidesSub = this.slide2sService
    //   .getSlides()
    //   .pipe(catchError(() => of([] as Slide2[])))
    //   .subscribe(sl => {
    //     this.slides = sl;
    //     this.resumeAuto();
    //   });
  
    this.loadSaleAndFeatured();
    this.loadExperiences();
    this.generateCalendar(this.currentMonth);

    setTimeout(() => {
      const todayDay = this.calendarDays.find(d => d.isToday);
      if (todayDay) {
        this.selectDay(todayDay); // toto zavolá aj loadSessionsForDay
      }
    }, 0);
  
    setTimeout(() => (this.imgState = 'visible'), 300);
  }

  ngAfterViewInit(): void {
    // this.startAutoSlide();
    setTimeout(() => (this.animationState = true), 0);
    const el = this.slideVideo.nativeElement;
    el.muted = true;      // property
    el.volume = 0;        // rezerva
  }



  ngOnDestroy(): void {
    this.pauseAuto();
    this.stopAutoSlide();
    this.slidesSub?.unsubscribe();
    this.saleSub?.unsubscribe();
    this.expSub?.unsubscribe();
    this.cartSub?.unsubscribe();
    this.cartBookingSub?.unsubscribe();

  }

  // Slider navigation
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
    const el = this.sliderScroll.nativeElement;
    el.scrollTo({ left: el.offsetWidth * index, behavior: 'smooth' });
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

  // Featured products auto-scroll
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

  // Load products
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

  private loadExperiences(): void {
    this.expSub = this.productsService
      .getProductsByCategorySlug('zazitky', 'name:asc')
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

  public goToLink(url: string): void {
    this.router.navigateByUrl('/' + url);
  }


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
    // 1. deň mesiaca v UTC
    const first = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
    const startMonday = new Date(first);
    startMonday.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    
    // Dnes v UTC (polnoc)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
  
    this.calendarDays = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startMonday);
      d.setUTCDate(startMonday.getUTCDate() + i);
      d.setUTCHours(0, 0, 0, 0); // UTC polnoc!
  
      const inMonth = d.getUTCMonth() === reference.getUTCMonth() && d.getUTCFullYear() === reference.getUTCFullYear();
      const isToday = d.getTime() === today.getTime();
      this.calendarDays.push({
        date: d,
        dayOfMonth: d.getUTCDate(),
        isOccupied: false,
        isToday,
        isInCurrentMonth: inMonth,
        isSelectable: inMonth,
      });
    }
  
    // Tu volaj nový endpoint podľa aktuálneho zobrazeného mesiaca
    const start = this.toUTCDateString(this.calendarDays[0].date);            // prvý deň v kalendári
    const end = this.toUTCDateString(this.calendarDays[this.calendarDays.length - 1].date);  // posledný deň
  
    this.eventSessionsService.listForRange(start, end).subscribe({
      next: (sessions) => {
        for (let day of this.calendarDays) {
          day.isOccupied = sessions.some((session: any) => {
            const eventDateStr = this.toUTCDateString(session.startDateTime);
            const calendarDateStr = this.toUTCDateString(day.date);
            return eventDateStr === calendarDateStr;
          });
        }
      },
      error: (err) => {
        // príp. log/feedback
        console.warn('Chyba pri načítaní sessions:', err);
      }
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
  }
  
  public nextMonth(): void {
    this.currentMonth = new Date(Date.UTC(
      this.currentMonth.getUTCFullYear(),
      this.currentMonth.getUTCMonth() + 1,
      1
    ));
    this.generateCalendar(this.currentMonth);
    this.selectedDay = this.calendarDays.find(d => d.isInCurrentMonth && d.dayOfMonth === 1) ?? null;
  }

  // public selectDay(day: CalendarDay): void {
  //   if (!day.isSelectable) return;
  //   this.selectedDay = day;
  // }

  public submitRegistration(): void {
    if (!this.selectedDay) return;
    alert('Ďakujeme za registráciu!');
    this.registration = { name: '', email: '' };
    this.selectedDay = null;
  }

  // Navigation cards
  public onSelect(option: 'optionA' | 'optionB'): void {
    const params = option === 'optionB' ? { category: 'zazitky' } : { category: 'kolekcie' };
    this.router.navigate(['/eshop'], { queryParams: params });
  }

  // public selectDay(day: CalendarDay): void {
  //   if (!day.isSelectable) return;
  //   this.selectedDay = day;
  //   this.loadSessionsForDate(day.date);
  // }
}
