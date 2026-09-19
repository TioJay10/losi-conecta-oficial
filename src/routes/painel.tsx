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
  const [hasBusinessProfile, setHasBusinessProfile] = useState(false);\n  const [savedBusinesses, setSavedBusinesses] = useState<{ id: string; business_name: string; slug: string; city: string | null; state: string | null }[]>([]);
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

      const { data: business } = await supabase
        .from("business_profiles")
        .select("id")
        .eq("owner_id", currentUser.id)
        .maybeSingle();

      if (!mounted) return;

      setUser(currentUser);
      setProfile(data);
      setHasBusinessProfile(Boolean(business));
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
    <main className="dashboard-page" style={styles.page}>
      <header className="dashboard-header" style={styles.header}>
        <div style={styles.logo}>LOSI <span>CONECTA</span></div>
        <button onClick={logout} style={styles.logout}>Sair</button>
      </header>

      <section className="dashboard-content" style={styles.content}>
        <div style={styles.badge}>PROFISSIONAL</div>
        <h1>Olá, {profile.full_name || user.email?.split("@")[0] || "profissional"}.</h1>
        <p style={styles.text}>Sua conta profissional está autenticada e conectada ao LOSI CONECTA.</p>

        {!hasBusinessProfile ? (
          <section style={styles.onboarding}>
            <div>
              <div style={styles.onboardingLabel}>PRIMEIRO PASSO</div>
              <h2 style={styles.onboardingTitle}>Crie seu perfil comercial</h2>
              <p style={styles.onboardingText}>
                Apresente sua empresa, cadastre seus serviços e envie seu perfil para análise da administração.
                Depois da aprovação, ele ficará disponível no catálogo.
              </p>
            </div>
            <button onClick={() => navigate({ to: "/meu-perfil" })} style={styles.primary}>
              Criar meu perfil →
            </button>
          </section>
        ) : (
          <div className="dashboard-grid" style={styles.grid}>
            <button type="button" onClick={() => navigate({ to: "/buscar" })} style={styles.cardButton}>
              <strong>Encontrar fornecedores</strong>
              <span>Pesquise profissionais e empresas para seus eventos.</span>
            </button>
            <button type="button" onClick={() => navigate({ to: "/meu-perfil" })} style={styles.cardButton}>
              <strong>Meu perfil</strong>
              <span>Atualize sua apresentação, contatos e informações comerciais.</span>
            </button>
            <button type="button" onClick={() => navigate({ to: "/meu-perfil" })} style={styles.cardButton}>
              <strong>Meus serviços</strong>
              <span>Cadastre, edite e organize os serviços oferecidos pela sua empresa.</span>
            </button>
          </div>
        )}
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
  cardButton: { background: "#fff", border: "1px solid #e7e9f0", borderRadius: 14, padding: 24, lineHeight: 1.6, textAlign: "left", cursor: "pointer", display: "grid", gap: 8, color: "#172033" },
  onboarding: { marginTop: 32, background: "#fff", border: "1px solid #dfe2ea", borderRadius: 18, padding: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, boxShadow: "0 12px 35px rgba(23,32,51,.05)" },
  onboardingLabel: { fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#4f46c7" },
  onboardingTitle: { margin: "8px 0 6px", fontSize: 24 },
  onboardingText: { margin: 0, color: "#687386", lineHeight: 1.55, maxWidth: 650 },
  primary: { border: 0, background: "#4f46c7", color: "#fff", borderRadius: 9, padding: "12px 18px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  savedCard: { background: "#fff", border: "1px solid #e7e9f0", borderRadius: 12, padding: "16px 18px", display: "flex", justifyContent: "space-between", gap: 12, textDecoration: "none", color: "#172033" },\n  center: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif", color: "#687386" },
};

