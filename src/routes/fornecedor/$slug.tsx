import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Service = { id: string; name: string; description: string | null; categories: { name: string } | null };
type Business = {
  id: string; business_name: string; slug: string; description: string | null;
  whatsapp: string | null; phone: string | null; instagram: string | null; website: string | null;
  city: string | null; state: string | null; address: string | null; logo_url: string | null;
  cover_url: string | null; verified: boolean; services: Service[];
};

export const Route = createFileRoute("/fornecedor/$slug")({
  component: ProviderPage,
});

function ProviderPage() {
  const { slug } = Route.useParams();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data, error: queryError } = await supabase
        .from("business_profiles")
        .select("id,business_name,slug,description,whatsapp,phone,instagram,website,city,state,address,logo_url,cover_url,verified,services(id,name,description,categories(name))")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();

      if (!mounted) return;
      if (queryError) setError("Não foi possível carregar este fornecedor.");
      else setBusiness((data ?? null) as unknown as Business);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [slug]);

  if (loading) return <main className="provider-page-state">Carregando perfil...</main>;
  if (error || !business) {
    return (
      <main className="provider-page-state">
        <strong>Fornecedor não encontrado.</strong>
        <Link to="/buscar">Voltar para a busca</Link>
      </main>
    );
  }

  const rawPhone = business.whatsapp || business.phone || "";
  const digits = rawPhone.replace(/\D/g, "");
  const whatsapp = digits ? "https://wa.me/" + (digits.startsWith("55") ? digits : "55" + digits) + "?text=" + encodeURIComponent("Olá! Encontrei a " + business.business_name + " no LOSI CONECTA.") : null;

  return (
    <main className="provider-page">
      <header className="catalog-header">
        <Link to="/" className="catalog-logo">LOSI <span>CONECTA</span></Link>
        <Link to="/buscar" className="catalog-login">Buscar fornecedores</Link>
      </header>

      <section className="provider-hero">
        <div className="provider-hero-cover">
          {business.cover_url && <img src={business.cover_url} alt="" />}
        </div>
        <div className="provider-hero-content">
          <div className="provider-hero-logo">
            {business.logo_url ? <img src={business.logo_url} alt={business.business_name} /> : <span>{business.business_name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="provider-hero-title">
            <div className="catalog-kicker">PERFIL PROFISSIONAL</div>
            <h1>{business.business_name}</h1>
            {business.verified && <span className="provider-verified">Fornecedor verificado</span>}
            {(business.city || business.state) && <div className="provider-location">{business.city}{business.city && business.state ? " — " : ""}{business.state}</div>}
          </div>
          {whatsapp && <a className="provider-profile-contact" href={whatsapp} target="_blank" rel="noreferrer">Conversar pelo WhatsApp</a>}
        </div>
      </section>

      <section className="provider-profile-content">
        <div className="provider-profile-main">
          <div className="provider-profile-card">
            <div className="catalog-kicker">SOBRE O FORNECEDOR</div>
            <h2>Conheça o trabalho</h2>
            <p>{business.description || "Este profissional ainda não adicionou uma descrição."}</p>
          </div>

          <div className="provider-profile-card">
            <div className="catalog-kicker">SERVIÇOS</div>
            <h2>O que oferece</h2>
            {business.services.length === 0 ? (
              <p>Este fornecedor ainda não cadastrou serviços.</p>
            ) : (
              <div className="provider-service-list">
                {business.services.map((service) => (
                  <article key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      {service.categories?.name && <span>{service.categories.name}</span>}
                    </div>
                    {service.description && <p>{service.description}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="provider-profile-side">
          <div className="provider-profile-card">
            <div className="catalog-kicker">CONTATO</div>
            <h2>Informações</h2>
            {(business.city || business.state) && <p><strong>Localização</strong><br />{business.city}{business.city && business.state ? " — " : ""}{business.state}</p>}
            {business.address && <p><strong>Endereço</strong><br />{business.address}</p>}
            {business.website && <p><strong>Site</strong><br /><a href={business.website} target="_blank" rel="noreferrer">{business.website}</a></p>}
            {business.instagram && <p><strong>Instagram</strong><br /><a href={business.instagram} target="_blank" rel="noreferrer">{business.instagram}</a></p>}
            {!business.website && !business.instagram && !business.address && !business.city && !business.state && <p>O fornecedor ainda não informou outros dados de contato.</p>}
          </div>
        </aside>
      </section>
    </main>
  );
}
