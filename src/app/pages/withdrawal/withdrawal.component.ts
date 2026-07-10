import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild
} from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

type OrderCheckStatus =
  | 'idle'
  | 'checking'
  | 'valid'
  | 'invalid'
  | 'error';

@Component({
  selector: 'app-withdrawal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule
  ],
  templateUrl: './withdrawal.component.html',
  styleUrls: ['./withdrawal.component.css']
})
export class WithdrawalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('turnstileContainer')
  turnstileContainer?: ElementRef<HTMLDivElement>;

  form = {
    name: '',
    orderNumber: '',
    products: '',
    email: '',
    phone: '',
    gdpr: false
  };

  submitted = false;
  isSubmitting = false;
  errorMessage = '';

  orderCheckStatus: OrderCheckStatus = 'idle';

  turnstileSiteKey = environment.turnstileSiteKey;
  turnstileToken: string | null = null;
  turnstileError = false;

  private readonly isBrowser: boolean;

  private orderCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private orderCheckRequestId = 0;

  private turnstileWidgetId: string | null = null;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private renderAttempts = 0;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) {
      return;
    }

    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.renderTurnstile();
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.orderCheckTimer) {
      clearTimeout(this.orderCheckTimer);
      this.orderCheckTimer = null;
    }

    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }

    this.destroyTurnstile();
  }

  onOrderNumberChange(value: string): void {
    const orderNumber = String(value || '').trim();

    this.errorMessage = '';
    this.orderCheckStatus = 'idle';

    if (this.orderCheckTimer) {
      clearTimeout(this.orderCheckTimer);
      this.orderCheckTimer = null;
    }

    /*
     * Každá zmena čísla objednávky zvýši ID.
     * Odpoveď starej požiadavky sa potom ignoruje.
     */
    const requestId = ++this.orderCheckRequestId;

    if (!orderNumber) {
      return;
    }

    this.orderCheckTimer = setTimeout(() => {
      this.orderCheckTimer = null;
      this.orderCheckStatus = 'checking';

      this.http.post<{ exists: boolean }>(
        `${environment.apiUrl}/withdrawal/check-order`,
        {
          orderNumber
        }
      ).subscribe({
        next: (response) => {
          if (requestId !== this.orderCheckRequestId) {
            return;
          }

          this.orderCheckStatus = response?.exists
            ? 'valid'
            : 'invalid';
        },

        error: (error) => {
          if (requestId !== this.orderCheckRequestId) {
            return;
          }

          console.error('Kontrola objednávky zlyhala:', error);
          this.orderCheckStatus = 'error';
        }
      });
    }, 1200);
  }

  submitForm(): void {
    this.errorMessage = '';

    if (this.orderCheckStatus !== 'valid') {
      this.errorMessage = 'WITHDRAWAL.ORDER_NOT_FOUND';
      return;
    }

    if (!this.form.gdpr) {
      return;
    }

    if (!this.turnstileToken) {
      this.turnstileError = true;
      return;
    }

    this.isSubmitting = true;

    this.http.post<{ ok?: boolean }>(
      `${environment.apiUrl}/withdrawal`,
      {
        ...this.form,
        orderNumber: this.form.orderNumber.trim(),
        turnstileToken: this.turnstileToken
      }
    ).subscribe({
      next: (response) => {
        this.isSubmitting = false;

        if (response?.ok) {
          this.submitted = true;
          return;
        }

        this.errorMessage = 'WITHDRAWAL.ERROR';
        this.resetTurnstile();
      },

      error: (error) => {
        this.isSubmitting = false;

        const code = error?.error?.code;

        if (code === 'ORDER_NOT_FOUND') {
          this.errorMessage = 'WITHDRAWAL.ORDER_NOT_FOUND';
          this.orderCheckStatus = 'invalid';
        } else if (code === 'CAPTCHA_FAILED') {
          this.errorMessage = 'WITHDRAWAL.CAPTCHA_ERROR';
          this.turnstileError = true;
        } else {
          this.errorMessage = 'WITHDRAWAL.ERROR';
        }

        this.resetTurnstile();
      }
    });
  }

  private renderTurnstile(): void {
    if (!this.isBrowser) {
      return;
    }

    const container = this.turnstileContainer?.nativeElement;

    if (!container) {
      this.retryRender();
      return;
    }

    if (!this.turnstileSiteKey) {
      console.error('Chýba Cloudflare Turnstile site key.');
      this.turnstileError = true;
      return;
    }

    if (!window.turnstile?.render) {
      this.retryRender();
      return;
    }

    /*
     * Ak komponent už má platné ID widgetu,
     * nevykresľujeme druhý widget.
     */
    if (this.turnstileWidgetId !== null) {
      return;
    }

    this.renderAttempts = 0;
    this.turnstileToken = null;
    this.turnstileError = false;

    /*
     * Vyčistenie prípadných pozostatkov po Angular hot reloade
     * alebo opätovnom otvorení komponentu.
     */
    container.innerHTML = '';

    try {
      this.turnstileWidgetId = window.turnstile.render(container, {
        sitekey: this.turnstileSiteKey,
        theme: 'auto',

        callback: (token: string) => {
          this.turnstileToken = token;
          this.turnstileError = false;
        },

        'expired-callback': () => {
          this.turnstileToken = null;
        },

        'timeout-callback': () => {
          this.turnstileToken = null;
        },

        'error-callback': (errorCode: string) => {
          console.error('Cloudflare Turnstile chyba:', errorCode);

          this.turnstileToken = null;
          this.turnstileError = true;

          return true;
        }
      });
    } catch (error) {
      console.error('Turnstile sa nepodarilo vykresliť:', error);

      this.turnstileWidgetId = null;
      this.turnstileToken = null;
      this.turnstileError = true;
    }
  }

  private retryRender(): void {
    if (!this.isBrowser) {
      return;
    }

    if (this.renderAttempts >= 30) {
      console.error('Turnstile API sa nepodarilo načítať.');
      this.turnstileError = true;
      return;
    }

    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }

    this.renderAttempts++;

    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.renderTurnstile();
    }, 300);
  }

  private resetTurnstile(): void {
    this.turnstileToken = null;
    this.turnstileError = false;

    if (!this.isBrowser) {
      return;
    }

    if (
      window.turnstile?.reset &&
      this.turnstileWidgetId !== null
    ) {
      try {
        window.turnstile.reset(this.turnstileWidgetId);
        return;
      } catch (error) {
        console.warn(
          'Pôvodný Turnstile widget už neexistuje, vytvorí sa nový:',
          error
        );
      }
    }

    this.destroyTurnstile();

    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.renderTurnstile();
    }, 100);
  }

  private destroyTurnstile(): void {
    if (!this.isBrowser) {
      return;
    }

    if (
      window.turnstile?.remove &&
      this.turnstileWidgetId !== null
    ) {
      try {
        window.turnstile.remove(this.turnstileWidgetId);
      } catch {
        /*
         * Widget už mohol byť odstránený Angularom
         * alebo Cloudflare skriptom.
         */
      }
    }

    this.turnstileWidgetId = null;
    this.turnstileToken = null;

    const container = this.turnstileContainer?.nativeElement;

    if (container) {
      container.innerHTML = '';
    }
  }
}