import { Routes } from '@angular/router';
import { CheckoutComponent } from './checkout.component';
import { CheckoutSuccessComponent } from './checkout-success.component';
import { CheckoutCancelComponent } from './checkout-cancel.component';

export const checkoutRoutes: Routes = [
  { path: '', component: CheckoutComponent },
  { path: 'success', component: CheckoutSuccessComponent },
  { path: 'cancel', component: CheckoutCancelComponent }
];