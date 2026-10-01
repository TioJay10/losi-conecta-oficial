import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "../losi-ads.css";

export const Route = createFileRoute("/losi-ads")({
  component: LosiAdsPage,
});

type AdType = "event" | "opportunity";

type EventDraft = {
  name: string;
  category: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  state: string;
  cep: string;
  description: string;
  contact: string;
};

type OpportunityDraft = {
  title: string;
  role: string;
  quantity: string;
  date: string;
  startTime: string;
  endTime: string;
  city: string;
  state: string;
  cep: string;
  value: string;
  description: string;
  requirements: string;
};

const emptyEvent: EventDraft = {
  name: "", category: "", date: "", startTime: "", endTime: "",
  city: "", state: "", cep: "", description: "", contact: "",
};

const emptyOpportunity: OpportunityDraft = {
  title: "", role: "", quantity: "", date: "", startTime: "", endTime: "",
  city: "", state: "", cep: "", value: "", description: "", requirements: "",
};

function LosiAdsPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<AdType>("event");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<EventDraft>(emptyEvent);
  const [opportunityDraft, setOpportunityDraft] = useState<OpportunityDraft>(emptyOpportunity);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) { navigate({ to: "/entrar" }); return; }
      const { data } = await supabase.auth.getUser();
      if (!data.user) { navigate({ to: "/entrar" }); return; }
      if (mounted) setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [navigate]);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  }

  function changeType(nextType: AdType) {
    setType(nextType);
    setMessage("");
  }

  function publish(event: FormEvent) {
    event.preventDefault();
    setMessage(
      "O anúncio ainda não foi publicado. Primeiro vamos conectar os créditos ADS e o banco de anúncios."
    );
  }

  if (loading) return <main className="dashboard-loading">Carregando LOSI ADS...</main>;

  return (
    <main className="dashboard-page losi-ads-dashboard">
      {mobileMenuOpen && <button type="button" className="dashboard-mobile-menu-overlay" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={"dashboard-sidebar" + (mobileMenuOpen ? " mobile-open" : "")}>
        <div className="dashboard-sidebar-brand"><span>LOSI</span><strong>CONECTA</strong></div>
        <div className="dashboard-sidebar-caption">PAINEL PROFISSIONAL</div>
        <nav className="dashboard-sidebar-nav" aria-label="Menu do painel">
          <a className="dashboard-nav-item" href="/painel"><span className="dashboard-nav-mark">01</span><span><strong>Visão geral</strong><small>Resumo da conta</small></span></a>
          <a className="dashboard-nav-item" href="/buscar"><span className="dashboard-nav-mark">02</span><span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span></a>
          <a className="dashboard-nav-item" href="/meu-perfil"><span className="dashboard-nav-mark">03</span><span><strong>Meu perfil</strong><small>Dados pessoais</small></span></a>
          <a className="dashboard-nav-item" href="/meus-servicos"><span className="dashboard-nav-mark">04</span><span><strong>Minha empresa</strong><small>Serviços e presença</small></span></a>
          <a className="dashboard-nav-item" href="/notificar-inconsistencia"><span className="dashboard-nav-mark">05</span><span><strong>Notificar Inconsistências</strong><small>Falar com o administrador</small></span></a>
          <a className="dashboard-nav-item" href="/orcamentos"><span className="dashboard-nav-mark">06</span><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span></a>
          <a className="dashboard-nav-item" href="/recibos"><span className="dashboard-nav-mark">07</span><span><strong>Recibos</strong><small>Comprovantes de serviço</small></span></a>
          <a className="dashboard-nav-item" href="/propostas"><span className="dashboard-nav-mark">08</span><span><strong>Propostas</strong><small>Apresentações comerciais</small></span></a>
          <a className="dashboard-nav-item active" href="/losi-ads"><span className="dashboard-nav-mark">09</span><span><strong>LOSI ADS</strong><small>Eventos e oportunidades</small></span></a>
        </nav>
        <div className="dashboard-sidebar-footer"><div className="dashboard-sidebar-status"><span></span> Conta profissional</div><button type="button" className="dashboard-sidebar-logout" onClick={() => void logout()}>Sair da conta</button></div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header">
          <button type="button" className="dashboard-mobile-menu-button" onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen}><span></span><span></span><span></span></button>
          <div className="dashboard-header-context"><span>ÁREA EXCLUSIVA</span><strong>LOSI ADS</strong></div>
          <button type="button" className="dashboard-logout" onClick={() => void logout()}>Sair</button>
        </header>

        <section className="dashboard-content losi-ads-content">
          <section className="losi-ads-shell">
            <header className="losi-ads-header">
              <div>
                <div className="losi-ads-eyebrow">LOSI ADS</div>
                <h1>Crie seu anúncio</h1>
                <p>Divulgue um evento ou encontre profissionais para sua próxima produção.</p>
              </div>
              <div className="losi-ads-balance">
                <span>CRÉDITOS ADS</span>
                <strong>0</strong>
                <button type="button">Comprar créditos</button>
              </div>
            </header>

            <section className="losi-ads-choice-card">
              <div className="losi-ads-section-label">01 · TIPO DE ANÚNCIO</div>
              <h2>O que você deseja anunciar?</h2>
              <p className="losi-ads-section-copy">Escolha uma opção. O formulário será adaptado automaticamente.</p>

              <div className="losi-ads-type-grid">
                <button type="button" className={"losi-ads-type-card" + (type === "event" ? " selected" : "")} onClick={() => changeType("event")} aria-pressed={type === "event"}>
                  <span className="losi-ads-type-number">01</span>
                  <span className="losi-ads-type-icon" aria-hidden="true">◈</span>
                  <strong>EVENTO</strong>
                  <span>Divulgue seminários, encontros, feiras, congressos, workshops e outros eventos.</span>
                  <em>{type === "event" ? "Selecionado" : "Selecionar evento"}</em>
                </button>

                <button type="button" className={"losi-ads-type-card" + (type === "opportunity" ? " selected" : "")} onClick={() => changeType("opportunity")} aria-pressed={type === "opportunity"}>
                  <span className="losi-ads-type-number">02</span>
                  <span className="losi-ads-type-icon" aria-hidden="true">+</span>
                  <strong>OPORTUNIDADE</strong>
                  <span>Encontre recreadores, monitores, staff e outros profissionais para seu evento.</span>
                  <em>{type === "opportunity" ? "Selecionado" : "Selecionar oportunidade"}</em>
                </button>
              </div>
            </section>

            <form className="losi-ads-form-card" onSubmit={publish}>
              <div className="losi-ads-section-label">02 · {type === "event" ? "EVENTO" : "OPORTUNIDADE"}</div>
              <div className="losi-ads-form-heading">
                <div>
                  <h2>{type === "event" ? "Dados do evento" : "Dados da oportunidade"}</h2>
                  <p>{type === "event" ? "Conte para a comunidade LOSI o que será realizado." : "Descreva quem você procura e o que precisa ser realizado."}</p>
                </div>
                <span className="losi-ads-credit-badge">1 CRÉDITO</span>
              </div>

              {type === "event" ? (
                <EventForm value={eventDraft} onChange={setEventDraft} />
              ) : (
                <OpportunityForm value={opportunityDraft} onChange={setOpportunityDraft} />
              )}

              <div className="losi-ads-form-footer">
                <span>Seu anúncio será publicado após a confirmação do crédito.</span>
                <button type="submit" className="losi-ads-publish-button">PUBLICAR {type === "event" ? "EVENTO" : "OPORTUNIDADE"}</button>
              </div>
              {message && <div className="losi-ads-form-message" role="status">{message}</div>}
            </form>

            <section className="losi-ads-my-ads">
              <div>
                <div className="losi-ads-section-label">03 · MINHAS PUBLICAÇÕES</div>
                <h2>Seus anúncios aparecerão aqui</h2>
                <p>Acompanhe publicações, visualizações e candidaturas em um único lugar.</p>
              </div>
              <button type="button" onClick={() => navigate({ to: "/painel" })}>Voltar ao painel</button>
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}

function EventForm({ value, onChange }: { value: EventDraft; onChange: (value: EventDraft) => void }) {
  const update = <K extends keyof EventDraft>(key: K, next: EventDraft[K]) => onChange({ ...value, [key]: next });
  return (
    <div className="losi-ads-form-grid">
      <label className="full"><span>Nome do evento</span><input required value={value.name} onChange={e => update("name", e.target.value)} placeholder="Ex.: Feira de Negócios 2026" /></label>
      <label><span>Categoria</span><select required value={value.category} onChange={e => update("category", e.target.value)}><option value="" disabled>Selecione</option><option>Seminário</option><option>Encontro</option><option>Feira de negócios</option><option>Congresso</option><option>Workshop</option><option>Evento corporativo</option><option>Festival</option><option>Outro</option></select></label>
      <label><span>Data</span><input required type="date" value={value.date} onChange={e => update("date", e.target.value)} /></label>
      <label><span>Horário inicial</span><input required type="time" value={value.startTime} onChange={e => update("startTime", e.target.value)} /></label>
      <label><span>Horário final</span><input required type="time" value={value.endTime} onChange={e => update("endTime", e.target.value)} /></label>
      <label><span>Cidade</span><input required value={value.city} onChange={e => update("city", e.target.value)} placeholder="São Paulo" /></label>
      <label><span>Estado</span><select required value={value.state} onChange={e => update("state", e.target.value)}><option value="" disabled>UF</option>{["SP","RJ","MG","PR","SC","RS","BA","PE"].map(uf => <option key={uf}>{uf}</option>)}</select></label>
      <label><span>CEP</span><input required inputMode="numeric" value={value.cep} onChange={e => update("cep", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="00000-000" /></label>
      <label className="full"><span>Descrição do evento</span><textarea required value={value.description} onChange={e => update("description", e.target.value)} placeholder="Apresente o evento, público, programação e informações importantes." rows={5} /></label>
      <label className="full"><span>Link ou contato para informações</span><input value={value.contact} onChange={e => update("contact", e.target.value)} placeholder="Site, Instagram ou WhatsApp" /></label>
    </div>
  );
}

function OpportunityForm({ value, onChange }: { value: OpportunityDraft; onChange: (value: OpportunityDraft) => void }) {
  const update = <K extends keyof OpportunityDraft>(key: K, next: OpportunityDraft[K]) => onChange({ ...value, [key]: next });
  return (
    <div className="losi-ads-form-grid">
      <label className="full"><span>Título da oportunidade</span><input required value={value.title} onChange={e => update("title", e.target.value)} placeholder="Ex.: Recreadores para evento corporativo" /></label>
      <label><span>Função procurada</span><select required value={value.role} onChange={e => update("role", e.target.value)}><option value="" disabled>Selecione</option>{["Recreador","Monitor","Promotor","Recepcionista","Garçom","Fotógrafo","DJ","Staff","Outro"].map(role => <option key={role}>{role}</option>)}</select></label>
      <label><span>Quantidade de profissionais</span><input required type="number" min="1" value={value.quantity} onChange={e => update("quantity", e.target.value)} placeholder="6" /></label>
      <label><span>Data do trabalho</span><input required type="date" value={value.date} onChange={e => update("date", e.target.value)} /></label>
      <label><span>Horário inicial</span><input required type="time" value={value.startTime} onChange={e => update("startTime", e.target.value)} /></label>
      <label><span>Horário final</span><input required type="time" value={value.endTime} onChange={e => update("endTime", e.target.value)} /></label>
      <label><span>Cidade</span><input required value={value.city} onChange={e => update("city", e.target.value)} placeholder="São Paulo" /></label>
      <label><span>Estado</span><select required value={value.state} onChange={e => update("state", e.target.value)}><option value="" disabled>UF</option>{["SP","RJ","MG","PR","SC","RS","BA","PE"].map(uf => <option key={uf}>{uf}</option>)}</select></label>
      <label><span>CEP</span><input required inputMode="numeric" value={value.cep} onChange={e => update("cep", e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="00000-000" /></label>
      <label><span>Valor oferecido</span><input required inputMode="decimal" value={value.value} onChange={e => update("value", e.target.value)} placeholder="R$ 180,00" /></label>
      <label className="full"><span>Descrição da oportunidade</span><textarea required value={value.description} onChange={e => update("description", e.target.value)} placeholder="Explique o trabalho, responsabilidades e o perfil profissional que você procura." rows={5} /></label>
      <label className="full"><span>Requisitos e observações</span><textarea value={value.requirements} onChange={e => update("requirements", e.target.value)} placeholder="Experiência, uniforme, materiais, forma de pagamento e outras informações." rows={4} /></label>
    </div>
  );
}
