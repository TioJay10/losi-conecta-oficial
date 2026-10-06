import { PanelMenuIcon } from "../components/PanelMenuIcon";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";
import "../receipts.css";


export const Route = createFileRoute("/recibos")({ component: ReceiptsPage });

type Business = {
  business_name: string | null; owner_id: string; document?: string | null;
  address: string | null; bairro: string | null; city: string | null; state: string | null;
  cep: string | null; phone: string | null; whatsapp: string | null;
};
type Profile = {
  full_name: string | null; document: string | null; address: string | null;
  city: string | null; state: string | null; cep: string | null;
};
type ReceiptData = {
  id: string; number: string; profilePhotoUrl?: string | null; clientName: string; clientDocument: string; clientAddress: string;
  service: string; serviceDate: string; amount: number; paymentMethod: string;
  description: string; city: string; signatureData: string | null; createdAt: string;
};

function amountFromInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateBR(value: string) {
  if (!value) return "—";
  const [y,m,d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}


function SignaturePad({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const position = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const point = position(event);
    const context = canvas.getContext("2d")!;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const point = position(event);
    const context = canvasRef.current!.getContext("2d")!;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#071a33";
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="receipts-signature-pad">
      <canvas ref={canvasRef} width={760} height={220} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
      <button type="button" onClick={clear}>Limpar assinatura</button>
      <label className="receipts-signature-upload">
        <span>Ou enviar assinatura em imagem</span>
        <input type="file" accept="image/png,image/jpeg" onChange={event => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > 500000) {
            window.alert("A assinatura deve ter até 500 KB.");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => onChange(String(reader.result));
          reader.readAsDataURL(file);
        }} />
      </label>
      {value && <span className="receipts-signature-status">✓ Assinatura adicionada ao recibo</span>}
    </div>
  );
}

function buildReceiptPdf({ receipt, business, profile }: { receipt: ReceiptData; business: Business | null; profile: Profile | null }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 18;

  const line = (yy: number) => {
    doc.setDrawColor(214, 180, 106);
    doc.setLineWidth(0.35);
    doc.line(margin, yy, pageW - margin, yy);
  };
  const box = (yy: number, h: number, fill = [255,255,255]) => {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(225, 229, 236);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yy, contentW, h, 3, 3, "FD");
  };
  const textBlock = (text: string, x: number, yy: number, width: number, size = 10, color = [45,55,72]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text || "—", width);
    doc.text(lines, x, yy);
    return lines.length * (size * 0.42);
  };

  doc.setFillColor(7,26,51);
  doc.rect(0, 0, pageW, 48, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("LOSI", margin, 20);
  doc.setTextColor(240,217,154);
  doc.setFontSize(12);
  doc.text("CONECTA", margin + 18, 20);
  doc.setTextColor(255,255,255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("RECIBO DE PRESTAÇÃO DE SERVIÇOS", margin, 31);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Nº ${receipt.number}`, pageW - margin, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(214,180,106);
  doc.text(`Emitido em ${new Date(receipt.createdAt).toLocaleDateString("pt-BR")}`, pageW - margin, 28, { align: "right" });
  y = 59;

  doc.setTextColor(7,26,51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Comprovante de recebimento", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(95,105,120);
  const intro = `Declaro, para os devidos fins, que recebi de ${receipt.clientName || "________________________________"} a importância abaixo referente aos serviços descritos neste documento.`;
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, margin, y);
  y += introLines.length * 4.2 + 8;

  box(y, 30, [248,250,252]);
  doc.setTextColor(105,115,130);
  doc.setFontSize(8);
  doc.text("VALOR RECEBIDO", margin + 7, y + 8);
  doc.setTextColor(7,26,51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(money(receipt.amount), margin + 7, y + 18);
  doc.setFontSize(9);
  doc.setTextColor(95,105,120);
  doc.setFont("helvetica", "normal");
  doc.text(`Forma de pagamento: ${receipt.paymentMethod || "Não informada"}`, pageW - margin - 7, y + 17, { align: "right" });
  y += 39;

  box(y, 48);
  doc.setTextColor(7,26,51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PARTES", margin + 7, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(105,115,130);
  doc.text("PRESTADOR", margin + 7, y + 17);
  doc.setTextColor(35,45,60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const providerLines = doc.splitTextToSize(business?.business_name || profile?.full_name || "Prestador", contentW/2 - 14).slice(0, 1);
  doc.text(providerLines, margin + 7, y + 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(95,105,120);
  doc.text(`Documento: ${business?.document || profile?.document || "Não informado"}`, margin + 7, y + 30);
  doc.text([business?.city || profile?.city, business?.state || profile?.state].filter(Boolean).join(" / ") || "—", margin + 7, y + 36);

  doc.setTextColor(105,115,130);
  doc.text("CONTRATANTE / PAGADOR", margin + contentW/2 + 7, y + 17);
  doc.setTextColor(35,45,60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const clientLines = doc.splitTextToSize(receipt.clientName || "Não informado", contentW/2 - 14).slice(0, 1);
  doc.text(clientLines, margin + contentW/2 + 7, y + 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(95,105,120);
  doc.text(`Documento: ${receipt.clientDocument || "Não informado"}`, margin + contentW/2 + 7, y + 30);
  const clientAddress = receipt.clientAddress || "Endereço não informado";
  doc.text(doc.splitTextToSize(clientAddress, contentW/2 - 14), margin + contentW/2 + 7, y + 36);
  y += 57;

  box(y, 48, [255,255,255]);
  doc.setTextColor(7,26,51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("SERVIÇO", margin + 7, y + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(35,45,60);
  const serviceLines = doc.splitTextToSize(receipt.service || "Prestação de serviços", contentW - 14).slice(0, 2);
  doc.text(serviceLines, margin + 7, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(105,115,130);
  doc.text(`Data do serviço: ${dateBR(receipt.serviceDate)}`, margin + 7, y + 30);
  const descLines = doc.splitTextToSize(receipt.description || "Sem observações adicionais.", contentW - 14);
  doc.setTextColor(75,85,100);
  doc.text(descLines.slice(0, 2), margin + 7, y + 38);
  y += 57;

  doc.setFillColor(247,249,252);
  doc.setDrawColor(225,229,236);
  doc.roundedRect(margin, y, contentW, 25, 3, 3, "FD");
  doc.setTextColor(105,115,130);
  doc.setFontSize(8);
  doc.text("LOCAL E DATA", margin + 7, y + 8);
  doc.setTextColor(35,45,60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`${receipt.city || business?.city || "________________"}, ${new Date(receipt.createdAt).toLocaleDateString("pt-BR")}`, margin + 7, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(105,115,130);
  doc.text("Documento gerado pelo LOSI CONECTA", pageW - margin - 7, y + 12, { align: "right" });
  y += 39;

  line(y);
  y += 16;
  if (receipt.signatureData) {
    try {
      doc.addImage(receipt.signatureData, "PNG", pageW / 2 - 28, y - 14, 56, 16);
    } catch {}
  }
  doc.setDrawColor(80,90,105);
  doc.line(pageW/2 - 35, y, pageW/2 + 35, y);
  doc.setTextColor(80,90,105);
  doc.setFontSize(8);
  doc.text("Assinatura do prestador", pageW/2, y + 6, { align: "center" });
  doc.setTextColor(145,150,158);
  doc.setFontSize(7);
  doc.text("Este documento registra o recebimento informado pelo prestador.", pageW/2, 282, { align: "center" });
  return doc;
}

function openReceiptPdf(receipt: ReceiptData, business: Business | null, profile: Profile | null) {
  const doc = buildReceiptPdf({ receipt, business, profile });
  const url = URL.createObjectURL(doc.output("blob"));
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = `recibo-${receipt.number}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function ReceiptsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [service, setService] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0,10));
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [history, setHistory] = useState<ReceiptData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const user = sessionData.session?.user;
        if (!user) {
          if (active) setLoading(false);
          navigate({ to: "/entrar" });
          return;
        }

        setUserId(user.id);
        const [businessResult, profileResult] = await Promise.all([
          supabase.from("business_profiles").select("business_name,owner_id,address,bairro,city,state,cep,phone,whatsapp").eq("owner_id", user.id).maybeSingle(),
          supabase.from("profiles").select("full_name,address,city,state,cep").eq("id", user.id).maybeSingle(),
        ]);
        if (businessResult.error) throw businessResult.error;
        if (profileResult.error) throw profileResult.error;
        if (!active) return;

        let loadedBusiness = (businessResult.data as Business | null) ?? null;
        try {
          const { data: supplierIdentity } = await supabase.functions.invoke("get-supplier-receipt-profile");
          if (supplierIdentity && loadedBusiness) {
            loadedBusiness = {
              ...loadedBusiness,
              business_name: supplierIdentity.businessName || loadedBusiness.business_name,
              document: supplierIdentity.document || null,
              logo_url: supplierIdentity.logoUrl || loadedBusiness.logo_url || null,
            };
          }
        } catch (identityError) {
          console.warn("Não foi possível carregar a identificação do fornecedor:", identityError);
        }

        const loadedProfile = (profileResult.data as Profile | null) ?? null;
        setBusiness(loadedBusiness);
        setProfile(loadedProfile);
        setCity(loadedBusiness?.city || loadedProfile?.city || "");

        const { data: savedReceipts, error: savedReceiptsError } = await supabase
          .from("issued_receipts")
          .select("id,receipt_number,client_name,client_document,client_address,service,service_date,amount_cents,payment_method,description,city,issuer_photo_url,signature_data,created_at")
          .eq("issuer_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (savedReceiptsError) {
          console.error("Erro ao carregar recibos salvos:", savedReceiptsError);
          setMessage("Não foi possível carregar o histórico salvo.");
        } else {
          setHistory((savedReceipts ?? []).map((item) => ({
            id: item.id,
            number: item.receipt_number,
            profilePhotoUrl: item.issuer_photo_url,
            clientName: item.client_name,
            clientDocument: item.client_document || "",
            clientAddress: item.client_address || "",
            service: item.service,
            serviceDate: item.service_date || "",
            amount: Number(item.amount_cents || 0) / 100,
            paymentMethod: item.payment_method || "",
            description: item.description || "",
            city: item.city || "",
            signatureData: item.signature_data || null,
            createdAt: item.created_at,
          })));
        }
      } catch (error) {
        console.error("Erro ao carregar recibos:", error);
        if (active) setMessage("Não foi possível carregar os recibos. Verifique sua sessão e tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [navigate]);

  const supplierName = business?.business_name || profile?.full_name || "Seu nome";
  const supplierDocument = business?.document || profile?.document || "Não informado";
  const amountNumber = amountFromInput(amount);
  const preview = useMemo<ReceiptData>(() => ({
    id: "preview",
    number: "PREVIEW",
    profilePhotoUrl: business?.logo_url || profile?.avatar_url || null,
    clientName, clientDocument, clientAddress, service, serviceDate,
    amount: amountNumber, paymentMethod, description, signatureData,
    city: city || business?.city || profile?.city || "",
    createdAt: new Date().toISOString(),
  }), [clientName,clientDocument,clientAddress,service,serviceDate,amountNumber,paymentMethod,description,city,signatureData,business,profile]);

  function resetForm() {
    setClientName(""); setClientDocument(""); setClientAddress(""); setService("");
    setServiceDate(new Date().toISOString().slice(0,10)); setAmount("");
    setPaymentMethod("PIX"); setDescription(""); setSignatureData(null);
  }

  async function generate() {
    if (!clientName.trim() || !service.trim() || amountNumber <= 0) {
      setMessage("Preencha contratante, serviço e um valor maior que zero.");
      return;
    }
    if (!userId) {
      setMessage("Sua sessão não está disponível. Entre novamente.");
      return;
    }

    const receipt: ReceiptData = {
      ...preview,
      id: crypto.randomUUID(),
      number: `RC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      createdAt: new Date().toISOString(),
    };

    const issuerDocument = supplierDocument !== "Não informado" ? supplierDocument : null;
    const issuerPhotoUrl = business?.logo_url || profile?.avatar_url || null;
    const issuerPhone = business?.phone || business?.whatsapp || null;
    const issuerAddress = [business?.address, business?.bairro, business?.city, business?.state, business?.cep].filter(Boolean).join(", ") || null;

    const { error: saveError } = await supabase.from("issued_receipts").insert({
      issuer_user_id: userId,
      business_id: business?.id || null,
      receipt_number: receipt.number,
      client_name: receipt.clientName,
      client_document: receipt.clientDocument || null,
      client_address: receipt.clientAddress || null,
      service: receipt.service,
      service_date: receipt.serviceDate || null,
      amount_cents: Math.round(receipt.amount * 100),
      payment_method: receipt.paymentMethod || null,
      description: receipt.description || null,
      city: receipt.city || null,
      issuer_name: supplierName,
      issuer_document: issuerDocument,
      issuer_phone: issuerPhone,
      issuer_address: issuerAddress,
      issuer_photo_url: issuerPhotoUrl,
      signature_data: receipt.signatureData || null,
      created_at: receipt.createdAt,
    });

    if (saveError) {
      console.error("Erro ao salvar recibo:", saveError);
      setMessage("Não foi possível salvar o recibo. Verifique sua sessão e tente novamente.");
      return;
    }

    setHistory((current) => [receipt, ...current].slice(0, 100));
    setMessage(`Recibo ${receipt.number} salvo e gerado com sucesso.`);
    openReceiptPdf(receipt, business, profile);
  }

  if (loading) return <main className="receipts-state">Carregando recibos...</main>;

  return (
    <main className="dashboard-page receipts-page">
      <aside className="dashboard-sidebar receipts-sidebar">
        <div className="dashboard-sidebar-brand"><span>LOSI</span><strong>CONECTA</strong></div>
        <div className="dashboard-sidebar-caption">PAINEL PROFISSIONAL</div>
        <nav className="dashboard-sidebar-nav" aria-label="Menu do painel">
          <Link to="/painel" className="dashboard-nav-item"><PanelMenuIcon name="overview" /><span><strong>Visão Geral</strong><small>Resumo da conta</small></span></Link>
          <Link to="/buscar" className="dashboard-nav-item"><PanelMenuIcon name="search" /><span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span></Link>
          <Link to="/meu-perfil" className="dashboard-nav-item"><PanelMenuIcon name="profile" /><span><strong>Meu perfil</strong><small>Dados pessoais</small></span></Link>
          <Link to="/meus-servicos" className="dashboard-nav-item"><PanelMenuIcon name="businesses" /><span><strong>Minha empresa</strong><small>Serviços e presença</small></span></Link>
          <Link to="/notificar-inconsistencia" className="dashboard-nav-item"><PanelMenuIcon name="inconsistencies" /><span><strong>Notificar inconsistência</strong><small>Falar com o administrador</small></span></Link>
          <div className="dashboard-nav-divider"><span>Operacional</span></div>
          <Link to="/orcamentos" className="dashboard-nav-item"><PanelMenuIcon name="quotes" /><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span></Link>
          <Link to="/recibos" className="dashboard-nav-item active"><PanelMenuIcon name="receipts" /><span><strong>Recibos</strong><small>Comprovantes de serviço</small></span></Link>
          <Link to="/propostas" className="dashboard-nav-item"><PanelMenuIcon name="proposals" /><span><strong>Propostas</strong><small>Apresentações comerciais</small></span></Link>
                  <Link to="/losi-ads" className="dashboard-nav-item"><PanelMenuIcon name="ads" /><span><strong>LOSI ADS</strong><small>Eventos e oportunidades</small></span></Link>
          <Link to="/equipe-escalas" className="dashboard-nav-item"><PanelMenuIcon name="team" /><span><strong>Equipe & Escalas</strong><small>Rede e calendário</small></span></Link>
</nav>
        <div className="dashboard-sidebar-footer"><div className="dashboard-sidebar-status"><span></span> Conta profissional</div><Link to="/painel" className="dashboard-sidebar-logout">Voltar ao painel</Link></div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header receipts-header">
          <div className="dashboard-header-context"><span>DOCUMENTOS PROFISSIONAIS</span><strong>Recibos</strong></div>
          <div className="dashboard-header-right"><Link to="/painel" className="dashboard-secondary receipts-back">Voltar ao painel</Link></div>
        </header>

        <section className="dashboard-content receipts-content">
          <div className="receipts-hero">
            <div>
              <div className="dashboard-badge">RECIBOS</div>
              <h1>Comprovante de prestação de serviços</h1>
              <p>Crie recibos profissionais com a identidade visual do LOSI CONECTA e gere o PDF pronto para enviar ao contratante.</p>
            </div>
            <div className="receipts-hero-mark"><span>LOSI</span><strong>CONECTA</strong><small>DOCUMENTO PROFISSIONAL</small></div>
          </div>

          {message && <div className="receipts-message">{message}</div>}

          <div className="receipts-mode-grid"><Link to="/recibos" className="receipts-mode-card active"><span>01</span><strong>Emitir recibo</strong><small>Para entregar ao seu contratante</small></Link><Link to="/recibos-recebidos" className="receipts-mode-card"><span>02</span><strong>Recebidos</strong><small>Solicite e receba recibos de prestadores</small></Link></div>

          <div className="receipts-layout">
            <section className="receipts-form-card">
              <div className="receipts-card-head"><div><span className="receipts-kicker">GRUPO 01</span><h2 data-panel-icon="users">Dados do contratante</h2></div><span className="receipts-step">1</span></div>
              <div className="receipts-form-grid">
                <label><span>Nome / Razão Social *</span><input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Nome do contratante" /></label>
                <label><span>CPF / CNPJ</span><input value={clientDocument} onChange={e=>setClientDocument(e.target.value)} placeholder="000.000.000-00" /></label>
                <label className="wide"><span>Endereço</span><input value={clientAddress} onChange={e=>setClientAddress(e.target.value)} placeholder="Rua, número, bairro, cidade..." /></label>
              </div>

              <div className="receipts-divider" />

              <div className="receipts-card-head"><div><span className="receipts-kicker">GRUPO 02</span><h2 data-panel-icon="receipts">Serviço e recebimento</h2></div><span className="receipts-step">2</span></div>
              <div className="receipts-form-grid">
                <label className="wide"><span>Serviço prestado *</span><input value={service} onChange={e=>setService(e.target.value)} placeholder="Ex.: Recreação infantil por 4 horas" /></label>
                <label><span>Data do serviço</span><input type="date" value={serviceDate} onChange={e=>setServiceDate(e.target.value)} /></label>
                <label><span>Valor recebido *</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="R$ 0,00" /></label>
                <label><span>Forma de pagamento</span><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Boleto</option><option>Outro</option></select></label>
                <label><span>Local de emissão</span><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Cidade / UF" /></label>
                <label className="wide"><span>Descrição / observações</span><textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Informações adicionais sobre o serviço..." /></label>
              </div>

              <div className="receipts-signature-group">
                <div className="receipts-card-head"><div><span className="receipts-kicker">GRUPO 03</span><h2 data-panel-icon="signature">Assinatura do prestador</h2></div><span className="receipts-step">3</span></div>
                <p className="receipts-signature-help">Assine diretamente na tela ou envie uma imagem da sua assinatura. Ela será incluída no PDF.</p>
                <SignaturePad value={signatureData} onChange={setSignatureData} />
              </div>

              <div className="receipts-provider">
                <div>
                  {business?.logo_url || profile?.avatar_url ? <img className="receipts-provider-photo" src={business?.logo_url || profile?.avatar_url || ""} alt="Foto do perfil público do prestador" /> : null}
                  <span>PRESTADOR</span><strong>{supplierName}</strong>
                </div>
                <div><span>DOCUMENTO</span><strong>{supplierDocument}</strong></div>
              </div>

              <button type="button" className="receipts-primary" onClick={generate}>Gerar recibo em PDF</button>
              <p className="receipts-note">O PDF será gerado em formato A4, com cabeçalho LOSI, seções separadas e espaçamento calculado para evitar sobreposição.</p>
            </section>

            <aside className="receipts-preview-card">
              <div className="receipts-card-head"><div><span className="receipts-kicker">VISUALIZAÇÃO</span><h2>Prévia do recibo</h2></div></div>
              <div className="receipt-paper">
                <div className="receipt-paper-top"><div><strong>LOSI</strong> <span>CONECTA</span><small>RECIBO DE PRESTAÇÃO DE SERVIÇOS</small></div><b>Nº PREVIEW</b></div>
                <div className="receipt-paper-title">Comprovante de recebimento</div>
                <p>Declaro que recebi de <strong>{clientName || "Nome do contratante"}</strong> a importância abaixo referente ao serviço descrito.</p>
                <div className="receipt-paper-value"><small>VALOR RECEBIDO</small><strong>{money(amountNumber)}</strong><span>{paymentMethod}</span></div>
                <div className="receipt-paper-section"><small>PRESTADOR</small>{(business?.logo_url || profile?.avatar_url) ? <img className="receipt-paper-provider-photo" src={business?.logo_url || profile?.avatar_url || ""} alt="" /> : null}<strong>{supplierName}</strong><small>CONTRATANTE / PAGADOR</small><strong>{clientName || "—"}</strong></div>
                <div className="receipt-paper-section"><small>SERVIÇO</small><strong>{service || "Prestação de serviços"}</strong><span>{dateBR(serviceDate)}</span></div>
                <div className="receipt-paper-signature">{signatureData ? <img src={signatureData} alt="Assinatura do prestador" /> : null}<span>Assinatura do prestador</span></div><div className="receipt-paper-footer">Documento profissional LOSI CONECTA</div>
              </div>
            </aside>
          </div>

          <section className="receipts-history-card">
            <div className="receipts-card-head"><div><span className="receipts-kicker">HISTÓRICO</span><h2 data-panel-icon="proposals">Recibos gerados</h2></div><span className="receipts-count">{history.length}</span></div>
            {history.length === 0 ? <div className="receipts-empty"><strong>Nenhum recibo gerado ainda</strong><span>Os recibos criados por este navegador aparecerão aqui para consulta rápida.</span></div> : (
              <div className="receipts-history-list">
                {history.map(item => <article key={item.id}><div><strong>{item.number}</strong><span>{item.clientName} · {item.service}</span></div><div className="receipts-history-meta"><b>{money(item.amount)}</b><span>{dateBR(item.serviceDate)}</span><button type="button" onClick={()=>openReceiptPdf(item,business,profile)}>Baixar PDF</button></div></article>)}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
