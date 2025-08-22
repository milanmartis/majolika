import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthorsService, Autor } from 'app/services/authors.service';

@Component({
  selector: 'app-author-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <section class="container" *ngIf="autor; else loadingTpl">
    <a routerLink="/autori">← späť na zoznam</a>
    <div class="layout">
      <img *ngIf="autor.fotoUrl" [src]="autor.fotoUrl" [alt]="autor.fotoAlt || autor.meno" />
      <div>
        <h1>{{ autor.meno }}</h1>
        <p class="bio" *ngIf="autor.bio">{{ autor.bio }}</p>
      </div>
    </div>
  </section>
  <ng-template #loadingTpl>
    <section class="container"><span>Načítavam…</span></section>
  </ng-template>
  <ng-template #nf>
  <section class="container">
    <p>Autor sa nenašiel.</p>
    <a routerLink="/autori">← späť</a>
  </section>
</ng-template>
  `,
  styles: [`
    .container { max-width: 900px; margin: 0 auto; padding: 1rem; }
    .layout { display: grid; grid-template-columns: 320px 1fr; gap: 1.25rem; align-items: start; }
    img { width: 100%; border-radius: 12px; object-fit: cover; }
    .bio { white-space: pre-wrap; }
    @media (max-width: 800px) {
      .layout { grid-template-columns: 1fr; }
    }
  `]
})
export class AuthorDetailComponent implements OnInit {
  autor: Autor | null = null;

  constructor(private route: ActivatedRoute, private authors: AuthorsService) {}

  ngOnInit(): void {
  const id = Number(this.route.snapshot.paramMap.get('id'));
  if (!Number.isFinite(id)) return;

  this.authors.getById(id).subscribe({
    next: a => this.autor = a,
    error: () => this.autor = null
  });
}
}
