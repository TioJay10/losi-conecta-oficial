import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import type { CSSProperties } from "react";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, businesses: 0, categories: 0, services: 0, reviews: 0 });
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; user_type: string; city: string | null; state: string | null }>>([]);
  const [businesses, setBusinesses] = useState<Array<{ id: string; business_name: string; description: string | null; phone: string | null; whatsapp: string | null; website: string | null; instagram: string | null; address: string | null; logo_url: string | null; cover_url: string | null; portfolio_urls: string[]; city: string | null; state: string | null; verified: boolean; active: boolean; approval_status: "pending" | "approved" | "rejected" }>>([]);
  const [section, setSection] = useState<"overview" | "users" | "businesses" | "categories" | "services" | "reviews" | "commercial">("overview");
  const [plans, setPlans] = useState<Array<{id:string;name:string;slug:string;description:string|null;price_cents:number;billing_period:string;highlighted:boolean;active:boolean}>>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planSavingId, setPlanSavingId] = useState<string | null>(null);
  const [activatingBusinessId, setActivatingBusinessId] = useState<string | null>(null);
  const [activationPlanByBusiness, setActivationPlanByBusiness] = useState<Record<string, string>>({});
  const [subscriptions, setSubscriptions] = useState<Array<{id:string;business_id:string;plan_id:string;status:string;ends_at:string|null;business:{business_name:string}|null;plan:{name:string}|null}>>([]);
  const [dataError, setDataError] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");
  const [businessStatusFilter, setBusinessStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState("");
  const [createUserSuccess, setCreateUserSuccess] = useState("");
  const [categories, setCategories] = useState<Array<{ id:string; name:string; slug:string; active:boolean }>>([]);
  const [services, setServices] = useState<Array<{ id:string; name:string; description:string|null; active:boolean; business:{business_name:string}|null; category:{name:string}|null }>>([]);
  const [reviews, setReviews] = useState<Array<{ id:string; rating:number; comment:string|null; active:boolean; created_at:string; business:{business_name:string}|null; reviewer:{full_name:string|null}|null }>>([]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { navigate({ to: "/entrar" }); return; }
      const currentUser = sessionData.session.user;
      const { data, error } = await supabase.from("profiles").select("full_name,user_type").eq("id", currentUser.id).maybeSingle();
      if (!mounted) return;
      if (error || !data) { await supabase.auth.signOut(); navigate({ to: "/entrar" }); return; }
      if (data.user_type !== "admin") { navigate({ to: "/painel" }); return; }
      setUser(currentUser);
      setName(data.full_name || currentUser.email?.split("@")[0] || "administrador");
      const [usersResult,businessesResult,categoriesResult,servicesResult,reviewsResult,plansResult,subscriptionsResult] = await Promise.all([
        supabase.from("profiles").select("id,full_name,user_type,city,state").order("created_at",{ascending:false}),
        supabase.from("business_profiles").select("id,business_name,description,phone,whatsapp,website,instagram,address,logo_url,cover_url,portfolio_urls,city,state,verified,active,approval_status").order("created_at",{ascending:false}),
        supabase.from("categories").select("id,name,slug,active").order("name"),
        supabase.from("services").select("id,name,description,active,business:business_profiles(business_name),category:categories(name)").order("created_at",{ascending:false}),
        supabase.from("reviews").select("id,rating,comment,active,created_at,business:business_profiles(business_name),reviewer:profiles(full_name)").order("created_at",{ascending:false}),
        supabase.from("plans").select("id,name,slug,description,price_cents,billing_period,highlighted,active").order("price_cents"),
        supabase.from("business_subscriptions").select("id,business_id,plan_id,status,ends_at,business:business_profiles(business_name),plan:plans(name)").order("created_at",{ascending:false}),
      ]);
      if (!mounted) return;
      const firstError = [usersResult, businessesResult, categoriesResult, servicesResult, reviewsResult, plansResult, subscriptionsResult].find((result) => result.error)?.error;
      if (firstError) setDataError(firstError.message);
      setUsers((usersResult.data ?? []) as typeof users);
      setBusinesses((businessesResult.data ?? []) as typeof businesses);
      setCategories((categoriesResult.data ?? []) as typeof categories);
      setServices((servicesResult.data ?? []) as unknown as typeof services);
      setReviews((reviewsResult.data ?? []) as unknown as typeof reviews);
      setPlans((plansResult.data ?? []) as typeof plans);
      setSubscriptions((subscriptionsResult.data ?? []) as unknown as typeof subscriptions);
      setStats({users:usersResult.data?.length??0,businesses:businessesResult.data?.length??0,categories:categoriesResult.data?.length??0,services:servicesResult.data?.length??0,reviews:reviewsResult.data?.length??0});
      setLoading(false);
    }
    load();
    const requestedSection = new URLSearchParams(window.location.search).get("section");
    if (requestedSection && ["overview","users","businesses","categories","services","reviews","commercial"].includes(requestedSection)) {
      setSection(requestedSection as typeof section);
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) navigate({ to: "/entrar" }); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [navigate]);

  async function updateBusiness(id: string, changes: { verified?: boolean; active?: boolean; approval_status?: "pending" | "approved" | "rejected" }) {
    const { error } = await supabase.from("business_profiles").update(changes).eq("id", id);
    if (error) return;
    setBusinesses((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  async function updatePlan(id: string, changes: { name: string; slug: string; description: string; price_cents: number; billing_period: string; highlighted: boolean; active: boolean }) {
    setPlanSavingId(id);
    const { data, error } = await supabase.from("plans").update(changes).eq("id", id).select("id,name,slug,description,price_cents,billing_period,highlighted,active").maybeSingle();
    setPlanSavingId(null);
    if (error || !data) return;
    setPlans((current) => current.map((item) => item.id === id ? data as typeof item : item));
    setEditingPlanId(null);
  }

  async function activateSubscription(businessId: string, planId: string) {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;
    setActivatingBusinessId(businessId);
    const now = new Date();
    const endsAt = new Date(now);
    if (plan.billing_period === "quarterly") endsAt.setMonth(endsAt.getMonth() + 3);
    else if (plan.billing_period === "yearly") endsAt.setFullYear(endsAt.getFullYear() + 1);
    else if (plan.billing_period === "monthly") endsAt.setMonth(endsAt.getMonth() + 1);
    else endsAt.setFullYear(endsAt.getFullYear() + 100);

    const existing = subscriptions.find((item) => item.business_id === businessId && item.status === "active");
    const payload = { plan_id: planId, status: "active", starts_at: now.toISOString(), ends_at: endsAt.toISOString(), activated_by: user?.id ?? null };
    const result = existing
      ? await supabase.from("business_subscriptions").update(payload).eq("id", existing.id).select("id,business_id,plan_id,status,ends_at,business:business_profiles(business_name),plan:plans(name)").single()
      : await supabase.from("business_subscriptions").insert({ business_id: businessId, ...payload }).select("id,business_id,plan_id,status,ends_at,business:business_profiles(business_name),plan:plans(name)").single();

    setActivatingBusinessId(null);
    if (result.error || !result.data) return;
    const updated = result.data as unknown as typeof subscriptions[number];
    setSubscriptions((current) => existing ? current.map((item) => item.id === existing.id ? updated : item) : [updated, ...current]);
    setActivationPlanByBusiness((current) => ({ ...current, [businessId]: "" }));
  }

  function categorySlug(value: string) {
    return value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameValue = newCategoryName.trim();
    if (!nameValue || categorySaving) return;
    setCategorySaving(true);
    setCategoryMessage("");
    const slug = categorySlug(nameValue);
    const { data: existing } = await supabase.from("categories").select("id").or(`name.ilike.${nameValue},slug.eq.${slug}`).limit(1).maybeSingle();
    if (existing) {
      setCategoryMessage("Essa categoria já está cadastrada.");
      setCategorySaving(false);
      return;
    }
    const { data, error } = await supabase.from("categories").insert({ name: nameValue, slug, active: true }).select("id,name,slug,active").single();
    if (error || !data) {
      setCategoryMessage(error?.message || "Não foi possível adicionar a categoria.");
      setCategorySaving(false);
      return;
    }
    setCategories((current) => [...current, data as typeof categories[number]].sort((a,b) => a.name.localeCompare(b.name, "pt-BR")));
    setStats((current) => ({ ...current, categories: current.categories + 1 }));
    setNewCategoryName("");
    setShowCreateCategory(false);
    setCategoryMessage("Categoria adicionada com sucesso.");
    setCategorySaving(false);
  }

  async function deleteCategory(id: string, name: string) {
    if (!window.confirm(`Remover a categoria "${name}"? Essa ação não pode ser desfeita.`)) return;
    setCategoryMessage("");
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      setCategoryMessage(error.code === "23503" ? "Não é possível remover esta categoria porque existem serviços vinculados a ela. Desative a categoria em vez de removê-la." : (error.message || "Não foi possível remover a categoria."));
      return;
    }
    setCategories((current) => current.filter((item) => item.id !== id));
    setStats((current) => ({ ...current, categories: Math.max(0, current.categories - 1) }));
    setCategoryMessage("Categoria removida com sucesso.");
  }

  async function updateReview(id:string, changes:{active?:boolean}) {
    const { error } = await supabase.from("reviews").update(changes).eq("id",id);
    if (!error) setReviews(current=>current.map(item=>item.id===id?{...item,...changes}:item));
  }
  async function deleteReview(id:string) {
    const { error } = await supabase.from("reviews").delete().eq("id",id);
    if (!error) setReviews(current=>current.filter(item=>item.id!==id));
  }
  async function createManualUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateUserError("");
    setCreateUserSuccess("");
    setCreatingUser(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: String(form.get("full_name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
      phone: String(form.get("phone") || "").trim(),
      city: String(form.get("city") || "").trim(),
      state: String(form.get("state") || "").trim(),
      user_type: String(form.get("user_type") || "professional"),
    };

    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: payload });

    setCreatingUser(false);

    if (error || data?.error) {
      let detailedMessage = data?.error || "";
      if (!detailedMessage && error) {
        try {
          const response = (error as unknown as { context?: Response }).context;
          if (response && typeof response.json === "function") {
            const body = await response.clone().json();
            detailedMessage = body?.error || body?.message || "";
          }
        } catch {
          // Mantém a mensagem padrão quando a resposta não puder ser lida.
        }
      }
      setCreateUserError(detailedMessage || error?.message || "Não foi possível cadastrar o usuário.");
      return;
    }

    setCreateUserSuccess("Usuário cadastrado com sucesso. O acesso já está liberado.");
    event.currentTarget.reset();
    const { data: refreshedUsers } = await supabase
      .from("profiles")
      .select("id,full_name,user_type,city,state")
      .order("created_at", { ascending: false });
    if (refreshedUsers) {
      setUsers(refreshedUsers as typeof users);
      setStats((current) => ({ ...current, users: refreshedUsers.length }));
    }
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  }

  if (loading) return <main style={styles.center}>Carregando administração...</main>;
  if (!user) return null;

  const menu = [
    { id: "overview" as const, label: "Visão geral" },
    { id: "users" as const, label: "Usuários", count: stats.users },
    { id: "businesses" as const, label: "Empresas", count: stats.businesses },
    { id: "services" as const, label: "Serviços", count: stats.services },
    { id: "categories" as const, label: "Categorias", count: stats.categories },
    { id: "reviews" as const, label: "Avaliações", count: stats.reviews },
    { id: "commercial" as const, label: "Comercial" },
  ];
  const pendingBusinesses = businesses.filter((item) => item.approval_status === "pending");
  const approvedBusinesses = businesses.filter((item) => item.approval_status === "approved");
  const activeBusinesses = businesses.filter((item) => item.active);
  const visibleReviews = reviews.filter((item) => item.active);
  const averageRating = visibleReviews.length ? visibleReviews.reduce((sum, item) => sum + item.rating, 0) / visibleReviews.length : 0;
  const filteredBusinesses = businesses.filter((item) => {
    const query = businessSearch.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !query || [item.business_name, item.city ?? "", item.state ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(query);
    return matchesSearch && (businessStatusFilter === "all" || item.approval_status === businessStatusFilter);
  });
  const selectedBusiness = selectedBusinessId ? businesses.find((item) => item.id === selectedBusinessId) ?? null : null;
  const sectionTitle = section === "overview" ? "Visão geral" : section === "users" ? "Usuários cadastrados" : section === "businesses" ? "Empresas cadastradas" : section === "services" ? "Serviços cadastrados" : section === "categories" ? <div>
                <div className="admin-category-toolbar">
                  <div><strong>Categorias cadastradas</strong><span>Adicione novas categorias e remova categorias que não serão mais utilizadas.</span></div>
                  <button type="button" className="admin-primary-button" onClick={() => { setShowCreateCategory((value) => !value); setCategoryMessage(""); }}>{showCreateCategory ? "Fechar" : "Nova categoria"}</button>
                </div>
                {showCreateCategory && <form className="admin-category-create" onSubmit={createCategory}>
                  <label><span>Nome da categoria</span><input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Ex.: Cerimonial e Assessoria" maxLength={80} required /></label>
                  <button type="submit" className="admin-primary-button" disabled={categorySaving}>{categorySaving ? "Adicionando..." : "Adicionar categoria"}</button>
                </form>}
                {categoryMessage && <div className="admin-category-message">{categoryMessage}</div>}
                <div className="admin-filters admin-simple-filter"><input value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Buscar categoria..." aria-label="Buscar categorias" /><span className="admin-filter-count">{categories.filter(item => `${item.name} ${item.slug}`.toLocaleLowerCase("pt-BR").includes(categorySearch.trim().toLocaleLowerCase("pt-BR"))).length} resultado(s)</span></div>
                <div className="admin-list">{categories.filter(item => `${item.name} ${item.slug}`.toLocaleLowerCase("pt-BR").includes(categorySearch.trim().toLocaleLowerCase("pt-BR"))).map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.name}</strong><span className={item.active ? "admin-category-status admin-category-status-active" : "admin-category-status admin-category-status-inactive"}>{item.active ? "Ativado" : "Desativada"}</span></div><div className="admin-item-actions"><button type="button" style={styles.actionButton} onClick={async()=>{const next=!item.active;const {error}=await supabase.from("categories").update({active:next}).eq("id",item.id);if(!error)setCategories(cur=>cur.map(x=>x.id===item.id?{...x,active:next}:x));}}>{item.active ? "Desativar" : "Ativar"}</button><button type="button" className="admin-category-delete" onClick={() => deleteCategory(item.id, item.name)}>Remover</button></div></div></article>)}</div></div>
               : section === "services" ? <div className="admin-inline-list"><div className="admin-filters admin-simple-filter"><input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder="Buscar serviço ou fornecedor..." aria-label="Buscar serviços" /><span className="admin-filter-count">{services.filter(item => `${item.name} ${item.business?.business_name ?? ""} ${item.category?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(serviceSearch.trim().toLocaleLowerCase("pt-BR"))).length} resultado(s)</span></div><div className="admin-list">{services.filter(item => `${item.name} ${item.business?.business_name ?? ""} ${item.category?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(serviceSearch.trim().toLocaleLowerCase("pt-BR"))).map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.name}</strong><span>{item.business?.business_name || "Empresa não informada"} · {item.category?.name || "Sem categoria"} · {item.active ? "Ativo" : "Inativo"}</span></div><div className="admin-item-actions"><button style={styles.actionButton} onClick={async()=>{const next=!item.active;const {error}=await supabase.from("services").update({active:next}).eq("id",item.id);if(!error)setServices(cur=>cur.map(x=>x.id===item.id?{...x,active:next}:x));}}>{item.active ? "Desativar" : "Ativar"}</button></div></div></article>)}</div></div>
              : <div><div className="admin-filters admin-simple-filter"><input value={reviewSearch} onChange={(e) => setReviewSearch(e.target.value)} placeholder="Buscar avaliação, fornecedor ou autor..." aria-label="Buscar avaliações" /><span className="admin-filter-count">{reviews.filter(item => `${item.comment ?? ""} ${item.business?.business_name ?? ""} ${item.reviewer?.full_name ?? ""}`.toLocaleLowerCase("pt-BR").includes(reviewSearch.trim().toLocaleLowerCase("pt-BR"))).length} resultado(s)</span></div><div className="admin-list">{reviews.filter(item => `${item.comment ?? ""} ${item.business?.business_name ?? ""} ${item.reviewer?.full_name ?? ""}`.toLocaleLowerCase("pt-BR").includes(reviewSearch.trim().toLocaleLowerCase("pt-BR"))).map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{"★".repeat(item.rating)} · {item.business?.business_name || "Empresa"}</strong><span>{item.reviewer?.full_name || "Usuário"} · {item.comment || "Sem comentário"} · {item.active ? "Visível" : "Oculta"}</span></div><div className="admin-item-actions"><button style={styles.actionButton} onClick={()=>updateReview(item.id,{active:!item.active})}>{item.active ? "Ocultar" : "Publicar"}</button><button style={styles.actionButton} onClick={()=>deleteReview(item.id)}>Excluir</button></div></div></article>)}</div></div>}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#f7f8fc", color: "#172033", fontFamily: "Arial, sans-serif" },
  header: { minHeight: 76, background: "#fff", borderBottom: "1px solid #e7e9f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px", boxSizing: "border-box" },
  logo: { fontWeight: 800, letterSpacing: ".06em", color: "#4f46c7" },
  subtitle: { marginTop: 4, fontSize: 10, fontWeight: 800, letterSpacing: ".14em", color: "#8a91a3" },
  logout: { border: "1px solid #dfe2ea", background: "#fff", borderRadius: 9, padding: "9px 14px", cursor: "pointer" },
  content: { maxWidth: 1100, margin: "0 auto", padding: "56px 24px" },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#4f46c7", background: "#ebe9ff", padding: "7px 10px", borderRadius: 999 },
  text: { color: "#687386", fontSize: 17 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 32 },
  actionButton: { border: "1px solid #dfe2ea", background: "#fff", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 },
  cardButton: { minHeight: 120, background: "#fff", border: "1px solid #e7e9f0", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 10, boxSizing: "border-box", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" },
  backButton: { border: "1px solid #dfe2ea", background: "#fff", borderRadius: 9, padding: "9px 14px", cursor: "pointer" },
  card: { minHeight: 120, background: "#fff", border: "1px solid #e7e9f0", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 10, boxSizing: "border-box" },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif", color: "#687386" },
};
