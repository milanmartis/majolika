import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { EventSessionWithCapacity } from 'app/services/event-sessions.service';

type DialogData = {
  sessions: EventSessionWithCapacity[];
  initialDate?: string; // "YYYY-MM-DD"
  title?: string;       // voliteľné (ak nechceš, používa sa i18n)
};

type CalendarDay = {
  date: Date;            // UTC midnight
  dayOfMonth: number;
  isToday: boolean;
  isInCurrentMonth: boolean;
  isSelectable: boolean; // >= today AND in current month grid
  hasEvents: boolean;
};

@Component({
  standalone: true,
  selector: 'app-session-picker-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule, TranslateModule],
  template: `
  <div class="dlg">
    <!-- HEADER -->
    <div class="hdr">
      <div class="hdr-left">
        <div class="ttl">
          {{ data.title || ('SESSION_PICKER.TITLE' | translate) }}
        </div>
        <div class="sub">
          {{ 'SESSION_PICKER.SUBTITLE' | translate }}
        </div>
      </div>
      <button class="x" type="button" (click)="close()" [attr.aria-label]="'SESSION_PICKER.CLOSE' | translate">×</button>
    </div>

    <!-- BODY -->
    <div class="body">
      <!-- CALENDAR -->
      <div class="cal">
        <div class="monthNav">
          <button class="mBtn" type="button" (click)="prevMonth()" [disabled]="!canGoPrevMonth">←</button>
          <div class="mLabel">{{ monthLabel }}</div>
          <button class="mBtn" type="button" (click)="nextMonth()">→</button>
        </div>

        <div class="weekHdr">
          <div class="w" *ngFor="let w of weekLabels">{{ w }}</div>
        </div>

        <div class="grid">
          <button
            type="button"
            class="cell"
            *ngFor="let d of calendarDays"
            [class.today]="d.isToday"
            [class.has]="d.hasEvents"
            [class.sel]="selectedDateStr && toUTCDateString(d.date) === selectedDateStr"
            [class.outside]="!d.isInCurrentMonth"
            [class.past]="d.isInCurrentMonth && !d.isSelectable"
            [disabled]="!d.isSelectable"
            (click)="selectDay(d)"
          >
            <span class="n">{{ d.dayOfMonth }}</span>
          </button>
        </div>

        <div class="legend">
          <span class="dot has"></span><span>{{ 'SESSION_PICKER.LEGEND_HAS' | translate }}</span>
          <span class="sep"></span>
          <span class="dot none"></span><span>{{ 'SESSION_PICKER.LEGEND_NONE' | translate }}</span>
        </div>
      </div>

      <!-- PANEL -->
      <div class="panel">
        <ng-container *ngIf="selectedDateStr; else pickHint">
          <div class="picked">
            <div class="picked-title">
              {{ 'SESSION_PICKER.SELECTED_DAY' | translate }}:
              <strong>{{ selectedDateStr }}</strong>
            </div>

            <ng-container *ngIf="sessionsForDay.length > 0; else emptyDay">
              <label class="lbl">{{ 'SESSION_PICKER.SESSION' | translate }}</label>

              <select [(ngModel)]="selectedSessionId" class="sel">
                <option [ngValue]="null">{{ 'SESSION_PICKER.SESSION_PLACEHOLDER' | translate }}</option>
                <option *ngFor="let s of sessionsForDay" [ngValue]="s.id">
                  {{ timeOf(s.startDateTime) }}
                  · {{ s.durationMinutes || 60 }} {{ 'SESSION_PICKER.MINUTES' | translate }}
                  · {{ 'SESSION_PICKER.AVAILABLE' | translate }}: {{ s.capacity?.available ?? 0 }}
                </option>
              </select>

              <label class="lbl">{{ 'SESSION_PICKER.QTY' | translate }}</label>
              <div class="qtyrow">
                <button type="button" class="qtybtn" (click)="decQty()" [disabled]="qty <= 1">−</button>
                <input
                  type="number"
                  class="qty"
                  [(ngModel)]="qty"
                  min="1"
                  [max]="maxQty"
                  inputmode="numeric"
                />
                <button type="button" class="qtybtn" (click)="incQty()" [disabled]="qty >= maxQty">+</button>
              </div>

              <div class="meta" *ngIf="selectedSession">
                <div><strong>{{ 'SESSION_PICKER.START' | translate }}:</strong> {{ timeOf(selectedSession.startDateTime) }}</div>
                <div><strong>{{ 'SESSION_PICKER.DURATION' | translate }}:</strong> {{ selectedSession.durationMinutes || 60 }} {{ 'SESSION_PICKER.MINUTES' | translate }}</div>
                <div><strong>{{ 'SESSION_PICKER.AVAILABLE' | translate }}:</strong> {{ selectedSession.capacity?.available ?? 0 }}</div>
              </div>
            </ng-container>

            <ng-template #emptyDay>
              <div class="empty">{{ 'SESSION_PICKER.NO_SESSIONS_DAY' | translate }}</div>
            </ng-template>
          </div>
        </ng-container>

        <ng-template #pickHint>
          <div class="hint">
            {{ 'SESSION_PICKER.HINT' | translate }}
          </div>
        </ng-template>

        <!-- STICKY CTA -->
        <div class="ctaBar">
          <button
            type="button"
            class="cta"
            [disabled]="!canConfirm"
            (click)="confirm()"
          >
            {{ 'SESSION_PICKER.ADD_TO_CART' | translate }}
          </button>
          <div class="ctaHelp" *ngIf="!canConfirm">
            {{ 'SESSION_PICKER.HELP_SELECT' | translate }}
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .dlg{ width:min(980px, 96vw); }
    .hdr{
      display:flex; align-items:flex-start; justify-content:space-between;
      gap:12px; padding:14px 14px; border-bottom:1px solid rgba(0,0,0,.08);
    }
    .hdr-left{ display:flex; flex-direction:column; gap:2px; }
    .ttl{ font-size:16px; font-weight:800; }
    .sub{ font-size:12px; color: rgba(0,0,0,.6); }
    .x{ font-size:22px; background:none; border:0; cursor:pointer; line-height:1; padding:4px 8px; }

    .body{
      display:grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap:12px;
      padding:12px;
    }


    :host {
  display: block;
}

.dlg {
  border-radius: 0 !important;
  overflow: hidden;
}

.hdr,
.body,
.cal,
.panel,
.ctaBar {
  border-radius: 0 !important;
}

    .cal{
      border:1px solid rgba(0,0,0,.08);
      border-radius:0px;
      padding:12px;
      background:#fff;
      min-width:0;
    }

    .monthNav{
      display:flex; align-items:center; justify-content:space-between;
      gap:10px; margin-bottom:10px;
    }
    .mBtn{
      width:40px; height:36px; border-radius:0px;
      border:1px solid rgba(0,0,0,.12); background:#fff;
      cursor:pointer; font-weight:800;
    }
    .mBtn:disabled{ opacity:.45; cursor:not-allowed; }
    .mLabel{ font-weight:900; font-size:14px; }

    .weekHdr{
      display:grid; grid-template-columns: repeat(7, 1fr);
      gap:8px; margin-bottom:8px;
      color: rgba(0,0,0,.55); font-size:12px; font-weight:800;
    }
    .w{ text-align:center; }

    .grid{
      display:grid;
      grid-template-columns: repeat(7, 1fr);
      gap:8px;
    }
    .cell{
    padding:0px;
    margin:0px;

      border:1px solid rgba(0,0,0,.10);
      background:#fff;
      border-radius:0px;
      height:42px;
      cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      position:relative;
    }
    .cell:disabled{
      visibility: hidden;
      pointer-events: none;
    }
    .n{ font-weight:900; font-size:13px; }

    .cell.has{
      border-color: rgba(41,67,186,.35);
      background: rgba(41,67,186,.35);
      color: #2943ba;

      box-shadow: 0 0 0 2px rgba(41,67,186,.12) inset;
    }
    .cell.today{
      outline: 2px solid rgba(0,0,0,.18);
      outline-offset: -2px;
    }
    .cell.sel{
      background: rgba(41,67,186,.12);
      border-color: rgba(41,67,186,.55);
            border-radius:0px;

    }

    .legend{
      display:flex; align-items:center; gap:8px;
      margin-top:10px;
      font-size:12px; color: rgba(0,0,0,.6);
      flex-wrap:wrap;
    }
    .dot{ width:10px; height:10px; border-radius:999px; display:inline-block; }
    .dot.has{ background: rgba(41,67,186,.55); }
    .dot.none{ background: rgba(0,0,0,.15); }
    .sep{ width:10px; }

    .panel{
      border:1px solid rgba(0,0,0,.08);
      border-radius:0px;
      background:#fff;
      padding:12px;
      display:flex;
      flex-direction:column;
      min-width:0;
      position:relative;
    }

    .hint{ color: rgba(0,0,0,.6); font-size:13px; padding:8px; line-height:1.4; }
    .picked-title{ font-size:14px; margin-bottom:10px; }
    .lbl{ display:block; margin:10px 0 6px; font-weight:800; font-size:13px; }

    .sel{
      width:100%; padding:10px; border-radius:0px;
      border:1px solid rgba(0,0,0,.12);
      font-size:14px;
      background:#fff;
    }

    .qtyrow{ display:flex; align-items:center; gap:8px; }
    .qtybtn{
      width:38px; height:38px; border-radius:0px;
      border:1px solid rgba(0,0,0,.12); background:#fff;
      cursor:pointer; font-size:18px; line-height:1;
    }
    .qty{
      flex:1; padding:10px; border-radius:0px;
      border:1px solid rgba(0,0,0,.12);
      font-size:14px; text-align:center;
    }

    .meta{
      margin-top:12px; padding:10px;
      border-radius:0px; background: rgba(0,0,0,.03);
      font-size:13px; display:flex; flex-direction:column; gap:6px;
    }
    .empty{ color: rgba(0,0,0,.6); padding:10px 2px; font-size:13px; }

    .ctaBar{
      margin-top:auto;
      padding-top:12px;
      position: sticky;
      bottom: 0;
      background: linear-gradient(to top, #fff 70%, rgba(255,255,255,0));
      display:flex;
      flex-direction:column;
      gap:6px;
    }
    .cta{
      width:100%;
      padding:12px 14px;
      border-radius:0px;
      border:0;
      cursor:pointer;
      font-weight:900;
      background: rgba(41,67,186,.9);
      color:#fff;
    }
    .cta:disabled{ opacity:.5; cursor:not-allowed; }
    .ctaHelp{ font-size:12px; color: rgba(0,0,0,.55); text-align:center; }

    @media (max-width: 840px){
      .dlg{ width: 96vw; }
      .body{ grid-template-columns: 1fr; }
    }
  `]
})
export class SessionPickerDialogComponent implements OnInit {
  // i18n weekday labels (Mon..Sun)
  weekLabels: string[] = [];

  // calendar state
  currentMonthUTC = this.firstDayOfMonthUTC(new Date());
  calendarDays: CalendarDay[] = [];
  monthLabel = '';

  // selection state
  selectedDateStr: string | null = null;
  selectedSessionId: number | null = null;
  qty = 1;

  // “today” in UTC midnight (to compare safely)
  private todayUTC = this.utcMidnight(new Date());

  constructor(
    public ref: MatDialogRef<SessionPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { sessions: EventSessionWithCapacity[]; initialDate?: string; title?: string },
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // weekday labels from i18n (Mo..Su)
    this.weekLabels = [
      this.translate.instant('SESSION_PICKER.WD_MON'),
      this.translate.instant('SESSION_PICKER.WD_TUE'),
      this.translate.instant('SESSION_PICKER.WD_WED'),
      this.translate.instant('SESSION_PICKER.WD_THU'),
      this.translate.instant('SESSION_PICKER.WD_FRI'),
      this.translate.instant('SESSION_PICKER.WD_SAT'),
      this.translate.instant('SESSION_PICKER.WD_SUN'),
    ];

    // init month from initialDate if provided and >= today, else current month
    if (this.data?.initialDate) {
      const d = new Date(this.data.initialDate + 'T00:00:00Z');
      if (!isNaN(d.getTime()) && this.utcMidnight(d).getTime() >= this.todayUTC.getTime()) {
        this.currentMonthUTC = this.firstDayOfMonthUTC(d);
        this.selectedDateStr = this.toUTCDateString(d);
      }
    }

    this.rebuildCalendar();
  }

  // ========= derived lists =========
  get sessionsForDay(): EventSessionWithCapacity[] {
    if (!this.selectedDateStr) return [];
    return (this.data.sessions || [])
      .filter(s => this.toUTCDateString(s.startDateTime) === this.selectedDateStr)
      .sort((a,b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime());
  }

  get selectedSession(): EventSessionWithCapacity | null {
    if (!this.selectedSessionId) return null;
    return (this.data.sessions || []).find(s => s.id === this.selectedSessionId) ?? null;
  }

  get maxQty(): number {
    const avail = this.selectedSession?.capacity?.available ?? 0;
    return Math.max(1, avail || 1);
  }

  get canConfirm(): boolean {
    const s = this.selectedSession;
    if (!s) return false;
    const avail = s.capacity?.available ?? 0;
    if (avail <= 0) return false;
    return this.qty >= 1 && this.qty <= avail;
  }

  // ========= navigation =========
  get canGoPrevMonth(): boolean {
    // nedovoľ ísť do mesiaca, ktorý je celý v minulosti
    const prev = this.firstDayOfMonthUTC(new Date(Date.UTC(
      this.currentMonthUTC.getUTCFullYear(),
      this.currentMonthUTC.getUTCMonth() - 1,
      1
    )));
    // ak posledný deň prev mesiaca < today => zakáž
    const lastPrev = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 0));
    return this.utcMidnight(lastPrev).getTime() >= this.todayUTC.getTime();
  }

  prevMonth(): void {
    if (!this.canGoPrevMonth) return;
    this.currentMonthUTC = new Date(Date.UTC(
      this.currentMonthUTC.getUTCFullYear(),
      this.currentMonthUTC.getUTCMonth() - 1,
      1
    ));
    this.selectedDateStr = null;
    this.selectedSessionId = null;
    this.qty = 1;
    this.rebuildCalendar();
  }

  nextMonth(): void {
    this.currentMonthUTC = new Date(Date.UTC(
      this.currentMonthUTC.getUTCFullYear(),
      this.currentMonthUTC.getUTCMonth() + 1,
      1
    ));
    this.selectedDateStr = null;
    this.selectedSessionId = null;
    this.qty = 1;
    this.rebuildCalendar();
  }

  // ========= selection =========
  selectDay(d: CalendarDay): void {
    if (!d.isSelectable) return;
    this.selectedDateStr = this.toUTCDateString(d.date);
    this.selectedSessionId = null;
    this.qty = 1;
  }

  incQty() { this.qty = Math.min(this.qty + 1, this.maxQty); }
  decQty() { this.qty = Math.max(1, this.qty - 1); }

  confirm(): void {
    const s = this.selectedSession;
    if (!s) return;
    this.ref.close({ session: s, qty: this.qty, date: this.selectedDateStr });
  }

  close(): void {
    this.ref.close(null);
  }

  // ========= calendar building =========
  private rebuildCalendar(): void {
    this.monthLabel = this.formatMonthLabel(this.currentMonthUTC);

    const first = this.currentMonthUTC; // UTC first day
    const startMonday = new Date(first);
    startMonday.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    startMonday.setUTCHours(0,0,0,0);

    const sessions = this.data.sessions || [];
    const sessionDays = new Set<string>(sessions.map(s => this.toUTCDateString(s.startDateTime)));

    const days: CalendarDay[] = [];

    // 42 buniek ako klasický grid, ALE:
    // - dni pred today => isSelectable=false a v template sa vôbec neukážu (display:none)
    for (let i = 0; i < 42; i++) {
      const d = new Date(startMonday);
      d.setUTCDate(startMonday.getUTCDate() + i);
      d.setUTCHours(0,0,0,0);

      const inMonth = (d.getUTCMonth() === first.getUTCMonth() && d.getUTCFullYear() === first.getUTCFullYear());
      const isToday = d.getTime() === this.todayUTC.getTime();

      const dStr = this.toUTCDateString(d);
      const isPast = d.getTime() < this.todayUTC.getTime();

      days.push({
        date: d,
        dayOfMonth: d.getUTCDate(),
        isToday,
        isInCurrentMonth: inMonth,
        isSelectable: inMonth && !isPast,     // iba dni v mesiaci od dnes
        hasEvents: sessionDays.has(dStr),
      });
    }

    // necháme iba dni, ktoré môžu byť v gride relevantné
    // (mimo mesiaca a neselektovateľné sa aj tak skryjú cez disabled => display:none)
    this.calendarDays = days;
  }

  // ========= utils =========
  private utcMidnight(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(0,0,0,0);
    return x;
  }

  private firstDayOfMonthUTC(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  public toUTCDateString(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
      .toISOString()
      .slice(0, 10);
  }

  timeOf(d: string | Date): string {
    const dt = new Date(d);
    return `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  }

  private formatMonthLabel(d: Date): string {
    // použijeme locale z TranslateService (en/de/sk)
    const lang = (this.translate.currentLang || 'sk').toLowerCase();
    const fmt = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, { month: 'long', year: 'numeric' });
    return fmt.format(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }
}