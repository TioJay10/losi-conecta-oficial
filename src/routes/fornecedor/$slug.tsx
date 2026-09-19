import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../lib/supabase";

type Service = { id: string; name: string; description: string | null; categories: { name: string } | null };
type Review = { id: string; rating: number; comment: string | null; created_at: string; reviewer: { full_name: string | null } | null };
type Business = {
  id: string; business_name: string; slug: string; description: string | null;
  whatsapp: string | null; phone: string | null; instagram: string | null; website: string | null;
  city: string | null; state: string | null; address: string | null; logo_url: string | null;
  cover_url: string | null; verified: boolean; portfolio_urls: string[]; services: Service[];
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

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (mounted) setUserId(sessionData.session?.user.id ?? null);
      const { data, error: queryError } = await supabase
        .from("business_profiles")
        .select("id,business_name,slug,description,whatsapp,phone,instagram,website,city,state,address,logo_url,cover_url,portfolio_urls,verified,services(id,name,description,categories(name))")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (!mounted) return;
      if (queryError) {
        setError("Não foi possível carregar este fornecedor.");
      } else {
        const loaded = (data ?? null) as unknown as Business;
        setBusiness(loaded);
        if (loaded) {
          const { data: reviewData } = await supabase
            .from("reviews")
            .select("id,rating,comment,created_at,reviewer:profiles(full_name)")
            .eq("business_id", loaded.id)
            .eq("active", true)
            .order("created_at", { ascending: false });
          if (mounted) {
            setReviews((reviewData ?? []) as unknown as Review[]);
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

  async function toggleFavorite() {\n    if (!userId) {\n      window.location.href = "/entrar";\n      return;\n    }\n    setFavoriteBusy(true);\n    const result = isFavorite\n      ? await supabase.from("favorites").delete().eq("user_id", userId).eq("business_id", business.id)\n      : await supabase.from("favorites").insert({ user_id: userId, business_id: business.id });\n    if (!result.error) setIsFavorite(!isFavorite);\n    setFavoriteBusy(false);\n  }\n\n  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    setReviewMessage("");
    setReviewing(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setReviewMessage("Entre na sua conta para avaliar este fornecedor.");
      setReviewing(false);
      return;
    }
    const { error: insertError } = await supabase.from("reviews").insert({
      business_id: business.id,
      reviewer_id: sessionData.session.user.id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    });
    if (insertError) {
      setReviewMessage(insertError.code === "23505" ? "Você já avaliou este fornecedor." : "Não foi possível publicar sua avaliação.");
    } else {
      setReviewComment("");
      setReviewRating(5);
      const { data: reviewData } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at,reviewer:profiles(full_name)")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      setReviews((reviewData ?? []) as unknown as Review[]);
      setReviewMessage("Avaliação publicada.");
    }
    setReviewing(false);
  }

  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  const rawPhone = business.whatsapp || business.phone || "";
  const digits = rawPhone.replace(/\D/g, "");
  const whatsapp = digits ? "https://wa.me/" + (digits.startsWith("55") ? digits : "55" + digits) + "?text=" + encodeURIComponent("Olá! Encontrei a " + business.business_name + " no LOSI CONECTA.") : null;

  return (
    <main className="provider-page">
      <header className="catalog-header">
        <Link to="/" className="catalog-logo">LOSI <span>CONECTA</span></Link>
        <Link to="/buscar" className="catalog-login">Buscar fornecedores</Link>
      </header>

      <section className="provider-hero">
        <div className="provider-hero-cover">
          {business.cover_url && <img src={business.cover_url} alt="" />}
        </div>
        <div className="provider-hero-content">
          <div className="provider-hero-logo">
            {business.logo_url ? <img src={business.logo_url} alt={business.business_name} /> : <span>{business.business_name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="provider-hero-title">
            <div className="catalog-kicker">PERFIL PROFISSIONAL</div>
            <h1>{business.business_name}</h1>
            {business.verified && <span className="provider-verified">Fornecedor verificado</span>}
            {(business.city || business.state) && <div className="provider-location">{business.city}{business.city && business.state ? " — " : ""}{business.state}</div>}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{<button type="button" className="provider-profile-save" onClick={toggleFavorite} disabled={favoriteBusy}>{isFavorite ? "Fornecedor salvo" : "Salvar fornecedor"}</button>}{whatsapp && <a className="provider-profile-contact" href={whatsapp} target="_blank" rel="noreferrer">Conversar pelo WhatsApp</a>}</div>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 18 }}>
                {business.portfolio_urls.map((url, index) => (
                  <a key={url + index} href={url} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 12, overflow: "hidden", border: "1px solid #e7e9f0", aspectRatio: "4 / 3", background: "#f3f4f8" }}>
                    <img src={url} alt={"Trabalho " + (index + 1) + " de " + business.business_name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="provider-profile-card provider-reviews-card">
            <div className="catalog-kicker">AVALIAÇÕES</div>
            <div className="provider-rating-summary">
              <strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong>
              <span>{"★".repeat(Math.round(averageRating)) || "Sem avaliações"} · {reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"}</span>
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
    </main>
  );
}
