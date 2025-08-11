// © 2025 – Slovenská ľudová majolika
import {
  Component,
  HostListener,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterModule,
  ActivatedRoute
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FooterComponent } from 'app/components/footer/footer.component';

@Component({
  selector: 'app-eshop',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FooterComponent
  ],
  templateUrl: './eshop.component.html',
  styleUrls: ['./eshop.component.css']
})
export class EshopComponent implements OnInit {
  /** Získaný slug kategórie z URL */
  categorySlug: string | null = null;

  images = [
    { src: '/assets/img/eshop/e/1.jpg', name: 'Váza Libuša', price: '60,- €' },
    { src: '/assets/img/eshop/e/9.jpg', name: 'Šálka s podšálkou', price: '39,- €' },
    { src: '/assets/img/eshop/e/5.jpg', name: 'Veľkonočná výslužka', price: '70,- €' },
    { src: '/assets/img/eshop/e/6.jpg', name: 'Hrnček a kniha', price: '44,- €' },
    { src: '/assets/img/eshop/e/3.jpg', name: 'Váza prehýbaná', price: '45,- €' },
    { src: '/assets/img/eshop/e/2.jpg', name: 'Váza habánska', price: '65,- €' },
    { src: '/assets/img/eshop/e/4.jpg', name: 'Výstavná váza', price: '2 000,- €' },
    { src: '/assets/img/eshop/e/7.jpg', name: 'Pohár na stopke', price: '39,- €' }
  ];

  currentIndex = 0;
  isFullscreen = false;
  fullscreenState: 'hidden' | 'visible' = 'hidden';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    // Načítame slug kategórie z URL /eshop/categories/:categorySlug
    this.categorySlug = this.route.snapshot.paramMap.get('categorySlug');
    // Tu môžeš podľa categorySlug filtrovať this.images, alebo ho len zobrazovať
    console.log('Vybraná kategória:', this.categorySlug);
  }

  openFullscreen(idx: number, event?: Event) {
    event?.stopPropagation();
    this.currentIndex = idx;
    this.isFullscreen = true;
    this.fullscreenState = 'visible';
    document.body.classList.add('no-scroll');
  }

  closeFullscreen(event?: Event) {
    event?.stopPropagation();
    this.isFullscreen = false;
    this.fullscreenState = 'hidden';
    document.body.classList.remove('no-scroll');
  }

  nextImage(event?: Event) {
    event?.stopPropagation();
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
  }

  prevImage(event?: Event) {
    event?.stopPropagation();
    this.currentIndex =
      (this.currentIndex - 1 + this.images.length) % this.images.length;
  }

  // Klávesové šípky + Esc
  @HostListener('document:keydown.arrowright')
  handleArrowRight() {
    this.nextImage();
  }
  @HostListener('document:keydown.arrowleft')
  handleArrowLeft() {
    this.prevImage();
  }
  @HostListener('document:keydown.escape')
  handleEscape() {
    this.closeFullscreen();
  }

  // Swipe (potrebuješ HammerModule a HammerJS import v main.ts)
  onSwipeLeft() {
    this.nextImage();
  }
  onSwipeRight() {
    this.prevImage();
  }
}
