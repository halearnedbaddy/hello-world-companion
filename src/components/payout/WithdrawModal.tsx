import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Smartphone, Building2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type PayoutMethod = "mpesa" | "airtel" | "bank";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBalance: number;
  currency?: string;
}

const methods: { id: PayoutMethod; label: string; icon: typeof Smartphone; description: string }[] = [
  { id: "mpesa", label: "M-Pesa", icon: Smartphone, description: "Instant to your M-Pesa" },
  { id: "airtel", label: "Airtel Money", icon: Smartphone, description: "Instant to Airtel Money" },
  { id: "bank", label: "Bank Transfer", icon: Building2, description: "1-3 business days" },
];

export function WithdrawModal({ open, onOpenChange, availableBalance, currency = "KES" }: WithdrawModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"method" | "details" | "confirm" | "success">("method");
  const [method, setMethod] = useState<PayoutMethod>("mpesa");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const fee = method === "bank" ? 50 : 0;
  const numAmount = parseFloat(amount) || 0;
  const netAmount = numAmount - fee;
  const isValidAmount = numAmount >= 100 && numAmount <= availableBalance;

  const resetForm = () => {
    setStep("method");
    setMethod("mpesa");
    setAmount("");
    setPhone("");
    setBankName("");
    setAccountNumber("");
    setAccountName("");
  };

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Get or create payment method
      const pmData: any = {
        user_id: user.id,
        type: method === "bank" ? "bank_account" : "mobile_money",
        provider: method === "mpesa" ? "M-Pesa" : method === "airtel" ? "Airtel Money" : bankName,
        account_number: method === "bank" ? accountNumber : phone,
        account_name: method === "bank" ? accountName : phone,
      };

      const { data: pm, error: pmError } = await supabase
        .from("payment_methods")
        .upsert(pmData, { onConflict: "id" })
        .select("id")
        .single();

      // If upsert fails, insert fresh
      let paymentMethodId: string;
      if (pmError) {
        const { data: newPm, error: insertErr } = await supabase
          .from("payment_methods")
          .insert(pmData)
          .select("id")
          .single();
        if (insertErr || !newPm) throw new Error("Failed to save payment method");
        paymentMethodId = newPm.id;
      } else {
        paymentMethodId = pm.id;
      }

      // Create withdrawal request
      const { error: wError } = await supabase.from("withdrawals").insert({
        user_id: user.id,
        amount: numAmount,
        fee: fee,
        net_amount: netAmount,
        payment_method_id: paymentMethodId,
        status: "pending",
        reference: `WD-${Date.now()}`,
      });

      if (wError) throw wError;
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      toast({ title: "Withdrawal requested!", description: `${currency} ${numAmount.toLocaleString()} will be sent shortly.` });
    },
    onError: (err: any) => {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0d0d1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {step === "success" ? "Withdrawal Submitted" : "Withdraw Funds"}
          </DialogTitle>
          <DialogDescription className="text-white/40 text-xs">
            {step === "method" && "Choose your withdrawal method"}
            {step === "details" && "Enter withdrawal details"}
            {step === "confirm" && "Review and confirm"}
            {step === "success" && "Your request is being processed"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Method */}
        {step === "method" && (
          <div className="space-y-3 mt-2">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-3 flex items-center justify-between">
              <span className="text-xs text-white/50">Available Balance</span>
              <span className="font-display font-bold text-primary">{currency} {availableBalance.toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setMethod(m.id); setStep("details"); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                    border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.06] hover:border-primary/30`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <m.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{m.label}</div>
                    <div className="text-[11px] text-white/40">{m.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs text-white/60 mb-1.5 block">Amount ({currency})</Label>
              <Input
                type="number"
                placeholder="Min 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white/[0.04] border-white/10 text-white"
              />
              {numAmount > availableBalance && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Exceeds available balance
                </p>
              )}
            </div>

            {(method === "mpesa" || method === "airtel") && (
              <div>
                <Label className="text-xs text-white/60 mb-1.5 block">Phone Number</Label>
                <Input
                  placeholder="e.g. 0712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-white/[0.04] border-white/10 text-white"
                />
              </div>
            )}

            {method === "bank" && (
              <>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5 block">Bank Name</Label>
                  <Input
                    placeholder="e.g. Equity Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-white/[0.04] border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5 block">Account Number</Label>
                  <Input
                    placeholder="Account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="bg-white/[0.04] border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5 block">Account Name</Label>
                  <Input
                    placeholder="Name on account"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="bg-white/[0.04] border-white/10 text-white"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("method")} className="flex-1 text-white/60 bg-white/[0.04]">Back</Button>
              <Button
                onClick={() => setStep("confirm")}
                disabled={!isValidAmount || (method !== "bank" && !phone) || (method === "bank" && (!bankName || !accountNumber || !accountName))}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4 mt-2">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Method</span>
                <span className="text-white font-medium">{methods.find(m => m.id === method)?.label}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Destination</span>
                <span className="text-white font-medium">{method === "bank" ? `${bankName} ****${accountNumber.slice(-4)}` : phone}</span>
              </div>
              <div className="border-t border-white/[0.06] pt-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Amount</span>
                  <span className="text-white">{currency} {numAmount.toLocaleString()}</span>
                </div>
                {fee > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">Fee</span>
                    <span className="text-red-400">- {currency} {fee}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white/70">You receive</span>
                  <span className="text-primary">{currency} {netAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("details")} className="flex-1 text-white/60 bg-white/[0.04]">Back</Button>
              <Button
                onClick={() => withdrawMutation.mutate()}
                disabled={withdrawMutation.isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Withdrawal"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-white font-semibold">{currency} {numAmount.toLocaleString()}</p>
              <p className="text-xs text-white/40 mt-1">Your withdrawal is being processed</p>
            </div>
            <Button onClick={handleClose} className="bg-primary hover:bg-primary/90 w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
