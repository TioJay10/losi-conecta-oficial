import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (!webhookToken) return json({ error: "ASAAS_WEBHOOK_TOKEN não configurado." }, 500);

    const receivedToken = req.headers.get("asaas-access-token");
    if (!receivedToken || receivedToken !== webhookToken) {
      return json({ error: "Não autorizado." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configuração do Supabase incompleta." }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const eventId = String(body.id ?? "").trim();
    const eventType = String(body.event ?? "").trim();

    if (!eventId || !eventType) return json({ error: "Evento inválido." }, 400);

    const { error: eventInsertError } = await admin
      .from("asaas_webhook_events")
      .insert({ event_id: eventId, event_type: eventType });

    if (eventInsertError && eventInsertError.code !== "23505") {
      return json({ error: "Não foi possível registrar o evento." }, 500);
    }

    if (eventInsertError?.code === "23505") {
      const { data: existingEvent, error: existingEventError } = await admin
        .from("asaas_webhook_events")
        .select("processed_at,processing_error")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existingEventError) {
        return json({ error: "Não foi possível consultar o estado do evento." }, 500);
      }

      if (existingEvent?.processed_at) {
        return json({ received: true, duplicate: true });
      }
    }

    const payment = body.payment ?? null;
    const subscription = body.subscription ?? null;

    const paymentExternalReference = String(payment?.externalReference ?? "").trim();
    const isAdsCreditPurchase = paymentExternalReference.startsWith("losi_ads_credit:");
    if (paymentExternalReference.startsWith("losi_chat:")) {
      const stateByEvent: Record<string, string> = {
        PAYMENT_CONFIRMED: "CONFIRMED", PAYMENT_RECEIVED: "RECEIVED",
        PAYMENT_REFUNDED: "REFUNDED", PAYMENT_RECEIVED_IN_CASH_UNDONE: "REFUNDED",
        PAYMENT_CHARGEBACK_REQUESTED: "CHARGEBACK_REQUESTED",
        PAYMENT_CHARGEBACK_DISPUTE: "CHARGEBACK_DISPUTE",
        PAYMENT_AWAITING_CHARGEBACK_REVERSAL: "AWAITING_CHARGEBACK_REVERSAL",
        PAYMENT_DELETED: "DELETED",
      };
      const state = stateByEvent[eventType];
      let changed = false;
      if (state) {
        const { data, error } = await admin.rpc("losi_chat_settle_order", {
          p_reference: paymentExternalReference,
          p_payment: String(payment?.id ?? ""),
          p_customer: String(payment?.customer ?? ""),
          p_amount: Math.round(Number(payment?.value ?? 0) * 100),
          p_state: state,
        });
        if (error) return json({ error: "Não foi possível processar a compra Chat LOSI.", retry: true }, 409);
        changed = Boolean(data);
      }
      const { error } = await admin.from("asaas_webhook_events").update({
        processed_at: new Date().toISOString(), processing_error: null,
      }).eq("event_id", eventId);
      if (error) return json({ error: "Não foi possível concluir o registro do evento.", retry: true }, 500);
      return json({ received: true, chat: true, changed });
    }


    if (
      isAdsCreditPurchase &&
      (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED")
    ) {
      const transactionReference = paymentExternalReference;
      const { data: adsTransaction, error: adsTransactionError } = await admin
        .from("losi_ads_credit_transactions")
        .select("id,user_id,credits,amount_cents,status")
        .eq("external_reference", transactionReference)
        .maybeSingle();

      if (adsTransactionError) {
        console.error("LOSI ADS: erro ao localizar transação", adsTransactionError);
        return json({ error: "Não foi possível localizar a compra de créditos ADS.", retry: true }, 500);
      }

      if (!adsTransaction) {
        console.error("LOSI ADS: transação não encontrada", {
          transactionReference,
          paymentId: payment?.id ?? null,
        });
        return json({ error: "Compra ADS ainda não encontrada. O Asaas deve reenviar o evento.", retry: true }, 409);
      }

      const expectedAmountCents = Number(adsTransaction.amount_cents ?? 0);
      const paymentAmountCents = Math.round(Number(payment?.value ?? 0) * 100);

      if (
        !Number.isFinite(expectedAmountCents) ||
        expectedAmountCents <= 0 ||
        !Number.isFinite(paymentAmountCents) ||
        paymentAmountCents !== expectedAmountCents
      ) {
        console.error("LOSI ADS: valor do pagamento não corresponde à compra", {
          transactionId: adsTransaction.id,
          paymentId: payment?.id ?? null,
          paymentValue: payment?.value ?? null,
          paymentAmountCents,
          expectedAmountCents,
        });
        return json({ error: "Valor do pagamento não corresponde à compra ADS." }, 409);
      }

      const paidAtValue =
        payment?.clientPaymentDate ??
        payment?.paymentDate ??
        payment?.dateCreated ??
        new Date().toISOString();

      const { data: granted, error: grantError } = await admin.rpc(
        "grant_losi_ads_credits",
        {
          p_transaction_id: adsTransaction.id,
          p_payment_id: String(payment?.id ?? "").trim() || null,
          p_paid_at: paidAtValue,
        },
      );

      if (grantError) {
        console.error("LOSI ADS: erro ao creditar carteira", grantError);
        return json({ error: "Não foi possível creditar os créditos ADS.", retry: true }, 500);
      }

      if (granted) {
        await admin.from("notifications").insert({
          user_id: adsTransaction.user_id,
          type: "payment_accepted",
          title: "Créditos ADS adicionados",
          message: "O pagamento do pacote LOSI ADS foi confirmado e os créditos já estão disponíveis.",
          link: "/losi-ads",
        });
      }

      const { error: processedAdsEventError } = await admin
        .from("asaas_webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          processing_error: null,
        })
        .eq("event_id", eventId);

      if (processedAdsEventError) {
        return json({ error: "Compra creditada, mas o evento não foi marcado como concluído.", retry: true }, 500);
      }

      return json({ received: true, ads: true, credited: Boolean(granted) });
    }

    console.log("Asaas webhook recebido", {
      eventType,
      paymentId: payment?.id ?? null,
      paymentSubscription: payment?.subscription ?? null,
      subscriptionId: subscription?.id ?? null,
      paymentValue: payment?.value ?? null,
    });

    const resolvedSubscriptionId = String(payment?.subscription ?? subscription?.id ?? "").trim();

    console.log("Asaas webhook identificacao", {
      eventId,
      eventType,
      resolvedSubscriptionId: resolvedSubscriptionId || null,
      hasPayment: Boolean(payment),
      hasSubscription: Boolean(subscription),
    });

    if (resolvedSubscriptionId) {
      const subscriptionId = resolvedSubscriptionId;

      const { data: subscriptionRow } = await admin
        .from("business_subscriptions")
        .select("id,business_id,status,coupon_id,original_amount_cents,coupon_discount_cents,plan:plans(name),business:business_profiles(owner_id)")
        .eq("asaas_subscription_id", subscriptionId)
        .maybeSingle();

      console.log("Asaas webhook assinatura encontrada", {
        subscriptionId,
        found: Boolean(subscriptionRow),
        losiSubscriptionId: subscriptionRow?.id ?? null,
        currentStatus: subscriptionRow?.status ?? null,
      });

      const planData = Array.isArray(subscriptionRow?.plan)
        ? subscriptionRow?.plan[0]
        : subscriptionRow?.plan;
      const businessData = Array.isArray(subscriptionRow?.business)
        ? subscriptionRow?.business[0]
        : subscriptionRow?.business;
      const ownerId = businessData?.owner_id ?? null;
      const planName = planData?.name ?? "seu plano";

      if (
        (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") &&
        !subscriptionRow
      ) {
        console.error("Asaas webhook: assinatura não encontrada no LOSI", {
          subscriptionId,
          eventType,
          paymentId: payment?.id ?? null,
        });
        return json({
          error: "Assinatura ainda não encontrada no LOSI. O Asaas deve reenviar o evento.",
          retry: true,
        }, 409);
      }

      if (
        (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") &&
        subscriptionRow
      ) {
        const wasAlreadyActive = subscriptionRow.status === "active";

        // Validate the amount before granting plan access.
        const paymentAmountCents = Math.round(Number(payment.value ?? 0) * 100);
        const expectedAmountCents =
          Number(subscriptionRow.original_amount_cents ?? 0) -
          Number(subscriptionRow.coupon_discount_cents ?? 0);

        if (
          !Number.isFinite(paymentAmountCents) ||
          paymentAmountCents <= 0 ||
          !Number.isFinite(expectedAmountCents) ||
          expectedAmountCents <= 0 ||
          paymentAmountCents !== expectedAmountCents
        ) {
          console.error("Asaas webhook: valor do pagamento não corresponde à contratação LOSI", {
            subscriptionId,
            losiSubscriptionId: subscriptionRow.id,
            paymentId: payment?.id ?? null,
            paymentValue: payment.value ?? null,
            paymentAmountCents,
            expectedAmountCents,
          });
          return json({
            error: "Valor do pagamento não corresponde ao valor da contratação.",
            received: false,
          }, 409);
        }
        const paidAmount =
          typeof payment.value === "number"
            ? payment.value
            : Number(payment.value ?? 0);
        const paidAtValue =
          payment.clientPaymentDate ??
          payment.paymentDate ??
          payment.dateCreated ??
          new Date().toISOString();

        const updateData: Record<string, unknown> = {
          status: "active",
          asaas_payment_id: payment.id ?? null,
          paid_amount: Number.isFinite(paidAmount) ? paidAmount : null,
          paid_at: paidAtValue,
        };

        if (!wasAlreadyActive) {
          updateData.starts_at = paidAtValue;
        }

        // A tabela permite apenas um plano ativo por empresa.
        // Se já existir outro plano ativo (por exemplo, ativado manualmente pelo admin),
        // ele é encerrado antes de ativarmos o pagamento confirmado pelo Asaas.
        const { error: activeConflictError } = await admin
          .from("business_subscriptions")
          .update({
            status: "cancelled",
            ends_at: paidAtValue,
          })
          .eq("business_id", subscriptionRow.business_id)
          .eq("status", "active")
          .neq("id", subscriptionRow.id);

        if (activeConflictError) {
          console.error("Erro ao encerrar plano ativo anterior:", activeConflictError);
          return json({ error: "Não foi possível preparar a ativação do plano." }, 500);
        }

        console.log("Asaas webhook atualizando assinatura LOSI", {
          subscriptionId,
          losiSubscriptionId: subscriptionRow.id,
          updateData,
        });

        const { error: subscriptionUpdateError } = await admin
          .from("business_subscriptions")
          .update(updateData)
          .eq("asaas_subscription_id", subscriptionId);

        if (subscriptionUpdateError) {
          console.error("Erro ao atualizar assinatura LOSI:", subscriptionUpdateError);
          return json({ error: "Não foi possível atualizar a assinatura." }, 500);
        }

        if (subscriptionRow.coupon_id) {
          const { error: couponUseError } = await admin
            .from("coupons")
            .update({
              used_at: paidAtValue,
              used_subscription_id: subscriptionRow.id,
            })
            .eq("id", subscriptionRow.coupon_id)
            .is("used_at", null);

          if (couponUseError) {
            console.error("Não foi possível marcar o cupom como utilizado:", couponUseError);
          }
        }

        console.log("Asaas webhook assinatura LOSI atualizada", {
          subscriptionId,
          losiSubscriptionId: subscriptionRow.id,
          paymentId: payment?.id ?? null,
          paidAmount: updateData.paid_amount ?? null,
          paidAt: updateData.paid_at ?? null,
        });

        if (ownerId && !wasAlreadyActive) {
          await admin.from("notifications").insert({
            user_id: ownerId,
            type: "payment_accepted",
            title: "Pagamento aprovado",
            message: `O pagamento do plano ${planName} foi confirmado. Seu plano já está ativo.`,
            link: "/painel",
          });
        }
      }

      if (
        eventType === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED" ||
        eventType === "PAYMENT_REPROVED_BY_RISK_ANALYSIS"
      ) {
        if (ownerId) {
          await admin.from("notifications").insert({
            user_id: ownerId,
            type: "payment_refused",
            title: "Pagamento recusado",
            message: `O pagamento do plano ${planName} foi recusado pelo processamento do Asaas. Você pode tentar novamente com outra forma de pagamento.`,
            link: "/painel#planos",
          });
        }
      }

      if (
        eventType === "PAYMENT_REFUNDED" ||
        eventType === "PAYMENT_RECEIVED_IN_CASH_UNDONE"
      ) {
        await admin
          .from("business_subscriptions")
          .update({
            status: "cancelled",
            asaas_payment_id: payment.id ?? null,
          })
          .eq("asaas_subscription_id", subscriptionId);

        if (ownerId) {
          await admin.from("notifications").insert({
            user_id: ownerId,
            type: "payment_refunded",
            title: "Pagamento estornado",
            message: `O pagamento do plano ${planName} foi estornado e a assinatura foi cancelada.`,
            link: "/painel",
          });
        }
      }
    }

    if (eventType === "SUBSCRIPTION_INACTIVATED" || eventType === "SUBSCRIPTION_DELETED") {
      const subscriptionId = String(subscription?.id ?? "").trim();
      if (subscriptionId) {
        const { data: cancelledRows } = await admin
          .from("business_subscriptions")
          .select("id,business_id,status,plan:plans(name),business:business_profiles(owner_id)")
          .eq("asaas_subscription_id", subscriptionId)
          .eq("status", "active");

        await admin
          .from("business_subscriptions")
          .update({ status: "cancelled", ends_at: new Date().toISOString() })
          .eq("asaas_subscription_id", subscriptionId);

        for (const row of cancelledRows ?? []) {
          const planData = Array.isArray(row.plan) ? row.plan[0] : row.plan;
          const businessData = Array.isArray(row.business) ? row.business[0] : row.business;
          if (businessData?.owner_id) {
            await admin.from("notifications").insert({
              user_id: businessData.owner_id,
              type: "plan_terminated",
              title: "Plano encerrado",
              message: `Seu plano ${planData?.name ?? "atual"} foi encerrado no Asaas.`,
              link: "/painel#planos",
            });
          }
        }
      }
    }

    const { error: processedEventError } = await admin
      .from("asaas_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("event_id", eventId);

    if (processedEventError) {
      return json({ error: "Evento recebido, mas não foi possível marcar o processamento como concluído." }, 500);
    }

    return json({ received: true });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Erro inesperado.",
    }, 500);
  }
});
