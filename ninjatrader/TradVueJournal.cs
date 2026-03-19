// TradVue Auto-Journal for NinjaTrader 8
// 
// This strategy addon sends your real trade executions to TradVue automatically.
// It fires ONLY on actual broker fills — real entry/exit prices, real quantities.
//
// Installation:
//   1. Copy this file to: Documents\NinjaTrader 8\bin\Custom\Strategies\
//   2. Open NinjaScript Editor → Compile (F5)
//   3. Add "TradVueJournal" strategy to your chart/workspace
//   4. Set the WebhookUrl parameter to your TradVue webhook URL
//   5. Enable the strategy — trades auto-journal from this point forward
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
        
        // Track previous position to detect entry vs exit
        private MarketPosition prevPosition = MarketPosition.Flat;
        private double lastEntryPrice = 0;
        private int lastEntryQty = 0;
        private string lastEntryDirection = null;
        private DateTime lastEntryTime = DateTime.MinValue;
        
        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Description = "TradVue Auto-Journal — sends real trade executions to your TradVue account";
                Name = "TradVueJournal";
                Calculate = Calculate.OnEachTick;
                IsOverlay = true;
                IsUnmanaged = true;
                
                // User-configurable parameters
                WebhookUrl = "https://tradvue-api.onrender.com/api/webhook/nt/YOUR_TOKEN_HERE";
                SendEntries = true;
                SendExits = true;
                LogToOutput = true;
            }
        }

        protected override void OnExecutionUpdate(Execution execution, string executionId, 
            double price, int quantity, MarketPosition marketPosition, 
            string orderId, DateTime time)
        {
            if (execution == null || execution.Order == null) return;
            
            var order = execution.Order;
            
            // Only process filled orders
            if (order.OrderState != OrderState.Filled && order.OrderState != OrderState.PartFilled) return;
            
            // Determine entry vs exit by tracking position changes
            // Entry: Flat → Long or Flat → Short
            // Exit: Long → Flat or Short → Flat
            // Reversal: Long → Short or Short → Long (treated as exit + entry)
            
            string action = "";
            string direction = "";
            double entryPrice = 0;
            double exitPrice = 0;
            double pnl = 0;
            
            bool isEntry = (prevPosition == MarketPosition.Flat && marketPosition != MarketPosition.Flat);
            bool isExit = (prevPosition != MarketPosition.Flat && marketPosition == MarketPosition.Flat);
            bool isReversal = (prevPosition == MarketPosition.Long && marketPosition == MarketPosition.Short) ||
                              (prevPosition == MarketPosition.Short && marketPosition == MarketPosition.Long);
            
            if (isReversal)
            {
                // Send the exit portion first
                if (SendExits)
                {
                    exitPrice = price;
                    entryPrice = lastEntryPrice;
                    direction = lastEntryDirection ?? "Unknown";
                    
                    if (entryPrice > 0)
                    {
                        if (direction == "Long")
                            pnl = (exitPrice - entryPrice) * lastEntryQty;
                        else
                            pnl = (entryPrice - exitPrice) * lastEntryQty;
                        
                        if (Instrument.MasterInstrument.InstrumentType == InstrumentType.Future)
                            pnl = pnl * Instrument.MasterInstrument.PointValue;
                    }
                    
                    string exitJson = BuildJson("exit", direction, price, entryPrice, exitPrice, 
                        lastEntryQty, pnl, orderId, time);
                    SendWebhookAsync(exitJson, Instrument.MasterInstrument.Name, "exit", price, lastEntryQty, time);
                }
                
                // Now treat as new entry
                isEntry = true;
            }
            
            if (isEntry)
            {
                action = "entry";
                direction = marketPosition == MarketPosition.Long ? "Long" : "Short";
                entryPrice = price;
                
                // Track for matching with exit
                lastEntryPrice = price;
                lastEntryQty = quantity;
                lastEntryDirection = direction;
                lastEntryTime = time;
                
                prevPosition = marketPosition;
                
                if (!SendEntries) return;
                
                string json = BuildJson(action, direction, price, entryPrice, 0, quantity, 0, orderId, time);
                SendWebhookAsync(json, Instrument.MasterInstrument.Name, action, price, quantity, time);
                return;
            }
            
            if (isExit)
            {
                action = "exit";
                exitPrice = price;
                entryPrice = lastEntryPrice;
                direction = lastEntryDirection ?? (prevPosition == MarketPosition.Long ? "Long" : "Short");
                
                // Calculate P&L
                if (entryPrice > 0)
                {
                    if (direction == "Long")
                        pnl = (exitPrice - entryPrice) * quantity;
                    else
                        pnl = (entryPrice - exitPrice) * quantity;
                    
                    if (Instrument.MasterInstrument.InstrumentType == InstrumentType.Future)
                        pnl = pnl * Instrument.MasterInstrument.PointValue;
                }
                
                prevPosition = marketPosition;
                
                if (!SendExits) return;
                
                string json = BuildJson(action, direction, price, entryPrice, exitPrice, quantity, pnl, orderId, time);
                SendWebhookAsync(json, Instrument.MasterInstrument.Name, action, price, quantity, time);
                return;
            }
            
            // Scale-in or partial fill (position didn't change direction)
            prevPosition = marketPosition;
        }
        
        private string BuildJson(string action, string direction, double price, 
            double entryPrice, double exitPrice, int quantity, double pnl,
            string orderId, DateTime time)
        {
            string symbol = Instrument.MasterInstrument.Name;
            string assetClass = Instrument.MasterInstrument.InstrumentType == InstrumentType.Future 
                ? "Futures" 
                : Instrument.MasterInstrument.InstrumentType == InstrumentType.Forex 
                    ? "Forex" 
                    : "Stock";
            
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
                symbol,
                action,
                direction,
                price.ToString("F4"),
                entryPrice > 0 ? entryPrice.ToString("F4") : "null",
                exitPrice > 0 ? exitPrice.ToString("F4") : "null",
                quantity,
                Math.Round(pnl, 2).ToString("F2"),
                assetClass,
                orderId ?? "",
                time.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            );
        }
        
        private async void SendWebhookAsync(string json, string symbol, string action, 
            double price, int qty, DateTime time)
        {
            try
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(WebhookUrl, content);
                
                if (LogToOutput)
                {
                    if (response.IsSuccessStatusCode)
                    {
                        Print(string.Format("[TradVue] {0} {1} {2}x @ {3:F2} — sent OK", 
                            action.ToUpper(), symbol, qty, price));
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
