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
      // .set('filters[status][$eq]', 'published')
      .set('locale', this.lang.getCurrentLanguage())
      .set('sort', 'publishedAt:desc')
      .set('populate', '*');

    return this.http
      .get<StrapiResponse<Aktualita>>(this.base, { params })
      .pipe(map(res => res.data));
  }

  /**
   * Odľahčený zoznam pre výpis aktualít: len polia potrebné na kartu
   * (title, slug, summary, publishedAt) + featuredImage a categories.
   * Zámerne NEpopuluje content ani gallery – tie sú pre zoznam zbytočné
   * a robili odpoveď zbytočne veľkou.
   */
  getListSlim(): Observable<Aktualita[]> {
    const params = new HttpParams()
      .set('locale', this.lang.getCurrentLanguage())
      .set('sort', 'publishedAt:desc')
      .set('fields[0]', 'title')
      .set('fields[1]', 'slug')
      .set('fields[2]', 'summary')
      .set('fields[3]', 'publishedAt')
      .set('populate[featuredImage]', 'true')
      .set('populate[categories][fields][0]', 'name')
      .set('populate[categories][fields][1]', 'slug')
      .set('pagination[pageSize]', '100');

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
