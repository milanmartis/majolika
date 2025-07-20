import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { LinkBlock } from 'app/models/blocks.model';

@Component({
  selector: 'app-link-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p class="art-button">
      <a
        [href]="block.url"
        [attr.target]="block.newTab ? '_blank' : null"
        rel="noopener"
        class="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
      >
       <p>
         {{ block.text }}
       </p>
      </a>
    </p>
  `,
  styleUrls: ['./link-block.component.css']
})
export class LinkBlockComponent {
  @Input() block!: LinkBlock;
}