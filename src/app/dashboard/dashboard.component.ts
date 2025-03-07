import { Component, OnInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Pridajte FormsModule
import { NgApexchartsModule } from 'ng-apexcharts';
import { DatabaseService, Sale } from '../services/database.service';
import { ChartDataMap } from './chart-data-map'; // Importujeme rozhranie
import { RouterModule } from '@angular/router'; // ✅ Import RouterModule


import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexGrid,
  ApexFill,
  ApexPlotOptions,
  ApexDataLabels,
  ApexStroke,
  ApexMarkers,
  ApexTooltip,
  ChartType
} from 'ng-apexcharts';



@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule, NgApexchartsModule, FormsModule], // FormsModule je pridaný sem
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  isLoadingFilter: boolean = false;
  darkMode: boolean = false;
  sales: Sale[] = [];
  allSales: Sale[] = [];  // Nová premenná, kde uložíme všetky dáta raz

    // --- Premenné pre filtrovanie podľa dátumu ---
  // Dostupné roky a mesiacové možnosti získané z datasetu
  availableYears: number[] = [];
  availableMonthsByYear: { [year: number]: string[] } = {};

  // Pre "od" a "do" hodnoty
  isFullScreen = false;

  selectedMonth_start: string;
  selectedYear_start: string;
  selectedMonth_end: string;
  selectedYear_end: string;

  topProducts: ApexAxisChartSeries = [];
  topProducts_all: ApexAxisChartSeries = [];
  productList: { x: string; y: number }[] = [];
  productList_all: { x: string; y: number }[] = [];
  selectedProduct: string = '';
  selectedProduct2: string = '';
  productSalesByMonth: ApexAxisChartSeries = [];
  productSalesByMonth2: ApexAxisChartSeries = [];
  totalRevenueByMonth: ApexAxisChartSeries = [];
  topCustomers: ApexAxisChartSeries = [];
  topCustomers_pj: ApexAxisChartSeries = [];
  pieChartOptions: any;
  pieChartSeries: number[] = [];
  newCustomersCount: number = 0;
  percentageChange: number = 0;
  newCustomersSeries: ApexAxisChartSeries = [];
  smallChartOptions: ApexChart = {
    type: 'line' as ChartType,
    sparkline: { enabled: true }
  };
  smallChartXAxis: ApexXAxis = {
    type: 'category', // Toto je správne pre xaxis
    categories: this.computeMonthCategories() // Dynamicky generované kategórie
  };
  computeMonthCategories(): string[] {
    const monthsSet = new Set<string>();
    // Predpokladáme, že allSales obsahuje všetky dáta s atribútmi year a month
    this.allSales.forEach(sale => {
      const monthKey = `${sale.year}-${String(sale.month).padStart(2, '0')}`;
      monthsSet.add(monthKey);
    });
    const categories = Array.from(monthsSet);
    categories.sort(); // Zoradí podľa abecedy, čo pre formát YYYY-MM zodpovedá chronologickému poradiu
    return categories;
  }
  public chartData: ChartDataMap;
 searchTerm: string = '';
  filteredProductList: { x: string; y: number }[] = [];

  filterProductList() {
    const searchLower = this.searchTerm.toLowerCase().trim();
    
    this.filteredProductList = this.productList_all.filter(product =>
      product.x.toLowerCase().includes(searchLower)
    );
  }
  
  selectedCustomer: string = 'ALL'; // 🏷 Predvolená hodnota = všetci zákazníci
  customersList: string[] = []; // 📋 Zoznam zákazníkov pre dropdown
  totalRevenueSum: number = 0; // 🏷 Uchováva celkový súčet obratu
  totalRevenuePrevious: number = 0; // 📊 Celkový obrat za predchádzajúce obdobie
  percentageChangeRevenue: number = 0; // 📊 Percentuálna zmena
  
  // startDate: string; 
  // endDate: string;   
  
  
  loading = true;
  selectedMetric: "EUR" | "KG" = "EUR"; // Predvolená hodnota

  toggleMetric() {
    this.selectedMetric = this.selectedMetric === "EUR" ? "KG" : "EUR";
  
    this.calculateTopCustomers(); // Aktualizácia top zákazníkov
    this.calculateTopCustomers_pj(); // Aktualizácia top predajní
    this.processData(); // Aktualizácia top produktov
    this.processData_products_all(); // Aktualizácia top produktov
    this.calculateTotalRevenueByMonth(); // Aktualizácia celkového obratu
    this.updateProductSalesByMonth(this.selectedProduct); // Aktualizácia predajov produktu 1
    this.updateProductSalesByMonth2(this.selectedProduct2); // Aktualizácia predajov produktu 2
    this.updateYAxisAndTooltip(); // Aktualizácia tooltipov a osí
  
    console.log(`🔄 Metrika prepnutá na ${this.selectedMetric}`);
  }
  

  chartOptions!: ApexChart;
  barChartOptions!: ApexChart;
  tooltip!: ApexTooltip;
  xaxis!: ApexXAxis;
  yaxis!: ApexYAxis;
  fill!: ApexFill;
  grid!: ApexGrid;
  dataLabels!: ApexDataLabels;
  dataLabels2!: ApexDataLabels;
  stroke!: ApexStroke;
  markers!: ApexMarkers;

  
  plotOptions: ApexPlotOptions = {
    bar: {
      horizontal: true, // Zvislé stĺpce
      columnWidth: '40%',
      borderRadius: 3,
      dataLabels: {
        position: 'right', // Umiestni hodnoty nad stĺpec
        orientation: 'horizontal' // Otočenie textu o 90°
      }
    }
  };

  plotOptions2: ApexPlotOptions = {
    bar: {
      horizontal: false, // Vertikálne stĺpce
      columnWidth: '40%', // Šírka stĺpcov
      borderRadius: 3, // Zaoblené hrany
      dataLabels: {
        position: 'top', // Umiestni hodnoty nad stĺpec
        orientation: 'vertical' // Otočenie textu o 90°
      }
    }
  };

  // Formátovanie hodnôt na osiach X a Y (tisícky s medzerou, €)
  valueFormatter = (value: number): string => {
    return value >= 10000
      ? (Math.round(value / 1000) * 1000).toLocaleString('sk-SK').replace(',', ' ') + 'tis. €'
      : value.toLocaleString('sk-SK').replace(',', ' ') + ' €';
  };


  updateChartOptions() {
    const textColor = this.darkMode ? '#ffffffB3' : '#000000B3';
    // Graf pre čiarový graf (tenká čiara, tmavý tooltip, biele písmo)
    this.chartOptions = {
      type: 'line' as ChartType,
      height: 600,
      toolbar: { show: true },
      zoom: { enabled: false }
    };



    // 📊 Graf pre stĺpcové grafy
    this.barChartOptions = {
      type: 'bar' as ChartType,
      height: 600,
      toolbar: { show: true },
      zoom: { enabled: false }
    };

    this.xaxis = {
      labels: {
        style: {
          colors: textColor, 
          fontSize: '12px'
        }
      }
    };

    this.yaxis = {
      labels: {
        style: {
          colors: textColor, 
          fontSize: '12px'
        },
        formatter: this.valueFormatter
      }
    };

    this.fill = {
      colors: ['rgba(74, 86, 218, 0.9)'],
      opacity: 0.9
    };

    this.dataLabels = {
      enabled: true,
      style: {
        colors: [this.darkMode ? '#ffffffB3' : '#ffffffB3'], // Dynamická farba podľa módu
        fontSize: '12px',
      },
      offsetY: 0, // Necháme na strede
      offsetX: 15, // Posun textu doľava (prispôsob podľa šírky stĺpca)
      textAnchor: 'end', // Zarovná text na začiatok
      dropShadow: {
        enabled: false, // Vypne tieňovanie, ak by rušilo čitateľnosť
      },
      formatter: (value: number): string => {
        return value >= 1000
          ? Math.round(value).toLocaleString('sk-SK').replace(',', ' ') + '     '
          : value.toLocaleString('sk-SK').replace(',', '.')+ '      ';
      }
    };

    this.grid = {
      show: true, // Zobrazí mriežku
      borderColor: this.darkMode ? '#2b2474' : '#ccc', // Hlavná farba mriežky (okraj)
      strokeDashArray: 3, // Dĺžka prerušovanej čiary
      xaxis: {
        lines: {
          show: true, // Povolenie vertikálnych čiar
        }
      },
      yaxis: {
        lines: {
          show: true, // Povolenie horizontálnych čiar
        }
      }
    };

    this.dataLabels2 = {
      enabled: true,
      style: {
        colors: [this.darkMode ? '#ffffffB3' : '#ffffffB3'],
        fontSize: '11px'
      },
      offsetY: -55, // Posun nad stĺpec (kladná hodnota posúva smerom hore)
      offsetX: 0,
      formatter: (value: number): string => {
        return value >= 1000
          ? Math.round(value).toLocaleString('sk-SK').replace(',', ' ') + ' '
          : value.toLocaleString('sk-SK').replace(',', '.');
      }
    };

    this.tooltip = {
      theme: this.darkMode ? 'dark' : 'light',
      style: {
        fontSize: '13px'
      },
      y: {
        formatter: (value: number): string => {
          return value.toLocaleString('sk-SK');
        }
      }
    };

    this.markers = {
      size: 3, // Veľkosť bodov na čiare
      strokeWidth: 1, // Okraj bodu
      fillOpacity: 0.5, // Priehľadnosť bodov
    };

    this.stroke = {
      width: 2.52, // 🔵 Tenká čiara v čiarovom grafe
      curve: 'smooth', // 📐 Hladký priebeh
      colors: ['rgba(74, 86, 218, 0.9)'] 
    };
  }

  constructor(
    private db: DatabaseService,
    private renderer: Renderer2
  )  {
    // Predvolená inicializácia z localStorage alebo sa neskôr nastaví po načítaní datasetu
    // V tomto konštruktore ešte nepoznáme dostupné roky, preto použijeme placeholder
    this.selectedMonth_start = localStorage.getItem('selectedMonth_start') || '';
    this.selectedYear_start = localStorage.getItem('selectedYear_start') || '';
    this.selectedMonth_end = localStorage.getItem('selectedMonth_end') || '';
    this.selectedYear_end = localStorage.getItem('selectedYear_end') || '';

    this.chartData = {
      topProducts: this.topProducts,
      topCustomers: this.topCustomers,
      topCustomers_pj: this.topCustomers_pj,
      totalRevenueByMonth: this.totalRevenueByMonth,
      productSalesByMonth: this.productSalesByMonth,
      productSalesByMonth2: this.productSalesByMonth2
    };
  }

  async ngOnInit() {
    this.loading = true;
    this.loadTheme();


    this.yaxis = {
      labels: {
        style: {
          fontSize: '18px', // 👈 Tu nastavíš veľkosť písma (zväčšené)
          colors: this.darkMode ? "#ffffffB3" : "#000000B3"
        },
        formatter: (value: number): string => {
          return value >= 1000
            ? Math.round(value).toLocaleString("sk-SK").replace(",", " ") + ` ${this.selectedMetric === "EUR" ? "€" : "kg"}`
            : value.toLocaleString("sk-SK").replace(",", ".") + ` ${this.selectedMetric === "EUR" ? "€" : "kg"}`;
        }
      }
    };
    try {
      // Voláme getSales s definovaným časovým úsekom (startDate a endDate)
      this.sales = await this.db.getSales(); 
      // Uložíme ich do allSales pre neskoršie filtrovanie
      this.allSales = this.sales;
      this.loading = false;

      this.populateDateOptions();
      this.filteredProductList = [...this.productList_all]; // ✅ Na začiatku zobrazí všetky produkty
      this.populateCustomersList(); // ✅ Naplníme zoznam zákazníkov


      // Ak v localStorage ešte neboli nastavené hodnoty, nastavte default na základe datasetu
      if (!this.selectedYear_start || !this.selectedMonth_start) {
        // Pre "od" zvolíme najmenší dostupný dátum
        this.selectedYear_start = Math.min(...this.availableYears).toString();
        this.selectedMonth_start = this.availableMonthsByYear[parseInt(this.selectedYear_start)][0];
      }
      if (!this.selectedYear_end || !this.selectedMonth_end) {
        // Pre "do" zvolíme najväčší dostupný dátum
        this.selectedYear_end = Math.max(...this.availableYears).toString();
        const monthsForMaxYear = this.availableMonthsByYear[parseInt(this.selectedYear_end)];
        this.selectedMonth_end = monthsForMaxYear[monthsForMaxYear.length - 1];
      }

      // Uložte do localStorage
      localStorage.setItem('selectedMonth_start', this.selectedMonth_start);
      localStorage.setItem('selectedYear_start', this.selectedYear_start);
      localStorage.setItem('selectedMonth_end', this.selectedMonth_end);
      localStorage.setItem('selectedYear_end', this.selectedYear_end);

      // Aktualizujte grafy s pôvodnými dátami
      if (this.sales.length > 0) {
        this.processData();
        this.processData_products_all();
        this.selectTopProduct();
        this.calculateTotalRevenueByMonth();
        this.calculateTopCustomers();
        this.calculateTopCustomers_pj();
        this.updatePieChart();
        this.calculateNewCustomers(); // Aktualizácia karty "Novi zákazníci"

      } else {
        console.error('❌ Žiadne dáta neboli načítané!');
      }


      this.chartData = {
        topProducts: this.topProducts,
        topCustomers: this.topCustomers,
        topCustomers_pj: this.topCustomers_pj,
        totalRevenueByMonth: this.totalRevenueByMonth,
        productSalesByMonth: this.productSalesByMonth,
        productSalesByMonth2: this.productSalesByMonth2
      };


    } catch (error) {
      console.error('❌ Chyba pri načítaní predajov:', error);
      this.loading = false;
    }
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('darkMode', String(this.darkMode));
    
    this.applyTheme();
    this.updateChartOptions(); // ✅ Zmena farieb pre grafy
  }

  loadTheme() {
    const storedTheme = localStorage.getItem('darkMode');
    this.darkMode = storedTheme === 'true';
    this.applyTheme();
    this.updateChartOptions();
  }

  applyTheme() {
    if (this.darkMode) {
      this.renderer.addClass(document.body, 'dark-mode');
      this.renderer.removeClass(document.body, 'light-mode');
    } else {
      this.renderer.addClass(document.body, 'light-mode');
      this.renderer.removeClass(document.body, 'dark-mode');
    }
  }

  processData() {
    const productSalesMap: { [key: string]: number } = {};
  
    this.sales.forEach(sale => {
      const value = this.selectedMetric === "EUR" ? sale.tax_counted : sale.weight;
      productSalesMap[sale.product_name] = (productSalesMap[sale.product_name] || 0) + value;
    });
  
    this.productList = Object.entries(productSalesMap)
      .map(([name, value]) => ({ x: name, y: value }))
      .sort((a, b) => b.y - a.y)
      .slice(0, 20);
  
    this.topProducts = [
      {
        name: 'Top produkty',
        data: this.productList
      }
    ];
  
    console.log("✅ Spracované top produkty:", this.productList);
  }

  processData_products_all() {
    const productSalesMap_all: { [key: string]: number } = {};
  
    this.sales.forEach(sale => {
      const value = this.selectedMetric === "EUR" ? sale.tax_counted : sale.weight;
      productSalesMap_all[sale.product_name] = (productSalesMap_all[sale.product_name] || 0) + value;
    });
  
    this.productList_all = Object.entries(productSalesMap_all)
      .map(([name, value]) => ({ x: name, y: value }))
      .sort((a, b) => b.y - a.y)
      .slice(0, 300);
  
    this.topProducts_all = [
      {
        name: 'Top produkty',
        data: this.productList_all
      }
    ];
  
    console.log("✅ Spracované top produkty:", this.productList_all);
  }
  
  updatePieChart() {
    const categoryCounts: { [key: string]: number } = {};
    
    // Predpokladáme, že sale.product_id je číslo alebo reťazec
    this.sales.forEach(sale => {
      const productIdStr = sale.product_id.toString();
      const category = productIdStr.charAt(0); // Získame prvý znak
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    // Nakonfigurujeme donut (prstencový) graf
    this.pieChartOptions = {
      chart: {
        type: 'donut',
        height: 460
      },
      colors: [
        'rgba(74, 86, 218, 0.9)',
        'rgba(94, 106, 238, 0.9)',
        'rgba(114, 126, 255, 0.9)',
        'rgba(54, 66, 198, 0.9)',
        'rgba(34, 46, 178, 0.9)'
      ],
      stroke: {
        show: false,
        width: 0,
        colors: ['transparent']
      },
      labels: Object.keys(categoryCounts),
      legend: {
        show: true,
        position: 'bottom',
        labels: {
          colors: this.darkMode ? '#ffffffB3' : '#000000B3' // Nastavenie farby textu legendy
        }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%'
          }
        }
      },
      tooltip: this.tooltip
    };
    
    
    this.pieChartSeries = Object.values(categoryCounts);
  }

  selectTopProduct() {
    if (this.topProducts.length > 0 && this.topProducts[0]?.data?.length > 0) {
      this.selectedProduct = String((this.topProducts[0]?.data[0] as any)?.x || '');
      this.selectedProduct2 = String((this.topProducts[0]?.data[1] as any)?.x || '');
      this.updateProductSalesByMonth(this.selectedProduct);
      this.updateProductSalesByMonth2(this.selectedProduct2);
    }
  }

  onSelectProduct(event: any) {
    const productName = event?.target?.value;
    console.log("🔵 Vybraný produkt:", productName);
    
    if (productName) {
      this.selectedProduct = productName;
      this.updateProductSalesByMonth(productName);
    }
  }
  
  onSelectProduct2(event: any) {
    const productName2 = event?.target?.value;
    console.log("🔵 Vybraný produkt:", productName2);
    
    if (productName2) {
      this.selectedProduct2 = productName2;
      this.updateProductSalesByMonth2(productName2);
    }
  }

  updateProductSalesByMonth(productName: string) {
    const salesByMonthMap: { [key: string]: number } = {};
  
    this.sales
      .filter(sale => sale.product_name === productName)
      .forEach(sale => {
        const key = `${sale.year}-${String(sale.month).padStart(2, "0")}`; // PadStart pridá 0 pred jednociferné mesiace
        const value = this.selectedMetric === "EUR" ? sale.tax_counted : sale.weight;
        salesByMonthMap[key] = (salesByMonthMap[key] || 0) + value;
      });
  
    this.productSalesByMonth = [{
      name: productName,
      data: Object.keys(salesByMonthMap)
        .map(key => ({
          x: key, // Formát `YYYY-MM`
          y: salesByMonthMap[key]
        }))
        .sort((a, b) => a.x.localeCompare(b.x))
    }];
  }

  updateProductSalesByMonth2(productName2: string) {
    const salesByMonthMap2: { [key: string]: number } = {};
  
    this.sales
      .filter(sale => sale.product_name === productName2)
      .forEach(sale => {
        const key = `${sale.year}-${String(sale.month).padStart(2, "0")}`;
        const value = this.selectedMetric === "EUR" ? sale.tax_counted : sale.weight;
        salesByMonthMap2[key] = (salesByMonthMap2[key] || 0) + value;
      });
  
    this.productSalesByMonth2 = [{
      name: productName2,
      data: Object.keys(salesByMonthMap2)
        .map(key => ({
          x: key,
          y: salesByMonthMap2[key]
        }))
        .sort((a, b) => a.x.localeCompare(b.x))
    }];
  }

  calculateTotalRevenueByMonth() {
    const revenueByMonth: { [key: string]: number } = {};
    let totalSum = 0;
    let previousSum = 0;
  
    const startYear = parseInt(this.selectedYear_start);
    const startMonth = parseInt(this.selectedMonth_start);
    const endYear = parseInt(this.selectedYear_end);
    const endMonth = parseInt(this.selectedMonth_end);
  
    // 🗓 Vypočítanie časového obdobia pre porovnanie (rok dozadu)
    const prevStartYear = startYear - 1;
    const prevEndYear = endYear - 1;
  
    this.sales.forEach(sale => {
      const saleDate = new Date(sale.year, sale.month - 1);
  
      // ✅ Filtrujeme podľa vybraného zákazníka alebo všetkých
      if (this.selectedCustomer === 'ALL' || sale.customer_name === this.selectedCustomer) {
        const monthKey = `${sale.year}-${String(sale.month).padStart(2, '0')}`;
  
        // 🔹 Súčasné obdobie (napr. 01/2024 - 01/2025)
        if (
          (sale.year > startYear || (sale.year === startYear && sale.month >= startMonth)) &&
          (sale.year < endYear || (sale.year === endYear && sale.month <= endMonth))
        ) {
          const value = this.selectedMetric === "EUR" ? sale.tax_counted : sale.weight;
          revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + value;
          totalSum += value;
        }
  
        // 🔸 Predchádzajúce obdobie (napr. 01/2023 - 01/2024)
        if (
          (sale.year > prevStartYear || (sale.year === prevStartYear && sale.month >= startMonth)) &&
          (sale.year < prevEndYear || (sale.year === prevEndYear && sale.month <= endMonth))
        ) {
          const value = this.selectedMetric === "EUR" ? sale.tax_counted : sale.weight;
          previousSum += value;
        }
      }
    });
  
    this.totalRevenueSum = totalSum; // ✅ Uložíme celkový obrat za aktuálne obdobie
    this.totalRevenuePrevious = previousSum; // ✅ Uložíme obrat za predchádzajúce obdobie
  
    // ✅ Výpočet percentuálnej zmeny
    if (previousSum > 0) {
      this.percentageChangeRevenue = ((totalSum - previousSum) / previousSum) * 100;
    } else {
      this.percentageChangeRevenue = totalSum > 0 ? 100 : 0;
    }
  
    this.totalRevenueByMonth = [
      {
        name: this.selectedCustomer === 'ALL' ? 'Celkový obrat' : `Obrat: ${this.selectedCustomer}`,
        data: Object.keys(revenueByMonth)
          .map(period => ({
            x: String(period),
            y: revenueByMonth[period]
          }))
          .sort((a, b) => a.x.localeCompare(b.x))
      }
    ];
  }
  

// 📋 Načítanie zoznamu zákazníkov do dropdownu
populateCustomersList() {
  const customersSet = new Set<string>(this.sales.map(sale => sale.customer_name));
  this.customersList = ['ALL', ...Array.from(customersSet)];
}

// 🛒 Zmena zákazníka a aktualizácia grafu
onSelectCustomer(event: any) {
  this.selectedCustomer = event.target.value;
  this.calculateTotalRevenueByMonth();
}



  calculateTopCustomers() {
    const customerSalesMap: { [key: string]: number } = {};
    
    this.sales.forEach(sale => {
      const customerNameLower = sale.customer_name.toLowerCase();
  
      if (customerNameLower.includes("róbert") && customerNameLower.includes("gašparík")) {
        return;
      }
  
      let customerKey = sale.customer_name;
      if (customerNameLower.includes("billa")) {
        customerKey = "Billa";
      } else if (customerNameLower.includes("kaufland")) {
        customerKey = "Kaufland";
      } else if (customerNameLower.includes("lidl")) {
        customerKey = "Lidl";
      } else if (customerNameLower.includes("tesco")) {
        customerKey = "Tesco";
      } else if (customerNameLower.includes("coop jednota nove")) {
        customerKey = "COOP Jednota Nové Zámky";
      } else if (customerNameLower.includes("coop jednota trnava")) {
        customerKey = "COOP Jednota Trnava";
      } else if (customerNameLower.includes("ko.ma.co")) {
        customerKey = "Ko.Ma.Co";
      } else if (customerNameLower.includes("materskou skolou")) {
        customerKey = "ZŠ s MŠ";
      }
  
      // Použijeme metriku podľa `selectedMetric`
      const value = this.selectedMetric === "EUR" ? sale.tax_counted : sale.weight;
        customerSalesMap[customerKey] = (customerSalesMap[customerKey] || 0) + value;
    });
  
    this.topCustomers = [
      {
        name: `Top zákazníci (${this.selectedMetric === "EUR" ? "€" : "kg"})`,
        data: Object.entries(customerSalesMap)
          .map(([name, value]) => ({ x: String(name), y: value }))
          .sort((a, b) => b.y - a.y)
          .slice(0, 20)
      }
    ];

    this.updateYAxisAndTooltip();
  }

  updateYAxisAndTooltip() {
    const unit = this.selectedMetric === "EUR" ? "€" : "kg";

    this.yaxis = {
      labels: {
        style: {
          colors: this.darkMode ? "#ffffffB3" : "#000000B3",
          fontSize: '14px'
        },
        formatter: (value: number): string => {
          return value >= 1000
            ? Math.round(value).toLocaleString("sk-SK").replace(",", " ") + ` ${unit}`
            : value.toLocaleString("sk-SK").replace(",", ".") + ` ${unit}`;
        }
      }
    };

    this.tooltip = {
      theme: this.darkMode ? "dark" : "light",
      style: { fontSize: "14px" },
      y: {
        formatter: (value: number): string => {
          return value.toLocaleString("sk-SK") + ` ${unit}`;
        }
      }
    };
  }

  populateDateOptions() {
    this.availableYears = [];
    this.availableMonthsByYear = {};
    for (const sale of this.allSales) {
      const year = sale.year;
      const month = sale.month.toString().padStart(2, '0');
      if (!this.availableYears.includes(year)) {
        this.availableYears.push(year);
      }
      if (!this.availableMonthsByYear[year]) {
        this.availableMonthsByYear[year] = [];
      }
      if (!this.availableMonthsByYear[year].includes(month)) {
        this.availableMonthsByYear[year].push(month);
      }
    }
    // Zoradenie rokov a mesiacov
    this.availableYears.sort((a, b) => a - b);
    for (const year of this.availableYears) {
      this.availableMonthsByYear[year].sort();
    }
  }



  filterSalesByMonthYear() {
    this.isLoadingFilter = true; // ✅ Zobrazí spinner

    setTimeout(() => {
      // Tu vykonaj potrebné spracovanie dát
      console.log("✅ Filter dokončený!");
  
      this.isLoadingFilter = false; // ✅ Po dokončení skryje spinner a zobrazí "play"
    }, 2000); // Simulujeme oneskorenie, môžeš nahradiť reálnym kódom
    // Uloženie hodnôt do localStorage
    localStorage.setItem('selectedMonth_start', this.selectedMonth_start);
    localStorage.setItem('selectedYear_start', this.selectedYear_start);
    localStorage.setItem('selectedMonth_end', this.selectedMonth_end);
    localStorage.setItem('selectedYear_end', this.selectedYear_end);

    const start = new Date(parseInt(this.selectedYear_start), parseInt(this.selectedMonth_start) - 1, 1);
    const end = new Date(parseInt(this.selectedYear_end), parseInt(this.selectedMonth_end), 1);

    this.sales = this.allSales.filter(sale => {
      const saleDate = new Date(sale.year, sale.month - 1, 1);
      return saleDate >= start && saleDate < end;
    });

    this.processData();
    this.processData_products_all();
    this.selectTopProduct();
    this.calculateTotalRevenueByMonth();
    this.calculateTopCustomers();
    this.calculateTopCustomers_pj();
    this.updatePieChart();
  }

  
  
  
  calculateTopCustomers_pj() {
    const customerSalesMap_pj: { [key: string]: number } = {};
  
    this.sales.forEach(sale => {
      const customerNameLower = sale.customer_name.toLowerCase(); // Zmeníme na malé písmená
  
      // Preskočíme zákazníkov, ktorí neobsahujú aspoň jedno z výrazov "róbert" alebo "gašparík"
      if (!customerNameLower.includes("róbert") && !customerNameLower.includes("gašparík")) {
        return;
      }
  
      // Skupinové názvy zákazníkov (bez ohľadu na veľkosť písmen)
      let customerKey = sale.customer_name;
      // if (customerNameLower.includes("gašparík") && customerNameLower.includes("róbert")) {
      //   // Získame indexy prvého výskytu '-' a '/'
      //   const dashIndex = customerNameLower.indexOf('-');
      //   const slashIndex = customerNameLower.indexOf('/');
      
      //   // Určíme, ktorý z oddelovačov nastal ako prvý
      //   let separatorIndex = -1;
      //   if (dashIndex !== -1 && slashIndex !== -1) {
      //     separatorIndex = Math.min(dashIndex, slashIndex);
      //   } else if (dashIndex !== -1) {
      //     separatorIndex = dashIndex;
      //   } else if (slashIndex !== -1) {
      //     separatorIndex = slashIndex;
      //   }
      
      //   // Ak bol nájdený oddelovač, extrahujeme časť reťazca za ním
      //   if (separatorIndex !== -1) {
      //     const result = customerNameLower.substring(separatorIndex + 1).trim();
      //     console.log(result);
      //     // Môžete túto hodnotu ďalej spracovať, ak je to potrebné
      //   }
      // }
      const value = this.selectedMetric === "EUR" ? sale.tax_counted : sale.weight;
  
      customerSalesMap_pj[customerKey] = (customerSalesMap_pj[customerKey] || 0) + value;
    });
  
    this.topCustomers_pj = [
      {
        name: `Top predajne (${this.selectedMetric === "EUR" ? "€" : "kg"})`,
        data: Object.entries(customerSalesMap_pj)
          .map(([name, value]) => {
            let newName = String(name);
            newName = newName
              // .replace("Gašparík", "")
              // .replace("Róbert", "")
              // .replace("s.r.o.", "")
              // .replace("-", "")
              // .replace("/", "")
              // .trim();
            return { x: newName, y: value };
          })
          .sort((a, b) => b.y - a.y)
          .slice(0, 20)
      }
    ];
  }


  calculateNewCustomers() {
    // Dummy logika: počítame počet unikátnych zákazníkov v aktuálnom období ("od")
    // a porovnávame ho s predchádzajúcim obdobím (tu len pre ukážku použijeme dummy hodnoty)
    const uniqueCustomersCurrent = new Set(this.sales.map(sale => sale.customer_id)).size;
    // Pre demonstráciu nastavíme predchádzajúci počet na pevne danú hodnotu (napr. 80)
    const uniqueCustomersPrevious = 80; // túto hodnotu si prispôsobte
    this.newCustomersCount = uniqueCustomersCurrent;
    // Výpočet percentuálnej zmeny
    if (uniqueCustomersPrevious > 0) {
      this.percentageChange = uniqueCustomersCurrent ? 100 : 0;
    } else {
      this.percentageChange = Math.round(((uniqueCustomersCurrent - uniqueCustomersPrevious) / uniqueCustomersPrevious) * 100);
    }
    // Pre malý čiarový graf – dummy trendové dáta (tieto hodnoty by mali byť odvozené z vašich dát)
    this.newCustomersSeries = [{
      name: 'Noví zákazníci',
      data: [uniqueCustomersPrevious, uniqueCustomersPrevious + 5, uniqueCustomersPrevious + 10, uniqueCustomersPrevious + 8, uniqueCustomersPrevious + 12, uniqueCustomersPrevious + 15, uniqueCustomersCurrent]
    }];
  }

  toggleFullScreen(element: HTMLElement): void {
    this.isFullScreen = !this.isFullScreen; // Prepne stav fullscreen
  
    // Zväčšenie výšky grafu pri fullscreen režime
    this.barChartOptions = {
      ...this.barChartOptions, // Zachová všetky existujúce nastavenia
      height: this.isFullScreen ? 1400 : 600 // Zväčší výšku ak je fullscreen
    };
  
    this.chartOptions = {
      ...this.chartOptions, // Zachováme ostatné nastavenia
      height: this.isFullScreen ? 1400 : 600 // Zväčší výšku ak je fullscreen
    };

    if (this.isFullScreen) {
      this.requestFullScreen(element);
    } else {
      this.exitFullScreen();
    }
  }
  
  requestFullScreen(element: HTMLElement): void {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      (element as any).webkitRequestFullscreen();
    } else if ((element as any).msRequestFullscreen) {
      (element as any).msRequestFullscreen();
    }
  }
  
  exitFullScreen(): void {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  }


}


