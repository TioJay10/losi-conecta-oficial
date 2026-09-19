import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/painel")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; user_type: "professional" | "admin" } | null>(null);
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

      if (data.user_type === "admin") {
        navigate({ to: "/admin" });
        return;
      }

      setUser(currentUser);
      setProfile(data);
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

  if (loading) return <main style={styles.center}>Carregando sua conta...</main>;
  if (!user || !profile) return null;

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logo}>LOSI <span>CONECTA</span></div>
        <button onClick={logout} style={styles.logout}>Sair</button>
      </header>

      <section style={styles.content}>
        <div style={styles.badge}>PROFISSIONAL</div>
        <h1>Olá, {profile.full_name || user.email?.split("@")[0] || "profissional"}.</h1>
        <p style={styles.text}>Sua conta profissional está autenticada e conectada ao LOSI CONECTA.</p>

        <div style={styles.grid}>
          <div style={styles.card}>
            <strong>Encontrar fornecedores</strong>
            <p>Pesquise profissionais e empresas para seus eventos.</p>
          </div>
          <div style={styles.card}>
            <strong>Meu perfil</strong>
            <p>Em breve você poderá apresentar seus serviços e portfólio.</p>
          </div>
          <div style={styles.card}>
            <strong>Meus serviços</strong>
            <p>Cadastre as categorias e serviços oferecidos pela sua empresa.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f7f8fc", color: "#172033", fontFamily: "Arial, sans-serif" },
  header: { height: 72, background: "#fff", borderBottom: "1px solid #e7e9f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", boxSizing: "border-box" },
  logo: { fontWeight: 800, letterSpacing: ".06em", color: "#4f46c7" },
  logout: { border: "1px solid #dfe2ea", background: "#fff", borderRadius: 9, padding: "9px 14px", cursor: "pointer" },
  content: { maxWidth: 1000, margin: "0 auto", padding: "60px 24px" },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#4f46c7", background: "#ebe9ff", padding: "7px 10px", borderRadius: 999 },
  text: { color: "#687386", fontSize: 17 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 32 },
  card: { background: "#fff", border: "1px solid #e7e9f0", borderRadius: 14, padding: 24, lineHeight: 1.6 },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif", color: "#687386" },
};

