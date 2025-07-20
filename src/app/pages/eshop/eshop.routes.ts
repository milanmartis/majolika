import { Routes } from '@angular/router';

export const eshopRoutes: Routes = [
  /* ▼ Výpis produktov (root zoznam) ------------------------------ */
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./product-list.component')
        .then(m => m.ProductListComponent),
    data: { animation: 'EshopListPage' }
  },

  /* ▼ Košík ------------------------------------------------------- */
  {
    path: 'cart',
    loadComponent: () =>
      import('../cart/cart.component')
        .then(m => m.CartComponent),
    data: { animation: 'CartPage' }
  },

  /* ▼ Detail produktu (slug) – musí byť za „kosik“ --------------- */
  {
    path: ':slug',
    loadComponent: () =>
      import('./product-detail.component')
        .then(m => m.ProductDetailComponent),
    data: { animation: 'EshopDetailPage' }
  }
];
