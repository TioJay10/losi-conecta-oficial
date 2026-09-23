import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { supabase } from "../lib/supabase";
import { AppLogo } from "../components/AppLogo";
import { AuthModal } from "../components/AuthModal";
import { calculateReputation } from "../lib/reputation";

type Category = { id: string; name: string; slug: string };
type Service = { id: string; name: string; category_id: string; categories: { name: string } | null };
type ReviewSummary = { rating: number };
type Business = {
  id: string; business_name: string; slug: string; description: string | null;
  whatsapp: string | null; phone: string | null; instagram: string | null; website: string | null;
  city: string | null; state: string | null; cep: string | null; bairro: string | null; logo_url: string | null; cover_url: string | null;
  verified: boolean; latitude: number | null; longitude: number | null; services: Service[]; reviews: ReviewSummary[]; plan?: { plan_slug: string; plan_name: string; plan_priority: number; ends_at: string | null } | null;
};

export const Route = createFileRoute("/buscar")({ component: SearchPage });

const OFFICIAL_BUSINESS_ID = "333ccf56-324f-4e4f-99e3-1ebc9ade0140";

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
  const [locationCep, setLocationCep] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userBusinessSlug, setUserBusinessSlug] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<
    { type: "favorite"; businessId: string } | { type: "whatsapp"; url: string } | { type: "menu"; path: string } | null
  >(null);

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      if (currentUserId) {
        setUserId(currentUserId);
        const [{ data: favoriteData }, { data: ownBusiness }, { data: personalProfile }] = await Promise.all([
          supabase.from("favorites").select("business_id").eq("user_id", currentUserId),
          supabase.from("business_profiles").select("slug").eq("owner_id", currentUserId).maybeSingle(),
          supabase.from("profiles").select("cep,city,state").eq("id", currentUserId).maybeSingle(),
        ]);
        if (mounted) {
          setFavoriteIds((favoriteData ?? []).map((item) => item.business_id));
          setUserBusinessSlug(ownBusiness?.slug ?? null);
          if (personalProfile?.cep) {
            setLocationCep(personalProfile.cep.replace(/(\d{5})(\d{3})/, "$1-$2"));
            if (personalProfile.city) setCity(personalProfile.city);
            void lookupLocationCep(personalProfile.cep);
          }
        }
      }
      if (mounted) setAuthLoading(false);
      const [businessResult, categoryResult, planResult] = await Promise.all([
        supabase
          .from("business_profiles")
          .select("id,business_name,slug,description,whatsapp,phone,instagram,website,city,state,cep,bairro,logo_url,cover_url,verified,latitude,longitude,services(id,name,category_id,categories(name)),reviews(rating)")
          .eq("active", true)
          .eq("approval_status", "approved")
          .order("business_name"),
        supabase.from("categories").select("id,name,slug").eq("active", true).order("name"),
        supabase.from("supplier_plan_visibility").select("business_id,plan_slug,plan_name,plan_priority,ends_at"),
      ]);
      if (!mounted) return;
      if (businessResult.error || categoryResult.error || planResult.error) {
        console.error("Erro ao carregar catálogo de fornecedores:", businessResult.error ?? categoryResult.error ?? planResult.error);
        setError(
          "Não foi possível carregar os fornecedores: " +
          (businessResult.error?.message ?? categoryResult.error?.message ?? planResult.error?.message ?? "erro desconhecido")
        );
      } else {
        const planRows = (planResult.data ?? []) as Array<{ business_id: string; plan_slug: string; plan_name: string; plan_priority: number; ends_at: string | null }>;
        const planByBusiness = new Map(planRows.map((row) => [row.business_id, row]));
        const loadedBusinesses = ((businessResult.data ?? []) as unknown as Business[]).map((business) => ({
          ...business,
          plan: planByBusiness.get(business.id) ?? { business_id: business.id, plan_slug: "gratis", plan_name: "Grátis", plan_priority: 0, ends_at: null },
        }));
        setBusinesses(loadedBusinesses);
        setCategories(categoryResult.data ?? []);
      }
    }
    loadCatalog().catch((loadError) => {
      console.error("Erro inesperado ao carregar catálogo:", loadError);
      if (mounted) setError("Não foi possível carregar os fornecedores.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

async function geocodeAddress(address: string) {
  const query = encodeURIComponent(address);
  const response = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=" + query, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Não foi possível localizar este endereço.");
  const results = await response.json();
  const first = results?.[0];
  if (!first || !first.lat || !first.lon) throw new Error("Não foi possível encontrar coordenadas para este CEP.");
  return { latitude: Number(first.lat), longitude: Number(first.lon) };
}

  function distanceInKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number) {
    const earthRadiusKm = 6371;
    const dLat = (latitude2 - latitude1) * Math.PI / 180;
    const dLon = (longitude2 - longitude1) * Math.PI / 180;
    const lat1 = latitude1 * Math.PI / 180;
    const lat2 = latitude2 * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function lookupLocationCep(value: string) {
    const cep = value.replace(/\D/g, "");
    setLocationCep(value);
    if (cep.length !== 8) {
      setUserLocation(null);
      if (cep.length > 0) setLocationMessage("Informe um CEP válido com 8 números para usar o filtro por distância.");
      return;
    }
    setLocationLoading(true);
    setLocationMessage("");
    try {
      const response = await fetch("https://brasilapi.com.br/api/cep/v2/" + cep);
      if (!response.ok) throw new Error("CEP não encontrado.");
      const data = await response.json();
      const address = [data.street, data.neighborhood, data.city, data.state, "Brasil"].filter(Boolean).join(", ");
      const coordinates =
        typeof data.latitude === "number" && typeof data.longitude === "number"
          ? { latitude: data.latitude, longitude: data.longitude }
          : await geocodeAddress(address);
      setUserLocation(coordinates);
      setCity(data.city ?? data.city_ibge ?? "");
      setLocationMessage("Local de referência definido pelo CEP. A distância será calculada a partir dele.");
    } catch (error) {
      setUserLocation(null);
      setLocationMessage(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    } finally {
      setLocationLoading(false);
    }
  }

  const results = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    const normalizedCity = city.trim().toLocaleLowerCase("pt-BR");
    return businesses.filter((business) => {
      const isOfficial = business.id === OFFICIAL_BUSINESS_ID;
      if (isOfficial) return true;
      const searchable = [
        business.business_name, business.description ?? "", business.city ?? "", business.state ?? "",
        ...business.services.map((service) => service.name),
        ...business.services.map((service) => service.categories?.name ?? ""),
      ].join(" ").toLocaleLowerCase("pt-BR");
      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!normalizedCity || (business.city ?? "").toLocaleLowerCase("pt-BR").includes(normalizedCity)) &&
        (!categoryId || business.services.some((service) => service.category_id === categoryId)) &&
        (radiusKm === null || Boolean(userLocation && business.latitude !== null && business.longitude !== null && distanceInKm(userLocation.latitude, userLocation.longitude, business.latitude, business.longitude) <= radiusKm))
      );
    });
  }, [businesses, search, city, categoryId, radiusKm, userLocation]);

  const scoredResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const tokens = query.split(/\s+/).map((token) => token.trim()).filter((token) => token.length >= 2);

    function normalize(value: string) {
      return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    }

    function score(business: Business) {
      if (!tokens.length) return 0;
      const name = normalize(business.business_name);
      const description = normalize(business.description ?? "");
      const cityName = normalize(business.city ?? "");
      const serviceNames = business.services.map((service) => normalize(service.name));
      const categoryNames = business.services.map((service) => normalize(service.categories?.name ?? ""));
      let total = 0;
      for (const token of tokens) {
        if (name.includes(token)) total += 40;
        if (serviceNames.some((value) => value.includes(token))) total += 30;
        if (categoryNames.some((value) => value.includes(token))) total += 25;
        if (description.includes(token)) total += 10;
        if (cityName.includes(token)) total += 5;
      }
      if (query && name === query) total += 50;
      return total;
    }

    return results.map((business) => ({
      business,
      searchScore: score(business),
      reputation: calculateReputation(business.plan?.plan_slug, business.reviews.map((review) => review.rating)),
    }));
  }, [results, search]);

  const sortedResults = useMemo(() => {
    const copy = [...scoredResults];
    const rating = (business: Business) =>
      business.reviews.length
        ? business.reviews.reduce((sum, review) => sum + review.rating, 0) / business.reviews.length
        : 0;
    if (sortBy === "rating") {
      return copy.sort((a, b) => b.reputation.rankingScore - a.reputation.rankingScore || rating(b.business) - rating(a.business) || a.business.business_name.localeCompare(b.business.business_name, "pt-BR")).map((item) => item.business);
    }
    if (sortBy === "az") {
      return copy.sort((a, b) => a.business.business_name.localeCompare(b.business.business_name, "pt-BR")).map((item) => item.business);
    }
    if (sortBy === "saved") {
      return copy.sort((a, b) => Number(favoriteIds.includes(b.business.id)) - Number(favoriteIds.includes(a.business.id)) || b.reputation.rankingScore - a.reputation.rankingScore).map((item) => item.business);
    }
    return copy.sort((a, b) =>
      Number(b.business.id === OFFICIAL_BUSINESS_ID) - Number(a.business.id === OFFICIAL_BUSINESS_ID) ||
      (b.searchScore * 100 + b.reputation.rankingScore) - (a.searchScore * 100 + a.reputation.rankingScore) ||
      b.reputation.rankingScore - a.reputation.rankingScore ||
      Number(b.business.verified) - Number(a.business.verified) ||
      rating(b.business) - rating(a.business) ||
      a.business.business_name.localeCompare(b.business.business_name, "pt-BR")
    ).map((item) => item.business);
  }, [scoredResults, sortBy, favoriteIds]);

  async function saveFavoriteForUser(businessId: string, currentUserId: string) {
    setFavoriteBusy(businessId);
    const isFavorite = favoriteIds.includes(businessId);
    const result = isFavorite
      ? await supabase.from("favorites").delete().eq("user_id", currentUserId).eq("business_id", businessId)
      : await supabase.from("favorites").insert({ user_id: currentUserId, business_id: businessId });
    if (!result.error) {
      setFavoriteIds((current) => isFavorite ? current.filter((id) => id !== businessId) : [...current, businessId]);
    }
    setFavoriteBusy(null);
  }

  async function toggleFavorite(businessId: string) {
    if (!userId) {
      setPendingAuthAction({ type: "favorite", businessId });
      setAuthModalOpen(true);
      return;
    }
    await saveFavoriteForUser(businessId, userId);
  }

  function handleProtectedMenu(path: string, event: MouseEvent<HTMLAnchorElement>) {
    if (!userId) {
      event.preventDefault();
      setPendingAuthAction({ type: "menu", path });
      setAuthModalOpen(true);
      return;
    }
    setMobileMenuOpen(false);
  }

  function openWhatsApp(url: string, event: MouseEvent<HTMLAnchorElement>) {
    if (!userId) {
      event.preventDefault();
      setPendingAuthAction({ type: "whatsapp", url });
      setAuthModalOpen(true);
    }
  }

  async function handleAuthenticatedFromModal() {
    const { data } = await supabase.auth.getSession();
    const currentUserId = data.session?.user.id ?? null;
    setUserId(currentUserId);
    setAuthModalOpen(false);
    const action = pendingAuthAction;
    setPendingAuthAction(null);
    if (!currentUserId || !action) return;
    if (action.type === "favorite") await saveFavoriteForUser(action.businessId, currentUserId);
    else if (action.type === "menu") window.location.href = action.path;
    else window.location.href = action.url;
  }

  function whatsappUrl(business: Business) {
    const raw = business.whatsapp || business.phone || "";
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    const number = digits.startsWith("55") ? digits : "55" + digits;
    const text = encodeURIComponent("Olá! Encontrei a " + business.business_name + " no LOSI CONECTA e gostaria de saber mais sobre os serviços.");
    return "https://wa.me/" + number + "?text=" + text;
  }

  return (
    <main className="marketplace-page">
      <header className="marketplace-header">
        <div className="marketplace-header-inner">
          <AppLogo className="marketplace-logo" aria-label="LOSI CONECTA">LOSI <span>CONECTA</span></AppLogo>
          <button
            type="button"
            className={"marketplace-mobile-menu-button" + (mobileMenuOpen ? " is-open" : "")}
            onClick={() => setMobileMenuOpen((value) => !value)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            <span></span><span></span><span></span>
          </button>
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
              <button
                type="button"
                className="marketplace-account"
                onClick={() => {
                  setPendingAuthAction(null);
                  setAuthModalOpen(true);
                }}
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className={"marketplace-category-bar" + (mobileMenuOpen ? " mobile-open" : "")} aria-label="Navegação principal">
        <div className="marketplace-category-inner">
          <Link to="/painel" onClick={(event) => handleProtectedMenu("/painel", event)} className="marketplace-menu-link">
            <span className="marketplace-menu-mark">01</span>
            <span><strong>Visão geral</strong><small>Resumo da conta</small></span>
          </Link>
          <Link to="/buscar" onClick={() => setMobileMenuOpen(false)} className="marketplace-menu-link active">
            <span className="marketplace-menu-mark">02</span>
            <span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span>
          </Link>
          <Link to="/meu-perfil" onClick={(event) => handleProtectedMenu("/meu-perfil", event)} className="marketplace-menu-link">
            <span className="marketplace-menu-mark">03</span>
            <span><strong>Meu perfil</strong><small>Dados pessoais</small></span>
          </Link>
          <Link to="/meus-servicos" onClick={(event) => handleProtectedMenu("/meus-servicos", event)} className="marketplace-menu-link">
            <span className="marketplace-menu-mark">04</span>
            <span><strong>Minha empresa</strong><small>Serviços e presença</small></span>
          </Link>
          <Link to="/orcamentos" onClick={(event) => handleProtectedMenu("/orcamentos", event)} className="marketplace-menu-link">
            <span className="marketplace-menu-mark">05</span>
            <span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span>
          </Link>
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
            <label htmlFor="marketplace-location-cep">Local de referência</label>
            <input
              id="marketplace-location-cep"
              value={locationCep}
              onChange={(event) => setLocationCep(event.target.value)}
              onBlur={(event) => lookupLocationCep(event.target.value)}
              inputMode="numeric"
              maxLength={9}
              placeholder="CEP do local do evento"
            />
            <small className="marketplace-location-hint">Sem usar a localização do celular.</small>
          </div>
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
          <div className="marketplace-filter-group marketplace-sidebar-category-filter">
            <div className="marketplace-filter-label">Categorias</div>
            <button type="button" className={!categoryId ? "selected" : ""} onClick={() => setCategoryId("")}>Todas as categorias</button>
            {categories.map((category) => (
              <button type="button" key={category.id} className={categoryId === category.id ? "selected" : ""} onClick={() => setCategoryId(category.id)}>{category.name}</button>
            ))}
          </div>
          {(search || city || categoryId || radiusKm !== null) && (
            <button type="button" className="marketplace-clear-all" onClick={() => { setSearch(""); setCity(""); setCategoryId(""); setRadiusKm(null); setUserLocation(null); setLocationCep(""); setLocationMessage(""); }}>
              Limpar filtros
            </button>
          )}
        </aside>

        <section className="marketplace-results">
          <div className="marketplace-results-top">
            <div>
              <div className="marketplace-results-context">{loading ? "CARREGANDO" : results.length + " RESULTADO" + (results.length === 1 ? "" : "S")}</div>
              <h2>{search ? `Fornecedores para "${search}"` : "Fornecedores em destaque"}</h2>
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

          {locationLoading && <div className="marketplace-message">Consultando o CEP do local de referência...</div>}
          {locationMessage && <div className="marketplace-message marketplace-error">{locationMessage}</div>}
          {error && <div className="marketplace-message marketplace-error">{error}</div>}
          {radiusKm !== null && !locationLoading && !userLocation && (
            <div className="marketplace-message marketplace-error">
              Informe o CEP do local de referência para calcular a distância dos fornecedores.
            </div>
          )}
          {radiusKm !== null && !locationLoading && userLocation && businesses.length > 0 &&
            businesses.every((business) => business.latitude === null || business.longitude === null) && (
              <div className="marketplace-message">
                Ainda não há fornecedores aprovados com localização cadastrada para o filtro por raio.
              </div>
            )}

          {(search || city || categoryId || radiusKm !== null) && (
            <div className="marketplace-active-filters" aria-label="Filtros ativos">
              {search && <span>Busca: {search}</span>}
              {city && <span>Localização: {city}</span>}
              {categoryId && <span>Categoria: {categories.find((category) => category.id === categoryId)?.name}</span>}
              {locationCep && <span>CEP: {locationCep}</span>}
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
              const isOfficial = business.id === OFFICIAL_BUSINESS_ID;
              const avg = isOfficial ? 5 : business.reviews.length ? business.reviews.reduce((sum, review) => sum + review.rating, 0) / business.reviews.length : 0;
              const reputation = isOfficial
                ? { planSlug: "destaque", planName: "Destaque", planPriority: 45, baseStars: 4, stars: 6, positiveReviews: business.reviews.length, totalReviews: business.reviews.length, satisfaction: 100, level: 3, label: "Boa satisfação", rankingScore: 100 }
                : calculateReputation(business.plan?.plan_slug, business.reviews.map((review) => review.rating));
              const reputationClass = reputation.level === 3 ? "green" : reputation.level === 2 ? "yellow" : reputation.level === 1 ? "red" : "none";
              return (
                <article className="marketplace-card" key={business.id}>
                  <div className="marketplace-card-media">
                    {business.cover_url ? <img src={business.cover_url} alt="" /> : <div className="marketplace-card-media-fallback" />}
                    {business.logo_url && <div className="marketplace-card-profile-photo"><img src={business.logo_url} alt={business.business_name} /></div>}
                    <button type="button" className={"marketplace-favorite " + (favoriteIds.includes(business.id) ? "saved" : "")} onClick={() => toggleFavorite(business.id)} disabled={favoriteBusy === business.id} aria-label={favoriteIds.includes(business.id) ? "Remover dos salvos" : "Salvar fornecedor"}>
                      {favoriteIds.includes(business.id) ? "♥" : "♡"}
                    </button>
                  </div>
                  <div className="marketplace-card-body">
                    <div className="marketplace-card-heading">
                      <h3>{business.business_name}</h3>
                      {isOfficial ? <span className="marketplace-official">✓ OFICIAL LOSI</span> : business.verified && <span className="marketplace-verified">Verificado</span>}
                      {!isOfficial && reputation.planSlug !== "gratis" && <span className={"marketplace-plan-badge " + reputation.planSlug}>{reputation.planName}</span>}
                    </div>
                    {(business.city || business.state) && <div className="marketplace-location">{business.city}{business.city && business.state ? " — " : ""}{business.state}</div>}
                    {isOfficial ? <div className="marketplace-rating marketplace-rating-official"><strong>★ 5.0</strong><span>Avaliação máxima · Satisfação máxima</span></div> : business.reviews.length > 0 && <div className="marketplace-rating"><strong>★ {avg.toFixed(1)}</strong><span>{business.reviews.length} {business.reviews.length === 1 ? "avaliação" : "avaliações"}</span></div>}
                    <div className="marketplace-reputation-summary" aria-label={reputation.label}>
                      <span className={"marketplace-reputation-dot " + reputationClass}></span>
                      <span>{reputation.satisfaction === null ? "Sem reputação" : reputation.satisfaction + "% de satisfação"}</span>
                      <span>{"★".repeat(reputation.stars)}{reputation.stars < 6 ? "☆".repeat(6 - reputation.stars) : ""}</span>
                    </div>
                    <p>{business.description || "Profissional ou empresa para eventos cadastrada no LOSI CONECTA."}</p>
                    {serviceNames.length > 0 && <div className="marketplace-services">{serviceNames.map((service) => <span key={service}>{service}</span>)}</div>}
                    <div className="marketplace-card-footer">
                      <Link to={"/fornecedor/" + business.slug} className="marketplace-profile-link">Ver fornecedor</Link>
                      {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="marketplace-contact" onClick={(event) => openWhatsApp(whatsapp, event)}>WhatsApp</a> : <span className="marketplace-no-contact">Contato não informado</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      {authModalOpen && (
        <AuthModal
          onClose={() => {
            setAuthModalOpen(false);
            setPendingAuthAction(null);
          }}
          onAuthenticated={handleAuthenticatedFromModal}
        />
      )}
    </main>
  );

}
