// src/app/pages/aktualities/aktualita-detail.component.ts
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  HostListener,
  Inject,
} from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { switchMap, map, tap, catchError, shareReplay } from 'rxjs/operators';
import { LOCALE_ID } from '@angular/core';

import { AktualityService } from 'app/services/aktuality.service';
import { LanguageService } from 'app/services/language.service';
import {
  Aktualita,
  MediaData,
  MediaAttr,
  SingleMedia,
} from 'app/models/aktualita.model';

import { FooterComponent } from 'app/components/footer/footer.component';
import { TranslateModule } from '@ngx-translate/core';
import { NbspSmallWordsPipe } from 'app/pipes/nbsp-small-words.pipe';
import { LinkifyPipe } from 'app/pipes/linkify.pipe';
import { ShareButtonsComponent } from 'app/shared/share-buttons/share-buttons.component';
import { MarkdownLitePipe } from 'app/pipes/markdown-lite.pipe';

@Component({
  selector: 'app-aktualita-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FooterComponent,
    TranslateModule,
    NbspSmallWordsPipe,
    LinkifyPipe,
    ShareButtonsComponent,
    MarkdownLitePipe,
  ],
  templateUrl: './aktualita-detail.component.html',
  styleUrls: ['./aktualita-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AktualitaDetailComponent implements OnInit {
  aktualita$!: Observable<Aktualita | null>;
  others$!: Observable<Aktualita[]>;
  notFound$!: Observable<boolean>;

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
    const slug$ = this.route.paramMap.pipe(
      map((pm) => (pm.get('slug') || '').trim()),
      shareReplay(1)
    );

    this.aktualita$ = slug$.pipe(
      switchMap((slug) => {
        if (!slug) return of(null); // ✅ slug neexistuje
        return this.aktualityService.getBySlug(slug).pipe(
          tap((akt) => this.buildGallery(akt)),
          catchError(() => of(null)) // ✅ 404/500 => null (nezrúti layout)
        );
      }),
      shareReplay(1)
    );

    this.notFound$ = this.aktualita$.pipe(map((akt) => !akt));

    this.others$ = slug$.pipe(
      switchMap((slug) => {
        if (!slug) return of([]); // ✅ bez slugu nedávaj "ďalšie"
        return this.aktualityService.getAll().pipe(
          map((all) => all.filter((a) => a.slug !== slug).slice(0, 53)),
          catchError(() => of([]))
        );
      })
    );
  }

  /** Build thumbs & full URLs, skip invalid entries */
  private buildGallery(akt: Aktualita) {
    const rawItems: (MediaData | MediaAttr)[] = [];

    if (akt.gallery) {
      if ('data' in akt.gallery && Array.isArray(akt.gallery.data)) {
        akt.gallery.data.forEach((item) => rawItems.push(item));
      } else if (Array.isArray(akt.gallery as any)) {
        (akt.gallery as MediaAttr[]).forEach((item) => rawItems.push(item));
      }
    }

    const items = rawItems.filter((item) => this.extractAttributes(item) !== null);

    this.galleryThumbs = items.map((item) => {
      const attrs = this.extractAttributes(item)!;
      return attrs.formats?.['thumbnail']?.url || attrs.url;
    });

    this.galleryFull = items.map((item) => {
      const attrs = this.extractAttributes(item)!;
      return attrs.formats?.['large']?.url || attrs.url;
    });
  }

  private extractAttributes(
    item: MediaData | MediaAttr | SingleMedia
  ): MediaAttr | null {
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

  prev(e?: Event) {
    e?.stopPropagation();
    if (!this.galleryFull.length) return;
    this.fullscreenIndex =
      (this.fullscreenIndex - 1 + this.galleryFull.length) %
      this.galleryFull.length;
  }

  next(e?: Event) {
    e?.stopPropagation();
    if (!this.galleryFull.length) return;
    this.fullscreenIndex =
      (this.fullscreenIndex + 1) % this.galleryFull.length;
  }

  goToArticle(slug: string) {
    this.closeFullscreen(); // ✅ reset overlay pri prekliku
    this.router.navigate(['/aktuality', slug]).then(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById('articleTop');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  // ✅ bulletproof: prijmi Event, nie KeyboardEvent
  @HostListener('document:keydown.arrowleft', ['$event'])
  onLeft(e: Event) {
    const ke = e as KeyboardEvent;
    if (!this.isFullscreen) return;
    ke.preventDefault();
    this.prev(ke);
  }

  @HostListener('document:keydown.arrowright', ['$event'])
  onRight(e: Event) {
    const ke = e as KeyboardEvent;
    if (!this.isFullscreen) return;
    ke.preventDefault();
    this.next(ke);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.closeFullscreen();
  }

  getMediaUrl(media: MediaData | MediaAttr | SingleMedia): string {
    const attrs = this.extractAttributes(media as any);
    return attrs ? attrs.formats?.['medium']?.url || attrs.url : '';
  }

  getAltText(media: MediaData | MediaAttr | SingleMedia): string {
    const attrs = this.extractAttributes(media as any);
    return attrs?.alternativeText || '';
  }
}