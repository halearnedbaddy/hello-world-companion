import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Filter,
  MessageSquare,
  Search,
  Send,
  Shield,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/* ── status helpers ────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "text-yellow-400", bg: "bg-yellow-500/15" },
  under_review: { label: "In Progress", color: "text-blue-400", bg: "bg-blue-500/15" },
  awaiting_seller: { label: "Awaiting Seller", color: "text-orange-400", bg: "bg-orange-500/15" },
  awaiting_buyer: { label: "Awaiting Buyer", color: "text-orange-400", bg: "bg-orange-500/15" },
  resolved_buyer: { label: "Resolved (Buyer)", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  resolved_seller: { label: "Resolved (Seller)", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  closed: { label: "Closed", color: "text-white/40", bg: "bg-white/10" },
};

const RESOLUTION_TYPES = [
  { value: "full_refund", label: "Full Refund to Buyer" },
  { value: "partial_refund", label: "Partial Refund" },
  { value: "release_seller", label: "Release to Seller" },
  { value: "split", label: "Split Payment" },
  { value: "no_action", label: "No Financial Action" },
];

/* ── main component ────────────────────────────── */
export default function AdminDisputes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  /* ── disputes list ── */
  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = disputes.filter((d: any) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        d.id?.toLowerCase().includes(q) ||
        d.reason?.toLowerCase().includes(q) ||
        d.transaction_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCount = disputes.filter((d: any) => d.status === "open").length;
  const inProgressCount = disputes.filter((d: any) => d.status === "under_review").length;
  const resolvedToday = disputes.filter((d: any) => {
    if (!d.resolved_at) return false;
    const today = new Date();
    const resolved = new Date(d.resolved_at);
    return resolved.toDateString() === today.toDateString();
  }).length;

  if (selectedDisputeId) {
    return (
      <DisputeDetail
        disputeId={selectedDisputeId}
        onBack={() => setSelectedDisputeId(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl text-white">Disputes</h1>
        <p className="text-white/40 text-sm mt-1">Manage and resolve customer disputes</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Open", value: openCount, color: "text-yellow-400" },
          { label: "In Progress", value: inProgressCount, color: "text-blue-400" },
          { label: "Resolved Today", value: resolvedToday, color: "text-emerald-400" },
          { label: "Total", value: disputes.length, color: "text-white/70" },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-white/40 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search by ID, reason, or transaction..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white/[0.04] border-white/10 text-white text-sm placeholder:text-white/25"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "open", "under_review", "resolved_buyer", "resolved_seller", "closed"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant="ghost"
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] h-8 px-3 rounded-full ${
                statusFilter === s
                  ? "bg-primary/20 text-primary"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
              }`}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-white/30 text-xs">Loading disputes...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-white/10" />
          <p className="text-white/30 text-sm">No disputes found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d: any) => {
            const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.open;
            return (
              <div
                key={d.id}
                onClick={() => setSelectedDisputeId(d.id)}
                className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05] cursor-pointer transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <AlertTriangle className={`w-5 h-5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">
                      {d.reason || d.dispute_type || "Dispute"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5 truncate">
                    {d.transaction_id ? `TX: ${d.transaction_id}` : "No transaction"} ·{" "}
                    {d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : ""}
                  </div>
                </div>
                <MessageSquare className="w-4 h-4 text-white/20 shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DISPUTE DETAIL + CHAT
   ═══════════════════════════════════════════════════ */
function DisputeDetail({ disputeId, onBack }: { disputeId: string; onBack: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showResolve, setShowResolve] = useState(false);

  /* ── dispute data ── */
  const { data: dispute } = useQuery({
    queryKey: ["admin-dispute", disputeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .eq("id", disputeId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  /* ── messages ── */
  const { data: messages = [] } = useQuery({
    queryKey: ["dispute-messages", disputeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dispute_messages")
        .select("*")
        .eq("dispute_id", disputeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ── realtime subscription ── */
  useEffect(() => {
    const channel = supabase
      .channel(`dispute-admin-${disputeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dispute_messages", filter: `dispute_id=eq.${disputeId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dispute-messages", disputeId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [disputeId, queryClient]);

  /* ── scroll to bottom ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── send message ── */
  const sendMsg = useMutation({
    mutationFn: async (msg: string) => {
      const { error } = await supabase.from("dispute_messages").insert({
        dispute_id: disputeId,
        sender_id: user!.id,
        message: msg,
        is_admin: true,
        sender_type: "ADMIN",
        sender_name: "Admin",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["dispute-messages", disputeId] });
    },
    onError: (e: Error) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  /* ── mark in progress ── */
  const markInProgress = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("disputes")
        .update({ status: "under_review" as any })
        .eq("id", disputeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Dispute marked as In Progress" });
      queryClient.invalidateQueries({ queryKey: ["admin-dispute", disputeId] });
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
    },
  });

  const cfg = STATUS_CONFIG[dispute?.status || "open"] || STATUS_CONFIG.open;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-white/50 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg text-white">
            {dispute?.reason || "Dispute"}
          </h1>
          <p className="text-[11px] text-white/30 font-mono">{disputeId.slice(0, 8)}...</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Details</h3>
            <InfoRow label="Type" value={dispute?.dispute_type || dispute?.reason || "—"} />
            <InfoRow label="Transaction" value={dispute?.transaction_id || "None"} />
            <InfoRow label="Description" value={dispute?.description || "—"} />
            <InfoRow
              label="Created"
              value={dispute?.created_at ? new Date(dispute.created_at).toLocaleDateString("en-KE") : "—"}
            />
            {dispute?.resolved_at && (
              <InfoRow label="Resolved" value={new Date(dispute.resolved_at).toLocaleDateString("en-KE")} />
            )}
            {dispute?.resolution && <InfoRow label="Resolution" value={dispute.resolution} />}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {dispute?.status === "open" && (
              <Button
                size="sm"
                className="w-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs"
                onClick={() => markInProgress.mutate()}
                disabled={markInProgress.isPending}
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" /> Mark In Progress
              </Button>
            )}
            {dispute?.status && !["resolved_buyer", "resolved_seller", "closed"].includes(dispute.status) && (
              <Button
                size="sm"
                className="w-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs"
                onClick={() => setShowResolve(true)}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Resolve Dispute
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT: Chat */}
        <div className="lg:col-span-2 flex flex-col bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden" style={{ minHeight: 400 }}>
          <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-white/40" />
            <span className="text-xs font-semibold text-white/60">Messages ({messages.length})</span>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 420 }}>
            {messages.length === 0 && (
              <div className="text-center py-10 text-white/20 text-xs">No messages yet. Send the first message.</div>
            )}
            {messages.map((m: any) => {
              const isAdmin = m.is_admin;
              return (
                <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                      isAdmin
                        ? "bg-primary/20 text-white rounded-br-sm"
                        : "bg-white/[0.06] text-white/80 rounded-bl-sm"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isAdmin && <Shield className="w-3 h-3 text-primary" />}
                      <span className="text-[10px] font-bold text-white/50">
                        {m.sender_name || (isAdmin ? "Admin" : "User")}
                      </span>
                      <span className="text-[9px] text-white/25">
                        {m.created_at ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true }) : ""}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{m.message}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.07] p-3 flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newMessage.trim()) {
                  sendMsg.mutate(newMessage.trim());
                }
              }}
              className="flex-1 bg-white/[0.04] border-white/10 text-white text-sm placeholder:text-white/25"
            />
            <Button
              size="sm"
              onClick={() => newMessage.trim() && sendMsg.mutate(newMessage.trim())}
              disabled={sendMsg.isPending || !newMessage.trim()}
              className="bg-primary text-white px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Resolve Modal */}
      <ResolveModal
        open={showResolve}
        onClose={() => setShowResolve(false)}
        disputeId={disputeId}
        adminId={user?.id || ""}
      />
    </div>
  );
}

/* ── Info row helper ── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-white/35 uppercase tracking-wider">{label}</div>
      <div className="text-sm text-white/70 mt-0.5 break-words">{value}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   RESOLVE MODAL
   ═══════════════════════════════════════════════════ */
function ResolveModal({
  open,
  onClose,
  disputeId,
  adminId,
}: {
  open: boolean;
  onClose: () => void;
  disputeId: string;
  adminId: string;
}) {
  const queryClient = useQueryClient();
  const [resolutionType, setResolutionType] = useState("no_action");
  const [notes, setNotes] = useState("");
  const [favour, setFavour] = useState<"buyer" | "seller">("buyer");

  const resolve = useMutation({
    mutationFn: async () => {
      if (notes.trim().length < 20) throw new Error("Please provide at least 20 characters of resolution notes.");

      const resolvedStatus = favour === "buyer" ? "resolved_buyer" : "resolved_seller";
      const resolutionText = `[${RESOLUTION_TYPES.find((r) => r.value === resolutionType)?.label}] ${notes}`;

      // Update dispute
      const { error: dErr } = await supabase
        .from("disputes")
        .update({
          status: resolvedStatus as any,
          resolution: resolutionText,
          resolved_by_id: adminId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", disputeId);
      if (dErr) throw dErr;

      // Post resolution message
      const { error: mErr } = await supabase.from("dispute_messages").insert({
        dispute_id: disputeId,
        sender_id: adminId,
        message: `✅ Dispute resolved: ${resolutionText}`,
        is_admin: true,
        sender_type: "ADMIN",
        sender_name: "Admin",
      });
      if (mErr) throw mErr;
    },
    onSuccess: () => {
      toast({ title: "Dispute resolved successfully" });
      onClose();
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-dispute", disputeId] });
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["dispute-messages", disputeId] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d0d1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" /> Resolve Dispute
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Choose a resolution and both parties will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resolution type */}
          <div>
            <Label className="text-xs text-white/50 mb-2 block">Resolution Type</Label>
            <select
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {RESOLUTION_TYPES.map((r) => (
                <option key={r.value} value={r.value} className="bg-[#0d0d1a]">
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* In favour of */}
          <div>
            <Label className="text-xs text-white/50 mb-2 block">Resolved in Favour of</Label>
            <div className="flex gap-2">
              {(["buyer", "seller"] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant="ghost"
                  onClick={() => setFavour(f)}
                  className={`flex-1 text-xs capitalize ${
                    favour === f ? "bg-primary/20 text-primary" : "text-white/40 hover:bg-white/[0.06]"
                  }`}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs text-white/50 mb-2 block">Resolution Notes (min 20 chars)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Explain the resolution decision..."
              className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-white/20"
            />
            <div className="text-right text-[10px] text-white/25 mt-1">{notes.length}/20 min</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/60">
            Cancel
          </Button>
          <Button
            onClick={() => resolve.mutate()}
            disabled={resolve.isPending}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {resolve.isPending ? "Resolving..." : "Confirm Resolution"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
