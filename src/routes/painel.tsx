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
  const [profile, setProfile] = useState<{ full_name: string | null; user_type: string } | null>(null);
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

      if (!mounted) return;
      setUser(sessionData.session.user);

      const { data } = await supabase
        .from("profiles")
        .select("full_name,user_type")
        .eq("id", sessionData.session.user.id)
        .maybeSingle();

      if (mounted) {
        setProfile(data);
        setLoading(false);
      }
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
  if (!user) return null;

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logo}>LOSI <span>CONECTA</span></div>
        <button onClick={logout} style={styles.logout}>Sair</button>
      </header>
      <section style={styles.content}>
        <div style={styles.badge}>{profile?.user_type === "admin" ? "ADMINISTRADOR" : "PROFISSIONAL"}</div>
        <h1>Olá, {profile?.full_name || user.email?.split("@")[0] || "profissional"}.</h1>
        <p style={styles.text}>Sua conta está autenticada e conectada ao LOSI CONECTA.</p>
        <div style={styles.panel}>
          <strong>Próximo passo</strong>
          <p>Vamos transformar este painel na área completa para encontrar fornecedores, gerenciar seu perfil e conectar-se ao mercado de eventos.</p>
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
  content: { maxWidth: 900, margin: "0 auto", padding: "60px 24px" },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#4f46c7", background: "#ebe9ff", padding: "7px 10px", borderRadius: 999 },
  text: { color: "#687386", fontSize: 17 },
  panel: { marginTop: 28, background: "#fff", border: "1px solid #e7e9f0", borderRadius: 14, padding: 24, lineHeight: 1.6 },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif", color: "#687386" },
};
