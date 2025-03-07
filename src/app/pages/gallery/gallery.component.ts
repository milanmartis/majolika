import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { HammerModule } from '@angular/platform-browser';
import { slideFullscreenAnimation } from 'app/animations/route.animations';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, HammerModule],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css'],
  animations: [slideFullscreenAnimation]
})
export class GalleryComponent {
  images: string[] = [
    '/assets/img/gall/1.jpg',
    '/assets/img/gall/9.jpg',
    '/assets/img/gall/5.jpg',
    '/assets/img/gall/6.jpg',
    '/assets/img/gall/3.jpg',
    '/assets/img/gall/2.jpg',
    '/assets/img/gall/4.jpg',
    '/assets/img/gall/7.jpg',
    '/assets/img/gall/8.jpg',


  ];
  currentIndex: number = 0;
  isFullscreen: boolean = false;

  constructor() {}

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
}
