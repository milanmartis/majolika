/* ===============================================================
 *  src/app/components/category-menu/category-menu.component.ts
 * =============================================================== */
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-category-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: ``,
  styles: [`
    .cat-menu{display:flex;flex-wrap:wrap;gap:.75rem}
    a{padding:.35rem .8rem;border-radius:4px;border:1px solid #2944ba;
      color:#2944ba;text-decoration:none;transition:.2s}
    a:hover,a.active{background:#2944ba;color:#fff}
  `]
})
export class CategoryMenuComponent   {}
