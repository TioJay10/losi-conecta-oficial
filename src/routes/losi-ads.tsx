import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../losi-ads.css";

export const Route = createFileRoute("/losi-ads")({
  component: LosiAdsPage,
});

type AdType = "event" | "opportunity";

function LosiAdsPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<AdType>("event");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  if (loading) return <main className="dashboard-loading">Carregando LOSI ADS...</main>;

  return (
    <main className="dashboard-page losi-ads-dashboard">\n      {mobileMenuOpen && <button type="button" className="dashboard-mobile-menu-overlay" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
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
      </aside>\n      <div className="dashboard-main">\n        <header className="dashboard-header">\n          <button type="button" className="dashboard-mobile-menu-button" onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen}><span></span><span></span><span></span></button>\n          <div className="dashboard-header-context"><span>ÁREA EXCLUSIVA</span><strong>LOSI ADS</strong></div>\n          <button type="button" className="dashboard-logout" onClick={() => void logout()}>Sair</button>\n        </header>\n        <section className="dashboard-content losi-ads-content">
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
            <button
              type="button"
              className={"losi-ads-type-card" + (type === "event" ? " selected" : "")}
              onClick={() => setType("event")}
              aria-pressed={type === "event"}
            >
              <span className="losi-ads-type-number">01</span>
              <span className="losi-ads-type-icon" aria-hidden="true">◈</span>
              <strong>EVENTO</strong>
              <span>Divulgue seminários, encontros, feiras, congressos, workshops e outros eventos.</span>
              <em>{type === "event" ? "Selecionado" : "Selecionar evento"}</em>
            </button>

            <button
              type="button"
              className={"losi-ads-type-card" + (type === "opportunity" ? " selected" : "")}
              onClick={() => setType("opportunity")}
              aria-pressed={type === "opportunity"}
            >
              <span className="losi-ads-type-number">02</span>
              <span className="losi-ads-type-icon" aria-hidden="true">+</span>
              <strong>OPORTUNIDADE</strong>
              <span>Encontre recreadores, monitores, staff e outros profissionais para seu evento.</span>
              <em>{type === "opportunity" ? "Selecionado" : "Selecionar oportunidade"}</em>
            </button>
          </div>
        </section>

        <section className="losi-ads-form-card">
          <div className="losi-ads-section-label">02 · {type === "event" ? "EVENTO" : "OPORTUNIDADE"}</div>
          <div className="losi-ads-form-heading">
            <div>
              <h2>{type === "event" ? "Dados do evento" : "Dados da oportunidade"}</h2>
              <p>
                {type === "event"
                  ? "Conte para a comunidade LOSI o que será realizado."
                  : "Descreva quem você procura e o que precisa ser realizado."}
              </p>
            </div>
            <span className="losi-ads-credit-badge">1 CRÉDITO</span>
          </div>

          {type === "event" ? <EventForm /> : <OpportunityForm />}

          <div className="losi-ads-form-footer">
            <span>Seu anúncio será publicado após a confirmação do crédito.</span>
            <button type="button" className="losi-ads-publish-button">
              PUBLICAR {type === "event" ? "EVENTO" : "OPORTUNIDADE"}
            </button>
          </div>
        </section>

        <section className="losi-ads-my-ads">
          <div>
            <div className="losi-ads-section-label">03 · MINHAS PUBLICAÇÕES</div>
            <h2>Seus anúncios aparecerão aqui</h2>
            <p>Acompanhe publicações, visualizações e candidaturas em um único lugar.</p>
          </div>
          <button type="button" onClick={() => navigate({ to: "/painel" })}>Voltar ao painel</button>
        </section>
      </section>
    </main>
  );
}

function EventForm() {
  return (
    <div className="losi-ads-form-grid">
      <label className="full"><span>Nome do evento</span><input placeholder="Ex.: Feira de Negócios 2026" /></label>
      <label><span>Categoria</span><select defaultValue=""><option value="" disabled>Selecione</option><option>Seminário</option><option>Encontro</option><option>Feira de negócios</option><option>Congresso</option><option>Workshop</option><option>Evento corporativo</option><option>Festival</option><option>Outro</option></select></label>
      <label><span>Data</span><input type="date" /></label>
      <label><span>Horário inicial</span><input type="time" /></label>
      <label><span>Horário final</span><input type="time" /></label>
      <label><span>Cidade</span><input placeholder="São Paulo" /></label>
      <label><span>Estado</span><select defaultValue=""><option value="" disabled>UF</option><option>SP</option><option>RJ</option><option>MG</option><option>PR</option><option>SC</option><option>RS</option><option>BA</option><option>PE</option></select></label>
      <label><span>CEP</span><input inputMode="numeric" placeholder="00000-000" /></label>
      <label className="full"><span>Descrição do evento</span><textarea placeholder="Apresente o evento, público, programação e informações importantes." rows={5} /></label>
      <label className="full"><span>Link ou contato para informações</span><input placeholder="Site, Instagram ou WhatsApp" /></label>
    </div>
  );
}

function OpportunityForm() {
  return (
    <div className="losi-ads-form-grid">
      <label className="full"><span>Título da oportunidade</span><input placeholder="Ex.: Recreadores para evento corporativo" /></label>
      <label><span>Função procurada</span><select defaultValue=""><option value="" disabled>Selecione</option><option>Recreador</option><option>Monitor</option><option>Promotor</option><option>Recepcionista</option><option>Garçom</option><option>Fotógrafo</option><option>DJ</option><option>Staff</option><option>Outro</option></select></label>
      <label><span>Quantidade de profissionais</span><input type="number" min="1" placeholder="6" /></label>
      <label><span>Data do trabalho</span><input type="date" /></label>
      <label><span>Horário inicial</span><input type="time" /></label>
      <label><span>Horário final</span><input type="time" /></label>
      <label><span>Cidade</span><input placeholder="São Paulo" /></label>
      <label><span>Estado</span><select defaultValue=""><option value="" disabled>UF</option><option>SP</option><option>RJ</option><option>MG</option><option>PR</option><option>SC</option><option>RS</option><option>BA</option><option>PE</option></select></label>
      <label><span>CEP</span><input inputMode="numeric" placeholder="00000-000" /></label>
      <label><span>Valor oferecido</span><input inputMode="decimal" placeholder="R$ 180,00" /></label>
      <label className="full"><span>Descrição da oportunidade</span><textarea placeholder="Explique o trabalho, responsabilidades e o perfil profissional que você procura." rows={5} /></label>
      <label className="full"><span>Requisitos e observações</span><textarea placeholder="Experiência, uniforme, materiais, forma de pagamento e outras informações." rows={4} /></label>
    </div>
  );
}
