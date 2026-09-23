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
  const [cepValidated, setCepValidated] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    state: "",
    cep: "",
    address: "",
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
        .select("full_name,phone,city,state,cep,address,avatar_url")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!mounted) return;

      setUser(currentUser);

      if (profileError) {
        setMessage("Não foi possível carregar seus dados: " + profileError.message);
      }

      setAvatarUrl(profile?.avatar_url ?? null);
      setForm({
        full_name: profile?.full_name ?? currentUser.user_metadata?.full_name ?? "",
        phone: profile?.phone ?? "",
        city: profile?.city ?? "",
        state: profile?.state ?? "",
        cep: profile?.cep ?? "",
        address: profile?.address ?? "",
      });
      setCepValidated(Boolean(profile?.cep && profile.cep.replace(/\\D/g, "").length === 8));
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

  async function lookupCep(value: string) {
    const cep = value.replace(/\D/g, "");
    if (cep.length !== 8) {
      setCepValidated(false);
      return;
    }

    const response = await fetch("https://brasilapi.com.br/api/cep/v2/" + cep);
    if (!response.ok) throw new Error("CEP não encontrado.");

    const data = await response.json();
    if (data.erro) throw new Error("CEP não encontrado.");

    setCepValidated(true);
    setMessage("");
    setForm((current) => ({
      ...current,
      cep: cep.replace(/(\d{5})(\d{3})/, "$1-$2"),
      city: data.city ?? current.city,
      state: data.state ?? current.state,
    }));
  }

  async function uploadProfilePhoto(file: File) {
    if (!supabase || !user) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Selecione uma imagem válida.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("A foto deve ter no máximo 5 MB.");
      return;
    }

    setUploadingAvatar(true);
    setMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = user.id + "/" + Date.now() + "." + extension;

      const { data: uploaded, error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(uploaded.path);

      const nextAvatarUrl = publicUrlData.publicUrl;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: nextAvatarUrl })
        .eq("id", user.id);

      if (profileError) throw profileError;

      setAvatarUrl(nextAvatarUrl);
      setMessage("Foto de perfil atualizada com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar foto de perfil:", error);
      setMessage(error instanceof Error ? "Não foi possível atualizar a foto: " + error.message : "Não foi possível atualizar a foto.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();

    if (!supabase || !user) return;

    if (!form.full_name.trim()) {
      setMessage("Informe seu nome completo.");
      return;
    }

    const normalizedCep = form.cep.replace(/\D/g, "");
    if (normalizedCep.length !== 8) {
      setMessage("Informe um CEP válido com 8 números.");
      return;
    }

    if (!cepValidated) {
      setMessage("Consulte e valide o CEP antes de salvar.");
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
        cep: normalizedCep,
        address: form.address.trim() || null,
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

          <div className="personal-profile-photo-section">
            <div className="personal-profile-photo-preview">
              {avatarUrl ? (
                <img src={avatarUrl} alt={form.full_name ? `Foto de ${form.full_name}` : "Foto do perfil"} />
              ) : (
                <span>{(form.full_name || user?.email || "P").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="personal-profile-photo-copy">
              <strong>Foto de perfil</strong>
              <p>Essa foto aparecerá ao lado do botão “Sair” no seu painel.</p>
              <label className="personal-profile-upload">
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingAvatar}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadProfilePhoto(file);
                    event.currentTarget.value = "";
                  }}
                />
                {uploadingAvatar ? "Enviando foto..." : "Escolher foto"}
              </label>
              <small>JPG, PNG ou WEBP • máximo de 5 MB</small>
            </div>
          </div>

          <div className="profile-form-grid personal-profile-form-grid">
            <Field label="Nome completo *" value={form.full_name} onChange={(v) => update("full_name", v)} />
            <Field label="Telefone" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field label="Cidade" value={form.city} onChange={(v) => update("city", v)} />
            <Field label="Estado" value={form.state} onChange={(v) => update("state", v)} />
            <Field label="Endereço completo" value={form.address} onChange={(v) => update("address", v)} />
            <div>
              <label className="personal-profile-label">CEP *</label>
              <input
                value={form.cep}
                onChange={(e) => {
                update("cep", e.target.value);
                setCepValidated(false);
                setMessage("");
              }}
                onBlur={(e) => {
                  lookupCep(e.target.value).catch((error) =>
                    setMessage(error instanceof Error ? error.message : "Não foi possível consultar o CEP.")
                  );
                }}
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                className="personal-profile-input"
              />
              <small className="personal-profile-field-hint">Seu CEP será usado como referência para filtros por distância.</small>
            </div>
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

