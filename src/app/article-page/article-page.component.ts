import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

import { ArticleService } from 'app/services/article.service';
import { HeadingBlockComponent } from 'app/blocks/heading-block/heading-block.component';
import { TextBlockComponent } from 'app/blocks/text-block/text-block.component';
import { ImageBlockComponent } from 'app/blocks/image-block/image-block.component';
import { LinkBlockComponent } from 'app/blocks/link-block/link-block.component';
import { VideoBlockComponent } from 'app/blocks/video-block/video-block.component';
import { FooterComponent } from 'app/components/footer/footer.component';
import { GalleryComponent } from 'app/components/gallery/gallery.component';

import type { Article } from 'app/models/article.model';
import type { ContentBlock, ImageBlock } from 'app/models/blocks.model';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger
} from '@angular/animations';

@Component({
  selector: 'app-article-page',
  standalone: true,
  imports: [
    CommonModule,
    HeadingBlockComponent,
    TextBlockComponent,
    ImageBlockComponent,
    LinkBlockComponent,
    VideoBlockComponent,
    FooterComponent,
    GalleryComponent
  ],
  templateUrl: './article-page.component.html',
  styleUrls: ['./article-page.component.css'],
  animations: [
      trigger('listAnimation', [
        transition(':enter', [
          // nájdi všetky .block-item vnútri gridu
          query('.block-item', [
            // štartovacie štýly
            style({ opacity: 0, transform: 'translateY(20px)' }),
            // postupné animovanie s odstupom 100 ms
            stagger('100ms', [
              animate(
                '500ms ease-out',
                style({ opacity: 1, transform: 'translateY(0)' })
              )
            ])
          ], { optional: true })
        ])
      ])
    ]
})
export class ArticlePageComponent {
  article$!: Observable<Article>;
  imageUrls: string[] = [];
  galleryOpen = false;
  galleryIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private articleService: ArticleService
  ) {
    this.article$ = this.route.paramMap.pipe(
      map(pm => pm.get('slug')!),
      switchMap(slug => this.articleService.getArticleBySlug(slug)),
      tap(article => {
        this.imageUrls = article.content
          .filter((b): b is ImageBlock => b.__component === 'blocks.image-block')
          .map(b => b.largeUrl);
      })
    );
  }

  openGallery(mediaUrl: string) {
    const idx = this.imageUrls.indexOf(mediaUrl);
    if (idx < 0) return;
    this.galleryIndex = idx;
    this.galleryOpen = true;
  }

  closeGallery() {
    this.galleryOpen = false;
  }

  isFullWidth(block: ContentBlock): boolean {
    return (
      block.__component === 'blocks.heading-block' ||
      block.__component === 'blocks.link-block' ||
      block.__component === 'blocks.video-block'
    );
  }

  isHeading = (b: ContentBlock): b is any => b.__component === 'blocks.heading-block';
  isText = (b: ContentBlock): b is any => b.__component === 'blocks.text-block';
  isImage = (b: ContentBlock): b is ImageBlock => b.__component === 'blocks.image-block';
  isLink = (b: ContentBlock): b is any => b.__component === 'blocks.link-block';
  isVideo = (b: ContentBlock): b is any => b.__component === 'blocks.video-block';

  trackByIndex = (_: number) => _;
}