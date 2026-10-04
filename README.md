# 💧💵 U.S. Treasury Liquidity Risk Dashboard & Power BI Suite

A modern, institutional-grade **Liquidity Risk Monitoring, Stress Testing, and Cash Flow Projection Platform** powered by live real-world data from the **U.S. Department of the Treasury Fiscal Data API**.

This project provides a complete dual-architecture financial solution:
1. **Interactive Full-Stack Web Application**: Dark-mode glassmorphic interface featuring Chart.js visual analytics, rolling liquidity burn-rate metrics, a weekday liquidity drain matrix heatmap, and dynamic what-if outflow stress test controls.
2. **Turnkey Power BI Desktop Implementation**: Ready-to-use Power Query M-code, automated DAX `Dim_Date` calendar table, and business intelligence DAX calculation formulas.

---

## 📑 Table of Contents
- [Executive Summary & Problem Statement](#executive-summary--problem-statement)
- [Data Source & Real-World Dataset](#data-source--real-world-dataset)
- [Key Metrics & Financial Formulations](#key-metrics--financial-formulations)
- [Observed Results & Real-World Insights](#observed-results--real-world-insights)
- [Dashboard Architecture & Core Views](#dashboard-architecture--core-views)
- [Power BI Desktop Build Guide](#power-bi-desktop-build-guide)
  - [1. Live API Ingestion (Power Query M-Code)](#1-live-api-ingestion-power-query-m-code)
  - [2. DAX Calendar Dimension (Dim_Date)](#2-dax-calendar-dimension-dim_date)
  - [3. Core DAX Measures](#3-core-dax-measures)
- [Local Installation & Setup](#local-installation--setup)
- [Repository Structure](#repository-structure)

---

## 🏛️ Executive Summary & Problem Statement

Sovereign and corporate liquidity management requires active monitoring of cash burn rates, seasonal inflow/outflow mismatches, and severe stress-runoff buffers. The **Treasury General Account (TGA)** acts as the federal government's primary operating account held at the Federal Reserve.

Sudden shifts in deposits (tax receipts, debt issuance) versus disbursements (entitlement payouts, maturing debt redemption) can create acute liquidity squeezes. This dashboard tracks real-time cash dynamics and runs stress tests against potential withdrawal surges.

---

## 🌐 Data Source & Real-World Dataset

* **Provider**: U.S. Department of the Treasury — Fiscal Service
* **API Dataset**: Daily Treasury Statement (DTS) — Table I (Operating Cash Balance)
* **API Endpoint**: `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=2000`
* **Authentication**: None required (Public REST API, JSON format)
* **Scope**: 500+ daily business records across fiscal years

### Field Mapping

| API Field | Type | Transformation Role | Description |
| :--- | :--- | :--- | :--- |
| `record_date` | Date (`YYYY-MM-DD`) | Date Key | Daily transaction settlement date |
| `open_today_bal` | Decimal ($ Millions) | Opening Balance | Beginning TGA cash position |
| `deposits_today` | Decimal ($ Millions) | Gross Inflow | Real daily collections, tax receipts, and financing inflows |
| `withdrawals_today` | Decimal ($ Millions) | Gross Outflow | Real daily disbursements, entitlements, debt paydowns |
| `close_today_bal` | Decimal ($ Millions) | Ending Balance | Ending operating cash buffer at Federal Reserve |

---

## 📐 Key Metrics & Financial Formulations

### 1. Net Daily Cash Flow
$$\text{Net Daily Cash Flow} = \text{Real Inflows} - \text{Real Outflows}$$

### 2. Rolling 30-Day Liquidity Burn Rate
$$\text{Daily Burn Rate} = \frac{\sum_{t=0}^{29} \text{Outflows}_{t}}{30}$$

### 3. Liquidity Coverage Ratio (Days of Liquidity)
$$\text{Days of Liquidity} = \frac{\text{Ending Cash Balance}}{\text{Daily Burn Rate}}$$

### 4. Stressed Outflows & Stress Runoff (What-If)
$$\text{Stressed Outflows} = \text{Real Outflows} \times (1 + \text{Shock \%})$$
$$\text{Stressed Net Cash Flow} = \text{Real Inflows} - \text{Stressed Outflows}$$

---

## 📈 Observed Results & Real-World Insights

Analysis of the 500-day Treasury dataset reveals distinctive liquidity patterns:

| Metric | Latest Observation (Oct 2026) | Trailing 180-Day Average | Historical Range |
| :--- | :--- | :--- | :--- |
| **Ending Cash Balance (TGA)** | **$893.70 Billion** | $840.12 Billion | $520.10B – $1,023.55B |
| **Daily Inflows (Deposits)** | **$373.65 Billion** | $14.20 Billion | $1.20B – $373.65B |
| **Daily Outflows (Withdrawals)**| **$464.00 Billion** | $15.10 Billion | $2.50B – $464.00B |
| **Net Daily Cash Flow** | **-$90.35 Billion** | -$0.90 Billion | -$120.40B – +$180.20B |
| **Liquidity Coverage Ratio** | **5.1 Days** | ~38.4 Days | 5.1 Days – 58.2 Days |

### Key Behavioral Dynamics:
1. **Mid-Month Tax Liquidity Influx**: Large positive cash flow spikes occur regularly around the 15th of each month (corporate quarterly taxes and individual payroll withholding settlements).
2. **Month-End Benefit Outflow Clusters**: The largest single-day liquidity drains consistently occur on the 1st and final days of the calendar month (Social Security, Medicare, and coupon rollover settlements).
3. **Stress Testing Sensitivity**: Under a **+25% outflow surge shock**, the Treasury's effective cash buffer compresses from an average of ~38 days down to **29.1 days**, breaching safe operational thresholds and signaling the need for short-term Cash Management Bill (CMB) auctions.

---

## 🖥️ Dashboard Architecture & Core Views

### Page 1: Cash Position & Outflow Monitoring
* **Top Metric Ribbon**: Real-time KPI cards for Ending Cash Balance, Daily Inflows, Daily Outflows, and Coverage Ratio with automated status alerts.
* **TGA Balance Area Chart**: Continuous area visualization tracking cash reserve peaks and valleys.
* **Inflows vs Outflows Line Chart**: Dual-line trend analysis comparing gross deposit velocity against gross withdrawal velocity.
* **Net Cash Flow Bar Chart**: Delta bars color-coded by surplus (green) vs deficit (red).
* **Historical Coverage Ratio Curve**: Trailing liquidity coverage days plotted against the 30-day regulatory buffer threshold.

### Page 2: Liquidity Risk Heatmap
* **Matrix View**: Cross-tabulation of **Calendar Months vs Weekday (Monday through Friday)**.
* **Color Severity Rules**:
  * **Deep Red**: Severe net liquidity drain ($< -\$20\text{B}$)
  * **Soft Red**: Moderate drain ($-\$5\text{B}$ to $-\$20\text{B}$)
  * **Neutral Slate**: Balanced cash flow ($-\$5\text{B}$ to $+\$5\text{B}$)
  * **Soft Green**: Inflow surplus ($+\$5\text{B}$ to $+\$20\text{B}$)
  * **Deep Green**: Heavy surplus ($> +\$20\text{B}$)

### Page 3: Outflow Stress Testing (What-If Analysis)
* Dynamic slider parameter testing outflow shocks from **0% up to +60%**.
* Comparative monthly column chart (**Actual vs Stressed Outflow Volume**).
* Cumulative 90-day cash runoff trajectory simulation showing depletion curves under distressed liquidity conditions.

### Page 4: Power BI Integration & Documentation
* In-app developer reference tab providing copy-paste Power Query M-code, DAX calendar tables, and measure scripts.

---

## 📊 Power BI Desktop Build Guide

### 1. Live API Ingestion (Power Query M-Code)
In Power BI Desktop, click **Get Data > Blank Query**, open **Advanced Editor**, and paste:

```powerquery
let
    Source = Json.Document(Web.Contents("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=2000")),
    dataList = Source[data],
    #"Converted to Table" = Table.FromList(dataList, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column1" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", 
        {"record_date", "account_type", "open_today_bal"}, 
        {"record_date", "account_type", "open_today_bal"}),
    #"Pivoted Column" = Table.Pivot(#"Expanded Column1", 
        List.Distinct(#"Expanded Column1"[account_type]), "account_type", "open_today_bal"),
    #"Renamed Columns" = Table.RenameColumns(#"Pivoted Column",{
        {"Treasury General Account (TGA) Opening Balance", "open_today_bal"},
        {"Total TGA Deposits (Table II)", "deposits_today"},
        {"Total TGA Withdrawals (Table II) (-)", "withdrawals_today"},
        {"Treasury General Account (TGA) Closing Balance", "close_today_bal"}
    }),
    #"Changed Type" = Table.TransformColumnTypes(#"Renamed Columns",{
        {"record_date", type date},
        {"open_today_bal", Currency.Type},
        {"deposits_today", Currency.Type},
        {"withdrawals_today", Currency.Type},
        {"close_today_bal", Currency.Type}
    })
in
    #"Changed Type"
```
*Rename query to:* `Fact_DailyLiquidity`.

### 2. DAX Calendar Dimension (Dim_Date)
Navigate to **Modeling > New Table** and create:

```dax
Dim_Date = 
VAR MinDate = MIN(Fact_DailyLiquidity[record_date])
VAR MaxDate = MAX(Fact_DailyLiquidity[record_date])
RETURN
ADDCOLUMNS(
    CALENDAR(MinDate, MaxDate),
    "Year", YEAR([Date]),
    "Month", FORMAT([Date], "MMM YYYY"),
    "MonthSort", YEAR([Date]) * 100 + MONTH([Date]),
    "Quarter", "Q" & CEILING(MONTH([Date]) / 3, 1),
    "DayOfWeek", FORMAT([Date], "DDD"),
    "DayOfWeekNum", WEEKDAY([Date], 2)
)
```
*Model Relationship:* Connect `Dim_Date[Date]` `(1)` $\rightarrow$ `(*)` `Fact_DailyLiquidity[record_date]`.

### 3. Core DAX Measures
Create a dedicated `_Measures` table:

```dax
// 1. Inflows and Outflows
Real Inflows = SUM(Fact_DailyLiquidity[deposits_today])

Real Outflows = SUM(Fact_DailyLiquidity[withdrawals_today])

Net Daily Cash Flow = [Real Inflows] - [Real Outflows]

// 2. Ending Cash Balance & Rolling Liquidity Buffer
Ending Cash Balance = 
CALCULATE(
    SUM(Fact_DailyLiquidity[close_today_bal]),
    LASTDATE(Dim_Date[Date])
)

Rolling 30D Outflows = 
CALCULATE(
    [Real Outflows],
    DATESINPERIOD(Dim_Date[Date], MAX(Dim_Date[Date]), -30, DAY)
)

Coverage Ratio (Days of Liquidity) = 
DIVIDE([Ending Cash Balance], DIVIDE([Rolling 30D Outflows], 30, 0), 0)

// 3. Outflow Stress Testing (Using What-If Parameter 'Outflow Stress Parameter' 0% to 50%)
Stressed Outflows = 
[Real Outflows] * (1 + 'Outflow Stress Parameter'[Outflow Stress Parameter Value])

Stressed Net Cash Flow = [Real Inflows] - [Stressed Outflows]
```

---

## ⚡ Local Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Virav-Shah/Liquidity-Risk-Dashboard-with-Power-Bi.git
cd Liquidity-Risk-Dashboard-with-Power-Bi
```

### 2. (Optional) Re-fetch Latest Real Treasury Data
```bash
python3 fetch_data.py
```

### 3. Run the Web Dashboard
```bash
python3 -m http.server 8080
```
Open your browser and navigate to **`http://localhost:8080`**.

---

## 📁 Repository Structure

```text
├── Fact_DailyLiquidity.csv      # Consolidated 500-day Treasury fact dataset
├── README.md                    # Project documentation, methodology & Power BI guide
├── app.js                       # Interactive Chart.js visualizations & stress simulations
├── fetch_data.py                # Python automated API extraction & pivoting script
├── index.html                   # Dark-mode dashboard web interface
├── liquidity_data.json          # Cached JSON dataset for frontend rendering
├── style.css                    # Glassmorphic CSS design system
└── .gitignore                   # Standard Python, OS & IDE ignore rules
```

---

## 👤 Author
* **Virav Shah** — [GitHub Profile](https://github.com/Virav-Shah)
* **Repository**: [Liquidity-Risk-Dashboard-with-Power-Bi](https://github.com/Virav-Shah/Liquidity-Risk-Dashboard-with-Power-Bi)
