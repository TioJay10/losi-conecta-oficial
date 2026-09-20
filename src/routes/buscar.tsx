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
  verified: boolean; latitude: number | null; longitude: number | null; services: Service[]; reviews: ReviewSummary[];
};

export const Route = createFileRoute("/buscar")({ component: SearchPage });

function SearchPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userBusinessSlug, setUserBusinessSlug] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      if (currentUserId) {
        setUserId(currentUserId);
        const [{ data: favoriteData }, { data: ownBusiness }] = await Promise.all([
          supabase.from("favorites").select("business_id").eq("user_id", currentUserId),
          supabase.from("business_profiles").select("slug").eq("owner_id", currentUserId).maybeSingle(),
        ]);
        if (mounted) {
          setFavoriteIds((favoriteData ?? []).map((item) => item.business_id));
          setUserBusinessSlug(ownBusiness?.slug ?? null);
        }
      }
      if (mounted) setAuthLoading(false);
      const [businessResult, categoryResult] = await Promise.all([
        supabase
          .from("business_profiles")
          .select("id,business_name,slug,description,whatsapp,phone,instagram,website,city,state,logo_url,cover_url,verified,latitude,longitude,services(id,name,category_id,categories(name)),reviews(rating)")
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
    return (
    <main className="marketplace-page">
      <header className="marketplace-header">
        <div className="marketplace-header-inner">
          <Link to="/" className="marketplace-logo" aria-label="LOSI CONECTA">LOSI <span>CONECTA</span></Link>
          <div className="marketplace-main-search">
            <input
              id="marketplace-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar fornecedores, serviços ou categorias"
              aria-label="Buscar fornecedores, serviços ou categorias"
            />
            <button type="button" onClick={() => document.getElementById("marketplace-search")?.focus()} aria-label="Buscar">⌕</button>
          </div>
          <div className="marketplace-header-actions">
            {userId && userBusinessSlug && <Link to="/painel" className="marketplace-account">Minha conta</Link>}
            {userId ? (
              <button type="button" className="marketplace-account" disabled={authLoading} onClick={async () => { await supabase.auth.signOut(); window.location.href = "/entrar"; }}>Sair</button>
            ) : (
              <Link to="/entrar" className="marketplace-account">Entrar</Link>
            )}
          </div>
        </div>
      </header>

      <nav className="marketplace-category-bar" aria-label="Categorias">
        <div className="marketplace-category-inner">
          <button type="button" className={!categoryId ? "active" : ""} onClick={() => setCategoryId("")}>Todos</button>
          {categories.slice(0, 8).map((category) => (
            <button type="button" key={category.id} className={categoryId === category.id ? "active" : ""} onClick={() => setCategoryId(category.id)}>
              {category.name}
            </button>
          ))}
        </div>
      </nav>

      <section className="marketplace-search-panel">
        <div className="marketplace-breadcrumb">LOSI CONECTA <span>›</span> Encontrar fornecedor</div>
        <h1>Encontre fornecedores para o seu evento</h1>
        <p>Compare profissionais e empresas por serviço, categoria e localização.</p>
        <div className="marketplace-filter-row">
          <div className="marketplace-filter-main">
            <label htmlFor="marketplace-service">O que você procura?</label>
            <input id="marketplace-service" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: DJ, recreação, decoração, fotografia..." />
          </div>
          <div className="marketplace-filter-field">
            <label htmlFor="marketplace-city">Localização</label>
            <input id="marketplace-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade ou região" />
          </div>
          <div className="marketplace-filter-field">
            <label htmlFor="marketplace-category">Categoria</label>
            <select id="marketplace-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <button type="button" className="marketplace-search-button" onClick={() => document.getElementById("marketplace-service")?.focus()}>Buscar</button>
        </div>
      </section>

      <main className="marketplace-content">
        <aside className="marketplace-sidebar">
          <div className="marketplace-sidebar-title">Filtrar resultados</div>
          <div className="marketplace-filter-group">
            <label htmlFor="marketplace-radius">Distância</label>
            <select id="marketplace-radius" value={radiusKm ?? ""} onChange={(event) => {
              const value = event.target.value;
              setRadiusKm(value ? Number(value) : null);
              if (!value) { setUserLocation(null); setLocationMessage(""); }
            }}>
              <option value="">Qualquer distância</option>
              <option value="1">Até 1 km</option>
              <option value="5">Até 5 km</option>
              <option value="10">Até 10 km</option>
              <option value="25">Até 25 km</option>
              <option value="50">Até 50 km</option>
              <option value="100">Até 100 km</option>
            </select>
          </div>
          <div className="marketplace-filter-group">
            <div className="marketplace-filter-label">Categorias</div>
            <button type="button" className={!categoryId ? "selected" : ""} onClick={() => setCategoryId("")}>Todas as categorias</button>
            {categories.map((category) => (
              <button type="button" key={category.id} className={categoryId === category.id ? "selected" : ""} onClick={() => setCategoryId(category.id)}>{category.name}</button>
            ))}
          </div>
          {(search || city || categoryId || radiusKm !== null) && (
            <button type="button" className="marketplace-clear-all" onClick={() => { setSearch(""); setCity(""); setCategoryId(""); setRadiusKm(null); setUserLocation(null); setLocationMessage(""); }}>
              Limpar filtros
            </button>
          )}
        </aside>

        <section className="marketplace-results">
          <div className="marketplace-results-top">
            <div>
              <div className="marketplace-results-context">{loading ? "CARREGANDO" : results.length + " RESULTADO" + (results.length === 1 ? "" : "S")}</div>
              <h2>{search ? "Fornecedores para "" + search + """ : "Fornecedores em destaque"}</h2>
            </div>
            <label className="marketplace-sort">
              <span>Ordenar por</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar resultados">
                <option value="relevance">Mais relevantes</option>
                <option value="rating">Melhor avaliados</option>
                <option value="saved">Salvos primeiro</option>
                <option value="az">Nome: A–Z</option>
              </select>
            </label>
          </div>

          {locationLoading && <div className="marketplace-message">Obtendo sua localização para filtrar por raio...</div>}
          {locationMessage && <div className="marketplace-message marketplace-error">{locationMessage}</div>}
          {error && <div className="marketplace-message marketplace-error">{error}</div>}

          {(search || city || categoryId || radiusKm !== null) && (
            <div className="marketplace-active-filters" aria-label="Filtros ativos">
              {search && <span>Busca: {search}</span>}
              {city && <span>Localização: {city}</span>}
              {categoryId && <span>Categoria: {categories.find((category) => category.id === categoryId)?.name}</span>}
              {radiusKm !== null && <span>Até {radiusKm} km</span>}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
            <div className="marketplace-empty">
              <strong>{sortBy === "saved" ? "Você ainda não tem fornecedores salvos." : "Nenhum fornecedor encontrado."}</strong>
              <p>{sortBy === "saved" ? "Salve fornecedores durante sua pesquisa para encontrá-los novamente." : "Tente remover um filtro ou pesquisar por outro serviço ou cidade."}</p>
            </div>
          )}

          <div className="marketplace-grid">
            {sortedResults.map((business) => {
              const whatsapp = whatsappUrl(business);
              const serviceNames = business.services.map((service) => service.name).filter(Boolean).slice(0, 3);
              const avg = business.reviews.length ? business.reviews.reduce((sum, review) => sum + review.rating, 0) / business.reviews.length : 0;
              return (
                <article className="marketplace-card" key={business.id}>
                  <div className="marketplace-card-media">
                    {business.cover_url ? <img src={business.cover_url} alt="" /> : <div className="marketplace-card-media-fallback" />}
                    <button type="button" className={"marketplace-favorite " + (favoriteIds.includes(business.id) ? "saved" : "")} onClick={() => toggleFavorite(business.id)} disabled={favoriteBusy === business.id} aria-label={favoriteIds.includes(business.id) ? "Remover dos salvos" : "Salvar fornecedor"}>
                      {favoriteIds.includes(business.id) ? "♥" : "♡"}
                    </button>
                  </div>
                  <div className="marketplace-card-body">
                    <div className="marketplace-card-heading">
                      <h3>{business.business_name}</h3>
                      {business.verified && <span className="marketplace-verified">Verificado</span>}
                    </div>
                    {(business.city || business.state) && <div className="marketplace-location">{business.city}{business.city && business.state ? " — " : ""}{business.state}</div>}
                    {business.reviews.length > 0 && <div className="marketplace-rating"><strong>★ {avg.toFixed(1)}</strong><span>{business.reviews.length} {business.reviews.length === 1 ? "avaliação" : "avaliações"}</span></div>}
                    <p>{business.description || "Profissional ou empresa para eventos cadastrada no LOSI CONECTA."}</p>
                    {serviceNames.length > 0 && <div className="marketplace-services">{serviceNames.map((service) => <span key={service}>{service}</span>)}</div>}
                    <div className="marketplace-card-footer">
                      <Link to={"/fornecedor/" + business.slug} className="marketplace-profile-link">Ver fornecedor</Link>
                      {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="marketplace-contact">WhatsApp</a> : <span className="marketplace-no-contact">Contato não informado</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </main>
  );

}
