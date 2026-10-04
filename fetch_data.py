import urllib.request
import json
import csv
import ssl
import sys

def fetch_treasury_liquidity(pagesize=2000, output_csv="Fact_DailyLiquidity.csv"):
    """
    Fetches real-world Treasury Operating Cash Balance data from the 
    U.S. Department of the Treasury Fiscal Data API, pivots line items 
    (Opening Balance, Deposits, Withdrawals, Closing Balance) into daily facts.
    """
    url = f"https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]={pagesize}"
    print(f"Connecting to live U.S. Treasury API: {url}...")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )

    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            payload = json.loads(response.read().decode('utf-8'))
            records = payload.get('data', [])
            print(f"Retrieved {len(records)} raw data records from Fiscal Data API.")
    except Exception as e:
        print(f"Error fetching data from API: {e}")
        sys.exit(1)

    records_by_date = {}
    for r in records:
        d = r.get('record_date')
        if not d:
            continue
        if d not in records_by_date:
            records_by_date[d] = {
                'record_date': d,
                'open_today_bal': 0.0,
                'deposits_today': 0.0,
                'withdrawals_today': 0.0,
                'close_today_bal': 0.0
            }
        act = r.get('account_type', '')
        val_str = r.get('open_today_bal')
        val = float(val_str) if (val_str and val_str != 'null') else 0.0

        if act == 'Treasury General Account (TGA) Opening Balance':
            records_by_date[d]['open_today_bal'] = val
        elif act == 'Total TGA Deposits (Table II)':
            records_by_date[d]['deposits_today'] = val
        elif act == 'Total TGA Withdrawals (Table II) (-)':
            records_by_date[d]['withdrawals_today'] = val
        elif act == 'Treasury General Account (TGA) Closing Balance':
            records_by_date[d]['close_today_bal'] = val

    # Sort chronologically
    sorted_rows = sorted(records_by_date.values(), key=lambda x: x['record_date'])
    print(f"Consolidated into {len(sorted_rows)} daily liquidity observation rows.")

    with open(output_csv, 'w', newline='') as f:
        fieldnames = ['record_date', 'open_today_bal', 'deposits_today', 'withdrawals_today', 'close_today_bal']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sorted_rows)

    print(f"Successfully generated '{output_csv}' ready for Power BI or Web Dashboard!")

if __name__ == "__main__":
    fetch_treasury_liquidity()
