import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { map, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { FooterComponent } from 'app/components/footer/footer.component';
import { LanguageService } from 'app/services/language.service';
import { AuthorsService, Autor, Rola } from 'app/services/authors.service';
import { AuthorDialogComponent } from './author-dialog.component';

@Component({
  selector: 'app-authors-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslateModule, MatDialogModule, FooterComponent],
  templateUrl: './authors-list.component.html',
  styleUrls: ['./authors-list.component.css']
})
export class AuthorsListComponent implements OnInit, OnDestroy {
  items: Autor[] = [];
  loading = false;
  error: string | null = null;

readonly ROLE_LABELS: Record<Rola, string> = {
  'administratíva': 'office',
  'maliar': 'maliar / maliarka',
  'džbánkár': 'džbánkár / džbánkárka',
  'majster výroby': 'majster / majsterka výroby',
};

roleLabel(r?: string | null): string {
  if (!r) return '';
  return (this.ROLE_LABELS as any)[r] ?? r;
}

  readonly ROLE_ORDER: Rola[] = [
      'administratíva',
      'maliar',
      'džbánkár',
      'majster výroby',
  ];
  grouped: { role: Rola; items: Autor[] }[] = [];
  page = 1;
  pageSize = 112;
  totalPages = 1;
  q = '';

  private destroy$ = new Subject<void>();
  private openedId: string | null = null;

  constructor(
    private authors: AuthorsService,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private lang: LanguageService
  ) {}

  private currentLocale(): string | undefined {
    // prispôsob svojmu LanguageService ak sa volá inak
    return (this.lang as any).current?.() ?? (this.lang as any).currentLang ?? undefined;
  }

  ngOnInit() {
    this.reload();

    // pri zmene jazyka znova načítaj list
    this.lang.langChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.reload());

    // reaguj na ?author=
    this.route.queryParamMap
      .pipe(
        map(qp => qp.get('author')),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe(id => {
        if (!id) {
          this.openedId = null;
          if (this.dialog.openDialogs.length) this.dialog.closeAll();
          return;
        }
        if (this.openedId === id) return;
        this.openedId = id;

        const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches;
        const numId = Number(id);
        const fromList = Number.isFinite(numId) ? this.items.find(x => x.id === numId) : undefined;

        // const isMobile = window.matchMedia('(max-width: 600px)').matches;

        const ref = this.dialog.open(AuthorDialogComponent, {
          data: fromList ? { autor: fromList } : { id: numId },
          panelClass: isMobile ? ['author-dialog', 'author-dialog--mobile'] : ['author-dialog'],
          backdropClass: 'author-dialog-backdrop',
          autoFocus: false,
          restoreFocus: true,
          maxWidth: '100vw',                         // zruší default 80vw limit
          width:    isMobile ? '100vw' : 'min(500px, 92vw)',
          height:   isMobile ? '100dvh' : undefined,
          maxHeight:isMobile ? '100dvh' : '90vh',
          enterAnimationDuration: '200ms',
          exitAnimationDuration: '150ms',
        });

        ref.afterClosed().subscribe(() => {
          this.openedId = null;
          const qp = { ...this.route.snapshot.queryParams };
          if (qp['author']) {
            delete qp['author'];
            this.router.navigate([], { relativeTo: this.route, queryParams: qp });
          }
        });
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openAuthor(a: Autor) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { author: a.id },
      queryParamsHandling: 'merge',
    });
  }

  private cmpPoradieMeno(a: Autor, b: Autor): number {
    const pa = a.poradie ?? Number.POSITIVE_INFINITY;
    const pb = b.poradie ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return (a.meno || '').localeCompare(b.meno || '', 'sk', { sensitivity: 'base' });
  }

  private buildGroups(list: Autor[]) {
    this.grouped = this.ROLE_ORDER.map(role => ({
      role,
      items: list
        .filter(a => a.rola === role)
        .sort(this.cmpPoradieMeno.bind(this)),
    }));
  }

  reload() {
    this.loading = true;
    this.error = null;
    this.authors.list({
      page: 1,
      pageSize: this.pageSize, // 112 alebo viac, aby prišlo všetko
      sort: undefined,         // <— necháme prázdne (triedime na fronte)
      qMeno: this.q?.trim() || undefined,
      locale: this.currentLocale(),
    }).subscribe({
      next: res => {
        this.items = res.items;
        this.buildGroups(this.items);            // <— vytvor skupiny
        const meta = res.meta;
        this.totalPages = meta?.pagination?.pageCount ?? 1;
        this.page = meta?.pagination?.page ?? 1;
      },
      error: err => this.error = err?.message || 'Chyba pri načítaní autorov.',
      complete: () => this.loading = false
    });
  }

  onQueryChange(v: string) {
    this.q = v;
    this.page = 1;
    this.reload();
  }

  next() {
    if (this.page < this.totalPages) {
      this.page++;
      this.reload();
    }
  }

  prev() {
    if (this.page > 1) {
      this.page--;
      this.reload();
    }
  }

  trackById = (_: number, a: Autor) => a.id;
}
