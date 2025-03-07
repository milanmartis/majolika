import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from 'app/services/language.service';
import { HammerModule } from '@angular/platform-browser';
import { slideFullscreenAnimation } from 'app/animations/route.animations';
import { fadeInOutAnimation } from 'app/animations/route.animations';

@Component({
  selector: 'app-tradicia',
  standalone: true,  // ✅ Dôležité!
  imports: [CommonModule, RouterModule, TranslateModule], // ✅ Uisti sa, že je tu `TranslateModule`
  templateUrl: `./tradicia.component.html`,
  styleUrls: ['./tradicia.component.css'],
  animations: [slideFullscreenAnimation, fadeInOutAnimation]
  
})
export class TradiciaComponent {
    images: string[] = [
    '/assets/img/tradicia/1.jpg',
    '/assets/img/tradicia/2.jpg',
    '/assets/img/tradicia/3.jpg',
    '/assets/img/tradicia/4.jpg',
    '/assets/img/tradicia/5.jpg',
    '/assets/img/tradicia/6.jpg'



  ];
  currentIndex: number = 0;
  isFullscreen: boolean = false;
  imgState = 'hidden'; // Počiatočný stav obrázka

 
  // constructor() {}

  // Otvorí fullscreen režim s kliknutým obrázkom
  openFullscreen(index: number) {
    this.currentIndex = index;
    this.isFullscreen = true;
  }

  // Zavrie fullscreen režim
  closeFullscreen() {
    this.isFullscreen = false;
  }

  // Posunie sa na ďalší obrázok
  nextImage() {
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
  }

  // Posunie sa na predchádzajúci obrázok
  prevImage() {
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
  }

  // Swipe gestá pre mobily
  onSwipeLeft() {
    this.nextImage();
  }

  onSwipeRight() {
    this.prevImage();
  }

  ngOnInit(): void {

    
    // ✅ Animované zobrazenie loga po 300ms
    setTimeout(() => {
      this.imgState = 'visible';
    }, 300);
  }

}
  // currentLang: string = '';


// }
