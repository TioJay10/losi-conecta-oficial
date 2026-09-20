import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/meu-perfil")({
  component: PersonalProfilePage,
});

function PersonalProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        navigate({ to: "/entrar" });
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate({ to: "/entrar" });
        return;
      }

      const currentUser = data.user;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name,phone,city,state")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!mounted) return;

      setUser(currentUser);

      if (profileError) {
        setMessage("Não foi possível carregar seus dados: " + profileError.message);
      }

      setForm({
        full_name: profile?.full_name ?? currentUser.user_metadata?.full_name ?? "",
        phone: profile?.phone ?? "",
        city: profile?.city ?? "",
        state: profile?.state ?? "",
      });
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();

    if (!supabase || !user) return;

    if (!form.full_name.trim()) {
      setMessage("Informe seu nome completo.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      setMessage("Não foi possível salvar seus dados: " + error.message);
    } else {
      setMessage("Informações pessoais atualizadas com sucesso.");
    }

    setSaving(false);
  }

  if (loading) return <main style={styles.center}>Carregando seu perfil...</main>;

  return (
    <main className="profile-page personal-profile-page" style={styles.page}>
      <header className="profile-header" style={styles.header}>
        <button type="button" onClick={() => navigate({ to: "/painel" })} style={styles.back}>
          ← Voltar ao painel
        </button>
        <div className="mobile-centered-brand" style={styles.logo}>LOSI <span>CONECTA</span></div>
      </header>

      <section className="profile-content" style={styles.content}>
        <div style={styles.heading}>
          <div>
            <div style={styles.badge}>MINHA CONTA</div>
            <h1>Meu perfil</h1>
            <p style={styles.text}>
              Atualize somente seus dados pessoais. As informações da empresa e dos serviços ficam em “Meus serviços”.
            </p>
          </div>
        </div>

        <form onSubmit={saveProfile} style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2>Informações pessoais</h2>
              <p style={styles.hint}>Esses dados identificam você dentro da sua conta profissional.</p>
            </div>
          </div>

          <div className="profile-form-grid" style={styles.formGrid}>
            <Field label="Nome completo *" value={form.full_name} onChange={(v) => update("full_name", v)} />
            <Field label="Telefone" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field label="Cidade" value={form.city} onChange={(v) => update("city", v)} />
            <Field label="Estado" value={form.state} onChange={(v) => update("state", v)} />
          </div>

          <div style={styles.readOnly}>
            <span style={styles.readOnlyLabel}>E-mail da conta</span>
            <strong>{user?.email || "Não informado"}</strong>
            <small>O e-mail de acesso não é alterado nesta área.</small>
          </div>

          <button type="submit" disabled={saving} style={styles.primary}>
            {saving ? "Salvando..." : "Salvar informações pessoais"}
          </button>
        </form>

        {message && <div style={styles.message}>{message}</div>}
      </section>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f7f8fc", color: "#172033", fontFamily: "Arial, sans-serif" },
  header: { height: 72, background: "#fff", borderBottom: "1px solid #e7e9f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px" },
  logo: { fontWeight: 800, letterSpacing: ".06em", color: "#4f46c7" },
  back: { border: 0, background: "transparent", cursor: "pointer", color: "#566074", fontSize: 14 },
  content: { maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" },
  heading: { marginBottom: 24 },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#4f46c7", background: "#ebe9ff", padding: "7px 10px", borderRadius: 999 },
  text: { color: "#687386", fontSize: 16, lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #e7e9f0", borderRadius: 16, padding: 28, marginBottom: 18 },
  cardHeader: { marginBottom: 20 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 20 },
  readOnly: { display: "grid", gap: 4, padding: 14, marginBottom: 20, border: "1px solid #e7e9f0", borderRadius: 10, background: "#f8f9fb" },
  readOnlyLabel: { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#7b8292" },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#465066", marginBottom: 7 },
  input: { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #dfe2ea", borderRadius: 9, fontSize: 14, background: "#fff" },
  primary: { border: 0, background: "#4f46c7", color: "#fff", borderRadius: 9, padding: "12px 18px", fontWeight: 700, cursor: "pointer" },
  message: { background: "#fff", border: "1px solid #dfe2ea", borderRadius: 12, padding: 16, color: "#465066" },
  hint: { color: "#8a91a3", fontSize: 13, margin: "5px 0 0" },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", color: "#687386", fontFamily: "Arial, sans-serif" },
};
