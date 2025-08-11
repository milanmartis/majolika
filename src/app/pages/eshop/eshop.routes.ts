// src/app/pages/eshop/eshop.routes.ts
import { Routes } from '@angular/router';

export const eshopRoutes: Routes = [
  // 1) /eshop → landing page (žiadna kategória)
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('app/components/landing-page/landing-page.component')
        .then(m => m.LandingPageComponent),
    data: { animation: 'LandingPage' }
  },

  // 2) /eshop/categories/:categorySlug → filtrovaný výpis produktov
  {
    path: 'categories/:categorySlug',
    loadComponent: () =>
      import('./product-list.component')
        .then(m => m.ProductListComponent),
    data: { animation: 'EshopListPage' }
  },

  // 3) /eshop/cart → košík
  {
    path: 'cart',
    loadComponent: () =>
      import('../cart/cart.component')
        .then(m => m.CartComponent),
    data: { animation: 'CartPage' }
  },

  // 4) /eshop/:slug → detail produktu
  {
    path: ':slug',
    loadComponent: () =>
      import('./product-detail.component')
        .then(m => m.ProductDetailComponent),
    data: { animation: 'EshopDetailPage' }
  },
];
