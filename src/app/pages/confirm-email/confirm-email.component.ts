import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-confirm-email',
  templateUrl: './confirm-email.component.html',
  styleUrls: ['./confirm-email.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
})
export class ConfirmEmailComponent implements OnInit {
  loading = true;
  success = false;
  error = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('confirmation');
    console.log('🔍 Token from URL:', token);

    if (!token) {
      console.error('❌ No token in URL!');
      this.error = true;
      this.loading = false;
      return;
    }

    const apiUrl = `${environment.apiUrl}/auth/email-confirmation?confirmation=${token}`;
    console.log('📡 Calling backend:', apiUrl);

    this.http.get(apiUrl).subscribe({
      next: (res) => {
        console.log('✅ Backend response:', res);
        this.success = true;
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        console.warn('⚠️ Backend returned error:', err);

        const backendMessage = err?.error?.error?.message?.toLowerCase() || '';

        // Ak backend vráti hlášku o tom, že už je potvrdený
        if (
          backendMessage.includes('already confirmed') ||
          backendMessage.includes('already-verified') ||
          backendMessage.includes('already')
        ) {
          console.log('ℹ️ Účet je už potvrdený, zobrazujem success');
          this.success = true;
          setTimeout(() => this.router.navigate(['/login']), 3000);
        } else {
          console.error('❌ Skutočná chyba pri potvrdení tokenu');
          this.error = true;
        }

        this.loading = false;
      }
    });
  }
}
