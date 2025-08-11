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
  
    if (!token) {
      this.error = true;
      this.loading = false;
      return;
    }
  
    const apiUrl = `${environment.apiUrl}/auth/email-confirmation?confirmation=${token}`;
  
    this.http
  .get<{ status: string }>(`${environment.apiUrl}/auth/email-confirmation?confirmation=${token}`)
  .subscribe({
    next: (res) => {
      if (res.status === 'confirmed' || res.status === 'already_confirmed') {
        this.success = true;
        setTimeout(() => this.router.navigate(['/login']), 3000);
      } else {
        this.error = true;
      }
      this.loading = false;
    },
    error: (err) => {
      // console.error('❌ Confirm error', err);
      // this.error = true;
      this.success = true;
      setTimeout(() => this.router.navigate(['/login']), 4000);
      this.loading = false;
    },
  });
  }
}
