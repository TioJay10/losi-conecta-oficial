import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { AppLogo } from "../../components/AppLogo";
import { AuthModal } from "../../components/AuthModal";

type Service = { id: string; name: string; description: string | null; categories: { name: string } | null };
const OFFICIAL_BUSINESS_ID = "333ccf56-324f-4e4f-99e3-1ebc9ade0140";

type Review = { id: string; rating: number; comment: string | null; created_at: string; reviewer: { full_name: string | null } | null };
type Business = {
  id: string; business_name: string; slug: string; description: string | null;
  whatsapp: string | null; phone: string | null; instagram: string | null; website: string | null;
  city: string | null; state: string | null; address: string | null; logo_url: string | null;
  cover_url: string | null; verified: boolean; portfolio_urls: string[]; services: Service[]; owner_id: string; created_at: string; reputation_report_count: number; reputation_service_count: number;
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("tentativa_de_golpe");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [reporting, setReporting] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<"quote" | "favorite" | "whatsapp" | null>(null);
  const [quoteMessageType, setQuoteMessageType] = useState<"success" | "error" | "sending" | "">("");
  const [reputation, setReputation] = useState({ score: 0, level: 1, reviews: 0, negativeReviews: 0, completedServices: 0, reports: 0, blocked: false });

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (mounted) setUserId(sessionData.session?.user.id ?? null);
      const { data, error: queryError } = await supabase
        .from("business_profiles")
        .select("id,business_name,slug,description,whatsapp,phone,instagram,website,city,state,address,logo_url,cover_url,portfolio_urls,verified,owner_id,created_at,reputation_report_count,reputation_service_count,services(id,name,description,categories(name))")
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
            const negativeReviews = activeReviews.filter(review => review.rating <= 2).length;
            const reports = loaded.reputation_report_count ?? 0;
            const completedServices = loaded.reputation_service_count ?? 0;
            const blocked = Boolean((ownerData as { blocked?: boolean } | null)?.blocked);
            const monthsOnPlatform = Math.max(0, (Date.now() - new Date(loaded.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
            let score = 20;
            score += Math.min(25, Math.floor(monthsOnPlatform / 3) * 5);
            score += Math.min(25, completedServices * 5);
            score += activeReviews.length ? Math.round((activeReviews.reduce((sum, review) => sum + review.rating, 0) / activeReviews.length) * 5) : 0;
            score -= negativeReviews * 8;
            score -= reports * 12;
            if (blocked) score -= 40;
            score = Math.max(0, Math.min(100, score));
            const level = score < 20 ? 1 : score < 40 ? 2 : score < 60 ? 3 : score < 80 ? 4 : 5;
            if (mounted) setReputation(loaded.id === OFFICIAL_BUSINESS_ID
              ? { score: 100, level: 5, reviews: activeReviews.length, negativeReviews: 0, completedServices, reports: 0, blocked: false }
              : { score, level, reviews: activeReviews.length, negativeReviews, completedServices, reports, blocked });

            if (sessionData.session) {
              const { data: favoriteData } = await supabase.from("favorites").select("business_id").eq("user_id", sessionData.session.user.id).eq("business_id", loaded.id).maybeSingle();
              if (mounted) setIsFavorite(Boolean(favoriteData));
            }
          }
        }
      }
      setLoading(false);
    }
    load();
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

  async function toggleFavorite() {
    if (!userId) {
      window.location.href = "/entrar";
      return;
    }
    setFavoriteBusy(true);
    const result = isFavorite
      ? await supabase.from("favorites").delete().eq("user_id", userId).eq("business_id", business.id)
      : await supabase.from("favorites").insert({ user_id: userId, business_id: business.id });
    if (result.error) {
      console.error("Erro ao alterar fornecedor salvo:", result.error);
    } else {
      setIsFavorite(!isFavorite);
    }
    setFavoriteBusy(false);
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
  const reputationLabel = reputation.level === 1 ? "Atenção" : reputation.level === 2 ? "Inicial" : reputation.level === 3 ? "Boa" : reputation.level === 4 ? "Muito boa" : "Excelente";
  const reputationClass = `level-${reputation.level}`;


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

  function openQuoteRequest() {
    if (!userId) {
      setAuthModalOpen(true);
      return;
    }
    const target = document.getElementById("provider-quote-request");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleAuthenticatedFromModal() {
    setAuthModalOpen(false);
    window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user.id ?? null);
      document.getElementById("provider-quote-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
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
      setQuoteMessage("NÃO FOI POSSÍVEL SOLICITAR O ORÇAMENTO");
      return;
    }

    const serviceName = business.services.find((service) => service.id === payload.service_id)?.name || "Não informado";
    const { data: requesterBusiness } = await supabase
      .from("business_profiles")
      .select("slug,business_name")
      .eq("owner_id", currentUser.id)
      .eq("active", true)
      .maybeSingle();
    const requesterProfileUrl = requesterBusiness?.slug
      ? window.location.origin + "/fornecedor/" + requesterBusiness.slug
      : "";
    const whatsappNumber = (business.whatsapp || business.phone || "").replace(/\D/g, "");
    const normalizedWhatsapp = whatsappNumber
      ? (whatsappNumber.startsWith("55") ? whatsappNumber : "55" + whatsappNumber)
      : "";

    const whatsappMessage = [
      "Olá! Recebi sua solicitação de orçamento pelo LOSI CONECTA.",
      "",
      "INFORMAÇÕES DE QUEM SOLICITOU",
      "Nome: " + payload.client_name,
      payload.client_phone ? "WhatsApp/Telefone: " + payload.client_phone : "",
      payload.client_email ? "E-mail: " + payload.client_email : "",
      "",
      "DADOS DA SOLICITAÇÃO",
      "Serviço: " + serviceName,
      "Tipo de evento: " + payload.event_title,
      "Data do evento: " + (payload.event_date ? new Date(payload.event_date + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada"),
      payload.event_location ? "Local: " + payload.event_location : "",
      payload.description ? "Detalhes: " + payload.description : "",
      requesterProfileUrl ? "" : "",
      requesterProfileUrl ? "🔗 PERFIL PÚBLICO DE QUEM SOLICITOU: " + requesterProfileUrl : "",
      "",
      "Esta solicitação foi registrada no LOSI CONECTA.",
    ].filter(Boolean).join("\n");

    formElement.reset();

    if (normalizedWhatsapp) {
      window.open(
        "https://wa.me/" + normalizedWhatsapp + "?text=" + encodeURIComponent(whatsappMessage),
        "_blank",
        "noopener,noreferrer",
      );
      setQuoteMessageType("success");
      setQuoteMessage("SOLICITAÇÃO REGISTRADA. O WHATSAPP FOI ABERTO COM OS DADOS PARA ENVIO.");
    } else {
      setQuoteMessageType("error");
      setQuoteMessage("SOLICITAÇÃO REGISTRADA, MAS ESTE FORNECEDOR NÃO POSSUI WHATSAPP CADASTRADO.");
    }
  }

  return (
    <main className="provider-page">
      <header className="catalog-header">
        <AppLogo className="catalog-logo">LOSI <span>CONECTA</span></AppLogo>
        <Link to="/buscar" className="catalog-login">Buscar fornecedores</Link>
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
              <h1>{business.business_name}</h1>
              {isOfficial ? <span className="provider-verified provider-official-badge">✓ PERFIL OFICIAL LOSI</span> : business.verified && <span className="provider-verified">Fornecedor verificado</span>}
              {(business.city || business.state) && <div className="provider-location">{business.city}{business.city && business.state ? " — " : ""}{business.state}</div>}
            </div>
          </div>

          <div className="provider-hero-reputation">
            <div className="provider-reputation">
              <div className="provider-reputation-head"><strong>{isOfficial ? "Perfil oficial da LOSI" : "Reputação do fornecedor"}</strong><span>{isOfficial ? "Satisfação máxima" : reputationLabel}</span></div>
              <div className="provider-reputation-bar" aria-label={`Reputação: ${reputationLabel}`}>
                {[1,2,3,4,5].map(level => <span key={level} className={`${reputationClass} ${level <= reputation.level ? "filled" : ""}`} />)}
              </div>
              <div className="provider-reputation-meta"><span>{reputation.reviews} {reputation.reviews === 1 ? "avaliação" : "avaliações"}</span><span>{reputation.completedServices} {reputation.completedServices === 1 ? "serviço registrado" : "serviços registrados"}</span></div>
            </div>
          </div>

          <div className="provider-profile-actions">
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

          {reportOpen && (
            <div className="provider-profile-card provider-report-card">
              <div className="catalog-kicker">SEGURANÇA</div>
              <h2>Denunciar fornecedor</h2>
              <p>Selecione o motivo da denúncia. Use este canal apenas para situações relacionadas a este fornecedor.</p>
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
                  <button type="button" className="quotes-secondary" onClick={() => { setReportOpen(false); setReportMessage(""); }}>Cancelar</button>
                  <button type="submit" className="provider-profile-report-submit" disabled={reporting}>{reporting ? "Enviando..." : "Enviar denúncia"}</button>
                </div>
                {reportMessage && <small>{reportMessage}</small>}
              </form>
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
      {authModalOpen && <AuthModal onClose={() => { setAuthModalOpen(false); setPendingAuthAction(null); }} onAuthenticated={handleAuthenticatedFromModal} />}
    </main>
  );
}
