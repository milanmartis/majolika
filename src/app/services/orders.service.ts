import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Order {
  id: number;
  createdAt: string;
  status: string;
  paymentStatus: string;
  total: number;
  items: any[];
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getMyOrders() {
    const token = localStorage.getItem('jwt');
    return this.http.get<{ orders: Order[]; totalSpent: number }>(
      `${this.apiUrl}/orders/my`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
  }
}
