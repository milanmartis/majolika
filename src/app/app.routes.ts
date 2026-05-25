// src/app/app.routes.ts
import { Routes } from '@angular/router';

import { HomePageComponent } from './components/home-page/home-page.component';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { LandingPage2Component } from './components/landing-page2/landing-page2.component';

import { EshopComponent } from './pages/eshop/eshop.component';
import { TradiciaComponent } from './pages/tradicia/tradicia.component';

import { RegisterComponent } from 'app/auth/register.component';
import { ArticlePageComponent } from 'app/article-page/article-page.component';

import { ConfirmEmailComponent } from './pages/confirm-email/confirm-email.component';
import { SigninCallbackComponent } from './signin-callback/signin-callback.component';

import { AktualityListComponent } from './pages/aktualities/aktuality-list.component';
import { AktualitaDetailComponent } from './pages/aktualities/aktualita-detail.component';

import { AuthorsListComponent } from './pages/autors/authors-list.component';
import { AuthorDetailComponent } from './pages/autors/author-detail.component';

import { AlreadyAuthGuard } from './guards/already-auth.guard';

export const routes: Routes = [
  // --- Home ---
  {
    path: '',
    component: HomePageComponent,
    data: {
      animation: 'LandingPage',
      title: 'Slovenská ľudová majolika – ručne maľovaná keramika',
      description:
        'Oficiálna stránka Slovenskej ľudovej majoliky v Modre. Ručne maľovaná keramika, tradičné vzory, dielňa a e-shop s originálnymi výrobkami.',
    },
  },

  // --- Dielne ---
  {
    path: 'dielne',
    component: LandingPage2Component,
    data: {
      animation: 'LandingPage',
      title: 'Kurzy a dielne – Slovenská ľudová majolika Modra',
      description:
        'Tvorivé dielne a kurzy majoliky v Modre. Vyskúšajte si tvarovanie, maľovanie a glazovanie keramiky.',
    },
  },

  // --- Landing page pre /eshop ---
  {
    path: 'eshop',
    component: LandingPageComponent,
    pathMatch: 'full',
    data: {
      animation: 'LandingPage',
      title: 'E-shop – Slovenská ľudová majolika Modra',
      description:
        'Online predaj ručne maľovanej majoliky z Modry – taniere, misy, hrnčeky, džbány a dekorácie.',
    },
  },

  // --- E-shop aplikácia (produkty / cart / detail) ---
  {
    path: 'produkt',
    component: EshopComponent,
    data: { animation: 'EshopPage' },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/eshop/product-list.component').then(
            (m) => m.ProductListComponent
          ),
        data: { animation: 'ProductListComponent' },
      },
      {
        path: 'kategoria/:categorySlug',
        loadComponent: () =>
          import('./pages/eshop/product-list.component').then(
            (m) => m.ProductListComponent
          ),
        data: { animation: 'ProductListComponent' },
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('./pages/cart/cart.component').then((m) => m.CartComponent),
        data: { animation: 'CartComponent' },
      },
      {
        path: ':slug',
        loadComponent: () =>
          import('./pages/eshop/product-detail.component').then(
            (m) => m.ProductDetailComponent
          ),
        data: { animation: 'ProductDetailComponent' },
      },
    ],
  },

  // Špecifickejšie varianty listu (musia byť NAD všeobecnejšími “:slug” ak sa niekde bijú)
  {
    path: 'produkt/kategoria/:categorySlug/dekor/:dekorSlug',
    loadComponent: () =>
      import('./pages/eshop/product-list.component').then(
        (m) => m.ProductListComponent
      ),
  },
  {
    path: 'dekor/:slug',
    loadComponent: () =>
      import('./pages/eshop/product-list.component').then(
        (m) => m.ProductListComponent
      ),
  },

  // --- Tradícia ---
  // Ak chceš tradicia ako článok, nechaj redirect. Ak chceš samostatnú stránku, zmaž redirect a nechaj component.
  { path: 'tradicia', redirectTo: 'article/historia-majoliky', pathMatch: 'full' },
  // { path: 'tradicia', component: TradiciaComponent, data: { animation: 'TradiciaPage' } },

  // --- O nás ---
  { path: 'o-nas', component: AuthorsListComponent, data: { animation: 'autori' } },
  {
    path: 'o-nas/majolika-modra-okolie',
    redirectTo: 'aktuality',
    pathMatch: 'full',
  },
  { path: 'o-nas/:id', component: AuthorDetailComponent, data: { animation: 'autor-detail' } },

  // --- Kontakty (bez redirectu, ale renderuje ArticlePageComponent) ---
  {
    path: 'kontakty',
    component: ArticlePageComponent,
    data: { slug: 'informacie', animation: 'ArticlePage' },
  },

  // --- Články ---
  {
    path: 'article/:slug',
    component: ArticlePageComponent,
    data: { animation: 'ArticlePage' },
  },

  // --- Auth / login ---
  {
    path: 'connect/google/redirect',
    loadComponent: () =>
      import('app/auth/google-redirect.component').then(
        (m) => m.GoogleRedirectComponent
      ),
  },
  {
    path: 'login',
    canActivate: [AlreadyAuthGuard],
    loadComponent: () =>
      import('app/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () =>
      import('./auth/pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./auth/pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: 'register',
    component: RegisterComponent,
    data: { animation: 'RegisterPage' },
  },

  // --- Account (lazy) ---
  {
    path: 'account',
    loadChildren: () =>
      import('./account/account.routes').then((m) => m.ACCOUNT_ROUTES),
  },

  // --- Checkout (lazy) ---
  {
    path: 'checkout',
    loadChildren: () =>
      import('./checkout/checkout.routes').then((m) => m.checkoutRoutes),
  },

  // --- Email/SSO ---
  { path: 'confirm-email', component: ConfirmEmailComponent },
  { path: 'signin/callback', component: SigninCallbackComponent },

  // --- Aktuality ---
  { path: 'kontakty', redirectTo: '/article/informacie', pathMatch: 'full' }
,
{
    path: 'aktuality',
    component: AktualityListComponent,
    data: { animation: 'AktualityList' },
  },
  {
    path: 'aktuality/:slug',
    component: AktualitaDetailComponent,
    data: { animation: 'AktualitaDetail' },
  },
  // --- Fallback ---
  { path: '**', redirectTo: '' },
];
