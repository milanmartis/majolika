import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./account.component').then(m => m.AccountComponent),
    canActivate: [AuthGuard],           // strážené ODTIAĽTO (stačí raz)
  },
];