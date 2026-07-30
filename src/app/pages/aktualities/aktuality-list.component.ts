import {
    Component,
    ChangeDetectionStrategy,
    OnInit,
    signal,
    computed,
  } from '@angular/core';
  import {
    trigger,
    transition,
    style,
    animate,
  } from '@angular/animations';
  import { Aktualita, SingleMedia, MediaAttr } from 'app/models/aktualita.model';
  import { AktualityService } from 'app/services/aktuality.service';
  import { LanguageService } from 'app/services/language.service';
  import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';
  import { RouterModule } from '@angular/router';
  import { TranslateModule } from '@ngx-translate/core';
  import { FooterComponent } from 'app/components/footer/footer.component';
  import { NbspSmallWordsPipe } from 'app/pipes/nbsp-small-words.pipe';
  import { LinkifyPipe }        from 'app/pipes/linkify.pipe';
  import { ImageFadeDirective } from './image-fade.directive';

  const PAGE_SIZE = 8;

  @Component({
    selector: 'app-aktuality-list',
    standalone: true,
    imports: [
      CommonModule,
      FormsModule,
      RouterModule,
      TranslateModule,
      FooterComponent,
      NbspSmallWordsPipe,
      LinkifyPipe,
      ImageFadeDirective
    ],
    templateUrl: './aktuality-list.component.html',
    styleUrls: ['./aktuality-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [
      // tento trigger použijeme na každú kartu
      trigger('fadeSlideIn', [
        transition(':enter', [
          style({ opacity: 0, transform: 'translateY(-20px)' }),
          animate(
            '400ms ease-out',
            style({ opacity: 1, transform: 'translateY(0)' })
          )
        ])
      ])
    ]
  })
  export class AktualityListComponent implements OnInit {
    /** koľko kariet pridá jedno kliknutie na „Načítať ďalšie“ */
    private readonly PAGE = PAGE_SIZE;

    /** všetky načítané aktuality (odľahčené) */
    readonly all = signal<Aktualita[]>([]);
    readonly loaded = signal(false);

    /** filtre */
    readonly query = signal('');
    readonly activeCategory = signal<string | null>(null);

    /** koľko kariet je aktuálne viditeľných */
    readonly visibleCount = signal(PAGE_SIZE);

    /** kategórie reálne prítomné v dátach; prázdne -> chips sa nezobrazia */
    readonly categories = computed(() => {
      const map = new Map<string, string>(); // slug -> name
      for (const a of this.all()) {
        for (const c of a.categories ?? []) {
          if (c?.slug) map.set(c.slug, c.name ?? c.slug);
        }
      }
      return Array.from(map, ([slug, name]) => ({ slug, name }));
    });

    /** po aplikovaní hľadania + kategórie */
    readonly filtered = computed(() => {
      const q = this.query().trim().toLowerCase();
      const cat = this.activeCategory();
      return this.all().filter(a => {
        if (cat && !(a.categories ?? []).some(c => c.slug === cat)) return false;
        if (q) {
          const hay = `${a.title ?? ''} ${a.summary ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    });

    /** to, čo sa reálne vykreslí (orezané na visibleCount) */
    readonly visible = computed(() => this.filtered().slice(0, this.visibleCount()));
    readonly canLoadMore = computed(() => this.visible().length < this.filtered().length);

    constructor(
      private aktualityService: AktualityService,
      public lang: LanguageService
    ) {}

    ngOnInit() {
      this.load();
      // Pri zmene jazyka znovu načítaj
      this.lang.langChanged$.subscribe(() => this.load());
    }

    private load() {
      this.loaded.set(false);
      this.aktualityService.getListSlim().subscribe({
        next: items => {
          this.all.set(items);
          this.loaded.set(true);
        },
        error: () => {
          // Nezostaň navždy na „Načítavam…“ – zobraz prázdny stav.
          this.all.set([]);
          this.loaded.set(true);
        },
      });
    }

    onSearch(value: string) {
      this.query.set(value);
      this.visibleCount.set(this.PAGE); // pri zmene filtra začni od prvej strany
    }

    selectCategory(slug: string | null) {
      this.activeCategory.set(slug);
      this.visibleCount.set(this.PAGE);
    }

    loadMore() {
      this.visibleCount.update(n => n + this.PAGE);
    }

    trackBySlug = (_: number, a: Aktualita) => a.slug;

    getMediaUrl(media?: SingleMedia): string {
      const attrs = this.mediaAttrs(media);
      if (!attrs) return '';
      // Karta zobrazuje obrázok na ~290px – netreba plné rozlíšenie.
      // Preferuj menší Strapi formát, plné url je až posledný fallback.
      const f = attrs.formats ?? {};
      return f['medium']?.url || f['small']?.url || attrs.url || '';
    }

    private mediaAttrs(media?: SingleMedia): MediaAttr | null {
      if (!media) return null;
      if ('data' in media) return media.data?.attributes ?? null;
      return media as MediaAttr;
    }
  }
