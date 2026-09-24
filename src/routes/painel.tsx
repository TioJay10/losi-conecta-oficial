import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/painel")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null; user_type: "professional" | "admin" } | null>(null);
  const [hasBusinessProfile, setHasBusinessProfile] = useState(false);
  const [plans, setPlans] = useState<Array<{id:string;name:string;slug:string;description:string|null;price_cents:number;billing_period:string;highlighted:boolean}>>([]);
  const [currentPlan, setCurrentPlan] = useState<{name:string;ends_at:string|null}|null>(null);
  const [quotesSentThisMonth, setQuotesSentThisMonth] = useState(0);
  const [supplierRequestsReceived, setSupplierRequestsReceived] = useState(0);
  const [supplierRequestsPending, setSupplierRequestsPending] = useState(0);
  const [clientQuotesReceived, setClientQuotesReceived] = useState(0);
  const [clientRequestsPending, setClientRequestsPending] = useState(0);
  const [activeDashboardMetric, setActiveDashboardMetric] = useState<"received" | "pending" | "sent" | "client-received" | "client-pending" | null>(null);
  const [savedBusinesses, setSavedBusinesses] = useState<{ id: string; business_name: string; slug: string; city: string | null; state: string | null }[]>([]);
  const [businessStatus, setBusinessStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [specificationsPlan, setSpecificationsPlan] = useState<{ name: string; description: string | null; price: string } | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; title: string; message: string; link: string | null; read_at: string | null; created_at: string }>>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [goldenHeartOpen, setGoldenHeartOpen] = useState(false);
  const [goldenHeartClaiming, setGoldenHeartClaiming] = useState(false);
  const [goldenHeartMessage, setGoldenHeartMessage] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<{ slug: string; name: string; price: string } | null>(null);
  const [paymentBillingType, setPaymentBillingType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const [paymentCpfCnpj, setPaymentCpfCnpj] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState<{ invoiceUrl: string | null; dueDate: string | null; pixPayload: string | null; pixEncodedImage: string | null } | null>(null);
  const [pendingSubscription, setPendingSubscription] = useState<{
    id: string;
    planName: string;
    planSlug: string;
    dueDate: string | null;
    invoiceUrl: string | null;
    billingType: string | null;
    asaasSubscriptionId: string;
  } | null>(null);
  const [pendingSubscriptionLoading, setPendingSubscriptionLoading] = useState(false);
  const [pendingSubscriptionAction, setPendingSubscriptionAction] = useState<"resume" | "cancel" | null>(null);
  const [pendingSubscriptionMessage, setPendingSubscriptionMessage] = useState("");

  async function loadPendingSubscription() {
    if (!supabase || !user) return;
    setPendingSubscriptionLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return;

      const response = await fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/asaas-manage-pending-subscription", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get" }),
      });
      const result = await response.json();
      if (response.ok && result?.success) {
        setPendingSubscription(result.pending ?? null);
      }
    } catch (error) {
      console.error("Erro ao carregar contratação pendente:", error);
    } finally {
      setPendingSubscriptionLoading(false);
    }
  }

  async function resumePendingSubscription() {
    if (!pendingSubscription?.invoiceUrl || pendingSubscriptionAction) return;
    setPendingSubscriptionAction("resume");
    setPendingSubscriptionMessage("");
    window.open(pendingSubscription.invoiceUrl, "_blank", "noopener,noreferrer");
    setPendingSubscriptionAction(null);
  }

  async function cancelPendingSubscription() {
    if (!pendingSubscription || pendingSubscriptionAction || !supabase) return;
    const confirmed = window.confirm("Deseja realmente cancelar esta contratação pendente? Depois disso você poderá iniciar uma nova contratação.");
    if (!confirmed) return;

    setPendingSubscriptionAction("cancel");
    setPendingSubscriptionMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente para continuar.");

      const response = await fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/asaas-manage-pending-subscription", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Não foi possível cancelar a contratação.");
      }

      setPendingSubscription(null);
      setPendingSubscriptionMessage("Contratação cancelada. Você já pode contratar outro plano.");
    } catch (error) {
      setPendingSubscriptionMessage(error instanceof Error ? error.message : "Não foi possível cancelar a contratação.");
    } finally {
      setPendingSubscriptionAction(null);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        navigate({ to: "/entrar" });
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        if (mounted) {
          setLoading(false);
          navigate({ to: "/entrar" });
        }
        return;
      }

      const currentUser = userData.user;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,avatar_url,user_type,blocked")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setLoading(false);
        console.error("Erro ao carregar perfil:", error);
        return;
      }

      if (!data) {
        setLoading(false);
        console.error("Perfil do usuário não encontrado:", currentUser.id);
        return;
      }

      if (data.blocked) {
        await supabase.auth.signOut();
        setLoading(false);
        navigate({ to: "/entrar" });
        return;
      }

      if (data.user_type === "admin") {
        navigate({ to: "/admin" });
        return;
      }

      const { data: business, error: businessError } = await supabase
        .from("business_profiles")
        .select("id,approval_status")
        .eq("owner_id", currentUser.id)
        .maybeSingle();

      if (businessError) {
        console.error("Erro ao carregar empresa:", businessError);
      }

      if (mounted) {
        setBusinessStatus(
          (business?.approval_status as "pending" | "approved" | "rejected" | null) ?? null,
        );
      }

      const { data: plansRows, error: plansError } = await supabase
        .from("plans")
        .select("id,name,slug,description,price_cents,billing_period,highlighted")
        .eq("active", true)
        .order("price_cents");

      if (plansError) {
        console.error("Erro ao carregar planos:", plansError);
      }

      if (mounted) setPlans((plansRows ?? []) as typeof plans);

      if (business?.id) {
        const { data: sub, error: subscriptionError } = await supabase
          .from("business_subscriptions")
          .select("ends_at,plan:plans(name)")
          .eq("business_id", business.id)
          .eq("status", "active")
          .maybeSingle();

        if (subscriptionError) {
          console.error("Erro ao carregar assinatura:", subscriptionError);
        }

        const planData = Array.isArray(sub?.plan) ? sub?.plan[0] : sub?.plan;
        if (planData && mounted) {
          setCurrentPlan({ name: planData.name, ends_at: sub?.ends_at ?? null });
        }

        const firstDay = new Date();
        firstDay.setDate(1);
        firstDay.setHours(0, 0, 0, 0);

        const { count: receivedCount, error: receivedError } = await supabase
          .from("quote_requests")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id);

        const { data: supplierRequestRows, error: supplierPendingError } = await supabase
          .from("quote_requests")
          .select("id")
          .eq("business_id", business.id)
          .eq("status", "pending");

        const { count: quoteCount, error: quoteError } = await supabase
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .not("sent_at", "is", null)
          .gte("sent_at", firstDay.toISOString());

        if (receivedError) console.error("Erro ao carregar solicitações recebidas:", receivedError);
        if (supplierPendingError) console.error("Erro ao carregar solicitações pendentes:", supplierPendingError);
        if (quoteError) console.error("Erro ao carregar quantidade de orçamentos:", quoteError);

        if (mounted) {
          setSupplierRequestsReceived(receivedCount ?? 0);
          setSupplierRequestsPending((supplierRequestRows ?? []).length);
          setQuotesSentThisMonth(quoteCount ?? 0);
        }
      }

      // Métricas do lado de quem procura: todo usuário pode solicitar
      // orçamentos, mesmo sem possuir um perfil de fornecedor.
      const { data: clientRequestRows, error: clientRequestsError } = await supabase
        .from("quote_requests")
        .select("id")
        .eq("requester_id", currentUser.id);

      const { count: receivedByClientCount, error: receivedByClientError } = await supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("client_id", currentUser.id);

      if (clientRequestsError) {
        console.error("Erro ao carregar solicitações feitas pelo usuário:", clientRequestsError);
      }
      if (receivedByClientError) {
        console.error("Erro ao carregar orçamentos recebidos pelo usuário:", receivedByClientError);
      }

      const requestedIds = (clientRequestRows ?? []).map((row) => row.id);
      let pendingClientCount = requestedIds.length;

      if (requestedIds.length > 0) {
        const { data: answeredRequests, error: answeredRequestsError } = await supabase
          .from("quotes")
          .select("request_id")
          .in("request_id", requestedIds);

        if (answeredRequestsError) {
          console.error("Erro ao verificar solicitações já orçadas:", answeredRequestsError);
        } else {
          const answeredIds = new Set((answeredRequests ?? []).map((row) => row.request_id));
          pendingClientCount = requestedIds.filter((id) => !answeredIds.has(id)).length;
        }
      }

      if (mounted) {
        setClientRequestsPending(pendingClientCount);
        setClientQuotesReceived(receivedByClientCount ?? 0);
      }

      const { data: favoriteRows, error: favoritesError } = await supabase
        .from("favorites")
        .select("business_id")
        .eq("user_id", currentUser.id);

      if (favoritesError) {
        console.error("Erro ao carregar favoritos:", favoritesError);
      }

      const ids = (favoriteRows ?? []).map((row) => row.business_id);

      if (ids.length) {
        const { data: saved, error: savedBusinessesError } = await supabase
          .from("business_profiles")
          .select("id,business_name,slug,city,state")
          .in("id", ids)
          .eq("active", true)
          .eq("approval_status", "approved")
          .order("business_name");

        if (savedBusinessesError) {
          console.error("Erro ao carregar fornecedores salvos:", savedBusinessesError);
        }

        if (mounted) setSavedBusinesses(saved ?? []);
      }

      if (!mounted) return;

      setUser(currentUser);
      setProfile(data);
      setHasBusinessProfile(Boolean(business));
      setLoading(false);

      if (business?.id) {
        window.setTimeout(() => {
          void loadPendingSubscription();
        }, 0);
      }
    }

    load();

    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/entrar" });
    }) ?? { data: { subscription: { unsubscribe() {} } } };

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  }

  useEffect(() => {
    if (!user || !supabase) return;

    let mounted = true;

    async function loadNotifications() {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,message,link,read_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("Erro ao carregar notificações:", error);
        return;
      }

      if (mounted) setNotifications((data ?? []) as typeof notifications);
    }

    void loadNotifications();

    const channel = supabase
      .channel("panel-notifications-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + user.id },
        (payload) => {
          const notification = payload.new as typeof notifications[number];
          setNotifications((current) => [
            notification,
            ...current.filter((item) => item.id !== notification.id),
          ].slice(0, 30));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("conquista") === "coracao-dourado") {
      setGoldenHeartOpen(true);
      window.history.replaceState({}, "", "/painel");
      return;
    }

    if (window.location.hash === "#planos") {
      window.setTimeout(() => {
        document.getElementById("planos")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [user]);

  async function markNotificationAsRead(notificationId: string) {
    if (!supabase || !user) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: readAt }
          : notification,
      ),
    );
  }

  async function openNotification(notification: typeof notifications[number]) {
    if (!notification.read_at) {
      await markNotificationAsRead(notification.id);
    }
    setNotificationsOpen(false);
    if (notification.type === "golden_heart") {
      setGoldenHeartMessage("");
      setGoldenHeartOpen(true);
      return;
    }
    if (notification.link) window.location.href = notification.link;
  }

  function openPaymentModal(plan: { slug: string; name: string; price: string }) {
    setPaymentPlan(plan);
    setPaymentBillingType("PIX");
    setPaymentCpfCnpj("");
    setPaymentError("");
    setPaymentSuccess(null);
  }

  function closePaymentModal() {
    if (paymentLoading) return;
    setPaymentPlan(null);
    setPaymentError("");
    setPaymentSuccess(null);
  }

  async function startPayment() {
    if (!paymentPlan || !supabase || paymentLoading) return;
    const cleanCpfCnpj = paymentCpfCnpj.replace(/\D/g, "");
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      setPaymentError("Informe um CPF com 11 números ou um CNPJ com 14 números.");
      return;
    }
    setPaymentLoading(true);
    setPaymentError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente para continuar.");

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 1);
      const nextDueDateText = [
        nextDueDate.getFullYear(),
        String(nextDueDate.getMonth() + 1).padStart(2, "0"),
        String(nextDueDate.getDate()).padStart(2, "0"),
      ].join("-");

      const response = await fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/asaas-create-subscription", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: paymentPlan.slug, billingType: paymentBillingType, cpfCnpj: cleanCpfCnpj, nextDueDate: nextDueDateText }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        const details = result?.details;
        const detailMessage = Array.isArray(details?.errors)
          ? details.errors
              .map((item: { description?: string; code?: string }) =>
                [item.code, item.description].filter(Boolean).join(": "),
              )
              .filter(Boolean)
              .join(" | ")
          : typeof details?.message === "string"
            ? details.message
            : typeof details === "string"
              ? details
              : "";

        const statusText = result?.status ? " (HTTP " + result.status + ")" : "";
        throw new Error(
          [result?.error || "Não foi possível iniciar a contratação." + statusText, detailMessage]
            .filter(Boolean)
            .join(" — "),
        );
      }

      setPaymentSuccess({
        invoiceUrl: result.payment?.invoiceUrl ?? null,
        dueDate: result.payment?.dueDate ?? nextDueDateText,
        pixPayload: result.payment?.pixQrCode?.payload ?? null,
        pixEncodedImage: result.payment?.pixQrCode?.encodedImage ?? null,
      });
      setPendingSubscription({
        id: result.subscription?.id ?? "",
        planName: result.subscription?.plan ?? paymentPlan.name,
        planSlug: paymentPlan.slug,
        dueDate: result.payment?.dueDate ?? nextDueDateText,
        invoiceUrl: result.payment?.invoiceUrl ?? null,
        billingType: result.subscription?.billingType ?? paymentBillingType,
        asaasSubscriptionId: result.subscription?.asaas_subscription_id ?? "",
      });
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Não foi possível iniciar a contratação.");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function claimGoldenHeartReward() {
    if (goldenHeartClaiming || !supabase) return;
    setGoldenHeartClaiming(true);
    setGoldenHeartMessage("");
    const { data, error } = await supabase.rpc("claim_golden_heart_reward");
    if (error) {
      console.error("Erro ao ativar benefício do Coração Dourado:", error);
      setGoldenHeartMessage("Não foi possível ativar o benefício agora. Tente novamente.");
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.success) {
        setGoldenHeartMessage("Plano Destaque gratuito de 1 mês ativado com sucesso.");
      } else {
        setGoldenHeartMessage(result?.message || "Nenhum benefício disponível para ativação.");
      }
    }
    setGoldenHeartClaiming(false);
  }

  if (loading) return <main className="dashboard-loading">Carregando sua conta...</main>;
  if (!user || !profile) return null;

  return (
    <main className="dashboard-page">
      {mobileMenuOpen && <button type="button" className="dashboard-mobile-menu-overlay" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`dashboard-sidebar${mobileMenuOpen ? " mobile-open" : ""}`}>
        <div className="dashboard-sidebar-brand"><span>LOSI</span><strong>CONECTA</strong></div>
        <div className="dashboard-sidebar-caption">PAINEL PROFISSIONAL</div>
        <nav className="dashboard-sidebar-nav" aria-label="Menu do painel">
          <button type="button" className="dashboard-nav-item active" onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span className="dashboard-nav-mark">01</span><span><strong>Visão geral</strong><small>Resumo da conta</small></span>
          </button>
          <button type="button" className="dashboard-nav-item" onClick={() => { setMobileMenuOpen(false); navigate({ to: "/buscar" }); }}>
            <span className="dashboard-nav-mark">02</span><span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span>
          </button>
          <button type="button" className="dashboard-nav-item" onClick={() => { setMobileMenuOpen(false); navigate({ to: "/meu-perfil" }); }}>
            <span className="dashboard-nav-mark">03</span><span><strong>Meu perfil</strong><small>Dados pessoais</small></span>
          </button>
          <button type="button" className="dashboard-nav-item" onClick={() => { setMobileMenuOpen(false); navigate({ to: "/meus-servicos" }); }}>
            <span className="dashboard-nav-mark">04</span><span><strong>Minha empresa</strong><small>Serviços e presença</small></span>
          </button>
          <button type="button" className="dashboard-nav-item" onClick={() => { setMobileMenuOpen(false); navigate({ to: "/orcamentos" }); }}>
            <span className="dashboard-nav-mark">05</span><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span>
          </button>
        </nav>
        <div className="dashboard-sidebar-footer">
          <div className="dashboard-sidebar-status"><span></span> Conta profissional</div>
          <button className="dashboard-sidebar-logout" onClick={logout}>Sair da conta</button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header">
          <button type="button" className="dashboard-mobile-menu-button" onClick={() => setMobileMenuOpen((value) => !value)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen}>
            <span></span><span></span><span></span>
          </button>
          <div className="dashboard-header-context"><span>ÁREA EXCLUSIVA</span><strong>Seu espaço profissional</strong></div>
          <div className="dashboard-header-right">
            <div className="dashboard-notifications">
              <button
                type="button"
                className="dashboard-notification-bell"
                aria-label={notifications.filter((notification) => !notification.read_at).length ? "Abrir notificações não lidas" : "Abrir notificações"}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <svg className="dashboard-notification-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
                {notifications.filter((notification) => !notification.read_at).length > 0 && (
                  <span className="dashboard-notification-count">
                    {Math.min(99, notifications.filter((notification) => !notification.read_at).length)}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="dashboard-notification-popover" role="dialog" aria-label="Notificações">
                  <div className="dashboard-notification-head">
                    <div>
                      <strong>Notificações</strong>
                      <span>{notifications.filter((notification) => !notification.read_at).length} não lidas</span>
                    </div>
                    <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Fechar notificações">×</button>
                  </div>
                  <div className="dashboard-notification-list">
                    {notifications.length === 0 ? (
                      <div className="dashboard-notification-empty">Você ainda não tem notificações.</div>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className={"dashboard-notification-item" + (notification.read_at ? "" : " unread")}
                          onClick={() => void openNotification(notification)}
                        >
                          <span className="dashboard-notification-dot" aria-hidden="true"></span>
                          <span>
                            <strong>{notification.title}</strong>
                            <small>{notification.message}</small>
                            <em>{new Date(notification.created_at).toLocaleString("pt-BR")}</em>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="dashboard-header-user">
              {profile.avatar_url ? (
                <img
                  className="dashboard-header-user-avatar"
                  src={profile.avatar_url}
                  alt={profile.full_name ? `Foto de ${profile.full_name}` : "Foto do perfil"}
                />
              ) : (
                <span>{(profile.full_name || user.email || "P").slice(0, 1).toUpperCase()}</span>
              )}
              <div><strong>{profile.full_name || "Profissional"}</strong><small>{user.email}</small></div>
            </div>
            <button className="dashboard-logout" onClick={logout}>Sair</button>
          </div>
        </header>

      <section className="dashboard-content">
        <div className="dashboard-badge">PROFISSIONAL</div>
        <h1>Olá, {profile.full_name || user.email?.split("@")[0] || "profissional"}.</h1>
        <p className="dashboard-text">Sua conta profissional está autenticada e conectada ao LOSI CONECTA.</p>

        {!hasBusinessProfile ? (
          <section className="dashboard-onboarding">
            <div>
              <div className="dashboard-onboarding-label">PRIMEIRO PASSO</div>
              <h2 className="dashboard-onboarding-title">Crie seu perfil comercial</h2>
              <p className="dashboard-onboarding-text">
                Apresente sua empresa, cadastre seus serviços e envie seu perfil para análise da administração.
                Depois da aprovação, ele ficará disponível no catálogo.
              </p>
            </div>
            <button className="dashboard-primary" onClick={() => navigate({ to: "/meus-servicos" })}>
              Criar perfil da empresa →
            </button>
          </section>
        ) : (
          <div className="dashboard-grid">
            <button type="button" onClick={() => navigate({ to: "/buscar" })}>
              <strong>Encontrar fornecedores</strong>
              <span>Pesquise profissionais e empresas para seus eventos.</span>
            </button>
            <button type="button" onClick={() => navigate({ to: "/meu-perfil" })}>
              <strong>Meu perfil</strong>
              <span>Atualize somente suas informações pessoais e dados da sua conta.</span>
            </button>
            <button type="button" onClick={() => navigate({ to: "/meus-servicos" })}>
              <strong>Meus serviços</strong>
              <span>Atualize sua empresa, apresentação, serviços, imagens e localização.</span>
            </button>
          </div>
        )}

        {hasBusinessProfile && businessStatus && (
          <section className="dashboard-status">
            <div>
              <div className="dashboard-badge">STATUS DO PERFIL</div>
              <h2 className="dashboard-status-title">{businessStatus === "approved" ? "Perfil aprovado e publicado" : businessStatus === "rejected" ? "Perfil precisa de ajustes" : "Perfil em análise"}</h2>
              <p className="dashboard-text dashboard-status-text">{businessStatus === "approved" ? "Seu perfil está disponível para quem pesquisa fornecedores no LOSI CONECTA." : businessStatus === "rejected" ? "Revise as informações solicitadas e salve novamente para enviar uma nova análise." : "A administração está analisando seus dados. Você pode continuar atualizando seu perfil enquanto aguarda."}</p>
            </div>
            <button type="button" onClick={() => navigate({ to: "/meus-servicos" })} className="dashboard-secondary">Gerenciar empresa</button>
          </section>
        )}

        {pendingSubscription && (
          <section className="dashboard-status-card" style={{ marginBottom: 24 }}>
            <div className="dashboard-badge">PAGAMENTO PENDENTE</div>
            <h2 className="dashboard-status-title">Você tem uma contratação em andamento</h2>
            <p className="dashboard-text dashboard-status-text">
              O plano <strong>{pendingSubscription.planName}</strong> ainda aguarda o pagamento. Você pode continuar o pagamento no Asaas ou cancelar esta contratação.
            </p>
            <div className="dashboard-status-grid">
              <div><span>Plano</span><strong>{pendingSubscription.planName}</strong></div>
              <div><span>Forma de pagamento</span><strong>{pendingSubscription.billingType === "PIX" ? "PIX" : pendingSubscription.billingType === "BOLETO" ? "Boleto" : pendingSubscription.billingType === "CREDIT_CARD" ? "Cartão de crédito" : "Pagamento"}</strong></div>
              <div><span>Vencimento</span><strong>{pendingSubscription.dueDate ? new Date(pendingSubscription.dueDate + "T00:00:00").toLocaleDateString("pt-BR") : "A confirmar"}</strong></div>
            </div>
            {pendingSubscriptionMessage && <div className="auth-modal-success" style={{ marginTop: 16 }}>{pendingSubscriptionMessage}</div>}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
              <button type="button" className="auth-modal-submit" onClick={() => void resumePendingSubscription()} disabled={pendingSubscriptionAction !== null || !pendingSubscription.invoiceUrl}>
                {pendingSubscriptionAction === "resume" ? "Abrindo pagamento..." : "Continuar pagamento"}
              </button>
              <button type="button" className="auth-modal-link" onClick={() => void cancelPendingSubscription()} disabled={pendingSubscriptionAction !== null}>
                {pendingSubscriptionAction === "cancel" ? "Cancelando..." : "Cancelar contratação"}
              </button>
            </div>
          </section>
        )}

        {!pendingSubscription && pendingSubscriptionMessage && (
          <div className="auth-modal-success" style={{ marginBottom: 24 }}>{pendingSubscriptionMessage}</div>
        )}

        <section id="planos" className="dashboard-commercial dashboard-status">
          <div>
            <div className="dashboard-badge">PLANOS PARA FORNECEDORES</div>
            <h2 className="dashboard-status-title">{currentPlan ? currentPlan.name : "Plano gratuito"}</h2>
            <p className="dashboard-text dashboard-status-text">{currentPlan?.ends_at ? "Seu plano está ativo até " + new Date(currentPlan.ends_at).toLocaleDateString("pt-BR") + "." : "Comece gratuitamente e conheça opções para aumentar a visibilidade do seu negócio."}</p>
          </div>
          <div className="dashboard-plan-grid">{plans.filter(p => p.billing_period !== "free").map(plan => {
            const price = plan.price_cents === 0 ? "Grátis" : "R$ " + (plan.price_cents / 100).toFixed(2).replace(".", ",") + "/mês";
            return (
              <div className="dashboard-plan-card" key={plan.id}>
                <strong>{plan.name}</strong>
                <span>{price}</span>
                <small>{plan.description || "Mais recursos para seu perfil."}</small>
                <button type="button" className="dashboard-plan-contract" onClick={() => openPaymentModal({ slug: plan.slug, name: plan.name, price })}>Quero contratar</button>
                <button type="button" className="auth-modal-submit dashboard-plan-specs" onClick={() => setSpecificationsPlan({ name: plan.name, description: plan.description, price })}>Especificações</button>
              </div>
            );
          })}</div>
        </section>
        {goldenHeartOpen && (
          <div className="dashboard-golden-heart-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGoldenHeartOpen(false);
          }}>
            <section className="dashboard-golden-heart-modal" role="dialog" aria-modal="true" aria-labelledby="golden-heart-title">
              <div className="dashboard-golden-heart-top">
                <div className="dashboard-golden-heart-icon" aria-hidden="true">♥</div>
                <div className="dashboard-badge">CONQUISTA ESPECIAL</div>
                <h2 id="golden-heart-title">Parabéns pelo Coração Dourado!</h2>
                <p>Seu perfil alcançou a marca de 250 curtidas no LOSI CONECTA.</p>
              </div>
              <div className="dashboard-golden-heart-body">
                <p>Você conquistou <strong>1 mês gratuito do Plano Destaque</strong>. Clique no botão abaixo para ativar seu benefício.</p>
                <button type="button" className="auth-modal-submit dashboard-golden-heart-action" onClick={() => void claimGoldenHeartReward()} disabled={goldenHeartClaiming || Boolean(goldenHeartMessage && goldenHeartMessage.includes("ativado com sucesso"))}>
                  {goldenHeartClaiming ? "Ativando benefício..." : "Ativar 1 mês grátis"}
                </button>
                {goldenHeartMessage && <p className="dashboard-golden-heart-message">{goldenHeartMessage}</p>}
                <button type="button" className="auth-modal-close dashboard-golden-heart-close" onClick={() => setGoldenHeartOpen(false)} aria-label="Fechar conquista">×</button>
              </div>
            </section>
          </div>
        )}

        {paymentPlan && (
          <div className="auth-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !paymentLoading) closePaymentModal();
          }}>
            <section className="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
              <button type="button" className="auth-modal-close" onClick={closePaymentModal} disabled={paymentLoading} aria-label="Fechar">×</button>
              <div className="auth-modal-brand-panel">
                <div className="auth-modal-brand">LOSI <span>CONECTA</span></div>
                <div className="auth-modal-eyebrow">CONTRATAÇÃO SEGURA</div>
                <h1 id="payment-modal-title">{paymentSuccess ? "Contratação iniciada" : "Assinar " + paymentPlan.name}</h1>
                <p>{paymentSuccess ? "Sua assinatura foi criada no Asaas. O plano será ativado no LOSI CONECTA após a confirmação do pagamento." : "Preencha os dados abaixo para iniciar sua assinatura mensal."}</p>
              </div>
              <div className="auth-modal-form-panel">
                {paymentSuccess ? (
                  <div className="auth-modal-form">
                    <div className="auth-modal-success">
                      Assinatura criada com sucesso. Vencimento da primeira cobrança: {paymentSuccess.dueDate ? new Date(paymentSuccess.dueDate + "T00:00:00").toLocaleDateString("pt-BR") : "a confirmar"}.
                    </div>
                    {paymentSuccess.pixEncodedImage && paymentSuccess.pixPayload ? (
                      <div className="auth-modal-form">
                        <div className="auth-modal-success">PIX selecionado. Escaneie o QR Code abaixo ou copie o código Pix.</div>
                        <img
                          src={paymentSuccess.pixEncodedImage.startsWith("data:") ? paymentSuccess.pixEncodedImage : "data:image/png;base64," + paymentSuccess.pixEncodedImage}
                          alt="QR Code Pix para pagamento"
                          style={{ display: "block", width: 220, height: 220, margin: "0 auto 16px", objectFit: "contain" }}
                        />
                        <button type="button" className="auth-modal-submit" onClick={() => void navigator.clipboard?.writeText(paymentSuccess.pixPayload as string)}>Copiar código Pix</button>
                      </div>
                    ) : paymentSuccess.invoiceUrl ? (
                      <button type="button" className="auth-modal-submit" onClick={() => window.open(paymentSuccess.invoiceUrl as string, "_blank", "noopener,noreferrer")}>Continuar para pagamento</button>
                    ) : (
                      <div className="auth-modal-success">A cobrança ainda está sendo gerada pelo Asaas. Aguarde alguns instantes e tente novamente.</div>
                    )}
                    <button type="button" className="auth-modal-link" onClick={closePaymentModal}>Fechar</button>
                  </div>
                ) : (
                  <form className="auth-modal-form" onSubmit={(event) => { event.preventDefault(); void startPayment(); }}>
                    <label>Plano<input value={paymentPlan.name + " — " + paymentPlan.price} readOnly /></label>
                    <label>CPF ou CNPJ<input value={paymentCpfCnpj} onChange={(event) => setPaymentCpfCnpj(event.target.value)} inputMode="numeric" autoComplete="off" placeholder="Somente números ou com pontuação" required /></label>
                    <label>Forma de pagamento
                      <select value={paymentBillingType} onChange={(event) => setPaymentBillingType(event.target.value as typeof paymentBillingType)}>
                        <option value="PIX">PIX</option>
                        <option value="BOLETO">Boleto</option>
                        <option value="CREDIT_CARD">Cartão de crédito</option>
                      </select>
                    </label>
                    <div className="auth-modal-success">A primeira cobrança será criada para o próximo dia. A ativação do plano acontece somente após a confirmação do pagamento.</div>
                    {paymentError && <div className="auth-modal-error">{paymentError}</div>}
                    <button disabled={paymentLoading} type="submit" className="auth-modal-submit">{paymentLoading ? "Criando assinatura..." : "Continuar"}</button>
                  </form>
                )}
              </div>
            </section>
          </div>
        )}

        {specificationsPlan && (
          <div className="auth-modal-backdrop dashboard-plan-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSpecificationsPlan(null);
          }}>
            <section className="auth-modal-card dashboard-plan-modal" role="dialog" aria-modal="true" aria-labelledby="plan-specifications-title">
              <button type="button" className="auth-modal-close dashboard-plan-modal-close" onClick={() => setSpecificationsPlan(null)} aria-label="Fechar especificações">×</button>
              <div className="auth-modal-brand-panel dashboard-plan-modal-brand">
                <div className="auth-modal-brand dashboard-plan-modal-logo">LOSI <span>CONECTA</span></div>
                <div className="auth-modal-eyebrow dashboard-plan-modal-eyebrow">PLANO PARA FORNECEDORES</div>
                <h2 id="plan-specifications-title">{specificationsPlan.name}</h2>
                <p>{specificationsPlan.description || "Recursos para aumentar a presença da sua empresa no LOSI CONECTA."}</p>
              </div>
              <div className="auth-modal-form-panel dashboard-plan-modal-content">
                <div className="dashboard-plan-modal-price">{specificationsPlan.price}</div>
                <div className="dashboard-plan-modal-benefits">
                  {specificationsPlan.name.toLocaleLowerCase("pt-BR") === "profissional" ? (
                    <>
                      <div><strong>Mais visibilidade</strong><span>Seu fornecedor ganha prioridade em relação ao plano gratuito nas pesquisas do catálogo.</span></div>
                      <div><strong>Reputação profissional</strong><span>O plano inicia com uma base de 2 estrelas e nível de satisfação de 70% quando ainda não há avaliações reais.</span></div>
                      <div><strong>Presença completa</strong><span>Utilize seu perfil comercial para apresentar empresa, serviços, localização e canais de contato aos clientes.</span></div>
                      <div><strong>Avaliações reais</strong><span>As avaliações recebidas passam a compor sua reputação e influenciam sua posição nos resultados.</span></div>
                    </>
                  ) : (
                    <>
                      <div><strong>Maior exposição</strong><span>Seu fornecedor recebe prioridade superior nas pesquisas, favorecendo seu posicionamento no catálogo.</span></div>
                      <div><strong>Reputação de destaque</strong><span>O plano inicia com uma base de 4 estrelas e nível de satisfação de 90% quando ainda não há avaliações reais.</span></div>
                      <div><strong>Mais destaque no catálogo</strong><span>O posicionamento promocional é considerado junto à reputação e às avaliações para ordenar os resultados.</span></div>
                      <div><strong>Avaliações reais</strong><span>Conforme sua empresa recebe avaliações, a reputação real passa a substituir a base inicial do plano.</span></div>
                    </>
                  )}
                </div>
                <button type="button" className="auth-modal-submit dashboard-plan-modal-action" onClick={() => setSpecificationsPlan(null)}>Entendi</button>
              </div>
            </section>
          </div>
        )}

        {savedBusinesses.length > 0 && (
          <section className="dashboard-saved">
            <div className="dashboard-badge">SALVOS</div>
            <h2 className="dashboard-status-title">Fornecedores salvos</h2>
            <p className="dashboard-text dashboard-status-text">Seus fornecedores favoritos ficam reunidos aqui.</p>
            <div className="dashboard-saved-list">
              {savedBusinesses.map((business) => (
                <Link key={business.id} to={"/fornecedor/" + business.slug} className="dashboard-saved-card">
                  <strong>{business.business_name}</strong>
                  <span>{business.city}{business.city && business.state ? " — " : ""}{business.state}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>
      </div>
    </main>
  );
}

