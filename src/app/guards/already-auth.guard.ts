import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AlreadyAuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    return this.auth.isAuthenticatedSync()
      ? this.router.createUrlTree(['/account'])  // prihlásený? preskoč /login
      : true;                                    // neprihlásený? dovoľ
  }
}