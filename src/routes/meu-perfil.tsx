import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Category = { id: string; name: string };
type Service = { id: string; name: string; description: string | null; category_id: string; category_name: string | null };
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
  slug: string;
  approval_status: "pending" | "approved" | "rejected";
  portfolio_urls: string[];
};

export const Route = createFileRoute("/meu-perfil")({
  component: BusinessProfilePage,
});

function BusinessProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | "portfolio" | null>(null);
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
    portfolio_urls: "",
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

      if (loaded) {
        await loadServices(loaded.id, mounted);
      }
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
          portfolio_urls: (loaded.portfolio_urls ?? []).join("\n"),
        });
      }

      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function loadServices(businessId: string, mounted = true) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("services")
      .select("id,name,description,category_id,categories(name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (!mounted) return;
    if (error) {
      setMessage("Não foi possível carregar os serviços: " + error.message);
      return;
    }

    const mapped = (data ?? []).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category_id: item.category_id,
      category_name: item.categories?.name ?? null,
    })) as Service[];
    setServices(mapped);
  }

  async function uploadImage(file: File, kind: "logo" | "cover" | "portfolio") {
    if (!supabase || !user) {
      setMessage("Entre na sua conta para enviar imagens.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setMessage("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(kind);
    setMessage("");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = user.id + "/" + kind + "-" + crypto.randomUUID() + "." + extension;
    const { error: uploadError } = await supabase.storage.from("provider-media").upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      setMessage("Não foi possível enviar a imagem: " + uploadError.message);
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from("provider-media").getPublicUrl(path);
    if (kind === "logo") update("logo_url", data.publicUrl);
    if (kind === "cover") update("cover_url", data.publicUrl);
    if (kind === "portfolio") {
      const urls = form.portfolio_urls.split("\n").map((url) => url.trim()).filter(Boolean);
      update("portfolio_urls", [...urls, data.publicUrl].slice(0, 12).join("\n"));
    }
    setMessage("Imagem enviada. Salve o perfil para confirmar as alterações.");
    setUploading(null);
  }

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

      const normalizedName = form.business_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const payload = {
      owner_id: user.id,
      approval_status: business?.approval_status === "rejected" ? "pending" : business?.approval_status ?? "pending",
      business_name: form.business_name.trim(),
      slug: business?.id
        ? business.slug
        : normalizedName + "-" + crypto.randomUUID().slice(0, 8),
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
      portfolio_urls: form.portfolio_urls.split("\n").map((url) => url.trim()).filter((url) => /^https?:\/\//i.test(url)).slice(0, 12),
    };

    const result = business
      ? await supabase.from("business_profiles").update(payload).eq("id", business.id).select("*").single()
      : await supabase.from("business_profiles").insert(payload).select("*").single();

    if (result.error) {
      setMessage("Não foi possível salvar o perfil: " + result.error.message);
    } else {
      const savedBusiness = result.data as Business;
      setBusiness(savedBusiness);
      await loadServices(savedBusiness.id);
      setMessage(
        business?.approval_status === "rejected"
          ? "Alterações salvas e enviadas para nova análise."
          : "Perfil comercial salvo com sucesso."
      );
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
    await loadServices(business.id);
    setMessage("Serviço cadastrado.");
  }

  function startEditService(service: Service) {
    setEditingServiceId(service.id);
    setServiceName(service.name);
    setServiceDescription(service.description ?? "");
    setCategoryId(service.category_id);
  }

  function cancelEditService() {
    setEditingServiceId(null);
    setServiceName("");
    setServiceDescription("");
    if (categories[0]) setCategoryId(categories[0].id);
  }

  async function saveService(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !business || !editingServiceId || !categoryId || !serviceName.trim()) {
      setMessage("Informe categoria e nome do serviço.");
      return;
    }

    const { error } = await supabase
      .from("services")
      .update({
        category_id: categoryId,
        name: serviceName.trim(),
        description: serviceDescription.trim() || null,
      })
      .eq("id", editingServiceId)
      .eq("business_id", business.id);

    if (error) {
      setMessage("Não foi possível atualizar o serviço: " + error.message);
      return;
    }

    cancelEditService();
    await loadServices(business.id);
    setMessage("Serviço atualizado.");
  }

  async function deleteService(service: Service) {
    if (!supabase || !business) return;
    const confirmed = window.confirm(`Excluir o serviço "${service.name}"?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", service.id)
      .eq("business_id", business.id);

    if (error) {
      setMessage("Não foi possível excluir o serviço: " + error.message);
      return;
    }

    if (editingServiceId === service.id) cancelEditService();
    await loadServices(business.id);
    setMessage("Serviço excluído.");
  }

  if (loading) return <main style={styles.center}>Carregando seu perfil...</main>;

  const onboardingStep = !business ? 1 : services.length === 0 ? 2 : 3;

  return (
    <main className="profile-page" style={styles.page}>
      <header className="profile-header" style={styles.header}>
        <button onClick={() => navigate({ to: "/painel" })} style={styles.back}>← Painel</button>
        <div style={styles.logo}>LOSI <span>CONECTA</span></div>
      </header>

      <section className="profile-content" style={styles.content}>
        <div style={styles.heading}>
          <div>
            <div style={styles.badge}>PERFIL COMERCIAL</div>
            <h1>Apresente sua empresa</h1>
            <p style={styles.text}>Essas informações serão usadas no seu perfil público dentro do LOSI CONECTA.</p>
            {business && <div style={styles.statusBox}><strong>Status do perfil:</strong> {business.approval_status === "approved" ? "Aprovado e publicado" : business.approval_status === "rejected" ? "Rejeitado — revise os dados e aguarde nova análise" : "Aguardando aprovação da administração"}</div>}
          </div>
        </div>

        <div className="onboarding-steps" style={styles.steps}>
          <Step number="1" title="Perfil comercial" active={onboardingStep === 1} done={onboardingStep > 1} />
          <Step number="2" title="Primeiro serviço" active={onboardingStep === 2} done={onboardingStep > 2} />
          <Step number="3" title="Enviar para análise" active={onboardingStep === 3} done={false} />
        </div>

        <form onSubmit={saveProfile} style={styles.card}>
          <h2>Informações da empresa</h2>
          <div className="profile-form-grid" style={styles.formGrid}>
            <Field label="Nome comercial *" value={form.business_name} onChange={(v) => update("business_name", v)} />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => update("whatsapp", v)} />
            <Field label="Telefone" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field label="Instagram" value={form.instagram} onChange={(v) => update("instagram", v)} />
            <Field label="Site" value={form.website} onChange={(v) => update("website", v)} />
            <Field label="Cidade" value={form.city} onChange={(v) => update("city", v)} />
            <Field label="Estado" value={form.state} onChange={(v) => update("state", v)} />
            <Field label="Endereço" value={form.address} onChange={(v) => update("address", v)} />
            <div>
              <Field label="URL da logo" value={form.logo_url} onChange={(v) => update("logo_url", v)} />
              <label style={styles.uploadButton}>
                {uploading === "logo" ? "Enviando..." : "Enviar logo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading !== null} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file, "logo"); e.currentTarget.value = ""; }} />
              </label>
            </div>
            <div>
              <Field label="URL da capa" value={form.cover_url} onChange={(v) => update("cover_url", v)} />
              <label style={styles.uploadButton}>
                {uploading === "cover" ? "Enviando..." : "Enviar capa"}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading !== null} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file, "cover"); e.currentTarget.value = ""; }} />
              </label>
            </div>
          </div>

          <label style={styles.label}>Portfólio de imagens</label>
          <textarea value={form.portfolio_urls} onChange={(e) => update("portfolio_urls", e.target.value)} style={styles.textarea} rows={4} placeholder={"Cole uma URL de imagem por linha. Ex.: https://site.com/foto.jpg"} />
          <p style={styles.hint}>Até 12 imagens. Você pode enviar arquivos diretamente ou colar links públicos.</p>
          <label style={styles.uploadButton}>
            {uploading === "portfolio" ? "Enviando imagem..." : "Adicionar imagem ao portfólio"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading !== null} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file, "portfolio"); e.currentTarget.value = ""; }} />
          </label>

          <label style={styles.label}>Descrição</label>
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} style={styles.textarea} rows={5} placeholder="Conte o que sua empresa oferece..." />

          <button disabled={saving} style={styles.primary}>{saving ? "Salvando..." : "Salvar perfil comercial"}</button>
        </form>

        <form onSubmit={editingServiceId ? saveService : addService} style={styles.card}>
          <h2>{editingServiceId ? "Editar serviço" : "Adicione seu primeiro serviço"}</h2>
          {!business && <p style={styles.hint}>Salve o perfil comercial acima para liberar o cadastro de serviços.</p>}
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
          <div style={styles.actions}>
            <button disabled={!business} style={styles.secondary}>{editingServiceId ? "Salvar alterações" : "Cadastrar serviço"}</button>
            {editingServiceId && <button type="button" onClick={cancelEditService} style={styles.cancel}>Cancelar</button>}
          </div>
          {!business && <p style={styles.hint}>Primeiro salve o perfil comercial.</p>}
        </form>

        {business && services.length > 0 && (
          <section style={styles.nextStep}>
            <div>
              <strong>Seu perfil já está estruturado.</strong>
              <p style={styles.text}>Agora a administração precisa analisar seus dados. Enquanto aguarda, você pode continuar ajustando seus serviços e informações.</p>
            </div>
            <button type="button" onClick={() => navigate({ to: "/painel" })} style={styles.primary}>Voltar ao painel</button>
          </section>
        )}

        <section style={styles.card}>
          <div style={styles.servicesHeader}>
            <div>
              <h2 style={{ marginBottom: 6 }}>Meus serviços</h2>
              <p style={styles.text}>Os serviços ativos aparecem automaticamente no seu perfil público e no catálogo.</p>
            </div>
            <span style={styles.count}>{services.length}</span>
          </div>

          {services.length === 0 ? (
            <div style={styles.empty}>Nenhum serviço cadastrado ainda.</div>
          ) : (
            <div style={styles.serviceList}>
              {services.map((service) => (
                <article key={service.id} style={styles.serviceItem}>
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.serviceCategory}>{service.category_name ?? "Sem categoria"}</div>
                    <h3 style={styles.serviceTitle}>{service.name}</h3>
                    {service.description && <p style={styles.serviceDescription}>{service.description}</p>}
                  </div>
                  <div style={styles.serviceActions}>
                    <button type="button" onClick={() => startEditService(service)} style={styles.smallButton}>Editar</button>
                    <button type="button" onClick={() => deleteService(service)} style={styles.deleteButton}>Excluir</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {business && <button type="button" onClick={() => navigate({ to: "/fornecedor/$slug", params: { slug: business.slug } })} style={styles.publicButton}>Ver meu perfil público →</button>}

        {message && <div style={styles.message}>{message}</div>}
      </section>
    </main>
  );
}

function Step({ number, title, active, done }: { number: string; title: string; active: boolean; done: boolean }) {
  return (
    <div className={active ? "onboarding-step active" : "onboarding-step"} style={styles.step}>
      <span style={done ? styles.stepNumberDone : active ? styles.stepNumberActive : styles.stepNumber}>{done ? "✓" : number}</span>
      <span style={active ? styles.stepTitleActive : styles.stepTitle}>{title}</span>
    </div>
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
  statusBox: { marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "#f3f4ff", border: "1px solid #dfe0ff", color: "#4f46c7", fontSize: 14 },
  steps: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 22 },
  step: { background: "#fff", border: "1px solid #e7e9f0", borderRadius: 12, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 },
  stepNumber: { width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", background: "#f1f2f6", color: "#7b8292", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  stepNumberActive: { width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", background: "#ebe9ff", color: "#4f46c7", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  stepNumberDone: { width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", background: "#eaf7ef", color: "#237345", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  stepTitle: { color: "#7b8292", fontSize: 13, fontWeight: 700 },
  stepTitleActive: { color: "#172033", fontSize: 13, fontWeight: 800 },
  nextStep: { marginBottom: 18, background: "#fff", border: "1px solid #dfe2ea", borderRadius: 16, padding: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#4f46c7", background: "#ebe9ff", padding: "7px 10px", borderRadius: 999 },
  text: { color: "#687386", fontSize: 16, lineHeight: 1.5 },
  card: { background: "#fff", border: "1px solid #e7e9f0", borderRadius: 16, padding: 28, marginBottom: 18 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18, marginBottom: 18 },
  actions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  cancel: { border: "1px solid #dfe2ea", background: "#fff", color: "#566074", borderRadius: 9, padding: "11px 18px", fontWeight: 700, cursor: "pointer" },
  servicesHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 },
  count: { minWidth: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", background: "#ebe9ff", color: "#4f46c7", fontWeight: 800 },
  empty: { border: "1px dashed #dfe2ea", borderRadius: 12, padding: 22, color: "#8a91a3", textAlign: "center" },
  serviceList: { display: "grid", gap: 10 },
  serviceItem: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, padding: 16, border: "1px solid #e7e9f0", borderRadius: 12 },
  serviceCategory: { fontSize: 11, fontWeight: 800, color: "#4f46c7", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 },
  serviceTitle: { margin: 0, fontSize: 16 },
  serviceDescription: { margin: "6px 0 0", color: "#687386", fontSize: 13, lineHeight: 1.45 },
  serviceActions: { display: "flex", gap: 8, flexShrink: 0 },
  smallButton: { border: "1px solid #dfe2ea", background: "#fff", color: "#4f46c7", borderRadius: 8, padding: "8px 11px", fontWeight: 700, cursor: "pointer" },
  deleteButton: { border: "1px solid #f0d7d7", background: "#fff", color: "#b44747", borderRadius: 8, padding: "8px 11px", fontWeight: 700, cursor: "pointer" },
  publicButton: { display: "block", margin: "4px auto 0", border: 0, background: "transparent", color: "#4f46c7", fontWeight: 800, cursor: "pointer" },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#465066", marginBottom: 7 },
  input: { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #dfe2ea", borderRadius: 9, fontSize: 14, background: "#fff" },
  textarea: { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #dfe2ea", borderRadius: 9, fontSize: 14, resize: "vertical", fontFamily: "inherit", marginBottom: 18 },
  primary: { border: 0, background: "#4f46c7", color: "#fff", borderRadius: 9, padding: "12px 18px", fontWeight: 700, cursor: "pointer" },
  secondary: { border: "1px solid #4f46c7", background: "#fff", color: "#4f46c7", borderRadius: 9, padding: "11px 18px", fontWeight: 700, cursor: "pointer" },
  message: { background: "#fff", border: "1px solid #dfe2ea", borderRadius: 12, padding: 16, color: "#465066" },
  hint: { color: "#8a91a3", fontSize: 13 },
  uploadButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: -8, marginBottom: 16, padding: "9px 13px", border: "1px solid #dfe2ea", borderRadius: 9, background: "#fff", color: "#4f46c7", fontSize: 13, fontWeight: 800, cursor: "pointer" },
  center: { minHeight: "100vh", display: "grid", placeItems: "center", color: "#687386", fontFamily: "Arial, sans-serif" },
};
