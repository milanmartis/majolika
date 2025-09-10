import { Component, ViewChild, input, output, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsModule, GoogleMap, MapInfoWindow } from '@angular/google-maps';

export type LatLng = google.maps.LatLngLiteral;

export interface MapAdvancedMarkerData {
  id: string;
  title?: string;
  position: LatLng;
  /** Optional adresa pre tooltip/okno */
  address?: string;
  /** Advanced Marker options (nie MarkerOptions – tie sú deprecated) */
  options?: google.maps.marker.AdvancedMarkerElementOptions;
  /** Voliteľný vlastný DOM obsah pinu (napr. PinElement.element) */
  content?: Node | null;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  template: `
    <google-map
      #mapRef
      height="500px"
      width="100%"
      [center]="center()"
      [zoom]="zoom()"
      [options]="combinedOptions()"
      (mapClick)="onMapClick($event)">

      <map-advanced-marker
        *ngFor="let m of renderedMarkers()"
        [position]="m.position"
        [options]="m.options || { gmpClickable: true }"
        [content]="m.content ?? null"
        (mapClick)="onMarkerClick(m)">
      </map-advanced-marker>

      <map-info-window>
        <div class="info">
          <strong>{{ selected()?.title }}</strong>
          <div *ngIf="selected()?.address as addr">{{ addr }}</div>
          <a
            *ngIf="selected() as s"
            [href]="directionsUrl(s)"
            target="_blank"
            rel="noopener"
          >Trasa → Google Mapy</a>
        </div>
      </map-info-window>
    </google-map>
  `,
  styles: [`
    :host, google-map { display:block; }
    google-map { border-radius:12px; overflow:hidden; }
    .info { min-width: 220px; display:flex; flex-direction:column; gap:6px; }
    .info a { text-decoration: none; }
  `]
})
export class MapComponent {
  @ViewChild(GoogleMap) mapCmp?: GoogleMap;
  @ViewChild(MapInfoWindow) infoWin!: MapInfoWindow;

  /** ⚠️ Skutočné Map ID z Map Styles (NIE API key) */
  mapId = 'YOUR_MAP_ID';

  // ===== Inputs =====//48.32658564073878, 17.31621165579666
  center = input<LatLng>({ lat: 48.32658564073878, lng: 17.31621165579666 });
  /** Úvodný zoom (napr. 12), pri kliku pôjdeme na 19 */
  zoom = input<number>(12);
  mapOptions = input<google.maps.MapOptions>({
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative',
  });

  /** Spojené options pre mapu (spread robíme v TS, nie v šablóne) */
  combinedOptions = computed<google.maps.MapOptions>(() => ({
    ...this.mapOptions(),
    mapId: this.mapId,
  }));

  markers = input<MapAdvancedMarkerData[]>([
    {
      id: 'majolika',
      title: 'Majolika',
      position: { lat: 48.32658564073878, lng: 17.31621165579666 },
      address: 'Dolná 138, 900 01 Modra', // ← uprav podľa reality
      options: { gmpClickable: true, title: 'Majolika' },
      content: null
    }
  ]);

  /** Automaticky doplní MODRÝ a VÄČŠÍ PinElement (#081a69, scale 1.8), ak marker nemá content */
  renderedMarkers = computed<MapAdvancedMarkerData[]>(() =>
    this.markers().map(m => ({
      ...m,
      content: m.content ?? this.makePin({
        background: '#081a69',
        borderColor: '#06134f',
        glyphColor: '#ffffff',
        scale: 1.8,
        title: m.title ?? ''
      })
    }))
  );

  // ===== Outputs =====
  mapClicked = output<LatLng>();
  markerClicked = output<MapAdvancedMarkerData>();

  // ===== Interný stav =====
  selected = signal<MapAdvancedMarkerData | null>(null);

  constructor() {
    // Autofit (ak máš aspoň 2 markery)
    effect(() => {
      const arr = this.markers();
      queueMicrotask(() => this.autoFit(arr));
    });
  }

  // ===== API =====
  public fitToMarkers(): void {
    const map = this.mapCmp?.googleMap;
    const arr = this.markers();
    if (!map || !arr || arr.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    arr.forEach(m => bounds.extend(m.position));
    if (arr.length === 1) {
      map.setCenter(arr[0].position);
      map.setZoom(Math.max(this.zoom() ?? 12, 14));
    } else {
      map.fitBounds(bounds);
    }
  }

  // ===== Handlery =====
  onMarkerClick(m: MapAdvancedMarkerData) {
    this.selected.set(m);
    this.infoWin.open();          // otvor InfoWindow
    this.markerClicked.emit(m);

    // vycentruj a priblíž
    const gmap = this.mapCmp?.googleMap;
    if (gmap) {
      gmap.panTo(m.position);
      gmap.setZoom(19);
    }
  }

  onMapClick(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    this.mapClicked.emit(e.latLng.toJSON());
  }

  // ===== Helpers =====
  private autoFit(arr: MapAdvancedMarkerData[]) {
    if (!this.mapCmp?.googleMap || !arr || arr.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    arr.forEach(m => bounds.extend(m.position));
    this.mapCmp.googleMap!.fitBounds(bounds);
  }

  /** Directions URL do Google Máp — otvorí trasu k markeru */
  directionsUrl(m: MapAdvancedMarkerData): string {
    const { lat, lng } = m.position;
    // ak chceš pešiu trasu: travelmode=walking
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }

  /** Advanced Marker PinElement – MODRÝ (#081a69), škálovateľný */
  public makePin(options?: {
    background?: string;
    borderColor?: string;
    glyphColor?: string;
    glyph?: string | Element | URL | null;
    scale?: number;
    title?: string;
  }): HTMLElement {
    const { PinElement } = google.maps.marker;
    const pin = new PinElement({
      background: options?.background ?? '#081a69',
      borderColor: options?.borderColor ?? '#06134f',
      glyphColor: options?.glyphColor ?? '#ffffff',
      glyph: options?.glyph ?? undefined, // string | Element | URL | null | undefined
      scale: options?.scale ?? 1.8        // väčší marker default
    });
    if (options?.title) pin.element.setAttribute('title', options.title);
    return pin.element; // HTMLElement, vhodný pre [content]
  }
}
