// src/app/pages/aktualities/aktualita-detail.component.ts
import {
    Component,
    ChangeDetectionStrategy,
    OnInit,
    HostListener,
    Inject
  } from '@angular/core';
  import { ActivatedRoute } from '@angular/router';
  import { AktualityService } from 'app/services/aktuality.service';
  import { Observable } from 'rxjs';
  import { switchMap, map, tap } from 'rxjs/operators';
  import { Aktualita, MediaData, MediaAttr, SingleMedia } from 'app/models/aktualita.model';
  import { CommonModule } from '@angular/common';
  import { RouterModule } from '@angular/router';
  import { FooterComponent } from 'app/components/footer/footer.component';
  import { TranslateModule } from '@ngx-translate/core';
  import { LOCALE_ID } from '@angular/core';
  import { LanguageService } from 'app/services/language.service';
  import { NbspSmallWordsPipe } from 'app/pipes/nbsp-small-words.pipe';
  import { LinkifyPipe }        from 'app/pipes/linkify.pipe';
  import { ShareButtonsComponent } from 'app/shared/share-buttons/share-buttons.component'; 
  import { Router } from '@angular/router';



  @Component({
    selector: 'app-aktualita-detail',
    standalone: true,
    imports: [CommonModule, RouterModule, FooterComponent, TranslateModule, NbspSmallWordsPipe, LinkifyPipe, ShareButtonsComponent],
    templateUrl: './aktualita-detail.component.html',
    styleUrls: ['./aktualita-detail.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
  })
  export class AktualitaDetailComponent implements OnInit {
    aktualita$!: Observable<Aktualita>;
    others$!: Observable<Aktualita[]>;
    articleUrl = window.location.href; 

    // gallery state
    galleryThumbs: string[] = [];
    galleryFull: string[] = [];
    isFullscreen = false;
    fullscreenIndex = 0;
  
    constructor(
      private route: ActivatedRoute,
      private aktualityService: AktualityService,
      public lang: LanguageService,
      private router: Router, 
      @Inject(LOCALE_ID) public locale: string

    ) {}
  


    ngOnInit() {
      // Load main article, build gallery
      this.aktualita$ = this.route.paramMap.pipe(
        switchMap(pm => this.aktualityService.getBySlug(pm.get('slug')!)),
        tap(akt => this.buildGallery(akt))
      );



      // Load other articles
      this.others$ = this.route.paramMap.pipe(
        switchMap(pm => {
          const slug = pm.get('slug')!;
          return this.aktualityService.getAll().pipe(
            map(all => all.filter(a => a.slug !== slug).slice(0, 3))
          );
        })
      );

      
    }
  
    /** Build thumbs & full URLs, skip invalid entries */
    private buildGallery(akt: Aktualita) {
      const rawItems: (MediaData | MediaAttr)[] = [];
      // gallery can be MultiMedia or array of MediaAttr
      if (akt.gallery) {
        if ('data' in akt.gallery && Array.isArray(akt.gallery.data)) {
          akt.gallery.data.forEach(item => rawItems.push(item));
        } else if (Array.isArray(akt.gallery as any)) {
          (akt.gallery as MediaAttr[]).forEach(item => rawItems.push(item));
        }
      }
  
      // Filter valid items
      const items = rawItems.filter(item => {
        const attrs = this.extractAttributes(item);
        return attrs !== null;
      });
  
      // Build arrays
      this.galleryThumbs = items.map(item => {
        const attrs = this.extractAttributes(item)!;
        return attrs.formats?.['thumbnail']?.url || attrs.url;
      });
      this.galleryFull = items.map(item => {
        const attrs = this.extractAttributes(item)!;
        return attrs.formats?.['large']?.url || attrs.url;
      });
    }
  
    private extractAttributes(item: MediaData | MediaAttr | SingleMedia): MediaAttr | null {
      // handle SingleMedia wrapper
      if ('data' in item && item.data) {
        item = item.data;
      }
      if ((item as MediaData).attributes) {
        return (item as MediaData).attributes;
      }
      if ((item as MediaAttr).url) {
        return item as MediaAttr;
      }
      return null;
    }
  
    openFullscreen(i: number) {
      this.fullscreenIndex = i;
      this.isFullscreen = true;
      document.body.classList.add('no-scroll');
    }
    closeFullscreen() {
      this.isFullscreen = false;
      document.body.classList.remove('no-scroll');
    }
    prev(e: Event) {
      e.stopPropagation();
      this.fullscreenIndex = (this.fullscreenIndex - 1 + this.galleryFull.length) % this.galleryFull.length;
    }
    next(e: Event) {
      e.stopPropagation();
      this.fullscreenIndex = (this.fullscreenIndex + 1) % this.galleryFull.length;
    }
  
    @HostListener('document:keydown.arrowleft', ['$event'])
    onLeft(e: KeyboardEvent) {
      if (this.isFullscreen) { e.preventDefault(); this.prev(e as any); }
    }
    @HostListener('document:keydown.arrowright', ['$event'])
    onRight(e: KeyboardEvent) {
      if (this.isFullscreen) { e.preventDefault(); this.next(e as any); }
    }
    @HostListener('document:keydown.escape')
    onEsc() { this.closeFullscreen(); }
  
    getMediaUrl(media: MediaData | MediaAttr | SingleMedia): string {
      const attrs = this.extractAttributes(media as any);
      return attrs ? (attrs.formats?.['medium']?.url || attrs.url) : '';
    }
    getAltText(media: MediaData | MediaAttr | SingleMedia): string {
      const attrs = this.extractAttributes(media as any);
      return attrs?.alternativeText || '';
    }
  }
  