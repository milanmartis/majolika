import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Sale {
  customer_id: string;
  customer_name: string;
  product_id: string;
  product_name: string;
  month: number;
  year: number;
  sum_evidence: number;
  weight: number;
  unit_price_evidence: number;
  price_with_tax_counted: number;
  price_without_tax: number;
  tax_counted: number;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private readonly api = environment.apiUrl.replace(/\/\/+$/, '');

  // private apiUrl = 'http://localhost:5000'; // ✅ API URL pre backend

  constructor(private http: HttpClient) {}

  async getSales(startDate?: string, endDate?: string): Promise<Sale[]> {
    try {
      let params = new HttpParams();
      if (startDate) {
        params = params.set('startDate', startDate);
      }
      if (endDate) {
        params = params.set('endDate', endDate);
      }
      const sales = await firstValueFrom(
        this.http.get<Sale[]>(`${this.api}/sales`, { params })
      );
      console.log("✅ Načítané všetky dáta zo servera:", sales);
      return sales;
    } catch (error) {
      console.error("❌ Chyba pri načítaní dát z backendu:", error);
      return [];
    }
  }
}
