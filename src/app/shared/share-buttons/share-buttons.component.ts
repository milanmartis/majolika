import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-share-buttons',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './share-buttons.component.html',
  styleUrls: ['./share-buttons.component.css']
})

export class ShareButtonsComponent implements OnInit {
    @Input() title: string = '';
    @Input() url: string = '';
  
    shareLinks: { platform: string, url: string }[] = [];
  
    ngOnInit(): void {
      const encodedUrl = encodeURIComponent(this.url || window.location.href);
      const encodedTitle = encodeURIComponent(this.title);
  
      this.shareLinks = [
        {
            platform: 'facebook',
            url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          },
        //   {
        //     platform: 'instagram',
        //     url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        //   },
          {
            platform: 'whatsapp',
            url: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
          },
      ];
    }
  
    // 🔽 sem vlož túto funkciu
    shareNative() {
      const shareData = {
        title: this.title,
        text: this.title,
        url: this.url || window.location.href
      };
  
      if (navigator.share) {
        navigator.share(shareData).catch(err => {
          console.error('Zdieľanie zlyhalo:', err);
        });
      } else {
        alert('Zdieľanie nie je podporované v tomto prehliadači.');
      }
    }
  }