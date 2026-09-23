import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Category = { id: string; name: string };
type Service = {
  id: string;
  name: string;
  description: string | null;
  category_id: string;
  category_name: string | null;
};
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
  cep: string | null;
  bairro: string | null;
  address: string | null;
  logo_url: string | null;
  cover_url: string | null;
  slug: string;
  approval_status: "pending" | "approved" | "rejected";
  portfolio_urls: string[];
  latitude: number | null;
  longitude: number | null;
};

export const Route = createFileRoute("/meus-servicos")({
  component: BusinessServicesPage,
});

function BusinessServicesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | "portfolio" | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [coordinates, setCoordinates] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: null,
    longitude: null,
  });
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
    cep: "",
    bairro: "",
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

      if (businessResult.error) {
        console.error("Erro ao carregar empresa do fornecedor:", businessResult.error);
        setMessage("Não foi possível carregar os dados da empresa: " + businessResult.error.message);
      }

      if (categoryResult.error) {
        console.error("Erro ao carregar categorias dos serviços:", categoryResult.error);
        setMessage((current) =>
          current || "Não foi possível carregar as categorias dos serviços: " + categoryResult.error.message
        );
      }

      const loaded = businessResult.data as Business | null;
      setUser(currentUser);
      setBusiness(loaded);
      setCategories(categoryResult.data ?? []);
      setCategoryId(categoryResult.data?.[0]?.id ?? "");

      if (loaded) {
        setCoordinates({
          latitude: loaded.latitude ?? null,
          longitude: loaded.longitude ?? null,
        });
        setForm({
          business_name: loaded.business_name ?? "",
          description: loaded.description ?? "",
          phone: loaded.phone ?? "",
          whatsapp: loaded.whatsapp ?? "",
          website: loaded.website ?? "",
          instagram: loaded.instagram ?? "",
          city: loaded.city ?? "",
          state: loaded.state ?? "",
          cep: loaded.cep ?? "",
          bairro: loaded.bairro ?? "",
          address: loaded.address ?? "",
          logo_url: loaded.logo_url ?? "",
          cover_url: loaded.cover_url ?? "",
          portfolio_urls: (loaded.portfolio_urls ?? []).join("\n"),
        });
        await loadServices(loaded.id, mounted);
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

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
      console.error("Erro ao enviar mídia do fornecedor:", uploadError);
      setMessage("Não foi possível enviar a imagem: " + uploadError.message);
      setUploading(null);
      return;
    }

    const { data } = supabase.storage.from("provider-media").getPublicUrl(path);

    if (!data?.publicUrl) {
      console.error("Upload concluído, mas a URL pública não foi gerada.");
      setMessage("A imagem foi enviada, mas não foi possível gerar o endereço público.");
      setUploading(null);
      return;
    }

    if (kind === "logo") update("logo_url", data.publicUrl);
    if (kind === "cover") update("cover_url", data.publicUrl);

    if (kind === "portfolio") {
      const urls = form.portfolio_urls.split("\n").map((url) => url.trim()).filter(Boolean);
      update("portfolio_urls", [...urls, data.publicUrl].slice(0, 12).join("\n"));
    }

    setMessage("Imagem enviada. Salve as informações da empresa para confirmar.");
    setUploading(null);
  }

  async function lookupCep(value: string) {
    const cep = value.replace(/\D/g, "");
    update("cep", value);
    if (cep.length !== 8) return;
    setCepLoading(true);
    setMessage("");
    try {
      const response = await fetch("https://brasilapi.com.br/api/cep/v2/" + cep);
      if (!response.ok) throw new Error("CEP não encontrado.");
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado.");
      update("address", data.street ?? data.address ?? "");
      update("bairro", data.neighborhood ?? "");
      update("city", data.city ?? "");
      update("state", data.state ?? "");
      setCoordinates({
        latitude: typeof data.latitude === "number" ? data.latitude : null,
        longitude: typeof data.longitude === "number" ? data.longitude : null,
      });
      setMessage("CEP localizado. Cidade, bairro, estado e coordenadas foram preenchidos automaticamente.");
    } catch (error) {
      setCoordinates({ latitude: null, longitude: null });
      setMessage(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  async function saveBusiness(event: FormEvent) {
    event.preventDefault();

    if (!supabase || !user) return;

    if (!form.business_name.trim()) {
      setMessage("Informe o nome comercial.");
      return;
    }

    const normalizedCep = form.cep.replace(/\D/g, "");
    if (normalizedCep.length !== 8 || !form.bairro.trim() || !form.city.trim() || !form.state.trim()) {
      setMessage("Para publicar a empresa, informe CEP, bairro, cidade e estado.");
      return;
    }
    if (coordinates.latitude === null || coordinates.longitude === null) {
      setMessage("Consulte o CEP novamente para gerar a localização usada no filtro por distância.");
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
      approval_status:
        business?.approval_status === "rejected"
          ? "pending"
          : business?.approval_status ?? "pending",
      business_name: form.business_name.trim(),
      slug: business?.id
        ? business.slug
        : normalizedName + "-" + crypto.randomUUID().slice(0, 8),
      description: form.description.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      website: form.website.trim() || null,
      instagram: form.instagram.trim() || null,
      city: form.city.trim(),
      state: form.state.trim(),
      cep: normalizedCep,
      bairro: form.bairro.trim(),
      address: form.address.trim() || null,
      logo_url: form.logo_url.trim() || null,
      cover_url: form.cover_url.trim() || null,
      portfolio_urls: form.portfolio_urls
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => /^https?:\/\//i.test(url))
        .slice(0, 12),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };

    const result = business
      ? await supabase.from("business_profiles").update(payload).eq("id", business.id).select("*").single()
      : await supabase.from("business_profiles").insert(payload).select("*").single();

    if (result.error) {
      console.error("Erro ao salvar perfil da empresa:", result.error);
      setMessage("Não foi possível salvar as informações da empresa: " + result.error.message);
      setSaving(false);
      return;
    }

    if (!result.data) {
      console.error("Perfil da empresa não foi retornado após o salvamento.");
      setMessage("As informações foram enviadas, mas não foi possível confirmar o cadastro.");
      setSaving(false);
      return;
    }

    const savedBusiness = result.data as Business;
    setBusiness(savedBusiness);
    setCoordinates({
      latitude: savedBusiness.latitude ?? null,
      longitude: savedBusiness.longitude ?? null,
    });

    await loadServices(savedBusiness.id);
    setMessage(
      business?.approval_status === "rejected"
        ? "Alterações salvas e enviadas para nova análise."
        : "Informações da empresa salvas com sucesso."
    );
    setSaving(false);
  }

  async function saveService(event: FormEvent) {
    event.preventDefault();

    if (!supabase || !business || !editingServiceId || !categoryId || !serviceName.trim()) {
      setMessage("Informe categoria e nome do serviço.");
      return;
    }

    const { data: updatedService, error } = await supabase
      .from("services")
      .update({
        category_id: categoryId,
        name: serviceName.trim(),
        description: serviceDescription.trim().slice(0, 150) || null,
      })
      .eq("id", editingServiceId)
      .eq("business_id", business.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Erro ao atualizar serviço:", error);
      setMessage("Não foi possível atualizar o serviço: " + error.message);
      return;
    }

    if (!updatedService) {
      console.error("Atualização do serviço não afetou nenhum registro.");
      setMessage("O serviço não foi encontrado ou não pertence à sua empresa.");
      return;
    }

    cancelEditService();
    await loadServices(business.id);
    setMessage("Serviço atualizado com sucesso.");
  }

  async function addService(event: FormEvent) {
    event.preventDefault();

    if (!supabase || !business || !categoryId || !serviceName.trim()) {
      setMessage("Salve as informações da empresa e informe categoria e nome do serviço.");
      return;
    }

    const { data: createdService, error } = await supabase
      .from("services")
      .insert({
        business_id: business.id,
        category_id: categoryId,
        name: serviceName.trim(),
        description: serviceDescription.trim().slice(0, 150) || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Erro ao cadastrar serviço:", error);
      setMessage("Não foi possível cadastrar o serviço: " + error.message);
      return;
    }

    if (!createdService) {
      setMessage("O serviço não pôde ser confirmado após o cadastro.");
      return;
    }

    setServiceName("");
    setServiceDescription("");
    await loadServices(business.id);
    setMessage("Serviço cadastrado com sucesso.");
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

  async function deleteService(service: Service) {
    if (!supabase || !business) return;

    const confirmed = window.confirm(`Excluir o serviço "${service.name}"?`);
    if (!confirmed) return;

    const { data: deletedService, error } = await supabase
      .from("services")
      .delete()
      .eq("id", service.id)
      .eq("business_id", business.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Erro ao excluir serviço:", error);
      setMessage("Não foi possível excluir o serviço: " + error.message);
      return;
    }

    if (!deletedService) {
      console.error("Exclusão do serviço não afetou nenhum registro.");
      setMessage("O serviço não foi encontrado ou não pertence à sua empresa.");
      return;
    }

    if (editingServiceId === service.id) cancelEditService();
    await loadServices(business.id);
    setMessage("Serviço excluído com sucesso.");
  }

  if (loading) return <main className="business-services-loading">Carregando seus serviços...</main>;

  const onboardingStep = !business ? 1 : services.length === 0 ? 2 : 3;

  return (
    <main className="profile-page business-services-page">
      <header className="profile-header business-services-header">
        <button className="profile-back" onClick={() => navigate({ to: "/painel" })}>← Voltar ao painel</button>
        <div className="profile-logo mobile-centered-brand">LOSI <span>CONECTA</span></div>
      </header>

      <section className="profile-content business-services-content">
        <div className="business-services-heading">
          <div>
            <div className="profile-badge">EMPRESA E SERVIÇOS</div>
            <h1>Meus serviços</h1>
            <p className="profile-page-text">
              Atualize as informações da sua empresa e os serviços que serão exibidos no seu perfil público.
            </p>
            {business && (
              <div className="business-status-box">
                <strong>Status do perfil:</strong>{" "}
                {business.approval_status === "approved"
                  ? "Aprovado e publicado"
                  : business.approval_status === "rejected"
                    ? "Rejeitado — revise os dados e aguarde nova análise"
                    : "Aguardando aprovação da administração"}
              </div>
            )}
          </div>
        </div>

        <div className="onboarding-steps">
          <Step number="1" title="Empresa" active={onboardingStep === 1} done={onboardingStep > 1} />
          <Step number="2" title="Serviços" active={onboardingStep === 2} done={onboardingStep > 2} />
          <Step number="3" title="Análise" active={onboardingStep === 3} done={false} />
        </div>

        <form onSubmit={saveBusiness} className="business-services-card">
          <h2>Informações da empresa</h2>
          <div className="profile-form-grid business-services-form-grid">
            <Field label="Nome comercial *" value={form.business_name} onChange={(v) => update("business_name", v)} />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => update("whatsapp", v)} />
            <Field label="Telefone comercial" value={form.phone} onChange={(v) => update("phone", v)} />
            <Field label="Instagram" value={form.instagram} onChange={(v) => update("instagram", v)} />
            <Field label="Site" value={form.website} onChange={(v) => update("website", v)} />
            <div>
              <Field label="CEP *" value={form.cep} onChange={(v) => update("cep", v)} />
              <button
                type="button"
                onClick={() => lookupCep(form.cep)}
                disabled={cepLoading}
                className="business-location-button"
              >
                {cepLoading ? "Consultando CEP..." : coordinates.latitude !== null ? "Localização por CEP ✓" : "Consultar CEP"}
              </button>
            </div>
            <Field label="Bairro *" value={form.bairro} onChange={(v) => update("bairro", v)} />
            <Field label="Cidade *" value={form.city} onChange={(v) => update("city", v)} />
            <Field label="Estado *" value={form.state} onChange={(v) => update("state", v)} />
            <div>
              <Field label="Endereço" value={form.address} onChange={(v) => update("address", v)} />
              <p className="business-hint">A localização usada no filtro por distância vem do CEP cadastrado, não do GPS do celular.</p>
            </div>

            <div>
              <Field label="URL da logo" value={form.logo_url} onChange={(v) => update("logo_url", v)} />
              <p className="business-hint business-image-dimension-hint">Recomendado: <strong>600 × 600 px</strong> (quadrada). No perfil aparece em <strong>110 × 110 px</strong>.</p>
              <label className="business-upload-button">
                {uploading === "logo" ? "Enviando..." : "Enviar logo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, "logo");
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div>
              <Field label="URL da capa" value={form.cover_url} onChange={(v) => update("cover_url", v)} />
              <p className="business-hint business-image-dimension-hint">Recomendado: <strong>1600 × 600 px</strong> (horizontal). A capa é exibida em área ampla e pode ser recortada.</p>
              <label className="business-upload-button">
                {uploading === "cover" ? "Enviando..." : "Enviar capa"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, "cover");
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <label className="business-field-label">Portfólio de imagens</label>
          <textarea
            value={form.portfolio_urls}
            onChange={(e) => update("portfolio_urls", e.target.value)}
            className="business-textarea"
            rows={4}
            placeholder="Cole uma URL de imagem por linha. Ex.: https://site.com/foto.jpg"
          />
          <p className="business-hint business-image-dimension-hint">Até 12 imagens. Recomendado: <strong>1200 × 900 px</strong> ou maior. Você pode enviar arquivos diretamente ou colar links públicos.</p>
          <label className="business-upload-button">
            {uploading === "portfolio" ? "Enviando imagem..." : "Adicionar imagem ao portfólio"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              disabled={uploading !== null}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                for (const file of files.slice(0, 12)) await uploadImage(file, "portfolio");
                e.currentTarget.value = "";
              }}
            />
          </label>

          <label className="business-field-label">Descrição da empresa</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="business-textarea"
            rows={5}
            placeholder="Conte o que sua empresa oferece..."
          />

          <button className="business-primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar informações da empresa"}
          </button>
        </form>

        <form onSubmit={editingServiceId ? saveService : addService} className="business-services-card">
          <div className="business-services-head">
            <div>
              <div className="profile-badge">SERVIÇOS</div>
              <h2 className="business-section-title">
                {editingServiceId ? "Editar serviço" : "Adicionar serviço"}
              </h2>
              <p className="profile-page-text">Cada descrição de serviço pode ter no máximo 150 caracteres.</p>
            </div>
            <span className="business-count">{services.length}</span>
          </div>

          <div className="business-services-form-grid">
            <div>
              <label className="business-field-label">Categoria</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="business-field-input">
                {categories.length === 0 && <option value="">Nenhuma categoria cadastrada</option>}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <Field label="Nome do serviço" value={serviceName} onChange={setServiceName} />
          </div>

          <label className="business-field-label">Descrição do serviço</label>
          <textarea
            value={serviceDescription}
            maxLength={150}
            onChange={(e) => setServiceDescription(e.target.value.slice(0, 150))}
            className="business-textarea"
            rows={3}
            placeholder="Descreva esse serviço..."
          />
          <div className="business-actions">
            <button disabled={!business} className="business-secondary">
              {editingServiceId ? "Salvar alterações" : "Cadastrar serviço"}
            </button>
            {editingServiceId && (
              <button type="button" onClick={cancelEditService} className="business-cancel">Cancelar</button>
            )}
          </div>
          {!business && <p className="business-hint">Primeiro salve as informações da empresa.</p>}
        </form>

        <section className="business-services-card">
          <div className="business-services-head">
            <div>
              <h2 className="business-section-title no-top">Serviços cadastrados</h2>
              <p className="profile-page-text">Eles aparecem no seu perfil público e nas buscas do LOSI CONECTA.</p>
            </div>
            <span className="business-count">{services.length}</span>
          </div>

          {services.length === 0 ? (
            <div className="business-empty">Nenhum serviço cadastrado ainda.</div>
          ) : (
            <div className="business-service-list">
              {services.map((service) => (
                <article key={service.id} className="business-service-item">
                  <div className="business-service-main">
                    <div className="business-service-category">{service.category_name ?? "Sem categoria"}</div>
                    <h3 className="business-service-title">{service.name}</h3>
                    {service.description && <p className="business-service-description">{service.description}</p>}
                  </div>
                  <div className="business-service-actions">
                    <button type="button" onClick={() => startEditService(service)} className="business-small-button">Editar</button>
                    <button type="button" onClick={() => deleteService(service)} className="business-delete-button">Excluir</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {business && (
          <div className="business-bottom-actions">
            <button
              type="button"
              onClick={() => navigate({ to: "/fornecedor/$slug", params: { slug: business.slug } })}
              className="business-public-button"
            >
              Ver meu perfil público →
            </button>
          </div>
        )}

        {message && <div className="business-message">{message}</div>}
      </section>
    </main>
  );
}

function Step({ number, title, active, done }: { number: string; title: string; active: boolean; done: boolean }) {
  return (
    <div className={active ? "onboarding-step active" : "onboarding-step"}>
      <span className={done ? "business-step-number done" : active ? "business-step-number active" : "business-step-number"}>
        {done ? "✓" : number}
      </span>
      <span className={active ? "business-step-title active" : "business-step-title"}>{title}</span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="business-field-label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="business-field-input" />
    </div>
  );
}

