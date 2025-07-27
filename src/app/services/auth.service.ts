import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'environments/environment';

export interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
 // address?: {
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
 // };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'jwt';      // kľúč v localStorage
  private apiUrl = environment.apiUrl;

  /** Aktuálny používateľ (BehaviorSubject pre reactive update) */
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // ✅ Ak už máme JWT v localStorage, môžeme načítať profil hneď po štarte
    if (this.isAuthenticatedSync()) {
      this.loadCurrentUser();
    }
  }

  /**
   * ✅ Overí, či je používateľ prihlásený (synchronne, iba podľa JWT)
   */
  isAuthenticatedSync(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * ✅ Načíta profil aktuálne prihláseného používateľa zo Strapi
   */
  loadCurrentUser(): void {
    if (!this.isAuthenticatedSync()) {
      this.currentUserSubject.next(null);
      return;
    }

    this.http.get<User>(`${this.apiUrl}/users/me`).subscribe({
      next: (user) => this.currentUserSubject.next(user),
      error: () => {
        // token je možno neplatný → odhlásime
        this.logout();
      }
    });
  }

  /**
   * ✅ Prihlásenie používateľa
   * - zavolá Strapi `/auth/local`
   * - uloží JWT do localStorage
   * - načíta profil
   */
  login(identifier: string, password: string): Observable<{ jwt: string; user: User }> {
    return this.http.post<{ jwt: string; user: User }>(
      `${this.apiUrl}/auth/local`,
      { identifier, password }
    ).pipe(
      tap((res) => {
        localStorage.setItem(this.TOKEN_KEY, res.jwt);
        this.currentUserSubject.next(res.user);
      })
    );
  }

  /**
   * ✅ Registrácia nového používateľa
   */
  register(username: string, email: string, password: string): Observable<{ jwt: string; user: User }> {
    return this.http.post<{ jwt: string; user: User }>(
      `${this.apiUrl}/auth/local/register`,
      { username, email, password }
    ).pipe(
      tap((res) => {
        localStorage.setItem(this.TOKEN_KEY, res.jwt);
        this.currentUserSubject.next(res.user);
      })
    );
  }

  /**
   * ✅ PATCH na Strapi default endpoint `/users/me`
   * - Aktualizuje profil používateľa (meno, email, adresu...)
   */
  updateProfile(id: number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, data).pipe(
      tap(user => this.currentUserSubject.next(user))
    );
  }

  /**
   * ✅ Odhlásenie – vymaže token aj lokálneho používateľa
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUserSubject.next(null);
  }
}
