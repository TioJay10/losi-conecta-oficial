import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        navigate({ to: "/entrar" });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate({ to: "/entrar" });
        return;
      }

      const currentUser = sessionData.session.user;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,user_type")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) {
        await supabase.auth.signOut();
        navigate({ to: "/entrar" });
        return;
      }

      if (data.user_type !== "admin") {
        navigate({ to: "/painel" });
        return;
      }

      setUser(currentUser);
      setName(data.full_name || currentUser.email?.split("@")[0] || "administrador");
      setLoading(false);
    }

    load();

    const { data: listener } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/entrar" });
    }) ?? { data: { subscription: { unsubscribe() {} } } };

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

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
          <div style={styles.card}><strong>Usuários</strong><span>Gerenciar contas profissionais.</span></div>
          <div style={styles.card}><strong>Empresas</strong><span>Revisar e verificar perfis comerciais.</span></div>
          <div style={styles.card}><strong>Categorias</strong><span>Organizar as áreas de atuação.</span></div>
          <div style={styles.card}><strong>Serviços</strong><span>Gerenciar serviços cadastrados.</span></div>
          <div style={styles.card}><strong>Avaliações</strong><span>Moderá-las quando essa função estiver disponível.</span></div>
          <div style={styles.card}><strong>Métricas</strong><span>Acompanhar o crescimento da plataforma.</span></div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f7f8fc", color: "#172033", fontFamily: "Arial, sans-serif" },
  header: { minHeight: 76, background: "#fff", borderBottom: "1px solid #e7e9f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px", boxSizing: "border-box" },
  logo: { fontWeight: 800, letterSpacing: ".06em", color: "#4f46c7" },
  subtitle: { marginTop: 4, fontSize: 10, fontWeight: 800, letterSpacing: ".14em", color: "#8a91a3" },
  logout: { border: "1px solid #dfe2ea", background: "#fff", borderRadius: 9, padding: "9px 14px", cursor: "pointer" },
  content: { maxWidth: 1100, margin: "0 auto", padding: "56px 24px" },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#4f46c7", background: "#ebe9ff", padding: "7px 10px", borderRadius: 999 },
  text: { color: "#687386", fontSize: 17 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 32 },
  card: { minHeight: 120, background: "#fff", border: "1px solid #e7e9f0", borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 10, boxSizing: "border-box" },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif", color: "#687386" },
};
