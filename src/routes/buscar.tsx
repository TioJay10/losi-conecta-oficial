import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Category = { id: string; name: string; slug: string };
type Service = { id: string; name: string; category_id: string; categories: { name: string } | null };
type ReviewSummary = { rating: number };
type Business = {
  id: string; business_name: string; slug: string; description: string | null;
  whatsapp: string | null; phone: string | null; instagram: string | null; website: string | null;
  city: string | null; state: string | null; logo_url: string | null; cover_url: string | null;
  verified: boolean; services: Service[]; reviews: ReviewSummary[];
};

export const Route = createFileRoute("/buscar")({ component: SearchPage });

function SearchPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      const [businessResult, categoryResult] = await Promise.all([
        supabase
          .from("business_profiles")
          .select("id,business_name,slug,description,whatsapp,phone,instagram,website,city,state,logo_url,cover_url,verified,services(id,name,category_id,categories(name)),reviews(rating)")
          .eq("active", true)
          .eq("approval_status", "approved")
          .order("business_name"),
        supabase.from("categories").select("id,name,slug").eq("active", true).order("name"),
      ]);
      if (!mounted) return;
      if (businessResult.error || categoryResult.error) {
        setError("Não foi possível carregar os fornecedores.");
      } else {
        setBusinesses((businessResult.data ?? []) as unknown as Business[]);
        setCategories(categoryResult.data ?? []);
      }
      setLoading(false);
    }
    loadCatalog();
    return () => { mounted = false; };
  }, []);

  const results = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    const normalizedCity = city.trim().toLocaleLowerCase("pt-BR");
    return businesses.filter((business) => {
      const searchable = [
        business.business_name, business.description ?? "", business.city ?? "", business.state ?? "",
        ...business.services.map((service) => service.name),
        ...business.services.map((service) => service.categories?.name ?? ""),
      ].join(" ").toLocaleLowerCase("pt-BR");
      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!normalizedCity || (business.city ?? "").toLocaleLowerCase("pt-BR").includes(normalizedCity)) &&
        (!categoryId || business.services.some((service) => service.category_id === categoryId))
      );
    });
  }, [businesses, search, city, categoryId]);

  function whatsappUrl(business: Business) {
    const raw = business.whatsapp || business.phone || "";
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    const number = digits.startsWith("55") ? digits : "55" + digits;
    const text = encodeURIComponent("Olá! Encontrei a " + business.business_name + " no LOSI CONECTA e gostaria de saber mais sobre os serviços.");
    return "https://wa.me/" + number + "?text=" + text;
  }

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <Link to="/" className="catalog-logo">LOSI <span>CONECTA</span></Link>
        <Link to="/entrar" className="catalog-login">Entrar</Link>
      </header>
      <section className="catalog-hero">
        <div className="catalog-kicker">ENCONTRE PROFISSIONAIS PARA SEU EVENTO</div>
        <h1>Encontre o fornecedor que seu evento precisa.</h1>
        <p>Pesquise por serviço, categoria ou localização e conheça profissionais cadastrados no LOSI CONECTA.</p>
        <div className="catalog-search">
          <div className="catalog-field catalog-search-field">
            <label htmlFor="catalog-search">O que você procura?</label>
            <input id="catalog-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: recreação, fotógrafo, DJ..." />
          </div>
          <div className="catalog-field">
            <label htmlFor="catalog-city">Cidade</label>
            <input id="catalog-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: Cotia" />
          </div>
          <div className="catalog-field">
            <label htmlFor="catalog-category">Categoria</label>
            <select id="catalog-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Todas as categorias</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
        </div>
      </section>
      <section className="catalog-results">
        <div className="catalog-results-head">
          <div>
            <div className="catalog-kicker">FORNECEDORES</div>
            <h2>{loading ? "Carregando..." : String(results.length) + " fornecedor" + (results.length === 1 ? "" : "es") + " encontrado" + (results.length === 1 ? "" : "s")}</h2>
          </div>
          {(search || city || categoryId) && (
            <button className="catalog-clear" onClick={() => { setSearch(""); setCity(""); setCategoryId(""); }}>Limpar filtros</button>
          )}
        </div>
        {error && <div className="catalog-message catalog-error">{error}</div>}
        {!loading && !error && results.length === 0 && (
          <div className="catalog-empty">
            <strong>Ainda não encontramos fornecedores com esses filtros.</strong>
            <p>Experimente outra categoria, cidade ou termo de busca.</p>
            <Link to="/entrar">Quero cadastrar minha empresa</Link>
          </div>
        )}
        <div className="catalog-grid">
          {results.map((business) => {
            const whatsapp = whatsappUrl(business);
            const serviceNames = business.services.map((service) => service.name).filter(Boolean).slice(0, 3);
            return (
              <article className="provider-card" key={business.id}>
                <div className="provider-cover">
                  {business.cover_url && <img src={business.cover_url} alt="" />}
                  <div className="provider-logo">
                    {business.logo_url ? <img src={business.logo_url} alt={business.business_name} /> : <span>{business.business_name.slice(0, 1).toUpperCase()}</span>}
                  </div>
                </div>
                <div className="provider-body">
                  <div className="provider-title-row">
                    <h3>{business.business_name}</h3>
                    {business.verified && <span className="provider-verified">Verificado</span>}
                  </div>
                  {(business.city || business.state) && (
                    <div className="provider-location">
                      {business.city}{business.city && business.state ? " — " : ""}{business.state}
                    </div>
                  )}
                  {business.reviews.length > 0 && (() => {
                    const avg = business.reviews.reduce((sum, review) => sum + review.rating, 0) / business.reviews.length;
                    return <div className="provider-card-rating" aria-label={avg.toFixed(1) + " de 5, " + business.reviews.length + " avaliações"}>
                      <strong>★ {avg.toFixed(1)}</strong>
                      <span>{business.reviews.length} {business.reviews.length === 1 ? "avaliação" : "avaliações"}</span>
                    </div>;
                  })()}
                  <p>{business.description || "Profissional ou empresa para eventos cadastrada no LOSI CONECTA."}</p>
                  {serviceNames.length > 0 && <div className="provider-services">{serviceNames.map((service) => <span key={service}>{service}</span>)}</div>}
                  <div className="provider-actions">
                    <Link to={"/fornecedor/" + business.slug} className="provider-profile-link">Ver perfil</Link>
                    {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="provider-primary">Conversar pelo WhatsApp</a> : <span className="provider-disabled">Contato ainda não informado</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
