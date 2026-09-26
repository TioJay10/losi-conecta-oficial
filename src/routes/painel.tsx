import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ProviderChat } from "../components/ProviderChat";

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
  const [savedBusinesses, setSavedBusinesses] = useState<{ id: string; business_name: string; slug: string; city: string | null; state: string | null; logo_url: string | null; owner_id: string }[]>([]);
  const [businessStatus, setBusinessStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [specificationsPlan, setSpecificationsPlan] = useState<{ name: string; description: string | null; price: string } | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; title: string; message: string; link: string | null; read_at: string | null; created_at: string }>>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread" | "read">("all");
  const [notificationPopup, setNotificationPopup] = useState<typeof notifications[number] | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const [goldenHeartOpen, setGoldenHeartOpen] = useState(false);
  const [goldenHeartClaiming, setGoldenHeartClaiming] = useState(false);
  const [goldenHeartMessage, setGoldenHeartMessage] = useState("");
  const [paymentPlan, setPaymentPlan] = useState<{ slug: string; name: string; price: string } | null>(null);
  const [paymentBillingType, setPaymentBillingType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const [paymentCpfCnpj, setPaymentCpfCnpj] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState<{ invoiceUrl: string | null; dueDate: string | null; pixPayload: string | null; pixEncodedImage: string | null } | null>(null);
  const [userCoupons, setUserCoupons] = useState<Array<{id:string;code:string;plan_id:string|null;discount_type:"percent"|"fixed";discount_value:number;active:boolean;expires_at:string|null;claimed_at:string|null;used_at:string|null}>>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{id:string;code:string;discountCents:number} | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [pendingSubscription, setPendingSubscription] = useState<{
    id: string;
    planName: string;
    planSlug: string;
    dueDate: string | null;
    invoiceUrl: string | null;
    billingType: string | null;
    asaasSubscriptionId: string;
  } | null>(null);
  const [pendingSubscriptionAction, setPendingSubscriptionAction] = useState<"resume" | "cancel" | null>(null);
  const [pendingSubscriptionMessage, setPendingSubscriptionMessage] = useState("");

  async function loadPendingSubscription() {
    if (!supabase || !user) return;
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

      const { data: couponRows, error: couponLoadError } = await supabase
        .from("coupons")
        .select("id,code,plan_id,discount_type,discount_value,active,expires_at,claimed_at,used_at")
        .order("created_at", { ascending: false });
      if (couponLoadError) console.error("Erro ao carregar cupons:", couponLoadError);
      if (mounted) setUserCoupons((couponRows ?? []) as typeof userCoupons);

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
          .select("id,business_name,slug,city,state,logo_url,owner_id")
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


    }

    load();

    const { data: listener } = supabase?.auth.onAuthStateChange((event, session) => {
      // Não redirecionar durante a restauração da sessão no refresh.
      // Apenas um SIGNED_OUT real deve levar o usuário ao login.
      if (event === "SIGNED_OUT" && !session) navigate({ to: "/entrar" });
    }) ?? { data: { subscription: { unsubscribe() {} } } };

    // Recarrega assinatura e demais dados quando o usuário volta do Asaas
    // ou retorna para esta aba depois que o pagamento foi confirmado.
    const handleRefresh = () => {
      if (document.visibilityState === "visible") {
        void load();
        void loadPendingSubscription();
      }
    };
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  }

  useEffect(() => {
    if (!user || !supabase) return;
    void loadPendingSubscription();
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) return;

    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const knownNotificationIdsRef = new Set<string>();
    let initialLoadCompleted = false;

    async function loadNotificationSound() {
      const { data, error } = await supabase
        .from("notification_sounds")
        .select("public_url")
        .eq("active", true)
        .maybeSingle();

      if (error) {
        console.warn("Erro ao carregar som de notificação:", error);
        // Se não conseguimos consultar o banco, não usamos o som de fallback:
        // assim um erro momentâneo nunca faz o "plim" substituir um som customizado.
        return false;
      }

      return Boolean(data?.public_url);
    }

    async function loadNotificationsForUser(userId: string, playForNewUnread = false) {
      if (!mounted) return;

      // A consulta histórica é feita diretamente no banco. Portanto, uma
      // notificação criada enquanto o usuário estava deslogado continua
      // disponível assim que ele entra novamente.
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,message,link,read_at,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar notificações:", error);
        return;
      }

      if (!mounted) return;

      const rows = (data ?? []) as typeof notifications[number][];
      const newUnreadRows = playForNewUnread
        ? rows.filter((notification) => !notification.read_at && !knownNotificationIdsRef.has(notification.id))
        : [];

      rows.forEach((notification) => knownNotificationIdsRef.add(notification.id));
      setNotifications(rows);

      initialLoadCompleted = true;
    }

    async function loadNotifications() {
      await loadNotificationsForUser(user.id, initialLoadCompleted);
    }

    async function startNotificationDelivery() {
      // Primeiro carrega o som e o histórico. Isso cobre notificações
      // recebidas enquanto o usuário estava deslogado.
      await loadNotificationSound();
      await loadNotificationsForUser(user.id, false);
      if (!mounted) return;

      channel = supabase
        .channel("panel-notifications-" + user.id + "-" + Date.now())
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: "user_id=eq." + user.id,
          },
          (payload) => {
            if (!mounted) return;

            const notification = payload.new as typeof notifications[number];

            if (knownNotificationIdsRef.has(notification.id)) return;
            knownNotificationIdsRef.add(notification.id);

            setNotifications((current) => [
              notification,
              ...current.filter((item) => item.id !== notification.id),
            ]);

            // O alerta global em __root.tsx cuida do som e do aviso fora do painel.
            // Aqui mantemos apenas a lista/sino das notificações.
          },
        )
        .subscribe();

      // Quando o administrador troca o áudio, o painel atualiza o URL
      // imediatamente. Assim a próxima notificação já usa o novo som.
      soundChannel = supabase
        .channel("panel-notification-sound-" + user.id + "-" + Date.now())
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notification_sounds",
          },
          () => {
            if (mounted) void loadNotificationSound();
          },
        )
        .subscribe();
    }

    void startNotificationDelivery();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        window.setTimeout(() => {
          if (mounted) void loadNotificationsForUser(session.user.id, true);
        }, 0);
      }
    });

    const refreshNotifications = () => {
      if (document.visibilityState === "visible") {
        void loadNotificationSound();
        void loadNotifications();
      }
    };

    window.addEventListener("focus", refreshNotifications);
    document.addEventListener("visibilitychange", refreshNotifications);

    return () => {
      mounted = false;
      window.removeEventListener("focus", refreshNotifications);
      document.removeEventListener("visibilitychange", refreshNotifications);
      if (channel) void supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
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

  async function prepareNotificationAudio() {
    if (!supabase) return false;

    const { data, error } = await supabase
      .from("notification_sounds")
      .select("public_url")
      .eq("active", true)
      .maybeSingle();

    if (error || !data?.public_url) return false;

    let audio = notificationAudioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      notificationAudioRef.current = audio;
    }

    if (audio.src !== data.public_url) {
      audio.src = data.public_url;
      audio.load();
    }

    // O primeiro play acontece dentro de uma interação real do usuário,
    // com o áudio mutado, para liberar a reprodução posterior no Safari/iOS.
    audio.muted = true;
    audio.volume = 0;
    audio.currentTime = 0;

    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 0.35;
      return true;
    } catch (error) {
      audio.muted = false;
      audio.volume = 0.35;
      console.warn("Não foi possível liberar o áudio de notificações:", error);
      return false;
    }
  }

  async function playNotificationSound() {
    if (!supabase) return;

    // O banco continua sendo a fonte de verdade: cada notificação consulta
    // o áudio atualmente ativo, inclusive depois de o administrador trocá-lo.
    const { data, error } = await supabase
      .from("notification_sounds")
      .select("public_url")
      .eq("active", true)
      .maybeSingle();

    if (error || !data?.public_url) return;

    let audio = notificationAudioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      notificationAudioRef.current = audio;
    }

    if (audio.src !== data.public_url) {
      audio.src = data.public_url;
      audio.load();
    }

    audio.muted = false;
    audio.volume = 0.35;
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch (error) {
      // Não existe mais fallback "plim". Se o navegador bloquear a reprodução,
      // registramos o motivo para diagnóstico em vez de esconder o erro.
      console.warn("O navegador bloqueou a reprodução do som de notificação:", error);
    }
  }

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

  async function markAllNotificationsAsRead() {
    if (!supabase || !user) return;

    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (unreadIds.length === 0) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Erro ao marcar todas as notificações como lidas:", error);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.includes(notification.id) ? { ...notification, read_at: readAt } : notification,
      ),
    );
  }

  async function openNotification(notification: typeof notifications[number]) {
    if (!notification.read_at) {
      await markNotificationAsRead(notification.id);
    }
    setNotificationsOpen(false);
    setNotificationPopup(notification);
  }

  function handleNotificationAction(notification: typeof notifications[number]) {
    setNotificationPopup(null);

    if (notification.type === "golden_heart") {
      setGoldenHeartMessage("");
      setGoldenHeartOpen(true);
      return;
    }

    if (notification.link) {
      window.location.href = notification.link;
    }
  }

  function openPaymentModal(plan: { slug: string; name: string; price: string }) {
    setPaymentPlan(plan);
    setPaymentBillingType("PIX");
    setPaymentCpfCnpj("");
    setPaymentError("");
    setPaymentSuccess(null);
    setCouponCode("");
    setCouponError("");
    setAppliedCoupon(null);
  }

  async function applyCoupon() {
    if (!paymentPlan || !supabase || couponApplying) return;
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError("Informe o código do cupom.");
      return;
    }
    setCouponApplying(true);
    setCouponError("");
    setAppliedCoupon(null);
    try {
      const { data: coupon, error } = await supabase
        .from("coupons")
        .select("id,code,plan_id,discount_type,discount_value,active,expires_at,claimed_at,used_at")
        .eq("code", code)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!coupon) throw new Error("Cupom não encontrado para esta conta.");
      if (!coupon.active) throw new Error("Este cupom não está disponível.");
      if (coupon.used_at) throw new Error("Este cupom já foi utilizado.");
      if (coupon.claimed_at) throw new Error("Este cupom já foi resgatado.");
      if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) throw new Error("Este cupom está expirado.");
      const selectedPlan = plans.find(item => item.slug === paymentPlan.slug);
      if (!selectedPlan) throw new Error("Não foi possível identificar o plano.");
      if (coupon.plan_id && coupon.plan_id !== selectedPlan.id) throw new Error("Este cupom não é válido para este plano.");
      const discountCents = coupon.discount_type === "percent"
        ? Math.min(selectedPlan.price_cents, Math.round(selectedPlan.price_cents * (coupon.discount_value / 100)))
        : Math.min(selectedPlan.price_cents, coupon.discount_value);
      if (discountCents <= 0 || discountCents >= selectedPlan.price_cents) throw new Error("Este cupom não gera um desconto válido.");
      setAppliedCoupon({ id: coupon.id, code: coupon.code, discountCents });
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : "Não foi possível aplicar o cupom.");
    } finally {
      setCouponApplying(false);
    }
  }

  function closePaymentModal() {
    if (paymentLoading) return;
    setPaymentPlan(null);
    setPaymentError("");
    setPaymentSuccess(null);
    setCouponCode("");
    setCouponError("");
    setAppliedCoupon(null);
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
        body: JSON.stringify({ planSlug: paymentPlan.slug, billingType: paymentBillingType, cpfCnpj: cleanCpfCnpj, nextDueDate: nextDueDateText, couponCode: appliedCoupon?.code || null }),
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
          <button type="button" className="dashboard-nav-item" onClick={() => { setMobileMenuOpen(false); navigate({ to: "/notificar-inconsistencia" }); }}>
            <span className="dashboard-nav-mark">05</span><span><strong>Notificar Inconsistências</strong><small>Falar com o administrador</small></span>
          </button>
          <button type="button" className="dashboard-nav-item" onClick={() => { setMobileMenuOpen(false); navigate({ to: "/orcamentos" }); }}>
            <span className="dashboard-nav-mark">06</span><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderBottom: "1px solid #e8edf3", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Filtrar notificações">
                      {([
                        ["all", "Todas"],
                        ["unread", "Não lidas"],
                        ["read", "Lidas"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setNotificationFilter(value)}
                          style={{
                            border: "1px solid " + (notificationFilter === value ? "#0b182a" : "#dbe2ea"),
                            background: notificationFilter === value ? "#0b182a" : "#fff",
                            color: notificationFilter === value ? "#fff" : "#475569",
                            borderRadius: 8,
                            padding: "6px 9px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsAsRead()}
                      disabled={!notifications.some((notification) => !notification.read_at)}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: notifications.some((notification) => !notification.read_at) ? "#0b182a" : "#94a3b8",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: notifications.some((notification) => !notification.read_at) ? "pointer" : "default",
                        padding: "6px 2px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Marcar todas como lidas
                    </button>
                  </div>
                  <div className="dashboard-notification-list">
                    {(() => {
                      const filteredNotifications = notifications.filter((notification) =>
                        notificationFilter === "all" ||
                        (notificationFilter === "unread" && !notification.read_at) ||
                        (notificationFilter === "read" && Boolean(notification.read_at)),
                      );

                      if (filteredNotifications.length === 0) {
                        return (
                          <div className="dashboard-notification-empty">
                            {notificationFilter === "unread"
                              ? "Você não tem notificações não lidas."
                              : notificationFilter === "read"
                                ? "Você ainda não tem notificações lidas."
                                : "Você ainda não tem notificações."}
                          </div>
                        );
                      }

                      return filteredNotifications.map((notification) => (
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
                      ));
                    })()}
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
          <section style={{ marginBottom: 24, borderRadius: 18, border: "1px solid rgba(214,180,106,.38)", background: "linear-gradient(145deg,#121f32,#07111f)", boxShadow: "0 18px 40px rgba(7,17,31,.22)", overflow: "hidden" }}>
            <div style={{ padding: "20px 22px", borderBottom: "1px solid rgba(214,180,106,.24)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center", background: "transparent", border: "0", fontSize: 21 }}>💳</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#f0d99a", textTransform: "uppercase" }}>Pagamento pendente</div>
                <h2 style={{ margin: "4px 0 0", fontSize: 20, lineHeight: 1.25, color: "#fff" }}>Sua contratação ainda não foi concluída</h2>
              </div>
            </div>
            <div style={{ padding: "20px 22px 22px" }}>
              <p style={{ margin: "0 0 18px", color: "#f0d99a", lineHeight: 1.55, fontSize: 14 }}>Você iniciou a contratação do plano <strong style={{ color: "#f0d99a" }}>{pendingSubscription.planName}</strong>, mas o pagamento ainda está aguardando conclusão.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 20 }}>
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid #e5e7eb" }}><span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Plano</span><strong style={{ fontSize: 14, color: "#0b182a" }}>{pendingSubscription.planName}</strong></div>
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid #e5e7eb" }}><span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Pagamento</span><strong style={{ fontSize: 14, color: "#111827" }}>{pendingSubscription.billingType === "PIX" ? "PIX" : pendingSubscription.billingType === "BOLETO" ? "Boleto" : pendingSubscription.billingType === "CREDIT_CARD" ? "Cartão de crédito" : "Pagamento"}</strong></div>
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid #e5e7eb" }}><span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Vencimento</span><strong style={{ fontSize: 14, color: "#0b182a" }}>{pendingSubscription.dueDate ? new Date(pendingSubscription.dueDate + "T00:00:00").toLocaleDateString("pt-BR") : "A confirmar"}</strong></div>
              </div>
              {pendingSubscriptionMessage && <div className="auth-modal-success" style={{ marginBottom: 16 }}>{pendingSubscriptionMessage}</div>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="auth-modal-submit" style={{ minWidth: 180 }} onClick={() => void resumePendingSubscription()} disabled={pendingSubscriptionAction !== null || !pendingSubscription.invoiceUrl}>{pendingSubscriptionAction === "resume" ? "Abrindo pagamento..." : "Continuar pagamento"}</button>
                <button type="button" className="auth-modal-link" style={{ minHeight: 46, padding: "0 18px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", textDecoration: "none" }} onClick={() => void cancelPendingSubscription()} disabled={pendingSubscriptionAction !== null}>{pendingSubscriptionAction === "cancel" ? "Cancelando..." : "Cancelar contratação"}</button>
              </div>
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
        {userCoupons.filter(c => c.active && !c.used_at && !c.claimed_at && (!c.expires_at || new Date(c.expires_at).getTime() >= Date.now())).length > 0 && (
          <section className="dashboard-saved" style={{ marginTop: 24 }}>
            <div className="dashboard-badge">BENEFÍCIO DISPONÍVEL</div>
            <h2 className="dashboard-status-title">Seus cupons</h2>
            <p className="dashboard-text dashboard-status-text">Use o código no momento da contratação do plano correspondente.</p>
            <div className="dashboard-saved-list">
              {userCoupons.filter(c => c.active && !c.used_at && !c.claimed_at && (!c.expires_at || new Date(c.expires_at).getTime() >= Date.now())).map(coupon => {
                const couponPlan = plans.find(p => p.id === coupon.plan_id);
                return <article key={coupon.id} className="dashboard-saved-card" style={{ cursor: "default" }}>
                  <strong>{coupon.code}</strong>
                  <span>{coupon.discount_type === "percent" ? coupon.discount_value + "% de desconto" : "R$ " + (coupon.discount_value / 100).toFixed(2).replace(".", ",") + " de desconto"}{couponPlan ? " · " + couponPlan.name : " · plano pago"}</span>
                </article>;
              })}
            </div>
          </section>
        )}
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

        {notificationPopup && (
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setNotificationPopup(null);
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              display: "grid",
              placeItems: "center",
              padding: 20,
              background: "rgba(7,17,31,.58)",
              backdropFilter: "blur(5px)",
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-popup-title"
              style={{
                width: "100%",
                maxWidth: 470,
                background: "#fff",
                border: "1px solid rgba(214,180,106,.48)",
                borderRadius: 20,
                overflow: "hidden",
                boxSizing: "border-box",
                boxShadow: "0 24px 60px rgba(7,17,31,.28)",
              }}
            >
              <div style={{
                position: "relative",
                padding: "30px 34px 28px",
                background: "linear-gradient(145deg, rgba(18,31,50,.99), rgba(5,13,24,.99))",
                borderBottom: "1px solid rgba(214,180,106,.30)",
                boxSizing: "border-box",
              }}>
                <button
                  type="button"
                  onClick={() => setNotificationPopup(null)}
                  aria-label="Fechar notificação"
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 16,
                    width: 34,
                    height: 34,
                    border: "1px solid rgba(214,180,106,.35)",
                    borderRadius: 9,
                    background: "rgba(255,255,255,.06)",
                    color: "#f0d99a",
                    fontSize: 24,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >×</button>
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: ".08em", color: "#fff" }}>LOSI <span>CONECTA</span></div>
                <div style={{ marginTop: 24, fontSize: 11, fontWeight: 800, letterSpacing: ".16em", color: "#f0d99a" }}>NOVA NOTIFICAÇÃO</div>
                <h2 id="notification-popup-title" style={{ fontSize: 28, lineHeight: 1.15, margin: "14px 0 8px", color: "#fff" }}>{notificationPopup.title}</h2>
                <p style={{ color: "#c4cbd7", lineHeight: 1.5, margin: 0, fontSize: 14 }}>Você recebeu uma nova mensagem no LOSI CONECTA.</p>
              </div>
              <div style={{ padding: "30px 34px 32px", background: "#fff", boxSizing: "border-box" }}>
                <p style={{ margin: "0 0 22px", color: "#172033", fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-line" }}>{notificationPopup.message}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => handleNotificationAction(notificationPopup)}
                    style={{
                      flex: "1 1 190px",
                      border: "1px solid #d6b46a",
                      borderRadius: 9,
                      padding: "13px 16px",
                      background: "linear-gradient(145deg, #0b182a, #07111f)",
                      color: "#f0d99a",
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 8px 18px rgba(7,17,31,.16)",
                    }}
                  >
                    {notificationPopup.type.startsWith("feed_") ? "Ver publicação" : notificationPopup.link ? "Ver benefício" : "Ver notificação"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationPopup(null)}
                    style={{
                      flex: "0 1 120px",
                      border: 0,
                      borderRadius: 9,
                      padding: "13px 16px",
                      background: "transparent",
                      color: "#8a6d2f",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Fechar
                  </button>
                </div>
                <div style={{ marginTop: 18, color: "#687386", fontSize: 12 }}>
                  {new Date(notificationPopup.created_at).toLocaleString("pt-BR")}
                </div>
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
                    <div className="auth-modal-coupon">
                      <label>Cupom de desconto<input value={couponCode} onChange={event => { setCouponCode(event.target.value.toUpperCase()); setCouponError(""); setAppliedCoupon(null); }} placeholder="Digite seu cupom" maxLength={40} disabled={couponApplying} /></label>
                      <button type="button" className="auth-modal-link" onClick={() => void applyCoupon()} disabled={couponApplying || !couponCode.trim()}>{couponApplying ? "Verificando..." : "Aplicar cupom"}</button>
                      {appliedCoupon && <div className="auth-modal-success">Cupom <strong>{appliedCoupon.code}</strong> aplicado. Desconto de <strong>R$ {(appliedCoupon.discountCents / 100).toFixed(2).replace(".", ",")}</strong>. Valor desta contratação: <strong>R$ {((Math.max(1, (plans.find(item => item.slug === paymentPlan.slug)?.price_cents ?? 0) - appliedCoupon.discountCents)) / 100).toFixed(2).replace(".", ",")}</strong>.</div>}
                      {couponError && <div className="auth-modal-error">{couponError}</div>}
                    </div>
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
                <article key={business.id} className="dashboard-saved-card dashboard-saved-provider-card">
                  <Link to={"/fornecedor/" + business.slug} className="dashboard-saved-provider-info">
                    <div className="dashboard-saved-provider-avatar">
                      {business.logo_url ? (
                        <img src={business.logo_url} alt="" />
                      ) : (
                        <span>{business.business_name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="dashboard-saved-provider-copy">
                      <strong>{business.business_name}</strong>
                      <span>{business.city}{business.city && business.state ? " — " : ""}{business.state}</span>
                    </div>
                  </Link>
                  <ProviderChat
                    business={{
                      id: business.id,
                      business_name: business.business_name,
                      slug: business.slug,
                      logo_url: business.logo_url,
                      owner_id: business.owner_id,
                    }}
                    userId={user?.id ?? null}
                    onRequireAuth={() => navigate({ to: "/entrar" })}
                  />
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
      </div>
    </main>
  );
}

