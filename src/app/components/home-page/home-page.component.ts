import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FooterComponent } from 'app/components/footer/footer.component';
import { ProductsService, Category } from '../../services/products.service';

import { trigger, style, transition, animate, query, stagger } from '@angular/animations';

type HeadingLevel = 'h1' | 'h2' | 'h3';

interface HeroCardVM {
  imageUrl: string;
  alt: string;
  routerLink: string;
  openInNewTab: boolean;
  buttonText?: string;
}

interface HeroImagesBlock {
  __component: 'homepage.hero-images';
  id?: number;
  items: Array<{
    id?: number;
    alt?: string;
    link?: string;
    openInNewTab?: boolean;
    buttonText?: string;
    image?: any; // u teba image.url + formats
  }>;
}

type HomepageBlock = HeroImagesBlock | any;

type GalleryImage = { url: string; alt: string };

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
    HttpClientModule,
    FooterComponent
  ],
  animations: [
    trigger('fadeInStagger', [
      transition('false => true', [
        query('.choice-card', [
          style({ opacity: 0, transform: 'translateY(-1000px)' }),
          stagger(150, [
            animate(
              '1000ms cubic-bezier(0.25, 0.8, 0.25, 1)',
              style({ opacity: 1, transform: 'translateY(0)' })
            )
          ])
        ], { optional: true })
      ])
    ]),
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css'],
})
export class HomePageComponent implements OnInit, OnDestroy {

  private readonly CMS_BASE = 'https://majolika-cms.appdesign.sk';

  // ✅ len to, čo reálne máš (hero-images/heading/paragraph)
  private readonly HOMEPAGE_URL =
    this.CMS_BASE +
    '/api/homepage' +
    '?populate[content][on][homepage.hero-images][populate][items][populate]=image' +
    '&populate[content][on][homepage.heading]=*' +
    '&populate[content][on][homepage.paragraph]=*';

  animationState = false;

  popularCategories: Category[] = [];
  categoryImgLoadingMap: Record<string, boolean> = {};

  // TOP 2 karty (fallback)
  topHeroCards: HeroCardVM[] = [
    {
      imageUrl: 'https://d1hbdvlfav95nt.cloudfront.net/products/eshop_cb861c9cb5.jpg',
      alt: 'E-shop',
      routerLink: '/eshop',
      openInNewTab: false,
      buttonText: 'E-SHOP',
    },
    {
      imageUrl: 'https://d1hbdvlfav95nt.cloudfront.net/products/dielne_1b69a9d207.jpg',
      alt: 'Dielne',
      routerLink: '/dielne',
      openInNewTab: false,
    }
  ];

  heroLoading: boolean[] = [true, true];

  // všetko pod top
  restBlocks: HomepageBlock[] = [];

  // galéria (iba z prvého rest hero-images bloku)
  galleryImages: GalleryImage[] = [];
  galleryClass = 'gallery-1';

  // bloky, ktoré sa renderujú po galérii
  blocksAfterGallery: HomepageBlock[] = [];

  // modal
  modalOpen = false;
  modalUrl = '';
  modalAlt = '';

  private sub?: Subscription;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private productsSrv: ProductsService

  ) {}

  ngOnInit(): void {
    if (typeof window === 'undefined') {
      this.heroLoading = [false, false];
      return;
    }

    this.loadPopularCategories();

    setTimeout(() => (this.animationState = true), 0);
    this.sub = this.loadHomepage().subscribe();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onHeroImageLoad(i: number): void {
    this.heroLoading[i] = false;
  }

  onHeroImageError(i: number): void {
    this.heroLoading[i] = false;
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }
private loadPopularCategories(): void {
  this.productsSrv.getAllCategoriesFlat().subscribe({
    next: (cats) => {
      const wanted = [
        'misy_a_misky',
        'dzbany',
        'taniere',
        'cajniky',
        'hrnceky',
        'vazy',
        'pohare',
        'svietniky',
        'tvorive-dielne',
        'darcekove-poukazy'
      ];

      this.popularCategories = wanted
        .map(slug => cats.find(c => c.category_slug === slug))
        .filter((c): c is Category => !!c);

      this.categoryImgLoadingMap = Object.fromEntries(
        this.popularCategories.map(c => [c.category_slug, true])
      );
    },
    error: () => {
      this.popularCategories = [];
    }
  });
}

catLabel(c: Category | undefined | null): string {
  if (!c) return '';
  return c.category_name;
}

onCategoryImageLoad(slug: string): void {
  this.categoryImgLoadingMap[slug] = false;
}

onCategoryImageError(slug: string): void {
  this.categoryImgLoadingMap[slug] = false;
}
  private loadHomepage() {
    return this.http.get<any>(this.HOMEPAGE_URL).pipe(
      map((resp) => {
        const dataAny: any = resp?.data;
        const content: HomepageBlock[] = dataAny?.content ?? dataAny?.attributes?.content ?? [];

        // 1) TOP: prvý hero-images blok -> prvé 2 items
        const firstHeroIndex = content.findIndex(b => b?.__component === 'homepage.hero-images');
        const firstHeroBlock = (firstHeroIndex >= 0 ? content[firstHeroIndex] : null) as HeroImagesBlock | null;

        if (firstHeroBlock?.items?.length) {
          const firstTwo = firstHeroBlock.items.slice(0, 2);
          this.heroLoading = [true, true];

          const mapped = firstTwo.map((it, idx) => {
            const imageUrl = this.resolveStrapiImageUrl(it?.image) || this.topHeroCards[idx]?.imageUrl || '';
            const routerLink = this.normalizeRouterLink(it?.link, idx);

            return {
              imageUrl,
              alt: it?.alt || '',
              routerLink,
              openInNewTab: !!it?.openInNewTab,
              buttonText: it?.buttonText,
            } as HeroCardVM;
          });

          if (mapped.length === 1) {
            mapped.push(this.topHeroCards[1]);
            this.heroLoading[1] = false;
          }

          this.topHeroCards = mapped;
        } else {
          this.heroLoading = [false, false];
        }

        // 2) REST: všetko okrem prvého hero bloku
        this.restBlocks = content.filter((_, idx) => idx !== firstHeroIndex);

        // 3) GALÉRIA iba ak prvý REST blok je hero-images
        this.buildGalleryFromFirstRestBlock();

        return true;
      }),
      catchError((err) => {
        console.error('Homepage API error:', err);
        this.heroLoading = [false, false];
        this.restBlocks = [];
        this.galleryImages = [];
        this.blocksAfterGallery = [];
        return of(false);
      })
    );
  }

  private buildGalleryFromFirstRestBlock(): void {
    this.galleryImages = [];
    this.blocksAfterGallery = [...this.restBlocks];

    if (!this.restBlocks.length) return;

    const first = this.restBlocks[0];

    if (first?.__component !== 'homepage.hero-images' || !Array.isArray(first.items)) {
      // žiadna galéria, renderuj všetko normálne
      return;
    }

    const imgs = (first.items as any[])
      .slice(0, 4)
      .map(it => ({
        url: this.resolveStrapiImageUrl(it?.image),
        alt: it?.alt || ''
      }))
      .filter(g => !!g.url);

    if (!imgs.length) return;

    this.galleryImages = imgs;
    this.galleryClass =
      imgs.length <= 1 ? 'gallery-1' :
      imgs.length === 2 ? 'gallery-2' :
      imgs.length === 3 ? 'gallery-3' : 'gallery-4';

    // odstráň prvý block (lebo ho renderujeme ako galériu)
    this.blocksAfterGallery = this.restBlocks.slice(1);
  }

  // ✅ u teba: image.url + image.formats.large.url
  resolveStrapiImageUrl(imageField: any): string {
    const url =
      imageField?.formats?.large?.url ||
      imageField?.formats?.medium?.url ||
      imageField?.url ||
      '';

    if (!url) return '';
    return url.startsWith('/') ? `${this.CMS_BASE}${url}` : url;
  }

  private normalizeRouterLink(link: string | undefined, fallbackIndex: number): string {
    const fallback = fallbackIndex === 0 ? '/eshop' : '/dielne';
    if (!link) return fallback;
    const t = ('' + link).trim();
    if (!t) return fallback;
    return t.startsWith('/') ? t : `/${t}`;
  }

  normalizeLink(link?: string): string {
    if (!link) return '/';
    const t = ('' + link).trim();
    if (!t) return '/';
    return t.startsWith('/') ? t : `/${t}`;
  }

  openModal(url: string, alt: string = ''): void {
    if (!url) return;
    this.modalUrl = url;
    this.modalAlt = alt;
    this.modalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalUrl = '';
    this.modalAlt = '';
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.modalOpen) this.closeModal();
  }
}
