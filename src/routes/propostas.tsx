import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";
import "../proposals.css";

export const Route = createFileRoute("/propostas")({ component: ProposalsPage });

type Business = {
  business_name: string | null;
  document: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  phone: string | null;
  whatsapp: string | null;
};

type Profile = {
  full_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
};

type ProposalDraft = {
  recipient: string;
  responsible: string;
  recipientContact: string;
  proposalType: string;
  title: string;
  eventDate: string;
  eventTime: string;
  duration: string;
  location: string;
  audience: string;
  ageRange: string;
  description: string;
  objective: string;
  activities: string[];
  team: string;
  methodology: string;
  notes: string;
  validity: string;
};

const activityOptions = [
  "Recreação dirigida",
  "Gincanas e jogos cooperativos",
  "Pintura facial",
  "Oficina lúdica",
  "Escultura de balões",
  "Monitoria",
  "Atividades esportivas",
  "Passeio / excursão",
  "Ativação de marca",
];

const typeOptions = [
  "Atividade recreativa",
  "Monitoria",
  "Oficina",
  "Evento corporativo",
  "Passeio / excursão",
  "Ativação de marca",
  "Proposta personalizada",
];

function dateBR(value: string) {
  if (!value) return "A definir";
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function todayBR() {
  return new Date().toLocaleDateString("pt-BR");
}

function buildObjective(type: string) {
  const map: Record<string, string> = {
    "Atividade recreativa": "Proporcionar momentos de diversão, integração e entretenimento, com atividades adequadas ao público e ao espaço disponível.",
    "Monitoria": "Oferecer acompanhamento responsável aos participantes, contribuindo para organização, segurança e qualidade da experiência.",
    "Oficina": "Promover uma experiência prática, lúdica e participativa, estimulando criatividade, interação e aprendizado por meio da atividade proposta.",
    "Evento corporativo": "Contribuir para uma experiência de integração e entretenimento alinhada ao perfil do evento e aos objetivos do contratante.",
    "Passeio / excursão": "Apoiar a organização e o acompanhamento dos participantes durante a experiência, com planejamento recreativo e atenção às características do grupo.",
    "Ativação de marca": "Criar uma experiência de interação com o público, conectando a atividade recreativa à presença e aos objetivos da marca.",
    "Proposta personalizada": "Apresentar uma solução de lazer e entretenimento construída de acordo com as características e necessidades do projeto.",
  };
  return map[type] || map["Proposta personalizada"];
}

function ProposalPdf({ draft, business, profile }: { draft: ProposalDraft; business: Business | null; profile: Profile | null }) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = 210;
  const H = 297;
  const margin = 18;
  const contentW = W - margin * 2;
  const navy = [7, 26, 51] as const;
  const gold = [214, 180, 106] as const;
  const ink = [27, 38, 53] as const;
  const muted = [104, 116, 132] as const;
  const pale = [246, 248, 251] as const;
  const supplier = business?.business_name || profile?.full_name || "LOSI Gestão em Lazer";
  const supplierLocation = [business?.city || profile?.city, business?.state || profile?.state].filter(Boolean).join(" — ");
  const contact = business?.whatsapp || business?.phone || "";
  const proposalTitle = draft.title.trim() || draft.proposalType;

  const addFooter = (pageNumber: number) => {
    doc.setDrawColor(226, 230, 236);
    doc.setLineWidth(0.3);
    doc.line(margin, 279, W - margin, 279);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("LOSI CONECTA  •  PROPOSTA COMERCIAL", margin, 285);
    doc.text(String(pageNumber).padStart(2, "0"), W - margin, 285, { align: "right" });
  };

  const geometric = () => {
    doc.setDrawColor(224, 228, 234);
    doc.setLineWidth(0.22);
    const lines = [
      [0, 25, 210, 165], [35, 0, 150, 297], [210, 32, 65, 297],
      [0, 185, 205, 42], [18, 297, 175, 0], [0, 80, 210, 255],
    ];
    lines.forEach(([x1, y1, x2, y2]) => doc.line(x1, y1, x2, y2));
    doc.setDrawColor(239, 231, 211);
    doc.setLineWidth(0.45);
    doc.line(25, 0, 25, 297);
  };

  // CAPA
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");
  geometric();
  doc.setFillColor(...navy);
  doc.rect(0, 0, 10, H, "F");
  doc.setFillColor(...gold);
  doc.rect(25, 24, 3, 22, "F");
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LOSI", 37, 32);
  doc.setTextColor(...gold);
  doc.text("CONECTA", 60, 32);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("GESTÃO EM LAZER  •  APRESENTAÇÃO PROFISSIONAL", 37, 39);

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(31);
  doc.text("PROPOSTA", 37, 105);
  doc.setTextColor(...gold);
  doc.setFontSize(34);
  doc.text("COMERCIAL", 37, 119);
  doc.setFillColor(...gold);
  doc.rect(37, 124, Math.min(74, Math.max(35, doc.getTextWidth("COMERCIAL") + 5)), 3.2, "F");

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("APRESENTAÇÃO DE SERVIÇOS", 37, 143);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const coverTitle = doc.splitTextToSize(proposalTitle, 130).slice(0, 2);
  doc.text(coverTitle, 37, 155);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("APRESENTADA PARA", 37, 178);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text(doc.splitTextToSize(draft.recipient || "Cliente / empresa", 125).slice(0, 2), 37, 187);

  doc.setFillColor(...navy);
  doc.roundedRect(37, 238, 136, 32, 2, 2, "F");
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PREPARADA POR", 45, 248);
  doc.setTextColor(255,255,255);
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(supplier, 115).slice(0, 1), 45, 257);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...gold);
  doc.text(supplierLocation || "LOSI Gestão em Lazer", 45, 264);
  doc.setTextColor(...muted);
  doc.text(todayBR(), W - margin, 285, { align: "right" });

  // PÁGINA 2
  doc.addPage();
  doc.setFillColor(...pale);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 13, "F");
  doc.setFillColor(...gold);
  doc.rect(margin, 27, 3, 17, "F");
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("APRESENTAÇÃO", margin + 9, 39);

  const textBlock = (heading: string, text: string, yy: number, height = 62) => {
    doc.setFillColor(255,255,255);
    doc.setDrawColor(226,230,236);
    doc.roundedRect(margin, yy, contentW, height, 3, 3, "FD");
    doc.setTextColor(...gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(heading.toUpperCase(), margin + 8, yy + 11);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text || "Informação a definir.", contentW - 16);
    doc.text(lines.slice(0, 7), margin + 8, yy + 23);
  };

  textBlock("Contexto da proposta", draft.description || "Esta proposta apresenta uma solução de serviços desenvolvida de acordo com as características do projeto e do público informado.", 53, 73);
  textBlock("Objetivo", draft.objective || buildObjective(draft.proposalType), 134, 62);

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("INFORMAÇÕES DO PROJETO", margin, 219);
  const info = [
    ["Tipo", draft.proposalType],
    ["Data", dateBR(draft.eventDate)],
    ["Horário", draft.eventTime || "A definir"],
    ["Duração", draft.duration || "A definir"],
    ["Local", draft.location || "A definir"],
    ["Público", draft.audience || "A definir"],
    ["Faixa etária", draft.ageRange || "A definir"],
  ];
  let ix = margin, iy = 229;
  info.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    ix = margin + col * 91;
    iy = 229 + row * 15;
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(label.toUpperCase(), ix, iy);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(value, 78).slice(0,1), ix, iy + 6);
  });
  addFooter(2);

  // PÁGINA 3
  doc.addPage();
  doc.setFillColor(255,255,255);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...navy);
  doc.rect(0, 0, 55, H, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("ATIVIDADES", 14, 43);
  doc.setTextColor(...gold);
  doc.setFontSize(20);
  doc.text("PROPOSTAS", 14, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(225,231,239);
  const sideText = doc.splitTextToSize("Uma programação pensada para promover participação, organização e uma experiência positiva para o público.", 35);
  doc.text(sideText, 14, 72);
  doc.setFillColor(...gold);
  doc.rect(14, 111, 26, 2.5, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(7);
  doc.text("LOSI GESTÃO EM LAZER", 14, 124);

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("O que será realizado", 70, 39);
  const selected = draft.activities.length ? draft.activities : [draft.proposalType];
  let ay = 55;
  selected.slice(0, 9).forEach((item, index) => {
    doc.setFillColor(index % 2 === 0 ? 247 : 252, index % 2 === 0 ? 249 : 252, index % 2 === 0 ? 252 : 255);
    doc.roundedRect(70, ay, 122, 17, 2, 2, "F");
    doc.setFillColor(...gold);
    doc.circle(78, ay + 8.5, 2.3, "F");
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(item, 85, ay + 11.5);
    ay += 21;
  });

  doc.setTextColor(...navy);
  doc.setFontSize(12);
  doc.text("DESENVOLVIMENTO", 70, 257);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const method = draft.methodology || "As atividades serão conduzidas por profissionais responsáveis, com adaptação ao espaço, ao perfil do público e à dinâmica do evento. A programação poderá ser ajustada conforme as condições do local.";
  doc.text(doc.splitTextToSize(method, 122).slice(0, 3), 70, 267);
  addFooter(3);

  // PÁGINA 4
  doc.addPage();
  doc.setFillColor(...pale);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 67, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("DETALHAMENTO", margin, 32);
  doc.setTextColor(...gold);
  doc.setFontSize(9);
  doc.text("E CONSIDERAÇÕES FINAIS", margin, 44);

  doc.setFillColor(255,255,255);
  doc.roundedRect(margin, 82, contentW, 61, 3, 3, "F");
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("EQUIPE E ESTRUTURA", margin + 8, 95);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const team = draft.team || "Equipe dimensionada de acordo com o público, duração e características do projeto.";
  doc.text(doc.splitTextToSize(team, contentW - 16).slice(0, 5), margin + 8, 108);

  doc.setFillColor(255,255,255);
  doc.roundedRect(margin, 153, contentW, 66, 3, 3, "F");
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CONSIDERAÇÕES", margin + 8, 166);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const notes = draft.notes || "A programação poderá ser ajustada em conjunto com o contratante após a análise das condições do local e das necessidades do público.";
  doc.text(doc.splitTextToSize(notes, contentW - 16).slice(0, 5), margin + 8, 179);

  doc.setFillColor(...gold);
  doc.roundedRect(margin, 231, contentW, 32, 3, 3, "F");
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PRÓXIMO PASSO", margin + 8, 243);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Alinhamento dos detalhes da atividade e definição da programação final.", margin + 8, 253);

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(supplier, margin, 273);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text([supplierLocation, contact].filter(Boolean).join("  •  ") || "LOSI Gestão em Lazer", margin, 280);
  addFooter(4);

  doc.setProperties({
    title: `Proposta Comercial — ${proposalTitle}`,
    subject: "Proposta comercial LOSI CONECTA",
    author: supplier,
    creator: "LOSI CONECTA",
  });
  doc.save(`proposta-losi-${(draft.recipient || "cliente").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "cliente"}.pdf`);
}

function ProposalsPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<ProposalDraft>({
    recipient: "",
    responsible: "",
    recipientContact: "",
    proposalType: "Atividade recreativa",
    title: "Atividades recreativas",
    eventDate: "",
    eventTime: "",
    duration: "",
    location: "",
    audience: "",
    ageRange: "",
    description: "",
    objective: buildObjective("Atividade recreativa"),
    activities: ["Recreação dirigida", "Gincanas e jogos cooperativos"],
    team: "",
    methodology: "",
    notes: "",
    validity: "",
  });

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        navigate({ to: "/entrar" });
        return;
      }
      const [{ data: businessData }, { data: profileData }] = await Promise.all([
        supabase.from("business_profiles").select("business_name,document,address,city,state,cep,phone,whatsapp").eq("owner_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name,address,city,state,cep").eq("id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      setBusiness((businessData as Business | null) ?? null);
      setProfile((profileData as Profile | null) ?? null);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [navigate]);

  const supplier = business?.business_name || profile?.full_name || "Sua empresa";
  const supplierContact = business?.whatsapp || business?.phone || "";
  const preview = useMemo(() => ({ ...draft, title: draft.title.trim() || draft.proposalType }), [draft]);

  function update<K extends keyof ProposalDraft>(key: K, value: ProposalDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  function toggleActivity(value: string) {
    setDraft(current => ({
      ...current,
      activities: current.activities.includes(value)
        ? current.activities.filter(item => item !== value)
        : [...current.activities, value],
    }));
  }

  function newProposal() {
    setDraft({
      recipient: "",
      responsible: "",
      recipientContact: "",
      proposalType: "Atividade recreativa",
      title: "Atividades recreativas",
      eventDate: "",
      eventTime: "",
      duration: "",
      location: "",
      audience: "",
      ageRange: "",
      description: "",
      objective: buildObjective("Atividade recreativa"),
      activities: ["Recreação dirigida", "Gincanas e jogos cooperativos"],
      team: "",
      methodology: "",
      notes: "",
      validity: "",
    });
    setMessage("");
  }

  function generate() {
    if (!draft.recipient.trim()) {
      setMessage("Informe para quem a proposta será apresentada.");
      return;
    }
    if (!draft.description.trim()) {
      setMessage("Descreva o que você pretende realizar para montarmos a apresentação.");
      return;
    }
    setMessage("Proposta gerada com sucesso. O PDF premium está sendo preparado.");
    ProposalPdf({ draft: preview, business, profile });
  }

  if (loading) return <main className="receipts-state">Carregando propostas...</main>;

  return (
    <main className="dashboard-page proposals-page">
      <div className="dashboard-sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} aria-hidden={!mobileMenuOpen}></div>
      <aside className={"dashboard-sidebar" + (mobileMenuOpen ? " mobile-open" : "")}>
        <div className="dashboard-sidebar-brand"><span>LOSI</span><strong>CONECTA</strong></div>
        <div className="dashboard-sidebar-caption">PAINEL PROFISSIONAL</div>
        <nav className="dashboard-sidebar-nav" aria-label="Menu do painel">
          <Link to="/painel" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">01</span><span><strong>Visão geral</strong><small>Resumo da conta</small></span></Link>
          <Link to="/buscar" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">02</span><span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span></Link>
          <Link to="/meu-perfil" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">03</span><span><strong>Meu perfil</strong><small>Dados pessoais</small></span></Link>
          <Link to="/meus-servicos" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">04</span><span><strong>Minha empresa</strong><small>Serviços e presença</small></span></Link>
          <Link to="/notificar-inconsistencia" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">05</span><span><strong>Notificar Inconsistências</strong><small>Falar com o administrador</small></span></Link>
          <Link to="/orcamentos" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">06</span><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span></Link>
          <Link to="/recibos" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">07</span><span><strong>Recibos</strong><small>Comprovantes de serviço</small></span></Link>
          <Link to="/propostas" className="dashboard-nav-item active" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">08</span><span><strong>Propostas</strong><small>Apresentações comerciais</small></span></Link>
        </nav>
        <div className="dashboard-sidebar-footer"><div className="dashboard-sidebar-status"><span></span> Conta profissional</div><button type="button" className="dashboard-sidebar-logout" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/entrar" }); }}>Sair da conta</button></div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header proposals-header">
          <button type="button" className="dashboard-mobile-menu-button" onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileMenuOpen}><span></span><span></span><span></span></button>
          <div className="dashboard-header-context"><span>DOCUMENTOS PROFISSIONAIS</span><strong>Propostas</strong></div>
          <div className="dashboard-header-right"><button type="button" className="dashboard-secondary proposals-new" onClick={newProposal}>Nova proposta</button></div>
        </header>

        <section className="dashboard-content proposals-content">
          <div className="proposals-hero">
            <div>
              <div className="dashboard-badge">PROPOSTAS COMERCIAIS</div>
              <h1>Apresente seu trabalho antes de falar de valores.</h1>
              <p>Monte uma apresentação comercial profissional, visualize o documento enquanto preenche e gere um PDF premium com a identidade do LOSI.</p>
            </div>
            <div className="proposals-hero-mark"><span>LOSI</span><strong>CONECTA</strong><small>PROPOSTA COMERCIAL</small></div>
          </div>

          {message && <div className="proposals-message">{message}</div>}

          <div className="proposals-layout">
            <section className="proposals-form-card">
              <div className="proposals-card-head"><div><span className="proposals-kicker">GRUPO 01</span><h2>Destinatário</h2></div><span className="proposals-step">1</span></div>
              <div className="proposals-form-grid">
                <label><span>Empresa / condomínio *</span><input value={draft.recipient} onChange={e => update("recipient", e.target.value)} placeholder="Ex.: Condomínio Parque das Flores" /></label>
                <label><span>Responsável</span><input value={draft.responsible} onChange={e => update("responsible", e.target.value)} placeholder="Nome do responsável" /></label>
                <label className="wide"><span>Telefone / WhatsApp</span><input value={draft.recipientContact} onChange={e => update("recipientContact", e.target.value)} placeholder="(11) 99999-9999" /></label>
              </div>

              <div className="proposals-divider" />

              <div className="proposals-card-head"><div><span className="proposals-kicker">GRUPO 02</span><h2>Projeto</h2></div><span className="proposals-step">2</span></div>
              <div className="proposals-form-grid">
                <label><span>Tipo de proposta</span><select value={draft.proposalType} onChange={e => { const value = e.target.value; setDraft(current => ({ ...current, proposalType: value, objective: buildObjective(value), title: current.title === current.proposalType ? value : current.title })); }}><option value="">Selecione</option>{typeOptions.map(item => <option key={item}>{item}</option>)}</select></label>
                <label><span>Título da proposta</span><input value={draft.title} onChange={e => update("title", e.target.value)} placeholder="Ex.: Férias no condomínio" /></label>
                <label><span>Data</span><input type="date" value={draft.eventDate} onChange={e => update("eventDate", e.target.value)} /></label>
                <label><span>Horário</span><input value={draft.eventTime} onChange={e => update("eventTime", e.target.value)} placeholder="14h às 18h" /></label>
                <label><span>Duração</span><input value={draft.duration} onChange={e => update("duration", e.target.value)} placeholder="4 horas" /></label>
                <label><span>Local</span><input value={draft.location} onChange={e => update("location", e.target.value)} placeholder="Condomínio / endereço" /></label>
                <label><span>Público estimado</span><input value={draft.audience} onChange={e => update("audience", e.target.value)} placeholder="Ex.: 60 crianças" /></label>
                <label><span>Faixa etária</span><input value={draft.ageRange} onChange={e => update("ageRange", e.target.value)} placeholder="Ex.: 4 a 12 anos" /></label>
              </div>

              <div className="proposals-divider" />

              <div className="proposals-card-head"><div><span className="proposals-kicker">GRUPO 03</span><h2>Conteúdo da apresentação</h2></div><span className="proposals-step">3</span></div>
              <div className="proposals-form-grid">
                <label className="wide"><span>O que você pretende realizar? *</span><textarea rows={5} value={draft.description} onChange={e => update("description", e.target.value)} placeholder="Ex.: Quero realizar uma atividade recreativa para as crianças do condomínio durante as férias, com brincadeiras, gincanas e pintura facial." /></label>
                <label className="wide"><span>Objetivo da atividade</span><textarea rows={4} value={draft.objective} onChange={e => update("objective", e.target.value)} /></label>
              </div>

              <div className="proposals-activities">
                <div className="proposals-field-label">Atividades propostas</div>
                <div className="proposals-check-grid">{activityOptions.map(item => <label key={item} className={draft.activities.includes(item) ? "selected" : ""}><input type="checkbox" checked={draft.activities.includes(item)} onChange={() => toggleActivity(item)} /><span>{item}</span></label>)}</div>
              </div>

              <div className="proposals-form-grid">
                <label className="wide"><span>Como será realizado?</span><textarea rows={4} value={draft.methodology} onChange={e => update("methodology", e.target.value)} placeholder="Descreva equipe, condução, adaptação ao espaço e dinâmica." /></label>
                <label className="wide"><span>Equipe / estrutura</span><textarea rows={3} value={draft.team} onChange={e => update("team", e.target.value)} placeholder="Ex.: 4 profissionais de recreação." /></label>
                <label className="wide"><span>Considerações finais</span><textarea rows={3} value={draft.notes} onChange={e => update("notes", e.target.value)} placeholder="Informações adicionais, condições do local ou próximos passos." /></label>
              </div>

              <div className="proposals-actions">
                <button type="button" className="proposals-secondary" onClick={newProposal}>Limpar</button>
                <button type="button" className="proposals-primary" onClick={generate}>Gerar proposta em PDF</button>
              </div>
              <p className="proposals-note">A proposta não inclui valores. Ela funciona como apresentação inicial do trabalho; orçamento e condições comerciais podem ser tratados separadamente.</p>
            </section>

            <aside className="proposals-preview-panel">
              <div className="proposals-preview-head"><div><span className="proposals-kicker">VISUALIZAÇÃO</span><h2>Prévia da proposta</h2></div><span className="proposals-preview-status">A4 • PDF</span></div>
              <div className="proposal-document-preview">
                <div className="proposal-preview-page proposal-preview-cover">
                  <div className="proposal-cover-lines"></div>
                  <div className="proposal-cover-brand"><strong>LOSI</strong><span>CONECTA</span></div>
                  <div className="proposal-cover-title"><small>APRESENTAÇÃO DE SERVIÇOS</small><h3>PROPOSTA</h3><h4>COMERCIAL</h4><i></i><strong>{preview.title}</strong><span>APRESENTADA PARA</span><b>{preview.recipient || "Cliente / empresa"}</b></div>
                  <div className="proposal-cover-footer"><span>PREPARADA POR</span><strong>{supplier}</strong><small>{[business?.city || profile?.city, business?.state || profile?.state].filter(Boolean).join(" — ") || "LOSI Gestão em Lazer"}</small></div>
                </div>

                <div className="proposal-preview-page">
                  <div className="proposal-preview-section-title"><span>02</span><h3>APRESENTAÇÃO</h3></div>
                  <div className="proposal-preview-box"><small>CONTEXTO DA PROPOSTA</small><p>{preview.description || "Sua descrição aparecerá aqui."}</p></div>
                  <div className="proposal-preview-box"><small>OBJETIVO</small><p>{preview.objective || buildObjective(preview.proposalType)}</p></div>
                  <h5>INFORMAÇÕES DO PROJETO</h5>
                  <div className="proposal-preview-info">{[["Tipo",preview.proposalType],["Data",dateBR(preview.eventDate)],["Horário",preview.eventTime||"A definir"],["Duração",preview.duration||"A definir"],["Local",preview.location||"A definir"],["Público",preview.audience||"A definir"]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
                </div>

                <div className="proposal-preview-page proposal-preview-activities">
                  <div className="proposal-preview-side"><strong>ATIVIDADES</strong><span>PROPOSTAS</span><small>Uma programação pensada para participação, organização e uma experiência positiva.</small></div>
                  <div className="proposal-preview-activity-content"><h3>O que será realizado</h3>{(preview.activities.length?preview.activities:[preview.proposalType]).slice(0,7).map(item=><div key={item}><i></i><span>{item}</span></div>)}<h5>DESENVOLVIMENTO</h5><p>{preview.methodology || "A programação será conduzida por profissionais e adaptada ao espaço, ao perfil do público e à dinâmica do evento."}</p></div>
                </div>

                <div className="proposal-preview-page">
                  <div className="proposal-preview-final-head"><span>04</span><h3>DETALHAMENTO</h3><small>E CONSIDERAÇÕES FINAIS</small></div>
                  <div className="proposal-preview-final-box"><small>EQUIPE E ESTRUTURA</small><p>{preview.team || "Equipe dimensionada de acordo com o público, duração e características do projeto."}</p></div>
                  <div className="proposal-preview-final-box"><small>CONSIDERAÇÕES</small><p>{preview.notes || "A programação poderá ser ajustada em conjunto com o contratante após a análise do local e das necessidades do público."}</p></div>
                  <div className="proposal-preview-next"><small>PRÓXIMO PASSO</small><strong>Alinhamento dos detalhes e definição da programação final.</strong></div>
                  <div className="proposal-preview-signature"><strong>{supplier}</strong><span>{[business?.city || profile?.city, business?.state || profile?.state].filter(Boolean).join(" — ")}</span></div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
