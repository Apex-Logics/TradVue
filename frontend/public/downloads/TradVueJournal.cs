// TradVue Auto-Journal for NinjaTrader 8
// 
// This strategy addon sends ALL real trade executions on your account to TradVue.
// It subscribes to account-level execution events, so it captures every fill —
// whether from Chart Trader, manual orders, other strategies, or DOM.
//
// Installation:
//   1. Copy this file to: Documents\NinjaTrader 8\bin\Custom\Strategies\
//   2. Open NinjaScript Editor → Compile (F5)
//   3. Add "TradVueJournal" strategy to any chart
//   4. Set the WebhookUrl parameter to your TradVue webhook URL
//   5. Enable the strategy — ALL account fills auto-journal from this point
//
// Security:
//   - This addon ONLY SENDS data (outbound HTTP POST)
//   - It CANNOT place, modify, or cancel any orders
//   - It CANNOT access your account balance or broker credentials
//   - It reads only execution data that NinjaTrader provides on fills
//
// Data sent per execution:
//   - Symbol, price, quantity, direction (Long/Short), time
//   - Order ID (for matching entries to exits)
//   - NO account numbers, NO credentials, NO balance info

#region Using declarations
using System;
using System.Net.Http;
using System.Text;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.Strategies;
#endregion

namespace NinjaTrader.NinjaScript.Strategies
{
    public class TradVueJournal : Strategy
    {
        private static readonly HttpClient httpClient = new HttpClient();
        private Account acct;
        
        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "TradVue Auto-Journal — sends ALL account trade executions to your TradVue account";
                Name = "TradVueJournal";
                Calculate = Calculate.OnBarClose;
                IsOverlay = true;
                
                // User-configurable parameters
                WebhookUrl = "https://tradvue-api.onrender.com/api/webhook/nt/YOUR_TOKEN_HERE";
                SendEntries = true;
                SendExits = true;
                LogToOutput = true;
            }
            else if (State == State.DataLoaded)
            {
                // Subscribe to account-level execution events
                // This captures ALL fills on the account, not just this strategy's orders
                if (Account != null)
                {
                    acct = Account;
                    acct.ExecutionUpdate += OnAccountExecutionUpdate;
                    
                    if (LogToOutput)
                        Print("[TradVue] Subscribed to account execution updates for: " + acct.Name);
                }
            }
            else if (State == State.Terminated)
            {
                // Unsubscribe to prevent memory leaks
                if (acct != null)
                {
                    acct.ExecutionUpdate -= OnAccountExecutionUpdate;
                    
                    if (LogToOutput)
                        Print("[TradVue] Unsubscribed from account execution updates");
                }
            }
        }
        
        protected override void OnBarUpdate()
        {
            // No bar processing needed — we listen to account events only
        }
        
        private void OnAccountExecutionUpdate(object sender, ExecutionEventArgs e)
        {
            if (e.Execution == null) return;
            
            var execution = e.Execution;
            var order = execution.Order;
            
            // Only process if we have order info and it's filled
            if (order != null && order.OrderState != OrderState.Filled && order.OrderState != OrderState.PartFilled) return;
            
            // Determine direction from the order action
            string action = "";
            string direction = "";
            
            // Buy/SellShort = entries, Sell/BuyToCover = exits
            // But OrderAction isn't always reliable per NT support.
            // Use a simpler heuristic: check execution.MarketPosition
            if (execution.MarketPosition == MarketPosition.Long)
            {
                action = "entry";
                direction = "Long";
            }
            else if (execution.MarketPosition == MarketPosition.Short)
            {
                action = "entry";
                direction = "Short";
            }
            else
            {
                action = "exit";
                direction = "Flat";
            }
            
            if (action == "entry" && !SendEntries) return;
            if (action == "exit" && !SendExits) return;
            
            double price = execution.Price;
            int quantity = execution.Quantity;
            DateTime time = execution.Time;
            string symbol = execution.Instrument.MasterInstrument.Name;
            string orderId = order != null ? order.OrderId : "";
            
            string assetClass = execution.Instrument.MasterInstrument.InstrumentType == InstrumentType.Future 
                ? "Futures" 
                : execution.Instrument.MasterInstrument.InstrumentType == InstrumentType.Forex 
                    ? "Forex" 
                    : "Stock";
            
            // Build JSON payload
            string json = string.Format(
                "{{" +
                "\"ticker\":\"{0}\"," +
                "\"action\":\"{1}\"," +
                "\"direction\":\"{2}\"," +
                "\"price\":{3}," +
                "\"qty\":{4}," +
                "\"asset_class\":\"{5}\"," +
                "\"order_id\":\"{6}\"," +
                "\"time\":\"{7}\"," +
                "\"source\":\"ninjatrader\"" +
                "}}",
                symbol,
                action,
                direction,
                price.ToString("F6"),
                quantity,
                assetClass,
                orderId ?? "",
                time.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            );
            
            // Send async — don't block the execution thread
            SendWebhookAsync(json, symbol, action, direction, price, quantity, time);
        }
        
        private async void SendWebhookAsync(string json, string symbol, string action,
            string direction, double price, int qty, DateTime time)
        {
            try
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(WebhookUrl, content);
                
                if (LogToOutput)
                {
                    if (response.IsSuccessStatusCode)
                    {
                        Print(string.Format("[TradVue] {0} {1} {2} {3}x @ {4:F2} — sent OK", 
                            action.ToUpper(), direction, symbol, qty, price));
                    }
                    else
                    {
                        Print(string.Format("[TradVue] ERROR {0}: {1}", 
                            (int)response.StatusCode, await response.Content.ReadAsStringAsync()));
                    }
                }
            }
            catch (Exception ex)
            {
                if (LogToOutput)
                    Print(string.Format("[TradVue] Send failed: {0}", ex.Message));
            }
        }

        #region Properties
        [NinjaScriptProperty]
        [Display(Name = "Webhook URL", Description = "Your TradVue webhook URL (from Integrations page)", 
            Order = 1, GroupName = "TradVue Settings")]
        public string WebhookUrl { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Send Entries", Description = "Send entry fills to TradVue", 
            Order = 2, GroupName = "TradVue Settings")]
        public bool SendEntries { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Send Exits", Description = "Send exit fills to TradVue", 
            Order = 3, GroupName = "TradVue Settings")]
        public bool SendExits { get; set; }

        [NinjaScriptProperty]
        [Display(Name = "Log to Output", Description = "Show send confirmations in NinjaTrader Output window", 
            Order = 4, GroupName = "TradVue Settings")]
        public bool LogToOutput { get; set; }
        #endregion
    }
}
