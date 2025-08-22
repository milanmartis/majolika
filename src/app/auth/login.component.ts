import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FooterComponent } from 'app/components/footer/footer.component';
import { environment } from '../../environments/environment';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// i18n
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// auth
import { AuthService } from 'app/services/auth.service';

declare global {
  interface Window { google: { accounts?: { id?: any } } }
}
declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    // Material
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    // layout
    FooterComponent,
    // i18n
    TranslateModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  form!: FormGroup;
  returnUrl = '/';
  errorMessage: string | null = null;
  isSubmitting = false;

  /** URL na Strapi Google provider s redirectom späť na FE */
  googleAuthUrl!: string;

  constructor(
    private fb: FormBuilder,
    public auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snack: MatSnackBar,
    private translate: TranslateService,
  ) {}

  /** prekladový helper */
  private t(key: string, params?: Record<string, any>) {
    return this.translate.instant(key, params);
  }

  /** mapovanie Strapi chýb → i18n kľúče */
  private mapLoginErrorKey(err: any): string {
    const m = (err?.error?.error?.message || err?.error?.message || '').toString().toLowerCase();
    const code =
      err?.error?.error?.name ||
      err?.error?.error?.code ||
      err?.error?.error?.details?.errors?.[0]?.message ||
      '';

    if (/not confirmed/.test(m) || /confirm/.test(code) || code === 'Auth.form.error.confirmed') {
      return 'AUTH.ERRORS.EMAIL_NOT_CONFIRMED';
    }
    if (/invalid identifier|invalid email|invalid credentials|password/.test(m) ||
        code === 'Auth.form.error.invalid') {
      return 'AUTH.ERRORS.INVALID_CREDENTIALS';
    }
    return 'AUTH.ERRORS.GENERIC';
  }

  async ngOnInit() {
    // zostav Google provider URL (Strapi)
    const api = environment.apiUrl.replace(/\/+$/, '');
    const redirect = (environment as any).oauthRedirectUrl
      ? (environment as any).oauthRedirectUrl
      : `${location.origin}/signin/callback`;
    this.googleAuthUrl = `${api}/connect/google?redirect_url=${encodeURIComponent(redirect)}`;

    // bezpečne inicializuj Google One Tap (ak je skript načítaný a máme client id)
    if (window?.google?.accounts?.id && environment.googleClientId) {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (resp: any) => this.auth.handleGoogleCredential(resp.credential),
      });
      // voliteľne:
      // google.accounts.id.prompt();
    }

    // formulár
    this.form = this.fb.group({
      identifier: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  // Gettery pre template
  get identifierControl() { return this.form.get('identifier'); }
  get passwordControl() { return this.form.get('password'); }
  get passwordMinLength(): number | null {
    return this.passwordControl?.errors?.['minlength']?.requiredLength ?? null;
  }

  onSubmit() {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;

    const { identifier, password } = this.form.value;

    this.auth.login(identifier!, password!).subscribe({
      next: () => {
        this.snack.open(this.t('AUTH.LOGIN.SUCCESS'), this.t('COMMON.OK'), { duration: 5000 });
        this.router.navigateByUrl(this.returnUrl || '/');
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Login failed', err);
        this.isSubmitting = false;

        const key = this.mapLoginErrorKey(err);

        // špeciálny prípad – ponúkni re-send confirm
        if (key === 'AUTH.ERRORS.EMAIL_NOT_CONFIRMED') {
          const ref = this.snack.open(this.t(key), this.t('AUTH.REGISTER.RESEND_CONFIRM'), { duration: 7000 });
          ref.onAction().subscribe(() => {
            const email = this.form.get('identifier')?.value;
            if (email && /@/.test(email)) {
              this.auth.resendConfirmation(email).subscribe(() => {
                this.snack.open(this.t('AUTH.REGISTER.CONFIRM_SENT'), this.t('COMMON.OK'), { duration: 4000 });
              });
            }
          });
        } else {
          this.snack.open(this.t(key), this.t('COMMON.OK'), { duration: 4000 });
        }
      }
    });
  }
}
