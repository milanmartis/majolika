import { Component, Inject, Renderer2, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from 'app/services/language.service';
import { fadeInOutAnimation } from 'app/animations/route.animations';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';


@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  animations: [
    fadeInOutAnimation,
    trigger('fadeIn', [
      state('visible', style({ opacity: 1 })),
      transition('void => visible', [style({ opacity: 0 }), animate('0.5s ease-in')])
    ]),
    trigger('slideUp', [
      state('visible', style({ transform: 'translateY(0)', opacity: 1 })),
      transition('void => visible', [style({ transform: 'translateY(100%)', opacity: 0 }), animate('0.4s ease-out')])
    ])
  ]
})
export class HomeComponent implements OnInit {
  // ✅ Cyklická rotácia ikoniek
  iconFiles: string[] = ['2.png','1.png','3.png'];
  currentIndex: number = 0;
  currentLang: string = 'sk'; // Predvolený jazyk

  imgState = 'hidden'; // Animácia zobrazenia obrázka

  // ✅ Aktívna kategória galérie
  activeCategory: string = 'traditional';

  // ✅ Kategórie galérií
  categories = [
    { id: 'traditional', name: 'CATEGORIES2.TRADITIONAL' },
    { id: 'modern', name: 'CATEGORIES2.MODERN' },
    { id: 'limited', name: 'CATEGORIES2.LIMITED' }
  ];


  // ✅ Obrázky pre každú kategóriu (rovnaký počet)
  traditionalImages = [
    { src: '/assets/img/eshop/e/1.jpg', name: 'Váza Libuša', price: '60,- €', showInfo: false },
    { src: '/assets/img/eshop/e/18.jpg', name: 'Tanier na nohe', price: '60,- €', showInfo: false },
    { src: '/assets/img/eshop/e/3.jpg', name: 'Váza prehýbaná', price: '45,- €', showInfo: false },
    { src: '/assets/img/eshop/e/8.jpg', name: 'Kalich', price: '39,- €', showInfo: false },
    { src: '/assets/img/eshop/e/17.jpg', name: 'Tanier', price: '28,- €', showInfo: false },
    { src: '/assets/img/eshop/e/16.jpg', name: 'Džbán', price: '30,- €', showInfo: false },

  ];

  modernImages = [

    { src: '/assets/img/eshop/e/19.jpg', name: 'Šálka čajová Modré pierko', price: '25,- €', showInfo: false },
    { src: '/assets/img/eshop/e/2.jpg', name: 'Váza habánska Kruhy', price: '65,- €', showInfo: false },
    { src: '/assets/img/eshop/e/11.jpg', name: 'Váza habánska Kruhy', price: '65,- €', showInfo: false },
    { src: '/assets/img/eshop/e/20.jpg', name: 'Pohár s uškom SKRATKY', price: '29,- €', showInfo: false },
    { src: '/assets/img/eshop/e/21.jpg', name: 'Tanier plytký modrá glazúra', price: '20,- €', showInfo: false },

  ];

  limitedImages = [
    { src: '/assets/img/eshop/e/5.jpg', name: 'Veľkonočná výslužka malá', price: '70,- €', showInfo: false },
    { src: '/assets/img/eshop/e/6.jpg', name: 'Hrnček a kniha Slovenská ľudová majolika v Modre', price: '44,- €', showInfo: false },
    { src: '/assets/img/eshop/e/9.jpg', name: 'Šálka s podšálkou a káva', price: '39,- €', showInfo: false },
    { src: '/assets/img/eshop/e/15.jpg', name: 'Podnos a hrnčeky', price: '80,- €', showInfo: false },
  ];

  constructor(@Inject(LanguageService) private languageService: LanguageService, private renderer: Renderer2, private router: Router) {}

  // ✅ Funkcia na prepnutie kategórie
  selectCategory(category: string) {
    this.activeCategory = category;
  }

  // ✅ Získanie obrázkov podľa kategórie
  getCategoryImages(category: string) {
    switch (category) {
      case 'traditional':
        return this.traditionalImages;
      case 'modern':
        return this.modernImages;
      case 'limited':
        return this.limitedImages;
      default:
        return [];
    }
  }

  // ✅ Fullscreen funkcie
  isFullscreen: boolean = false;
  fullscreenState: string = 'hidden';
  switchLanguage(lang: string) {
    this.languageService.changeLanguage(lang);
    this.currentLang = lang;
  }  

  isActive(lang: string): boolean {
    return this.currentLang === lang;
  }
  openFullscreen(index: number, event?: Event) {
    if (event) event.stopPropagation();
    this.currentIndex = index;
    this.isFullscreen = true;
    this.fullscreenState = 'visible';
  }

  closeFullscreen(event?: Event) {
    if (event) event.stopPropagation();
    this.isFullscreen = false;
    this.fullscreenState = 'hidden';
  }

  nextImage(event?: Event) {
    if (event) event.stopPropagation();
    this.currentIndex = (this.currentIndex + 1) % this.getCategoryImages(this.activeCategory).length;
  }

  prevImage(event?: Event) {
    if (event) event.stopPropagation();
    this.currentIndex = (this.currentIndex - 1 + this.getCategoryImages(this.activeCategory).length) % this.getCategoryImages(this.activeCategory).length;
  }

  // ✅ Swipe funkcie
  onSwipeLeft() {
    console.log('👉 Swiped Left');
    this.nextImage();
  }

  onSwipeRight() {
    console.log('👈 Swiped Right');
    this.prevImage();
  }

  // ✅ Hover efekt na info box
  showInfo(index: number) {
    this.getCategoryImages(this.activeCategory)[index].showInfo = true;
  }

  hideInfo(index: number) {
    this.getCategoryImages(this.activeCategory)[index].showInfo = false;
  }



  // ✅ Init animácie a autoplay videa
  ngOnInit(): void {
    setTimeout(() => {
      this.imgState = 'visible';
    }, 300);

    setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.iconFiles.length;
    }, 1600);

    setTimeout(() => {
      const video: HTMLVideoElement | null = document.querySelector('.background-video');
      if (video) {
        video.play().catch(error => console.error("Autoplay failed:", error));
      }
    }, 500);
  }
}
