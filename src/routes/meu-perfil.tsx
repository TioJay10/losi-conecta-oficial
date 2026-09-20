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

  if (loading) return <main className="personal-profile-loading">Carregando seu perfil...</main>;

  return (
    <main className="profile-page personal-profile-page">
      <header className="profile-header personal-profile-header">
        <button type="button" onClick={() => navigate({ to: "/painel" })} className="profile-back">
          ← Voltar ao painel
        </button>
        <div className="profile-logo mobile-centered-brand">LOSI <span>CONECTA</span></div>
      </header>

      <section className="profile-content personal-profile-content">
        <div className="personal-profile-heading">
          <div>
            <div className="profile-badge">MINHA CONTA</div>
            <h1>Meu perfil</h1>
            <p className="profile-page-text">
              Atualize somente seus dados pessoais. As informações da empresa e dos serviços ficam em “Meus serviços”.
            </p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="personal-profile-card">
          <div className="personal-profile-card-header">
            <div>
              <h2>Informações pessoais</h2>
              <p className="personal-profile-hint">Esses dados identificam você dentro da sua conta profissional.</p>
            </div>
          </div>

          <div className="profile-form-grid personal-profile-form-grid">
            <Field label="Nome completo *" value={form.full_name} onChange={(v) => update("full_name", v)} />
            <Field label="Telefone" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field label="Cidade" value={form.city} onChange={(v) => update("city", v)} />
            <Field label="Estado" value={form.state} onChange={(v) => update("state", v)} />
          </div>

          <div className="personal-profile-readonly">
            <span className="personal-profile-readonly-label">E-mail da conta</span>
            <strong>{user?.email || "Não informado"}</strong>
            <small>O e-mail de acesso não é alterado nesta área.</small>
          </div>

          <button type="submit" disabled={saving} className="personal-profile-primary">
            {saving ? "Salvando..." : "Salvar informações pessoais"}
          </button>
        </form>

        {message && <div className="personal-profile-message">{message}</div>}
      </section>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="personal-profile-label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="personal-profile-input" />
    </div>
  );
}

