import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  const [businesses, setBusinesses] = useState<Array<{ id: string; business_name: string; city: string | null; state: string | null; verified: boolean; active: boolean; approval_status: "pending" | "approved" | "rejected" }>>([]);
  const [section, setSection] = useState<"overview" | "users" | "businesses" | "categories" | "services" | "reviews">("overview");
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
      const [usersResult,businessesResult,categoriesResult,servicesResult,reviewsResult] = await Promise.all([
        supabase.from("profiles").select("id,full_name,user_type,city,state").order("created_at",{ascending:false}),
        supabase.from("business_profiles").select("id,business_name,city,state,verified,active,approval_status").order("created_at",{ascending:false}),
        supabase.from("categories").select("id,name,slug,active").order("name"),
        supabase.from("services").select("id,name,description,active,business:business_profiles(business_name),category:categories(name)").order("created_at",{ascending:false}),
        supabase.from("reviews").select("id,rating,comment,active,created_at,business:business_profiles(business_name),reviewer:profiles(full_name)").order("created_at",{ascending:false}),
      ]);
      if (!mounted) return;
      setUsers((usersResult.data ?? []) as typeof users);
      setBusinesses((businessesResult.data ?? []) as typeof businesses);
      setCategories((categoriesResult.data ?? []) as typeof categories);
      setServices((servicesResult.data ?? []) as unknown as typeof services);
      setReviews((reviewsResult.data ?? []) as unknown as typeof reviews);
      setStats({users:usersResult.data?.length??0,businesses:businessesResult.data?.length??0,categories:categoriesResult.data?.length??0,services:servicesResult.data?.length??0,reviews:reviewsResult.data?.length??0});
      setLoading(false);
    }
    load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) navigate({ to: "/entrar" }); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [navigate]);

  async function updateBusiness(id: string, changes: { verified?: boolean; active?: boolean; approval_status?: "pending" | "approved" | "rejected" }) {
    const { error } = await supabase.from("business_profiles").update(changes).eq("id", id);
    if (error) return;
    setBusinesses((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  async function updateReview(id:string, changes:{active?:boolean}) {
    const { error } = await supabase.from("reviews").update(changes).eq("id",id);
    if (!error) setReviews(current=>current.map(item=>item.id===id?{...item,...changes}:item));
  }
  async function deleteReview(id:string) {
    const { error } = await supabase.from("reviews").delete().eq("id",id);
    if (!error) setReviews(current=>current.filter(item=>item.id!==id));
  }
  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  }

  if (loading) return <main style={styles.center}>Carregando administração...</main>;
  if (!user) return null;

  return (
    <main className="admin-page" style={styles.page}>
      <header className="admin-header" style={styles.header}>
        <div>
          <div style={styles.logo}>LOSI <span>CONECTA</span></div>
          <div style={styles.subtitle}>PAINEL ADMINISTRATIVO</div>
        </div>
        <button onClick={logout} style={styles.logout}>Sair</button>
      </header>

      <section className="admin-content" style={styles.content}>
        <div style={styles.badge}>ADMINISTRADOR</div>
        <h1>Olá, {name}.</h1>
        <p style={styles.text}>Este é o centro de gestão do LOSI CONECTA.</p>

        <div className="admin-grid" style={styles.grid}>
          <button style={styles.cardButton} onClick={() => setSection("users")}><strong>Usuários <em>{stats.users}</em></strong><span>Ver contas cadastradas.</span></button>
          <button style={styles.cardButton} onClick={() => setSection("businesses")}><strong>Empresas <em>{stats.businesses}</em></strong><span>Ver perfis comerciais.</span></button>
          <button style={styles.cardButton} onClick={() => setSection("categories")}><strong>Categorias <em>{stats.categories}</em></strong><span>Gerenciar categorias.</span></button>
          <button style={styles.cardButton} onClick={() => setSection("services")}><strong>Serviços <em>{stats.services}</em></strong><span>Gerenciar serviços.</span></button>
          <button style={styles.cardButton} onClick={() => setSection("reviews")}><strong>Avaliações <em>{stats.reviews}</em></strong><span>Moderar avaliações.</span></button>
          <div style={styles.card}><strong>Métricas</strong><span>Acompanhar o crescimento da plataforma.</span></div>
        </div>
        {section !== "overview" && <section className="admin-table-section">
          <div className="admin-section-head"><div><div style={styles.badge}>{section === "users" ? "USUÁRIOS" : section === "businesses" ? "EMPRESAS" : section === "categories" ? "CATEGORIAS" : section === "services" ? "SERVIÇOS" : "AVALIAÇÕES"}</div><h2>{section === "users" ? "Usuários cadastrados" : section === "businesses" ? "Empresas cadastradas" : section === "categories" ? "Categorias cadastradas" : section === "services" ? "Serviços cadastrados" : "Avaliações recebidas"}</h2></div><button style={styles.backButton} onClick={() => setSection("overview")}>Voltar</button></div>
          {section === "users" ? <div className="admin-list">{users.map(item => <article className="admin-list-item" key={item.id}><strong>{item.full_name || "Sem nome"}</strong><span>{item.user_type === "admin" ? "Administrador" : "Profissional"}{item.city ? " · " + item.city : ""}{item.state ? " - " + item.state : ""}</span></article>)}</div>
          : section === "businesses" ? <div className="admin-list">{businesses.map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.business_name}</strong><span>{item.city || "Localização não informada"}{item.state ? " - " + item.state : ""} · {item.verified ? "Verificada" : "Não verificada"} · {item.active ? "Ativa" : "Inativa"} · {item.approval_status === "approved" ? "Aprovada" : item.approval_status === "rejected" ? "Rejeitada" : "Pendente"}</span></div><div className="admin-item-actions"><button style={styles.actionButton} onClick={() => updateBusiness(item.id,{verified:!item.verified})}>{item.verified ? "Retirar verificação" : "Verificar empresa"}</button><button style={styles.actionButton} onClick={() => updateBusiness(item.id,{approval_status:"approved"})}>Aprovar</button><button style={styles.actionButton} onClick={() => updateBusiness(item.id,{approval_status:"rejected"})}>Rejeitar</button><button style={styles.actionButton} onClick={() => updateBusiness(item.id,{active:!item.active})}>{item.active ? "Desativar" : "Ativar"}</button></div></div></article>)}</div>
          : section === "categories" ? <div className="admin-list">{categories.map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.name}</strong><span>{item.slug} · {item.active ? "Ativa" : "Inativa"}</span></div><div className="admin-item-actions"><button style={styles.actionButton} onClick={async()=>{const next=!item.active;const {error}=await supabase.from("categories").update({active:next}).eq("id",item.id);if(!error)setCategories(cur=>cur.map(x=>x.id===item.id?{...x,active:next}:x));}}>{item.active ? "Desativar" : "Ativar"}</button></div></div></article>)}</div>
          : section === "services" ? <div className="admin-list">{services.map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.name}</strong><span>{item.business?.business_name || "Empresa não informada"} · {item.category?.name || "Sem categoria"} · {item.active ? "Ativo" : "Inativo"}</span></div><div className="admin-item-actions"><button style={styles.actionButton} onClick={async()=>{const next=!item.active;const {error}=await supabase.from("services").update({active:next}).eq("id",item.id);if(!error)setServices(cur=>cur.map(x=>x.id===item.id?{...x,active:next}:x));}}>{item.active ? "Desativar" : "Ativar"}</button></div></div></article>)}</div>
          : <div className="admin-list">{reviews.map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{"★".repeat(item.rating)} · {item.business?.business_name || "Empresa"}</strong><span>{item.reviewer?.full_name || "Usuário"} · {item.comment || "Sem comentário"} · {item.active ? "Visível" : "Oculta"}</span></div><div className="admin-item-actions"><button style={styles.actionButton} onClick={()=>updateReview(item.id,{active:!item.active})}>{item.active ? "Ocultar" : "Publicar"}</button><button style={styles.actionButton} onClick={()=>deleteReview(item.id)}>Excluir</button></div></div></article>)}</div>}        </section>}
      </section>
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
