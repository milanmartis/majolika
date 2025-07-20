import {
    Component,
    Input,
    Output,
    EventEmitter,
    HostListener,
    OnInit
  } from '@angular/core';
  import { CommonModule } from '@angular/common';
  
  @Component({
    selector: 'app-gallery',
    standalone: true,
    imports: [CommonModule],
    template: `
      <div class="gallery-overlay">
        <button class="close" (click)="close.emit()">&times;</button>
        <button class="nav prev" (click)="prev()">&larr;</button>
        <img [src]="images[current]" class="gallery-img"/>
        <button class="nav next" (click)="next()">&rarr;</button>
      </div>
    `,
    styles: [`
      .gallery-overlay {
        position: fixed;
        top:0; left:0; right:0; bottom:0;
        background: rgba(0,0,0,0.685);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:99000;
      }
      .gallery-img {
        max-width:90vw;
        max-height:90vh;
      }
      .nav, .close {
        position: absolute;
        background: none;
        border: none;
        color: white;
        font-size: 2.5rem;
        cursor: pointer;
        user-select: none;
      }
      .prev { left: 1rem; }
      .next { right: 1rem; }
      .close { top: 1rem; right: 1rem; font-size: 3rem; }
    `]
  })
  export class GalleryComponent implements OnInit {
    @Input() images: string[] = [];
    @Input() index = 0;
    @Output() close = new EventEmitter<void>();
  
    current!: number;
  
    ngOnInit() {
      this.current = this.index;
    }
  
    prev() {
      this.current = (this.current - 1 + this.images.length) % this.images.length;
    }
  
    next() {
      this.current = (this.current + 1) % this.images.length;
    }
  
    @HostListener('window:keydown.ArrowLeft')  onLeft()  { this.prev(); }
    @HostListener('window:keydown.ArrowRight') onRight() { this.next(); }
    @HostListener('window:keydown.Escape')     onEsc()   { this.close.emit(); }
  }
  