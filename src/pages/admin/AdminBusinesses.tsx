import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  RefreshCw,
  Building2,
  MoreHorizontal,
  Eye,
  Pencil,
  Ban,
  Trash2,
  CheckCircle,
  ShieldOff,
  Mail,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<string, { label: string; color: string }> = {
  EMAIL_UNVERIFIED: { label: "Unverified", color: "bg-white/10 text-white/40" },
  EMAIL_VERIFIED: { label: "Verified", color: "bg-blue-500/15 text-blue-400" },
  PENDING: { label: "Pending", color: "bg-yellow-500/15 text-yellow-400" },
  APPROVED: { label: "Live", color: "bg-primary/15 text-primary" },
  REJECTED: { label: "Rejected", color: "bg-red-500/15 text-red-400" },
  SUSPENDED: { label: "Suspended", color: "bg-orange-500/15 text-orange-400" },
};

export default function AdminBusinesses() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [dialogType, setDialogType] = useState<"view" | "edit" | "suspend" | "delete" | "approve" | "revoke" | null>(null);
  const [editName, setEditName] = useState("");
  const [actionReason, setActionReason] = useState("");

  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-all-accounts", statusFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("accounts")
        .select("*, kyc_documents(status)")
        .order("created_at", { ascending: false });
      if (statusFilter !== "ALL") {
        q = q.eq("status", statusFilter as any);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await (supabase as any)
        .from("accounts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-accounts"] });
      setDialogType(null);
      setSelectedAccount(null);
      setActionReason("");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("accounts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-accounts"] });
      setDialogType(null);
      setSelectedAccount(null);
      toast({ title: "Business deleted successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
    },
  });

  const openDialog = (account: any, type: typeof dialogType) => {
    setSelectedAccount(account);
    setDialogType(type);
    if (type === "edit") setEditName(account.business_name || "");
    setActionReason("");
  };

  const handleAction = () => {
    if (!selectedAccount) return;
    switch (dialogType) {
      case "edit":
        updateAccountMutation.mutate(
          { id: selectedAccount.id, updates: { business_name: editName } },
          { onSuccess: () => toast({ title: "Business name updated" }) }
        );
        break;
      case "suspend":
        updateAccountMutation.mutate(
          { id: selectedAccount.id, updates: { status: "SUSPENDED" } },
          { onSuccess: () => toast({ title: "Business suspended" }) }
        );
        break;
      case "approve":
        updateAccountMutation.mutate(
          { id: selectedAccount.id, updates: { status: "APPROVED" } },
          { onSuccess: () => toast({ title: "Business approved" }) }
        );
        break;
      case "revoke":
        updateAccountMutation.mutate(
          { id: selectedAccount.id, updates: { status: "REJECTED" } },
          { onSuccess: () => toast({ title: "Approval revoked" }) }
        );
        break;
      case "delete":
        deleteAccountMutation.mutate(selectedAccount.id);
        break;
    }
  };

  const filtered = accounts.filter(
    (a: any) =>
      a.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      (a.email && a.email.toLowerCase().includes(search.toLowerCase()))
  );

  const dialogConfig: Record<string, { title: string; description: string; confirmLabel: string; variant: "default" | "destructive" }> = {
    edit: { title: "Edit Business", description: "Update the business name.", confirmLabel: "Save Changes", variant: "default" },
    suspend: { title: "Suspend Business", description: "This will suspend the business and prevent API access.", confirmLabel: "Suspend", variant: "destructive" },
    delete: { title: "Delete Business", description: "This action is permanent and cannot be undone. All associated data will be removed.", confirmLabel: "Delete Permanently", variant: "destructive" },
    approve: { title: "Approve Business", description: "This will set the business status to Live/Approved.", confirmLabel: "Approve", variant: "default" },
    revoke: { title: "Revoke Approval", description: "This will reject the business and revoke API access.", confirmLabel: "Revoke", variant: "destructive" },
  };

  const currentDialog = dialogType && dialogType !== "view" ? dialogConfig[dialogType] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl text-white">Businesses</h1>
          <p className="text-white/40 text-sm mt-1">{filtered.length} registered businesses</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-white/60 text-xs bg-white/[0.05]">
          <RefreshCw className="w-3 h-3 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.05] border-white/10 text-white text-xs rounded-lg h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-white/[0.05] border-white/10 text-white/70 text-xs h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#0d0d1a] border-white/10 text-white">
            <SelectItem value="ALL" className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white">All Statuses</SelectItem>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <SelectItem key={key} value={key} className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              {["Business", "Email", "Status", "KYC", "Created", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold tracking-wider uppercase text-white/30">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-white/30 text-xs">Loading businesses...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-white/30 text-xs">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-white/20" />
                  <div>No businesses found.</div>
                </td>
              </tr>
            ) : (
              filtered.map((account: any) => {
                const status = statusConfig[account.status] || statusConfig.EMAIL_UNVERIFIED;
                const kycStatus = account.kyc_documents?.[0]?.status;
                return (
                  <tr key={account.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 font-bold text-[10px]">
                          {account.business_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div className="text-white/80 font-medium">{account.business_name || "Unnamed"}</div>
                          <div className="text-[10px] text-white/30 font-mono">{account.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/60">{account.email || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {kycStatus ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          kycStatus === "APPROVED" ? "bg-primary/15 text-primary" :
                          kycStatus === "PENDING" ? "bg-yellow-500/15 text-yellow-400" :
                          kycStatus === "REJECTED" ? "bg-red-500/15 text-red-400" :
                          "bg-white/10 text-white/40"
                        }`}>{kycStatus}</span>
                      ) : (
                        <span className="text-white/25 text-[10px]">Not started</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-[10px]">
                      {new Date(account.created_at).toLocaleDateString("en-KE")}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/50 hover:text-white hover:bg-white/[0.08]">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-[#0d0d1a] border-white/10">
                          <DropdownMenuItem onClick={() => openDialog(account, "view")} className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white cursor-pointer">
                            <Eye className="w-3.5 h-3.5 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDialog(account, "edit")} className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white cursor-pointer">
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Business
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(account.id).then(() => toast({ title: "ID copied" }))} className="text-xs text-white/70 focus:bg-white/[0.08] focus:text-white cursor-pointer">
                            <Copy className="w-3.5 h-3.5 mr-2" /> Copy ID
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/[0.08]" />
                          {account.status !== "APPROVED" && (
                            <DropdownMenuItem onClick={() => openDialog(account, "approve")} className="text-xs text-green-400 focus:bg-green-400/10 focus:text-green-400 cursor-pointer">
                              <CheckCircle className="w-3.5 h-3.5 mr-2" /> Approve
                            </DropdownMenuItem>
                          )}
                          {account.status === "APPROVED" && (
                            <DropdownMenuItem onClick={() => openDialog(account, "revoke")} className="text-xs text-orange-400 focus:bg-orange-400/10 focus:text-orange-400 cursor-pointer">
                              <ShieldOff className="w-3.5 h-3.5 mr-2" /> Revoke Approval
                            </DropdownMenuItem>
                          )}
                          {kycStatus === "PENDING" && (
                            <DropdownMenuItem asChild className="text-xs text-yellow-400 focus:bg-yellow-400/10 focus:text-yellow-400 cursor-pointer">
                              <Link to={`/admin/compliance?account=${account.id}`}>
                                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Review KYC
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="bg-white/[0.08]" />
                          {account.status !== "SUSPENDED" ? (
                            <DropdownMenuItem onClick={() => openDialog(account, "suspend")} className="text-xs text-orange-400 focus:bg-orange-400/10 focus:text-orange-400 cursor-pointer">
                              <Ban className="w-3.5 h-3.5 mr-2" /> Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => openDialog(account, "approve")} className="text-xs text-green-400 focus:bg-green-400/10 focus:text-green-400 cursor-pointer">
                              <CheckCircle className="w-3.5 h-3.5 mr-2" /> Unsuspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openDialog(account, "delete")} className="text-xs text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* View Details Dialog */}
      <Dialog open={dialogType === "view" && !!selectedAccount} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="bg-[#0d0d1a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Business Details</DialogTitle>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-3 text-xs">
              {[
                { label: "Business Name", value: selectedAccount.business_name || "Unnamed" },
                { label: "Account ID", value: selectedAccount.id },
                { label: "User ID", value: selectedAccount.user_id },
                { label: "Status", value: selectedAccount.status },
                { label: "API Key (last 4)", value: selectedAccount.api_key_last_four || "—" },
                { label: "Webhook URL", value: selectedAccount.webhook_url || "Not set" },
                { label: "Created", value: new Date(selectedAccount.created_at).toLocaleString("en-KE") },
                { label: "Updated", value: new Date(selectedAccount.updated_at).toLocaleString("en-KE") },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-start gap-4 py-2 border-b border-white/[0.06]">
                  <span className="text-white/40 shrink-0">{row.label}</span>
                  <span className="text-white/80 text-right break-all font-mono text-[11px]">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!currentDialog && !!selectedAccount} onOpenChange={() => setDialogType(null)}>
        <DialogContent className="bg-[#0d0d1a] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">{currentDialog?.title}</DialogTitle>
            <DialogDescription className="text-white/40">{currentDialog?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {dialogType === "edit" && (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Business name"
                className="bg-white/[0.05] border-white/10 text-white text-xs"
              />
            )}
            {selectedAccount && (
              <div className="p-3 bg-white/[0.03] rounded-lg text-xs">
                <span className="text-white/40">Business: </span>
                <span className="text-white/80 font-medium">{selectedAccount.business_name || "Unnamed"}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDialogType(null)} className="text-white/60 text-xs">Cancel</Button>
            <Button
              size="sm"
              variant={currentDialog?.variant === "destructive" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={updateAccountMutation.isPending || deleteAccountMutation.isPending}
              className="text-xs"
            >
              {(updateAccountMutation.isPending || deleteAccountMutation.isPending) ? "Processing..." : currentDialog?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
