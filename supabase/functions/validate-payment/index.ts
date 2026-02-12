import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const path = url.pathname.split("/validate-payment")[1] || "";

    // POST /validate-payment/submit - Submit manual payment for verification
    if (req.method === "POST" && path === "/submit") {
      const body = await req.json();
      const {
        transactionId,
        transactionCode,
        payerPhone,
        payerName,
        paymentMethod,
        amountPaid,
        screenshotUrl,
      } = body;

      if (!transactionId || !transactionCode) {
        return new Response(
          JSON.stringify({ success: false, error: "Transaction ID and code are required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // 1. Get the transaction
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (txErr || !tx) {
        return new Response(
          JSON.stringify({ success: false, error: "Transaction not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // 2. Validate transaction code format
      const cleanCode = transactionCode.trim().toUpperCase();
      const validations: any[] = [];

      // Format validation
      const isAlphanumeric = /^[A-Z0-9]{8,12}$/.test(cleanCode);
      validations.push({
        transaction_id: transactionId,
        validation_type: "format_check",
        status: isAlphanumeric ? "passed" : "failed",
        details: { code: cleanCode, format: isAlphanumeric ? "valid" : "invalid_format" },
      });

      // 3. Duplicate detection
      const { data: duplicates } = await supabase
        .from("transactions")
        .select("id, status, created_at")
        .eq("transaction_code", cleanCode)
        .neq("id", transactionId);

      const hasDuplicate = duplicates && duplicates.length > 0;
      validations.push({
        transaction_id: transactionId,
        validation_type: "duplicate_check",
        status: hasDuplicate ? "failed" : "passed",
        details: hasDuplicate
          ? { duplicate_ids: duplicates.map((d: any) => d.id), message: "Code already used" }
          : { message: "No duplicates found" },
      });

      // 4. Amount validation (if provided)
      if (amountPaid !== undefined) {
        const expectedAmount = tx.amount;
        const amountMatch = Math.abs(Number(amountPaid) - Number(expectedAmount)) < 1;
        validations.push({
          transaction_id: transactionId,
          validation_type: "amount_check",
          status: amountMatch ? "passed" : "failed",
          details: {
            expected: expectedAmount,
            paid: amountPaid,
            discrepancy: Number(amountPaid) - Number(expectedAmount),
          },
        });
      }

      // 5. Insert validation logs
      if (validations.length > 0) {
        await supabase.from("transaction_validations").insert(validations);
      }

      // 6. Check for fraud patterns
      const allPassed = validations.every((v: any) => v.status === "passed");

      if (hasDuplicate) {
        // Create fraud alert for duplicate code
        await supabase.from("fraud_alerts").insert({
          transaction_id: transactionId,
          alert_type: "duplicate_transaction_code",
          severity: "high",
          details: {
            code: cleanCode,
            duplicate_transactions: duplicates?.map((d: any) => d.id),
          },
        });
      }

      // 7. Update transaction with payment details
      const updateData: any = {
        transaction_code: cleanCode,
        payment_method: paymentMethod || "MPESA",
        buyer_phone: payerPhone || tx.buyer_phone,
        buyer_name: payerName || tx.buyer_name,
        verification_status: allPassed ? "pending_approval" : "flagged",
        verification_details: {
          validations: validations.map((v: any) => ({
            type: v.validation_type,
            status: v.status,
          })),
          submitted_at: new Date().toISOString(),
        },
        status: "processing", // Move to processing for admin review
      };

      if (screenshotUrl) {
        updateData.screenshot_url = screenshotUrl;
      }

      const { error: updateErr } = await supabase
        .from("transactions")
        .update(updateData)
        .eq("id", transactionId);

      if (updateErr) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to update transaction" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            transactionId,
            verificationStatus: allPassed ? "pending_approval" : "flagged",
            validations: validations.map((v: any) => ({
              type: v.validation_type,
              status: v.status,
            })),
            message: allPassed
              ? "Payment submitted for admin approval"
              : "Payment flagged for manual review",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /validate-payment/approve/:id - Admin approve
    if (req.method === "POST" && path.startsWith("/approve/")) {
      const orderId = path.replace("/approve/", "");
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
        });
      }

      // Verify admin role
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
        });
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roleData || roleData.role !== "admin") {
        return new Response(JSON.stringify({ success: false, error: "Admin access required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403,
        });
      }

      const body = await req.json().catch(() => ({}));

      // Calculate platform fee
      const { data: tx } = await supabase.from("transactions").select("*").eq("id", orderId).single();
      if (!tx) {
        return new Response(JSON.stringify({ success: false, error: "Transaction not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404,
        });
      }

      const feePercent = parseFloat(Deno.env.get("PLATFORM_FEE_PERCENT") || "5");
      const platformFee = (tx.amount * feePercent) / 100;
      const sellerPayout = tx.amount - platformFee;

      const { error: updateErr } = await supabase
        .from("transactions")
        .update({
          status: "paid",
          verification_status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          paid_at: new Date().toISOString(),
          platform_fee: platformFee,
          seller_payout: sellerPayout,
        })
        .eq("id", orderId);

      if (updateErr) {
        return new Response(JSON.stringify({ success: false, error: updateErr.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
        });
      }

      // Update seller wallet
      const { error: rpcErr } = await supabase.rpc("increment_wallet_pending", {
        p_user_id: tx.seller_id,
        p_amount: sellerPayout,
      });
      if (rpcErr) {
        // Fallback: direct update
        const { data: w } = await supabase.from("wallets").select("*").eq("user_id", tx.seller_id).single();
        if (w) {
          await supabase.from("wallets").update({
            pending_balance: (w.pending_balance || 0) + sellerPayout,
          }).eq("user_id", tx.seller_id);
        }
      }

      // Log admin action
      await supabase.from("admin_logs").insert({
        admin_id: user.id,
        action: "approve_payment",
        details: { transaction_id: orderId, amount: tx.amount, fee: platformFee, notes: body.notes },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Payment approved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /validate-payment/reject/:id - Admin reject
    if (req.method === "POST" && path.startsWith("/reject/")) {
      const orderId = path.replace("/reject/", "");
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
        });
      }

      const body = await req.json();
      const reason = body.reason || "Payment verification failed";

      const { error: updateErr } = await supabase
        .from("transactions")
        .update({
          status: "pending",
          verification_status: "rejected",
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
          admin_rejection_reason: reason,
        })
        .eq("id", orderId);

      if (updateErr) {
        return new Response(JSON.stringify({ success: false, error: updateErr.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
        });
      }

      await supabase.from("admin_logs").insert({
        admin_id: user.id,
        action: "reject_payment",
        details: { transaction_id: orderId, reason },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Payment rejected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
    );
  } catch (err) {
    console.error("Validate payment error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
