import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgApexchartsModule } from 'ng-apexcharts'; // ✅ Import ApexCharts
import { ApexAxisChartSeries, ApexChart, ApexXAxis, ApexYAxis, ApexGrid, ApexFill, ApexPlotOptions, ApexTooltip, ApexDataLabels } from 'ng-apexcharts';

@Component({
  selector: 'app-chart-detail',
  standalone: true,
  imports: [NgApexchartsModule], // ✅ Musíš importovať modul!
  templateUrl: './chart-detail.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class ChartDetailComponent implements OnInit {
  title: string = '';
  series: ApexAxisChartSeries = [];
  chartOptions: ApexChart = { type: 'bar', height: 600 };
  xaxis: ApexXAxis = { labels: { style: { fontSize: '12px' } } };
  yaxis: ApexYAxis = { labels: { style: { fontSize: '12px' } } };
  grid: ApexGrid = { show: true };
  fill: ApexFill = { opacity: 1 };
  plotOptions: ApexPlotOptions = { bar: { horizontal: false } };
  tooltip: ApexTooltip = { enabled: true };
  dataLabels: ApexDataLabels = { enabled: true };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.title = params['title'] || 'Neznámy graf';

      // Pokúsime sa dekódovať dáta zo stringu do objektu
      try {
        this.series = JSON.parse(params['series'] || '[]');
      } catch (error) {
        console.error('❌ Chyba pri dekódovaní dát:', error);
      }
    });
  }
}
