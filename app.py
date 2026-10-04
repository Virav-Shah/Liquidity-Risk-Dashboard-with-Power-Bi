import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import json
import os
import requests
import ssl

# Page Configuration
st.set_page_config(
    page_title="U.S. Treasury Liquidity Risk & Stresstesting Dashboard",
    page_icon="💧💵",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Institutional CSS
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', sans-serif;
    }
    
    .stMetric {
        background: rgba(18, 24, 38, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    
    .stMetric label {
        color: #94a3b8 !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        font-size: 0.75rem !important;
        letter-spacing: 0.05em;
    }
    
    .stMetric [data-testid="stMetricValue"] {
        font-family: 'JetBrains Mono', monospace;
        font-size: 1.8rem !important;
        font-weight: 800 !important;
        color: #f8fafc !important;
    }
    
    .badge-status {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 9999px;
        font-weight: 700;
        font-size: 0.8rem;
    }
    
    .badge-safe { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
</style>
""", unsafe_allow_html=True)

# Data Loading with Cache
@st.cache_data(ttl=3600)
def load_data():
    csv_file = "Fact_DailyLiquidity.csv"
    if os.path.exists(csv_file):
        df = pd.read_csv(csv_file)
    else:
        # Fallback to direct API
        url = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=2000"
        res = requests.get(url, verify=False)
        data = res.json().get('data', [])
        records = {}
        for r in data:
            d = r['record_date']
            if d not in records:
                records[d] = {'record_date': d, 'open_today_bal': 0.0, 'deposits_today': 0.0, 'withdrawals_today': 0.0, 'close_today_bal': 0.0}
            act = r.get('account_type', '')
            val = float(r['open_today_bal']) if r.get('open_today_bal') and r['open_today_bal'] != 'null' else 0.0
            if act == 'Treasury General Account (TGA) Opening Balance': records[d]['open_today_bal'] = val
            elif act == 'Total TGA Deposits (Table II)': records[d]['deposits_today'] = val
            elif act == 'Total TGA Withdrawals (Table II) (-)': records[d]['withdrawals_today'] = val
            elif act == 'Treasury General Account (TGA) Closing Balance': records[d]['close_today_bal'] = val
        df = pd.DataFrame(list(records.values()))
    
    df['record_date'] = pd.to_datetime(df['record_date'])
    df = df.sort_values('record_date').reset_index(drop=True)
    
    # Financial fields in Billions
    df['open_bal_B'] = df['open_today_bal'] / 1000.0
    df['deposits_B'] = df['deposits_today'] / 1000.0
    df['withdrawals_B'] = df['withdrawals_today'] / 1000.0
    df['close_bal_B'] = df['close_today_bal'] / 1000.0
    df['net_flow_B'] = df['deposits_B'] - df['withdrawals_B']
    
    # Rolling 30D Outflows & Coverage Ratio (Days)
    df['rolling_30d_outflow_B'] = df['withdrawals_B'].rolling(window=30, min_periods=1).sum()
    df['daily_burn_B'] = df['rolling_30d_outflow_B'] / 30.0
    df['coverage_days'] = np.where(df['daily_burn_B'] > 0, df['close_bal_B'] / df['daily_burn_B'], 0)
    
    # Calendar features
    df['Year'] = df['record_date'].dt.year
    df['Month'] = df['record_date'].dt.strftime('%b %Y')
    df['YearMonth'] = df['record_date'].dt.strftime('%Y-%m')
    df['Weekday'] = df['record_date'].dt.strftime('%a')
    df['WeekdayNum'] = df['record_date'].dt.weekday
    
    return df

df = load_data()

# Sidebar Navigation & Filter Controls
st.sidebar.markdown("## 💧💵 Treasury Risk Controls")
st.sidebar.caption("Live Fiscal Data from U.S. Dept. of the Treasury")

timeframe_option = st.sidebar.selectbox(
    "Historical Timeframe Window",
    ["Last 30 Days", "Last 90 Days", "Last 180 Days", "Last 1 Year", "Full History (500 Days)"],
    index=2
)

timeframe_map = {
    "Last 30 Days": 30,
    "Last 90 Days": 90,
    "Last 180 Days": 180,
    "Last 1 Year": 365,
    "Full History (500 Days)": len(df)
}
days_to_show = timeframe_map[timeframe_option]
filtered_df = df.tail(days_to_show).copy()

st.sidebar.markdown("---")
st.sidebar.markdown("### ⚠️ Stresstesting Parameter")
stress_shock_pct = st.sidebar.slider(
    "Outflow Withdrawal Shock (%)",
    min_value=0,
    max_value=60,
    value=25,
    step=5,
    help="Simulates sudden institutional or sovereign withdrawal surge across all disbursements."
)

st.sidebar.markdown("---")
if st.sidebar.button("🔄 Sync Live Treasury API"):
    st.cache_data.clear()
    st.rerun()

# Global KPI Header
latest = df.iloc[-1]
prev = df.iloc[-2] if len(df) > 1 else latest
bal_delta_pct = ((latest['close_bal_B'] - prev['close_bal_B']) / prev['close_bal_B']) * 100 if prev['close_bal_B'] > 0 else 0.0

st.title("💧💵 U.S. Treasury Liquidity Risk & Stresstesting Dashboard")
st.caption(f"Real-Time Monitoring of Sovereign Cash Balances, Burn Rates, and Outflow Shocks • As of {latest['record_date'].strftime('%b %d, %Y')}")

kpi1, kpi2, kpi3, kpi4 = st.columns(4)

with kpi1:
    st.metric(
        label="Ending Cash Balance (TGA)",
        value=f"${latest['close_bal_B']:,.2f}B",
        delta=f"{bal_delta_pct:+.1f}% vs Prev Day"
    )

with kpi2:
    st.metric(
        label="Latest Daily Inflow (Deposits)",
        value=f"${latest['deposits_B']:,.2f}B",
        delta="Collections & Tax Receipts",
        delta_color="normal"
    )

with kpi3:
    st.metric(
        label="Latest Daily Outflow (Withdrawals)",
        value=f"${latest['withdrawals_B']:,.2f}B",
        delta="Disbursements & Debt Roll",
        delta_color="inverse"
    )

with kpi4:
    coverage = latest['coverage_days']
    status_text = "Safe Buffer (>30D)" if coverage >= 30 else ("Elevated (15-30D)" if coverage >= 15 else "Critical Risk (<15D)")
    st.metric(
        label="Days of Liquidity Coverage",
        value=f"{coverage:.1f} Days",
        delta=status_text,
        delta_color="normal" if coverage >= 30 else "inverse"
    )

st.markdown("---")

# Main Multi-Tab Architecture
tab_monitor, tab_heatmap, tab_stress, tab_powerbi = st.tabs([
    "📊 Cash & Outflow Monitoring",
    "🗺️ Liquidity Risk Heatmap",
    "⚡ Stresstesting & Runoff Analysis",
    "📑 Power BI / DAX Guide"
])

# ----------------- TAB 1: Monitoring & Projections -----------------
with tab_monitor:
    col_chart1, col_chart2 = st.columns(2)
    
    with col_chart1:
        st.subheader("TGA Ending Cash Reserve Trajectory ($B)")
        fig_bal = px.area(
            filtered_df,
            x='record_date',
            y='close_bal_B',
            labels={'record_date': 'Date', 'close_bal_B': 'Closing Balance ($B)'},
            template='plotly_dark'
        )
        fig_bal.update_traces(line_color='#3b82f6', fillcolor='rgba(59, 130, 246, 0.25)')
        fig_bal.update_layout(height=380, margin=dict(l=20, r=20, t=30, b=20))
        st.plotly_chart(fig_bal, use_container_width=True)

    with col_chart2:
        st.subheader("Daily Inflows vs. Daily Outflows ($B)")
        fig_flow = go.Figure()
        fig_flow.add_trace(go.Scatter(
            x=filtered_df['record_date'], y=filtered_df['deposits_B'],
            mode='lines', name='Gross Deposits', line=dict(color='#10b981', width=1.8)
        ))
        fig_flow.add_trace(go.Scatter(
            x=filtered_df['record_date'], y=filtered_df['withdrawals_B'],
            mode='lines', name='Gross Withdrawals', line=dict(color='#ef4444', width=1.8)
        ))
        fig_flow.update_layout(
            template='plotly_dark',
            height=380,
            margin=dict(l=20, r=20, t=30, b=20),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        st.plotly_chart(fig_flow, use_container_width=True)

    col_chart3, col_chart4 = st.columns(2)
    
    with col_chart3:
        st.subheader("Net Daily Cash Flow ($B) [Inflows - Outflows]")
        colors = ['#10b981' if x >= 0 else '#ef4444' for x in filtered_df['net_flow_B']]
        fig_net = go.Figure(go.Bar(
            x=filtered_df['record_date'],
            y=filtered_df['net_flow_B'],
            marker_color=colors,
            name='Net Flow'
        ))
        fig_net.update_layout(
            template='plotly_dark',
            height=360,
            margin=dict(l=20, r=20, t=30, b=20),
            yaxis_title="Net Cash ($B)"
        )
        st.plotly_chart(fig_net, use_container_width=True)

    with col_chart4:
        st.subheader("Rolling Liquidity Coverage Ratio (Days) vs. Benchmark")
        fig_cov = go.Figure()
        fig_cov.add_trace(go.Scatter(
            x=filtered_df['record_date'], y=filtered_df['coverage_days'],
            mode='lines', name='Coverage (Days)', line=dict(color='#f59e0b', width=2),
            fill='tozeroy', fillcolor='rgba(245, 158, 11, 0.1)'
        ))
        fig_cov.add_trace(go.Scatter(
            x=filtered_df['record_date'], y=[30]*len(filtered_df),
            mode='lines', name='30-Day Safe Threshold', line=dict(color='#ef4444', dash='dash', width=1.5)
        ))
        fig_cov.update_layout(
            template='plotly_dark',
            height=360,
            margin=dict(l=20, r=20, t=30, b=20),
            yaxis_title="Days of Liquidity",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        st.plotly_chart(fig_cov, use_container_width=True)

# ----------------- TAB 2: Heatmap -----------------
with tab_heatmap:
    st.subheader("🗓️ Treasury Liquidity Drain Heatmap: Month vs. Weekday")
    st.caption("Average Net Daily Cash Flow ($B). Dark Red highlights recurring structural liquidity drains; Green highlights tax settlement surpluses.")

    heatmap_df = df[df['WeekdayNum'] < 5].copy() # Mon to Fri
    pivot_table = heatmap_df.pivot_table(
        index='YearMonth',
        columns='Weekday',
        values='net_flow_B',
        aggfunc='mean'
    )
    # Order weekdays
    weekday_order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    pivot_table = pivot_table.reindex(columns=[c for c in weekday_order if c in pivot_table.columns])
    pivot_table = pivot_table.sort_index(ascending=False).head(14) # Trailing 14 months

    fig_heat = px.imshow(
        pivot_table,
        labels=dict(x="Day of Week", y="Period (Year-Month)", color="Avg Net Flow ($B)"),
        color_continuous_scale="RdYlGn",
        color_continuous_midpoint=0,
        text_auto=".1f",
        template='plotly_dark',
        aspect="auto"
    )
    fig_heat.update_layout(height=480, margin=dict(l=20, r=20, t=30, b=20))
    st.plotly_chart(fig_heat, use_container_width=True)

    st.info("""
    **💡 Observed Liquidity Insights:**
    - **Mid-Month Inflow Clusters:** Significant positive surges occur mid-month due to federal corporate quarterly tax payments and bi-weekly payroll withholding settlements.
    - **Month-End & Month-Start Drawdowns:** Structural negative cash drawdowns cluster at the start and end of months due to Social Security, Medicare, military payroll, and debt redemption cycles.
    """)

# ----------------- TAB 3: Stresstesting & Runoff -----------------
with tab_stress:
    st.subheader(f"⚡ Sovereign Outflow Stresstesting Model (+{stress_shock_pct}% Shock)")
    st.caption("Evaluating liquidity buffer adequacy under simulated withdrawal stress and unexpected expenditure surges.")
    
    shock_mult = 1.0 + (stress_shock_pct / 100.0)
    
    # Trailing 90-day baseline vs stressed
    t90 = df.tail(90).copy()
    base_avg_outflow = t90['withdrawals_B'].mean()
    stressed_avg_outflow = base_avg_outflow * shock_mult
    latest_cash = latest['close_bal_B']
    stressed_coverage_days = latest_cash / stressed_avg_outflow if stressed_avg_outflow > 0 else 0
    
    s_col1, s_col2, s_col3, s_col4 = st.columns(4)
    with s_col1:
        st.metric("Baseline Daily Outflow", f"${base_avg_outflow:,.2f}B / day")
    with s_col2:
        st.metric("Stressed Daily Outflow", f"${stressed_avg_outflow:,.2f}B / day", delta=f"+{stress_shock_pct}% Shock", delta_color="inverse")
    with s_col3:
        st.metric("Stressed Coverage", f"{stressed_coverage_days:.1f} Days", delta=f"{stressed_coverage_days - latest['coverage_days']:.1f} Days", delta_color="inverse")
    with s_col4:
        risk_label = "🟢 Resilient (>30D)" if stressed_coverage_days >= 30 else ("⚠️ Elevated Risk (20-30D)" if stressed_coverage_days >= 20 else "🚨 Breach Alert (<20D)")
        st.markdown(f"**Buffer Status:**<br><span style='font-size:1.4rem; font-weight:700;'>{risk_label}</span>", unsafe_allow_html=True)

    st.markdown("###")
    
    sc_col1, sc_col2 = st.columns(2)
    
    with sc_col1:
        st.subheader("Monthly Outflows: Baseline vs. Stressed ($B)")
        monthly_summary = df.copy()
        monthly_summary['stressed_outflows_B'] = monthly_summary['withdrawals_B'] * shock_mult
        monthly_agg = monthly_summary.groupby('YearMonth')[['withdrawals_B', 'stressed_outflows_B']].sum().tail(12).reset_index()
        
        fig_monthly_stress = go.Figure()
        fig_monthly_stress.add_trace(go.Bar(
            x=monthly_agg['YearMonth'], y=monthly_agg['withdrawals_B'],
            name='Actual Outflow', marker_color='#3b82f6'
        ))
        fig_monthly_stress.add_trace(go.Bar(
            x=monthly_agg['YearMonth'], y=monthly_agg['stressed_outflows_B'],
            name=f'Stressed Outflow (+{stress_shock_pct}%)', marker_color='#ef4444'
        ))
        fig_monthly_stress.update_layout(
            barmode='group',
            template='plotly_dark',
            height=380,
            margin=dict(l=20, r=20, t=30, b=20),
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        st.plotly_chart(fig_monthly_stress, use_container_width=True)

    with sc_col2:
        st.subheader("90-Day Cumulative Cash Runoff Simulation ($B)")
        # Simulate cumulative runoff
        sim_df = t90.copy()
        initial_cash = sim_df.iloc[0]['open_bal_B']
        stressed_cash_path = []
        running_cash = initial_cash
        
        for _, row in sim_df.iterrows():
            inflow = row['deposits_B']
            shocked_out = row['withdrawals_B'] * shock_mult
            running_cash = max(0, running_cash + inflow - shocked_out)
            stressed_cash_path.append(running_cash)
        
        sim_df['stressed_cash_path_B'] = stressed_cash_path
        
        fig_runoff = go.Figure()
        fig_runoff.add_trace(go.Scatter(
            x=sim_df['record_date'], y=sim_df['close_bal_B'],
            mode='lines', name='Actual TGA Balance', line=dict(color='#3b82f6', width=2)
        ))
        fig_runoff.add_trace(go.Scatter(
            x=sim_df['record_date'], y=sim_df['stressed_cash_path_B'],
            mode='lines', name=f'Stressed Runoff (+{stress_shock_pct}%)', line=dict(color='#ef4444', width=2.2, dash='dash')
        ))
        fig_runoff.update_layout(
            template='plotly_dark',
            height=380,
            margin=dict(l=20, r=20, t=30, b=20),
            yaxis_title="Simulated Balance ($B)",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        st.plotly_chart(fig_runoff, use_container_width=True)

# ----------------- TAB 4: Power BI Guide -----------------
with tab_powerbi:
    st.subheader("📑 Turnkey Power BI Desktop Implementation Guide")
    st.markdown("Use the following formulas and scripts to reproduce the exact model in Power BI Desktop.")
    
    with st.expander("1. Power Query Advanced Editor (M-Code)", expanded=True):
        st.code("""let
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
    #"Changed Type" """, language="powerquery")

    with st.expander("2. Calendar Dimension Table (DAX)", expanded=False):
        st.code("""Dim_Date = 
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
)""", language="dax")

    with st.expander("3. Business Measures (_Measures Table)", expanded=False):
        st.code("""// 1. Inflows & Outflows
Real Inflows = SUM(Fact_DailyLiquidity[deposits_today])
Real Outflows = SUM(Fact_DailyLiquidity[withdrawals_today])
Net Daily Cash Flow = [Real Inflows] - [Real Outflows]

// 2. Ending Cash Balance & Rolling Buffer
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

// 3. Stresstesting What-If Parameter
Stressed Outflows = 
[Real Outflows] * (1 + 'Outflow Stress Parameter'[Outflow Stress Parameter Value])

Stressed Net Cash Flow = [Real Inflows] - [Stressed Outflows]""", language="dax")

st.markdown("---")
st.markdown("Built with Python, Streamlit & Plotly • Connected to U.S. Treasury Fiscal Data API • Repository: [Liquidity-Risk-Dashboard-with-Power-Bi](https://github.com/Virav-Shah/Liquidity-Risk-Dashboard-with-Power-Bi)")
