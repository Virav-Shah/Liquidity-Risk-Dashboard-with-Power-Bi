// Treasury Liquidity Risk Dashboard Application Logic
let rawLiquidityData = [];
let charts = {};
let selectedTimeframeDays = 180;
let stressParameter = 0.25; // 25% shock

// Document Ready
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initStressControls();
  initTimeframeFilter();
  await loadLiquidityData();
  setupRefreshButton();
});

// Tab Navigation
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetTab = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetTab);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      // Trigger Chart.js resize on tab switch
      Object.values(charts).forEach(c => c && c.resize());
    });
  });
}

// Timeframe Filter Buttons
function initTimeframeFilter() {
  const rangeBtns = document.querySelectorAll('.range-btn');
  rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rangeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-days');
      selectedTimeframeDays = val === 'all' ? rawLiquidityData.length : parseInt(val);
      renderDashboard();
    });
  });
}

// Stress Slider Control
function initStressControls() {
  const slider = document.getElementById('stress-slider');
  const badge = document.getElementById('stress-slider-val');

  slider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    stressParameter = val / 100;
    badge.textContent = `+${val}%`;
    updateStressVisuals();
  });
}

// Refresh Button
function setupRefreshButton() {
  const btn = document.getElementById('refresh-btn');
  btn.addEventListener('click', async () => {
    btn.innerHTML = `<span class="status-dot pulse"></span> Fetching...`;
    btn.disabled = true;
    try {
      await fetchFromTreasuryApiDirect();
    } catch (err) {
      console.warn('Direct fetch failed, reloading static cache:', err);
      await loadLiquidityData();
    } finally {
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Sync Data
      `;
      btn.disabled = false;
    }
  });
}

// Load Cached JSON or fetch
async function loadLiquidityData() {
  try {
    const res = await fetch('liquidity_data.json');
    if (!res.ok) throw new Error('Cannot load liquidity_data.json');
    rawLiquidityData = await res.json();
    console.log(`Loaded ${rawLiquidityData.length} records.`);
    renderDashboard();
  } catch (err) {
    console.error('Error loading data:', err);
    await fetchFromTreasuryApiDirect();
  }
}

// Live Direct Fetch from Treasury API (Fallback / Live sync)
async function fetchFromTreasuryApiDirect() {
  try {
    const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=1500';
    const response = await fetch(url);
    const result = await response.json();
    const records = result.data || [];

    const dateMap = {};
    records.forEach(r => {
      const d = r.record_date;
      if (!d) return;
      if (!dateMap[d]) {
        dateMap[d] = {
          record_date: d,
          open_today_bal: 0,
          deposits_today: 0,
          withdrawals_today: 0,
          close_today_bal: 0
        };
      }
      const act = r.account_type;
      const val = parseFloat(r.open_today_bal) || 0;
      if (act === 'Treasury General Account (TGA) Opening Balance') dateMap[d].open_today_bal = val;
      else if (act === 'Total TGA Deposits (Table II)') dateMap[d].deposits_today = val;
      else if (act === 'Total TGA Withdrawals (Table II) (-)') dateMap[d].withdrawals_today = val;
      else if (act === 'Treasury General Account (TGA) Closing Balance') dateMap[d].close_today_bal = val;
    });

    rawLiquidityData = Object.values(dateMap).sort((a, b) => a.record_date.localeCompare(b.record_date));
    renderDashboard();
  } catch (e) {
    console.error('Failed to fetch from live Treasury API:', e);
  }
}

// Format Currency in Billions
function formatBillions(amt) {
  // raw data is in millions USD (e.g. 984046 = $984.05B)
  const b = amt / 1000;
  return `$${b.toFixed(2)}B`;
}

// Master Render Function
function renderDashboard() {
  if (!rawLiquidityData || rawLiquidityData.length === 0) return;

  // Filter timeframe
  const totalRows = rawLiquidityData.length;
  const sliceCount = Math.min(selectedTimeframeDays, totalRows);
  const data = rawLiquidityData.slice(totalRows - sliceCount);

  // Latest Record
  const latest = rawLiquidityData[rawLiquidityData.length - 1];
  const prev = rawLiquidityData.length > 1 ? rawLiquidityData[rawLiquidityData.length - 2] : latest;

  // Compute Rolling 30D Outflows for coverage
  const last30 = rawLiquidityData.slice(-30);
  const sum30Outflows = last30.reduce((acc, cur) => acc + parseFloat(cur.withdrawals_today), 0);
  const dailyBurn30 = sum30Outflows / 30;
  const latestClose = parseFloat(latest.close_today_bal);
  const coverageRatioDays = dailyBurn30 > 0 ? (latestClose / dailyBurn30) : 0;

  // Update Top Ribbon KPI Cards
  document.getElementById('data-as-of').textContent = `As of ${formatDisplayDate(latest.record_date)}`;
  document.getElementById('kpi-balance').textContent = formatBillions(latestClose);
  document.getElementById('kpi-inflows').textContent = formatBillions(parseFloat(latest.deposits_today));
  document.getElementById('kpi-outflows').textContent = formatBillions(parseFloat(latest.withdrawals_today));
  document.getElementById('kpi-coverage').textContent = `${coverageRatioDays.toFixed(1)} Days`;

  // Change Tag
  const prevClose = parseFloat(prev.close_today_bal);
  const pctChange = prevClose > 0 ? (((latestClose - prevClose) / prevClose) * 100).toFixed(1) : '0.0';
  const kpiChangeEl = document.getElementById('kpi-balance-change');
  kpiChangeEl.textContent = `${pctChange >= 0 ? '+' : ''}${pctChange}%`;
  kpiChangeEl.style.background = pctChange >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
  kpiChangeEl.style.color = pctChange >= 0 ? '#34d399' : '#f87171';

  // Coverage Status Badge
  const statusBadge = document.getElementById('kpi-status-badge');
  if (coverageRatioDays > 30) {
    statusBadge.textContent = 'Safe Buffer (>30D)';
    statusBadge.style.color = '#34d399';
    statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
  } else if (coverageRatioDays >= 15) {
    statusBadge.textContent = 'Moderate Buffer (15-30D)';
    statusBadge.style.color = '#fbbf24';
    statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    statusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
  } else {
    statusBadge.textContent = 'Critical Liquidity Risk (<15D)';
    statusBadge.style.color = '#f87171';
    statusBadge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    statusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
  }

  // Filter Bar Stats
  const avgInflow = data.reduce((acc, c) => acc + parseFloat(c.deposits_today), 0) / data.length;
  const avgOutflow = data.reduce((acc, c) => acc + parseFloat(c.withdrawals_today), 0) / data.length;
  const netDelta = (avgInflow - avgOutflow) / 1000;
  document.getElementById('filter-avg-inflow').textContent = formatBillions(avgInflow);
  document.getElementById('filter-avg-outflow').textContent = formatBillions(avgOutflow);
  document.getElementById('filter-net-delta').textContent = `${netDelta >= 0 ? '+' : ''}$${netDelta.toFixed(2)}B/day`;

  // Render Charts
  renderBalanceAreaChart(data);
  renderCashflowLineChart(data);
  renderNetCashflowChart(data);
  renderCoverageLineChart(rawLiquidityData.slice(totalRows - sliceCount));

  // Render Heatmap (all historical or trailing year)
  renderLiquidityHeatmap(rawLiquidityData);

  // Render Stress Testing Tab
  updateStressVisuals();
}

// Format date "2026-10-01" -> "Oct 01, 2026"
function formatDisplayDate(isoStr) {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// 1. Balance Area Chart
function renderBalanceAreaChart(data) {
  const ctx = document.getElementById('balanceAreaChart').getContext('2d');
  const labels = data.map(d => d.record_date);
  const balances = data.map(d => (parseFloat(d.close_today_bal) / 1000).toFixed(2)); // in Billions

  if (charts.balance) charts.balance.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

  charts.balance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'TGA Ending Cash ($B)',
        data: balances,
        borderColor: '#3b82f6',
        backgroundColor: gradient,
        borderWidth: 2.2,
        fill: true,
        tension: 0.25,
        pointRadius: labels.length > 60 ? 0 : 2,
        pointHoverRadius: 5,
        pointBackgroundColor: '#60a5fa'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => `Ending Cash: $${ctx.parsed.y} Billion`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 8,
            callback: (val, idx) => formatDisplayDate(labels[idx])
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            callback: (val) => `$${val}B`
          }
        }
      }
    }
  });
}

// 2. Inflows vs Outflows Line Chart
function renderCashflowLineChart(data) {
  const ctx = document.getElementById('cashflowLineChart').getContext('2d');
  const labels = data.map(d => d.record_date);
  const inflows = data.map(d => (parseFloat(d.deposits_today) / 1000).toFixed(2));
  const outflows = data.map(d => (parseFloat(d.withdrawals_today) / 1000).toFixed(2));

  if (charts.cashflow) charts.cashflow.destroy();

  charts.cashflow = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily Inflows ($B)',
          data: inflows,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          pointRadius: labels.length > 60 ? 0 : 2,
          pointHoverRadius: 4,
          tension: 0.15
        },
        {
          label: 'Daily Outflows ($B)',
          data: outflows,
          borderColor: '#ef4444',
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          pointRadius: labels.length > 60 ? 0 : 2,
          pointHoverRadius: 4,
          tension: 0.15
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#cbd5e1', font: { size: 11 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y}B`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 8,
            callback: (val, idx) => formatDisplayDate(labels[idx])
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            callback: (val) => `$${val}B`
          }
        }
      }
    }
  });
}

// 3. Net Cashflow Bar Chart
function renderNetCashflowChart(data) {
  const ctx = document.getElementById('netCashflowChart').getContext('2d');
  const labels = data.map(d => d.record_date);
  const netValues = data.map(d => {
    const inf = parseFloat(d.deposits_today);
    const out = parseFloat(d.withdrawals_today);
    return ((inf - out) / 1000).toFixed(2);
  });

  const backgroundColors = netValues.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)');

  if (charts.netCashflow) charts.netCashflow.destroy();

  charts.netCashflow = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Net Daily Cash ($B)',
        data: netValues,
        backgroundColor: backgroundColors,
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Net Flow: ${ctx.parsed.y >= 0 ? '+' : ''}$${ctx.parsed.y}B`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 8,
            callback: (val, idx) => formatDisplayDate(labels[idx])
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            callback: (val) => `$${val}B`
          }
        }
      }
    }
  });
}

// 4. Coverage Line Chart
function renderCoverageLineChart(data) {
  const ctx = document.getElementById('coverageLineChart').getContext('2d');
  const labels = data.map(d => d.record_date);

  // Compute coverage ratio for each observation point (using preceding 30 days)
  const coverageRatios = [];
  data.forEach((item, idx) => {
    // Find index in master rawLiquidityData
    const masterIdx = rawLiquidityData.findIndex(r => r.record_date === item.record_date);
    const startIdx = Math.max(0, masterIdx - 29);
    const windowRows = rawLiquidityData.slice(startIdx, masterIdx + 1);
    const sumOutflows = windowRows.reduce((acc, c) => acc + parseFloat(c.withdrawals_today), 0);
    const burn = sumOutflows / windowRows.length;
    const close = parseFloat(item.close_today_bal);
    const ratio = burn > 0 ? (close / burn) : 0;
    coverageRatios.push(ratio.toFixed(1));
  });

  if (charts.coverage) charts.coverage.destroy();

  charts.coverage = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Days of Liquidity',
          data: coverageRatios,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        },
        {
          label: '30-Day Safe Buffer Threshold',
          data: labels.map(() => 30),
          borderColor: 'rgba(239, 68, 68, 0.65)',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#cbd5e1', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} Days`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 8,
            callback: (val, idx) => formatDisplayDate(labels[idx])
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            callback: (val) => `${val} Days`
          }
        }
      }
    }
  });
}

// 5. Liquidity Risk Heatmap Table
function renderLiquidityHeatmap(records) {
  const container = document.getElementById('heatmap-view');
  if (!container || !records.length) return;

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  // Group by Month (Year-Month) and Day of Week
  const matrix = {}; // { 'YYYY-MM': { 'Mon': [netFlows], ... } }

  records.forEach(r => {
    const parts = r.record_date.split('-');
    const yearMonth = `${parts[0]}-${parts[1]}`;
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayIndex = dateObj.getDay(); // 0 Sun, 1 Mon, 5 Fri
    if (dayIndex >= 1 && dayIndex <= 5) {
      const dayName = weekdays[dayIndex - 1];
      if (!matrix[yearMonth]) {
        matrix[yearMonth] = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] };
      }
      const net = (parseFloat(r.deposits_today) - parseFloat(r.withdrawals_today)) / 1000; // $B
      matrix[yearMonth][dayName].push(net);
    }
  });

  // Sort Months descending (most recent first)
  const monthKeys = Object.keys(matrix).sort().reverse().slice(0, 16);

  let html = `
    <table class="heatmap-table">
      <thead>
        <tr>
          <th>Period (Year - Month)</th>
          <th>Monday</th>
          <th>Tuesday</th>
          <th>Wednesday</th>
          <th>Thursday</th>
          <th>Friday</th>
          <th>Month Avg Net Flow</th>
        </tr>
      </thead>
      <tbody>
  `;

  monthKeys.forEach(mKey => {
    const [y, m] = mKey.split('-');
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    let rowNetTotal = 0;
    let rowNetCount = 0;

    let rowTds = `<td>${monthLabel}</td>`;

    weekdays.forEach(day => {
      const arr = matrix[mKey][day];
      if (arr && arr.length > 0) {
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        rowNetTotal += arr.reduce((a, b) => a + b, 0);
        rowNetCount += arr.length;

        const cellColor = getHeatmapCellColor(avg);
        const sign = avg >= 0 ? '+' : '';
        rowTds += `<td style="background: ${cellColor.bg}; color: ${cellColor.text};" title="${monthLabel} ${day}: ${sign}$${avg.toFixed(2)}B avg net flow">${sign}$${avg.toFixed(1)}B</td>`;
      } else {
        rowTds += `<td style="background: rgba(15,23,42,0.4); color: #64748b;">-</td>`;
      }
    });

    const monthAvg = rowNetCount > 0 ? (rowNetTotal / rowNetCount) : 0;
    const mColor = getHeatmapCellColor(monthAvg);
    const mSign = monthAvg >= 0 ? '+' : '';
    rowTds += `<td style="background: ${mColor.bg}; color: ${mColor.text}; font-weight: 700;">${mSign}$${monthAvg.toFixed(1)}B</td>`;

    html += `<tr>${rowTds}</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function getHeatmapCellColor(val) {
  // val is in Billions
  if (val <= -20) {
    return { bg: 'rgba(185, 28, 28, 0.85)', text: '#ffffff' }; // Deep Red
  } else if (val < -5) {
    return { bg: 'rgba(220, 38, 38, 0.65)', text: '#fee2e2' }; // Soft Red
  } else if (val >= -5 && val <= 5) {
    return { bg: 'rgba(51, 65, 85, 0.55)', text: '#cbd5e1' }; // Neutral Gray/Slate
  } else if (val > 5 && val <= 20) {
    return { bg: 'rgba(5, 150, 105, 0.65)', text: '#d1fae5' }; // Soft Green
  } else {
    return { bg: 'rgba(16, 185, 129, 0.85)', text: '#ffffff' }; // Deep Green
  }
}

// 6. Stress Testing Dynamic Visuals
function updateStressVisuals() {
  if (!rawLiquidityData.length) return;

  // Compute trailing 90 days baseline
  const trailing90 = rawLiquidityData.slice(-90);
  const avgOutflow = trailing90.reduce((acc, c) => acc + parseFloat(c.withdrawals_today), 0) / trailing90.length;
  const stressedOutflow = avgOutflow * (1 + stressParameter);

  const latest = rawLiquidityData[rawLiquidityData.length - 1];
  const cash = parseFloat(latest.close_today_bal);
  const stressedCoverageDays = cash / stressedOutflow;

  document.getElementById('stress-base-outflow').textContent = formatBillions(avgOutflow) + ' / day';
  document.getElementById('stress-shocked-outflow').textContent = formatBillions(stressedOutflow) + ' / day';
  document.getElementById('stress-shocked-coverage').textContent = `${stressedCoverageDays.toFixed(1)} Days`;

  const riskPill = document.getElementById('stress-risk-pill');
  if (stressedCoverageDays > 30) {
    riskPill.textContent = '🟢 Resilient (>30D)';
    riskPill.style.background = 'rgba(16, 185, 129, 0.2)';
    riskPill.style.color = '#34d399';
    riskPill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
  } else if (stressedCoverageDays >= 20) {
    riskPill.textContent = '⚠️ Elevated Risk (20-30D)';
    riskPill.style.background = 'rgba(245, 158, 11, 0.2)';
    riskPill.style.color = '#fbbf24';
    riskPill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
  } else {
    riskPill.textContent = '🚨 Breach Alert (<20D)';
    riskPill.style.background = 'rgba(239, 68, 68, 0.2)';
    riskPill.style.color = '#f87171';
    riskPill.style.borderColor = 'rgba(239, 68, 68, 0.4)';
  }

  // Monthly Aggregated Stress Chart
  renderStressMonthlyChart(rawLiquidityData);

  // Cumulative Runoff Chart over trailing 90 days
  renderStressRunoffChart(trailing90);
}

// Monthly Clustered Chart: Baseline vs Stressed Outflows
function renderStressMonthlyChart(records) {
  const ctx = document.getElementById('stressMonthlyChart').getContext('2d');

  // Group by Month
  const monthlyData = {};
  records.forEach(r => {
    const parts = r.record_date.split('-');
    const mKey = `${parts[0]}-${parts[1]}`;
    if (!monthlyData[mKey]) monthlyData[mKey] = { out: 0, count: 0 };
    monthlyData[mKey].out += parseFloat(r.withdrawals_today);
    monthlyData[mKey].count += 1;
  });

  const monthKeys = Object.keys(monthlyData).sort().slice(-12);
  const labels = monthKeys.map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });

  const baselineOutflows = monthKeys.map(k => (monthlyData[k].out / 1000).toFixed(1));
  const stressedOutflows = monthKeys.map(k => ((monthlyData[k].out * (1 + stressParameter)) / 1000).toFixed(1));

  if (charts.stressMonthly) charts.stressMonthly.destroy();

  charts.stressMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Historical Actual Outflow ($B)',
          data: baselineOutflows,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderRadius: 4
        },
        {
          label: `Stressed Outflow (+${Math.round(stressParameter * 100)}%) ($B)`,
          data: stressedOutflows,
          backgroundColor: 'rgba(239, 68, 68, 0.75)',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#cbd5e1', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y}B`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            callback: (v) => `$${v}B`
          }
        }
      }
    }
  });
}

// Stress Runoff Trajectory
function renderStressRunoffChart(trailingData) {
  const ctx = document.getElementById('stressRunoffChart').getContext('2d');
  const labels = trailingData.map(d => d.record_date);

  // Baseline ending cash
  const baselineCash = trailingData.map(d => (parseFloat(d.close_today_bal) / 1000).toFixed(2));

  // Stressed trajectory: simulated cash balance assuming daily outflows were shocked
  let runningStressedCash = parseFloat(trailingData[0].open_today_bal);
  const stressedCashTrajectory = [];

  trailingData.forEach(d => {
    const inf = parseFloat(d.deposits_today);
    const shockedOut = parseFloat(d.withdrawals_today) * (1 + stressParameter);
    runningStressedCash = Math.max(0, runningStressedCash + inf - shockedOut);
    stressedCashTrajectory.push((runningStressedCash / 1000).toFixed(2));
  });

  if (charts.stressRunoff) charts.stressRunoff.destroy();

  charts.stressRunoff = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Baseline Actual TGA Balance ($B)',
          data: baselineCash,
          borderColor: '#3b82f6',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        },
        {
          label: `Stressed TGA Runoff (+${Math.round(stressParameter * 100)}%) ($B)`,
          data: stressedCashTrajectory,
          borderColor: '#ef4444',
          borderDash: [4, 4],
          borderWidth: 2.2,
          pointRadius: 0,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#cbd5e1', font: { size: 11 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y}B`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 7,
            callback: (v, idx) => formatDisplayDate(labels[idx])
          }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            callback: (v) => `$${v}B`
          }
        }
      }
    }
  });
}

// Clipboard Helper
function copySnippet(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText).then(() => {
    alert('Snippet copied to clipboard!');
  });
}
