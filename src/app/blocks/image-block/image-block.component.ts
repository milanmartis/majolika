// src/app/blocks/image-block/image-block.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule }                           from '@angular/common';
import type { ImageBlock }                        from 'app/models/blocks.model';

@Component({
  selector: 'app-image-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="image-wrapper" (click)="click.emit()">
      <img
        [src]="block.mediumUrl"
        alt=""
        class="image-cover cursor-pointer"
      />
    </div>
  `,
  styleUrls: ['./image-block.component.css']
})
export class ImageBlockComponent {
  @Input() block!: ImageBlock;
  @Output() click = new EventEmitter<void>();  // ← emit click do rodiča
}
