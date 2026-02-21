import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { WithdrawModal } from "@/components/payout/WithdrawModal";
import { ArrowUpRight, RefreshCw, Wallet, Clock, CheckCircle, XCircle } from "lucide-react";

const formatKSh = (v: number) => `KSh ${v.toLocaleString("en-KE")}`;

const statusConfig: Record<string, { class: string; icon: typeof Clock }> = {
  pending: { class: "bg-yellow-500/15 text-yellow-400", icon: Clock },
  processing: { class: "bg-blue-500/15 text-blue-400", icon: Clock },
  completed: { class: "bg-primary/15 text-primary", icon: CheckCircle },
  failed: { class: "bg-destructive/15 text-red-400", icon: XCircle },
  cancelled: { class: "bg-white/10 text-white/40", icon: XCircle },
};

export default function DashboardPayouts() {
  const { user } = useAuth();
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) return { available_balance: 0, pending_balance: 0, total_earned: 0 };
      return data;
    },
  });

  const { data: withdrawals = [], isLoading, refetch } = useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*, payment_methods(provider, account_number, type)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const available = wallet?.available_balance ?? 0;
  const pending = wallet?.pending_balance ?? 0;
  const totalEarned = wallet?.total_earned ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display font-bold text-white text-lg">Payouts</h2>
          <p className="text-white/40 text-xs mt-0.5">Manage your withdrawals</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-white/60 text-xs bg-white/[0.05]">
            <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowWithdraw(true)} className="bg-primary hover:bg-primary/90 text-xs">
            <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> Withdraw
          </Button>
        </div>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-[10px] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-white/40">Available</span>
          </div>
          <div className="font-display font-bold text-white text-lg">{formatKSh(available)}</div>
          <div className="text-[10px] text-primary mt-0.5">Ready to withdraw</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-[10px] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[10px] text-white/40">Pending</span>
          </div>
          <div className="font-display font-bold text-white text-lg">{formatKSh(pending)}</div>
          <div className="text-[10px] text-yellow-400 mt-0.5">In escrow / processing</div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.07] rounded-[10px] p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] text-white/40">Total Earned</span>
          </div>
          <div className="font-display font-bold text-white text-lg">{formatKSh(totalEarned)}</div>
          <div className="text-[10px] text-green-400 mt-0.5">Lifetime earnings</div>
        </div>
      </div>

      {/* Withdrawal history */}
      <div className="overflow-x-auto rounded-[10px] border border-white/[0.06]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              {["Reference", "Amount", "Fee", "Net", "Method", "Destination", "Status", "Date"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold tracking-wider uppercase text-white/30">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-white/30 text-xs">Loading withdrawals...</td></tr>
            ) : withdrawals.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-white/30 text-xs">
                  <div className="text-2xl mb-2">💰</div>
                  <div>No withdrawals yet</div>
                  <div className="text-white/20 mt-1">Click "Withdraw" to cash out your balance.</div>
                </td>
              </tr>
            ) : withdrawals.map((w: any) => {
              const sc = statusConfig[w.status] || statusConfig.pending;
              return (
                <tr key={w.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5 text-white/30 font-mono text-[10px]">{w.reference || w.id.slice(0, 8)}</td>
                  <td className="px-3 py-2.5 text-white/80 font-semibold">{formatKSh(w.amount)}</td>
                  <td className="px-3 py-2.5 text-white/40">{w.fee ? formatKSh(w.fee) : "—"}</td>
                  <td className="px-3 py-2.5 text-white/70">{w.net_amount ? formatKSh(w.net_amount) : "—"}</td>
                  <td className="px-3 py-2.5 text-white/60">{w.payment_methods?.provider || "—"}</td>
                  <td className="px-3 py-2.5 text-white/60 text-[10px]">{w.payment_methods?.account_number || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.class}`}>
                      {w.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white/40 text-[10px] whitespace-nowrap">
                    {new Date(w.created_at).toLocaleDateString("en-KE")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <WithdrawModal
        open={showWithdraw}
        onOpenChange={setShowWithdraw}
        availableBalance={available}
      />
    </div>
  );
}
