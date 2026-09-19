import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Category = { id: string; name: string };
type Business = {
  id: string;
  business_name: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

export const Route = createFileRoute("/meu-perfil")({
  component: BusinessProfilePage,
});

function BusinessProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    business_name: "",
    description: "",
    phone: "",
    whatsapp: "",
    website: "",
    instagram: "",
    city: "",
    state: "",
    address: "",
    logo_url: "",
    cover_url: "",
  });
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

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
      const [businessResult, categoryResult] = await Promise.all([
        supabase.from("business_profiles").select("*").eq("owner_id", currentUser.id).maybeSingle(),
        supabase.from("categories").select("id,name").eq("active", true).order("name"),
      ]);

      if (!mounted) return;

      if (businessResult.error || categoryResult.error) {
        setMessage("Não foi possível carregar os dados. Tente novamente.");
      }

      const loaded = businessResult.data as Business | null;
      setUser(currentUser);
      setBusiness(loaded);
      setCategories(categoryResult.data ?? []);
      setCategoryId(categoryResult.data?.[0]?.id ?? "");

      if (loaded) {
        setForm({
          business_name: loaded.business_name ?? "",
          description: loaded.description ?? "",
          phone: loaded.phone ?? "",
          whatsapp: loaded.whatsapp ?? "",
          website: loaded.website ?? "",
          instagram: loaded.instagram ?? "",
          city: loaded.city ?? "",
          state: loaded.state ?? "",
          address: loaded.address ?? "",
          logo_url: loaded.logo_url ?? "",
          cover_url: loaded.cover_url ?? "",
        });
      }

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

    if (!form.business_name.trim()) {
      setMessage("Informe o nome comercial.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      owner_id: user.id,
      business_name: form.business_name.trim(),
      slug: business?.id
        ? business.business_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + business.id.slice(0, 8)
        : crypto.randomUUID().slice(0, 8) + "-" + form.business_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      description: form.description.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      website: form.website.trim() || null,
      instagram: form.instagram.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      address: form.address.trim() || null,
      logo_url: form.logo_url.trim() || null,
      cover_url: form.cover_url.trim() || null,
    };

    const result = business
      ? await supabase.from("business_profiles").update(payload).eq("id", business.id).select("*").single()
      : await supabase.from("business_profiles").insert(payload).select("*").single();

    if (result.error) {
      setMessage("Não foi possível salvar o perfil: " + result.error.message);
    } else {
      setBusiness(result.data as Business);
      setMessage("Perfil comercial salvo com sucesso.");
    }

    setSaving(false);
  }

  async function addService(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !business || !categoryId || !serviceName.trim()) {
      setMessage("Salve o perfil e informe categoria e nome do serviço.");
      return;
    }

    const { error } = await supabase.from("services").insert({
      business_id: business.id,
      category_id: categoryId,
      name: serviceName.trim(),
      description: serviceDescription.trim() || null,
    });

    if (error) {
      setMessage("Não foi possível cadastrar o serviço: " + error.message);
      return;
    }

    setServiceName("");
    setServiceDescription("");
    setMessage("Serviço cadastrado.");
  }

  if (loading) return <main style={styles.center}>Carregando seu perfil...</main>;

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <button onClick={() => navigate({ to: "/painel" })} style={styles.back}>← Painel</button>
        <div style={styles.logo}>LOSI <span>CONECTA</span></div>
      </header>

      <section style={styles.content}>
        <div style={styles.heading}>
          <div>
            <div style={styles.badge}>PERFIL COMERCIAL</div>
            <h1>Apresente sua empresa</h1>
            <p style={styles.text}>Essas informações serão usadas no seu perfil público dentro do LOSI CONECTA.</p>
          </div>
        </div>

        <form onSubmit={saveProfile} style={styles.card}>
          <h2>Informações da empresa</h2>
          <div style={styles.formGrid}>
            <Field label="Nome comercial *" value={form.business_name} onChange={(v) => update("business_name", v)} />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => update("whatsapp", v)} />
            <Field label="Telefone" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field label="Instagram" value={form.instagram} onChange={(v) => update("instagram", v)} />
            <Field label="Site" value={form.website} onChange={(v) => update("website", v)} />
            <Field label="Cidade" value={form.city} onChange={(v) => update("city", v)} />
            <Field label="Estado" value={form.state} onChange={(v) => update("state", v)} />
            <Field label="Endereço" value={form.address} onChange={(v) => update("address", v)} />
            <Field label="URL da logo" value={form.logo_url} onChange={(v) => update("logo_url", v)} />
            <Field label="URL da capa" value={form.cover_url} onChange={(v) => update("cover_url", v)} />
          </div>

          <label style={styles.label}>Descrição</label>
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} style={styles.textarea} rows={5} placeholder="Conte o que sua empresa oferece..." />

          <button disabled={saving} style={styles.primary}>{saving ? "Salvando..." : "Salvar perfil comercial"}</button>
        </form>

        <form onSubmit={addService} style={styles.card}>
          <h2>Adicionar serviço</h2>
          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>Categoria</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={styles.input}>
                {categories.length === 0 && <option value="">Nenhuma categoria cadastrada</option>}
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <Field label="Nome do serviço" value={serviceName} onChange={setServiceName} />
          </div>
          <label style={styles.label}>Descrição do serviço</label>
          <textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} style={styles.textarea} rows={3} placeholder="Descreva esse serviço..." />
          <button disabled={!business} style={styles.secondary}>Cadastrar serviço</button>
          {!business && <p style={styles.hint}>Primeiro salve o perfil comercial.</p>}
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
  content: { maxWidth: 1000, margin: "0 auto", padding: "48px 24px 80px" },
  heading: { marginBottom: 28 },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#4f46c7", background: "#ebe9ff", padding: "7px 10px", borderRadius: 999 },
  text: { color: "#687386", fontSize: 16, lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #e7e9f0", borderRadius: 16, padding: 28, marginBottom: 18 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#465066", marginBottom: 7 },
  input: { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #dfe2ea", borderRadius: 9, fontSize: 14, background: "#fff" },
  textarea: { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #dfe2ea", borderRadius: 9, fontSize: 14, resize: "vertical", fontFamily: "inherit", marginBottom: 18 },
  primary: { border: 0, background: "#4f46c7", color: "#fff", borderRadius: 9, padding: "12px 18px", fontWeight: 700, cursor: "pointer" },
  secondary: { border: "1px solid #4f46c7", background: "#fff", color: "#4f46c7", borderRadius: 9, padding: "11px 18px", fontWeight: 700, cursor: "pointer" },
  message: { background: "#fff", border: "1px solid #dfe2ea", borderRadius: 12, padding: 16, color: "#465066" },
  hint: { color: "#8a91a3", fontSize: 13 },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", color: "#687386", fontFamily: "Arial, sans-serif" },
};
