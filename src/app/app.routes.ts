// src/app/app.routes.ts  (alebo kde máš root routing)
import { Routes } from '@angular/router';
import { HomePageComponent }         from './components/home-page/home-page.component';
import { LandingPageComponent }      from './components/landing-page/landing-page.component';
import { LandingPage2Component }     from './components/landing-page2/landing-page2.component';
import { EshopComponent }            from './pages/eshop/eshop.component';
import { TradiciaComponent }         from './pages/tradicia/tradicia.component';
import { KontaktComponent }          from './pages/kontakt/kontakt.component';
import { DielneComponent }           from './pages/dielne/dielne.component';
import { LoginComponent }            from 'app/auth/login.component';
import { RegisterComponent }         from 'app/auth/register.component';
import { ArticlePageComponent }      from 'app/article-page/article-page.component';
import { eshopRoutes }               from './pages/eshop/eshop.routes';
import { galleryRoutes }             from './pages/gallery/gallery.routes';
import { ConfirmEmailComponent }     from './pages/confirm-email/confirm-email.component';
import { SigninCallbackComponent }     from './signin-callback/signin-callback.component';
import { AktualityListComponent } from './pages/aktualities/aktuality-list.component';
import { AktualitaDetailComponent } from './pages/aktualities/aktualita-detail.component';
import { AuthGuard }          from './guards/auth.guard';          // ⬅ musí existovať
import { AlreadyAuthGuard }   from './guards/already-auth.guard';  // ⬅ nový guard
import { AuthorsListComponent } from './pages/autors/authors-list.component';
import { AuthorDetailComponent } from './pages/autors/author-detail.component';

export const routes: Routes = [
  { path: '',         component: HomePageComponent,    data: { animation: 'LandingPage'  } },
  { path: 'dielne',   component: LandingPage2Component,data: { animation: 'LandingPage2' } },

  { path: 'eshop', component: LandingPageComponent, pathMatch: 'full' },
  // samostatná landing page pre /eshop
  {
    path: 'eshop',
    component: LandingPageComponent,
    pathMatch: 'full',
    data: { animation: 'LandingPage' }
  },

  // zvyšok e‑shopu pod vlastným obalom
  {
    path: 'eshop',
    component: EshopComponent,
    data: { animation: 'EshopPage' },
    children: [
      { path: 'categories/:categorySlug',
        loadComponent: () =>
          import('./pages/eshop/product-list.component')
            .then(m => m.ProductListComponent),
        data: { animation: 'EshopListPage' }
      },
      { path: 'cart',
        loadComponent: () =>
          import('./pages/cart/cart.component')
            .then(m => m.CartComponent),
        data: { animation: 'CartPage' }
      },
      { path: ':slug',
        loadComponent: () =>
          import('./pages/eshop/product-detail.component')
            .then(m => m.ProductDetailComponent),
        data: { animation: 'EshopDetailPage' }
      }
    ]
  },

  { path: 'eshop/categories/:categorySlug/dekor/:dekorSlug', loadComponent: () =>
    import('./pages/eshop/product-list.component')
      .then(m => m.ProductListComponent) },

  { path: 'dekor/:slug', loadComponent: () =>
    import('./pages/eshop/product-list.component')
      .then(m => m.ProductListComponent), },

  { path: 'tradicia', component: TradiciaComponent, data: { animation: 'TradiciaPage' } },
  { path: 'kontakt',  component: KontaktComponent, data: { animation: 'KontaktPage'  } },



  { path: 'o-nas', component: AuthorsListComponent, data: { animation: 'autori' } },
  { path: 'o-nas/:id', component: AuthorDetailComponent, data: { animation: 'autor-detail' } },
  // ... tvoje ostatné trasy
  { path: '', pathMatch: 'full', redirectTo: 'autori' }, // voliteľne
  // --- Login  (neprístupné, ak už som prihlásený) ---
  // { path: 'login',
  //   component: LoginComponent,
  //   canActivate: [AlreadyAuthGuard],
  //   data: { animation: 'LoginPage' }
  // },

{
    path: 'connect/google/redirect',
    loadComponent: () =>
      import('app/auth/google-redirect.component').then(m => m.GoogleRedirectComponent)
  },
  {
    path: 'login',
    canActivate: [AlreadyAuthGuard],

    loadComponent: () =>
      import('app/auth/login.component').then(m => m.LoginComponent)
  },




  { path: 'register', component: RegisterComponent, data: { animation: 'RegisterPage' } },

  // --- Account (chránená lazy‑load trasa) ---
  {
    path: 'account',
    loadChildren: () =>
      import('./account/account.routes').then(m => m.ACCOUNT_ROUTES)
      // ⬆ NIE ďalší canActivate tu! (bude v account.routes)
  },

  // --- Články ---
  { path: 'article/:slug',
    component: ArticlePageComponent,
    data: { animation: 'ArticlePage' }
  },

  {
    path: 'checkout',
    loadChildren: () =>
      import('./checkout/checkout.routes').then(m => m.checkoutRoutes)
  },

  {
    path: 'confirm-email',
    component: ConfirmEmailComponent
  },

  {
    path: 'signin/callback',
    component: SigninCallbackComponent,
  },
  {
    path: 'aktuality',
    component: AktualityListComponent,
    data: { animation: 'AktualityList' }
  },
  {
    path: 'aktuality/:slug',
    component: AktualitaDetailComponent,
    data: { animation: 'AktualitaDetail' }
  },

  // --- Fallback ---
  { path: '**', redirectTo: '' }
];
