import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { AppLogo } from "../../components/AppLogo";
import { AuthModal } from "../../components/AuthModal";
import { calculateReputation, type ReputationSummary } from "../../lib/reputation";
import { ProviderChat } from "../../components/ProviderChat";

type Service = { id: string; name: string; description: string | null; categories: { name: string } | null };
const OFFICIAL_BUSINESS_ID = "333ccf56-324f-4e4f-99e3-1ebc9ade0140";

type Review = { id: string; rating: number; comment: string | null; created_at: string; reviewer: { full_name: string | null } | null };
type Business = {
  id: string; business_name: string; slug: string; description: string | null;
  whatsapp: string | null; phone: string | null; instagram: string | null; website: string | null;
  city: string | null; state: string | null; address: string | null; logo_url: string | null;
  cover_url: string | null; verified: boolean; portfolio_urls: string[]; services: Service[]; owner_id: string; created_at: string; reputation_report_count: number; reputation_service_count: number; show_availability: boolean;
};

export const Route = createFileRoute("/fornecedor/$slug")({
  component: ProviderPage,
});

function ProviderPage() {
  const { slug } = Route.useParams();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likedByCurrentUser, setLikedByCurrentUser] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("tentativa_de_golpe");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reporting, setReporting] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<"quote" | "favorite" | "like" | "whatsapp" | "chat" | null>(null);
  const [quoteMessageType, setQuoteMessageType] = useState<"success" | "error" | "sending" | "">("");
  const [availabilityDates, setAvailabilityDates] = useState<string[]>([]);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [publicQuote, setPublicQuote] = useState<any | null>(null);
  const [publicQuoteLoading, setPublicQuoteLoading] = useState(false);
  const [publicQuoteError, setPublicQuoteError] = useState("");
  const [publicQuoteResponding, setPublicQuoteResponding] = useState(false);
  const [publicQuoteResponse, setPublicQuoteResponse] = useState<"accepted" | "rejected" | null>(null);
  const [publicQuoteResponseMessage, setPublicQuoteResponseMessage] = useState("");
  const [publicQuoteToken, setPublicQuoteToken] = useState<string | null>(null);
  const [availabilityMonth, setAvailabilityMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [reputation, setReputation] = useState<ReputationSummary & { completedServices: number; reports: number; blocked: boolean }>({
    planSlug: "gratis", planName: "Grátis", planPriority: 0, baseStars: 0, stars: 0,
    positiveReviews: 0, totalReviews: 0, satisfaction: null, level: 0, label: "Sem reputação", rankingScore: 0,
    completedServices: 0, reports: 0, blocked: false,
  });

  useEffect(() => {
    let mounted = true;
    const proposalParams = new URLSearchParams(window.location.search);
    const proposalId = proposalParams.get("proposta");
    const proposalToken = proposalParams.get("token");
    setPublicQuoteToken(proposalToken);
    if (!proposalId || !proposalToken) { if (proposalId) setPublicQuoteError("Link da proposta inválido ou incompleto."); return; }
    setPublicQuoteLoading(true);
    supabase.rpc("get_public_quote", { p_quote_id: proposalId, p_token: proposalToken }).then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data) {
        console.error("Erro ao carregar proposta pública:", error);
        setPublicQuoteError("Não foi possível carregar esta proposta.");
      } else {
        setPublicQuote(data);
      }
      setPublicQuoteLoading(false);
    });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (mounted) setUserId(sessionData.session?.user.id ?? null);
      const { data, error: queryError } = await supabase
        .from("business_profiles")
        .select("id,business_name,slug,description,whatsapp,phone,instagram,website,city,state,address,logo_url,cover_url,portfolio_urls,verified,owner_id,created_at,reputation_report_count,reputation_service_count,show_availability,services(id,name,description,categories(name))")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (!mounted) return;
      if (queryError) {
        console.error("Erro ao carregar perfil público do fornecedor:", queryError);
        setError("Não foi possível carregar este fornecedor: " + queryError.message);
      } else {
        const loaded = (data ?? null) as unknown as Business;
        setBusiness(loaded);
        if (loaded) {
          if (loaded.show_availability) {
            const { data: availabilityData, error: availabilityError } = await supabase
              .from("provider_availability")
              .select("availability_date,status")
              .eq("business_id", loaded.id)
              .eq("status", "unavailable")
              .order("availability_date");
            if (availabilityError) console.error("Erro ao carregar agenda pública:", availabilityError);
            if (mounted) setAvailabilityDates((availabilityData ?? []).map((item) => item.availability_date));
          }
          const { data: reviewData, error: reviewLoadError } = await supabase
            .from("reviews")
            .select("id,rating,comment,created_at,reviewer:profiles(full_name)")
            .eq("business_id", loaded.id)
            .eq("active", true)
            .order("created_at", { ascending: false });

          if (reviewLoadError) {
            console.error("Erro ao carregar avaliações do fornecedor:", reviewLoadError);
          }

          if (mounted) {
            setReviews((reviewData ?? []) as unknown as Review[]);

            const { data: ownerData } = await supabase.from("profiles").select("blocked").eq("id", loaded.owner_id).maybeSingle();
            const activeReviews = (reviewData ?? []) as unknown as Review[];
            const reports = loaded.reputation_report_count ?? 0;
            const completedServices = loaded.reputation_service_count ?? 0;
            const blocked = Boolean((ownerData as { blocked?: boolean } | null)?.blocked);
            const { data: planData } = await supabase
              .from("supplier_plan_visibility")
              .select("business_id,plan_slug,plan_name,plan_priority,ends_at")
              .eq("business_id", loaded.id)
              .maybeSingle();
            const calculated = loaded.id === OFFICIAL_BUSINESS_ID
              ? calculateReputation("destaque", activeReviews.map((review) => review.rating), completedServices)
              : calculateReputation(planData?.plan_slug ?? "gratis", activeReviews.map((review) => review.rating), completedServices);
            if (mounted) setReputation({
              ...calculated,
              completedServices,
              reports,
              blocked,
            });

            const { data: likeSummary, error: likeSummaryError } = await supabase.rpc("get_business_like_summary", { p_business_id: loaded.id });
            if (likeSummaryError) {
              console.error("Erro ao carregar curtidas do fornecedor:", likeSummaryError);
            } else if (mounted) {
              const summary = Array.isArray(likeSummary) ? likeSummary[0] : likeSummary;
              setLikeCount(Number(summary?.like_count ?? 0));
              setLikedByCurrentUser(Boolean(summary?.liked_by_current_user));
            }

            if (sessionData.session) {
              const { data: favoriteData } = await supabase.from("favorites").select("business_id").eq("user_id", sessionData.session.user.id).eq("business_id", loaded.id).maybeSingle();
              if (mounted) setIsFavorite(Boolean(favoriteData));
            }
          }
        }
      }
      setLoading(false);
    }
    load().catch((loadError) => {
      console.error("Erro inesperado ao carregar perfil público:", loadError);
      if (mounted) setError("Não foi possível carregar este fornecedor.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [slug]);

  if (loading) return <main className="provider-page-state">Carregando perfil...</main>;
  if (error || !business) {
    return (
      <main className="provider-page-state">
        <strong>Fornecedor não encontrado.</strong>
        <Link to="/buscar">Voltar para a busca</Link>
      </main>
    );
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reviewing) return;
    setReviewMessage("");
    setReviewing(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const currentUser = userData.user;

      if (userError || !currentUser) {
        setReviewMessage("Sua sessão não está ativa. Entre na sua conta e tente novamente.");
        return;
      }

      const comment = reviewComment.trim();
      const { error: insertError } = await supabase.from("reviews").insert({
        business_id: business.id,
        reviewer_id: currentUser.id,
        rating: Math.min(5, Math.max(1, reviewRating)),
        comment: comment ? comment.slice(0, 500) : null,
        active: true,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          setReviewMessage("Você já avaliou este fornecedor.");
        } else if (insertError.code === "42501") {
          setReviewMessage("Sua conta não tem permissão para publicar esta avaliação.");
        } else {
          setReviewMessage(insertError.message || "Não foi possível publicar sua avaliação.");
        }
        return;
      }

      setReviewComment("");
      setReviewRating(5);

      const { data: reviewData, error: reviewLoadError } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at,reviewer:profiles(full_name)")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (reviewLoadError) {
        setReviewMessage("Avaliação publicada, mas não foi possível atualizar a lista agora.");
        return;
      }

      setReviews((reviewData ?? []) as unknown as Review[]);
      setReviewMessage("Avaliação publicada com sucesso.");
    } finally {
      setReviewing(false);
    }
  }

  const isOfficial = business.id === OFFICIAL_BUSINESS_ID;
  const averageRating = isOfficial ? 5 : reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const rawPhone = business.whatsapp || business.phone || "";
  const digits = rawPhone.replace(/\D/g, "");
  const whatsapp = digits ? "https://wa.me/" + (digits.startsWith("55") ? digits : "55" + digits) + "?text=" + encodeURIComponent("Olá! Encontrei a " + business.business_name + " no LOSI CONECTA.") : null;
  const canRequestQuote = Boolean(userId && userId !== business.owner_id);
  const reputationLabel = reputation.label;
  const reputationClass = `level-${reputation.level}`;
  const heartClass = likeCount >= 250 ? "gold" : likeCount >= 61 ? "red" : likeCount >= 31 ? "yellow" : likeCount >= 1 ? "green" : "neutral";
  const satisfactionText = reputation.satisfaction === null ? "Sem reputação" : reputation.satisfaction + "% de satisfação";


  async function saveFavoriteForUser(currentUserId: string) {
    setFavoriteBusy(true);
    const result = isFavorite
      ? await supabase.from("favorites").delete().eq("user_id", currentUserId).eq("business_id", business.id)
      : await supabase.from("favorites").insert({ user_id: currentUserId, business_id: business.id });
    if (result.error) {
      console.error("Erro ao alterar fornecedor salvo:", result.error);
    } else {
      setIsFavorite(!isFavorite);
    }
    setFavoriteBusy(false);
  }

  async function toggleFavorite() {
    if (!userId) {
      setPendingAuthAction("favorite");
      setAuthModalOpen(true);
      return;
    }
    await saveFavoriteForUser(userId);
  }

  async function toggleLikeForUser() {
    if (likeBusy) return;
    setLikeBusy(true);
    const { data, error } = await supabase.rpc("toggle_business_like", { p_business_id: business.id });
    if (error) {
      console.error("Erro ao alterar curtida do fornecedor:", error);
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      setLikedByCurrentUser(Boolean(result?.liked));
      setLikeCount(Number(result?.like_count ?? likeCount));
    }
    setLikeBusy(false);
  }

  async function toggleLike() {
    if (!userId) {
      setPendingAuthAction("like");
      setAuthModalOpen(true);
      return;
    }
    await toggleLikeForUser();
  }

  function openQuoteRequest() {
    if (!userId) {
      setPendingAuthAction("quote");
      setAuthModalOpen(true);
      return;
    }
    document.getElementById("provider-quote-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function openWhatsApp() {
    if (!whatsapp) return;
    if (!userId) {
      setPendingAuthAction("whatsapp");
      setAuthModalOpen(true);
      return;
    }

    const { data, error } = await supabase.rpc("consume_free_whatsapp_contact");
    if (error) {
      console.error("Erro ao validar limite de WhatsApp:", error);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.allowed) {
      setQuoteMessageType("error");
      setQuoteMessage(result?.message || "Você atingiu o limite de contatos pelo WhatsApp do seu plano gratuito. Faça um upgrade para continuar.");
      document.getElementById("provider-quote-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.location.href = whatsapp;
  }

  function openChatAfterAuth() {\n    setPendingAuthAction("chat");\n    setAuthModalOpen(true);\n  }\n\n  async function handleAuthenticatedFromModal() {
    const { data } = await supabase.auth.getSession();
    const currentUserId = data.session?.user.id ?? null;
    setUserId(currentUserId);
    setAuthModalOpen(false);
    const action = pendingAuthAction;
    setPendingAuthAction(null);
    if (!currentUserId || !action) return;
    if (action === "favorite") {
      await saveFavoriteForUser(currentUserId);
    } else if (action === "like") {
      await toggleLikeForUser();
    } else if (action === "quote") {
      window.setTimeout(() => document.getElementById("provider-quote-request")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } else if (action === "whatsapp") {
      await openWhatsApp();
    }
  }

  async function submitSupplierReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reporting) return;
    setReporting(true);
    setReportMessage("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData.user;
      if (!currentUser) {
        window.location.href = "/entrar";
        return;
      }

      const { error: reportError } = await supabase.from("supplier_reports").insert({
        business_id: business.id,
        reporter_id: currentUser.id,
        reason: reportReason,
        details: reportDetails.trim() ? reportDetails.trim().slice(0, 1000) : null,
      });

      if (reportError) {
        console.error("Erro ao denunciar fornecedor:", reportError);
        if (reportError.code === "23505") {
          setReportMessage("Você já enviou uma denúncia com este motivo para este fornecedor.");
        } else if (reportError.code === "42501") {
          setReportMessage("Não foi possível registrar esta denúncia.");
        } else {
          setReportMessage(reportError.message || "Não foi possível registrar esta denúncia.");
        }
        return;
      }

      setReportReason("tentativa_de_golpe");
      setReportDetails("");
      setReportMessage("Denúncia enviada. Obrigado por nos ajudar a manter o LOSI CONECTA seguro.");
    } finally {
      setReporting(false);
    }
  }

  async function submitQuoteRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (quoteMessageType === "sending") return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setQuoteMessage("");
    setQuoteMessageType("sending");
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const currentUser = userData.user;
    if (userError || !currentUser) {
      setQuoteMessageType("error");
      setQuoteMessage("NÃO FOI POSSÍVEL SOLICITAR O ORÇAMENTO");
      return;
    }

    const payload = {
      business_id: business.id,
      requester_id: currentUser.id,
      service_id: String(form.get("service_id") || "") || null,
      client_name: String(form.get("client_name") || "").trim(),
      client_email: String(form.get("client_email") || "").trim() || currentUser.email || null,
      client_phone: String(form.get("client_phone") || "").trim() || null,
      event_title: String(form.get("event_title") || "").trim(),
      event_date: String(form.get("event_date") || "") || null,
      event_location: String(form.get("event_location") || "").trim() || null,
      description: String(form.get("description") || "").trim() || null,
    };

    if (!payload.client_name || !payload.event_title) {
      setQuoteMessageType("error");
      setQuoteMessage("NÃO FOI POSSÍVEL SOLICITAR O ORÇAMENTO");
      return;
    }

    const { error: requestError } = await supabase.from("quote_requests").insert(payload);
    if (requestError) {
      console.error("Erro ao solicitar orçamento:", requestError);
      setQuoteMessageType("error");
      if (requestError.message.includes("limite de 4 solicitações de orçamento")) {
        setQuoteMessage("Você atingiu o limite de 4 solicitações de orçamento do seu plano gratuito. Faça um upgrade para continuar.");
      } else {
        setQuoteMessage("NÃO FOI POSSÍVEL SOLICITAR O ORÇAMENTO");
      }
      return;
    }

    const serviceName = business.services.find((service) => service.id === payload.service_id)?.name || "Não informado";
    const [{ data: requesterBusiness }, { data: requesterProfile }] = await Promise.all([
      supabase
        .from("business_profiles")
        .select("slug,business_name,address,bairro,city,state,cep")
        .eq("owner_id", currentUser.id)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name,address,city,state,cep")
        .eq("id", currentUser.id)
        .maybeSingle(),
    ]);
    const requesterProfileUrl = requesterBusiness?.slug
      ? window.location.origin + "/fornecedor/" + requesterBusiness.slug
      : "";
    const requesterName = requesterProfile?.full_name || payload.client_name;
    const requesterAddress = requesterBusiness?.address
      || requesterProfile?.address
      || [requesterProfile?.city, requesterProfile?.state].filter(Boolean).join(" — ")
      || requesterProfile?.cep
      || "Não informado";
    const requesterCompany = requesterBusiness?.business_name || "";
    const whatsappNumber = (business.whatsapp || business.phone || "").replace(/\D/g, "");
    const normalizedWhatsapp = whatsappNumber
      ? (whatsappNumber.startsWith("55") ? whatsappNumber : "55" + whatsappNumber)
      : "";

    const whatsappMessage = [
      "Olá, " + business.business_name,
      "",
      "Encontrei o seu perfil no Losi Conecta e gostaria de solicitar um orçamento dos seus serviços.",
      "",
      "Dados do solicitante:",
      "",
      "Nome: " + requesterName,
      "Endereço completo: " + requesterAddress,
      requesterCompany ? "Nome da empresa: " + requesterCompany : "",
      requesterProfileUrl ? "Link do perfil público: " + requesterProfileUrl : "",
    ].filter(Boolean).join("\n");

    formElement.reset();

    if (normalizedWhatsapp) {
      const { data: whatsappQuota, error: whatsappQuotaError } = await supabase.rpc("consume_free_whatsapp_contact");

      if (whatsappQuotaError) {
        console.error("Erro ao validar limite de WhatsApp:", whatsappQuotaError);
        setQuoteMessageType("error");
        setQuoteMessage("SOLICITAÇÃO REGISTRADA, MAS NÃO FOI POSSÍVEL ABRIR O WHATSAPP AGORA.");
        return;
      }

      const quotaResult = Array.isArray(whatsappQuota) ? whatsappQuota[0] : whatsappQuota;
      if (!quotaResult?.allowed) {
        setQuoteMessageType("error");
        setQuoteMessage(quotaResult?.message || "SOLICITAÇÃO REGISTRADA, MAS VOCÊ ATINGIU O LIMITE DE contatos pelo WhatsApp do seu plano gratuito.");
        return;
      }

      window.location.href =
        "https://wa.me/" + normalizedWhatsapp + "?text=" + encodeURIComponent(whatsappMessage);
      setQuoteMessageType("success");
      setQuoteMessage("SOLICITAÇÃO REGISTRADA. O WHATSAPP FOI ABERTO COM A MENSAGEM DO SOLICITANTE PRONTA PARA ENVIO.");
    } else {
      setQuoteMessageType("error");
      setQuoteMessage("SOLICITAÇÃO REGISTRADA, MAS ESTE FORNECEDOR NÃO POSSUI WHATSAPP CADASTRADO.");
    }
  }

  return (
    <main className="provider-page">
      <header className="catalog-header">
        <AppLogo className="catalog-logo">LOSI <span>CONECTA</span></AppLogo>
        <Link to="/buscar" className="catalog-login provider-search-button">Buscar fornecedores</Link>
      </header>

      <section className="provider-hero">
        <div className="provider-hero-cover">
          {business.cover_url && <img src={business.cover_url} alt="" />}
        </div>
        <div className="provider-hero-content">
          <div className="provider-hero-identity">
            <div className="provider-hero-logo">
              {business.logo_url ? <img src={business.logo_url} alt={business.business_name} /> : <span>{business.business_name.slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="provider-hero-title">
              <div className="catalog-kicker">PERFIL PROFISSIONAL</div>
              {!isOfficial && <span className={"provider-plan-badge " + reputation.planSlug}>{reputation.planName}</span>}
              <h1>{business.business_name}</h1>
              {isOfficial ? <span className="provider-verified provider-official-badge">✓ PERFIL OFICIAL LOSI</span> : business.verified && <span className="provider-verified">Fornecedor verificado</span>}
              {(business.city || business.state) && <div className="provider-location">{business.city}{business.city && business.state ? " — " : ""}{business.state}</div>}
            </div>
          </div>

          <div className="provider-hero-reputation">
            <div className="provider-reputation">
              <div className="provider-reputation-head"><strong>{isOfficial ? "Perfil oficial da LOSI" : "Reputação do fornecedor"}</strong><span>{isOfficial ? "Satisfação máxima" : reputationLabel}</span></div>
              <div className="provider-reputation-bar" aria-label={`Reputação: ${satisfactionText}`}>
                {[1,2,3,4,5].map(level => <span key={level} className={`${reputationClass} ${level <= reputation.level ? "filled" : ""}`} />)}
              </div>
              <div className="provider-reputation-meta"><span>{satisfactionText}</span><span>{"★".repeat(reputation.stars)}{"☆".repeat(Math.max(0, 6 - reputation.stars))} · {reputation.stars}/6 estrelas</span></div>
              <div className="provider-reputation-meta"><span>{reputation.totalReviews} {reputation.totalReviews === 1 ? "avaliação" : "avaliações"}</span><span>{reputation.completedServices} {reputation.completedServices === 1 ? "serviço registrado" : "serviços registrados"}</span></div>
            </div>
          </div>

          <div className="provider-profile-actions">\n            <ProviderChat business={{ id: business.id, business_name: business.business_name, slug: business.slug, logo_url: business.logo_url, owner_id: business.owner_id }} userId={userId} onRequireAuth={openChatAfterAuth} />
            <button type="button" className={"provider-profile-like " + heartClass + (likedByCurrentUser ? " liked" : "")} onClick={toggleLike} disabled={likeBusy} aria-label={likedByCurrentUser ? "Remover curtida" : "Curtir perfil"} aria-pressed={likedByCurrentUser}>
              <span className="provider-profile-heart" aria-hidden="true">♥</span>
              <span className="provider-profile-like-count">{likeCount}</span>
              <span className="provider-profile-like-label">{likedByCurrentUser ? "Curtido" : "Curtir perfil"}</span>
            </button>
            <button type="button" className="provider-profile-save" onClick={toggleFavorite} disabled={favoriteBusy}>{favoriteBusy ? "Salvando..." : isFavorite ? "Fornecedor salvo" : "Salvar fornecedor"}</button>
            {userId !== business.owner_id && <button type="button" className="provider-profile-quote" onClick={openQuoteRequest}>Solicitar orçamento</button>}
            {whatsapp && <button type="button" className="provider-profile-contact" onClick={openWhatsApp}>Conversar pelo WhatsApp</button>}
            <button type="button" className="provider-profile-report" onClick={() => { setReportOpen(true); setReportMessage(""); }}>Denunciar fornecedor</button>
          </div>
        </div>
      </section>

      <section className="provider-profile-content">
        <div className="provider-profile-main">
          <div className="provider-profile-card">
            <div className="catalog-kicker">SOBRE O FORNECEDOR</div>
            <h2>Conheça o trabalho</h2>
            <p>{business.description || "Este profissional ainda não adicionou uma descrição."}</p>
          </div>

          {business.portfolio_urls?.length > 0 && (
            <div className="provider-profile-card">
              <div className="catalog-kicker">PORTFÓLIO</div>
              <h2>Trabalhos realizados</h2>
              <div className="provider-portfolio-grid">
                {business.portfolio_urls.map((url, index) => (
                  <a key={url + index} href={url} target="_blank" rel="noreferrer" className="provider-portfolio-item">
                    <img src={url} alt={"Trabalho " + (index + 1) + " de " + business.business_name} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {canRequestQuote && (
            <div id="provider-quote-request" className="provider-profile-card provider-quote-request-card">
              <div className="catalog-kicker">ORÇAMENTO</div>
              <h2>Solicitar orçamento</h2>
              <p>Envie os detalhes do seu evento. O fornecedor poderá responder com um orçamento diretamente pelo LOSI CONECTA.</p>
              <div className="provider-quote-safety-warning" role="alert">
                <strong>⚠️ Atenção à sua segurança</strong>
                <p>O LOSI CONECTA <strong>nunca solicita pagamentos por WhatsApp, e-mail ou telefone.</strong></p>
                <p>Dentro do aplicativo, o LOSI CONECTA também <strong>não solicita PIX para liberar orçamento, perfil, pagamento ou serviço.</strong></p>
                <span>Se alguém pedir um PIX dizendo representar o LOSI CONECTA para liberar ou enviar um orçamento, não faça o pagamento e denuncie o fornecedor.</span>
              </div>
              <form className="provider-quote-form" onSubmit={submitQuoteRequest}>
                <label>Seu nome<input name="client_name" required placeholder="Nome completo" /></label>
                <label>E-mail<input name="client_email" type="email" placeholder="seu@email.com" /></label>
                <label>Telefone / WhatsApp<input name="client_phone" placeholder="(11) 99999-9999" /></label>
                <label>Serviço<select name="service_id"><option value="">Selecione o serviço</option>{business.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
                <label>Tipo de evento<input name="event_title" required placeholder="Ex.: Festa infantil, evento corporativo..." /></label>
                <label>Data do evento<input name="event_date" type="date" /></label>
                <label>Local do evento<input name="event_location" placeholder="Cidade / espaço / endereço" /></label>
                <label>Detalhes<textarea name="description" rows={4} placeholder="Quantidade de pessoas, horário, necessidades e outras informações..." /></label>
                <button type="submit" disabled={quoteMessageType === "sending"}>{quoteMessageType === "sending" ? "Enviando..." : "Enviar solicitação de orçamento"}</button>
              </form>
              {quoteMessage && <small className={"provider-quote-message " + quoteMessageType} role="status">{quoteMessage}</small>}
            </div>
          )}



{business.show_availability && (
            <div className="provider-profile-card provider-availability-public">
              <div className="catalog-kicker">DISPONIBILIDADE</div>
              <h2>Agenda do fornecedor</h2>
              <p>Consulte as datas que este fornecedor informa como livres.</p>
              <button type="button" className="provider-availability-open" onClick={() => setAvailabilityOpen(true)}>
                Ver agenda
              </button>
            </div>
          )}

          <div className="provider-profile-card provider-reviews-card">
            <div className="catalog-kicker">AVALIAÇÕES</div>
            <div className="provider-rating-summary">
              <strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong>
              <span>{"★".repeat(Math.round(averageRating)) || "Sem avaliações"} · {isOfficial ? "Avaliação máxima" : `${reviews.length} ${reviews.length === 1 ? "avaliação" : "avaliações"}`}</span>
            </div>
            {reviews.length === 0 ? <p>Este fornecedor ainda não recebeu avaliações.</p> : (
              <div className="provider-review-list">
                {reviews.map((review) => (
                  <article key={review.id}>
                    <div className="provider-review-head"><strong>{review.reviewer?.full_name || "Usuário"}</strong><span>{"★".repeat(review.rating)}</span></div>
                    {review.comment && <p>{review.comment}</p>}
                  </article>
                ))}
              </div>
            )}
            <form className="provider-review-form" onSubmit={submitReview}>
              <h3>Avalie este fornecedor</h3>
              <label>Nota
                <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>
                  <option value={5}>5 — Excelente</option><option value={4}>4 — Muito bom</option><option value={3}>3 — Bom</option><option value={2}>2 — Regular</option><option value={1}>1 — Ruim</option>
                </select>
              </label>
              <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={3} placeholder="Conte como foi sua experiência..." />
              <button type="submit" disabled={reviewing}>{reviewing ? "Publicando..." : "Publicar avaliação"}</button>
              {reviewMessage && <small>{reviewMessage}</small>}
            </form>
          </div>

          <div className="provider-profile-card">
            <div className="catalog-kicker">SERVIÇOS</div>
            <h2>O que oferece</h2>
            {business.services.length === 0 ? (
              <p>Este fornecedor ainda não cadastrou serviços.</p>
            ) : (
              <div className="provider-service-list">
                {business.services.map((service) => (
                  <article key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      {service.categories?.name && <span>{service.categories.name}</span>}
                    </div>
                    {service.description && <p>{service.description}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="provider-profile-side">
          <div className="provider-profile-card">
            <div className="catalog-kicker">CONTATO</div>
            <h2>Informações</h2>
            {(business.city || business.state) && <p><strong>Localização</strong><br />{business.city}{business.city && business.state ? " — " : ""}{business.state}</p>}
            {business.address && <p><strong>Endereço</strong><br />{business.address}</p>}
            {business.website && <p><strong>Site</strong><br /><a href={business.website} target="_blank" rel="noreferrer">{business.website}</a></p>}
            {business.instagram && <p><strong>Instagram</strong><br /><a href={business.instagram} target="_blank" rel="noreferrer">{business.instagram}</a></p>}
            {!business.website && !business.instagram && !business.address && !business.city && !business.state && <p>O fornecedor ainda não informou outros dados de contato.</p>}
          </div>
        </aside>
      </section>
      {(publicQuoteLoading || publicQuote || publicQuoteError) && (
        <div className="provider-report-modal-backdrop public-quote-modal-backdrop" role="presentation">
          <section className="provider-report-modal public-quote-modal" role="dialog" aria-modal="true" aria-labelledby="public-quote-title">
            {publicQuoteLoading && <div className="public-quote-loading">Carregando proposta...</div>}
            {!publicQuoteLoading && publicQuote && (
              <>
                <div className="provider-report-modal-header">
                  <div>
                    <div className="catalog-kicker">PROPOSTA</div>
                    <h2 id="public-quote-title">Orçamento recebido</h2>
                    <p>Confira os detalhes da proposta enviada pelo fornecedor.</p>
                  </div>
                  <button type="button" className="provider-report-modal-close" aria-label="Fechar proposta" onClick={() => { setPublicQuote(null); setPublicQuoteError(""); setPublicQuoteResponseMessage(""); setPublicQuoteResponse(null); setPublicQuoteResponding(false); }}>×</button>
                </div>
                <div className="public-quote-supplier">
                  {publicQuote.supplier?.logo_url && <img src={publicQuote.supplier.logo_url} alt="" />}
                  <div><strong>{publicQuote.supplier?.business_name || "Fornecedor"}</strong><span>{publicQuote.request?.event_title || "Proposta comercial"}</span></div>
                </div>
                <div className="public-quote-grid">
                  <div><span>Cliente</span><strong>{publicQuote.request?.client_name || "Não informado"}</strong></div>
                  <div><span>Evento</span><strong>{publicQuote.request?.event_title || "Não informado"}</strong></div>
                  <div><span>Data</span><strong>{publicQuote.request?.event_date ? new Date(publicQuote.request.event_date + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada"}</strong></div>
                  <div><span>Local</span><strong>{publicQuote.request?.event_location || "Não informado"}</strong></div>
                </div>
                <div className="public-quote-items">
                  {(publicQuote.items || []).map((item: any) => <div key={item.id}><span>{item.quantity}x {item.description}</span><strong>{Number(item.total).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div>)}
                </div>
                <div className="public-quote-total"><span>Total da proposta</span><strong>{Number(publicQuote.quote?.total || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div>
                {publicQuote.quote?.validity_until && <p className="public-quote-note"><strong>Validade:</strong> {new Date(publicQuote.quote.validity_until + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
                {publicQuote.quote?.notes && <p className="public-quote-note"><strong>Observações:</strong> {publicQuote.quote.notes}</p>}
                {publicQuoteResponseMessage && <div className={"public-quote-response-message " + (publicQuoteResponse === "accepted" ? "accepted" : "rejected")}>{publicQuoteResponseMessage}</div>}
                {publicQuote.quote?.status !== "accepted" && publicQuote.quote?.status !== "rejected" && !publicQuoteResponse && (
                  <div className="public-quote-actions">
                    <button type="button" className="public-quote-reject" disabled={publicQuoteResponding || !publicQuoteToken} onClick={async () => {
                      if (!publicQuoteToken) return;
                      setPublicQuoteResponding(true);
                      setPublicQuoteResponseMessage("");
                      try {
                        const { data, error } = await supabase.rpc("respond_public_quote", {
                          p_quote_id: publicQuote.quote.id,
                          p_token: publicQuoteToken,
                          p_status: "rejected",
                        });
                        if (error) throw error;
                        setPublicQuoteResponse("rejected");
                        setPublicQuoteResponseMessage(data?.already_responded ? "Esta proposta já havia recebido uma resposta." : "Proposta recusada.");
                        setPublicQuote((current: any) => current ? { ...current, quote: { ...current.quote, status: "rejected" } } : current);
                      } catch (error: any) {
                        console.error("Erro ao recusar proposta:", error);
                        setPublicQuoteResponseMessage(error?.message || "Não foi possível recusar a proposta.");
                      } finally {
                        setPublicQuoteResponding(false);
                      }
                    }}>{publicQuoteResponding ? "Registrando..." : "Recusar proposta"}</button>
                    <button type="button" className="public-quote-accept" disabled={publicQuoteResponding || !publicQuoteToken} onClick={async () => {
                      if (!publicQuoteToken) return;
                      setPublicQuoteResponding(true);
                      setPublicQuoteResponseMessage("");
                      try {
                        const { data, error } = await supabase.rpc("respond_public_quote", {
                          p_quote_id: publicQuote.quote.id,
                          p_token: publicQuoteToken,
                          p_status: "accepted",
                        });
                        if (error) throw error;
                        setPublicQuoteResponse("accepted");
                        setPublicQuoteResponseMessage(data?.already_responded ? "Esta proposta já havia recebido uma resposta." : "Proposta aceita com sucesso.");
                        setPublicQuote((current: any) => current ? { ...current, quote: { ...current.quote, status: "accepted" } } : current);
                      } catch (error: any) {
                        console.error("Erro ao aceitar proposta:", error);
                        setPublicQuoteResponseMessage(error?.message || "Não foi possível aceitar a proposta.");
                      } finally {
                        setPublicQuoteResponding(false);
                      }
                    }}>{publicQuoteResponding ? "Registrando..." : "Aceitar proposta"}</button>
                  </div>
                )}
              </>
            )}
            {!publicQuoteLoading && publicQuoteError && <div><h2>Proposta indisponível</h2><p>{publicQuoteError}</p></div>}
          </section>
        </div>
      )}

      {reportOpen && (
        <div className="provider-report-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !reporting) {
            setReportOpen(false);
            setReportMessage("");
          }
        }}>
          <div className="provider-report-modal" role="dialog" aria-modal="true" aria-labelledby="provider-report-title">
            <div className="provider-report-modal-header">
              <div>
                <div className="catalog-kicker">SEGURANÇA</div>
                <h2 id="provider-report-title">Denunciar fornecedor</h2>
                <p>Selecione o motivo da denúncia e, se quiser, conte o que aconteceu.</p>
              </div>
              <button type="button" className="provider-report-modal-close" aria-label="Fechar" disabled={reporting} onClick={() => { setReportOpen(false); setReportMessage(""); }}>×</button>
            </div>
            <form className="provider-report-form" onSubmit={submitSupplierReport}>
              <label>Motivo
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                  <option value="tentativa_de_golpe">Tentativa de golpe</option>
                  <option value="perfil_falso">Perfil falso</option>
                  <option value="cobranca_suspeita">Cobrança suspeita</option>
                  <option value="servico_nao_realizado">Serviço não realizado</option>
                  <option value="comportamento_inadequado">Comportamento inadequado</option>
                  <option value="dados_falsos">Dados falsos</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label>Detalhes (opcional)
                <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} maxLength={1000} rows={4} placeholder="Explique brevemente o que aconteceu..." />
              </label>
              <div className="provider-report-actions">
                <button type="button" className="quotes-secondary" disabled={reporting} onClick={() => { setReportOpen(false); setReportMessage(""); }}>Cancelar</button>
                <button type="submit" className="provider-profile-report-submit" disabled={reporting}>{reporting ? "Enviando..." : "Enviar denúncia"}</button>
              </div>
              {reportMessage && <small role="status">{reportMessage}</small>}
            </form>
          </div>
        </div>
      )}
      {availabilityOpen && (
        <div className="availability-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAvailabilityOpen(false);
        }}>
          <section className="availability-modal-card" role="dialog" aria-modal="true" aria-labelledby="availability-modal-title">
            <button type="button" className="availability-modal-close" onClick={() => setAvailabilityOpen(false)} aria-label="Fechar">×</button>
            <div className="availability-modal-header">
              <div className="catalog-kicker">DISPONIBILIDADE</div>
              <h2 id="availability-modal-title">Agenda do fornecedor</h2>
              <p>Consulte as datas que este fornecedor informa como livres.</p>
            </div>
            <div className="availability-calendar-head">
              <button type="button" className="business-small-button" onClick={() => setAvailabilityMonth(new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth() - 1, 1))}>←</button>
              <strong>{availabilityMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
              <button type="button" className="business-small-button" onClick={() => setAvailabilityMonth(new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth() + 1, 1))}>→</button>
            </div>
            <div className="availability-weekdays">{["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="availability-calendar-grid">
              {(() => {
                const year = availabilityMonth.getFullYear();
                const month = availabilityMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const cells = [];
                for (let i = 0; i < firstDay; i++) cells.push(<span key={"public-empty-" + i} className="availability-day empty" />);
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
                  const unavailable = availabilityDates.includes(date);
                  cells.push(<div key={date} className={"availability-day public " + (unavailable ? "unavailable" : "available")}><strong>{day}</strong><small>{unavailable ? "Indisponível" : "Livre"}</small></div>);
                }
                return cells;
              })()}
            </div>
            <div className="availability-legend"><span><i className="available-dot" /> Livre</span><span><i className="unavailable-dot" /> Indisponível</span></div>
          </section>
        </div>
      )}
      <style>{`
        .public-quote-modal-backdrop{z-index:120}
        .public-quote-modal{width:min(680px,calc(100vw - 28px));max-height:88vh;overflow:auto}
        .public-quote-loading{padding:40px;text-align:center;color:#687386}
        .public-quote-supplier{display:flex;align-items:center;gap:14px;padding:16px;border:1px solid #d9dee8;border-radius:16px;background:#f8f9fb;margin:18px 0}
        .public-quote-supplier img{width:52px;height:52px;border-radius:14px;object-fit:cover}
        .public-quote-supplier div{display:grid;gap:4px}.public-quote-supplier span,.public-quote-grid span{color:#687386;font-size:12px}
        .public-quote-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
        .public-quote-grid>div{padding:14px;border:1px solid #d9dee8;border-radius:14px;background:#fff;display:grid;gap:5px}
        .public-quote-items{border:1px solid #d9dee8;border-radius:14px;overflow:hidden;margin-top:16px}
        .public-quote-items>div{display:flex;justify-content:space-between;gap:14px;padding:13px 15px;border-bottom:1px solid #edf0f4}.public-quote-items>div:last-child{border-bottom:0}
        .public-quote-total{display:flex;justify-content:space-between;align-items:center;padding:18px 0;font-size:14px}.public-quote-total strong{font-size:22px;color:#8a6d2f}
        .public-quote-note{padding:12px 14px;border-radius:12px;background:#f8f9fb;color:#687386}
        .public-quote-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:10px;margin-top:20px}.public-quote-actions button{min-height:48px;border-radius:12px;padding:0 18px;font-weight:700;cursor:pointer;transition:.2s}.public-quote-actions button:disabled{opacity:.65;cursor:wait}.public-quote-reject{border:1px solid #d9dee8;background:#fff;color:#7c3030}.public-quote-accept{border:1px solid #d6b46a;background:linear-gradient(145deg,#0b182a,#07111f);color:#f0d99a;box-shadow:0 8px 18px rgba(7,17,31,.12)}.public-quote-response-message{margin-top:16px;padding:14px;border-radius:12px;font-weight:700;text-align:center}.public-quote-response-message.accepted{background:#eefaf3;color:#237345}.public-quote-response-message.rejected{background:#fff1f1;color:#a32f2f}        @media(max-width:700px){.public-quote-grid{grid-template-columns:1fr}.public-quote-modal{padding:20px}}
      `}</style>
      {authModalOpen && <AuthModal onClose={() => { setAuthModalOpen(false); setPendingAuthAction(null); }} onAuthenticated={handleAuthenticatedFromModal} />}
    </main>
  );
}
