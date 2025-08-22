import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface EventSessionDto {
  id: number;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  type?: 'workshop' | 'tour';
  product?: { id: number; title?: string; slug?: string } | null;
}

@Injectable({ providedIn: 'root' })
export class CalendarLinkService {
  private formatGoogleDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = d.getUTCFullYear();
    const m = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const mm = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    return `${y}${m}${day}T${hh}${mm}${ss}Z`;
  }

  buildGoogleUrl(ev: EventSessionDto): string {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    const dates = `${this.formatGoogleDate(start)}/${this.formatGoogleDate(end)}`;
    const text = encodeURIComponent(ev.title || 'Termín akcie');
    const details = encodeURIComponent(ev.product?.title ? `${ev.title} – ${ev.product.title}` : ev.title);
    const location = encodeURIComponent(ev.product?.title || '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  }

  buildIcsDownloadUrl(sessionId: number): string {
    return `${environment.apiUrl}/api/event-sessions/${sessionId}/ics`;
  }

  buildProductIcsUrl(productId: number): string {
    return `${environment.apiUrl}/products/${productId}/event-sessions.ics`;
  }
}
