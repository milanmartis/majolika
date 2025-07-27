import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { FooterComponent } from 'app/components/footer/footer.component';

// Material moduly
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-register',
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
    FooterComponent
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit {
  form!: FormGroup;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient, 
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar, 
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      username: ['', Validators.required],
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  get username() { return this.form.get('username'); }
  get email()    { return this.form.get('email'); }
  get password() { return this.form.get('password'); }
  get passwordMinLength(): number | null {
    return this.password?.errors?.['minlength']?.requiredLength ?? null;
  }
  submit() {
    if (this.form.invalid) return;
  
    this.http.post(
      `${environment.apiUrl}/auth/local/register`,
      {
        username: this.form.value.username,
        email: this.form.value.email,
        password: this.form.value.password
      }
    ).subscribe({
      next: (res: any) => {
        console.log('✅ Registrácia úspešná', res);
  
        // ✅ Ukážeme popup
        this.snack.open(
          'Registrácia úspešná! Skontrolujte si e‑mail a potvrďte účet a budete sa moct prihlasit do aplikácie.',
          'OK',
          { duration: 3000 }
        );
  
        // Presmerovanie na stránku s informáciou
        this.router.navigate(['/registration-success']);
      },
      error: (e: HttpErrorResponse) => {
        console.error('❌ Registrácia zlyhala', e.error);
  
        const backendMessage = e.error?.error?.message || e.error?.message;
        const errMsg =
          backendMessage === 'Email is already taken'
            ? 'Tento e‑mail je už zaregistrovaný.'
            : backendMessage || 'Registrácia zlyhala. Skúste znova.';
  
        // ✅ Ukážeme chybu tiež ako popup
        this.snack.open(errMsg, 'OK', { duration: 4000 });
      }
    });
  }

  resendConfirmation(email: string) {
    this.http.post(`${environment.apiUrl}/auth/send-email-confirmation`, { email })
      .subscribe({
        next: () => alert('Potvrdzovací e‑mail bol znovu odoslaný.'),
        error: () => alert('Nepodarilo sa odoslať e‑mail.')
      });
  }
}
