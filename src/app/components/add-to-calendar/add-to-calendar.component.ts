import { Component, Input } from '@angular/core';
import { CalendarLinkService, EventSessionDto } from '../../services/calendar-link.service';

@Component({
  selector: 'app-add-to-calendar',
  templateUrl: './add-to-calendar.component.html',
  styleUrls: ['./add-to-calendar.component.css']
})
export class AddToCalendarComponent {
  @Input() session!: EventSessionDto;

  constructor(private cal: CalendarLinkService) {}

  get googleUrl(): string {
    return this.cal.buildGoogleUrl(this.session);
  }

  get icsUrl(): string {
    return this.cal.buildIcsDownloadUrl(this.session.id);
  }
}
