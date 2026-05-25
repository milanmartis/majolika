// src/app/shared/search/search.component.ts

import {
  Component,
  OnInit,
  HostListener,
  Renderer2,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  filter,
  map,
  tap,
  finalize,
  takeUntil
} from 'rxjs/operators';

import { ProductsService, Product, StrapiResp } from 'app/services/products.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SearchService } from 'app/services/search.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslateModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('searchOverlay', { static: true }) searchOverlayRef!: ElementRef<HTMLElement>;
  @ViewChild('searchInputRef', { static: false }) searchInputRef!: ElementRef<HTMLInputElement>;

  private destroy$ = new Subject<void>();

  searchControl = new FormControl<string>('');

  // stránkovanie
  private readonly PAGE_SIZE = 20;
  currentPage = 0;
  pageCount = 0;
  totalCount = 0;

  // dáta
  results: Product[] = [];
  displayedResults: Product[] = [];

  // UI
  isLoading = false;      // prvá strana / autocomplete
  isLoadingPage = false;  // ďalšie strany
  showDropdown = false;
  isVisible = false;
  isOpen = false;
  isClosing = false;

  suggestions$: Observable<Product[]> = of([]);

  loadingBaseText = '';
  loadingText = '';
  dotCount = 1;
  dotInterval: any;

  loadingMap: Record<string, boolean> = {};

  // ikony
  icons = ['tanier','dzban','vaza','pohar','miska'];

  constructor(
    private productsService: ProductsService,
    private router: Router,
    private renderer: Renderer2,
    private translate: TranslateService,
    private searchService: SearchService
  ) {}

  ngOnInit() {
    // otvorenie overlaya zvonka
    this.searchService.openOverlay$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.openOverlay());

    // autocomplete (vyhľadáva naprieč lokalizáciami)
    this.suggestions$ = this.searchControl.valueChanges.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      filter((value): value is string => !!value && value.trim().length > 2),
      tap(() => { this.isLoading = true; }),
      switchMap((query: string) =>
        // !!! locale='all' => hľadá vo všetkých jazykoch
        this.productsService.searchProducts(query, 1, 33, 'all').pipe(
          map((resp: StrapiResp<Product>) => resp.data ?? []),
          catchError(() => of([] as Product[])),
          finalize(() => { this.isLoading = false; })
        )
      )
    );
  }

  ngAfterViewInit() {
    const overlay = this.searchOverlayRef.nativeElement;
    this.renderer.listen(overlay, 'wheel', (e: WheelEvent) => this.onWheel(e));
    this.renderer.listen(overlay, 'touchmove', (e: TouchEvent) => this.onTouchMove(e));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.dotInterval);
  }

  // guards pre scroll v overlaya
  private onWheel(event: WheelEvent) {
    const overlay = this.searchOverlayRef.nativeElement;
    if (event.target !== overlay) return;

    const { scrollTop, scrollHeight, clientHeight } = overlay;
    const deltaY = event.deltaY;

    if (
      (deltaY < 0 && scrollTop === 0) ||
      (deltaY > 0 && scrollTop + clientHeight >= scrollHeight)
    ) {
      event.preventDefault();
    }
  }

  private onTouchMove(event: TouchEvent) {
    const overlay = this.searchOverlayRef.nativeElement;
    if (event.target !== overlay) return;

    const { scrollHeight, clientHeight } = overlay;
    if (scrollHeight <= clientHeight) event.preventDefault();
  }

  openOverlay(): void {
    this.clearAllResults();
    this.resetSearchState();

    this.isVisible = true;
    setTimeout(() => {
      this.isOpen = true;
      this.isClosing = false;
      this.renderer.addClass(document.body, 'no-scroll');

      const inputEl =
        this.searchInputRef?.nativeElement ||
        document.querySelector<HTMLInputElement>('.search-input-full');

      inputEl?.focus();
    }, 10);
  }

  closeOverlay(): void {
    this.isClosing = true;
    this.isOpen = false;
    setTimeout(() => {
      this.isVisible = false;
      this.isClosing = false;
      this.resetSearchState();
      this.renderer.removeClass(document.body, 'no-scroll');
    }, 300);
  }

  searchFromLink(term: string): void {
    const q = (term ?? '').trim();
    if (!q) return;
    this.searchControl.setValue(q);
    this.onSearch(true);
  }

  /** ✅ FIX: klik na ikonku -> prelož text v TS (v template nesmú byť pipes v (click)) */
  searchFromIcon(icon: string): void {
    const key = `ICONS.${String(icon || '').toUpperCase()}`;
    const translated = (this.translate.instant(key) || '').trim();
    // fallback: keď by kľúč neexistoval, tak aspoň použijeme raw icon
    this.searchFromLink(translated && translated !== key ? translated : icon);
  }

  // Presety dekorov – podľa jazyka UI použijeme výraz, ktorý dáva zmysel,
  // no keďže hľadáme cez locale=all, nájde to aj v iných jazykoch.
  searchPreset(preset: 'habansky' | 'modry' | 'pestry' | 'zeleny'): void {
    const lang = (this.translate.currentLang || this.translate.defaultLang || 'sk').toLowerCase();

    const dict: Record<string, Record<string, string>> = {
      habansky: {
        sk: 'habánsky dekór',
        en: 'haban decor',
        de: 'haban dekor',
      },
      modry: {
        sk: 'modrý dekór',
        en: 'blue decor',
        de: 'blaues dekor',
      },
      pestry: {
        sk: 'pestrý dekór',
        en: 'multicolor decor',
        de: 'buntes dekor',
      },
      zeleny: {
        sk: 'zelený dekór',
        en: 'green decor',
        de: 'grünes dekor',
      },
    };

    const term = dict[preset]?.[lang] ?? dict[preset]?.['sk'] ?? '';
    this.searchFromLink(term);
  }

  onSearch(storeInLocal: boolean = true): void {
    this.isLoading = true;
    this.showDropdown = false;

    const query = (this.searchControl.value ?? '').trim();
    if (!query) {
      this.resetSearchState();
      if (storeInLocal) localStorage.removeItem('lastSearchQuery');
      this.isLoading = false;
      return;
    }

    if (storeInLocal) localStorage.setItem('lastSearchQuery', query);

    // reset a načítaj prvú stranu
    this.results = [];
    this.displayedResults = [];
    this.loadingMap = {};
    this.currentPage = 0;
    this.pageCount = 0;
    this.totalCount = 0;

    this.loadPage(query, 1, true);
  }

  private loadPage(query: string, page: number, first = false) {
    this.isLoadingPage = !first;

    // !!! locale='all' => hľadá naprieč všetkými lokalizáciami
    this.productsService.searchProducts(query, page, this.PAGE_SIZE, 'all').subscribe({
      next: (resp: StrapiResp<Product>) => {
        const items = resp.data ?? [];

        // append
        this.results = this.results.concat(items);
        this.displayedResults = this.results;

        // meta
        this.currentPage = resp.meta?.pagination?.page ?? page;
        this.pageCount   = resp.meta?.pagination?.pageCount ?? this.pageCount;
        this.totalCount  = resp.meta?.pagination?.total ?? this.totalCount;

        // shimmer flags
        items.forEach(p => {
          if (p.primaryImageUrl) this.loadingMap[p.primaryImageUrl] = true;
        });
      },
      error: () => {
        if (first) this.resetSearchState();
      },
      complete: () => {
        this.isLoading = false;
        this.isLoadingPage = false;
      },
    });
  }

  onResultsScroll(e: Event) {
    const tgt = e.target as HTMLElement;
    const nearBottom = tgt.scrollTop + tgt.clientHeight >= tgt.scrollHeight - 1100;

    if (nearBottom && !this.isLoadingPage && this.currentPage < this.pageCount) {
      const query = (this.searchControl.value ?? '').trim();
      if (!query) return;
      this.loadPage(query, this.currentPage + 1);
    }
  }

  onImageLoad(url: string): void { this.loadingMap[url] = false; }
  onImageError(url: string): void { this.loadingMap[url] = false; }

  onFocus() { this.showDropdown = true; }
  onBlur()  { setTimeout(() => { this.showDropdown = false; }, 200); }

  @HostListener('document:keydown.enter', ['$event'])
  handleEnter(event: Event) {
    const ke = event as KeyboardEvent;
    ke.preventDefault?.();
    this.onSearch(true);
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.isVisible && !this.isClosing) this.closeOverlay();
  }

  clearInput(): void {
    this.searchControl.setValue('');
    localStorage.removeItem('lastSearchQuery');
    this.resetSearchState();

    setTimeout(() => {
      const inputEl =
        this.searchInputRef?.nativeElement ||
        document.querySelector<HTMLInputElement>('.search-input-full');
      inputEl?.focus();
    }, 0);
  }

  onSelectProduct(p: Product) {
    if (!p?.slug) return;

    this.router.navigate(
      ['/produkt', p.slug],
      {
        queryParams: p.documentId ? { documentId: p.documentId } : undefined
      }
    ).then(() => {
      this.isClosing = true;
      this.isOpen = false;

      setTimeout(() => {
        this.isVisible = false;
        this.isClosing = false;
        this.clearAllResults();
        this.renderer.removeClass(document.body, 'no-scroll');
      }, 300);
    });
  }
  private resetSearchState() {
    this.results = [];
    this.displayedResults = [];
    this.currentPage = 0;
    this.pageCount = 0;
    this.totalCount = 0;
    this.loadingMap = {};
    this.isLoading = false;
    this.isLoadingPage = false;
    this.showDropdown = false;
  }

  public nextIndex = 0;

  private clearAllResults() {
    this.results = [];
    this.displayedResults = [];
    this.nextIndex = 0;
    this.loadingMap = {};
  }

  startLoadingDots() {
    this.translate.get('ESHOP.LOADING_PRODUCTS').subscribe({
      next: base => {
        this.loadingBaseText = base;
        this.loadingText = `${base}...`;
        this.dotCount = 1;
        clearInterval(this.dotInterval);
        this.dotInterval = setInterval(() => {
          this.dotCount = (this.dotCount % 3) + 1;
          const dots = '.'.repeat(this.dotCount);
          this.loadingText = `${this.loadingBaseText}${dots}`;
        }, 500);
      }
    });
  }

  stopLoadingDots() {
    clearInterval(this.dotInterval);
    this.loadingText = '';
  }
}