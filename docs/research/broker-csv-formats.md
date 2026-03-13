# Broker CSV Export Formats - Research Documentation

A comprehensive guide to the exact CSV export formats from 8 major brokers, designed to help developers build consistent transaction parsers.

---

## 1. Robinhood

### Export Location & Method
**Critical:** Robinhood **does NOT provide a native CSV export** from the web/app interface. Users must use one of these methods:
- **Reports & Statements (Built-in):** Menu → Reports and Statements → Reports → Generate New Report (takes 2-24 hours to generate)
- **Contact Robinhood:** Use https://robinhood.com/contact to request a spreadsheet of transactions (gets emailed within 1-2 days)
- **Third-party API wrappers:** Python libraries like `robinhood-to-csv` use unofficial Robinhood APIs to extract transaction data

### CSV Format (if available)
| Column | Format | Notes |
|--------|--------|-------|
| Date | MM/DD/YYYY | Transaction date |
| Symbol | Ticker (e.g., AAPL) | Stock symbol |
| Side | BUY / SELL | Transaction direction |
| Quantity | Decimal | Number of shares |
| Price | $X.XX | Per-share price |
| Amount | $X.XX | Total transaction value |

### Key Gotchas
- **No direct in-app export:** Users must explicitly request data via the API or contact support
- **Limited transaction types:** Primarily stocks, limited options support
- **Date format:** MM/DD/YYYY (US standard)
- **Common workaround:** Many users rely on third-party Google Sheets extensions or Python scripts

---

## 2. Fidelity

### Export Location & Method
1. Log in to **Fidelity.com**
2. Navigate to **Accounts & Trade → Account Activity** (or Portfolio)
3. Click the **History** tab
4. Select date range
5. Click **Download** → Choose **CSV format**
6. Save to computer

### CSV Format
**Header:** `Run Date,Account,Action,Symbol,Description,Type,Quantity,Price,Commission,Fees,Amount`

| Column | Format | Notes |
|--------|--------|-------|
| Run Date | MM/DD/YYYY | Report generation date |
| Account | Account identifier | Account number or name |
| Action | BUY / SELL / DIVIDEND / etc. | Transaction type |
| Symbol | Ticker (e.g., FCNTX) | Stock or fund symbol |
| Description | Text | Full security name |
| Type | CASH / EQUITY / FUND / etc. | Asset class |
| Quantity | Decimal (e.g., 25) | Number of shares/units |
| Price ($) | $X.XX or blank for dividends | Per-unit price |
| Commission ($) | $X.XX or blank | Trading commission |
| Fees ($) | $X.XX or blank | Additional fees |
| Amount ($) | $X.XX | Net transaction amount |
| Cash Balance ($) | $X.XX (optional) | Account cash after trade |
| Settlement Date | MM/DD/YYYY (optional) | Settlement date |

### Sample Row
```
11/10/2025,Account123,BUY,AAPL,APPLE INC,EQUITY,100,150.25,9.99,0.00,-15034.99
```

### Key Gotchas
- **90-day limit per download:** Each download limited to 90 days. For full year, need 4-5 separate downloads
- **Multiple asset types:** Handles stocks, mutual funds (5-letter tickers ending in X), ETFs
- **Fractional shares:** Full precision supported
- **Date format:** MM/DD/YYYY (US standard)
- **Import-friendly:** AllInvestView, TradeLog, and most platforms recognize Fidelity format automatically

---

## 3. Charles Schwab (including TD Ameritrade Migration)

### Export Location & Method
**Web-based export:**
1. Log in to **www.schwab.com**
2. Navigate to **Accounts → History**
3. Select account from dropdown
4. Choose **Custom Date Range**
5. Click **Search**
6. Click **Export** (right side)
7. Select **CSV format**
8. Click **Export** again to download

**Note:** StreetSmart Edge (desktop) also supports CSV export via right-click within Transactions display or Actions menu.

### CSV Format
**Header:** `Transactions for account XXXX-9999 as of 06/17/2018 14:50:44 ET From 01/01/2018 to 06/17/2018` (metadata line)  
**Actual headers:** `Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount`

| Column | Format | Notes |
|--------|--------|-------|
| Date | MM/DD/YYYY | Transaction date |
| Action | BUY / SELL / DIVIDEND / etc. | Transaction type |
| Symbol | Ticker (e.g., AAPL) | Stock/ETF symbol |
| Description | Text | Security name |
| Quantity | Decimal | Shares traded |
| Price | $X.XX | Per-share price |
| Fees & Comm | $X.XX | Combined fees and commissions |
| Amount | $X.XX | Net transaction amount |

### Sample Row
```
06/15/2018,BUY,AAPL,APPLE INC,100,150.25,9.99,-15034.99
```

### Key Gotchas
- **10,000 record limit:** Schwab caps downloads at 10,000 records per export
- **TD Ameritrade accounts:** Post-merger (2024), TD Ameritrade accounts migrated to Schwab must be exported via Schwab interface (TDA legacy interface no longer provides exports)
- **For migrated accounts:** In TradeLog/similar tools, change Import Filter to "Charles Schwab" instead of "TD Ameritrade"
- **Date format:** MM/DD/YYYY (US standard)
- **No timestamp:** Only date (not time), so cannot reliably detect duplicates if multiple trades same day

---

## 4. Webull

### Export Location & Method
1. Log into **Webull account** (web)
2. Click **More** (or account menu)
3. Scroll to **Account section** → Select **History**
4. Dropdown menu → Select **Orders Records**
5. Click **Download** button (top right)
6. Receives **4 CSV files** in a zip (one per quarter or transaction type)

### CSV Format
**Header:** `Date,Symbol,Side,Quantity,Price,Amount`

| Column | Format | Notes |
|--------|--------|-------|
| Date | YYYY-MM-DD | Transaction date |
| Symbol | Ticker (e.g., AAPL) | Stock symbol |
| Side | BUY / SELL | Transaction direction |
| Quantity | Decimal | Number of shares |
| Price | $X.XX | Per-share price |
| Amount | $X.XX | Total transaction value |

### Sample Row
```
2024-01-15,AAPL,BUY,10,150.00,1500.00
```

### Key Gotchas
- **Multiple files:** Download produces 4 separate CSV files (quarterly breakdown)
- **Date format:** YYYY-MM-DD (ISO 8601)
- **No commission/fees column:** Amount is net of fees
- **Omnibus account limitation:** Some Webull accounts (newer omnibus clearing) cannot export trade history (broker limitation)
- **Simulated vs. real:** Can only export simulated portfolio history; live trading history export limitations apply
- **Options support:** Limited; primarily stocks

---

## 5. Tastytrade

### Export Location & Method
1. Log into **tastytrade platform**
2. Navigate to **History tab** (bottom of app)
3. Select time frame (Today, This Week, This Month, Year-to-Date, or Custom date range)
4. Ensure all transactions are loaded (scroll if needed)
5. Click **CSV button** in upper right corner
6. File downloads automatically

### CSV Format
**Header:** `Date/Time,Transaction Code,Transaction Subcode,Symbol,Buy/Sell,Open/Close,Quantity,Expiration Date,Strike,Call/Put,Price,Fees,Amount,Description,Account Reference`

| Column | Format | Notes |
|--------|--------|-------|
| Date/Time | MM/DD/YYYY HH:MM:SS | Timestamp of transaction |
| Transaction Code | Text (e.g., TradeCode) | High-level transaction type |
| Transaction Subcode | Text | Specific transaction subtype |
| Symbol | Ticker (e.g., AAPL, SPY) | Underlying symbol |
| Buy/Sell | BUY / SELL | Direction |
| Open/Close | OPEN / CLOSE | Position action |
| Quantity | Decimal | Number of contracts/shares |
| Expiration Date | MM/DD/YYYY or blank | For options only |
| Strike | Decimal or blank | Strike price for options |
| Call/Put | CALL / PUT / blank | Option type |
| Price | $X.XX | Per-contract or per-share price |
| Fees | $X.XX | Transaction fees |
| Amount | $X.XX | Net amount |
| Description | Text | Human-readable description |
| Account Reference | Account ID | Account identifier |

### Sample Row (Stock)
```
01/15/2024 14:30:00,TRA,BUY,AAPL,BUY,OPEN,100,,,,$150.25,$5.00,-15030.00,BUY 100 AAPL,Acct123
```

### Sample Row (Option)
```
01/15/2024 14:32:00,TRA,BUY,SPY,BUY,OPEN,5,02/16/2024,420,CALL,$2.50,$3.00,-1253.00,BUY 5 SPY 02/16/2024 420 CALL,Acct123
```

### Key Gotchas
- **One year per download:** Can export maximum 1 year at a time; multi-year requires multiple exports
- **Must load all transactions:** Unloaded/scrolled-off transactions may not be included
- **Complex transaction types:** Handles stocks, options, spreads; each row represents one leg or transaction
- **Date format:** MM/DD/YYYY HH:MM:SS
- **Options-friendly:** Full support for multi-leg options strategies
- **Smart for tax reporting:** Columns specifically designed for tax calculation

---

## 6. E*TRADE

### Export Location & Method
1. Log in to **E*TRADE** account
2. Navigate to **Accounts tab** → **Transactions**
3. From **Time Period dropdown**, select **Custom**
4. Enter **From** and **To dates**
5. Click **Apply** or **Search**
6. Click **Download** button (icon in upper right)
7. File downloads as CSV

### CSV Format
**Header:** `Date,Transaction #,Action,Quantity,Symbol,Description,Price,Commission & Fees,Amount`

| Column | Format | Notes |
|--------|--------|-------|
| Date | MM/DD/YYYY | Transaction date |
| Transaction # | Transaction ID | Unique identifier |
| Action | BUY / SELL / DIVIDEND / etc. | Transaction type |
| Quantity | Decimal | Shares traded |
| Symbol | Ticker (e.g., AAPL) | Stock/ETF symbol |
| Description | Text | Security name |
| Price | $X.XX | Per-share price |
| Commission & Fees | $X.XX | Combined costs |
| Amount | $X.XX | Net transaction amount |

### Sample Row
```
06/15/2024,TXN123456,BUY,100,AAPL,APPLE INC,150.25,9.99,-15034.99
```

### Key Gotchas
- **Recent Morgan Stanley merger:** E*TRADE merged with Morgan Stanley (Feb 2026). Legacy format is different from new format
- **New format post-2026:** Different column structure post-merger; must verify with updated E*TRADE docs
- **High-volume accounts:** E*TRADE recommends downloading smaller date ranges for very high-volume accounts
- **Date format:** MM/DD/YYYY (US standard)
- **Limited timestamp:** No intraday time, only date
- **Tax reports available:** Can also export via Tax Records section with Excel export option

---

## 7. Interactive Brokers (IBKR)

### Export Location & Method
**Flex Query (Recommended - XML/CSV export):**
1. Log into **Client Portal** (https://www.interactivebrokers.co.uk/sso/Login)
2. Click **Performance & Reports → Flex Queries**
3. Click **"+" (plus)** to create new query in "Activity Flex Query" section
4. Give query a name (e.g., "Export")
5. Click **"Cash Transactions"** section → Check **"Select All"** → Save
6. Repeat for: Corporate Actions, Financial Instrument Info, Trades, Transfer Fees, Transfers (or as needed)
7. In **General Configuration**, set:
   - **Date format:** `yyyyMMdd`
   - **Time format:** `HHmmss`
   - **Date/Time separator:** `;` (semicolon)
8. Click **Continue** → **Create** → **OK**
9. Select all accounts (if multiple or migrated accounts)
10. Click arrow next to query → Choose period → Keep **XML format** → Click **Run**
11. Download XML file; use tool like Simple Portfolio to convert to CSV

**Activity Statement (Simple but less flexible):**
1. **Reports tab** → **Activity Statement**
2. Select date range
3. Download as statement (PDF or export as HTML/CSV where available)

### CSV Format (Post-Flex Query Conversion)
**When converted to CSV via Simple Portfolio or similar tool:**
**Header:** `Date,Symbol,Quantity,Price,Action,Commission,Side`

| Column | Format | Notes |
|--------|--------|-------|
| Date | YYYYMMDD | Trade date (from Flex config) |
| Time | HHmmss | Trade time (semicolon separator if combined) |
| Symbol | Ticker (e.g., AAPL) | Underlying symbol |
| Quantity | Decimal | Shares/contracts traded |
| Price | $X.XX | Execution price |
| Action | BUY / SELL | Transaction direction |
| Asset Class | EQUITY / OPTION / FUTURE | Asset type |
| Exchange | Exchange code | Where traded |
| Commission | $X.XX | Trade commission |
| Fees | $X.XX | Additional fees |
| Net | $X.XX | Net amount |

### Key Gotchas
- **No native CSV:** IBKR's native export is **XML only** (not CSV). Conversion requires third-party tool
- **Flex Queries complex:** Requires separate Flex Query setup; not user-friendly for non-technical users
- **One year at a time:** Can export maximum 1 year per query; multi-year requires separate runs
- **Date format in XML:** `yyyyMMdd` (configurable; defaults to specific format)
- **Multiple sections:** Must export Trades, Cash Transactions, Transfers, etc. separately; harder to consolidate
- **Best workaround:** Use Simple Portfolio, TradeZella, or similar platform that auto-converts IBKR XML to CSV
- **Options support:** Full support (calls, puts, spreads)
- **Complex for beginners:** IBKR export is most technical of all brokers; recommend automated sync services

---

## 8. TradeStation

### Export Location & Method
1. Log into **TradeStation web client** (https://clientcenter.tradestation.com)
2. Click **Accounts** in header
3. Click **Equities Accounts** (left panel)
4. Select **Tax Center** from dropdown under Equities Accounts
5. Under **Download Tax Activity** section:
   - Select **File Format:** Microsoft Excel (CSV)
   - Choose **date range** (max 6 months per download)
   - Check **"Exclude Broken/Canceled Trades"**
6. Click **Download**

### CSV Format
**Header:** `Account Number,Type,TradeInd,Transaction,Quantity,Cusip,ADP,Symbol,CallPut,Underlying Symbol,Expiration Date,Strike Price,TD,SD,Activity,Date,Price,Amount,Currency Code,Commission,Description,Activity,Time,Order ID`

| Column | Format | Notes |
|--------|--------|-------|
| Account Number | Account ID | Trading account |
| Type | EQUITY / OPTION | Asset type |
| TradeInd | Trade indicator | Trade/corporate action indicator |
| Transaction | Transaction type | BUY / SELL / ASSIGNMENT / etc. |
| Quantity | Decimal | Shares/contracts |
| Cusip | CUSIP code | Security identifier |
| ADP | ADP code | TradeStation identifier |
| Symbol | Ticker (e.g., AAPL) | Stock symbol |
| CallPut | CALL / PUT / blank | Option type |
| Underlying Symbol | Ticker | Underlying for options |
| Expiration Date | YYYYMMDD | Option expiration (if applicable) |
| Strike Price | Decimal | Strike (if option) |
| TD | Trade Date | Date traded |
| SD | Settlement Date | Settlement date |
| Activity | Activity code | Type of activity |
| Date | YYYYMMDD | Trade date (formatted) |
| Price | $X.XX | Execution price |
| Amount | $X.XX | Transaction amount |
| Currency Code | USD / etc. | Currency |
| Commission | $X.XX | Trading commission |
| Description | Text | Trade description |
| Time | HH:MM:SS | Time of trade |
| Order ID | Order ID | Unique order identifier |

### Sample Row (Stock)
```
TS-123456,EQUITY,T,BUY,100,037833100,12345,AAPL,,,,,20240115,20240115,TRA,20240115,150.25,-15030.00,USD,0.00,BUY 100 AAPL,14:30:00,ORD123456
```

### Key Gotchas
- **6-month limit:** Can only download 6 months at a time. For full year, need 2 downloads
- **Stock and option trades only:** Futures not supported in file upload method
- **Multiple date columns:** Contains both "Date" and "TD/SD" (confusing but both present)
- **Date format mixed:** Some columns use YYYYMMDD, others use different formats
- **Commission handling:** All commissions show in single column
- **Rich option support:** Full multi-leg options support (calls, puts, spreads)
- **Import-friendly:** TradeZella and other platforms have dedicated TradeStation importers

---

## Comparison Table: Key Features

| Broker | Export Method | CSV Native? | Date Format | Buy/Sell Field | Commissions | Options | Options Quirks | Limit/Gotchas |
|--------|---------------|-------------|-------------|-----------------|-------------|---------|----------------|----------------|
| **Robinhood** | Contact support / API | ❌ No | MM/DD/YYYY | Side | Included | Limited | No multi-leg | No in-app export |
| **Fidelity** | Account Activity > Download | ✅ Yes | MM/DD/YYYY | Action | Separate | ✅ | Full support | 90-day max per download |
| **Charles Schwab** | Accounts > History > Export | ✅ Yes | MM/DD/YYYY | Action | Separate | ✅ | Full support | 10k record limit, no time |
| **Webull** | Account > History > Download | ✅ Yes (4 files) | YYYY-MM-DD | Side | Included | Limited | Stocks primary | Omnibus accts may fail |
| **Tastytrade** | History > CSV button | ✅ Yes | MM/DD/YYYY HH:MM:SS | Buy/Sell | Separate | ✅ | Full multi-leg | 1 year per export |
| **E*TRADE** | Accounts > Transactions > Download | ✅ Yes | MM/DD/YYYY | Action | Separate | ✅ | Full support | Morgan Stanley merger (2026) |
| **Interactive Brokers** | Flex Query > XML (convert) | ❌ XML only | yyyyMMdd | Buy/Sell | Separate | ✅ | Full support | Complex setup, 1 yr max |
| **TradeStation** | Tax Center > Download | ✅ Yes | YYYYMMDD mix | Transaction | Separate | ✅ | Full support | 6-month max per download |

---

## Developer Notes & Recommendations

### 1. Date Handling
- **US brokers:** Primarily MM/DD/YYYY (Robinhood, Fidelity, Schwab, Tastytrade, E*TRADE)
- **ISO standard:** YYYY-MM-DD (Webull)
- **Compact format:** YYYYMMDD (TradeStation, Interactive Brokers)
- **Recommendation:** Parse all formats using flexible date parser; normalize to ISO 8601 internally

### 2. Buy/Sell Representation
- **Standard:** `BUY` / `SELL` (majority of brokers)
- **Field names vary:** Some use "Action", some use "Side", some use "Buy/Sell"
- **Options quirk:** Tastytrade uses "Buy/Sell" + "Open/Close" for options
- **Recommendation:** Normalize to `BUY` / `SELL` regardless of source field name

### 3. Commission/Fee Handling
- **Separate columns:** Fidelity (Commission, Fees), Schwab (Fees & Comm), Tastytrade (Fees), E*TRADE (Commission & Fees)
- **Included in Amount:** Robinhood, Webull
- **Multiple columns:** Interactive Brokers, TradeStation (Commission, Fees, Net separately)
- **Recommendation:** Always extract commissions/fees separately; store amount pre-commission and post-commission

### 4. Options Handling
- **Simple support:** Robinhood, Webull (limited; mostly stocks)
- **Full support:** Fidelity, Schwab, Tastytrade, E*TRADE, Interactive Brokers, TradeStation
- **Multi-leg quirks:** Each leg may be separate row (Tastytrade) or combined (TradeStation)
- **Recommendation:** Build separate parser path for options; handle expiration dates and strike prices

### 5. Account Identifiers
- **Field name varies:** "Account", "Account Number", "Account Reference"
- **Some optional:** Webull doesn't always include; Interactive Brokers requires it
- **Recommendation:** Track account ID; some users may have multiple trading accounts at same broker

### 6. Splitting Multi-Year Exports
Several brokers limit exports to specific time windows:
- **Fidelity:** 90 days max → Need 4-5 downloads per year
- **Tastytrade:** 1 year max → Need separate requests per year
- **Interactive Brokers:** 1 year max → Need separate Flex Query runs
- **TradeStation:** 6 months max → Need 2 downloads per year
- **Recommendation:** Build smart downloader that auto-chunks date ranges and concatenates results

### 7. Validation & Error Handling
- **No universal columns:** Each broker has unique column names and ordering
- **File encoding:** Usually UTF-8, but verify for special characters (currency symbols, etc.)
- **Empty rows:** Some exports may include blank rows or headers; trim appropriately
- **Recommendation:** Build broker-specific validators; always check column count and required fields

### 8. Platform-Specific Quirks
- **Robinhood:** Most restrictive; no native export. Users either wait 2 days for support email or hack via API
- **Interactive Brokers:** Most technical; requires understanding of Flex Queries and XML conversion
- **TradeStation:** 6-month window is tight; useful for recent history but painful for full historical exports
- **Schwab:** 10k record limit is reasonable for most retail traders but matters for high-volume accounts

---

## Testing Recommendations

When building parsers:

1. **Test with real exports** from each broker (or get from traders with accounts)
2. **Test edge cases:**
   - Dividends and corporate actions
   - Cancelled/reversed trades
   - Options expiration/assignment
   - Account transfers
   - Multi-currency trades (where applicable)
3. **Validate date parsing** across all formats
4. **Test amount calculation:** Verify commission deductions are applied correctly
5. **Test symbol recognition:** Ensure mutual fund tickers (e.g., FCNTX), options symbols parsed correctly
6. **Round-trip test:** Export from broker, parse, re-generate CSV, verify match

---

## Reference Links

- **Fidelity:** https://www.allinvestview.com/how-to-import/fidelity/
- **Charles Schwab:** https://help.wingmantracker.com/article/3206-charles-schwab-trades-csv-instructions
- **Webull:** https://www.pocketportfolio.app/import/webull
- **Tastytrade:** https://traderlog.io/how-to-export-trade-history-on-tastytrade/
- **E*TRADE:** https://help.wingmantracker.com/article/3201-etrade-trades-csv-instructions
- **Interactive Brokers:** https://simpleportfolio.app/guides/interactive-brokers-export/
- **TradeStation:** https://help.tradezella.com/en/articles/6045045-tradestation-how-to-import-trades-from-tradestation-into-tradezella-using-the-file-upload-method
- **Robinhood:** https://traderfyles.helpscoutdocs.com/article/17-how-to-export-trade-history-from-robinhood

---

**Document Version:** 1.0  
**Last Updated:** March 13, 2026  
**Research Completed By:** Zip (ApexLogics Subagent)  
**Status:** Ready for developer implementation
