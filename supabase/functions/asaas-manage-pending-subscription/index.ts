import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!supabaseUrl || !serviceRoleKey || !asaasApiKey) {
      return json({ error: "Configuração necessária não encontrada no Supabase." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Sessão inválida." }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "get").trim().toLowerCase();
    if (!["get", "cancel", "invoices", "ads_invoices", "cancel_ads_invoice"].includes(action)) {
      return json({ error: "Ação inválida." }, 400);
    }

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "LOSI-Conecta/1.0 (Supabase Edge Function; production)",
      "access_token": asaasApiKey,
    };


    if (action === "ads_invoices") {
      const { data: transactions, error: transactionsError } = await admin
        .from("losi_ads_credit_transactions")
        .select("id,asaas_payment_id,external_reference,credits,status")
        .eq("user_id", user.id)
        .eq("type", "purchase")
        .eq("status", "pending");
      if (transactionsError) return json({ error: "Não foi possível carregar suas faturas ADS." }, 500);

      // Payment ownership comes from authenticated purchase records, never a client-supplied customer ID.
      const rows = transactions ?? [];
      const invoices: any[] = [];
      let cursor = 0;
      const worker = async () => {
        while (cursor < rows.length) {
          const transaction = rows[cursor++];
          if (!transaction.asaas_payment_id && !transaction.external_reference) continue;
          const path = transaction.asaas_payment_id
            ? `payments/${encodeURIComponent(transaction.asaas_payment_id)}`
            : `payments?externalReference=${encodeURIComponent(transaction.external_reference)}&limit=100`;
          const response = await fetch(`https://api.asaas.com/v3/${path}`, { headers });
          if (response.status === 404) continue;
          const result = await response.json().catch(() => ({}));
          if (!response.ok || (transaction.asaas_payment_id ? !result.id : !Array.isArray(result.data))) {
            throw new Error("Asaas invoice lookup failed");
          }
          const payments = transaction.asaas_payment_id ? [result] : result.data;
          for (const payment of payments) {
            if (payment.deleted || !["PENDING", "OVERDUE"].includes(String(payment.status).toUpperCase())) continue;
            if (!transaction.asaas_payment_id && payment.externalReference !== transaction.external_reference) continue;
            if (!transaction.asaas_payment_id) {
              const { error } = await admin.from("losi_ads_credit_transactions")
                .update({ asaas_payment_id: payment.id }).eq("id", transaction.id)
                .eq("user_id", user.id).is("asaas_payment_id", null);
              if (error) throw new Error("Could not reconcile invoice ID");
            }
            invoices.push({
              id: payment.id, status: payment.status, dueDate: payment.dueDate ?? null,
              invoiceUrl: payment.invoiceUrl ?? null, bankSlipUrl: payment.bankSlipUrl ?? null,
              billingType: payment.billingType ?? null, value: payment.value ?? null,
              description: payment.description ?? null, type: "ads",
              title: `LOSI ADS · ${transaction.credits} crédito${Number(transaction.credits) === 1 ? "" : "s"}`,
            });
          }
        }
      };
      try {
        await Promise.all(Array.from({ length: Math.min(5, rows.length) }, worker));
      } catch (error) {
        console.error("[ADS_INVOICES] Lookup failed", error instanceof Error ? error.message : "unknown");
        return json({ error: "Não foi possível consultar as faturas no Asaas. Tente novamente." }, 502);
      }
      const uniqueInvoices = Array.from(new Map(invoices.map(invoice => [invoice.id, invoice])).values());
      uniqueInvoices.sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")));
      return json({ success: true, invoices: uniqueInvoices });
    }

    if (action === "cancel_ads_invoice") {
      const paymentId = String(body.paymentId ?? "").trim();
      if (!paymentId) return json({ error: "Fatura ADS não informada." }, 400);

      const { data: adTransaction, error: adTransactionError } = await admin
        .from("losi_ads_credit_transactions")
        .select("id,status,asaas_payment_id")
        .eq("user_id", user.id)
        .eq("asaas_payment_id", paymentId)
        .eq("type", "purchase")
        .maybeSingle();

      if (adTransactionError) return json({ error: "Não foi possível localizar a fatura ADS." }, 500);
      if (!adTransaction) return json({ error: "Esta cobrança não pertence às suas compras de créditos ADS." }, 404);
      if (adTransaction.status === "paid") return json({ error: "Uma cobrança ADS já paga não pode ser cancelada." }, 409);

      const currentResponse = await fetch(
        `https://api.asaas.com/v3/payments/${encodeURIComponent(paymentId)}`, { headers },
      );
      const currentPayment = await currentResponse.json().catch(() => ({}));
      if (!currentResponse.ok) return json({ error: "Não foi possível verificar a cobrança no Asaas. Tente novamente." }, 502);
      if (!currentPayment.deleted && !["PENDING", "OVERDUE"].includes(String(currentPayment.status).toUpperCase())) {
        return json({ error: "Somente faturas pendentes ou vencidas podem ser canceladas." }, 409);
      }
      const paymentResponse = currentPayment.deleted === true ? new Response(JSON.stringify({ deleted: true, id: paymentId })) : await fetch(
        `https://api.asaas.com/v3/payments/${encodeURIComponent(paymentId)}`,
        { method: "DELETE", headers },
      );
      const paymentData = await paymentResponse.json().catch(() => ({}));
      console.log("[ADS_CANCEL] Asaas DELETE result", {
        paymentId,
        httpStatus: paymentResponse.status,
        ok: paymentResponse.ok,
        deleted: paymentData?.deleted ?? null,
        returnedId: paymentData?.id ?? null,
        error: paymentData?.errors?.[0]?.description ?? null,
      });

      if (!paymentResponse.ok) {
        return json({
          error: paymentData?.errors?.[0]?.description || "O Asaas não permitiu cancelar esta fatura ADS.",
          status: paymentResponse.status,
        }, paymentResponse.status);
      }

      if (paymentData?.deleted !== true) {
        return json({
          error: "O Asaas não confirmou a exclusão desta cobrança. A fatura continua pendente.",
          asaasResponse: { deleted: paymentData?.deleted ?? null, id: paymentData?.id ?? null },
        }, 502);
      }

      const verifyResponse = await fetch(
        `https://api.asaas.com/v3/payments/${encodeURIComponent(paymentId)}`,
        { method: "GET", headers },
      );
      const verifyData = await verifyResponse.json().catch(() => ({}));
      const verifyStatus = String(verifyData?.status ?? "").toUpperCase();
      console.log("[ADS_CANCEL] Asaas verify result", {
        paymentId,
        httpStatus: verifyResponse.status,
        ok: verifyResponse.ok,
        status: verifyStatus || null,
        deleted: verifyData?.deleted ?? null,
      });
      if (verifyResponse.status !== 404 && (!verifyResponse.ok || verifyData?.deleted !== true)) {
        return json({
          error: "O Asaas ainda informa esta cobrança como ativa. O LOSI não a marcou como cancelada.",
          asaasStatus: verifyStatus,
        }, 502);
      }

      const { error: updateError } = await admin
        .from("losi_ads_credit_transactions")
        .update({ status: "cancelled" })
        .eq("id", adTransaction.id)
        .eq("user_id", user.id)
        .eq("status", adTransaction.status);

      if (updateError) return json({ error: "A cobrança foi cancelada, mas não foi possível atualizar o LOSI ADS." }, 500);
      return json({ success: true, cancelled: true, paymentId });
    }

    const { data: business, error: businessError } = await admin
      .from("business_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) return json({ error: "Não foi possível concluir a operação no momento." }, 500);
    if (!business) return json({ success: true, pending: null });

    const { data: subscription, error: subscriptionError } = await admin
      .from("business_subscriptions")
      .select("id,status,plan_id,starts_at,ends_at,asaas_subscription_id,coupon_id,plans(name,slug)")
      .eq("business_id", business.id)
      .eq("status", "pending")
      .not("asaas_subscription_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) return json({ error: "Não foi possível concluir a operação no momento." }, 500);
    if (!subscription && action !== "invoices") return json({ success: true, pending: null });

    const asaasSubscriptionId = subscription?.asaas_subscription_id as string;


    if (action === "invoices") {
      const { data: businessWithCustomer, error: customerError } = await admin
        .from("business_profiles")
        .select("id,asaas_customer_id")
        .eq("id", business.id)
        .maybeSingle();

      if (customerError) return json({ error: "Não foi possível concluir a operação no momento." }, 500);
      const customerId = String(businessWithCustomer?.asaas_customer_id ?? "").trim();
      if (!customerId) return json({ success: true, invoices: [] });

      const headers = {
        "Content-Type": "application/json",
        "User-Agent": "LOSI-Conecta/1.0 (Supabase Edge Function; production)",
        "access_token": asaasApiKey,
      };

      const paymentsResponse = await fetch(
        `https://api.asaas.com/v3/payments?customer=${encodeURIComponent(customerId)}&limit=100`,
        { headers },
      );
      const paymentsData = await paymentsResponse.json().catch(() => ({}));
      if (!paymentsResponse.ok) {
        return json({
          error: "Não foi possível consultar as cobranças no Asaas.",
          status: paymentsResponse.status,
        }, paymentsResponse.status);
      }

      const payments = Array.isArray(paymentsData?.data) ? paymentsData.data : [];
      const pendingStatuses = new Set(["PENDING", "OVERDUE"]);

      const { data: adTransactions } = await admin
        .from("losi_ads_credit_transactions")
        .select("asaas_payment_id,credits,amount_cents,status")
        .eq("user_id", user.id)
        .not("asaas_payment_id", "is", null);

      const { data: subscriptions } = await admin
        .from("business_subscriptions")
        .select("asaas_payment_id,asaas_subscription_id,status,plans(name)")
        .eq("business_id", business.id)
        .not("asaas_payment_id", "is", null);

      const adMap = new Map((adTransactions ?? []).map((row: any) => [
        String(row.asaas_payment_id),
        row,
      ]));
      const subMap = new Map((subscriptions ?? []).map((row: any) => [
        String(row.asaas_payment_id),
        row,
      ]));

      const invoices = payments
        .filter((payment: any) => pendingStatuses.has(String(payment?.status ?? "").toUpperCase()))
        .map((payment: any) => {
          const paymentId = String(payment?.id ?? "");
          const ad = adMap.get(paymentId);
          const sub = subMap.get(paymentId);
          const planData = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;

          return {
            id: paymentId,
            status: payment?.status ?? null,
            dueDate: payment?.dueDate ?? null,
            invoiceUrl: payment?.invoiceUrl ?? null,
            bankSlipUrl: payment?.bankSlipUrl ?? null,
            billingType: payment?.billingType ?? null,
            value: payment?.value ?? null,
            description: payment?.description ?? null,
            type: ad ? "ads" : sub ? "subscription" : "other",
            title: ad
              ? `LOSI ADS · ${ad.credits} crédito${Number(ad.credits) === 1 ? "" : "s"}`
              : sub
                ? `Plano ${planData?.name ?? "Profissional"}`
                : (payment?.description ?? "Cobrança LOSI CONECTA"),
          };
        })
        .sort((a: any, b: any) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")));

      return json({ success: true, invoices });
    }

    if (action === "cancel") {
      const cancelResponse = await fetch(
        `https://api.asaas.com/v3/subscriptions/${asaasSubscriptionId}`,
        { method: "DELETE", headers },
      );
      const cancelData = await cancelResponse.json().catch(() => ({}));

      if (!cancelResponse.ok) {
        return json({
          error: "O Asaas não permitiu cancelar esta contratação.",
          status: cancelResponse.status,
        }, cancelResponse.status);
      }

      const { error: updateError } = await admin
        .from("business_subscriptions")
        .update({ status: "cancelled", ends_at: new Date().toISOString() })
        .eq("id", subscription.id)
        .eq("business_id", business.id)
        .eq("status", "pending");

      if (updateError) return json({ error: "Não foi possível concluir a operação no momento." }, 500);

      if (subscription.coupon_id) {
        const { error: couponReleaseError } = await admin
          .from("coupons")
          .update({ claimed_at: null })
          .eq("id", subscription.coupon_id)
          .eq("assigned_user_id", user.id)
          .is("used_at", null);

        if (couponReleaseError) {
          console.error("Não foi possível liberar o cupom da contratação cancelada:", couponReleaseError);
        }
      }

      return json({ success: true, cancelled: true });
    }

    const paymentsResponse = await fetch(
      `https://api.asaas.com/v3/subscriptions/${asaasSubscriptionId}/payments?limit=10`,
      { headers },
    );
    const paymentsData = await paymentsResponse.json().catch(() => ({}));

    if (!paymentsResponse.ok) {
      return json({
        error: "Não foi possível consultar o pagamento pendente no Asaas.",
        status: paymentsResponse.status,
      }, paymentsResponse.status);
    }

    const payments = Array.isArray(paymentsData?.data) ? paymentsData.data : [];
    const payment = payments[0] ?? null;
    const planData = Array.isArray(subscription.plans) ? subscription.plans[0] : subscription.plans;

    return json({
      success: true,
      pending: {
        id: subscription.id,
        planName: planData?.name ?? "Plano",
        planSlug: planData?.slug ?? "",
        dueDate: payment?.dueDate ?? null,
        invoiceUrl: payment?.invoiceUrl ?? null,
        bankSlipUrl: payment?.bankSlipUrl ?? null,
        billingType: payment?.billingType ?? null,
        paymentId: payment?.id ?? null,
        paymentStatus: payment?.status ?? null,
        asaasSubscriptionId,
      },
    });
  } catch (error) {
    return json({ error: "Não foi possível processar a solicitação no momento." }, 500);
  }
});
