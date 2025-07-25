/* src/app/landing-page/landing-page2.component.ts */
import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ProductsService, Product } from 'app/services/products.service';
import { Slide2sService, Slide2 } from 'app/services/slide2s.service';
import { FooterComponent } from 'app/components/footer/footer.component';
import { SafeUrlPipe } from 'app/shared/safe-url.pipe';
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
  weekDays = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
  currentMonth = new Date();
  selectedDay: CalendarDay | null = null;
  registration = { name: '', email: '' };

  constructor(
    private router: Router,
    private productsService: ProductsService,
    private slide2sService: Slide2sService,
    private sanitizer: DomSanitizer
  ) {}





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
    this.slidesSub = this.slide2sService
      .getSlides()
      .pipe(catchError(() => of([] as Slide2[])))
      .subscribe(sl => {
        this.slides = sl;
        this.resumeAuto();
      });

    this.loadSaleAndFeatured();
    this.loadExperiences();
    this.generateCalendar(this.currentMonth);

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

  // Calendar logic
  private generateCalendar(reference: Date): void {
    const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const startMonday = new Date(first);
    startMonday.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.calendarDays = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startMonday);
      d.setDate(startMonday.getDate() + i);
      const inMonth = d.getMonth() === reference.getMonth();
      const isToday = d.getTime() === today.getTime();
      this.calendarDays.push({
        date: d,
        dayOfMonth: d.getDate(),
        isOccupied: false,
        isToday,
        isInCurrentMonth: inMonth,
        isSelectable: inMonth,
      });
    }
  }

  public prevMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() - 1,
      1
    );
    this.generateCalendar(this.currentMonth);
    this.selectedDay = null;
  }

  public nextMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + 1,
      1
    );
    this.generateCalendar(this.currentMonth);
    this.selectedDay = null;
  }

  public selectDay(day: CalendarDay): void {
    if (!day.isSelectable) return;
    this.selectedDay = day;
  }

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
}
