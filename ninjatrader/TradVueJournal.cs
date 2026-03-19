// TradVue Auto-Journal for NinjaTrader 8  —  Indicator Edition
//
// Captures ALL account fills (manual, Chart Trader, ATM, SuperDOM, other strategies)
// and posts them to your TradVue webhook automatically.
//
// WHY INDICATOR (not Strategy):
//   A Strategy only sees its own orders via OnExecutionUpdate. Since TradVueJournal
//   never places orders, that event never fires. An Indicator can subscribe to
//   Account.ExecutionUpdate at the account level, which receives every fill from
//   every source — exactly what we need.
//
// INSTALLATION:
//   1. In NinjaTrader: Tools → Import → NinjaScript Add-On → select TradVueJournal.cs
//   2. After import, add the indicator to any chart:
//      Chart → right-click → Indicators → TradVueJournal
//   3. Set WebhookUrl to your TradVue URL (from the Integrations page)
//   4. Optionally set AccountName (leave blank to monitor ALL accounts)
//   5. Click OK — all fills auto-journal from this point on
//
// SECURITY:
//   - ONLY sends data (outbound HTTPS POST). Cannot place, modify, or cancel orders.
//   - Cannot access account balance or broker credentials.
//   - Only execution data (symbol, price, qty, direction, P&L) is transmitted.

#region Using declarations
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.Indicators;
#endregion

namespace NinjaTrader.NinjaScript.Indicators
{
    public class TradVueAutoJournal : Indicator
    {
        // ── HTTP ──────────────────────────────────────────────────────────────
        // Static HttpClient: shared across all indicator instances, never recreated.
        private static readonly HttpClient httpClient = new HttpClient();

        // ── Deduplication ─────────────────────────────────────────────────────
        // Static so it's shared across all chart instances running this indicator.
        // Prevents duplicate sends when the same execution fires on multiple charts.
        private static readonly HashSet<string> seenExecutionIds = new HashSet<string>();
        private static readonly object seenLock = new object();
        private const int MAX_SEEN_IDS = 2000;

        // ── Subscribed accounts ───────────────────────────────────────────────
        private readonly List<Account> subscribedAccounts = new List<Account>();

        // ── Position tracking (per instrument, per account) ───────────────────
        // Key = "accountName|instrumentName"
        // Value = net position: positive=long, negative=short, 0=flat
        private readonly Dictionary<string, int> positionMap = new Dictionary<string, int>();

        // ── FIFO lot queues for P&L calculation ───────────────────────────────
        // Key = "accountName|instrumentName"
        private readonly Dictionary<string, Queue<Lot>> longLots  = new Dictionary<string, Queue<Lot>>();
        private readonly Dictionary<string, Queue<Lot>> shortLots = new Dictionary<string, Queue<Lot>>();

        private struct Lot { public double Price; public int Qty; }

        // ─────────────────────────────────────────────────────────────────────
        // STATE MACHINE
        // ─────────────────────────────────────────────────────────────────────

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description  = "TradVue Auto-Journal — sends all account executions to TradVue automatically.";
                Name         = "TradVueAutoJournal";
                Calculate    = Calculate.OnBarClose;
                IsOverlay    = true;
                IsSuspendedWhileInactive = false;

                WebhookUrl  = "https://tradvue-api.onrender.com/api/webhook/nt/YOUR_TOKEN_HERE";
                AccountName = "";
                SendEntries = true;
                SendExits   = true;
                LogToOutput = true;
            }
            else if (State == State.DataLoaded)
            {
                SubscribeToAccounts();
            }
            else if (State == State.Historical)
            {
                // Fallback: if DataLoaded didn't find accounts yet, try again
                if (subscribedAccounts.Count == 0)
                    SubscribeToAccounts();
            }
            else if (State == State.Realtime)
            {
                // Final fallback: ensure subscription before live trading starts
                if (subscribedAccounts.Count == 0)
                    SubscribeToAccounts();
            }
            else if (State == State.Terminated)
            {
                UnsubscribeFromAccounts();
            }
        }

        private void SubscribeToAccounts()
        {
            lock (Account.All)
            {
                foreach (Account acct in Account.All)
                {
                    if (!string.IsNullOrWhiteSpace(AccountName) &&
                        !acct.Name.Equals(AccountName, StringComparison.OrdinalIgnoreCase))
                        continue;

                    acct.ExecutionUpdate += OnAccountExecutionUpdate;
                    subscribedAccounts.Add(acct);

                    if (LogToOutput)
                        Print("[TradVue] Subscribed to account: " + acct.Name);
                }
            }

            if (LogToOutput && subscribedAccounts.Count == 0)
                Print("[TradVue] WARNING: No accounts found. Check AccountName setting.");
        }

        private void UnsubscribeFromAccounts()
        {
            foreach (Account acct in subscribedAccounts)
            {
                try { acct.ExecutionUpdate -= OnAccountExecutionUpdate; }
                catch { }
            }
            subscribedAccounts.Clear();

            if (LogToOutput)
                Print("[TradVue] Unsubscribed from all accounts.");
        }

        // ─────────────────────────────────────────────────────────────────────
        // BAR UPDATE (no-op)
        // ─────────────────────────────────────────────────────────────────────

        protected override void OnBarUpdate() { }

        // ─────────────────────────────────────────────────────────────────────
        // EXECUTION EVENT HANDLER
        // ─────────────────────────────────────────────────────────────────────

        private void OnAccountExecutionUpdate(object sender, ExecutionEventArgs e)
        {
            try
            {
                Execution exec = e.Execution;
                if (exec == null || exec.Instrument == null) return;

                // ── Deduplication ──────────────────────────────────────────
                string execId = exec.ExecutionId ?? "";
                if (!string.IsNullOrEmpty(execId))
                {
                    lock (seenLock)
                    {
                        if (seenExecutionIds.Contains(execId)) return;
                        seenExecutionIds.Add(execId);
                        if (seenExecutionIds.Count > MAX_SEEN_IDS)
                        {
                            var oldest = seenExecutionIds.Take(MAX_SEEN_IDS / 2).ToList();
                            foreach (var id in oldest) seenExecutionIds.Remove(id);
                        }
                    }
                }

                // ── Execution data ─────────────────────────────────────────
                string accountName = exec.Account != null ? exec.Account.Name : "Unknown";
                string symbol      = exec.Instrument.MasterInstrument.Name;
                string posKey      = accountName + "|" + symbol;
                double fillPrice   = exec.Price;
                int    fillQty     = exec.Quantity;
                bool   isBuy       = (exec.MarketPosition == MarketPosition.Long);

                // ── Asset class & point value ──────────────────────────────
                InstrumentType instType  = exec.Instrument.MasterInstrument.InstrumentType;
                string         assetClass = "Stock";
                double         pointValue = 1.0;

                if (instType == InstrumentType.Future)
                {
                    assetClass = "Futures";
                    pointValue = exec.Instrument.MasterInstrument.PointValue;
                    if (pointValue <= 0) pointValue = 1.0;
                }
                else if (instType == InstrumentType.Forex)
                {
                    assetClass = "Forex";
                }

                // ── Position state before this fill ───────────────────────
                int prevPosition = positionMap.ContainsKey(posKey) ? positionMap[posKey] : 0;
                int posChange    = isBuy ? fillQty : -fillQty;
                int newPosition  = prevPosition + posChange;
                positionMap[posKey] = newPosition;

                string orderId = exec.OrderId ?? execId;

                // ── Reversal: crossing zero ────────────────────────────────
                bool isReversal = (prevPosition != 0) && (newPosition != 0) &&
                                  ((prevPosition > 0) != (newPosition > 0));

                if (isReversal)
                {
                    int  closeQty = Math.Abs(prevPosition);
                    int  openQty  = Math.Abs(newPosition);
                    bool wasLong  = prevPosition > 0;
                    bool nowLong  = newPosition > 0;

                    // Exit old side
                    double pnl     = CalculatePnl(posKey, fillPrice, closeQty, wasLong, pointValue);
                    double avgEntry = GetAverageLotPrice(posKey, wasLong);
                    if (SendExits)
                    {
                        string dir     = wasLong ? "Long" : "Short";
                        string payload = BuildPayload(symbol, "exit", dir,
                            fillPrice, avgEntry, fillPrice,
                            closeQty, pnl, assetClass, orderId, exec.Time);
                        SendAsync(payload, symbol, "exit", dir, fillPrice, closeQty);
                    }

                    // Entry new side
                    string entryDir = nowLong ? "Long" : "Short";
                    AddLot(posKey, fillPrice, openQty, nowLong);
                    if (SendEntries)
                    {
                        string payload = BuildPayload(symbol, "entry", entryDir,
                            fillPrice, fillPrice, 0,
                            openQty, 0, assetClass, orderId, exec.Time);
                        SendAsync(payload, symbol, "entry", entryDir, fillPrice, openQty);
                    }
                    return;
                }

                // ── Entry (flat→position OR adding to same-direction position) ─
                bool isEntry = (prevPosition == 0) ||
                               (prevPosition > 0 && isBuy) ||
                               (prevPosition < 0 && !isBuy);

                if (isEntry)
                {
                    AddLot(posKey, fillPrice, fillQty, isBuy);
                    if (SendEntries)
                    {
                        string dir     = isBuy ? "Long" : "Short";
                        string payload = BuildPayload(symbol, "entry", dir,
                            fillPrice, fillPrice, 0,
                            fillQty, 0, assetClass, orderId, exec.Time);
                        SendAsync(payload, symbol, "entry", dir, fillPrice, fillQty);
                    }
                    return;
                }

                // ── Exit (reducing or closing existing position) ──────────
                {
                    bool   closingLong = prevPosition > 0;
                    double avgEntry    = GetAverageLotPrice(posKey, closingLong);
                    double pnl         = CalculatePnl(posKey, fillPrice, fillQty, closingLong, pointValue);
                    if (SendExits)
                    {
                        string dir     = closingLong ? "Long" : "Short";
                        string payload = BuildPayload(symbol, "exit", dir,
                            fillPrice, avgEntry, fillPrice,
                            fillQty, pnl, assetClass, orderId, exec.Time);
                        SendAsync(payload, symbol, "exit", dir, fillPrice, fillQty);
                    }
                }
            }
            catch (Exception ex)
            {
                if (LogToOutput)
                    Print("[TradVue] Error in execution handler: " + ex.Message);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // FIFO LOT MATCHING
        // ─────────────────────────────────────────────────────────────────────

        private void AddLot(string posKey, double price, int qty, bool isLong)
        {
            var dict = isLong ? longLots : shortLots;
            if (!dict.ContainsKey(posKey))
                dict[posKey] = new Queue<Lot>();
            dict[posKey].Enqueue(new Lot { Price = price, Qty = qty });
        }

        private double CalculatePnl(string posKey, double exitPrice, int exitQty,
                                     bool closingLong, double pointValue)
        {
            var dict = closingLong ? longLots : shortLots;
            if (!dict.ContainsKey(posKey)) return 0;

            Queue<Lot> queue    = dict[posKey];
            double     totalPnl = 0;
            int        remaining = exitQty;

            while (remaining > 0 && queue.Count > 0)
            {
                Lot lot     = queue.Dequeue();
                int matched = Math.Min(lot.Qty, remaining);

                double diff = closingLong
                    ? (exitPrice - lot.Price)
                    : (lot.Price - exitPrice);

                totalPnl  += diff * matched * pointValue;
                remaining -= matched;

                if (lot.Qty > matched)
                {
                    // Put the remainder back at the front
                    var newQueue = new Queue<Lot>();
                    newQueue.Enqueue(new Lot { Price = lot.Price, Qty = lot.Qty - matched });
                    while (queue.Count > 0) newQueue.Enqueue(queue.Dequeue());
                    dict[posKey] = newQueue;
                    break;
                }
            }

            return Math.Round(totalPnl, 2);
        }

        private double GetAverageLotPrice(string posKey, bool isLong)
        {
            var dict = isLong ? longLots : shortLots;
            if (!dict.ContainsKey(posKey) || dict[posKey].Count == 0) return 0;

            double totalCost = 0;
            int    totalQty  = 0;
            foreach (Lot lot in dict[posKey])
            {
                totalCost += lot.Price * lot.Qty;
                totalQty  += lot.Qty;
            }
            return totalQty > 0 ? totalCost / totalQty : 0;
        }

        // ─────────────────────────────────────────────────────────────────────
        // JSON PAYLOAD BUILDER
        // ─────────────────────────────────────────────────────────────────────

        private string BuildPayload(string symbol, string action, string direction,
            double price, double entryPrice, double exitPrice,
            int qty, double pnl, string assetClass, string orderId, DateTime time)
        {
            return string.Format(
                "{{" +
                "\"ticker\":\"{0}\"," +
                "\"action\":\"{1}\"," +
                "\"direction\":\"{2}\"," +
                "\"price\":{3}," +
                "\"entry_price\":{4}," +
                "\"exit_price\":{5}," +
                "\"qty\":{6}," +
                "\"pnl\":{7}," +
                "\"asset_class\":\"{8}\"," +
                "\"order_id\":\"{9}\"," +
                "\"time\":\"{10}\"," +
                "\"source\":\"ninjatrader\"" +
                "}}",
                EscapeJson(symbol),
                action,
                direction,
                price.ToString("F4"),
                entryPrice.ToString("F4"),
                exitPrice.ToString("F4"),
                qty,
                pnl.ToString("F2"),
                assetClass,
                EscapeJson(orderId),
                time.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            );
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        // ─────────────────────────────────────────────────────────────────────
        // ASYNC HTTP SEND
        // ─────────────────────────────────────────────────────────────────────

        private async void SendAsync(string json, string symbol, string action,
                                     string direction, double price, int qty)
        {
            try
            {
                var content  = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(WebhookUrl, content);

                if (LogToOutput)
                {
                    if (response.IsSuccessStatusCode)
                        Print(string.Format("[TradVue] {0} {1} {2} {3}x @ {4:F2} — sent OK",
                            action.ToUpper(), direction, symbol, qty, price));
                    else
                    {
                        string body = await response.Content.ReadAsStringAsync();
                        Print(string.Format("[TradVue] HTTP {0}: {1}",
                            (int)response.StatusCode, body));
                    }
                }
            }
            catch (Exception ex)
            {
                if (LogToOutput)
                    Print("[TradVue] Send failed: " + ex.Message);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // PROPERTIES
        // ─────────────────────────────────────────────────────────────────────

        #region Properties

        [NinjaScriptProperty]
        [Display(Name = "Webhook URL",
            Description = "Your TradVue webhook URL from the Integrations page. Replace YOUR_TOKEN_HERE with your token.",
            Order = 1, GroupName = "TradVue Settings")]
        public string WebhookUrl { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Account Name",
            Description = "Account to monitor. Leave blank to monitor ALL accounts. Example: Sim101",
            Order = 2, GroupName = "TradVue Settings")]
        public string AccountName { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Send Entries",
            Description = "Send entry fills to TradVue.",
            Order = 3, GroupName = "TradVue Settings")]
        public bool SendEntries { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Send Exits",
            Description = "Send exit fills (with P&L) to TradVue.",
            Order = 4, GroupName = "TradVue Settings")]
        public bool SendExits { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Log to Output",
            Description = "Print confirmations in the NinjaTrader Output window.",
            Order = 5, GroupName = "TradVue Settings")]
        public bool LogToOutput { get; set; }

        #endregion
    }
}
