import { Routes } from '@angular/router';
import { CheckoutComponent } from './checkout.component';
import { CheckoutSuccessComponent } from './checkout-success.component';
import { CheckoutCancelComponent } from './checkout-cancel.component';

export const checkoutRoutes: Routes = [
  { path: '', pathMatch: 'full', component: CheckoutComponent },
  { path: 'paid', component: CheckoutSuccessComponent },
  { path: 'success', component: CheckoutSuccessComponent },
  { path: 'cancelled', component: CheckoutCancelComponent },
];