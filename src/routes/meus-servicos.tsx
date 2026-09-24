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
  const [isPaidPlan, setIsPaidPlan] = useState(false);
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
  const [messageType, setMessageType] = useState<"success" | "error">("error");
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
  const [showAvailability, setShowAvailability] = useState(false);
  const [availabilityDates, setAvailabilityDates] = useState<Array<{ id: string; availability_date: string; status: "available" | "unavailable" }>>([]);
  const [availabilityMonth, setAvailabilityMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

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
        const { data: activeSubscription } = await supabase
          .from("business_subscriptions")
          .select("plan:plans(price_cents)")
          .eq("business_id", loaded.id)
          .eq("status", "active")
          .maybeSingle();

        const activePlan = Array.isArray(activeSubscription?.plan)
          ? activeSubscription?.plan[0]
          : activeSubscription?.plan;
        setIsPaidPlan(Number(activePlan?.price_cents ?? 0) > 0);

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
        setShowAvailability(Boolean((loaded as Business & { show_availability?: boolean }).show_availability));
        await loadAvailability(loaded.id, mounted);
        await loadServices(loaded.id, mounted);
      }

      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function loadAvailability(businessId: string, mounted = true) {
    if (!supabase) return;
    const { data, error } = await supabase.from("provider_availability").select("id,availability_date,status").eq("business_id", businessId).order("availability_date");
    if (!mounted) return;
    if (error) {
      console.error("Erro ao carregar agenda:", error);
      setMessage("Não foi possível carregar a agenda: " + error.message);
      return;
    }
    setAvailabilityDates((data ?? []) as typeof availabilityDates);
  }

  async function toggleAvailabilityDate(date: string) {
    if (!supabase || !business || availabilitySaving) return;
    setAvailabilitySaving(true);
    const current = availabilityDates.find((item) => item.availability_date === date);
    const result = current
      ? await supabase.from("provider_availability").delete().eq("id", current.id).eq("business_id", business.id)
      : await supabase.from("provider_availability").insert({ business_id: business.id, availability_date: date, status: "unavailable" }).select("id,availability_date,status").single();
    if (result.error) {
      console.error("Erro ao alterar disponibilidade:", result.error);
      setMessage("Não foi possível atualizar a agenda: " + result.error.message);
      setAvailabilitySaving(false);
      return;
    }
    await loadAvailability(business.id);
    setMessageType("success");
    setMessage(current ? "Data liberada novamente na agenda." : "Data marcada como indisponível.");
    setAvailabilitySaving(false);
  }

  async function saveAvailabilityVisibility(value: boolean) {
    if (!supabase || !business || availabilitySaving) return;
    setAvailabilitySaving(true);
    const { error } = await supabase.from("business_profiles").update({ show_availability: value }).eq("id", business.id);
    if (error) {
      console.error("Erro ao atualizar visibilidade da agenda:", error);
      setMessageType("error");
      setMessage("Não foi possível atualizar a visibilidade da agenda: " + error.message);
      setAvailabilitySaving(false);
      return;
    }
    setShowAvailability(value);
    setMessageType("success");
    setMessage(value ? "Agenda pública ativada." : "Agenda pública desativada.");
    setAvailabilitySaving(false);
  }

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

    if (kind === "portfolio" && !isPaidPlan) {
      const currentPortfolioCount = form.portfolio_urls
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean).length;

      if (currentPortfolioCount >= 4) {
        setMessageType("error");
        setMessage("Você atingiu o limite de 4 fotos do seu portfólio no plano gratuito. Faça um upgrade para adicionar mais fotos.");
        return;
      }
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

async function geocodeAddress(address: string) {
  const query = encodeURIComponent(address);
  const response = await fetch(
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=" + query,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error("Serviço de localização indisponível.");
  const results = await response.json();
  const first = results?.[0];
  if (!first?.lat || !first?.lon) throw new Error("Coordenadas não encontradas.");
  return { latitude: Number(first.lat), longitude: Number(first.lon) };
}

async function lookupViaCep(cep: string) {
  const response = await fetch("https://viacep.com.br/ws/" + cep + "/json/");
  if (!response.ok) throw new Error("CEP não encontrado.");
  const data = await response.json();
  if (data.erro) throw new Error("CEP não encontrado.");
  return data;
}

  async function lookupCep(value: string): Promise<{ latitude: number; longitude: number } | null> {
    const cep = value.replace(/\D/g, "");
    update("cep", value);
    if (cep.length !== 8) return null;
    setCepLoading(true);
    setMessage("");
    try {
      let data: any;
      try {
        const response = await fetch("https://brasilapi.com.br/api/cep/v2/" + cep);
        if (!response.ok) throw new Error("BrasilAPI indisponível");
        data = await response.json();
        if (data.erro) throw new Error("CEP não encontrado.");
      } catch {
        data = await lookupViaCep(cep);
      }

      const street = data.street ?? data.logradouro ?? data.address ?? "";
      const neighborhood = data.neighborhood ?? data.bairro ?? "";
      const city = data.city ?? data.localidade ?? "";
      const state = data.state ?? data.uf ?? "";
      update("address", street);
      update("bairro", neighborhood);
      update("city", city);
      update("state", state);

      let coordinates: { latitude: number; longitude: number } | null = null;
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        coordinates = { latitude: data.latitude, longitude: data.longitude };
      } else {
        try {
          const address = [street, neighborhood, city, state, "Brasil"].filter(Boolean).join(", ");
          coordinates = await geocodeAddress(address);
        } catch {
          // CEP válido é suficiente para salvar o cadastro; coordenadas podem ser obtidas depois.
        }
      }

      setCoordinates(coordinates ?? { latitude: null, longitude: null });
      setMessage(
        coordinates
          ? "CEP localizado. Dados e localização foram preenchidos automaticamente."
          : "CEP localizado. Os dados foram preenchidos; a localização por distância poderá ser configurada depois.",
      );
      return coordinates;
    } catch (error) {
      setCoordinates({ latitude: null, longitude: null });
      setMessage(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
      return null;
    } finally {
      setCepLoading(false);
    }
  }

  async function saveBusiness(event: FormEvent) {
    event.preventDefault();

    if (!supabase || !user) return;

    if (!form.business_name.trim()) {
      setMessageType("error");
      setMessage("Informe o nome comercial.");
      return;
    }

    const normalizedCep = form.cep.replace(/\D/g, "");
    if (normalizedCep.length !== 8) {
      setMessageType("error");
      setMessage("Informe um CEP válido com 8 dígitos.");
      return;
    }

    let saveCoordinates = coordinates;
    if (saveCoordinates.latitude === null || saveCoordinates.longitude === null) {
      await lookupCep(form.cep);
      saveCoordinates = coordinates;
    }

    if (!form.bairro.trim() || !form.city.trim() || !form.state.trim()) {
      setMessageType("error");
      setMessage("Informe CEP, bairro, cidade e estado.");
      return;
    }

    setSaving(true);
    setMessageType("error");
    setMessage("");

    const normalizedName = form.business_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (!isPaidPlan) {
      const portfolioCount = form.portfolio_urls
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean).length;

      if (portfolioCount > 4) {
        setMessageType("error");
        setMessage("Seu plano gratuito permite até 4 fotos no portfólio. Faça um upgrade para adicionar mais fotos.");
        setSaving(false);
        return;
      }
    }

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
      latitude: saveCoordinates.latitude,
      longitude: saveCoordinates.longitude,
    };

    const result = business
      ? await supabase.from("business_profiles").update(payload).eq("id", business.id).select("*").single()
      : await supabase.from("business_profiles").insert(payload).select("*").single();

    if (result.error) {
      console.error("Erro ao salvar perfil da empresa:", result.error);
      setMessageType("error");
      setMessage("Não foi possível salvar as informações da empresa: " + result.error.message);
      setSaving(false);
      return;
    }

    if (!result.data) {
      console.error("Perfil da empresa não foi retornado após o salvamento.");
      setMessageType("error");
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
    setMessageType("success");
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
          {message && (
            <div className={`business-message business-message-${messageType}`} role="status">
              {message}
            </div>
          )}
        </form>

        {business && (
          <section className="business-services-card provider-availability-manager">
            <div className="business-services-head">
              <div>
                <div className="profile-badge">AGENDA</div>
                <h2 className="business-section-title no-top">Minha disponibilidade</h2>
                <p className="profile-page-text">Escolha as datas em que você estará indisponível. Quando a agenda pública estiver ativa, os clientes verão apenas as datas livres.</p>
              </div>
            </div>
            <div className="provider-availability-visibility">
              <div>
                <strong>Exibir disponibilidade no meu perfil público</strong>
                <span>{showAvailability ? "Ativado — clientes podem consultar sua agenda." : "Desativado — sua agenda fica somente para você."}</span>
              </div>
              <button type="button" className={showAvailability ? "availability-toggle active" : "availability-toggle"} onClick={() => saveAvailabilityVisibility(!showAvailability)} disabled={availabilitySaving}>
                {showAvailability ? "Ativado" : "Desativado"}
              </button>
            </div>
            <div className="availability-calendar-head">
              <button type="button" className="business-small-button" onClick={() => setAvailabilityMonth(new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth() - 1, 1))}>←</button>
              <strong>{availabilityMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
              <button type="button" className="business-small-button" onClick={() => setAvailabilityMonth(new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth() + 1, 1))}>→</button>
            </div>
            <div className="availability-weekdays">{["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="availability-calendar-grid">
              {(() => {
                const year = availabilityMonth.getFullYear();
                const month = availabilityMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const cells = [];
                for (let i = 0; i < firstDay; i++) cells.push(<span key={"empty-" + i} className="availability-day empty" />);
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
                  const unavailable = availabilityDates.some((item) => item.availability_date === date);
                  cells.push(<button key={date} type="button" className={"availability-day " + (unavailable ? "unavailable" : "available")} onClick={() => toggleAvailabilityDate(date)} disabled={availabilitySaving} title={unavailable ? "Clique para liberar esta data" : "Clique para marcar como indisponível"}><strong>{day}</strong><small>{unavailable ? "Ocupado" : "Livre"}</small></button>);
                }
                return cells;
              })()}
            </div>
            <div className="availability-legend"><span><i className="available-dot" /> Livre</span><span><i className="unavailable-dot" /> Indisponível</span></div>
          </section>
        )}

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

