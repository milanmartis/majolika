import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FooterComponent } from 'app/components/footer/footer.component';
import { AuthService } from 'app/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    FooterComponent,
    TranslateModule,
    RouterModule,

  ],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  done = false;
  error = '';

  constructor(
    private auth: AuthService, 
    private translate: TranslateService

  ) {}

  submit() {
    if (!this.email) return;
    this.loading = true;
    this.error = '';
    this.auth.forgotPassword(this.email).subscribe({
      next: () => {
        this.done = true;
        this.loading = false;
      },
      error: () => {
        // zámerne neodhaľujeme, či email existuje
        this.done = true;
        this.loading = false;
      },
    });
  }
}
