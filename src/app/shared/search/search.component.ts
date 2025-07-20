// src/app/shared/search/search.component.ts

import {
  Component,
  OnInit,
  HostListener,
  Renderer2,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  filter,
  map,
} from 'rxjs/operators';

import { ProductsService, Product } from 'app/services/products.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { tap, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslateModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit, AfterViewInit {
  @ViewChild('searchOverlay', { static: true }) searchOverlayRef!: ElementRef<HTMLElement>;
  @ViewChild('searchInputRef', { static: false }) searchInputRef!: ElementRef<HTMLInputElement>;

  searchControl = new FormControl('');
  displayedResults: Product[] = [];
  totalCount = 0;
  currentPage = 0;
  isLoading = false;
  isLoadingPage = false;

  suggestions$: Observable<Product[]> = of([]);
  loadingBaseText = '';
  loadingText = '';
  dotCount = 1;
  dotInterval: any;
  /** Po stlačení ENTER / kliknutí na lupa sa načítajú „všetky“ výsledky do allResults */
  results: Product[] = [];
  /** Zobrazené položky (infinite scroll) */

  /** veľkosť „stránky“ */
  private readonly PAGE_SIZE = 20;
  /** ďalší index, odkiaľ naberáme ďalšie položky */
  public nextIndex = 0;

  isVisible = false;
  isOpen = false;
  isClosing = false;
  showDropdown = false;

  /** mapovanie pre shimmer loading: imageUrl -> boolean */
  loadingMap: Record<string, boolean> = {};

  constructor(
    private productsService: ProductsService,
    private router: Router,
    private renderer: Renderer2,
    private translate: TranslateService
    
  ) {}
  
  ngOnInit() {
    // Autocomplete (živé návrhy) pri písaní s loaderom
    this.suggestions$ = this.searchControl.valueChanges.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      filter((value): value is string => !!value && value.trim().length > 2),
      tap(() => { 
        this.isLoading = true; 
      }),
      switchMap((query: string) =>
        this.productsService.searchProducts(query).pipe(
          map(products => products), // zobrazíme max. 5 návrhov
          catchError(() => of([] as Product[])),
          finalize(() => {
            this.isLoading = false;
          })
        )
      )
    );
  }

  ngAfterViewInit() {
    const overlay = this.searchOverlayRef.nativeElement;
    this.renderer.listen(overlay, 'wheel', (e: WheelEvent) => this.onWheel(e));
    this.renderer.listen(overlay, 'touchmove', (e: TouchEvent) => this.onTouchMove(e));
  }
  

  /**
   * Zabraňuje pretláčaniu scrollu mimo overlayu pri kolieskovom scrollovaní.
   */
  private onWheel(event: WheelEvent) {
    const overlay = this.searchOverlayRef.nativeElement;
  
    // Ak to neprišlo priamo z kontajnera overlay­a, necháme event plynúť
    if (event.target !== overlay) {
      return;
    }
  
    const { scrollTop, scrollHeight, clientHeight } = overlay;
    const deltaY = event.deltaY;
  
    // Blokovať len pri pokuse rolovať nad hornou alebo pod dolnou hranou
    if ((deltaY < 0 && scrollTop === 0) ||
        (deltaY > 0 && scrollTop + clientHeight >= scrollHeight)) {
      event.preventDefault();
    }
  }

  /**
   * Zabraňuje pretláčaniu scrollu mimo overlayu pri dotykoch na mobiloch.
   */
  private onTouchMove(event: TouchEvent) {
    const overlay = this.searchOverlayRef.nativeElement;
  
    if (event.target !== overlay) {
      return;
    }
  
    const { scrollTop, scrollHeight, clientHeight } = overlay;
  
    if (scrollHeight <= clientHeight) {
      event.preventDefault();
    }
  }

  /** Otvorí overlay a obnoví posledný query + výsledky z localStorage */
  openOverlay(): void {
    // 1) Clear any previous results and loading state
    this.clearAllResults();
    this.isLoading = false;
    this.showDropdown = false;
  
    // 2) Reset the input to empty (won't trigger a search because '' is filtered out)
    this.searchControl.setValue('');
  
    // 3) Show the overlay
    this.isVisible = true;
    setTimeout(() => {
      this.isOpen = true;
      this.isClosing = false;
      this.renderer.addClass(document.body, 'no-scroll');
  
      // 4) Focus the freshly-emptied input
      const inputEl =
        this.searchInputRef?.nativeElement ||
        document.querySelector<HTMLInputElement>('.search-input-full');
      if (inputEl) {
        inputEl.focus();
      }
    }, 10);
  }

  searchFromLink(term: string): void {
    this.searchControl.setValue(term);
    this.onSearch(true);
  }

  onSearch(storeInLocal: boolean = true): void {
    this.isLoading = true;

    this.showDropdown = false;

    const query = this.searchControl.value?.trim() || '';
    if (!query) {
      this.clearAllResults();
      if (storeInLocal) {
        localStorage.removeItem('lastSearchQuery');
      }
      return;
    }

    if (storeInLocal) {
      localStorage.setItem('lastSearchQuery', query);
    }

    this.productsService.searchProducts(query).subscribe({
      next: products => {
        this.results = products;
        this.nextIndex = 0;
        this.displayedResults = [];
        this.appendNextPage();

        this.loadingMap = {};
        this.displayedResults.forEach(p => {
          if (p.primaryImageUrl) {
            this.loadingMap[p.primaryImageUrl] = true;
            this.isLoading = false
          }
        });
      },
      error: () => {
        this.clearAllResults();
      },
    });
  }


  
  startLoadingDots() {
    this.translate.get('ESHOP.LOADING_PRODUCTS').subscribe({
      next: (base) => {
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

  selectSuggestion(product: Product) {
    this.searchControl.setValue(product.name);
    this.onSearch(true);
    this.showDropdown = false;
  }

  onFocus() {
    this.showDropdown = true;
  }

  onBlur() {
    setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  /** Odstráni všetky výsledky */
  private clearAllResults() {
    this.results = [];
    this.displayedResults = [];
    this.nextIndex = 0;
    this.loadingMap = {};
  }

  /** Pridá ďalších PAGE_SIZE položiek do displayedResults, ak existujú */
  private appendNextPage() {
    const start = this.nextIndex;
    const end = Math.min(this.nextIndex + this.PAGE_SIZE, this.results.length);
    if (start < end) {
      const slice = this.results.slice(start, end);
      this.displayedResults = this.displayedResults.concat(slice);
      this.nextIndex = end;
    }
  }

  /** Handler scrollu vo výsledkoch (infinite scroll) */
  onResultsScroll(e: Event) {
    const tgt = e.target as HTMLElement;
    if (tgt.scrollTop + tgt.clientHeight >= tgt.scrollHeight - 100) {
      // 1) remember where we started
      const oldIndex = this.nextIndex;
  
      // 2) append the next page (will update this.nextIndex)
      this.appendNextPage();
  
      // 3) only mark the truly new items
      const newIndex = this.nextIndex;
      this.displayedResults
        .slice(oldIndex, newIndex)
        .forEach(p => {
          if (p.primaryImageUrl) {
            this.loadingMap[p.primaryImageUrl] = true;
          }
        });
    }
  }

  /** Zatvorí overlay s animáciou: slide-out */
  closeOverlay(): void {
    this.isClosing = true;
    this.isOpen = false;
    setTimeout(() => {
      this.isVisible = false;
      this.isClosing = false;
      this.clearAllResults();
      this.renderer.removeClass(document.body, 'no-scroll');
    }, 300);
  }

  /** Klik na konkrétny výsledok: najprv zatvoríme overlay, potom navigujeme */
  onSelectProduct(p: Product) {
    this.isClosing = true;
    this.isOpen = false;
    setTimeout(() => {
      this.isVisible = false;
      this.isClosing = false;
      this.clearAllResults();
      this.renderer.removeClass(document.body, 'no-scroll');
      this.router.navigate(['/eshop', p.slug]);
    }, 300);
  }

  /** Event po načítaní obrázka: odstráni shimmer pre dané URL */
  onImageLoad(url: string): void {
    this.loadingMap[url] = false;
  }

  onImageError(url: string): void {
    this.loadingMap[url] = false;
  }

  @HostListener('keydown.enter', ['$event'])
  handleEnter(event: KeyboardEvent) {
    event.preventDefault();
    this.onSearch(true);
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc() {
    if (this.isVisible && !this.isClosing) {
      this.closeOverlay();
    }
  }

  /**
   * Nová metóda: vymaže obsah inputu aj zo storage, zruší výsledky a schová dropdown.
   */
  clearInput(): void {
    // 1) Vymazať hodnotu formulárového ovládacieho prvku
    this.searchControl.setValue('');
    // 2) Odstrániť uložený posledný dopyt (ak existuje)
    localStorage.removeItem('lastSearchQuery');
    // 3) Vyčistiť všetky zobrazené výsledky
    this.clearAllResults();
    // 4) Skryť rozbaľovací zoznam návrhov
    this.showDropdown = false;
    // 5) Vrátiť fokus na input
    setTimeout(() => {
      const inputEl = this.searchInputRef?.nativeElement || document.querySelector<HTMLInputElement>('.search-input-full');
      if (inputEl) {
        inputEl.focus();
      }
    }, 0);
  }
}
