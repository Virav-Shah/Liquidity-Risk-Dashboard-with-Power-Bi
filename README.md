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

All metrics below are computed directly from the underlying 500 business-day Treasury dataset ([`Fact_DailyLiquidity.csv`](file:///Users/viravshah/Liquidity%20Risk%20DashBoard/Fact_DailyLiquidity.csv), spanning October 2024 through October 2026):

| Metric | Latest Observation (`2026-10-01`) | Trailing 180-Day Average | Historical 500-Day Range (Min – Max) |
| :--- | :--- | :--- | :--- |
| **Ending Cash Balance (TGA)** | **$893.70 Billion** | **$884.80 Billion** | $260.81B – $1,038.04B |
| **Daily Inflows (Gross Deposits)** | **$373.65 Billion** | **$160.13 Billion** | $11.37B – $571.15B (Median: $63.49B) |
| **Daily Outflows (Gross Withdrawals)**| **$464.00 Billion** | **$159.84 Billion** | $8.32B – $582.55B (Median: $74.58B) |
| **Net Daily Cash Flow** | **-$90.35 Billion** | **+$0.29 Billion** | -$121.38B – +$184.78B |
| **30-Day Rolling Burn Rate** | **$175.41 Billion / day** | **$159.84 Billion / day** | $137.36B – $194.18B / day |
| **Liquidity Coverage Ratio** | **5.1 Days** | **5.6 Days** | 1.7 Days – 7.0 Days (Median: 5.1 Days) |

---

### 🔍 Crucial Financial Context: Gross vs. Net Flows & The Debt Rollover Cycle

#### 1. Why Are Gross Inflows/Outflows in Hundreds of Billions, but Net Flow Is Near Zero?
* The Daily Treasury Statement reports **gross cash transactions**. The vast majority of daily cash volume stems from **Public Debt Cash Issues** (gross borrowing) and **Public Debt Cash Redemptions** (maturing debt payoffs).
* For example, on the latest observation day (`2026-10-01`):
  * **Gross Outflow ($464.00B):** Driven by **$341.43B** in maturing debt redemptions + **$122.57B** in federal program disbursements (Medicare, military retirement, VA benefits).
  * **Gross Inflow ($373.65B):** Driven by **$343.40B** in new short-term debt auctions + **$30.25B** in taxes and federal collections.
  * **Net Liquidity Drawdown:** -$90.35B.
* Over the full 500-day cycle, average daily gross inflow (**$153.83B**) and outflow (**$153.68B**) virtually balance out, yielding an average net daily delta of just **+$0.14B/day**.

#### 2. Understanding the 5.1-Day Coverage Ratio
* The Liquidity Coverage Ratio measures:
  $$\text{Days of Liquidity} = \frac{\text{Ending Cash Balance}}{\text{Trailing 30-Day Daily Gross Burn}} = \frac{\$893.70\text{B}}{\$175.41\text{B/day}} = \mathbf{5.1\text{ Days}}$$
* In sovereign finance, an operational cash balance of ~$900B represents **5.1 days of total gross debt rollover & disbursements** if the Treasury were unable to issue any new debt into primary debt markets.
* Across the 500-day history, this coverage ratio fluctuates within a narrow band between **1.7 Days and 7.0 Days** (mean: **5.6 Days**, median: **5.1 Days**).

#### 3. Outflow Stresstesting Dynamics (+25% Shock)
* Evaluating the trailing 90-day baseline (mean daily outflow of **$161.07B/day**):
  * **Baseline 90-Day Coverage:** $\frac{\$893.70\text{B}}{\$161.07\text{B/day}} = \mathbf{5.5\text{ Days}}$
  * **Stressed Outflow (+25% Surge):** $\$161.07\text{B} \times 1.25 = \mathbf{\$201.33\text{B/day}}$
  * **Stressed Coverage:** $\frac{\$893.70\text{B}}{\$201.33\text{B/day}} = \mathbf{4.4\text{ Days}}$
  * **Liquidity Compression:** A +25% unhedged disbursement/redemption surge strips **1.1 days** of total sovereign cash runway, breaching operational buffers and requiring immediate issuance of Cash Management Bills (CMBs).

---

### 🛡️ Multi-Tier Liquidity Coverage Framework (Interview Defense Benchmark)

To address the distinction between gross debt rollover turnover and true operating expenditure runway, the dashboard framework provides three complementary layers of liquidity coverage:

| Coverage Metric Tier | Daily Burn Rate Used | Result (on $893.7B TGA Cash) | What It Measures | Policy / Alert Benchmark |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Gross Cash Coverage (DTS Table I)** | **~$175.4B / day** (trailing 30D gross withdrawals) | **5.1 Days** | Immediate survival runway if **100% of debt auctions freeze** and all maturing debt must be paid in cash. | U.S. Treasury targets roughly **5 to 7 business days** (1 week) of gross outflows as its operational buffer. Alert: $< 5\text{ Days}$. |
| **Tier 2: Operating-Only Coverage (Excluding Debt Redemptions)** | **~$28.0B / day** (~$7.0T/yr federal spending $\div$ 250 business days) | **≈ 31.9 Business Days** (~1.5 Months) | Pure governmental spending runway (Social Security, Medicare, DoD, federal wages) without refinancing pressure. | Institutional liquidity target: **≥ 30 Business Days**. Alert: $< 20\text{ Days}$. |
| **Tier 3: Net Cash Deficit Runway (Outflows − Non-Debt Inflows)** | **~$7.2B / day** (~$1.8T/yr net deficit $\div$ 250 business days) | **≈ 124 Business Days** (~6 Months) | Time until cash exhaustion assuming normal tax collections continue but Treasury cannot issue net new debt. | Sovereign debt-ceiling exhaustion horizon. Alert: $< 45\text{ Days}$. |

> **💡 The Executive Explanation:**
> *"When looking at DTS Table I, the headline 5.1-day coverage ratio is dominated by gross public debt rollover (~75% of daily outflows). The U.S. Treasury prudently targets roughly 1 week of gross outflows as its cash buffer. By stripping out debt redemptions, we see our operating-only buffer covers ~32 business days of non-debt government spending, and our net cash deficit runway spans over 120 business days."*

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
