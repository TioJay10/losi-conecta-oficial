import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  eventStart: string;
  eventEnd: string;
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
  cta: string;
  ctaCustom: string;
};


const ctaOptions = [
  { value: "whatsapp", label: "Falar pelo WhatsApp", text: "Gostou da proposta? Fale conosco pelo WhatsApp para alinharmos os próximos detalhes." },
  { value: "reuniao", label: "Agendar uma conversa", text: "Vamos conversar sobre o projeto? Entre em contato para agendarmos uma conversa e alinharmos os próximos passos." },
  { value: "visita", label: "Agendar visita técnica", text: "Podemos agendar uma visita técnica para conhecer o espaço e ajustar a proposta às características do local." },
  { value: "aprovacao", label: "Solicitar aprovação", text: "Se a proposta estiver de acordo com o que você procura, entre em contato para confirmarmos os próximos passos." },
  { value: "projeto", label: "Vamos realizar este projeto", text: "Estamos prontos para transformar esta ideia em uma experiência especial. Fale conosco para avançarmos com o projeto." },
  { value: "custom", label: "CTA personalizado", text: "" },
];

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
  "Caça ao tesouro",
  "Dança e musicalização",
  "Contação de histórias",
  "Oficina de slime",
  "Oficina de artes",
  "Oficina de culinária",
  "Jogos de integração",
  "Circuito recreativo",
  "Brincadeiras tradicionais",
  "Camarim infantil",
  "Modelagem com balões",
  "Carrinho de pipoca",
  "Carrinho de algodão-doce",
  "Cabine / espaço de fotos",
  "Ações de interação com a marca",
];

const typeOptions = [
  "Atividade recreativa",
  "Festa infantil",
  "Festa de aniversário",
  "Evento corporativo",
  "Confraternização empresarial",
  "Evento de integração",
  "Evento em condomínio",
  "Evento escolar",
  "Evento em colégio",
  "Evento de férias",
  "Evento de Dia das Crianças",
  "Evento de Natal",
  "Evento de Páscoa",
  "Evento de Dia dos Pais",
  "Evento de Dia das Mães",
  "Evento de Halloween",
  "Feira e exposição",
  "Ativação de marca",
  "Ação promocional",
  "Festival e evento aberto",
  "Passeio / excursão",
  "Oficina temática",
  "Monitoria",
  "Proposta personalizada",
];

function formatTime(value: string) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function calculateDuration(start: string, end: string) {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return "";
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  const total = endMinutes - startMinutes;
  if (total <= 0) return "";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!minutes) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  if (!hours) return `${minutes} min`;
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

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
  const footerLineY = 276;
  const footerTextY = 284;
  const contentBottom = 268;
  const navy = [7, 26, 51] as const;
  const gold = [190, 145, 48] as const;
  const ink = [27, 38, 53] as const;
  const muted = [104, 116, 132] as const;
  const pale = [246, 248, 251] as const;
  const supplier = business?.business_name || profile?.full_name || "Sua empresa";
  const supplierLocation = [business?.city || profile?.city, business?.state || profile?.state].filter(Boolean).join(" — ");
  const contact = business?.whatsapp || business?.phone || "";
  const proposalTitle = draft.title.trim() || draft.proposalType;
  const ctaText = draft.cta === "custom"
    ? draft.ctaCustom.trim()
    : ctaOptions.find(item => item.value === draft.cta)?.text || ctaOptions[0].text;

  let pageNumber = 1;

  const addFooter = () => {
    doc.setDrawColor(226, 230, 236);
    doc.setLineWidth(0.25);
    doc.line(margin, footerLineY, W - margin, footerLineY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text("LOSI CONECTA  •  DOCUMENTO PROFISSIONAL", margin, footerTextY);
    doc.text(String(pageNumber).padStart(2, "0"), W - margin, footerTextY, { align: "right" });
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

  const addStandardPage = (title: string, subtitle = "") => {
    doc.addPage();
    pageNumber += 1;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, 13, "F");
    doc.setFillColor(...gold);
    doc.rect(margin, 27, 3, 17, "F");
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(title, margin + 9, 39);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text(subtitle, margin + 9, 46);
    }
    return 58;
  };

  const drawWrappedText = (text: string, x: number, y: number, width: number, fontSize: number, color = ink, maxLines = 6) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text || "Informação a definir.", width);
    const visible = lines.slice(0, maxLines);
    doc.text(visible, x, y, { lineHeightFactor: 1.35 });
    return visible.length;
  };

  const drawTextCard = (heading: string, text: string, y: number, _width = contentW, maxLines = 7) => {
    const lineH = 4.15;
    const textWidth = contentW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.2);
    const lines = doc.splitTextToSize(text || "Informação a definir.", textWidth);
    const chunks: string[][] = [];
    for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines));
    let cursor = y;
    chunks.forEach((chunk, index) => {
      const bodyHeight = chunk.length * lineH;
      if (cursor + 7 + bodyHeight > contentBottom) {
        addFooter();
        cursor = addStandardPage("APRESENTAÇÃO", "CONTINUAÇÃO");
      }
      doc.setTextColor(...gold);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.4);
      doc.text(index === 0 ? heading.toUpperCase() : "CONTINUAÇÃO", margin, cursor);
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.2);
      doc.text(chunk, margin, cursor + 7, { maxWidth: textWidth, lineHeightFactor: 1.32 });
      cursor += 7 + bodyHeight + 9;
    });
    return cursor;
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
  const supplierBrand = doc.splitTextToSize(supplier, 120).slice(0, 2);
  doc.text(supplierBrand, 37, 33, { lineHeightFactor: 1.05 });
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("APRESENTAÇÃO COMERCIAL  •  PROPOSTA PROFISSIONAL", 37, 43);

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(31);
  doc.text("PROPOSTA", 37, 76);
  doc.setTextColor(...gold);
  doc.setFontSize(34);
  doc.text("COMERCIAL", 37, 90);
  doc.setFillColor(...gold);
  doc.rect(37, 95, Math.min(74, Math.max(35, doc.getTextWidth("COMERCIAL") + 5)), 2.8, "F");

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("APRESENTAÇÃO DE SERVIÇOS", 37, 107);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const coverTitle = doc.splitTextToSize(proposalTitle, 128).slice(0, 2);
  doc.text(coverTitle, 37, 116, { lineHeightFactor: 1.08 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text("APRESENTADA PARA", 37, 132);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text(doc.splitTextToSize(draft.recipient || "Cliente / empresa", 125).slice(0, 2), 37, 141, { lineHeightFactor: 1.12 });

  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.text("PREPARADA POR", 37, 226);
  doc.setTextColor(...navy);
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(supplier, 125).slice(0, 2), 37, 235, { lineHeightFactor: 1.08 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...muted);
  doc.text(supplierLocation || "Prestador de serviços", 37, 247);
  addFooter();

  // PÁGINA DE APRESENTAÇÃO
  let y = addStandardPage("APRESENTAÇÃO");
  y = drawTextCard(
    "Contexto da proposta",
    draft.description || "Esta proposta apresenta uma solução de serviços desenvolvida de acordo com as características do projeto e do público informado.",
    y,
    contentW,
    7
  );
  y = drawTextCard(
    "Objetivo",
    draft.objective || buildObjective(draft.proposalType),
    y,
    contentW,
    6
  );

  if (y + 64 > contentBottom) {
    addFooter();
    y = addStandardPage("INFORMAÇÕES DO PROJETO", "DADOS DA PROPOSTA");
  } else {
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("INFORMAÇÕES DO PROJETO", margin, y + 2);
    y += 13;
  }

  const info = [
    ["Tipo", draft.proposalType],
    ["Data", dateBR(draft.eventDate)],
    ["Horário", draft.eventTime || "A definir"],
    ["Duração", draft.duration || "A definir"],
    ["Local", draft.location || "A definir"],
    ["Público", draft.audience || "A definir"],
    ["Faixa etária", draft.ageRange || "A definir"],
    ["Responsável", draft.responsible || "A definir"],
  ];
  let infoY = y;
  info.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const ix = margin + col * 91;
    const iy = infoY + row * 17;
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(label.toUpperCase(), ix, iy);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    const valueLines = doc.splitTextToSize(value, 78).slice(0, 2);
    doc.text(valueLines, ix, iy + 6, { lineHeightFactor: 1.15 });
  });
  addFooter();

  // PÁGINA DE ATIVIDADES — a barra lateral acompanha a página e nunca encobre o conteúdo.
  const addActivitiesPage = (continuation = false) => {
    doc.addPage();
    pageNumber += 1;
    doc.setFillColor(255,255,255);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...navy);
    doc.rect(0, 0, 62, H, "F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("ATIVIDADES", 12, 39);
    doc.setTextColor(...gold);
    doc.setFontSize(15);
    doc.text("PROPOSTAS", 12, 49);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(225,231,239);
    const sideText = doc.splitTextToSize(
      continuation
        ? "Continuação das atividades previstas para o projeto."
        : "Uma programação pensada para promover participação, organização e uma experiência positiva para o público.",
      36
    );
    doc.text(sideText, 12, 65, { lineHeightFactor: 1.4 });
    doc.setFillColor(...gold);
    doc.rect(12, 108, 26, 2.5, "F");
    doc.setTextColor(255,255,255);
    doc.setFontSize(6.2);
    doc.text(supplier.toUpperCase().slice(0, 24), 12, 121);
    return 31;
  };

  let activityY = addActivitiesPage();
  const selected = draft.activities.length ? draft.activities : [draft.proposalType];
  selected.forEach((item) => {
    const itemLines = doc.splitTextToSize(item, 108).slice(0, 2);
    const lineCount = itemLines.length;
    const itemH = lineCount > 1 ? 18 : 14;
    if (activityY + itemH > 245) {
      addFooter();
      activityY = addActivitiesPage(true);
    }
    doc.setFillColor(...gold);
    doc.circle(76, activityY + 1.8, 1.5, "F");
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(itemLines, 82, activityY + 4.2, { lineHeightFactor: 1.18 });
    activityY += itemH + 3;
  });
  if (activityY + 32 > contentBottom) {
    addFooter();
    activityY = addActivitiesPage(true);
  }
  doc.setTextColor(...gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.text("DESENVOLVIMENTO", 73, activityY + 3);
  const method = draft.methodology || "As atividades serão conduzidas por profissionais responsáveis, com adaptação ao espaço, ao perfil do público e à dinâmica do evento. A programação poderá ser ajustada conforme as condições do local.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...muted);
  const methodLines = doc.splitTextToSize(method, 119).slice(0, 6);
  doc.text(methodLines, 73, activityY + 10, { lineHeightFactor: 1.32 });
  addFooter();

  // PÁGINA FINAL — os blocos são dimensionados pelo número real de linhas.
  let finalY = addStandardPage("DETALHAMENTO", "E CONSIDERAÇÕES FINAIS");

  const drawFinalCard = (heading: string, text: string, startY: number, maxLines = 6) => {
    const textWidth = contentW;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    const lines = doc.splitTextToSize(text || "Informação a definir.", textWidth);
    const chunks: string[][] = [];
    for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines));
    let cursor = startY;
    chunks.forEach((chunk, index) => {
      const bodyHeight = chunk.length * 4.1;
      if (cursor + 7 + bodyHeight > 250) {
        addFooter();
        cursor = addStandardPage("DETALHAMENTO", "CONTINUAÇÃO");
      }
      doc.setTextColor(...gold);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.4);
      doc.text(index === 0 ? heading.toUpperCase() : "CONTINUAÇÃO", margin, cursor);
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.8);
      doc.text(chunk, margin, cursor + 7, { maxWidth: textWidth, lineHeightFactor: 1.32 });
      cursor += 7 + bodyHeight + 9;
    });
    return cursor;
  };



  finalY = drawFinalCard(
    "Equipe e estrutura",
    draft.team || "Equipe dimensionada de acordo com o público, duração e características do projeto.",
    finalY,
    6
  );
  finalY = drawFinalCard(
    "Considerações",
    draft.notes || "A programação poderá ser ajustada em conjunto com o contratante após a análise das condições do local e das necessidades do público.",
    finalY,
    6
  );

  const drawCta = (startY: number) => {
    if (startY + 40 > 255) {
      addFooter();
      startY = addStandardPage("PRÓXIMOS PASSOS", "ENCAMINHAMENTO");
    }
    const lines = doc.splitTextToSize(ctaText || ctaOptions[0].text, contentW - 28).slice(0, 4);
    const h = Math.max(34, 22 + lines.length * 4.3);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.8);
    doc.line(margin, startY, margin + 28, startY);
    doc.setTextColor(...gold);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("PRÓXIMO PASSO", margin, startY + 7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(lines, margin, startY + 16, { lineHeightFactor: 1.25 });
    return startY + h;
  };

  finalY = drawCta(finalY + 3);

  const signatureY = Math.min(finalY + 13, 263);
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(supplier, margin, signatureY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text([supplierLocation, contact].filter(Boolean).join("  •  ") || "Prestador de serviços", margin, signatureY + 7);
  addFooter();

  doc.setProperties({
    title: `Proposta Comercial — ${proposalTitle}`,
    subject: "Proposta comercial",
    author: supplier,
    creator: supplier,
    keywords: "proposta comercial, apresentação, LOSI CONECTA",
  });
  const filename = `proposta-${(supplier || "empresa").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "empresa"}-${(draft.recipient || "cliente").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "cliente"}.pdf`;
  const pdfBlob = doc.output("blob");
  const downloadUrl = URL.createObjectURL(pdfBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = filename;
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

function ProposalsPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [customActivity, setCustomActivity] = useState("");
  const previewRef = useRef<HTMLElement | null>(null);
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
    eventStart: "",
    eventEnd: "",
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
      cta: "whatsapp",
      ctaCustom: "",
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

  function addCustomActivity() {
    const value = customActivity.trim();
    if (!value) return;
    setDraft(current => current.activities.includes(value)
      ? current
      : { ...current, activities: [...current.activities, value] });
    setCustomActivity("");
  }

  function updateEventTime(start: string, end: string) {
    setDraft(current => ({
      ...current,
      eventStart: start,
      eventEnd: end,
      eventTime: start && end ? `${start} às ${end}` : start || end,
      duration: calculateDuration(start, end),
    }));
  }

  async function togglePreviewFullscreen() {
    const element = previewRef.current;
    if (!element) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      setPreviewFullscreen(false);
      return;
    }

    // Alguns navegadores móveis, especialmente no iOS, não disponibilizam
    // Element.requestFullscreen(). Nesses casos usamos o modo fullscreen
    // visual da própria prévia, sem depender da API nativa.
    if (!element.requestFullscreen || document.fullscreenEnabled === false) {
      setPreviewFullscreen(true);
      return;
    }

    try {
      await element.requestFullscreen();
    } catch {
      setPreviewFullscreen(true);
    }
  }

  useEffect(() => {
    const syncFullscreen = () => {
      setPreviewFullscreen(document.fullscreenElement === previewRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

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
      cta: "whatsapp",
      ctaCustom: "",
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

    try {
      ProposalPdf({ draft: preview, business, profile });
      setMessage("Proposta gerada com sucesso. O PDF foi preparado para download.");
    } catch (error) {
      console.error("Erro ao gerar proposta em PDF:", error);
      setMessage("Não foi possível gerar o PDF. Verifique os dados preenchidos e tente novamente.");
    }
  }

  if (loading) return <main className="receipts-state">Carregando propostas...</main>;

  return (
    <main className="dashboard-page proposals-page">
      <div className="dashboard-sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} aria-hidden={!mobileMenuOpen}></div>
      <aside className={"dashboard-sidebar" + (mobileMenuOpen ? " mobile-open" : "")}>
        <div className="dashboard-sidebar-brand"><span>LOSI</span><strong>CONECTA</strong></div>
        <div className="dashboard-sidebar-caption">PAINEL PROFISSIONAL</div>
        <nav className="dashboard-sidebar-nav" aria-label="Menu do painel">
          <Link to="/painel" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">01</span><span><strong>Visão Geral</strong><small>Resumo da conta</small></span></Link>
          <Link to="/buscar" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">02</span><span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span></Link>
          <Link to="/meu-perfil" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">03</span><span><strong>Meu perfil</strong><small>Dados pessoais</small></span></Link>
          <Link to="/meus-servicos" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">04</span><span><strong>Minha empresa</strong><small>Serviços e presença</small></span></Link>
          <Link to="/notificar-inconsistencia" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">05</span><span><strong>Notificar inconsistência</strong><small>Falar com o administrador</small></span></Link>
          <div className="dashboard-nav-divider"><span>Operacional</span></div>
          <Link to="/orcamentos" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">06</span><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span></Link>
          <Link to="/recibos" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">07</span><span><strong>Recibos</strong><small>Comprovantes de serviço</small></span></Link>
          <Link to="/propostas" className="dashboard-nav-item active" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">08</span><span><strong>Propostas</strong><small>Apresentações comerciais</small></span></Link>
                  <Link to="/losi-ads" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">09</span><span><strong>LOSI ADS</strong><small>Eventos e oportunidades</small></span></Link>
          <Link to="/equipe-escalas" className="dashboard-nav-item" onClick={() => setMobileMenuOpen(false)}><span className="dashboard-nav-mark">10</span><span><strong>Equipe & Escalas</strong><small>Rede e calendário</small></span></Link>
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
              <div className="proposals-group-card">
                <div className="proposals-card-head"><div><span className="proposals-kicker">GRUPO 01</span><h2>Destinatário</h2></div><span className="proposals-step">1</span></div>
              <div className="proposals-form-grid">
                <label><span>Empresa / condomínio *</span><input value={draft.recipient} onChange={e => update("recipient", e.target.value)} placeholder="Ex.: Condomínio Parque das Flores" /></label>
                <label><span>Responsável</span><input value={draft.responsible} onChange={e => update("responsible", e.target.value)} placeholder="Nome do responsável" /></label>
                <label className="wide"><span>Telefone / WhatsApp</span><input value={draft.recipientContact} onChange={e => update("recipientContact", e.target.value)} placeholder="(11) 99999-9999" /></label>
              </div>

              </div>
              <div className="proposals-divider" />

              <div className="proposals-group-card">
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

              </div>
              <div className="proposals-divider" />

              <div className="proposals-group-card">
                <div className="proposals-card-head"><div><span className="proposals-kicker">GRUPO 03</span><h2>Conteúdo da apresentação</h2></div><span className="proposals-step">3</span></div>
              <div className="proposals-form-grid">
                <label className="wide"><span>O que você pretende realizar? *</span><textarea rows={5} value={draft.description} onChange={e => update("description", e.target.value)} placeholder="Ex.: Quero realizar uma atividade recreativa para as crianças do condomínio durante as férias, com brincadeiras, gincanas e pintura facial." /></label>
                <label className="wide"><span>Objetivo da atividade</span><textarea rows={4} value={draft.objective} onChange={e => update("objective", e.target.value)} /></label>
              </div>

              <div className="proposals-activities">
                <div className="proposals-field-label">Atividades propostas</div>
                <div className="proposals-check-grid">{activityOptions.map(item => <label key={item} className={draft.activities.includes(item) ? "selected" : ""}><input type="checkbox" checked={draft.activities.includes(item)} onChange={() => toggleActivity(item)} /><span>{item}</span></label>)}</div>
                <select className="proposals-activity-select-mobile" value="" onChange={e => { if (e.target.value) toggleActivity(e.target.value); }} aria-label="Selecionar atividade proposta"><option value="">Selecionar atividade...</option>{activityOptions.map(item => <option key={item} value={item}>{draft.activities.includes(item) ? `✓ ${item}` : item}</option>)}</select>
                 <div className="proposals-custom-activity">
                   <input value={customActivity} onChange={e => setCustomActivity(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomActivity(); } }} placeholder="Adicionar outra atividade manualmente" />
                   <button type="button" onClick={addCustomActivity}>Adicionar</button>
                 </div>
                 {draft.activities.some(item => !activityOptions.includes(item)) && <div className="proposals-custom-list">{draft.activities.filter(item => !activityOptions.includes(item)).map(item => <button type="button" key={item} onClick={() => toggleActivity(item)}>{item} ×</button>)}</div>}
              </div>

              <div className="proposals-form-grid">
                <label className="wide"><span>Como será realizado?</span><textarea rows={4} value={draft.methodology} onChange={e => update("methodology", e.target.value)} placeholder="Descreva equipe, condução, adaptação ao espaço e dinâmica." /></label>
                <label className="wide"><span>Equipe / estrutura</span><textarea rows={3} value={draft.team} onChange={e => update("team", e.target.value)} placeholder="Ex.: 4 profissionais de recreação." /></label>
                <label className="wide"><span>Considerações finais</span><textarea rows={3} value={draft.notes} onChange={e => update("notes", e.target.value)} placeholder="Informações adicionais, condições do local ou próximos passos." /></label>
              </div>

              </div>
              <div className="proposals-cta-group proposals-group-card">
                <div className="proposals-card-head">
                  <div><span className="proposals-kicker">GRUPO 04</span><h2>Chamada para ação</h2></div>
                  <span className="proposals-step">4</span>
                </div>
                <div className="proposals-form-grid">
                  <label className="wide"><span>CTA final do PDF</span>
                    <select value={draft.cta} onChange={e => update("cta", e.target.value)}>
                      {ctaOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  {draft.cta === "custom" && (
                    <label className="wide"><span>Texto personalizado</span>
                      <textarea rows={3} value={draft.ctaCustom} onChange={e => update("ctaCustom", e.target.value)} placeholder="Ex.: Vamos conversar e definir juntos os próximos passos deste projeto." />
                    </label>
                  )}
                </div>
                <p className="proposals-cta-help">A CTA será o encerramento comercial da proposta e aparecerá em destaque na última página do PDF.</p>
              </div>

              <div className="proposals-actions">
                <button type="button" className="proposals-secondary" onClick={newProposal}>Limpar</button>
                <button type="button" className="proposals-primary" onClick={generate}>Gerar proposta em PDF</button>
              </div>
              <p className="proposals-note">A proposta não inclui valores. Ela funciona como apresentação inicial do trabalho; orçamento e condições comerciais podem ser tratados separadamente.</p>
            </section>

            <aside ref={previewRef} className={"proposals-preview-panel" + (previewFullscreen ? " is-fullscreen" : "")}>
              <div className="proposals-preview-head"><div><span className="proposals-kicker">VISUALIZAÇÃO</span><h2>Prévia da proposta</h2></div><div className="proposals-preview-tools"><span className="proposals-preview-status">A4 • PDF</span><button type="button" className="proposals-preview-fullscreen" onClick={() => void togglePreviewFullscreen()}>{previewFullscreen ? "Sair da tela inteira" : "Tela inteira"}</button></div></div>
              <div className="proposal-document-preview">
                <div className="proposal-preview-page proposal-preview-cover">
                  <div className="proposal-cover-lines"></div>
                  <div className="proposal-cover-brand"><strong>{supplier}</strong><span>PROPOSTA</span></div>
                  <div className="proposal-cover-title"><small>APRESENTAÇÃO DE SERVIÇOS</small><h3>PROPOSTA</h3><h4>COMERCIAL</h4><i></i><strong>{preview.title}</strong><span>APRESENTADA PARA</span><b>{preview.recipient || "Cliente / empresa"}</b></div>
                  <div className="proposal-cover-footer"><span>PREPARADA POR</span><strong>{supplier}</strong><small>{[business?.city || profile?.city, business?.state || profile?.state].filter(Boolean).join(" — ") || "LOSI Gestão em Lazer"}</small></div>
                </div>

                <div className="proposal-preview-page proposal-preview-presentation">
                  <div className="proposal-preview-standard-head"><span>02</span><h3>APRESENTAÇÃO</h3></div>
                  <div className="proposal-preview-text-section"><small>CONTEXTO DA PROPOSTA</small><p>{preview.description || "Sua descrição aparecerá aqui."}</p></div>
                  <div className="proposal-preview-text-section"><small>OBJETIVO</small><p>{preview.objective || buildObjective(preview.proposalType)}</p></div>
                  <h5>INFORMAÇÕES DO PROJETO</h5>
                  <div className="proposal-preview-info">{[["Tipo",preview.proposalType],["Data",dateBR(preview.eventDate)],["Horário",preview.eventTime||"A definir"],["Duração",preview.duration||"A definir"],["Local",preview.location||"A definir"],["Público",preview.audience||"A definir"],["Faixa etária",preview.ageRange||"A definir"],["Responsável",preview.responsible||"A definir"]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
                </div>

                <div className="proposal-preview-page proposal-preview-activities">
                  <div className="proposal-preview-side"><strong>ATIVIDADES</strong><span>PROPOSTAS</span><small>Uma programação pensada para promover participação, organização e uma experiência positiva para o público.</small></div>
                  <div className="proposal-preview-activity-content"><h3>ATIVIDADES</h3>{(preview.activities.length?preview.activities:[preview.proposalType]).slice(0,7).map(item=><div key={item}><i></i><span>{item}</span></div>)}<h5>DESENVOLVIMENTO</h5><p>{preview.methodology || "A programação será conduzida por profissionais e adaptada ao espaço, ao perfil do público e à dinâmica do evento."}</p></div>
                </div>

                <div className="proposal-preview-page proposal-preview-detail">
                  <div className="proposal-preview-standard-head"><span>04</span><h3>DETALHAMENTO</h3><small>E CONSIDERAÇÕES FINAIS</small></div>
                  <div className="proposal-preview-text-section"><small>EQUIPE E ESTRUTURA</small><p>{preview.team || "Equipe dimensionada de acordo com o público, duração e características do projeto."}</p></div>
                  <div className="proposal-preview-text-section"><small>CONSIDERAÇÕES</small><p>{preview.notes || "A programação poderá ser ajustada em conjunto com o contratante após a análise do local e das necessidades do público."}</p></div>
                  <div className="proposal-preview-next"><small>PRÓXIMO PASSO</small><strong>{(preview.cta === "custom" ? preview.ctaCustom : ctaOptions.find(item => item.value === preview.cta)?.text || ctaOptions[0].text) || "Fale conosco para alinharmos os próximos passos."}</strong></div>
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
