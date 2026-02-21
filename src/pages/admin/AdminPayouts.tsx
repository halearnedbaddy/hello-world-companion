import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  RefreshCw,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  Filter,
} from "lucide-react";

const formatKSh = (v: number) => `KSh ${v.toLocaleString("en-KE")}`;

type FilterStatus = "all" | "pending" | "processing" | "completed" | "failed";

const statusClass: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400",
  processing: "bg-blue-500/15 text-blue-400",
  completed: "bg-primary/15 text-primary",
  failed: "bg-destructive/15 text-red-400",
  cancelled: "bg-white/10 text-white/40",
};

export default function AdminPayouts() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const { data: withdrawals = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-withdrawals", statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("withdrawals")
        .select("*, payment_methods(provider, account_number, type, account_name), profiles:user_id(name, email, phone)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const updates: any = { status };
      if (status === "completed") updates.processed_at = new Date().toISOString();
      if (status === "failed" && reason) updates.failure_reason = reason;
      const { error } = await supabase.from("withdrawals").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      toast({ title: "Withdrawal updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const stats = {
    pending: withdrawals.filter((w: any) => w.status === "pending").length,
    pendingAmount: withdrawals.filter((w: any) => w.status === "pending").reduce((s: number, w: any) => s + w.amount, 0),
    completed: withdrawals.filter((w: any) => w.status === "completed").reduce((s: number, w: any) => s + w.amount, 0),
    failed: withdrawals.filter((w: any) => w.status === "failed").length,
  };

  const filters: { value: FilterStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl text-white">Payout Management</h1>
        <p className="text-white/40 text-sm mt-1">Review and process withdrawal requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <div className="font-display font-bold text-2xl text-white">{stats.pending}</div>
          <div className="text-xs text-white/40 mt-1">{formatKSh(stats.pendingAmount)}</div>
          <div className="text-[10px] text-white/30 mt-0.5">Pending Requests</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="font-display font-bold text-2xl text-white">{formatKSh(stats.completed)}</div>
          <div className="text-xs text-white/40 mt-1">Total disbursed</div>
          <div className="text-[10px] text-white/30 mt-0.5">Completed Payouts</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <div className="font-display font-bold text-2xl text-white">{stats.failed}</div>
          <div className="text-xs text-white/40 mt-1">Need attention</div>
          <div className="text-[10px] text-white/30 mt-0.5">Failed Payouts</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div className="font-display font-bold text-2xl text-white">{withdrawals.length}</div>
          <div className="text-xs text-white/40 mt-1">All time</div>
          <div className="text-[10px] text-white/30 mt-0.5">Total Requests</div>
        </div>
      </div>

      {/* Filters + Refresh */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-primary/20 text-primary"
                  : "bg-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.06]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-white/60 text-xs bg-white/[0.05]">
          <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              {["User", "Amount", "Fee", "Net", "Method", "Destination", "Status", "Date", "Actions"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold tracking-wider uppercase text-white/30">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12 text-white/30">Loading...</td></tr>
            ) : withdrawals.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-white/30">
                  <div className="text-2xl mb-2">💸</div>
                  <div>No withdrawal requests</div>
                </td>
              </tr>
            ) : withdrawals.map((w: any) => (
              <tr key={w.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2.5">
                  <div className="text-white/80 text-xs font-medium">{w.profiles?.name || "Unknown"}</div>
                  <div className="text-[10px] text-white/30">{w.profiles?.email || w.profiles?.phone || "—"}</div>
                </td>
                <td className="px-3 py-2.5 text-white/80 font-semibold">{formatKSh(w.amount)}</td>
                <td className="px-3 py-2.5 text-white/40">{w.fee ? formatKSh(w.fee) : "—"}</td>
                <td className="px-3 py-2.5 text-white/70">{w.net_amount ? formatKSh(w.net_amount) : "—"}</td>
                <td className="px-3 py-2.5 text-white/60">{w.payment_methods?.provider || "—"}</td>
                <td className="px-3 py-2.5 text-white/50 text-[10px]">
                  {w.payment_methods?.account_name && <div>{w.payment_methods.account_name}</div>}
                  <div>{w.payment_methods?.account_number || "—"}</div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass[w.status] || "bg-white/10 text-white/40"}`}>
                    {w.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-white/40 text-[10px] whitespace-nowrap">
                  {new Date(w.created_at).toLocaleDateString("en-KE")}
                </td>
                <td className="px-3 py-2.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/40 hover:text-white">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#0d0d1a] border-white/10 min-w-[160px]">
                      {w.status === "pending" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: w.id, status: "processing" })}
                            className="text-xs text-blue-400 focus:bg-blue-400/10 cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5 mr-2" /> Mark Processing
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: w.id, status: "completed" })}
                            className="text-xs text-primary focus:bg-primary/10 cursor-pointer"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-2" /> Approve & Complete
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: w.id, status: "failed", reason: "Rejected by admin" })}
                            className="text-xs text-red-400 focus:bg-red-400/10 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-2" /> Reject
                          </DropdownMenuItem>
                        </>
                      )}
                      {w.status === "processing" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: w.id, status: "completed" })}
                            className="text-xs text-primary focus:bg-primary/10 cursor-pointer"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-2" /> Mark Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateStatus.mutate({ id: w.id, status: "failed", reason: "Processing failed" })}
                            className="text-xs text-red-400 focus:bg-red-400/10 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-2" /> Mark Failed
                          </DropdownMenuItem>
                        </>
                      )}
                      {w.status === "failed" && (
                        <DropdownMenuItem
                          onClick={() => updateStatus.mutate({ id: w.id, status: "pending" })}
                          className="text-xs text-yellow-400 focus:bg-yellow-400/10 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Retry (Reset to Pending)
                        </DropdownMenuItem>
                      )}
                      {w.status === "completed" && (
                        <DropdownMenuItem disabled className="text-xs text-white/30">
                          <CheckCircle className="w-3.5 h-3.5 mr-2" /> Already completed
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
