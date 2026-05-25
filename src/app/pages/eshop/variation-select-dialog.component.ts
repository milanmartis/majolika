// src/app/components/product-list/variation-select-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { ProductsService, Product } from 'app/services/products.service';

type Data = {
  product: Product;              // parent produkt (pre fallback obrázku)
  variations: Product[];         // zoznam variantov
};

@Component({
  selector: 'app-variation-select-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslateModule],
  template: `
    <h2>{{ 'ESHOP.SELECT_VARIATION' | translate }}</h2>

    <div class="variants-grid" role="list">
      <button class="variant-card"
              role="listitem"
              *ngFor="let v of data.variations; trackBy: trackBySlug"
              (click)="choose(v)">
        <img [src]="imageFor(v)"
             [alt]="v.name"
             loading="lazy"
             decoding="async" />
        <div class="meta">
          <div class="name">{{ v.name }}</div>
          <div class="price">
            <ng-container *ngIf="v.inSale && v.price_sale != null; else regular">
              <span class="price-sale">{{ v.price_sale | number:'1.2-2' }} €</span>
              <span class="price-old">{{ v.price | number:'1.2-2' }} €</span>
            </ng-container>
            <ng-template #regular>
              <span class="price-regular">{{ v.price | number:'1.2-2' }} €</span>
            </ng-template>
          </div>
        </div>
      </button>
    </div>

    <div class="actions">
      <button mat-button mat-dialog-close>{{ 'ESHOP.CANCEL' | translate }}</button>
    </div>
  `,
  styles: [`
    :host { display:block; max-width: 760px; }
    h2 { text-align:center; padding:4px; margin: 12px; font-weight: 700;font-family: "alegreya", serif;color: var(--base-blue);}
    .variants-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 2px;
      margin: 2px 0 2px;
    }
    .variant-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 0px solid rgba(0,0,0,.08);
      border-radius: 0px;
      background:transparent;
      padding: 5px;
      text-align: left;
      cursor: pointer;
      transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
    }
    .variant-card:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.08); border-color: rgba(0,0,0,.12); }
    .variant-card img {
      width: 100%;
      aspect-ratio: 1/1;
      object-fit: cover;
      border-radius: 0px;
      background: var(--primary-color);
    }
    .meta .name { font-size: .95rem; font-weight: 600; line-height: 1.2; color: var(--base-blue);}
    .price { display:flex; align-items:center; gap:8px; }
    .price-regular, .price-sale { font-weight: 700; }
    .price-old { color:#777; text-decoration: line-through; }
    .actions { display:flex; justify-content:flex-end; margin-top: 8px; }
  `]
})
export class VariationSelectDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: Data,
    private dialogRef: MatDialogRef<VariationSelectDialogComponent>,
    private products: ProductsService
  ) {}

  trackBySlug = (_: number, v: Product) => v.slug;

  imageFor(v: Product): string {
    // rovnaká logika ako v detaili – preferuj obrázok variantu, inak fallback na parent
    const picObj = (v as any).picture_new ?? (this.data.product as any).picture_new ?? null;
    return this.products.imageUrl(picObj, 'medium') || (this.data.product.primaryImageUrl || '/assets/img/gall/placeholder.jpg');
    // (ak používaš len primaryImageUrl, môžeš vracať to)
  }

  choose(v: Product) {
    this.dialogRef.close(v);
  }
}
