import {
    Component,
    ChangeDetectionStrategy,
    OnInit,
  } from '@angular/core';
  import {
    trigger,
    transition,
    style,
    animate,
  } from '@angular/animations';
  import { Observable } from 'rxjs';
  import { Aktualita, SingleMedia } from 'app/models/aktualita.model';
  import { AktualityService } from 'app/services/aktuality.service';
  import { LanguageService } from 'app/services/language.service';
  import { CommonModule } from '@angular/common';
  import { RouterModule } from '@angular/router';
  import { TranslateModule } from '@ngx-translate/core';
  import { FooterComponent } from 'app/components/footer/footer.component';
  import { NbspSmallWordsPipe } from 'app/pipes/nbsp-small-words.pipe';
  import { LinkifyPipe }        from 'app/pipes/linkify.pipe';

  @Component({
    selector: 'app-aktuality-list',
    standalone: true,
    imports: [
      CommonModule,
      RouterModule,
      TranslateModule,
      FooterComponent,
      NbspSmallWordsPipe, 
      LinkifyPipe
    ],
    templateUrl: './aktuality-list.component.html',
    styleUrls: ['./aktuality-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    animations: [
      // tento trigger použijeme na každú kartu
      trigger('fadeSlideIn', [
        transition(':enter', [
          style({ opacity: 0, transform: 'translateY(-20px)' }),
          animate(
            '400ms ease-out',
            style({ opacity: 1, transform: 'translateY(0)' })
          )
        ])
      ])
    ]
  })
  export class AktualityListComponent implements OnInit {
    aktuality$!: Observable<Aktualita[]>;
  
    constructor(
      private aktualityService: AktualityService,
      public lang: LanguageService
    ) {}
  
    ngOnInit() {
      this.aktuality$ = this.aktualityService.getAll();

      // Sleduj zmenu jazyka a znovu načítaj
      this.lang.langChanged$.subscribe(() => {
        this.aktuality$ = this.aktualityService.getAll();
      });
    }
  
    getMediaUrl(media?: SingleMedia): string {
      if (!media) return '';
      if ('data' in media && media.data) {
        return media.data.attributes.url;
      }
      return (media as any).url || '';
    }
  }
  