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

    const body = await req.json();
    const planSlug = String(body.planSlug ?? "").trim().toLowerCase();
    const billingType = String(body.billingType ?? "PIX").trim().toUpperCase();
    const cpfCnpj = String(body.cpfCnpj ?? "").replace(/\D/g, "");
    const nextDueDate = String(body.nextDueDate ?? "").trim();
    const couponCode = String(body.couponCode ?? "").trim().toUpperCase();

    if (!["profissional", "destaque"].includes(planSlug)) {
      return json({ error: "Plano inválido." }, 400);
    }
    if (!["UNDEFINED", "BOLETO", "PIX", "CREDIT_CARD"].includes(billingType)) {
      return json({ error: "Forma de pagamento inválida." }, 400);
    }
    if (!cpfCnpj) return json({ error: "CPF ou CNPJ é obrigatório para cadastrar o cliente no Asaas." }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) {
      return json({ error: "nextDueDate deve estar no formato YYYY-MM-DD." }, 400);
    }

    const { data: business, error: businessError } = await admin
      .from("business_profiles")
      .select("id,business_name,phone,whatsapp,city,state,cep,address,bairro,asaas_customer_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError) return json({ error: "Não foi possível concluir a operação no momento." }, 500);
    if (!business) return json({ error: "Perfil profissional não encontrado." }, 404);

    const { data: plan, error: planError } = await admin
      .from("plans")
      .select("id,name,slug,price_cents,billing_period,active")
      .eq("slug", planSlug)
      .eq("active", true)
      .maybeSingle();

    if (planError) return json({ error: "Não foi possível concluir a operação no momento." }, 500);
    if (!plan || plan.price_cents <= 0 || plan.billing_period !== "monthly") {
      return json({ error: "Plano não disponível para assinatura mensal." }, 400);
    }

    let coupon: { id: string; code: string; plan_id: string | null; discount_type: "percent" | "fixed"; discount_value: number; active: boolean; expires_at: string | null; claimed_at: string | null; used_at: string | null } | null = null;
    let couponDiscountCents = 0;
    const originalAmountCents = plan.price_cents;

    if (couponCode) {
      const { data: couponRow, error: couponError } = await admin
        .from("coupons")
        .select("id,code,plan_id,discount_type,discount_value,active,expires_at,claimed_at,used_at")
        .eq("code", couponCode)
        .eq("assigned_user_id", user.id)
        .maybeSingle();

      if (couponError) return json({ error: "Não foi possível concluir a operação no momento." }, 500);
      if (!couponRow) return json({ error: "Cupom não encontrado para esta conta." }, 400);
      if (!couponRow.active) return json({ error: "Este cupom não está disponível." }, 400);
      if (couponRow.used_at) return json({ error: "Este cupom já foi utilizado." }, 409);
      if (couponRow.claimed_at) return json({ error: "Este cupom já está reservado em outra contratação." }, 409);
      if (couponRow.expires_at && new Date(couponRow.expires_at).getTime() < Date.now()) return json({ error: "Este cupom está expirado." }, 400);
      if (couponRow.plan_id && couponRow.plan_id !== plan.id) return json({ error: "Este cupom não é válido para este plano." }, 400);

      couponDiscountCents = couponRow.discount_type === "percent"
        ? Math.min(originalAmountCents, Math.round(originalAmountCents * (Number(couponRow.discount_value) / 100)))
        : Math.min(originalAmountCents, Number(couponRow.discount_value));

      if (!Number.isFinite(couponDiscountCents) || couponDiscountCents <= 0 || couponDiscountCents >= originalAmountCents) {
        return json({ error: "Este cupom não gera um desconto válido." }, 400);
      }
      coupon = couponRow;
    }

    const { data: existing } = await admin
      .from("business_subscriptions")
      .select("id,status,plan_id,asaas_subscription_id")
      .eq("business_id", business.id)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.status === "active" && existing.plan_id === plan.id) {
      return json({ error: "Este plano já está ativo." }, 409);
    }
    if (existing?.status === "pending" && existing.plan_id === plan.id) {
      return json({ error: "Já existe uma contratação pendente deste plano. Finalize o pagamento antes de criar outra." }, 409);
    }

    let customerId = business.asaas_customer_id as string | null;

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "LOSI-Conecta/1.0 (Supabase Edge Function; production)",
      "access_token": asaasApiKey,
    };

    const profile = await admin
      .from("profiles")
      .select("full_name,phone")
      .eq("id", user.id)
      .maybeSingle();

    const customerPayload = {
      name: String(profile.data?.full_name || business.business_name).trim(),
      cpfCnpj,
      email: user.email ?? undefined,
      mobilePhone: String(profile.data?.phone || business.whatsapp || business.phone || "").replace(/\D/g, "") || undefined,
      postalCode: business.cep || undefined,
      address: business.address || undefined,
      province: business.bairro || undefined,
      externalReference: business.id,
      notificationDisabled: false,
    };

    // A integração usa externalReference para recuperar o cliente nas próximas compras.
    // Manter o ID nesta solicitação evita gravar campos protegidos do perfil.
    const useCustomerId = async (id: string) => {
      customerId = id;
    };

    // O ID salvo pode ter sido removido no Asaas ou pertencer ao Sandbox.
    // Valida o cadastro antes de criar uma nova assinatura.
    if (customerId) {
      const customerResponse = await fetch(
        `https://api.asaas.com/v3/customers/${encodeURIComponent(customerId)}`,
        { headers },
      );
      const customerData = await customerResponse.json().catch(() => null);

      if (customerResponse.ok && customerData?.deleted !== true) {
        // Cliente Production ativo: reutiliza o mesmo ID.
      } else if (customerResponse.status === 404 || customerData?.deleted === true) {
        // Se foi removido, tenta restaurar para preservar o mesmo ID.
        const restoreResponse = await fetch(
          `https://api.asaas.com/v3/customers/${encodeURIComponent(customerId)}/restore`,
          { method: "POST", headers },
        );

        if (restoreResponse.ok) {
          const restored = await restoreResponse.json().catch(() => null);
          if (restored?.id && restored.deleted !== true) {
            await useCustomerId(restored.id);
          } else {
            customerId = null;
          }
        } else {
          // Pode ser um ID do Sandbox ou um cadastro inexistente na Production.
          customerId = null;
        }
      } else {
        return json({
          error: "Não foi possível validar o cliente no Asaas.",
          status: customerResponse.status,
        }, customerResponse.status);
      }
    }

    if (!customerId) {
      const lookupUrl = new URL("https://api.asaas.com/v3/customers");
      lookupUrl.searchParams.set("externalReference", business.id);
      lookupUrl.searchParams.set("limit", "10");

      const lookup = await fetch(lookupUrl, { headers });
      const lookupData = await lookup.json();

      if (!lookup.ok) {
        return json({ error: "Não foi possível consultar o cliente no Asaas." }, lookup.status);
      }

      const activeCustomer = Array.isArray(lookupData?.data)
        ? lookupData.data.find((item: { id?: string; deleted?: boolean }) => item?.id && item.deleted !== true)
        : null;

      if (activeCustomer?.id) {
        await useCustomerId(activeCustomer.id);
      } else {
        const customerResponse = await fetch("https://api.asaas.com/v3/customers", {
          method: "POST",
          headers,
          body: JSON.stringify(customerPayload),
        });
        const customerData = await customerResponse.json();

        if (!customerResponse.ok) {
          return json({ error: "Não foi possível criar o cliente no Asaas.", status: customerResponse.status }, customerResponse.status);
        }

        if (!customerData?.id) {
          return json({ error: "O Asaas não retornou um ID de cliente válido." }, 502);
        }

        await useCustomerId(customerData.id);
      }
    }

    const finalAmountCents = originalAmountCents - couponDiscountCents;
    const externalReference = `LOSI-${business.id.slice(0, 8)}-${plan.id.slice(0, 8)}-${Date.now().toString(36)}`;

    const subscriptionResponse = await fetch("https://api.asaas.com/v3/subscriptions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType,
        nextDueDate,
        value: Number((finalAmountCents / 100).toFixed(2)),
        cycle: "MONTHLY",
        description: `LOSI CONECTA - Plano ${plan.name}`,
        externalReference,
      }),
    });

    const subscriptionData = await subscriptionResponse.json();

    if (!subscriptionResponse.ok) {
      return json({
        error: "O Asaas recusou a criação da assinatura.",
        status: subscriptionResponse.status,
      }, subscriptionResponse.status);
    }

    let couponClaimed = false;
    if (coupon) {
      const { data: claimedCoupon, error: claimError } = await admin
        .from("coupons")
        .update({ claimed_at: new Date().toISOString() })
        .eq("id", coupon.id)
        .eq("assigned_user_id", user.id)
        .is("claimed_at", null)
        .is("used_at", null)
        .select("id")
        .maybeSingle();

      if (claimError || !claimedCoupon) {
        console.error("Cupom não pôde ser reservado após criar a assinatura Asaas.", { claimError, couponId: coupon.id });
        await fetch(`https://api.asaas.com/v3/subscriptions/${subscriptionData.id}`, { method: "DELETE", headers }).catch(() => null);
        return json({ error: "Este cupom não está mais disponível. A contratação não foi concluída." }, 409);
      }
      couponClaimed = true;
    }

    const { data: createdSubscription, error: insertError } = await admin
      .from("business_subscriptions")
      .insert({
        business_id: business.id,
        plan_id: plan.id,
        status: "pending",
        starts_at: new Date().toISOString(),
        ends_at: null,
        external_reference: externalReference,
        asaas_subscription_id: subscriptionData.id,
        coupon_id: coupon?.id ?? null,
        coupon_discount_cents: couponDiscountCents,
        original_amount_cents: originalAmountCents,
      })
      .select("id,business_id,plan_id,status,starts_at,ends_at,external_reference,asaas_subscription_id,coupon_id,coupon_discount_cents,original_amount_cents")
      .single();

    if (insertError) {
      if (couponClaimed && coupon) {
        await admin.from("coupons").update({ claimed_at: null }).eq("id", coupon.id).eq("assigned_user_id", user.id);
      }
      await fetch(`https://api.asaas.com/v3/subscriptions/${subscriptionData.id}`, { method: "DELETE", headers }).catch(() => null);
      return json({
        error: "Assinatura criada no Asaas, mas não foi possível registrar no LOSI CONECTA.",
        asaas_subscription_id: subscriptionData.id,
      }, 500);
    }

    let firstPayment: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 700 : 1000));
      const paymentsResponse = await fetch(
        `https://api.asaas.com/v3/subscriptions/${subscriptionData.id}/payments?limit=1`,
        { headers },
      );
      const paymentsData = await paymentsResponse.json();
      if (paymentsResponse.ok && paymentsData?.data?.[0]) {
        firstPayment = paymentsData.data[0];
        break;
      }
    }

    return json({
      success: true,
      subscription: {
        id: createdSubscription.id,
        asaas_subscription_id: subscriptionData.id,
        status: "pending",
        plan: plan.name,
        value: finalAmountCents / 100,
        originalValue: originalAmountCents / 100,
        discountCents: couponDiscountCents,
        couponCode: coupon?.code ?? null,
        billingType,
        nextDueDate,
      },
      payment: firstPayment
        ? {
            id: firstPayment.id,
            status: firstPayment.status,
            invoiceUrl: firstPayment.invoiceUrl ?? null,
            bankSlipUrl: firstPayment.bankSlipUrl ?? null,
            dueDate: firstPayment.dueDate ?? nextDueDate,
            value: firstPayment.value ?? finalAmountCents / 100,
          }
        : null,
    });
  } catch (error) {
    console.error("Subscription creation failed", error instanceof Error ? error.message : "Unexpected error");
    return json({ error: "Não foi possível processar a solicitação no momento." }, 500);
  }
});