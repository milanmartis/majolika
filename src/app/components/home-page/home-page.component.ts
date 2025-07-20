/* src/app/landing-page/landing-page.component.ts */
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ProductsService, Product } from 'app/services/products.service';
import { SlidesService, Slide } from 'app/services/slides.service';
import { FooterComponent } from 'app/components/footer/footer.component';
// import { SafeUrlPipe } from 'app/shared/safe-url.pipe';
import {
  trigger,
  state,
  style,
  transition,
  animate,
  query,
  stagger
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
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
    FooterComponent,
  ],
  animations: [
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
    trigger('fadeInStagger', [
      transition('false => true', [
        query('.choice-card', [
          style({ opacity: 0, transform: 'translateY(-1000px)' }),
          stagger(150, [
            animate(
              '1000ms cubic-bezier(0.25, 0.8, 0.25, 1)', // pomalší koniec
              style({ opacity: 1, transform: 'translateY(0)' })
            )
          ])
        ], { optional: true })
      ])
    ]),
    trigger('overlayAnimation', [
      transition('* => *', [
        // start hidden & a little down
        style({ opacity: 0, transform: 'translateY(50px)' }),
        // wait 1s, then animate up & fade in over 500ms
        animate('500ms 1000ms ease-out',
                style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css'],
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {

  animationState = false;
  @ViewChild('bgVideo') bgVideoRef!: ElementRef<HTMLVideoElement>;


  /* ---------------- SLIDER ---------------- */
  // @ViewChild('sliderScroll'/, { static: false })
  // sliderScroll!: ElementRef<HTMLDivElement>;

  // slides: Slide[] = [];
  // currentSlideIndex = 0;
  // private slidesSub?: Subscription;
  // private autoId?: number;

  // public pauseAuto(): void {
  //   if (this.autoId != null) {
  //     clearInterval(this.autoId);
  //     this.autoId = undefined;
  //   }
  // }
  // public resumeAuto(): void {
  //   if (this.autoId == null && this.slides.length) {
  //     this.autoId = window.setInterval(() => this.nextSlide(), 5000);
  //   }
  // }

  /* -------- FEATURED‐PRODUCTS SCROLLER -------- */
  // @ViewChild('scrollContainer', { static: false })
  // scrollContainer!: ElementRef<HTMLDivElement>;
  // private autoSlideInterval?: number;

  // startAutoSlide(): void {
  //   if (this.autoSlideInterval != null) return;
  //   this.autoSlideInterval = window.setInterval(() => {
  //     const container = this.scrollContainer.nativeElement;
  //     const maxScrollLeft = container.scrollWidth - container.clientWidth;
  //     if (container.scrollLeft >= maxScrollLeft) {
  //       container.scrollTo({ left: 0, behavior: 'smooth' });
  //     } else {
  //       container.scrollBy({ left: 300, behavior: 'smooth' });
  //     }
  //   }, 4000);
  // }

  // stopAutoSlide(): void {
  //   if (this.autoSlideInterval != null) {
  //     clearInterval(this.autoSlideInterval);
  //     this.autoSlideInterval = undefined;
  //   }
  // }

  // scrollLeft(): void {
  //   this.scrollContainer.nativeElement.scrollBy({ left: -300, behavior: 'smooth' });
  // }

  // scrollRight(): void {
  //   this.scrollContainer.nativeElement.scrollBy({ left: 300, behavior: 'smooth' });
  // }

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
    private slidesService: SlidesService
  ) {}

  ngOnInit(): void {
    // fetch slides
    // this.slidesSub = this.slidesService
    //   .getSlides()
    //   .pipe(catchError(() => of([] as Slide[])))
    //   .subscribe(sl => {
    //     this.slides = sl;
    //     this.resumeAuto();
    //   });

    this.loadSaleAndFeatured();
    this.loadExperiences();
    this.generateCalendar(this.currentMonth);

    setTimeout(() => (this.imgState = 'visible'), 300);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.animationState = true, 0);
    this.bgVideoRef.nativeElement.muted = true;
    this.bgVideoRef.nativeElement.play();
    // auto‐scroll featured products when view is ready
    // this.startAutoSlide();
  }

  ngOnDestroy(): void {
    // this.pauseAuto();
    // this.stopAutoSlide();
    // this.slidesSub?.unsubscribe();
    this.saleSub?.unsubscribe();
    this.expSub?.unsubscribe();
  }

  /* === SLIDER NAVIGATION === */
  // nextSlide(): void {
  //   if (!this.slides.length) return;
  //   this.pauseAuto();
  //   this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slides.length;
  //   this.scrollToSlide(this.currentSlideIndex);
  //   this.resumeAuto();
  // }

  // prevSlide(): void {
  //   if (!this.slides.length) return;
  //   this.pauseAuto();
  //   this.currentSlideIndex =
  //     (this.currentSlideIndex - 1 + this.slides.length) % this.slides.length;
  //   this.scrollToSlide(this.currentSlideIndex);
  //   this.resumeAuto();
  // }

  // goToSlide(i: number): void {
  //   this.pauseAuto();
  //   this.currentSlideIndex = i;
  //   this.scrollToSlide(i);
  //   this.resumeAuto();
  // }

  // private scrollToSlide(index: number): void {
  //   const el = this.sliderScroll.nativeElement;
  //   el.scrollTo({ left: el.offsetWidth * index, behavior: 'smooth' });
  // }

  /* === PRODUKTY === */
  private loadSaleAndFeatured(): void {
    this.saleSub = this.productsService
      .getRootProducts('name:asc')
      .pipe(catchError(() => of({ data: [] } as any)))
      .subscribe(resp => {
        this.saleProducts = resp.data.filter((p: Product) => p.inSale);
        [...this.saleProducts, ...this.featured].forEach(
          p => (this.loadingMap[p.slug] = true)
        );
      });

    this.productsService.getFeaturedProducts().subscribe(l => {
      this.featured = l;
      [...this.saleProducts, ...this.featured].forEach(
        p => (this.loadingMap[p.slug] = true)
      );
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

  onImageLoad(slug: string): void {
    this.loadingMap[slug] = false;
  }

  onImageError(slug: string): void {
    this.loadingMap[slug] = false;
  }

  openInNewTab(url: string): void {
    window.open(url, '_self', 'noopener');
  }

  goToLink(url: string): void {
    this.router.navigateByUrl('/' + url);
  }

  /* === KALENDÁR === */
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

  prevMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() - 1,
      1
    );
    this.generateCalendar(this.currentMonth);
    this.selectedDay = null;
  }

  nextMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + 1,
      1
    );
    this.generateCalendar(this.currentMonth);
    this.selectedDay = null;
  }

  selectDay(day: CalendarDay): void {
    if (!day.isSelectable) return;
    this.selectedDay = day;
  }

  submitRegistration(): void {
    if (!this.selectedDay) return;
    alert('Ďakujeme za registráciu!');
    this.registration = { name: '', email: '' };
    this.selectedDay = null;
  }

  /* === ROUTING KARTY === */
  onSelect(option: 'optionA' | 'optionB'): void {
    const queryParams =
      option === 'optionB'
        ? { category: 'zazitky' }
        : { category: 'kolekcie' };
    this.router.navigate(['/eshop'], { queryParams });
  }
}
