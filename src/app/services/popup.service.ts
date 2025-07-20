// popup.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Popup {
  id: number;
  header: string;
  text: any[];         // your Block content
  media: any[];        // media array
  url_link: string | null;
  from: string;        // ISO datetime
  to: string;          // ISO datetime
  visible: boolean;
}

@Injectable({ providedIn: 'root' })
export class PopupService {
  private readonly apiUrl = environment.apiUrl.replace(/\/\/+$/, '');

  constructor(private http: HttpClient) {}

  /**
   * Fetch all Pop Up Windows that are active today,
   * populating all fields so they come back under `attributes`.
   */
  getActivePopups(): Observable<Popup[]> {
    const today = new Date().toISOString();

    const params = new HttpParams()
      .set('filters[from][$lte]', today)
      .set('filters[to][$gte]', today)
      .set('populate', '*');

    return this.http
      .get<{ data: any[] }>(`${this.apiUrl}/pop-up-windows`, { params })
      .pipe(
        map(res =>
          res.data.map(item => {
            // If Strapi v4, data[i] has { id, attributes }; otherwise maybe flat.
            const attrs = item.attributes ?? item;

            return {
              id: item.id ?? attrs.id,
              header:    attrs.header,
              text:      attrs.text,
              media:     attrs.media,
              url_link:  attrs.url_link,
              from:      attrs.from,
              to:        attrs.to,
              visible:   attrs.visible,
            } as Popup;
          })
        )
      );
  }
}
