import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import type { VideoBlock } from 'app/models/blocks.model';

@Component({
  selector: 'app-video-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="video-wrapper my-4 w-full">
      <ng-container *ngIf="isYouTube(block.url); else localVideo">
        <iframe
          [src]="embedUrl"
          width="100%"
          height="400"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      </ng-container>
      <ng-template #localVideo>
        <video autoplay muted controls preload="auto" class="w-full h-auto">
          <source [src]="block.url" type="video/mp4" />
          Your browser does not support HTML5 video.
        </video>
      </ng-template>
      <div *ngIf="block.caption" class="text-sm text-gray-600 mt-2 text-center">
        {{ block.caption }}
      </div>
    </div>
  `,
  styles: [
    `
      .video-wrapper { position: relative; width: 100%; overflow: hidden; }
      .video-wrapper video, .video-wrapper iframe { display: block; width: 100%; height: auto; }
      .text-sm { font-size: .875rem; }
      .mt-2 { margin-top: .5rem; }
      .text-gray-600 { color: #4B5563; }
      .text-center { text-align: center; }
    `
  ]
})
export class VideoBlockComponent implements OnChanges {
  @Input() block!: VideoBlock;
  embedUrl!: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges() {
    if (this.isYouTube(this.block.url)) {
      const embed = this.sanitizeYouTubeUrl(this.block.url) + '?autoplay=1';
      this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embed);
    }
  }

  isYouTube(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  sanitizeYouTubeUrl(url: string): string {
    let videoId = '';
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split(/[?&]/)[0];
    } else {
      videoId = new URL(url).searchParams.get('v') || '';
    }
    return `https://www.youtube.com/embed/${videoId}`;
  }
}