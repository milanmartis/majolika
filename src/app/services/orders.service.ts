import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Order {
  id: number;
  createdAt: string;
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  fulfillmentStatus: string;
  total: number;
  totalWithShipping: number;
  items: any[];
  products: any[];
  shippingFee: number;
  paymentFee: number;  
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
