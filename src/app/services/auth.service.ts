// src/app/services/auth.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  username: string;
  email: string;
  // pridajte ďalšie polia, ktoré používate
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = environment.apiUrl.replace(/\/\/+$/, '');

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Ak máte v localStorage uložený token a user objekt, môžete tu obnoviť stav:
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  login(creds: { identifier: string; password: string }): Observable<User> {
    return this.http
      .post<{ jwt: string; user: User }>(`${this.apiUrl}/auth/local`, creds)
      .pipe(
        tap(res => {
          localStorage.setItem('jwt', res.jwt);
          localStorage.setItem('currentUser', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }),
        map(res => res.user)
      );
  }

  register(data: { username: string; email: string; password: string }) {
    return this.http
      .post<{ jwt: string; user: User }>(`${this.apiUrl}/auth/local/register`, data)
      .pipe(
        tap(res => {
          localStorage.setItem('jwt', res.jwt);
          localStorage.setItem('currentUser', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }),
        map(res => res.user)
      );
  }

  logout(): void {
    localStorage.removeItem('jwt');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  /** vyžaduje sa asynchrónny Observable<boolean> */
  get isAuthenticated$(): Observable<boolean> {
    return this.currentUser$.pipe(map(user => !!user));
  }

  /** Ak potrebujete synchronne skontrolovať, či je user prihlásený */
  isAuthenticatedSync(): boolean {
    return !!localStorage.getItem('jwt');
  }
}
