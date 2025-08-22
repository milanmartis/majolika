import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AuthorsService, Autor } from 'app/services/authors.service';

type DialogData = { id: number } | { autor: Autor };

@Component({
  selector: 'app-author-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="card">
    <button class="close" (click)="close()" aria-label="Zavrieť">✕</button>

    <ng-container *ngIf="loading; else content">
      <div class="skeleton image"></div>
      <div class="skeleton title"></div>
      <div class="skeleton line"></div>
      <div class="skeleton line"></div>
    </ng-container>

    <ng-template #content>
      <img *ngIf="autor?.fotoUrl" [src]="autor!.fotoUrl!" [alt]="autor!.fotoAlt || autor!.meno"/>
      <div class="body">
        <h2>{{ autor?.meno }}</h2>
        <h6 *ngIf="autor?.pozicia">{{ autor?.pozicia }}</h6>
        <p class="bio" *ngIf="autor?.bio">{{ autor?.bio }}</p>
      </div>
    </ng-template>
  </div>
  `,
  styles: [`
    .card {
      position: relative;
      width: min(720px, 92vw);
      max-height: 90vh;
      overflow-y: auto;
      overflow-x: hidden;                   /* ⬅️ požiadané */
      border-radius: var(--corners, 16px);

      overflow-x: hidden; /* ⬅️ požiadané */
      display: flex;
      flex-direction: column;
      max-width: 100%;
      margin: 0 auto;  
      scrollbar-width: thin;
      scrollbar-color: var(--base-blue) transparent;
    }

 img {
  width: 100%;
  aspect-ratio: 6 / 7;
  object-fit: cover;
  // object-position: top center; /* alebo jednoducho: top; */
  border-top-left-radius: var(--corners, 16px);
  border-top-right-radius: var(--corners, 16px);
  display: block;
}

    .body { padding:20px;  scrollbar-width: thin;
  scrollbar-color: var(--base-blue) transparent; }

    h2 {
      margin: 8px 0 6px;
      font-size: 2.4rem;
      font-weight: 800;
      color: var(--base-blue, #2944ba);
      line-height: 1.1;
      word-break: break-word;
    }

    h6 {
      margin: 0 0 10px;
      font-weight: 700;
      color: #333;
    }

    .bio {
      margin: 0;
      white-space: pre-wrap;
      color: #444;
    }

    .close {
      position: absolute;
      top: 22px; right: 12px;
      border: 0;
      width: 36px; height: 36px;
      border-radius: 50%;
      cursor: pointer;
      color: #fff;
      display: grid;
      place-items: center;
      line-height: 1;
      transition: transform .1s ease, opacity .1s ease;
      opacity: .92;
      z-index: 2;
    }
    .close:hover { transform: scale(1.15); opacity: 1; }

    /* skeleton loading */
    .skeleton {
      margin: 12px 16px;
      border-radius: var(--corners);
      background: transparent;
      background-size: 200% 100%;
      animation: shine 1.1s infinite;

    }
    .skeleton.image { height: 220px; margin: 0; border-top-left-radius: 16px; border-top-right-radius: 16px; }
    .skeleton.title { height: 26px; width: 60%; }
    .skeleton.line { height: 14px; }
    @keyframes shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* Mobile fullscreen – ladnejšie rohy a paddingy */
    @media (max-width: 600px) {
      .card { border-radius: 0; max-height: 100dvh; }
      img { border-radius: 0; }
      .body { padding: 16px;   scrollbar-width: thin;
  scrollbar-color: var(--base-blue) transparent;}
      .close { width: 40px; height: 40px; }
    }
  `]
})
export class AuthorDialogComponent {
  autor: Autor | null = null;
  loading = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private ref: MatDialogRef<AuthorDialogComponent>,
    private authors: AuthorsService
  ) {
    if ('autor' in data) {
      this.autor = data.autor;
      this.loading = false;
    } else {
      this.authors.getById(data.id).subscribe({
        next: a => this.autor = a,
        complete: () => this.loading = false
      });
    }
  }

  close() { this.ref.close(); }
}
