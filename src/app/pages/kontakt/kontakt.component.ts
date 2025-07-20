import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import {
  latLng,
  tileLayer,
  marker,
  icon,
  MapOptions,
  Layer,
} from 'leaflet';
import { LeafletModule } from '@bluehalo/ngx-leaflet';

@Component({
  selector: 'app-kontakt',
  standalone: true,
  // 📌  Stand‑alone component – importy direktív patria tu:
  imports: [CommonModule, ReactiveFormsModule, LeafletModule],
  templateUrl: './kontakt.component.html',
  styleUrls: ['./kontakt.component.scss'],
})
export class KontaktComponent implements OnInit {
  // --- Leaflet ---
  options!: MapOptions;
  layers: Layer[] = [];

  // --- Formulár ---
  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    // inicializácia formulára (this.fb už existuje)
    this.form = this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10)]],
    });

    // základná OpenStreetMap vrstva
    this.options = {
      layers: [
        tileLayer(
          'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
          {
            maxZoom: 19,
            crossOrigin: true,
            attribution: '© OpenStreetMap prispievatelia',
          }
        )
      ],
      zoom: 14,
      center: latLng(48.1486, 17.1077),
    };

    // vlastná ikona markera (kopírovaná do assets)
    const defaultIcon = icon({
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      iconUrl: 'assets/marker-icon.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41],
    });

    this.layers = [marker([48.1486, 17.1077], { icon: defaultIcon })];
  }

  onSubmit(): void {
    if (this.form.valid) {
      console.log(this.form.value); // TODO: volať backend / email službu
      this.form.reset();
      alert('Ďakujeme za správu!');
    }
  }
}
