import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FooterComponent } from 'app/components/footer/footer.component';
import { environment } from '../../environments/environment';

// Angular Material modules
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';


declare global {
  interface Window { google: any }
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
    FooterComponent,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})

export class LoginComponent implements OnInit {
  form!: FormGroup;
  returnUrl = '/';
  errorMessage: string | null = null;
  isSubmitting = false; // 🆕 pridané
  googleAuthUrl = `${environment.apiUrl}/connect/google?redirect_url=' 
    + encodeURIComponent('https://staging.d2y68xwoabt006.amplifyapp.com/signin/callback`;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snack: MatSnackBar 
  ) {}

  // loginWithGoogle(): void {
  //   this.auth.loginWithGoogle();
  // }

  ngOnInit() {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (resp: any) => this.auth.handleGoogleCredential(resp.credential),
    });


    this.form = this.fb.group({
      identifier: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }
  loginWithGoogle() {
    google.accounts.id.prompt();
  }
  // Getters pre template
  get identifierControl() {
    return this.form.get('identifier');
  }

  get passwordControl() {
    return this.form.get('password');
  }

  get passwordMinLength(): number | null {
    return this.passwordControl?.errors?.['minlength']?.requiredLength ?? null;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
  
    const { identifier, password } = this.form.value;
  
    this.auth.login(identifier!, password!).subscribe({
      next: () => {
        // success popup
        this.snack.open('Prihlásenie úspešné!', 'OK', { duration: 5000 });
        this.router.navigateByUrl(this.returnUrl); // ← tu redirect na returnUrl
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Login failed', err);
        this.isSubmitting = false;
  
        const backendMessage = err.error?.error?.message || err.error?.message;
  
        if (backendMessage === 'Your account email is not confirmed') {
          this.snack.open(
            'Musíte najprv potvrdiť e-mail. Skontrolujte si schránku.',
            'OK',
            { duration: 7000 }
          );
        } else if (backendMessage === 'Invalid identifier or password') {
          this.snack.open('Nesprávny e-mail alebo heslo.', 'OK', { duration: 4000 });
        } else {
          this.snack.open('Prihlásenie zlyhalo. Skúste to znova.', 'OK', { duration: 4000 });
        }
  
      }
    });
  }
}
