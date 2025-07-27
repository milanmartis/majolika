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

import { AuthGuard }          from './guards/auth.guard';          // ⬅ musí existovať
import { AlreadyAuthGuard }   from './guards/already-auth.guard';  // ⬅ nový guard

export const routes: Routes = [
  { path: '',         component: HomePageComponent,    data: { animation: 'LandingPage'  } },
  { path: 'onas',     component: LandingPageComponent, data: { animation: 'LandingPage'  } },
  { path: 'dielne',   component: LandingPage2Component,data: { animation: 'LandingPage2' } },

  // --- Eshop (zachovaný children) ---
  { path: 'eshop',
    component: EshopComponent,
    data: { animation: 'EshopPage' },
    children: eshopRoutes
  },

  { path: 'tradicia', component: TradiciaComponent, data: { animation: 'TradiciaPage' } },
  { path: 'kontakt',  component: KontaktComponent, data: { animation: 'KontaktPage'  } },

  // --- Login  (neprístupné, ak už som prihlásený) ---
  { path: 'login',
    component: LoginComponent,
    canActivate: [AlreadyAuthGuard],
    data: { animation: 'LoginPage' }
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

  // --- Fallback ---
  { path: '**', redirectTo: '' }
];
