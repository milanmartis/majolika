// import { NgModule } from '@angular/core';
// import { RouterModule, Routes } from '@angular/router';
// import { DashboardComponent } from './dashboard/dashboard.component';

// const routes: Routes = [
//   { path: '', component: DashboardComponent } // ✅ Hlavná stránka zobrazí dashboard
// ];

// @NgModule({
//   imports: [RouterModule.forRoot(routes)],
//   exports: [RouterModule] // ✅ Dôležité pre routovanie!
// })
// export class AppRoutingModule {}


import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { EshopComponent } from './pages/eshop/eshop.component';
import { TradiciaComponent } from './pages/tradicia/tradicia.component';
import { KontaktComponent } from './pages/kontakt/kontakt.component';
import { DielneComponent } from './pages/dielne/dielne.component';
import { GalleryComponent } from './pages/gallery/gallery.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ChartDetailComponent } from './dashboard/chart-detail.component';


export const routes: Routes = [
  { path: '', component: HomeComponent, data: { animation: 'HomePage' } },
  { path: 'eshop', component: EshopComponent, data: { animation: 'EshopPage' } },
  { path: 'tradicia', component: TradiciaComponent, data: { animation: 'TradiciaPage' } },
  { path: 'kontakt', component: KontaktComponent, data: { animation: 'KontaktPage' } },
  { path: 'dielne', component: DielneComponent, data: { animation: 'DielnePage' } },
  { path: 'gallery', component: GalleryComponent, data: { animation: 'GalleryPage' } },
  { path: 'dashboard', component: DashboardComponent, data: { animation: 'DashboardPage' } },
  { path: 'chart-detail', component: ChartDetailComponent, data: { animation: 'ChartDetailPage' } }

];
