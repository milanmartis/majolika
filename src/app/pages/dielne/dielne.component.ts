import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { FooterComponent } from 'app/components/footer/footer.component';

@Component({
  selector: 'app-dielne',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, FooterComponent],
  templateUrl: `./dielne.component.html`,
  styleUrls: ['./dielne.component.css']
  
})
export class DielneComponent {
  media: { type: 'image' | 'video'; src: string; poster?: string }[] = [
    { type: 'image', src: '/assets/img/gall/1.jpg' },
    { type: 'video', src: '/assets/video/majolica.mp4', poster: '/assets/img/video-thumbnails/majolica.jpg' },
    { type: 'video', src: '/assets/video/majolica555.mp4', poster: '/assets/img/video-thumbnails/majolica555.jpg' },
    { type: 'image', src: '/assets/img/gall/2.jpg' },
    { type: 'image', src: '/assets/img/gall/3.jpg' },
    { type: 'image', src: '/assets/img/gall/4.jpg' }
  ];
  

  isFullscreen = false;
  currentIndex = 0;
  currentMedia: { type: 'image' | 'video'; src: string } | null = null;
  imgState = 'hidden'; // 📌 Pre postupné zobrazenie loga

  ngOnInit(): void {
    setTimeout(() => {
      this.imgState = 'visible'; // ✅ Logo sa zobrazí po 300 ms
    }, 300);
  }

  openFullscreen(index: number) {
    this.currentIndex = index;
    this.currentMedia = this.media[this.currentIndex];
    this.isFullscreen = true;
  }

  closeFullscreen() {
    this.isFullscreen = false;
    setTimeout(() => {
      this.currentMedia = null;
    }, 300); // ✅ Počká na dokončenie animácie
  }

  prevMedia() {
    this.currentIndex = (this.currentIndex - 1 + this.media.length) % this.media.length;
    this.currentMedia = this.media[this.currentIndex];
  }

  nextMedia() {
    this.currentIndex = (this.currentIndex + 1) % this.media.length;
    this.currentMedia = this.media[this.currentIndex];
  }
}
