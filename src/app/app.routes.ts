import { Routes } from '@angular/router';
import { HomeComponent }    from './pages/home/home.component';
import { EshopComponent }   from './pages/eshop/eshop.component';
import { TradiciaComponent } from './pages/tradicia/tradicia.component';
import { KontaktComponent } from './pages/kontakt/kontakt.component';
import { DielneComponent }  from './pages/dielne/dielne.component';
// import { GalleryComponent } from './pages/gallery/gallery.component';
  import { LandingPageComponent } from './components/landing-page/landing-page.component';
  import { LandingPage2Component } from './components/landing-page2/landing-page2.component';
  import { HomePageComponent } from './components/home-page/home-page.component';
import { DashboardComponent }   from './dashboard/dashboard.component';
import { ChartDetailComponent } from './dashboard/chart-detail.component';
import { galleryRoutes } from './pages/gallery/gallery.routes';
import { eshopRoutes } from './pages/eshop/eshop.routes';
import { LoginComponent }    from 'app/auth/login.component';
import { RegisterComponent } from 'app/auth/register.component';
import { ArticlePageComponent }    from 'app/article-page/article-page.component';

export const routes: Routes = [
  { path: '',         component: HomePageComponent,    data: { animation: 'LandingPage' } },
  { path: 'onas',    component: LandingPageComponent,   data: { animation: 'LandingPage' } },
  { path: 'dielne',    component: LandingPage2Component,   data: { animation: 'LandingPage2' } },
  { path: 'eshop',    component: EshopComponent,   data: { animation: 'EshopPage' },  children: eshopRoutes },
  { path: 'tradicia', component: TradiciaComponent,data: { animation: 'TradiciaPage' } },
  { path: 'kontakt',  component: KontaktComponent, data: { animation: 'KontaktPage'  } },
  { path: 'login',      component: LoginComponent,          data: { animation: 'LoginPage' } },
  { path: 'register',   component: RegisterComponent,       data: { animation: 'RegisterPage' } },
  { path: '',   component: DielneComponent,  data: { animation: 'DielnePage'  } },
  {
    path: 'article/:slug',
    component: ArticlePageComponent,
    data: { animation: 'ArticlePage' }
  },
  { path: '**', redirectTo: '' }                      // všetko neznáme presmeruje na landing

  // { path: 'gallery',  component: GalleryComponent, data: { animation: 'GalleryPage' } },
  // { path: 'dashboard',    component: DashboardComponent, data: { animation: 'DashboardPage'   } },
  // { path: 'chart-detail', component: ChartDetailComponent, data: { animation: 'ChartDetailPage' } }
];
