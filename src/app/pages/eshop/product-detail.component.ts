// src/app/pages/eshop/product-detail.component.ts
// © 2025 – Slovenská ľudová majolika

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule, DOCUMENT }   from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgZone } from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule }    from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { switchMap,  map, filter, takeUntil } from 'rxjs/operators';
import { interval, Subscription } from 'rxjs';
import { take, skip } from 'rxjs/operators';
import { ProductsService, Product, Category } from '../../services/products.service';
import { CartService } from '../../services/cart.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalendarLinkService, EventSessionDto } from 'app/services/calendar-link.service';

import { MaterialModule } from 'app/material.module';
import { ZoomPanDirective } from 'app/pages/eshop/zoom-pan.directive';
import { slideFullscreenAnimation } from 'app/animations/route.animations';
import { FavoriteStateService } from 'app/services/favorite-state.service';
import { AuthService } from 'app/services/auth.service';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ShareButtonsComponent } from 'app/shared/share-buttons/share-buttons.component'; 
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { EventSessionsService, EventSessionWithCapacity, BookingPayload } from 'app/services/event-sessions.service';
import { Subject } from 'rxjs';

import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import skLocale from '@fullcalendar/core/locales/sk';
import enGbLocale from '@fullcalendar/core/locales/en-gb';
import deLocale from '@fullcalendar/core/locales/de'; 
// this.calendarOptions = { locale: 'sk', locales: [skLocale], /* ... */ };
import { Meta, Title } from '@angular/platform-browser';
import { Inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

type FCSessionProps = { session: EventSessionWithCapacity };

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
    MatProgressSpinnerModule,
    ShareButtonsComponent,
    FullCalendarModule,
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

  isBrowser = false;

  articleUrl = '';

private mapLangToFcLocale(lang?: string): string {
  const norm = (lang || 'sk').toLowerCase();
  if (norm.startsWith('en')) return 'en-gb';
  if (norm.startsWith('de')) return 'de';
  return 'sk'; // default
}
private getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
private todayStr = this.getLocalDateStr(new Date());

private applyCalendarLocale(lang?: string): void {
  const fcLocale = this.mapLangToFcLocale(lang);
  this.calendarOptions = {
    ...this.calendarOptions,
    locale: fcLocale,
    firstDay: 1,
    // ✅ zablokuj všetky dátumy pred dneškom (budú sivé a neklikateľné)
    validRange: { start: this.todayStr },
  };
}

// helper na kľúč dátumu v lokálnom čase
private dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
private dayCellEls = new Map<string, HTMLElement>();

calendarOptions: CalendarOptions = {
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
  initialView: 'dayGridMonth',
  locales: [skLocale, enGbLocale, deLocale],
  firstDay: 1,
  height: 'auto',
  expandRows: false,                 // ⬅️ riadky podľa obsahu (dôležité)
  dayMaxEvents: true,
  stickyHeaderDates: true,
  headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
  buttonText: { today: 'Dnes', month: 'Mesiac', week: 'Týždeň', day: 'Deň', list: 'Zoznam' },

  // mapuj bunky podľa dátumu
  dayCellDidMount: (arg) => {
    const key = this.dateKey(arg.date);
    this.dayCellEls.set(key, arg.el as HTMLElement);
    arg.el.classList.add('no-ev'); // default: prázdna
  },

  // po načítaní eventov označ dni s eventom
  eventsSet: (events) => {
    const withEvents = new Set<string>();
    events.forEach(e => {
      if (e.start) withEvents.add(this.dateKey(e.start));
      // ak by boli viacdňové eventy, tu by sa doplnili aj medzidni
    });

    for (const [key, el] of this.dayCellEls.entries()) {
      if (withEvents.has(key)) {
        el.classList.add('has-ev');
        el.classList.remove('no-ev');
      } else {
        el.classList.add('no-ev');
        el.classList.remove('has-ev');
      }
    }
  },

  // pri zmene mesiaca premapuj bunky nanovo
  datesSet: () => { this.dayCellEls.clear(); },

  eventClick: (arg) => this.onCalendarEventClick(arg),

  eventClassNames: (arg) => {
    const s = (arg.event.extendedProps as FCSessionProps)['session'];
    const cls: string[] = [];
    if (s) {
      const avail = s.capacity?.available ?? 0;
      if (avail === 0) cls.push('sold-out');
      else if (avail <= 3) cls.push('low-availability');
    }
    return cls;
  },

  eventContent: (arg) => {
    const s = (arg.event.extendedProps as FCSessionProps)['session'];
    const startStr = this.formatTime(arg.event.start!);
    const timeHtml = `<span class="t">${startStr}</span>`;
    const avail = s?.capacity?.available;

    if (arg.view.type === 'dayGridMonth') {
      const capHtml = (avail ?? null) !== null
        ? `<span class="cap ${avail! > 0 ? '' : 'cap-sold'}">${avail! > 0 ? (avail + '') : 'X'}</span>`
        : '';
      return { html: `<div class="m-ev">${timeHtml}${capHtml}</div>` };
    }

    const safeTitle = (arg.event.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return {
      html: `
        <div class="w-ev">
          ${timeHtml}
          ${safeTitle ? `<span class="ttl">${safeTitle}</span>` : ''}
          ${ (avail ?? null) !== null ? `<span class="cap ${avail! > 0 ? '' : 'cap-sold'}">${avail! > 0 ? (avail + ' voľ.') : 'Vypredané'}</span>` : '' }
        </div>`
    };
  },

  events: [],
};

  // articleUrl = window.location.href; 

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
  animatedTotalPriceSale = 0;
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
  // favIds = new Set<number>();
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

//////bookovanie udalostí
sessions: EventSessionWithCapacity[] = [];
selectedSession: EventSessionWithCapacity | null = null;
booking = { name: '', email: '' };
bookingLoading = false;
bookingError = '';
bookingSuccess = '';
holdTimer?: any; // for auto release
private destroyed$ = new Subject<void>();




private toCalendarEvents(sessions: EventSessionWithCapacity[]): EventInput[] {
  return sessions.map((s) => {
    const startISO = s.startDateTime;
    const durationMin = s.durationMinutes ?? 60;
    const endISO = this.addMinutes(startISO, durationMin);

    return {
      id: String(s.id),
      // nechajme krátky názov (alebo prázdny) – mesiac view ho aj tak neukáže
      title: s.title || s.product?.name || '',
      start: startISO,
      end: endISO,
      display: 'block',
      extendedProps: { session: s },
    };
  });
}

private addMinutes(start: string | Date, minutes: number): Date {
  const d = new Date(start);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

private formatTime(d: string | Date): string {
  const date = new Date(d);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}


  toggle() {
    this.isExpanded = !this.isExpanded;
  }

  // isFav(p: Product): boolean {
  //   return this.favIds.has(Number(p.id));
  // }

  toggle_accordion(section: 'description' | 'short' | 'size') {
    this.openSection = this.openSection === section ? null : section;
  }
  constructor(
    private sanitizer: DomSanitizer,
    public route: ActivatedRoute,
    private productsService: ProductsService,
    private cart: CartService,
    private translate: TranslateService,
    public auth: AuthService,
    private favState: FavoriteStateService,
    private router: Router,
    private cd: ChangeDetectorRef,
    private snack: MatSnackBar,
    private zone: NgZone,
    private sessionsService: EventSessionsService,
    public cal: CalendarLinkService,
      private meta: Meta,
  private titleSvc: Title,
  @Inject(PLATFORM_ID) private platformId: Object,
  @Inject(DOCUMENT) private doc: Document
    
    
  ) {
    const rawDesc = '<p>Full product description …</p>';
    const rawShort = '<p>Short summary …</p>';
    const rawSize = '<p>Size chart or info …</p>';

    this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(rawDesc);
    this.sanitizedShort       = this.sanitizer.bypassSecurityTrustHtml(rawShort);
    this.sanitizedSize        = this.sanitizer.bypassSecurityTrustHtml(rawSize);
    this.isBrowser = isPlatformBrowser(this.platformId);
  }


  // public selectedSession: EventSessionWithCapacity | null = null;
public sessionQty: number = 1;

onSessionChange(session: EventSessionWithCapacity) {
  this.selectedSession = session;
  this.sessionQty = 1; // resetni na začiatku
}

onLoginSuccess() {
  // Predpoklad: login už prebehol úspešne, už máš usera
  const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
  this.router.navigateByUrl(returnUrl);
}

addSessionToCart(session: EventSessionWithCapacity, qty: number) {
  this.cart.add({
    id: session.id,
    name: session.title || 'Termín',
    slug: session.product?.slug || '',
    price: 0, // alebo reálnu cenu
    price_sale: undefined, // povinné podľa CartRow definície (aj keď undefined)
    inSale: false, // session termíny nemajú zľavu, tak false
    img: session.product?.primaryImageUrl || '',
    session,
  }, qty);
}

  isExperienceSession(s: EventSessionWithCapacity): boolean {
    return s.type === 'workshop' || s.type === 'tour';
  }
  isExperienceProduct(prod: Product | null): boolean {
    if (!prod?.categories?.length) return false;
    // Ak má produkt kategóriu, ktorá je pod "zazitky" a má slug "prehliadky" alebo "dielna"
    return prod.categories.some(cat =>
      (cat.parent?.category_slug === 'zazitky') &&
      (cat.category_slug === 'prehliadky' || cat.category_slug === 'dielne' || cat.category_slug === 'dielna')
    );
  }

  showToast() {
    this.snack.open('Pridané do obľúbených', 'OK', { duration: 3000 });
  }
  // info(msg: string) {
  //   this.snack.open(msg, 'OK', { duration: 3000, panelClass: 'snack-info' });
  // }
  
  

ngOnInit(): void {

if (this.isBrowser) {
  window.scrollTo({ top: 0 });
}



  this.loading = true;

this.applyCalendarLocale(this.translate.currentLang);

// pri zmene
this.translate.onLangChange
  .pipe(takeUntil(this.destroyed$))
  .subscribe(e => this.applyCalendarLocale(e.lang));

  // Reakcia na zmenu bookingov
  this.sessionsService.bookingChanged$
    .pipe(takeUntil(this.destroyed$))
    .subscribe(() => {
      if (this.product) {
        this.sessionsService.getSessionsForProduct(this.product.slug)
          .subscribe((list: EventSessionWithCapacity[]) => {
            this.sessions = list;

            // Uprav vybraný session, ak sa medzičasom zmenil/naplnil
            if (this.selectedSession) {
              const updated = list.find(s => s.id === this.selectedSession!.id);
              if (!updated || (updated.capacity?.available ?? 0) <= 0) {
                this.selectedSession = null;
              } else {
                this.selectedSession = updated;
              }
            }

            // Refresh FullCalendar eventov
            this.calendarOptions = {
              ...this.calendarOptions,
              events: this.toCalendarEvents(this.sessions),
            };

            this.cd.markForCheck(); // ak používaš OnPush
          });
      }
    });

  // Hlavný tok: načítaj produkt → potom jeho sessions
  this.route.paramMap
    .pipe(
      map(params => params.get('slug')),
      filter((slug): slug is string => !!slug),

      switchMap(slug =>
        this.productsService.getProductWithVariations(slug).pipe(
          map(rawResp => ({ product: rawResp.data[0], slug }))
        )
      ),

      tap(({ product }) => {
        if (product) {
          this.loadProduct(product);
          this.buildBreadcrumbs(product.categories ?? []);
          this.updateIsFavorite();
          this.setSeo(product, product.slug);
        }
      }),

      switchMap(({ product, slug }) =>
        product
          ? this.sessionsService.getSessionsForProduct(slug)
          : of<EventSessionWithCapacity[]>([]) // ⬅️ dôležité
      ),

      tap((list: EventSessionWithCapacity[]) => {
        this.sessions = list;

        // Refresh FullCalendar eventov
        this.calendarOptions = {
          ...this.calendarOptions,
          events: this.toCalendarEvents(this.sessions),
        };

        this.loading = false;
      }),

      catchError(() => {
        this.loading = false;
        return of<EventSessionWithCapacity[]>([]); // ⬅️ dôležité
      }),

      takeUntil(this.destroyed$)
    )
    .subscribe();

  // Obľúbené
  this.favState.favorites$
    .pipe(takeUntil(this.destroyed$))
    .subscribe(() => this.updateIsFavorite());
}


/** Nastaví <title>, OG/Twitter meta a canonical tak, aby to videl aj SSR/crawleri */
private setSeo(product: Product, slug: string): void {
  const siteUrl = (environment.frontendUrl || '').replace(/\/$/, '');
  const apiUrl  = (environment.apiUrl  || '').replace(/\/$/, '');

  // URL detailu – uprav, ak máš inú routu (napr. '/produkt/')
  const url  = `${siteUrl}/product/${slug}`;

  // Názov/desc/obrázok – fallbacky, aby nikdy neboli prázdne
  const name = (product.seoTitle || product.name || '').trim();
  const desc = (product.seoDescription || product.short || '')
                .replace(/<[^>]+>/g, '') // strip HTML
                .trim()
                .slice(0, 160);

  // preferuj SEO obrázok; ak nemáš, skús primaryImageUrl
  const rawImg = (product as any).seoImageUrl || product.primaryImageUrl || '';
  const img = this.absUrl(rawImg, apiUrl);

  // title
  if (name) this.titleSvc.setTitle(name);

  // Open Graph
  this.meta.updateTag({ property: 'og:type',        content: 'product' });
  if (name) this.meta.updateTag({ property: 'og:title',       content: name });
  if (desc) this.meta.updateTag({ property: 'og:description', content: desc });
  if (img)  this.meta.updateTag({ property: 'og:image',       content: img });
  this.meta.updateTag({ property: 'og:url',         content: url });

  // Twitter
  this.meta.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
  if (name) this.meta.updateTag({ name: 'twitter:title',       content: name });
  if (desc) this.meta.updateTag({ name: 'twitter:description', content: desc });
  if (img)  this.meta.updateTag({ name: 'twitter:image',       content: img });

  // canonical
  let linkEl = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!linkEl) {
    linkEl = this.doc.createElement('link');
    linkEl.setAttribute('rel', 'canonical');
    this.doc.head.appendChild(linkEl);
  }
  linkEl.setAttribute('href', url);

  // pre ShareButtons a pod.
  this.articleUrl = url;
}

/** Absolutizuje URL (Strapi často vracia relatívne /uploads/...) */
private absUrl(u: string | null | undefined, apiBase: string): string {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const base = apiBase || '';
  const sep  = u.startsWith('/') ? '' : '/';
  return `${base}${sep}${u}`;
}
  
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  

/** Pomôcka: bezpečne nastaví available pre daný session + zosynchronizuje pole sessions a FullCalendar */
private setCapacityAvailable(sess: EventSessionWithCapacity, nextAvail: number): void {
  // 1) prepíš referenciu, ktorú drží FullCalendar/extendedProps
  if (sess.capacity) {
    sess.capacity.available = nextAvail; // non-null v našom modeli, ale pre istotu guard
  }

  // 2) prepíš záznam v sessions[] tak, aby ostal typ EventSessionWithCapacity
  this.sessions = this.sessions.map((s): EventSessionWithCapacity =>
    s.id === sess.id
      ? ({ ...s, capacity: { ...s.capacity!, available: nextAvail } })
      : s
  );

  // 3) refresh FullCalendar eventov
  this.calendarOptions = {
    ...this.calendarOptions,
    events: this.toCalendarEvents(this.sessions),
  };
  this.cd.markForCheck();
}

  private loadSessionsForProduct(product: Product) {
    // Ak máš endpoint na všetky sessions pre produkt, použijeme ho.
    // Ak nie, tak načítame sessions pre dnes a vyfiltrujeme podľa slugu:
    this.sessionsService.listForDay(new Date()).subscribe({
      next: sessions => {
        this.sessions = sessions.filter(s =>
          s.product?.slug === product.slug ||
          (this.selectedVariation && s.product?.slug === this.selectedVariation.slug)
        );
      },
      error: () => { this.sessions = []; }
    });
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



onCalendarEventClick(arg: any) {
  const s: EventSessionWithCapacity | undefined = arg?.event?.extendedProps?.session;
  if (!s) return;

  this.selectedSession = s;
  const qty = Math.min(this.sessionQty || 1, s.capacity?.available ?? 1);

  if ((s.capacity?.available ?? 0) < 1) {
    this.snack.open(this.translate.instant('Termín je vypredaný'), 'OK', { duration: 2500 });
    return;
  }

  // vytvor pending booking a hneď uprav lokálnu kapacitu
  this.startBooking(s, qty);
}

startBooking(session: EventSessionWithCapacity, qty: number = 1) {
  this.selectedSession = session;
  this.bookingError = '';
  this.bookingSuccess = '';

  const name = this.booking.name || 'Návštevník';
  const email = this.booking.email || 'test@test.sk';

  if (!name || !email) { this.bookingError = 'Meno a email sú povinné.'; return; }
  if ((session.capacity?.available ?? 0) < qty) { this.bookingError = 'Kapacita je plná.'; return; }

  this.bookingLoading = true;
  const payload: BookingPayload = {
    session: session.id,
    peopleCount: qty,
    customerName: name,
    customerEmail: email,
    status: 'pending',
  };

  this.sessionsService.createBooking(payload).subscribe({
    next: bookingRes => {
      this.bookingLoading = false;
      this.bookingSuccess = 'Rezervácia vytvorená!';

      // --- okamžite zníž kapacitu lokálne (bez straty booked/max) ---
      const currentAvail = session.capacity?.available ?? 0;
      const newAvail = Math.max(0, currentAvail - qty);
      this.setCapacityAvailable(session, newAvail);

      // vlož do košíka (s bookingId + expiráciou)
      const expireAt = Date.now() + 10 * 60 * 1000;
      this.cart.add(
        {
          id: this.selectedVariation?.id ?? this.product?.id ?? session.id,
          name: this.product?.name ?? session.title,
          slug: this.selectedVariation?.slug ?? this.product?.slug ?? '',
          img: this.currentImage,
          price: this.getSessionPrice(session),
          price_sale: undefined,
          inSale: false,
          qty,
          session,
          bookingId: bookingRes.id,
          holdExpires: expireAt,
        } as any,
        qty
      );

      // auto-cancel po 10 min – vráť kapacitu späť a refreshni kalendár
      this.holdTimer && clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(() => {
        this.sessionsService.patchBooking(bookingRes.id, { status: 'cancelled' }).subscribe();
        this.cart.removeByBooking(bookingRes.id);
        this.bookingError = 'Rezervácia vypršala.';
        this.bookingSuccess = '';

        // zober aktuálny available (ak sa medzičasom menil), inak použi newAvail
        const nowAvail = this.sessions.find(s => s.id === session.id)?.capacity?.available ?? newAvail;
        this.setCapacityAvailable(session, nowAvail + qty);
      }, 10 * 60 * 1000);
    },
    error: _err => {
      this.bookingLoading = false;
      this.bookingError = 'Chyba pri vytváraní rezervácie.';
    }
  });
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


  private runTotalsAnimation(fromReg: number, toReg: number, fromSale: number, toSale: number) {
    this.priceAnimSub?.unsubscribe();

    const frames = 14;
    const duration = 500;
    const stepTime = duration / frames;
    let frame = 0;

    const deltaReg = toReg - fromReg;
    const deltaSale = toSale - fromSale;

    this.priceAnimSub = interval(stepTime)
      .pipe(take(frames + 1))
      .subscribe(() => {
        const t = frame / frames;
        this.animatedTotalPrice = +(fromReg + deltaReg * t).toFixed(2);
        this.animatedTotalPriceSale = +(fromSale + deltaSale * t).toFixed(2);
        frame++;
      });
  }

  onToggleFavorite(product: Product): void {
  this.auth.currentUser$.pipe(take(1)).subscribe(user => {
    if (!user) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.loadingFavorite) return; // double-click guard v komponente
    this.loadingFavorite = true;

    // sledovanie skončí cez stream favorites$ (prepne UI) a po sieti cez inFlight
    this.favState.toggle(product);
    // malý timeout na odomknutie – alebo to rieš cez výstupy zo služby
    setTimeout(() => (this.loadingFavorite = false), 600);
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

    this.animatedTotalPriceSale = this.IfProductInSale
      ? this.displayPriceSale * this.quantity
      : 0;
  
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

    const today = new Date();
    this.loadSessionsForDate(today);
    this.updateIsFavorite();
    }

    private loadSessionsForDate(date: Date) {
      if (!this.product) return;
      this.sessionsService.listForDay(date).subscribe({
        next: list => {
          console.log('Sessions from server:', list);
          const slug = this.selectedVariation?.slug || this.product?.slug;
          // Skontroluj, ktoré produkty v sessions reálne sú
          console.log('Looking for slug:', slug);
          list.forEach(sess => {
            console.log('Session product:', sess.product?.slug, 'id:', sess.product?.id, 'sess:', sess);
          });
          this.sessions = list.filter(s => s.product?.slug === slug);
          // Ak sessions je stále 0, filter je zlý
        },
        error: () => { /* ... */ }
      });
    }

    registerToSession() {
      this.bookingError = '';
      this.bookingSuccess = '';
      if (!this.selectedSession) { this.bookingError = 'Vyberte termín.'; return; }
      if (!this.booking.name || !this.booking.email) { this.bookingError = 'Meno a email sú povinné.'; return; }
      if ((this.selectedSession.capacity?.available || 0) <= 0) { this.bookingError = 'Táto session je už plná.'; return; }
    
      this.bookingLoading = true;
      const payload = {
        session: this.selectedSession.id,
        peopleCount: 1,
        customerName: this.booking.name,
        customerEmail: this.booking.email,
        status: 'pending' as const,
      };
      this.sessionsService.createBooking(payload).subscribe({
        next: booking => {
          this.bookingLoading = false;
          this.bookingSuccess = 'Rezervácia vytvorená.';
          // optimistic hold: decrement available locally
          if (this.selectedSession && this.selectedSession.capacity) {
            this.selectedSession.capacity.available = Math.max(0, this.selectedSession.capacity.available - 1);
          }
          // set up hold expiry (10 minutes)
          const bookingId = booking.id;
          const expireAt = Date.now() + 10 * 60 * 1000;
          // attach to cart with metadata
          this.cart.add(
            {
              id: this.selectedVariation?.id || this.product!.id,
              name: this.product!.name,
              slug: this.selectedVariation?.slug || this.product!.slug || '',
              price: this.displayPrice,
              img: this.currentImage,
              quantity: 1,
              session: this.selectedSession,
              bookingId,
              holdExpires: expireAt,
            } as any,
            1
          );
    
          // auto release if not confirmed
          this.holdTimer && clearTimeout(this.holdTimer);
          this.holdTimer = setTimeout(() => {
            // if still pending, cancel
            this.sessionsService.patchBooking(bookingId, { status: 'cancelled' }).subscribe();

            this.cart.removeByBooking(bookingId);
            this.bookingError = 'Rezervácia vypršala.';
            this.bookingSuccess = '';
            if (this.selectedSession && this.selectedSession.capacity) {
              this.selectedSession.capacity.available += 1; // restore locally
            }
          }, 10 * 60 * 1000);
        },
        error: err => {
          this.bookingLoading = false;
          if (err.status === 409) { this.bookingError = 'Kapacita je plná.'; }
          else if (err.status === 401 || err.status === 403) { this.bookingError = 'Problém s autorizáciou.'; }
          else { this.bookingError = 'Chyba pri vytváraní rezervácie.'; }
        }
      });
    }
    
    selectSession(s: EventSessionWithCapacity) {
      this.selectedSession = s;
      this.bookingError = '';
      this.bookingSuccess = '';
    }

    incQuantity() {
      if (this.quantity < 99) {
        const oldQty = this.quantity;
        const newQty = oldQty + 1;

        const fromReg  = this.animatedTotalPrice;
        const toReg    = this.displayPrice * newQty;
        const fromSale = this.animatedTotalPriceSale;
        const toSale   = this.IfProductInSale ? this.displayPriceSale * newQty : 0;

        this.quantity = newQty;
        this.runTotalsAnimation(fromReg, toReg, fromSale, toSale);
      }
    }

    decQuantity() {
      if (this.quantity > 1) {
        const oldQty = this.quantity;
        const newQty = oldQty - 1;

        const fromReg  = this.animatedTotalPrice;
        const toReg    = this.displayPrice * newQty;
        const fromSale = this.animatedTotalPriceSale;
        const toSale   = this.IfProductInSale ? this.displayPriceSale * newQty : 0;

        this.quantity = newQty;
        this.runTotalsAnimation(fromReg, toReg, fromSale, toSale);
      }
    }
  
  /** 
   * Prednačíta do cache všetky obrázky z hlavného produktu aj zo všetkých variácií 
   * (medium i large), aby sme neskôr nemuseli zakaždým shimmerovať.
   */
  private preloadAllVariationImages(src: Product) {
    if (!this.isBrowser) return;
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
  // uchovaj si pôvodné celkové ceny (pre plynulú animáciu)
  const fromReg  = this.animatedTotalPrice;
  const fromSale = this.animatedTotalPriceSale;

  this.selectedVariation = v;
  if (!this.product) return;

  // Pri prepnutí variácie meníme len currentImage, galériu nerezetujeme
  const pair = this.collectImagePair(v, this.product);
  this.currentImage = pair.medium;

  // spočítaj nové (cieľové) celkové ceny podľa vybranej variácie a množstva
  const toReg  = this.displayPrice * this.quantity;
  const toSale = this.IfProductInSale ? this.displayPriceSale * this.quantity : 0;

  // pusti plynulú animáciu sumárov
  this.runTotalsAnimation(fromReg, toReg, fromSale, toSale);

  // ak filtruješ termíny podľa slugu variácie, refreshni sessions pre aktuálny deň
  const today = new Date();
  this.loadSessionsForDate(today);
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
    return this.selectedVariation?.inSale ?? this.product?.inSale ?? false;
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
  
    // --- fallback variácie → hlavný produkt → prvá galéria ---
    const variationImg = this.selectedVariation?.primaryImageUrl || '';
    const mainImg      = this.product.primaryImageUrl      || '';
    const galleryImg   = this.mediumImages.length 
                         ? this.mediumImages[0] 
                         : '';
  
    const imgToUse = variationImg || mainImg || galleryImg;
  
    const p = this.selectedVariation ?? this.product;
  
    // Helper pre null -> undefined
    function nullToUndefined<T>(value: T | null | undefined): T | undefined {
      return value === null ? undefined : value;
    }
  
    this.cart.add(
      {
        id:    p.id,
        name:  p.name,
        slug:  p.slug,
        price: p.price ?? 0,
        price_sale: nullToUndefined(p.price_sale),
        inSale: p.inSale ?? false,
        img:   imgToUse,
      },
      this.quantity
    );
  
    // Reset množstva a animácia ceny
      const fromReg  = this.animatedTotalPrice;
      const fromSale = this.animatedTotalPriceSale;
      this.quantity = 1;
      const toReg   = this.displayPrice * this.quantity;
      const toSale  = this.IfProductInSale ? this.displayPriceSale * this.quantity : 0;
      this.runTotalsAnimation(fromReg, toReg, fromSale, toSale);
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
    const result: Category[] = [];
    const parentsWithChildren = new Set<string>();
    const seenPairs = new Set<string>();
    const seenRoots = new Set<string>();

    // 1) Zisti, ktorí parenti majú aspoň jedno dieťa
    for (const cat of allCats) {
      if (cat.parent) {
        parentsWithChildren.add(cat.parent.category_slug);
      }
    }

    // 2) Pridaj unikátne páry (parent > child)
    for (const cat of allCats) {
      if (!cat.parent) continue;
      const key = `${cat.parent.category_slug}→${cat.category_slug}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      result.push(cat); // šablóna z tohto vykreslí "parent > child"
    }

    // 3) Pridaj root kategórie len ak nie sú parentom žiadneho dieťaťa
    for (const cat of allCats) {
      if (cat.parent) continue; // root only
      if (parentsWithChildren.has(cat.category_slug)) continue; // potlač duplicitu
      if (seenRoots.has(cat.category_slug)) continue;
      seenRoots.add(cat.category_slug);
      result.push(cat); // šablóna vykreslí len root
    }

    this.uniqueCategories = result;
  }




}

/** Rozšírený typ Category, ktorý garantuje vlastnosť children */
interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}
