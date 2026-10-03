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
type LosiAd = {
  id: string;
  ad_type: "event" | "opportunity";
  title: string;
  category: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  description: string;
  contact: string | null;
  role: string | null;
  quantity: number | null;
  value_cents: number | null;
  requirements: string | null;
  published_at: string | null;
  expires_at: string | null;
};

type Business = {
  id: string; business_name: string; slug: string; description: string | null;
  whatsapp: string | null; phone: string | null; instagram: string | null; website: string | null;
  city: string | null; state: string | null; address: string | null; cep: string | null; bairro: string | null; logo_url: string | null; cover_url: string | null;
  verified: boolean; latitude: number | null; longitude: number | null; reputation_service_count: number; services: Service[]; reviews: ReviewSummary[]; plan?: { plan_slug: string; plan_name: string; plan_priority: number; ends_at: string | null } | null;
};

function SearchPageError() {
  return (
    <main className="marketplace-page">
      <section className="marketplace-search-panel" style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <AppLogo aria-label="LOSI CONECTA">LOSI <span>CONECTA</span></AppLogo>
          <h1>Não foi possível carregar a busca.</h1>
          <p>O catálogo encontrou um erro temporário. Tente novamente.</p>
          <button type="button" className="marketplace-search-button" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/buscar")({
  component: SearchPage,
  errorComponent: SearchPageError,
});

const OFFICIAL_BUSINESS_ID = "333ccf56-324f-4e4f-99e3-1ebc9ade0140";

function SearchPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [ads, setAds] = useState<LosiAd[]>([]);
  const [resultType, setResultType] = useState<"all" | "providers" | "opportunities" | "events">("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
const [resolvedBusinessLocations, setResolvedBusinessLocations] = useState<Record<string, { latitude: number; longitude: number }>>({});
const [locationResolving, setLocationResolving] = useState(false);
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
  const [selectedAd, setSelectedAd] = useState<LosiAd | null>(null);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [applicationSending, setApplicationSending] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<
    { type: "favorite"; businessId: string } | { type: "whatsapp"; url: string } | { type: "menu"; path: string } | null
  >(null);
  const [adCarouselIndex, setAdCarouselIndex] = useState(0);
  const [adCarouselPaused, setAdCarouselPaused] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      if (currentUserId) {
        setUserId(currentUserId);
        const [{ data: favoriteData }, { data: ownBusiness }] = await Promise.all([
          supabase.from("favorites").select("business_id").eq("user_id", currentUserId),
          supabase.from("my_business_slug").select("slug").eq("owner_id", currentUserId).maybeSingle(),
        ]);
        if (mounted) {
          setFavoriteIds((favoriteData ?? []).map((item) => item.business_id));
          setUserBusinessSlug(ownBusiness?.slug ?? null);
          // A busca deve iniciar sem filtros de localização. O usuário escolhe a cidade manualmente.
        }
      }
      if (mounted) setAuthLoading(false);
      // Carregamos cada fonte de dados de forma independente. Um problema
      // pontual no ranking/planos não pode impedir a exibição dos fornecedores.
      const [businessResult, categoryResult, planResult, adsResult] = await Promise.all([
        supabase
          .from("business_profiles_public")
          .select("id,business_name,slug,description,whatsapp,phone,instagram,website,city,state,address,cep,bairro,logo_url,cover_url,verified,latitude,longitude,reputation_service_count,active,approval_status")
          .eq("active", true)
          .eq("approval_status", "approved")
          .order("business_name"),
        supabase.from("categories").select("id,name,slug").eq("active", true).order("name"),
        supabase.from("supplier_plan_visibility").select("business_id,plan_slug,plan_name,plan_priority,ends_at"),
        supabase
          .from("losi_ads")
          .select("id,ad_type,title,category,event_date,start_time,end_time,city,state,cep,description,contact,role,quantity,value_cents,requirements,published_at,expires_at")
          .eq("status", "published")
          .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
          .order("published_at", { ascending: false }),
      ]);
      if (!mounted) return;

      if (businessResult.error) {
        console.error("Erro ao carregar fornecedores:", businessResult.error);
        if (mounted) {
          setBusinesses([]);
          setCategories((categoryResult.data ?? []) as Category[]);
          setError("Não foi possível carregar os fornecedores neste momento.");
        }
        return;
      }

      if (categoryResult.error) {
        console.warn("Não foi possível carregar categorias:", categoryResult.error);
      }

      const baseBusinesses = (businessResult.data ?? []).map((business) => ({
        ...business,
        services: [] as Service[],
        reviews: [] as ReviewSummary[],
        plan: null,
      })) as Business[];
      const businessIds = baseBusinesses.map((business) => business.id);

      const [serviceResult, reviewResult] = await Promise.all([
        businessIds.length
          ? supabase.from("services").select("id,name,category_id,business_id,categories(name)").in("business_id", businessIds).eq("active", true)
          : Promise.resolve({ data: [], error: null }),
        businessIds.length
          ? supabase.from("reviews").select("business_id,rating").in("business_id", businessIds).eq("active", true)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!mounted) return;

      if (serviceResult.error) console.warn("Não foi possível carregar serviços dos fornecedores:", serviceResult.error);
      if (reviewResult.error) console.warn("Não foi possível carregar avaliações dos fornecedores:", reviewResult.error);
      if (planResult.error) console.warn("Não foi possível carregar planos dos fornecedores:", planResult.error);
      if (adsResult.error) console.warn("Não foi possível carregar anúncios LOSI ADS:", adsResult.error);
      setAds((adsResult.data ?? []) as LosiAd[]);

      const servicesByBusiness = new Map<string, Service[]>();
      for (const service of (serviceResult.data ?? []) as Array<Service & { business_id: string }>) {
        const list = servicesByBusiness.get(service.business_id) ?? [];
        list.push(service);
        servicesByBusiness.set(service.business_id, list);
      }

      const reviewsByBusiness = new Map<string, ReviewSummary[]>();
      for (const review of (reviewResult.data ?? []) as Array<ReviewSummary & { business_id: string }>) {
        const list = reviewsByBusiness.get(review.business_id) ?? [];
        list.push({ rating: Number(review.rating) });
        reviewsByBusiness.set(review.business_id, list);
      }

      const planRows = (planResult.data ?? []) as Array<{ business_id: string; plan_slug: string; plan_name: string; plan_priority: number; ends_at: string | null }>;
      const planByBusiness = new Map(planRows.map((row) => [row.business_id, row]));

      const loadedBusinesses = baseBusinesses.map((business) => ({
        ...business,
        services: servicesByBusiness.get(business.id) ?? [],
        reviews: reviewsByBusiness.get(business.id) ?? [],
        reputation_service_count: Number.isFinite(Number(business.reputation_service_count))
          ? Number(business.reputation_service_count)
          : 0,
        plan: planByBusiness.get(business.id) ?? {
          plan_slug: "gratis",
          plan_name: "Grátis",
          plan_priority: 0,
          ends_at: null,
        },
      }));

      setBusinesses(loadedBusinesses);
      setCategories(categoryResult.data ?? []);
    }
    loadCatalog().catch((loadError) => {
      console.error("Erro inesperado ao carregar catálogo:", loadError);
      if (mounted) setError("Não foi possível carregar os fornecedores.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

async function geocodeAddress(address: string, cep: string, city?: string, state?: string) {
  const queries = [
    "CEP " + cep + ", Brasil",
    address,
    [city, state, "Brasil"].filter(Boolean).join(", "),
  ].filter(Boolean);

  for (const queryText of queries) {
    const query = encodeURIComponent(queryText);
    const response = await fetch(
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=" + query,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) continue;
    const results = await response.json();
    const first = results?.[0];
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  throw new Error("Não foi possível encontrar coordenadas para este CEP. Tente novamente em alguns instantes.");
}

  async function resolveBusinessLocation(business: Business) {
    if (business.latitude !== null && business.longitude !== null) {
      return { latitude: Number(business.latitude), longitude: Number(business.longitude) };
    }

    const businessCep = (business.cep ?? "").replace(/\D/g, "");
    if (businessCep && businessCep === locationCep.replace(/\D/g, "") && userLocation) {
      return userLocation;
    }

    if (!businessCep) {
      if (!business.address && !business.city) return null;
    }

    try {
      if (businessCep) {
        const response = await fetch("https://brasilapi.com.br/api/cep/v2/" + businessCep);
        if (response.ok) {
          const data = await response.json();
          const latitude = Number(data.latitude ?? data.location?.coordinates?.latitude);
          const longitude = Number(data.longitude ?? data.location?.coordinates?.longitude);
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            return { latitude, longitude };
          }
          const address = [data.street, data.neighborhood, data.city, data.state, "Brasil"].filter(Boolean).join(", ");
          return await geocodeAddress(address, businessCep, data.city, data.state);
        }
      }

      const address = [business.address, business.bairro, business.city, business.state, "Brasil"].filter(Boolean).join(", ");
      return await geocodeAddress(address, businessCep, business.city ?? undefined, business.state ?? undefined);
    } catch (error) {
      console.warn("Não foi possível localizar o fornecedor para o filtro por distância:", business.business_name, error);
      return null;
    }
  }

  useEffect(() => {
    if (radiusKm === null || !userLocation || !businesses.length) return;

    let cancelled = false;
    async function resolveMissingLocations() {
      const missing = businesses.filter(
        (business) =>
          business.latitude === null ||
          business.longitude === null ||
          !Number.isFinite(Number(business.latitude)) ||
          !Number.isFinite(Number(business.longitude)),
      );

      if (!missing.length) return;

      setLocationResolving(true);
      const resolvedEntries = await Promise.all(
        missing.map(async (business) => [business.id, await resolveBusinessLocation(business)] as const),
      );

      if (!cancelled) {
        setResolvedBusinessLocations((current) => {
          const next = { ...current };
          for (const [businessId, coordinates] of resolvedEntries) {
            if (coordinates) next[businessId] = coordinates;
          }
          return next;
        });
        setLocationResolving(false);
      }
    }

    resolveMissingLocations().catch((error) => {
      console.warn("Falha ao resolver localizações dos fornecedores:", error);
      if (!cancelled) setLocationResolving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [businesses, radiusKm, userLocation, locationCep]);

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
      const directLatitude = Number(data.latitude ?? data.location?.coordinates?.latitude);
      const directLongitude = Number(data.longitude ?? data.location?.coordinates?.longitude);
      const coordinates =
        Number.isFinite(directLatitude) && Number.isFinite(directLongitude)
          ? { latitude: directLatitude, longitude: directLongitude }
          : await geocodeAddress(address, cep, data.city, data.state);
      setUserLocation(coordinates);
      // O CEP serve apenas como ponto de referência para o raio.
      // A cidade é um filtro independente e só deve ser preenchida pelo usuário.
      setLocationMessage("Local de referência definido pelo CEP. A distância será calculada a partir dele.");
    } catch (error) {
      setUserLocation(null);
      setLocationMessage(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    } finally {
      setLocationLoading(false);
    }
  }

  function handleSearch() {
    setSubmittedSearch(search.trim());

    // No mobile, após buscar, leva o usuário diretamente para os resultados.
    // No desktop, a posição da página permanece como está.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      window.requestAnimationFrame(() => {
        document.querySelector(".marketplace-results")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  const results = useMemo(() => {
    const normalizedSearch = submittedSearch.trim().toLocaleLowerCase("pt-BR");
    const normalizedCity = city.trim().toLocaleLowerCase("pt-BR");
    return businesses.filter((business) => {
      const searchable = [
        business.business_name, business.description ?? "", business.city ?? "", business.state ?? "",
        ...business.services.map((service) => service.name),
        ...business.services.map((service) => service.categories?.name ?? ""),
      ].join(" ").toLocaleLowerCase("pt-BR");

      const latitude = business.latitude !== null ? Number(business.latitude) : resolvedBusinessLocations[business.id]?.latitude;
      const longitude = business.longitude !== null ? Number(business.longitude) : resolvedBusinessLocations[business.id]?.longitude;
      const withinRadius =
        radiusKm === null
          ? true
          : Boolean(
              userLocation &&
              Number.isFinite(latitude) &&
              Number.isFinite(longitude) &&
              distanceInKm(userLocation.latitude, userLocation.longitude, latitude, longitude) <= radiusKm,
            );

      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!normalizedCity || (business.city ?? "").toLocaleLowerCase("pt-BR").includes(normalizedCity)) &&
        (!categoryId || business.services.some((service) => service.category_id === categoryId)) &&
        withinRadius
      );
    });
  }, [businesses, submittedSearch, city, categoryId, radiusKm, userLocation, resolvedBusinessLocations]);

  const scoredResults = useMemo(() => {
    const query = submittedSearch.trim().toLocaleLowerCase("pt-BR");
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
      reputation: calculateReputation(business.plan?.plan_slug, business.reviews.map((review) => review.rating), business.reputation_service_count),
    }));
  }, [results, submittedSearch]);

  const filteredAds = useMemo(() => {
    const normalizedCity = city.trim().toLocaleLowerCase("pt-BR");
    const normalizedSearch = submittedSearch.trim().toLocaleLowerCase("pt-BR");

    return ads.filter((ad) => {
      if (resultType === "providers") return false;
      if (resultType === "opportunities" && ad.ad_type !== "opportunity") return false;
      if (resultType === "events" && ad.ad_type !== "event") return false;

      const searchable = [
        ad.title,
        ad.category ?? "",
        ad.description,
        ad.role ?? "",
        ad.city ?? "",
        ad.state ?? "",
        ad.requirements ?? "",
      ].join(" ").toLocaleLowerCase("pt-BR");

      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!normalizedCity || (ad.city ?? "").toLocaleLowerCase("pt-BR").includes(normalizedCity))
      );
    });
  }, [ads, city, submittedSearch, resultType]);

  useEffect(() => {
    if (filteredAds.length <= 1 || adCarouselPaused) return;
    const timer = window.setInterval(() => {
      setAdCarouselIndex((current) => (current + 1) % filteredAds.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [filteredAds.length, adCarouselPaused]);

  useEffect(() => {
    setAdCarouselIndex(0);
  }, [submittedSearch, city, resultType]);

  const sortedProviderResults = useMemo(() => {
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

  async function applyToAd() {
    if (!selectedAd || selectedAd.ad_type !== "opportunity") return;
    if (!userId) {
      setPendingAuthAction({ type: "menu", path: "/buscar" });
      setAuthModalOpen(true);
      return;
    }
    setApplicationSending(true);
    setApplicationStatus("");
    const { error } = await supabase.from("losi_ads_applications").insert({
      ad_id: selectedAd.id,
      user_id: userId,
      message: applicationMessage.trim() || null,
    });
    if (error) {
      setApplicationStatus(
        error.code === "23505"
          ? "Você já demonstrou interesse nesta oportunidade."
          : "Não foi possível enviar seu interesse agora. Tente novamente."
      );
    } else {
      setApplicationStatus("Interesse enviado. O fornecedor poderá entrar em contato com você.");
      setApplicationMessage("");
    }
    setApplicationSending(false);
  }

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
            <button type="button" onClick={handleSearch} aria-label="Buscar">⌕</button>
          </div>
          <div className="marketplace-header-actions">
            <Link to="/feed" className="marketplace-feed-icon" aria-label="Abrir Feed" title="Feed">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 5h14M5 12h10M5 19h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M17 12.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 0V15l2 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
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
          <Link to="/feed" onClick={() => setMobileMenuOpen(false)} className="marketplace-menu-link">
            <span className="marketplace-menu-mark">06</span>
            <span><strong>Feed</strong><small>Conteúdo profissional</small></span>
          </Link>
          <Link to="/apresentacao" onClick={() => setMobileMenuOpen(false)} className="marketplace-menu-link">
            <span className="marketplace-menu-mark">07</span>
            <span><strong>Apresentação</strong><small>Conheça o LOSI CONECTA</small></span>
          </Link>
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

      {selectedAd && (
        <div className="marketplace-ad-modal-backdrop" role="presentation" onClick={() => { setSelectedAd(null); setApplicationStatus(""); }}>
          <section className="marketplace-ad-modal" role="dialog" aria-modal="true" aria-labelledby="marketplace-ad-modal-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="marketplace-ad-modal-close" aria-label="Fechar anúncio" onClick={() => { setSelectedAd(null); setApplicationStatus(""); }}>×</button>
            <div className="marketplace-ad-topline">
              <span className="marketplace-ad-badge">{selectedAd.ad_type === "event" ? "EVENTO" : "OPORTUNIDADE"}</span>
              {selectedAd.category && <span className="marketplace-ad-category">{selectedAd.category}</span>}
            </div>
            <h2 id="marketplace-ad-modal-title">{selectedAd.title}</h2>
            {(selectedAd.city || selectedAd.state) && <div className="marketplace-ad-location">{selectedAd.city}{selectedAd.city && selectedAd.state ? " — " : ""}{selectedAd.state}</div>}
            <div className="marketplace-ad-modal-meta">
              {selectedAd.event_date && <span><strong>Data</strong>{new Date(selectedAd.event_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
              {(selectedAd.start_time || selectedAd.end_time) && <span><strong>Horário</strong>{selectedAd.start_time?.slice(0,5) ?? ""}{selectedAd.end_time ? " às " + selectedAd.end_time.slice(0,5) : ""}</span>}
              {selectedAd.ad_type === "opportunity" && selectedAd.role && <span><strong>Função</strong>{selectedAd.role}</span>}
              {selectedAd.ad_type === "opportunity" && selectedAd.quantity && <span><strong>Vagas</strong>{selectedAd.quantity}</span>}
              {selectedAd.ad_type === "opportunity" && selectedAd.value_cents !== null && <span><strong>Valor</strong>R$ {(selectedAd.value_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
            </div>
            <div className="marketplace-ad-modal-description">
              <span>DESCRIÇÃO</span>
              <p>{selectedAd.description}</p>
            </div>
            {selectedAd.ad_type === "opportunity" && selectedAd.requirements && (
              <div className="marketplace-ad-modal-description">
                <span>REQUISITOS</span>
                <p>{selectedAd.requirements}</p>
              </div>
            )}
            {selectedAd.ad_type === "opportunity" ? (
              <div className="marketplace-ad-modal-application">
                <label htmlFor="marketplace-ad-application-message">Mensagem para o fornecedor <small>(opcional)</small></label>
                <textarea id="marketplace-ad-application-message" value={applicationMessage} onChange={(event) => setApplicationMessage(event.target.value)} placeholder="Conte brevemente por que você tem interesse nesta oportunidade." rows={4} />
                <button type="button" className="marketplace-ad-apply-button" onClick={applyToAd} disabled={applicationSending}>
                  {applicationSending ? "ENVIANDO..." : userId ? "TENHO INTERESSE" : "ENTRAR E DEMONSTRAR INTERESSE"}
                </button>
                {applicationStatus && <div className="marketplace-ad-application-status">{applicationStatus}</div>}
              </div>
            ) : selectedAd.contact ? (
              <div className="marketplace-ad-modal-contact">
                <span>CONTATO DO EVENTO</span>
                <strong>{selectedAd.contact}</strong>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {authModalOpen && (
        <AuthModal
          onClose={() => {
            setAuthModalOpen(false);
            setPendingAuthAction(null);
          }}
          onAuthenticated={handleAuthenticatedFromModal}
        />
      )}

      <section className="marketplace-search-panel" autoComplete="off">
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
            <input id="marketplace-city" name="search-location-city" autoComplete="new-password" autoCorrect="off" spellCheck={false} value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade ou região" />
          </div>
          <div className="marketplace-filter-field">
            <label htmlFor="marketplace-category">Categoria</label>
            <select id="marketplace-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <button type="button" className="marketplace-search-button" onClick={handleSearch}>Buscar</button>
        </div>
      </section>

      <main className="marketplace-content">
        <aside className="marketplace-sidebar">
          <div className="marketplace-sidebar-title">Filtrar resultados</div>
          <div className="marketplace-filter-group">
            <label htmlFor="marketplace-location-cep">Local de referência</label>
            <input
              id="marketplace-location-cep"
              name="search-location-cep"
              autoComplete="new-password"
              autoCorrect="off"
              spellCheck={false}
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
          {(submittedSearch || city || categoryId || radiusKm !== null) && (
            <button type="button" className="marketplace-clear-all" onClick={() => { setSearch(""); setSubmittedSearch(""); setCity(""); setCategoryId(""); setRadiusKm(null); setUserLocation(null); setLocationCep(""); setLocationMessage(""); }}>
              Limpar filtros
            </button>
          )}
        </aside>

        <section className="marketplace-results">
          <div className="marketplace-result-type-tabs" role="tablist" aria-label="Tipo de resultado">
            <button type="button" className={resultType === "all" ? "active" : ""} onClick={() => setResultType("all")}>Todos <span>{results.length + filteredAds.length}</span></button>
            <button type="button" className={resultType === "providers" ? "active" : ""} onClick={() => setResultType("providers")}>Fornecedores <span>{results.length}</span></button>
            <button type="button" className={resultType === "opportunities" ? "active" : ""} onClick={() => setResultType("opportunities")}>Oportunidades <span>{filteredAds.filter((ad) => ad.ad_type === "opportunity").length}</span></button>
            <button type="button" className={resultType === "events" ? "active" : ""} onClick={() => setResultType("events")}>Eventos <span>{filteredAds.filter((ad) => ad.ad_type === "event").length}</span></button>
          </div>

          <div className="marketplace-results-top">
            <div>
              <div className="marketplace-results-context">{loading ? "CARREGANDO" : (resultType === "providers" ? results.length : resultType === "opportunities" || resultType === "events" ? filteredAds.length : results.length + filteredAds.length) + " RESULTADO" + ((resultType === "providers" ? results.length : resultType === "opportunities" || resultType === "events" ? filteredAds.length : results.length + filteredAds.length) === 1 ? "" : "S")}</div>
              <h2>{
                resultType === "opportunities"
                  ? "Oportunidades para profissionais"
                  : resultType === "events"
                    ? "Eventos publicados"
                    : submittedSearch
                      ? `Resultados para "${submittedSearch}"`
                      : resultType === "providers"
                        ? "Fornecedores em destaque"
                        : "Fornecedores, eventos e oportunidades"
              }</h2>
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
          {radiusKm !== null && !locationLoading && userLocation && locationResolving && (
            <div className="marketplace-message">Calculando a distância dos fornecedores a partir do CEP informado...</div>
          )}

          {(search || city || categoryId || radiusKm !== null) && (
            <div className="marketplace-active-filters" aria-label="Filtros ativos">
              {submittedSearch && <span>Busca: {submittedSearch}</span>}
              {city && <span>Localização: {city}</span>}
              {categoryId && <span>Categoria: {categories.find((category) => category.id === categoryId)?.name}</span>}
              {locationCep && <span>CEP: {locationCep}</span>}
              {radiusKm !== null && <span>Até {radiusKm} km</span>}
            </div>
          )}

          {!loading && !error && (
            (resultType === "providers" ? results.length === 0 : resultType === "opportunities" || resultType === "events" ? filteredAds.length === 0 : results.length + filteredAds.length === 0) && (
            <div className="marketplace-empty">
              <strong>{sortBy === "saved" ? "Você ainda não tem fornecedores salvos." : "Nenhum fornecedor encontrado."}</strong>
              <p>{sortBy === "saved" && resultType === "providers" ? "Salve fornecedores durante sua pesquisa para encontrá-los novamente." : resultType === "opportunities" ? "No momento não há oportunidades que correspondam aos filtros informados." : resultType === "events" ? "No momento não há eventos que correspondam aos filtros informados." : "Tente remover um filtro ou pesquisar por outro serviço, cidade ou tipo de resultado."}</p>
            </div>
            )
          )}

          {filteredAds.length > 0 && resultType !== "providers" && (() => {
            const activeAd = filteredAds[adCarouselIndex] ?? filteredAds[0];
            if (!activeAd) return null;
            const previousAd = () => setAdCarouselIndex((current) => (current - 1 + filteredAds.length) % filteredAds.length);
            const nextAd = () => setAdCarouselIndex((current) => (current + 1) % filteredAds.length);
            return (
              <div
                className="marketplace-ads-section"
                onMouseEnter={() => setAdCarouselPaused(true)}
                onMouseLeave={() => setAdCarouselPaused(false)}
                onFocus={() => setAdCarouselPaused(true)}
                onBlur={() => setAdCarouselPaused(false)}
              >
                <div className="marketplace-ads-heading">
                  <div>
                    <span>LOSI ADS</span>
                    <h3>{resultType === "events" ? "Eventos publicados" : resultType === "opportunities" ? "Oportunidades abertas" : "Eventos e oportunidades"}</h3>
                  </div>
                  <p>{filteredAds.length === 1 ? "1 anúncio publicado." : filteredAds.length + " anúncios em rotação automática."}</p>
                </div>
                <div className="marketplace-ads-carousel" aria-roledescription="carrossel" aria-label="Anúncios LOSI ADS">
                  <button type="button" className="marketplace-ads-carousel-arrow prev" onClick={previousAd} aria-label="Anúncio anterior">‹</button>
                  <article
                    className={"marketplace-ad-card marketplace-ad-carousel-card " + activeAd.ad_type}
                    key={activeAd.id}
                    role="button"
                    tabIndex={0}
                    aria-roledescription="slide"
                    aria-label={(adCarouselIndex + 1) + " de " + filteredAds.length + ": " + activeAd.title}
                    onClick={() => { setSelectedAd(activeAd); setApplicationStatus(""); }}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedAd(activeAd); setApplicationStatus(""); } }}
                  >
                    <div className="marketplace-ad-topline">
                      <span className="marketplace-ad-badge">{activeAd.ad_type === "event" ? "EVENTO" : "OPORTUNIDADE"}</span>
                      {activeAd.category && <span className="marketplace-ad-category">{activeAd.category}</span>}
                    </div>
                    <h3>{activeAd.title}</h3>
                    {(activeAd.city || activeAd.state) && <div className="marketplace-ad-location">{activeAd.city}{activeAd.city && activeAd.state ? " — " : ""}{activeAd.state}</div>}
                    <div className="marketplace-ad-meta">
                      {activeAd.event_date && <span>Data: {new Date(activeAd.event_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                      {(activeAd.start_time || activeAd.end_time) && <span>Horário: {activeAd.start_time?.slice(0,5) ?? ""}{activeAd.end_time ? " às " + activeAd.end_time.slice(0,5) : ""}</span>}
                      {activeAd.ad_type === "opportunity" && activeAd.role && <span>Função: {activeAd.role}</span>}
                      {activeAd.ad_type === "opportunity" && activeAd.quantity && <span>Vagas: {activeAd.quantity}</span>}
                      {activeAd.ad_type === "opportunity" && activeAd.value_cents !== null && <span>Valor: R$ {(activeAd.value_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                    </div>
                    <p>{activeAd.description}</p>
                    {activeAd.ad_type === "opportunity" && activeAd.requirements && (
                      <div className="marketplace-ad-requirements"><strong>Requisitos</strong><span>{activeAd.requirements}</span></div>
                    )}
                    {activeAd.contact && (
                      <div className="marketplace-ad-contact"><span>Contato</span><strong>{activeAd.contact}</strong></div>
                    )}
                  </article>
                  <button type="button" className="marketplace-ads-carousel-arrow next" onClick={nextAd} aria-label="Próximo anúncio">›</button>
                </div>
                {filteredAds.length > 1 && (
                  <div className="marketplace-ads-carousel-footer">
                    <div className="marketplace-ads-carousel-dots" aria-label="Selecionar anúncio">
                      {filteredAds.map((ad, index) => (
                        <button key={ad.id} type="button" className={index === adCarouselIndex ? "active" : ""} onClick={() => setAdCarouselIndex(index)} aria-label={"Ver anúncio " + (index + 1)} />
                      ))}
                    </div>
                    <span>{adCarouselPaused ? "Pausado" : "Avanço automático"}</span>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="marketplace-grid">
            {resultType !== "opportunities" && resultType !== "events" && sortedProviderResults.map((business) => {
              const whatsapp = whatsappUrl(business);
              const serviceNames = business.services.map((service) => service.name).filter(Boolean).slice(0, 3);
              const isOfficial = business.id === OFFICIAL_BUSINESS_ID;
              const avg = isOfficial ? 5 : business.reviews.length ? business.reviews.reduce((sum, review) => sum + review.rating, 0) / business.reviews.length : 0;
              const reputation = isOfficial
                ? { planSlug: "destaque", planName: "Destaque", planPriority: 45, baseStars: 4, stars: 6, positiveReviews: business.reviews.length, totalReviews: business.reviews.length, satisfaction: 100, level: 3, label: "Boa satisfação", rankingScore: 100 }
                : calculateReputation(business.plan?.plan_slug, business.reviews.map((review) => review.rating), business.reputation_service_count);
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
    </main>
  );

}
