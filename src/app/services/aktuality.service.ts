import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { Aktualita } from 'app/models/aktualita.model';
import { environment } from '../../environments/environment';
import { LanguageService } from './language.service'; // alebo správna cesta
import { BehaviorSubject } from 'rxjs';
interface StrapiResponse<T> {
  data: T[];
  meta: { pagination: unknown };
}

@Injectable({ providedIn: 'root' })
export class AktualityService {
  private readonly api = environment.apiUrl.replace(/\/\/+$/, '');
  private readonly base = `${this.api}/aktuality`;

  constructor(
    private http: HttpClient,
    private lang: LanguageService 
  ) {}

  /** Získa všetky publikované aktuality ako pole */
  getAll(): Observable<Aktualita[]> {
    const params = new HttpParams()
      .set('filters[status][$eq]', 'published')
      .set('locale', this.lang.getCurrentLanguage())
      .set('sort', 'publishedAt:desc')
      .set('populate', '*');

    return this.http
      .get<StrapiResponse<Aktualita>>(this.base, { params })
      .pipe(map(res => res.data));
  }

  /** Získa jednu aktualitu podľa slug */
  getBySlug(slug: string): Observable<Aktualita> {
    const params = new HttpParams()
      .set('filters[slug][$eq]', slug)
      .set('locale', this.lang.getCurrentLanguage())
      .set('populate', '*');

    return this.http
      .get<StrapiResponse<Aktualita>>(this.base, { params })
      .pipe(
        map(res => {
          if (!res.data.length) {
            throw new Error(`Aktualita "${slug}" sa nenašla`);
          }
          return res.data[0];
        })
      );
  }
}
