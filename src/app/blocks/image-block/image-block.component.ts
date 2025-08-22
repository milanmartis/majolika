import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ImageBlock } from 'app/models/blocks.model';

@Component({
  selector: 'app-image-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="image-block" (click)="click.emit()">
      <div class="image-wrapper">
        <img
          [src]="block.mediumUrl"
          [alt]="block.caption || ''"
          class="image-cover cursor-pointer"
          loading="lazy"
        />
        <div class="caption" *ngIf="block.caption">{{ block.caption }}</div>
      </div>
    </div>
  `,
  styleUrls: ['./image-block.component.css']
})
export class ImageBlockComponent {
  @Input() block!: ImageBlock;   // má aj columns?: 'one' | 'two' (ale šírku rieši wrapper)
  @Output() click = new EventEmitter<void>();
}
