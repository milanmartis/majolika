import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxMasonryModule } from 'ngx-masonry';
import { LightboxModule, Lightbox } from 'ngx-lightbox';

interface Album {
  src: string;
  caption: string;
  thumb: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, NgxMasonryModule, LightboxModule],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css']
})
export class GalleryComponent {
  albums: Album[] = [];

  constructor(private lightbox: Lightbox) {
    const filenames = [
      'img1.jpg',
      'img2.jpg',
      'img3.jpg',
      'img4.jpg',
      'img5.jpg',
      'img6.jpg',
      'img7.jpg',
      'img8.jpg',
      'img9.jpg'
    ];

    this.albums = filenames.map(name => ({
      src: `assets/images/${name}`,
      thumb: `assets/images/${name}`,
      caption: name
    }));
  }

  open(index: number): void {
    this.lightbox.open(this.albums, index);
  }
}
