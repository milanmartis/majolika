import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
// import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FooterComponent } from 'app/components/footer/footer.component';


// import { HammerModule, HAMMER_GESTURE_CONFIG } from '@angular/platform-browser';

// import { HammerGestureConfig } from '@angular/platform-browser';
// import * as Hammer from 'hammerjs'; // 🔥 Toto pridaj!

// export class MyHammerConfig extends HammerGestureConfig {
//   override overrides: any = {
//     swipe: { direction: Hammer.DIRECTION_HORIZONTAL, threshold: 10 }
//   };
// }


@Component({
  selector: 'app-eshop',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FooterComponent],
  templateUrl: `./eshop.component.html`,
  styleUrls: ['./eshop.component.css'],

  // providers: [
  //   { provide: HAMMER_GESTURE_CONFIG, useClass: MyHammerConfig }
  // ]
})
export class EshopComponent {
  images = [
    { src: '/assets/img/eshop/e/1.jpg', name: 'Váza Libuša', price: '60,- €', showInfo: false },
    { src: '/assets/img/eshop/e/9.jpg', name: 'Šálka s podšálkou a káva', price: '39,- €', showInfo: false },
    { src: '/assets/img/eshop/e/5.jpg', name: 'Veľkonočná výslužka malá', price: '70,- €', showInfo: false },
    { src: '/assets/img/eshop/e/6.jpg', name: 'Hrnček a kniha Slovenská ľudová majolika v Modre', price: '44,- €', showInfo: false },
    { src: '/assets/img/eshop/e/3.jpg', name: 'Váza prehýbaná', price: '45,- €', showInfo: false },
    { src: '/assets/img/eshop/e/2.jpg', name: 'Váza habánska Kruhy', price: '65,- €', showInfo: false },
    { src: '/assets/img/eshop/e/4.jpg', name: 'Výstavná váza veľká', price: '2 000,- €', showInfo: false },
    { src: '/assets/img/eshop/e/7.jpg', name: 'Pohár na stopke, 6ks', price: '39,- €', showInfo: false },
    // { src: '/assets/img/eshop/e/8.jpg', name: 'Kalich', price: '39,- €', showInfo: false }
  ];

  currentIndex: number = 0;
  isFullscreen: boolean = false;
  fullscreenState: string = 'hidden'; // Pre animáciu slideUp

  openFullscreen(index: number, event?: Event) {
    if (event) event.stopPropagation();
    this.currentIndex = index;
    this.isFullscreen = true;
    this.fullscreenState = 'visible'; // Spustí animáciu
  }

  closeFullscreen(event?: Event) {
    if (event) event.stopPropagation();
    this.isFullscreen = false;
    this.fullscreenState = 'hidden';
  }

  nextImage(event?: Event) {
    if (event) event.stopPropagation();
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
  }

  prevImage(event?: Event) {
    if (event) event.stopPropagation();
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
  }

  onSwipeLeft() {
    console.log('👉 Swiped Left');
    this.nextImage();
  }

  onSwipeRight() {
    console.log('👈 Swiped Right');
    this.prevImage();
  }

  showInfo(index: number) {
    this.images[index].showInfo = true;
  }

  hideInfo(index: number) {
    this.images[index].showInfo = false;
  }

  @HostListener('document:keydown.arrowright', ['$event'])
  handleArrowRight(event: KeyboardEvent) {
    this.nextImage();
  }

  @HostListener('document:keydown.arrowleft', ['$event'])
  handleArrowLeft(event: KeyboardEvent) {
    this.prevImage();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscape(event: KeyboardEvent) {
    this.closeFullscreen();
  }
}
