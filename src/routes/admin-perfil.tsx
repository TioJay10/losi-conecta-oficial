import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/admin-perfil")({ component: AdminProfilePage });

function AdminProfilePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      if (!currentUser) {
        navigate({ to: "/entrar" });
        return;
      }
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name,phone,city,state,avatar_url,user_type,blocked")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (!mounted) return;
      if (profileError || !data || data.blocked || data.user_type !== "admin") {
        await supabase.auth.signOut();
        navigate({ to: "/entrar" });
        return;
      }
      setUserId(currentUser.id);
      setEmail(currentUser.email ?? "");
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setCity(data.city ?? "");
      setState(data.state ?? "");
      setAvatarUrl(data.avatar_url ?? null);
      setLoading(false);
    }
    load().catch(() => {
      if (mounted) {
        setError("Não foi possível carregar o perfil.");
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [navigate]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    const { data, error: saveError } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim(), city: city.trim(), state: state.trim().toUpperCase() })
      .eq("id", userId)
      .select("full_name,phone,city,state,avatar_url")
      .single();
    setSaving(false);
    if (saveError || !data) {
      setError(saveError?.message || "Não foi possível salvar os dados.");
      return;
    }
    setFullName(data.full_name ?? "");
    setPhone(data.phone ?? "");
    setCity(data.city ?? "");
    setState(data.state ?? "");
    setAvatarUrl(data.avatar_url ?? null);
    setMessage("Perfil atualizado com sucesso.");
  }

  async function uploadAvatar(file: File | null) {
    if (!userId || !file || uploading) return;
    setError("");
    setMessage("");
    if (!file.type.startsWith("image/")) {
      setError("Escolha uma imagem válida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A foto deve ter no máximo 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = userId + "/" + Date.now() + "." + extension;
      const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      const nextUrl = publicData.publicUrl;
      const { data: saved, error: saveError } = await supabase.from("profiles").update({ avatar_url: nextUrl }).eq("id", userId).select("avatar_url").single();
      if (saveError || !saved?.avatar_url) throw saveError || new Error("Não foi possível salvar a foto no perfil.");
      setAvatarUrl(saved.avatar_url);
      setMessage("Foto de perfil atualizada.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  }

  if (loading) return <main className="admin-profile-loading">Carregando perfil...</main>;

  return (
    <main className="admin-profile-page">
      <header className="admin-profile-header">
        <Link to="/admin" className="admin-profile-back">← Painel administrativo</Link>
        <div className="admin-profile-header-brand">LOSI <span>CONECTA</span></div>
        <button type="button" className="admin-profile-logout" onClick={logout}>Sair</button>
      </header>
      <section className="admin-profile-content">
        <div className="admin-badge">PERFIL DO ADMINISTRADOR</div>
        <h1>Meu perfil</h1>
        <p className="admin-profile-intro">Atualize seus dados e a foto que aparece no cabeçalho do painel.</p>

        <form className="admin-profile-card" onSubmit={saveProfile}>
          <section className="admin-profile-photo-section">
            <div className="admin-profile-photo">
              {avatarUrl ? <img src={avatarUrl} alt="Foto do administrador" /> : <span>{(fullName || email || "A").slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="admin-profile-photo-copy">
              <strong>Foto de perfil</strong>
              <p>Esta é a foto pessoal da sua conta administrativa, não a logo de uma empresa.</p>
              <label className="admin-profile-upload">
                {uploading ? "Enviando..." : "Escolher foto"}
                <input type="file" accept="image/*" disabled={uploading} onChange={(event) => { void uploadAvatar(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
              </label>
              <small>JPG, PNG ou WEBP · máximo 5 MB</small>
            </div>
          </section>

          <div className="admin-profile-grid">
            <label><span>Nome completo</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label>
            <label><span>E-mail</span><input value={email} readOnly /></label>
            <label><span>Telefone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" /></label>
            <label><span>Cidade</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label>
            <label><span>UF</span><input value={state} onChange={(event) => setState(event.target.value.slice(0, 2).toUpperCase())} maxLength={2} /></label>
          </div>

          {error && <div className="admin-profile-message error">{error}</div>}
          {message && <div className="admin-profile-message success">{message}</div>}

          <div className="admin-profile-actions">
            <button type="button" className="admin-profile-secondary" onClick={() => navigate({ to: "/admin" })}>Voltar</button>
            <button type="submit" className="admin-profile-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
