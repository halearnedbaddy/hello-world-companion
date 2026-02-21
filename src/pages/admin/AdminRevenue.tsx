import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Calendar,
  PieChart,
  BarChart3,
  Users,
} from "lucide-react";

const formatCurrency = (amount: number) =>
  `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

export default function AdminRevenue() {
  const [period, setPeriod] = useState("30d");

  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-revenue-txns", period],
    queryFn: async () => {
      const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
      const days = daysMap[period] || 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("id, amount, platform_fee, seller_payout, status, created_at, payment_method, currency")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ["admin-platform-accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("platform_accounts")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["admin-payouts", period],
    queryFn: async () => {
      const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
      const days = daysMap[period] || 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const { data, error } = await (supabase as any)
        .from("payouts")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Calculations
  const completedTxns = transactions.filter((t: any) => t.status === "completed" || t.status === "delivered");
  const totalVolume = transactions.reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const totalFees = transactions.reduce((s: number, t: any) => s + (t.platform_fee || 0), 0);
  const totalPayouts = payouts.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const netRevenue = totalFees;
  const avgOrderValue = completedTxns.length > 0 ? totalVolume / completedTxns.length : 0;
  const platformBalance = wallets.reduce((s: number, w: any) => s + (w.balance || 0), 0);

  // Group by status
  const statusGroups = transactions.reduce((acc: Record<string, { count: number; amount: number }>, t: any) => {
    const st = t.status || "unknown";
    if (!acc[st]) acc[st] = { count: 0, amount: 0 };
    acc[st].count++;
    acc[st].amount += t.amount || 0;
    return acc;
  }, {});

  // Group by payment method
  const methodGroups = transactions.reduce((acc: Record<string, number>, t: any) => {
    const m = t.payment_method || "Unknown";
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  // Daily revenue breakdown (last 7 entries)
  const dailyMap = transactions.reduce((acc: Record<string, number>, t: any) => {
    const day = new Date(t.created_at).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
    acc[day] = (acc[day] || 0) + (t.platform_fee || 0);
    return acc;
  }, {});
  const dailyRevenue = Object.entries(dailyMap).slice(0, 7).reverse() as [string, number][];
  const maxDailyRevenue = Math.max(...dailyRevenue.map(([, v]) => v as number), 1);

  const stats = [
    { label: "Total Volume", value: formatCurrency(totalVolume), sub: `${transactions.length} transactions`, icon: CreditCard, color: "text-blue-400", bg: "bg-blue-500/10", trend: "+12.3%", trendUp: true },
    { label: "Platform Revenue", value: formatCurrency(netRevenue), sub: "Commission earned", icon: DollarSign, color: "text-primary", bg: "bg-primary/10", trend: "+8.7%", trendUp: true },
    { label: "Seller Payouts", value: formatCurrency(totalPayouts), sub: `${payouts.length} payouts`, icon: Wallet, color: "text-orange-400", bg: "bg-orange-500/10", trend: "+15.2%", trendUp: true },
    { label: "Avg. Order Value", value: formatCurrency(avgOrderValue), sub: `${completedTxns.length} completed`, icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10", trend: "-2.1%", trendUp: false },
  ];

  const statusColors: Record<string, string> = {
    completed: "bg-primary/15 text-primary",
    delivered: "bg-green-500/15 text-green-400",
    paid: "bg-blue-500/15 text-blue-400",
    pending: "bg-yellow-500/15 text-yellow-400",
    cancelled: "bg-red-500/15 text-red-400",
    refunded: "bg-orange-500/15 text-orange-400",
    disputed: "bg-red-500/15 text-red-400",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-xl text-white">Revenue & Financials</h1>
          <p className="text-white/40 text-sm mt-1">Platform earnings, payouts, and financial health</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 bg-white/[0.05] border-white/10 text-white/70 text-xs h-9">
              <Calendar className="w-3 h-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0d0d1a] border-white/10 text-white">
              <SelectItem value="7d" className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white">Last 7 days</SelectItem>
              <SelectItem value="30d" className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white">Last 30 days</SelectItem>
              <SelectItem value="90d" className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white">Last 90 days</SelectItem>
              <SelectItem value="365d" className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-white/60 text-xs bg-white/[0.05] h-9">
            <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
          </Button>
          <Button variant="ghost" size="sm" className="text-white/60 text-xs bg-white/[0.05] h-9">
            <Download className="w-3 h-3 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <span className={`flex items-center gap-0.5 text-[10px] font-bold ${stat.trendUp ? "text-green-400" : "text-red-400"}`}>
                {stat.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </span>
            </div>
            <div className="font-display font-bold text-2xl text-white">{stat.value}</div>
            <div className="text-xs text-white/40 mt-1">{stat.sub}</div>
            <div className="text-[10px] text-white/30 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-white text-sm">Daily Revenue</h3>
            </div>
          </div>
          {dailyRevenue.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-xs">No revenue data for this period</div>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {dailyRevenue.map(([day, amount]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-white/40">{formatCurrency(amount)}</span>
                  <div
                    className="w-full bg-primary/30 rounded-t-md min-h-[4px] transition-all"
                    style={{ height: `${(amount / maxDailyRevenue) * 100}%` }}
                  />
                  <span className="text-[9px] text-white/30">{day}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform Balance */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-green-400" />
            <h3 className="font-semibold text-white text-sm">Platform Balance</h3>
          </div>
          <div className="font-display font-bold text-3xl text-white mb-1">{formatCurrency(platformBalance)}</div>
          <p className="text-[11px] text-white/40 mb-6">Available across all accounts</p>

          {wallets.length === 0 ? (
            <p className="text-xs text-white/30">No platform accounts configured.</p>
          ) : (
            <div className="space-y-3">
              {wallets.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                  <div>
                    <div className="text-xs text-white/70 font-medium capitalize">{w.account_type}</div>
                    <div className="text-[10px] text-white/30">{w.currency}</div>
                  </div>
                  <div className="text-sm text-white font-bold">{formatCurrency(w.balance || 0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Transaction Status Breakdown */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">Transaction Status</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(statusGroups).map(([status, data]) => {
              const d = data as { count: number; amount: number };
              return (
              <div key={status} className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${statusColors[status] || "bg-white/10 text-white/40"}`}>
                    {status}
                  </span>
                  <span className="text-xs text-white/50">{d.count} txns</span>
                </div>
                <span className="text-xs text-white/70 font-medium">{formatCurrency(d.amount)}</span>
              </div>
              );
            })}
            {Object.keys(statusGroups).length === 0 && (
              <p className="text-xs text-white/30 text-center py-6">No transactions in this period</p>
            )}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-orange-400" />
            <h3 className="font-semibold text-white text-sm">Payment Methods</h3>
          </div>
          <div className="space-y-2">
            {Object.entries(methodGroups).map(([method, count]) => {
              const pct = transactions.length > 0 ? ((count as number) / transactions.length) * 100 : 0;
              return (
                <div key={method} className="p-2.5 bg-white/[0.02] rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/70 font-medium capitalize">{method}</span>
                    <span className="text-[10px] text-white/40">{count as number} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(methodGroups).length === 0 && (
              <p className="text-xs text-white/30 text-center py-6">No payment data</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-white/40" />
            <h3 className="font-semibold text-white text-sm">Recent Transactions</h3>
          </div>
          <span className="text-[10px] text-white/30">{transactions.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                {["ID", "Amount", "Fee", "Status", "Method", "Date"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold tracking-wider uppercase text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-white/30 text-xs">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-white/30 text-xs">No transactions found</td></tr>
              ) : (
                transactions.slice(0, 15).map((t: any) => (
                  <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-white/50">{t.id?.slice(0, 10)}...</td>
                    <td className="px-4 py-3 text-white/80 font-medium">{formatCurrency(t.amount || 0)}</td>
                    <td className="px-4 py-3 text-primary">{formatCurrency(t.platform_fee || 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${statusColors[t.status] || "bg-white/10 text-white/40"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 capitalize">{t.payment_method || "—"}</td>
                    <td className="px-4 py-3 text-white/40 text-[10px]">{new Date(t.created_at).toLocaleDateString("en-NG")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
