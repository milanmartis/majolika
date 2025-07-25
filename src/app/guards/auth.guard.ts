import { Injectable } from '@angular/core';
import {
  CanActivate, Router, UrlTree,
  ActivatedRouteSnapshot, RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(
    _: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    return this.auth.isAuthenticatedSync()
      ? true                                         // prihlásený → vpusti
      : this.router.createUrlTree(
          ['/login'],
          { queryParams: { returnUrl: state.url } }
        );
  }
}