// src/app/pages/eshop/product-detail.component.ts
// © 2025 – Slovenská ľudová majolika

import { SeoService } from 'app/services/seo.service';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { MatDialog } from '@angular/material/dialog';
import { SessionPickerDialogComponent } from './session-picker-dialog.component';
import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
  Inject,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';

import { CommonModule, DOCUMENT } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { switchMap, map, filter, takeUntil } from 'rxjs/operators';
import { interval, Subscription, Subject, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { catchError, tap, finalize } from 'rxjs/operators';

import { ProductsService, Product, Category } from '../../services/products.service';
import { CartService } from '../../services/cart.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalendarLinkService } from 'app/services/calendar-link.service';

import { MaterialModule } from 'app/material.module';
import { ZoomPanDirective } from 'app/pages/eshop/zoom-pan.directive';
import { slideFullscreenAnimation } from 'app/animations/route.animations';
import { FavoriteStateService } from 'app/services/favorite-state.service';
import { AuthService } from 'app/services/auth.service';

import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ShareButtonsComponent } from 'app/shared/share-buttons/share-buttons.component';

import { EventSessionsService, EventSessionWithCapacity, BookingPayload } from 'app/services/event-sessions.service';

import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { CalendarOptions, EventInput } from '@fullcalendar/core';
import skLocale from '@fullcalendar/core/locales/sk';
import enGbLocale from '@fullcalendar/core/locales/en-gb';
import deLocale from '@fullcalendar/core/locales/de';

import { Meta, Title } from '@angular/platform-browser';
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
    MatSnackBarModule,
  ],
  animations: [
    slideFullscreenAnimation,
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '{{collapsedHeight}}px',
          overflow: 'hidden',
        }),
        { params: { collapsedHeight: 72 } }
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
export class ProductDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('calendar') calendarComponent: any;
  @ViewChild(FullCalendarComponent) fc?: FullCalendarComponent;

  private navDateStr: string | null = null;   // "YYYY-MM-DD"
  private navSessionId: number | null = null;
  
  // ✅ FIX: FC nemusí byť ready keď príde query param -> odlož a aplikuj neskôr
  private pendingGotoDate: string | null = null;
  private tryGotoDate(dateStr?: string | null) {
  if (!dateStr) return;

  const api = this.fc?.getApi?.();
  if (!api) {
    this.pendingGotoDate = dateStr;
    return;
  }

  // ✅ toto je kľúč: nastaví správny týždeň v listWeek
  api.changeView('listWeek', dateStr);

  // (optional) istota
  api.gotoDate(dateStr);

  this.pendingGotoDate = null;
}

  private get lang(): 'sk' | 'en' | 'de' {
    const l = (this.translate.currentLang || 'sk').toLowerCase();
    return (l === 'en' || l === 'de') ? (l as any) : 'sk';
  }

  catLabel(c: Category | undefined | null): string {
    if (!c) return '';
    const l = this.lang;
    if (l === 'en') return (c as any).category_name_en || c.category_name;
    if (l === 'de') return (c as any).category_name_de || c.category_name;
    return c.category_name;
  }

  isBrowser = false;
  articleUrl = '';


  private mapLangToFcLocale(lang?: string): string {
    const norm = (lang || 'sk').toLowerCase();
    if (norm.startsWith('en')) return 'en-gb';
    if (norm.startsWith('de')) return 'de';
    return 'sk';
  }



  private todayStr = this.getLocalDateStr(new Date());

  private applyCalendarLocale(lang?: string): void {
    const fcLocale = this.mapLangToFcLocale(lang);
    this.calendarOptions = {
      ...this.calendarOptions,
      locale: fcLocale,
      firstDay: 1,
      validRange: { start: this.todayStr },
    };
  }

  private dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private dayCellEls = new Map<string, HTMLElement>();
  private readonly placeholderImg = 'assets/img/logo-SLM-modre.gif';

  private resolveFirstImage(variation?: Product | null): string {
    const candidates: string[] = [];

    if (variation?.picture_new) {
      candidates.push(this.productsService.imageUrl(variation.picture_new, 'medium'));
    }

    if (this.product?.picture_new) {
      candidates.push(this.productsService.imageUrl(this.product.picture_new, 'medium'));
    }

    if (this.mediumImages.length) {
      candidates.push(this.mediumImages[0]);
    }

    candidates.push(this.placeholderImg);

    const firstReal = candidates.find(
      u => !!u && !u.includes('logo-SLM-modre.gif')
    );

    return firstReal || candidates[0] || this.placeholderImg;
  }

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    initialView: 'listWeek',
    locales: [skLocale, enGbLocale, deLocale],
    firstDay: 1,
    height: 'auto',
    expandRows: false,
    dayMaxEvents: true,
    stickyHeaderDates: true,
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    buttonText: { today: 'Dnes', month: 'Mesiac', week: 'Týždeň', day: 'Deň', list: '' },

    dayCellDidMount: (arg) => {
      const key = this.dateKey(arg.date);
      this.dayCellEls.set(key, arg.el as HTMLElement);
      arg.el.classList.add('no-ev');
    },

    eventsSet: (events) => {
      const withEvents = new Set<string>();
      events.forEach(e => {
        if (e.start) withEvents.add(this.dateKey(e.start));
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
      const begin = this.translate.instant('ESHOP.BEGIN');
      const kapacita = this.translate.instant('ESHOP.KAPACITA');
      const timeHtml = `<span class="t">${begin} ${startStr}</span>`;
      const avail = s?.capacity?.available;

      if (arg.view.type === 'dayGridMonth') {
        const capHtml = (avail ?? null) !== null
          ? `<span class="cap ${avail! > 0 ? '' : 'cap-sold'}">${avail! > 0 ? (avail + '') : 'X'}</span>`
          : '';
        return { html: `<div class="m-ev">${timeHtml} ${capHtml}</div>` };
      } else {
        const capHtml = (avail ?? null) !== null
          ? `<span class="cap ${avail! > 0 ? '' : 'cap-sold'}">${kapacita} ${avail! > 0 ? (avail + '') : 'X'}</span>`
          : '';
        return { html: `<div class="m-ev"> ${timeHtml} ${capHtml}</div>` };
      }
    },

    events: [],
  };

  @ViewChild('contentContainer') contentEl!: ElementRef<HTMLElement>;
  openSection: 'description' | 'short' | 'size' | null = null;

  sanitizedDescription: SafeHtml;
  sanitizedShort: SafeHtml;
  sanitizedSize: SafeHtml;

  public isContentLoadingDetail = true;
  isExpanded = false;
  isOverflowing = false;
  collapsedHeight = 172;

  loadingFavorite = false;
  private touchStartX = 0;
  private readonly swipeThreshold = 50;
  isFavorite = false;

  animatedTotalPrice = 0;
  animatedTotalPriceSale = 0;
  private prevTotalPrice = 0;
  private priceAnimSub?: Subscription;

  product: Product | null = null;
  selectedVariation: Product | null = null;
  quantity = 1;

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

  fullscreenState: string = 'hidden';
  notFound = false;

  currentIndex = 0;
  featured: Product[] = [];
  recommended: Product[] = [];

  loadingMap: Record<string, boolean> = {};
  uniqueCategories: { parent?: Category; child: Category }[] = [];

  // sessions / booking
  sessions: EventSessionWithCapacity[] = [];
  selectedSession: EventSessionWithCapacity | null = null;
  booking = { name: '', email: '' };
  bookingLoading = false;
  bookingError = '';
  bookingSuccess = '';
  holdTimer?: any;
  private destroyed$ = new Subject<void>();

  public sessionQty: number = 1;

  private toCalendarEvents(sessions: EventSessionWithCapacity[]): EventInput[] {
    return sessions.map((s) => {
      const startISO = s.startDateTime;
      const durationMin = s.durationMinutes ?? 60;
      const endISO = this.addMinutes(startISO, durationMin);

      return {
        id: String(s.id),
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
    return new Intl.DateTimeFormat('sk-SK', {
      timeZone: 'Europe/Bratislava',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(d));
  }





  toggle() {
    this.isExpanded = !this.isExpanded;
  }

  toggle_accordion(section: 'description' | 'short' | 'size') {
    this.openSection = this.openSection === section ? null : section;
  }

  constructor(
    private dialog: MatDialog,
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
    private seo: SeoService,
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private doc: Document
  ) {
    const rawDesc = '<p>Full product description …</p>';
    const rawShort = '<p>Short summary …</p>';
    const rawSize = '<p>Size chart or info …</p>';

    this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(rawDesc);
    this.sanitizedShort = this.sanitizer.bypassSecurityTrustHtml(rawShort);
    this.sanitizedSize = this.sanitizer.bypassSecurityTrustHtml(rawSize);

    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ✅ ak FC dobehne až po init
  ngAfterViewInit(): void {
    if (this.pendingGotoDate) {
      setTimeout(() => this.tryGotoDate(this.pendingGotoDate), 0);
    } else if (this.navDateStr) {
      setTimeout(() => this.tryGotoDate(this.navDateStr), 0);
    }
  }

  private loadProductById(id: number): void {
    const want = (this.translate.currentLang || 'sk').toLowerCase();
    const qp = this.route.snapshot.queryParams;

    this.productsService.getProductByIdForceLocale(id, want).pipe(
      catchError(() => this.productsService.getProductByIdForceLocale(id, 'sk')),
      catchError(() => of(null))
    ).subscribe(prod => {
      if (!prod) {
        this.notFound = true;
        this.product = null;
        this.loading = false;
        return;
      }

      // ✅ presmeruj na slug (kvôli SEO), ale nechaj date/sessionId
      this.router.navigate(['/produkt', prod.slug], {
        replaceUrl: true,
        queryParams: { ...qp, id }
      });
    });
  }

  onSessionChange(session: EventSessionWithCapacity) {
    this.selectedSession = session;
    this.sessionQty = 1;
  }

  onLoginSuccess() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
    this.router.navigateByUrl(returnUrl);
  }

  addSessionToCart(session: EventSessionWithCapacity, qty: number) {
  this.cart.add({
    id: this.product?.id ?? session.product?.id ?? session.id,   
    name: this.product?.name ?? session.title ?? 'Termín',
    slug: this.product?.slug ?? session.product?.slug ?? '',

    price: this.getSessionPrice(session),                       
    price_sale: undefined,
    inSale: false,

    img: this.currentImage || session.product?.primaryImageUrl || '',
    session,
  } as any, qty);
}

  isExperienceSession(s: EventSessionWithCapacity): boolean {
    return s.type === 'workshop' || s.type === 'tour';
  }

isGiftVoucherProduct(prod: Product | null): boolean {
  if (!prod) return false;

  return (prod.categories ?? []).some(c =>
    c.category_slug === 'darcekove-poukazy'
  );
}

isExperienceProduct(prod: Product | null): boolean {
  if (!prod) return false;

  // ak je to darčekový poukaz, nikdy to nie je experience produkt
  if (this.isGiftVoucherProduct(prod)) return false;

  return (prod.categories ?? []).some(c =>
    c.parent?.category_slug === 'zazitky' || c.category_slug === 'zazitky'
  );
}

  showToast() {
    this.snack.open('Pridané do obľúbených', 'OK', { duration: 3000 });
  }

  private loadProductBySlug(slug: string): void {
    this.notFound = false;

    this.productsService.getProductWithVariations(slug).subscribe({
      next: (resp) => {
        const prod = resp?.data?.[0] ?? null;

        if (!prod) {
          this.notFound = true;
          this.product = null;
          return;
        }

        this.product = prod;
      },
      error: () => {
        this.notFound = true;
        this.product = null;
      }
    });
  }

 ngOnInit(): void {
  
  this.loading = true;
  this.applyCalendarLocale(this.translate.currentLang);

    const qp = this.route.snapshot.queryParamMap;
  this.navDateStr = qp.get('date');
  this.navSessionId = qp.get('sessionId') ? Number(qp.get('sessionId')) : null;

  this.applyCalendarLocale(this.translate.currentLang);
  const documentId = qp.get('documentId');
  const urlSlug = this.route.snapshot.paramMap.get('slug');
  const want = (this.translate.currentLang || 'sk').toLowerCase();

  // ✅ ak máme documentId, tak slug je len “nice URL”, nie zdroj pravdy
  if (documentId) {
    this.productsService.getProductByDocumentIdForceLocale(documentId, want).pipe(
      catchError(() => this.productsService.getProductByDocumentIdForceLocale(documentId, 'sk')),
      map(resp => this.productsService.extractFirst(resp)),
      catchError(() => of(null))
    ).subscribe(prod => {
      if (!prod?.slug) {
        this.notFound = true;
        this.loading = false;
        return;
      }

      // ✅ ak je slug v URL nesprávny pre jazyk, sprav redirect
      if (urlSlug !== prod.slug) {
        const keep = { ...this.route.snapshot.queryParams };

        this.router.navigate(['/produkt', prod.slug], {
          replaceUrl: true,
          queryParams: keep,
        });
        return; // zvyšok sa spustí po redirecte znova
      }

      // ✅ slug sedí – pokračuj už normálne (spusti pôvodný pipeline)
      this.initNormalPipeline();
    });

    return; // stop, kým to nevyrieši redirect / init
  }

  // fallback: bez documentId ideš pôvodne podľa slug
  this.initNormalPipeline();
}


private getLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

openSessionPicker(): void {
  const todayStr = this.getLocalDateStr(new Date());

  const ref = this.dialog.open(SessionPickerDialogComponent, {
  maxWidth: '98vw',
  width: '980px',
  panelClass: 'session-picker-dialog',
  data: {
    title: this.product?.name || this.translate.instant('BASE.REZERVOVAT'),
    sessions: this.sessions || [],
    initialDate: this.navDateStr || undefined,
    validStart: todayStr,
  }
});

  ref.afterClosed().subscribe((res: any) => {
    if (!res?.session) return;

    // nastav vybraný session v detaile
    this.selectedSession = res.session;

    // (voliteľné) prepíš query param date/sessionId nech to ostane v URL
    const dateStr = res.date || this.getLocalDateStr(new Date(res.session.startDateTime));
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date: dateStr, sessionId: res.session.id, documentId: this.route.snapshot.queryParamMap.get('documentId') },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    // rovno vykonaj tvoj existujúci booking + cart hold
    this.startBooking(res.session, res.qty);
  });
}


private initNormalPipeline(): void {
  // ✅ 1) čítaj query paramy live
  this.route.queryParamMap
    .pipe(takeUntil(this.destroyed$))
    .subscribe(qp => {
      this.navDateStr = qp.get('date');
      this.navSessionId = qp.get('sessionId') ? Number(qp.get('sessionId')) : null;

      if (this.navDateStr && this.fc) {
        queueMicrotask(() => this.fc?.getApi().gotoDate(this.navDateStr!));
      }
    });

  // ✅ 2) pôvodný pipeline podľa slug
  this.route.paramMap
    .pipe(
      map(p => p.get('slug')),
      filter((slug): slug is string => !!slug),
      switchMap(slug => this.productsService.getProductWithVariations(slug).pipe(
        map(resp => resp?.data?.[0] ?? null),
        map(product => ({ product, slug }))
      )),
      tap(({ product }) => {
        if (!product) {
          this.notFound = true;
          this.loading = false;
          return;
        }
        this.loadProduct(product);
        this.buildBreadcrumbs(product.categories ?? []);
        this.updateIsFavorite();
        this.setSeo(product, product.slug);
      }),

      // ✅ sessions – ako máš (ideálne documentId pre zážitky)
      switchMap(({ product }) => {
        if (!product) return of([] as EventSessionWithCapacity[]);

        // ak máš už správny switch (zážitok -> docId), nechaj ho tu
        const docId =
          this.route.snapshot.queryParamMap.get('documentId') ||
          (product as any).documentId;

        if (docId) {
          return this.sessionsService.getSessionsForProductDocument(docId);
        }
        return this.sessionsService.getSessionsForProduct(product.slug);
      }),

      tap((list) => {
  this.sessions = list;

  this.calendarOptions = {
    ...this.calendarOptions,
    events: this.toCalendarEvents(this.sessions),
    // ✅ toto pomôže pri prvom renderi
    initialDate: this.navDateStr || undefined,
  };

  if (this.navSessionId) {
    const hit = this.sessions.find(s => s.id === this.navSessionId);
    if (hit) this.selectedSession = hit;
  }

  // ✅ a toto je istota po renderi
  if (this.navDateStr) {
    setTimeout(() => this.fc?.getApi().gotoDate(this.navDateStr!), 0);
  }

  this.loading = false;
  this.isContentLoadingDetail = false;
}),

      catchError(() => {
        this.loading = false;
        this.isContentLoadingDetail = false;
        return of([] as EventSessionWithCapacity[]);
      }),

      takeUntil(this.destroyed$)
    )
    .subscribe();

  // FC locale change nechaj ako máš
  this.translate.onLangChange
    .pipe(takeUntil(this.destroyed$))
    .subscribe(e => {
      this.applyCalendarLocale(e.lang);
      if (this.product) {
        this.buildBreadcrumbs(this.product.categories ?? []);
        this.setSeo(this.product, this.product.slug);
      }
      this.cd.markForCheck();
    });
}

  /** Nastaví <title>, OG/Twitter meta, canonical a JSON-LD Product */
  private setSeo(product: Product, slug: string): void {
    const siteUrl = (environment.frontendUrl || '').replace(/\/$/, '');
    const url = `${siteUrl}/produkt/${slug}`;
    const seoData: any = (product as any).seo ?? null;
    const productName = product.name || 'Slovenská ľudová majolika Modra';
    const fallbackTitle = productName;

    const rawDescHtml =
      (seoData?.metaDescription as string) ||
      (product.short as any as string) ||
      (product.describe as any as string) ||
      '';

    const seoDescription = (rawDescHtml || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300) || 'Ručne maľovaná keramika z Majoliky Modra.';

    const productPlainDescription = seoDescription;

    const sku: string =
      (product as any).sku ||
      product.slug ||
      '';

    const price: number = product.price ?? product.price_sale ?? 0;
    const availability: 'InStock' | 'OutOfStock' = 'InStock';

    let productImageUrl: string =
      (product as any).primaryImageUrl ||
      this.currentImage ||
      this.mediumImages[0] ||
      `${siteUrl}/assets/img/logo-SLM-modre.gif`;

    if (!/^https?:\/\//i.test(productImageUrl)) {
      const sep = productImageUrl.startsWith('/') ? '' : '/';
      productImageUrl = `${siteUrl}${sep}${productImageUrl}`;
    }

    this.seo.applySeo(seoData, fallbackTitle);

    this.titleSvc.setTitle(`${productName} | Majolika Modra – ručne maľovaná keramika`);
    this.meta.updateTag({ name: 'description', content: seoDescription });

    this.meta.updateTag({ property: 'og:type', content: 'product' });
    this.meta.updateTag({ property: 'og:title', content: productName });
    this.meta.updateTag({ property: 'og:description', content: seoDescription });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: productImageUrl });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: productName });
    this.meta.updateTag({ name: 'twitter:description', content: seoDescription });
    this.meta.updateTag({ name: 'twitter:image', content: productImageUrl });

    let linkEl = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!linkEl) {
      linkEl = this.doc.createElement('link');
      linkEl.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(linkEl);
    }
    linkEl.setAttribute('href', url);

    this.setProductJsonLd({
      productName,
      productImageUrl,
      productPlainDescription,
      sku,
      price,
      availability,
      slug
    });

    this.articleUrl = url;
  }

  /** Vloží / aktualizuje <script type="application/ld+json"> pre Product */
  private setProductJsonLd(data: {
    productName: string;
    productImageUrl: string;
    productPlainDescription: string;
    sku: string;
    price: number;
    availability: 'InStock' | 'OutOfStock';
    slug: string;
  }): void {
    const old = this.doc.getElementById('product-jsonld');
    if (old && old.parentNode) {
      old.parentNode.removeChild(old);
    }

    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'product-jsonld';

    const siteUrl = (environment.frontendUrl || '').replace(/\/$/, '');

    const jsonLd = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: data.productName,
      image: [data.productImageUrl],
      description: data.productPlainDescription,
      sku: data.sku,
      brand: {
        '@type': 'Brand',
        name: 'Majolika Modra'
      },
      offers: {
        '@type': 'Offer',
        url: `${siteUrl}/produkt/${data.slug}`,
        priceCurrency: 'EUR',
        price: String(data.price.toFixed(2)),
        availability: `https://schema.org/${data.availability}`
      }
    };

    script.textContent = JSON.stringify(jsonLd);
    this.doc.head.appendChild(script);
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /** Pomôcka: bezpečne nastaví available pre daný session + zosynchronizuje pole sessions a FullCalendar */
  private setCapacityAvailable(sess: EventSessionWithCapacity, nextAvail: number): void {
    if (sess.capacity) {
      sess.capacity.available = nextAvail;
    }

    this.sessions = this.sessions.map((s): EventSessionWithCapacity =>
      s.id === sess.id
        ? ({ ...s, capacity: { ...s.capacity!, available: nextAvail } })
        : s
    );

    this.calendarOptions = {
      ...this.calendarOptions,
      events: this.toCalendarEvents(this.sessions),
    };
    this.cd.markForCheck();
  }

public getSessionPrice(session: EventSessionWithCapacity): number {
  if (!session) return 0;

  const sPriceRaw = (session as any).price;
  const sPrice = typeof sPriceRaw === 'number' ? sPriceRaw : Number(sPriceRaw);
  const hasSessionPrice = Number.isFinite(sPrice) && sPrice > 0;

  const prod = session.product as any;

  if (prod?.inSale === true) {
    return hasSessionPrice ? sPrice : (prod?.price_sale ?? prod?.price ?? 0);
  }
  return hasSessionPrice ? sPrice : (prod?.price ?? 0);
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

        const currentAvail = session.capacity?.available ?? 0;
        const newAvail = Math.max(0, currentAvail - qty);
        this.setCapacityAvailable(session, newAvail);

        const expireAt = Date.now() + 10 * 60 * 1000;
        const p = this.selectedVariation ?? this.product;
const inSale = !!p?.inSale;
const unitPrice = inSale
  ? (p?.price_sale ?? p?.price ?? 0)
  : (p?.price ?? 0);


const isGiftVoucher =
  !!p?.isGiftVoucher ||
  !!session.product?.isGiftVoucher ||
  p?.categories?.some(c => c.category_slug === 'darcekove-poukazy') === true ||
  session.product?.categories?.some(c => c.category_slug === 'darcekove-poukazy') === true;

const voucherType = p?.voucherType ?? session.product?.voucherType;
const voucherValue = p?.voucherValue ?? session.product?.voucherValue;
const canBeDigital = true;

this.cart.add(
  {
    id: p?.id ?? session.id,
    name: p?.name ?? session.title ?? 'Termín',
    slug: p?.slug ?? session.product?.slug ?? '',
    type: isGiftVoucher ? 'gift_voucher' : 'product',
    voucherType: isGiftVoucher ? voucherType : undefined,
    img: this.currentImage || session.product?.primaryImageUrl || '',
    price: unitPrice,
    price_sale: inSale ? (p?.price_sale ?? undefined) : undefined,
    inSale,

    session,
    bookingId: bookingRes.id,
    holdExpires: expireAt,

    isDigitalProduct: canBeDigital,
    digitalSelected: true,

    isGiftVoucher,

    voucherValue:
      isGiftVoucher && voucherType === 'value'
        ? (voucherValue ?? unitPrice)
        : null,
  } as any,
  qty
);

        this.holdTimer && clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => {
          this.sessionsService.patchBooking(bookingRes.id, { status: 'cancelled' }).subscribe();
          this.cart.removeByBooking(bookingRes.id);
          this.bookingError = 'Rezervácia vypršala.';
          this.bookingSuccess = '';

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
      if (this.loadingFavorite) return;
      this.loadingFavorite = true;

      this.favState.toggle(product);
      setTimeout(() => (this.loadingFavorite = false), 600);
    });
  }

  private loadProduct(item: Product) {
    this.openSection = null;
    this.quantity = 1;
    this.priceAnimSub?.unsubscribe();

    this.product = item;

    const urlSlug = this.route.snapshot.paramMap.get('slug');

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

    this.prepareDescription();
    this.prepareShort();

    this.animatedTotalPrice = this.displayPrice * this.quantity;
    this.animatedTotalPriceSale = this.IfProductInSale
      ? this.displayPriceSale * this.quantity
      : 0;

    this.preloadAllVariationImages(item);
    this.buildImageSets(item);

    if (this.selectedVariation) {
      const raw = this.selectedVariation.picture_new ?? null;
      if (raw) {
        this.currentImage = this.resolveFirstImage(this.selectedVariation);
      } else {
        this.otherImages = [...this.mediumImages];
      }
    } else {
      this.currentImage = this.mediumImages[0] ?? '/assets/img/logo-SLM-modre.gif';
    }
    this.otherImages = [...this.mediumImages];

    this.isLoading = true;
    this.error = false;
    this.startLoadingDots();

    this.loadingMap = {};
    this.mediumImages.forEach(url => {
      this.loadingMap[url] = true;
    });

    this.productsService.getFeaturedProducts().subscribe(list => this.featured = list);

    window.scrollTo({ top: 0 });

    // ✅ FIX: NEROB listForDay / loadSessionsForDate tu (kazilo date z query paramu)
    this.updateIsFavorite();
  }

  // NOTE: loadSessionsForDate zámerne NEVOLÁME (nechaj to tu len ak ho používaš inde)
  // private loadSessionsForDate(date: Date | string) { ... }

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

        if (this.selectedSession && this.selectedSession.capacity) {
          this.selectedSession.capacity.available = Math.max(0, this.selectedSession.capacity.available - 1);
        }

        const bookingId = booking.id;
        const expireAt = Date.now() + 10 * 60 * 1000;

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

        this.holdTimer && clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => {
          this.sessionsService.patchBooking(bookingId, { status: 'cancelled' }).subscribe();

          this.cart.removeByBooking(bookingId);
          this.bookingError = 'Rezervácia vypršala.';
          this.bookingSuccess = '';
          if (this.selectedSession && this.selectedSession.capacity) {
            this.selectedSession.capacity.available += 1;
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

      const fromReg = this.animatedTotalPrice;
      const toReg = this.displayPrice * newQty;
      const fromSale = this.animatedTotalPriceSale;
      const toSale = this.IfProductInSale ? this.displayPriceSale * newQty : 0;

      this.quantity = newQty;
      this.runTotalsAnimation(fromReg, toReg, fromSale, toSale);
    }
  }

  decQuantity() {
    if (this.quantity > 1) {
      const oldQty = this.quantity;
      const newQty = oldQty - 1;

      const fromReg = this.animatedTotalPrice;
      const toReg = this.displayPrice * newQty;
      const fromSale = this.animatedTotalPriceSale;
      const toSale = this.IfProductInSale ? this.displayPriceSale * newQty : 0;

      this.quantity = newQty;
      this.runTotalsAnimation(fromReg, toReg, fromSale, toSale);
    }
  }

  private preloadAllVariationImages(src: Product) {
    if (!this.isBrowser) return;
    const allUrls = new Set<string>();

    const gatherUrls = (prod: Product) => {
      const picObj = this.findFirst(prod, p => p.picture_new) ?? null;
      if (picObj) {
        allUrls.add(this.productsService.imageUrl(picObj, 'medium'));
        allUrls.add(this.productsService.imageUrl(picObj, 'large'));
      }
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

    allUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }

  private collectImagePair(prod: Product, fallbackProd: Product): { medium: string; large: string } {
    const picObj = prod.picture_new ?? fallbackProd.picture_new ?? null;
    const medium = this.productsService.imageUrl(picObj, 'medium');
    const large = this.productsService.imageUrl(picObj, 'large');
    return { medium, large };
  }

  private buildImageSets(src: Product) {
    const allPairs: { medium: string; large: string }[] = [];
    const basePair = this.collectImagePair(src, src);
    allPairs.push(basePair);

    if (src.variations) {
      src.variations.forEach(v => {
        const pair = this.collectImagePair(v, src);
        allPairs.push(pair);
      });
    }

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

      if (container.scrollLeft >= maxScrollLeft) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: 300, behavior: 'smooth' });
      }
    }, 4000);
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
    this.fullscreenState = 'visible';
  }

  closeFullscreen() {
    this.isFullscreen = false;
    this.fullscreenState = 'hidden';
  }

  prev() {
    this.fullscreenIndex =
      (this.fullscreenIndex - 1 + this.largeImages.length) % this.largeImages.length;
    this.fullscreenImage = this.largeImages[this.fullscreenIndex];
    this.currentIndex =
      (this.currentIndex - 1 + this.largeImages.length) % this.largeImages.length;
  }

  next() {
    this.fullscreenIndex = (this.fullscreenIndex + 1) % this.largeImages.length;
    this.fullscreenImage = this.largeImages[this.fullscreenIndex];
    this.currentIndex =
      (this.currentIndex + 1) % this.largeImages.length;
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent) {
    if (this.isFullscreen) {
      this.touchStartX = e.changedTouches[0].clientX;
    }
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent) {
    if (!this.isFullscreen) return;
    const endX = e.changedTouches[0].clientX;
    const delta = endX - this.touchStartX;

    if (delta > this.swipeThreshold) {
      this.prev();
    } else if (delta < -this.swipeThreshold) {
      this.next();
    }
  }

  @HostListener('document:keydown.arrowleft', ['$event'])
  onLeft(e: KeyboardEvent | Event) {
    if (!this.isFullscreen) return;
    e.preventDefault();
    this.prev();
  }

  @HostListener('document:keydown.arrowright', ['$event'])
  onRight(e: KeyboardEvent | Event) {
    if (!this.isFullscreen) return;
    e.preventDefault();
    this.next();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.closeFullscreen();
  }

  /** ---------- VARIANTY ---------- */
  onVariationChange(v: Product) {
    const fromReg = this.animatedTotalPrice;
    const fromSale = this.animatedTotalPriceSale;

    this.selectedVariation = v;
    if (!this.product) return;

    this.currentImage = this.resolveFirstImage(this.selectedVariation);

    const toReg = this.displayPrice * this.quantity;
    const toSale = this.IfProductInSale ? this.displayPriceSale * this.quantity : 0;

    this.runTotalsAnimation(fromReg, toReg, fromSale, toSale);

    // ✅ FIX: NEVOLÁME loadSessionsForDate(navDateStr) — sessions sú už načítané pre celý produkt
  }

  get isSoldOut(): boolean {
    return (this.selectedVariation?.isSoldOut === true) || (this.product?.isSoldOut === true);
  }

  get isUnavailable(): boolean {
    return (this.selectedVariation?.isUnavailable === true) || (this.product?.isUnavailable === true);
  }

  get canAddToCart(): boolean {
    return !this.isSoldOut && !this.isUnavailable;
  }

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

    const variationImg = this.selectedVariation?.primaryImageUrl || '';
    const mainImg = this.product.primaryImageUrl || '';
    const galleryImg = this.mediumImages.length ? this.mediumImages[0] : '';
    const imgToUse = variationImg || mainImg || galleryImg;

    const p = this.selectedVariation ?? this.product;

    const isGiftVoucher =
      !!p.isGiftVoucher ||
      !!this.product?.isGiftVoucher ||
      p.categories?.some(c => c.category_slug === 'darcekove-poukazy') === true ||
      this.product?.categories?.some(c => c.category_slug === 'darcekove-poukazy') === true;

    const voucherType = p.voucherType ?? this.product?.voucherType;
    const voucherValue = p.voucherValue ?? this.product?.voucherValue;

    function nullToUndefined<T>(value: T | null | undefined): T | undefined {
      return value === null ? undefined : value;
    }

    this.cart.add(
      {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price ?? 0,
        price_sale: nullToUndefined(p.price_sale),
        inSale: p.inSale ?? false,
        img: imgToUse,

        isGiftVoucher,
        type: isGiftVoucher ? 'gift_voucher' : 'product',
        voucherType: isGiftVoucher ? voucherType : undefined,
        voucherValue:
          isGiftVoucher && voucherType === 'value'
            ? (voucherValue ?? p.price ?? 0)
            : null,

        vatPercentage: p.vatPercentage,

        isDigitalProduct: !!p.isDigitalProduct,
        digitalSelected: !!p.isDigitalProduct,
      },
      this.quantity
    );

    const fromReg = this.animatedTotalPrice;
    const fromSale = this.animatedTotalPriceSale;
    this.quantity = 1;
    const toReg = this.displayPrice * this.quantity;
    const toSale = this.IfProductInSale ? this.displayPriceSale * this.quantity : 0;
    this.runTotalsAnimation(fromReg, toReg, fromSale, toSale);
  }

  onImageLoad(url: string): void {
    this.loadingMap[url] = false;
  }

  onImageError(url: string): void {
    this.loadingMap[url] = false;
  }

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

    this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(cleaned);

    this.zone.onStable.pipe(take(1)).subscribe(() => {
      const el = this.contentEl?.nativeElement;
      if (!el) return;

      this.isOverflowing = el.scrollHeight > this.collapsedHeight;
      this.cd.detectChanges();
    });
  }

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

  private buildBreadcrumbs(allCats: Category[]) {
    const result: { parent?: Category; child: Category }[] = [];

    const parentsWithChildren = new Set<string>();
    const seenPairs = new Set<string>();
    const seenRoots = new Set<string>();

    for (const cat of allCats) {
      if (cat.parent?.category_slug) {
        parentsWithChildren.add(cat.parent.category_slug);
      }
    }

    for (const cat of allCats) {
      if (!cat.parent) continue;
      const key = `${cat.parent.category_slug}→${cat.category_slug}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);

      result.push({ parent: cat.parent, child: cat });
    }

    for (const cat of allCats) {
      if (cat.parent) continue;
      if (parentsWithChildren.has(cat.category_slug)) continue;
      if (seenRoots.has(cat.category_slug)) continue;
      seenRoots.add(cat.category_slug);

      result.push({ child: cat });
    }

    this.uniqueCategories = result;
  }
}

/** Rozšírený typ Category, ktorý garantuje vlastnosť children */
interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}