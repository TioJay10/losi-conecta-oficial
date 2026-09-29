import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { AppLogo } from "../components/AppLogo";
import { jsPDF } from "jspdf";

type RequestRow = {
  id: string;
  business_id: string;
  requester_id: string;
  service_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  event_title: string;
  event_date: string | null;
  event_location: string | null;
  description: string | null;
  status: string;
  created_at: string;
  source?: "request" | "direct" | null;
  services?: { name: string } | null;
};

type QuoteRow = {
  id: string;
  request_id: string;
  business_id: string;
  client_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  validity_until: string | null;
  notes: string | null;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
  public_response_token?: string;
  quote_items?: { id: string; description: string; quantity: number; unit_price: number; total: number }[];
  quote_requests?: RequestRow;
};

type BusinessContact = {
  id: string;
  owner_id: string;
  business_name: string;
  slug: string | null;
  whatsapp: string | null;
  phone: string | null;
  address: string | null;
  bairro: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
};

type PublicProfile = {
  owner_id: string;
  slug: string;
  business_name: string;
};

type PersonalIdentity = {
  full_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
};


export const Route = createFileRoute("/orcamentos")({
  component: QuotesPage,
});

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Aguardando orçamento",
    quoted: "Orçamento enviado",
    accepted: "Aceito",
    rejected: "Recusado",
    cancelled: "Cancelado",
    expired: "Expirado",
    draft: "Rascunho",
    sent: "Enviado",
    viewed: "Visualizado",
  };
  return labels[status] || status;
}

function QuotesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [dashboardFilter, setDashboardFilter] = useState<"sent" | "accepted" | "rejected" | null>(null);
  const [dashboardDateFilter, setDashboardDateFilter] = useState<"all" | "day" | "month" | "year">("all");
  const [dashboardDateValue, setDashboardDateValue] = useState("");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [clientRequests, setClientRequests] = useState<RequestRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [clientQuotes, setClientQuotes] = useState<QuoteRow[]>([]);
  const [businessContacts, setBusinessContacts] = useState<Record<string, BusinessContact>>({});
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, PublicProfile>>({});
  const [personalIdentity, setPersonalIdentity] = useState<PersonalIdentity | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [proposalMode, setProposalMode] = useState<"request" | "direct">("direct");
  const [proposalRequestId, setProposalRequestId] = useState("");
  const [proposalRecipientName, setProposalRecipientName] = useState("");
  const [proposalRecipientPhone, setProposalRecipientPhone] = useState("");
  const [proposalEventTitle, setProposalEventTitle] = useState("");
  const [proposalEventDate, setProposalEventDate] = useState("");
  const [proposalEventLocation, setProposalEventLocation] = useState("");
  const [proposalEventDescription, setProposalEventDescription] = useState("");
  const [proposalItems, setProposalItems] = useState([{ description: "", quantity: "1", unitPrice: "" }]);
  const [proposalDiscount, setProposalDiscount] = useState("0");
  const [proposalValidity, setProposalValidity] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");
  const [proposalProfileLink, setProposalProfileLink] = useState("");
  const [resolvedProposalRecipient, setResolvedProposalRecipient] = useState<BusinessContact | null>(null);
  const [resolvingProposalRecipient, setResolvingProposalRecipient] = useState(false);
  const [savingProposal, setSavingProposal] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      if (!currentUser) {
        navigate({ to: "/entrar" });
        return;
      }

      const { data: business } = await supabase
        .from("business_profiles")
        .select("id,owner_id,business_name,slug,whatsapp,phone,address,bairro,city,state,cep")
        .eq("owner_id", currentUser.id)
        .maybeSingle();

      if (!mounted) return;
      setUserId(currentUser.id);
      setUserEmail(currentUser.email || "");

      const { data: identityData } = await supabase
        .from("profiles")
        .select("full_name,address,city,state,cep")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (mounted) setPersonalIdentity((identityData ?? null) as PersonalIdentity | null);

      if (business?.id) {
        setBusinessId(business.id);
        setBusinessContacts({ [business.id]: business as BusinessContact });

        const [{ data: requestRows, error: requestsError }, { data: quoteRows, error: quotesError }] = await Promise.all([
          supabase.from("quote_requests")
            .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name)")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
          supabase.from("quotes")
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,responded_at,created_at,public_response_token,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name))")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
        ]);

        if (requestsError) console.error("Erro ao carregar solicitações de orçamento:", requestsError);
        if (quotesError) console.error("Erro ao carregar orçamentos enviados:", quotesError);

        const { data: requestedByUser } = await supabase
          .from("quote_requests")
          .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name)")
          .eq("requester_id", currentUser.id)
          .order("created_at", { ascending: false });

        const { data: receivedByUser } = await supabase
          .from("quotes")
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,responded_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name))")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });

        const allRequests = [
          ...((requestRows ?? []) as unknown as RequestRow[]),
          ...((requestedByUser ?? []) as unknown as RequestRow[]),
          ...((quoteRows ?? []).map((quote: any) => quote.quote_requests).filter(Boolean) as RequestRow[]),
          ...((receivedByUser ?? []).map((quote: any) => quote.quote_requests).filter(Boolean) as RequestRow[]),
        ];
        const requesterIds = [...new Set(allRequests.map((request) => request.requester_id).filter(Boolean))];
        if (requesterIds.length > 0) {
          const { data: requesterBusinesses } = await supabase
            .from("business_profiles")
            .select("owner_id,slug,business_name")
            .in("owner_id", requesterIds)
            .eq("active", true);
          const profileMap = (requesterBusinesses ?? []).reduce<Record<string, PublicProfile>>((map, profile) => {
            map[profile.owner_id] = profile as PublicProfile;
            return map;
          }, {});
          if (mounted) setRequesterProfiles(profileMap);
        }

        if (mounted) {
          setRequests(((requestRows ?? []).filter((request: any) => request.source !== "direct")) as unknown as RequestRow[]);
          setQuotes((quoteRows ?? []) as unknown as QuoteRow[]);
          setClientRequests(((requestedByUser ?? []).filter((request: any) => request.source !== "direct")) as unknown as RequestRow[]);
          setClientQuotes((receivedByUser ?? []) as unknown as QuoteRow[]);
          if (requestsError || quotesError) {
            setMessage("Não foi possível carregar todos os dados de orçamento. Tente atualizar a página.");
          }
        }

        const firstDay = new Date();
        firstDay.setDate(1);
        firstDay.setHours(0, 0, 0, 0);
        const requestedRowsForMonth = (requestedByUser ?? []).filter((request: any) => new Date(request.created_at) >= firstDay);
      } else {
        const { data: requested, error: requestedError } = await supabase
          .from("quote_requests")
          .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name)")
          .eq("requester_id", currentUser.id)
          .order("created_at", { ascending: false });

        const { data: received, error: receivedError } = await supabase
          .from("quotes")
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,responded_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name))")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (requestedError) console.error("Erro ao carregar solicitações enviadas:", requestedError);
        if (receivedError) console.error("Erro ao carregar orçamentos recebidos:", receivedError);

        if (mounted) {
          setClientRequests(((requested ?? []).filter((request: any) => request.source !== "direct")) as unknown as RequestRow[]);
          setClientQuotes((received ?? []) as unknown as QuoteRow[]);
          const firstDay = new Date();
          firstDay.setDate(1);
          firstDay.setHours(0, 0, 0, 0);

          const businessIds = [...new Set((received ?? []).map((quote: any) => quote.business_id).filter(Boolean))];
          if (businessIds.length > 0) {
            const { data: businesses } = await supabase
              .from("business_profiles")
              .select("id,owner_id,business_name,slug,whatsapp,phone,address,bairro,city,state,cep")
              .in("id", businessIds);

            const contacts = (businesses ?? []).reduce<Record<string, BusinessContact>>((map, business) => {
              map[business.id] = business as BusinessContact;
              return map;
            }, {});
            setBusinessContacts(contacts);
          }
        }
      }

      if (mounted) setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    if (loading || !userId) return;

    let active = true;

    async function refreshQuoteData() {
      const clientRequestsPromise = supabase
        .from("quote_requests")
        .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name)")
        .eq("requester_id", userId)
        .order("created_at", { ascending: false });

      const clientQuotesPromise = supabase
        .from("quotes")
        .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,responded_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name))")
        .eq("client_id", userId)
        .order("created_at", { ascending: false });

      const [requestedResult, receivedResult] = await Promise.all([
        clientRequestsPromise,
        clientQuotesPromise,
      ]);

      if (!active) return;

      if (!requestedResult.error) {
        setClientRequests(((requestedResult.data ?? []).filter((request: any) => request.source !== "direct")) as unknown as RequestRow[]);
        const firstDay = new Date();
        firstDay.setDate(1);
        firstDay.setHours(0, 0, 0, 0);
      }

      if (!receivedResult.error) {
        setClientQuotes((receivedResult.data ?? []) as unknown as QuoteRow[]);
      }

      if (businessId) {
        const [supplierRequestsResult, supplierQuotesResult] = await Promise.all([
          supabase
            .from("quote_requests")
            .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name)")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
          supabase
            .from("quotes")
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,responded_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source,services(name))")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
        ]);

        if (!active) return;

        if (!supplierRequestsResult.error) {
          setRequests(((supplierRequestsResult.data ?? []).filter((request: any) => request.source !== "direct")) as unknown as RequestRow[]);
        }
        if (!supplierQuotesResult.error) {
          setQuotes((supplierQuotesResult.data ?? []) as unknown as QuoteRow[]);
        }
      }
    }

    refreshQuoteData();
    const intervalId = window.setInterval(refreshQuoteData, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loading, userId, businessId]);

  function normalizeWhatsAppNumber(value: string | null | undefined) {
    const digits = (value ?? "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return digits;
  }

  function formatQuoteDate(value: string | null) {
    return value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";
  }

  function publicProfileUrl(requesterId: string | null | undefined) {
    const profile = requesterId ? requesterProfiles[requesterId] : null;
    return profile ? window.location.origin + "/fornecedor/" + profile.slug : "";
  }

  function buildRequestWhatsAppMessage(request: RequestRow) {
    const supplier = businessContacts[request.business_id];
    const supplierAddress = supplier?.address
      || [supplier?.bairro, supplier?.city, supplier?.state].filter(Boolean).join(" — ")
      || [supplier?.cep, supplier?.city, supplier?.state].filter(Boolean).join(" — ")
      || personalIdentity?.address
      || [personalIdentity?.city, personalIdentity?.state].filter(Boolean).join(" — ")
      || personalIdentity?.cep
      || "Não informado";
    const supplierProfileUrl = supplier?.slug
      ? window.location.origin + "/fornecedor/" + supplier.slug
      : "";

    return [
      "Olá, " + request.client_name,
      "",
      "Recebemos a sua solicitação pelo Losi Conecta e vou preparar uma proposta para você.",
      "",
      "Me diga: Como eu posso colaborar contigo?",
      "",
      "Dados do fornecedor:",
      "",
      "Nome: " + (personalIdentity?.full_name || supplier?.business_name || "Fornecedor"),
      "Endereço completo: " + supplierAddress,
      "Nome da empresa: " + (supplier?.business_name || "Não informado"),
      supplierProfileUrl ? "Link do perfil público: " + supplierProfileUrl : "",
    ].filter(Boolean).join("\n");
  }

  function buildQuoteWhatsAppMessage(quote: QuoteRow, recipientName: string, senderName: string) {
    const request = quote.quote_requests;
    const profileUrl = publicProfileUrl(request?.requester_id);
    const itemLines = (quote.quote_items ?? [])
      .map((item) => "• " + item.quantity + "x " + item.description + " — " + money(Number(item.total)))
      .join("\n");

    return [
      "ORÇAMENTO — LOSI CONECTA",
      "",
      "DESTINATÁRIO: " + recipientName,
      "FORNECEDOR: " + senderName,
      "SOLICITANTE: " + (request?.client_name || "Cliente"),
      "",
      "CONTATO DO SOLICITANTE",
      "Nome: " + (request?.client_name || recipientName),
      request?.client_phone ? "WhatsApp/Telefone: " + request.client_phone : "",
      request?.client_email ? "E-mail: " + request.client_email : "",
      "",
      "DADOS DO EVENTO",
      "Evento: " + (request?.event_title || "Não informado"),
      "Data: " + formatQuoteDate(request?.event_date ?? null),
      request?.event_location ? "Local: " + request.event_location : "",
      profileUrl ? "" : "",
      profileUrl ? "🔗 PERFIL PÚBLICO DE QUEM SOLICITOU: " + profileUrl : "",
      "",
      "Itens:",
      itemLines || "• Itens conforme orçamento no LOSI CONECTA",
      "",
      "Subtotal: " + money(Number(quote.subtotal)),
      "Desconto: " + money(Number(quote.discount)),
      "TOTAL: " + money(Number(quote.total)),
      quote.validity_until ? "Validade: " + formatQuoteDate(quote.validity_until) : "",
      quote.notes ? "Observações: " + quote.notes : "",
      "",
      "Orçamento enviado pelo LOSI CONECTA.",
    ].filter(Boolean).join("\n");
  }

  function openWhatsApp(phone: string | null | undefined, text: string) {
    const number = normalizeWhatsAppNumber(phone);
    if (!number) {
      setMessage("O telefone/WhatsApp do cliente não foi informado neste orçamento.");
      return;
    }
    window.open("https://wa.me/" + number + "?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  }

  type ProposalDraft = {
    recipientName: string;
    recipientPhone: string;
    eventTitle: string;
    eventDate: string | null;
    eventLocation: string;
    eventDescription: string;
    items: { description: string; quantity: number; unit_price: number; total: number }[];
    subtotal: number;
    discount: number;
    total: number;
    validityUntil: string | null;
    notes: string;
    supplierName: string;
    companyName: string;
    supplierPhone: string;
    supplierEmail: string;
    supplierProfileUrl: string;
  };

  function sanitizeFilePart(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
  }

  function buildPdfFileName(value: QuoteRow | ProposalDraft) {
    const recipient = "recipientName" in value
      ? value.recipientName
      : value.quote_requests?.client_name || "cliente";
    const suffix = "id" in value ? value.id.slice(0, 8) : Date.now().toString().slice(-8);
    return `LOSI-CONNECTA-Proposta-${sanitizeFilePart(recipient) || "cliente"}-${suffix}.pdf`;
  }

  function downloadPdfBlob(pdf: jsPDF, fileName: string, targetWindow?: Window | null) {
    const blob = pdf.output("blob");
    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error("O PDF foi gerado vazio. Tente novamente.");
    }

    const url = URL.createObjectURL(blob);

    if (targetWindow && !targetWindow.closed) {
      targetWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (opened) window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        else window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    }, 300);
  }

  async function generateProposalPdf(draft: ProposalDraft) {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const navy: [number, number, number] = [7, 26, 51];
    const gold: [number, number, number] = [240, 217, 154];
    const ink: [number, number, number] = [31, 41, 55];
    const muted: [number, number, number] = [100, 110, 125];
    const light: [number, number, number] = [246, 247, 249];

    const header = () => {
      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageWidth, 43, "F");
      pdf.setTextColor(...gold);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(19);
      pdf.text("LOSI CONECTA", 18, 17);
      pdf.setFontSize(9);
      pdf.setTextColor(232, 235, 240);
      pdf.text("PROPOSTA COMERCIAL", 18, 25);
      pdf.setTextColor(...gold);
      pdf.setFontSize(8);
      pdf.text("PROPOSTA", pageWidth - 18, 17, { align: "right" });
      pdf.setTextColor(232, 235, 240);
      pdf.text("Encontre. Conheca. Conecte.", pageWidth - 18, 25, { align: "right" });
      pdf.setDrawColor(...gold);
      pdf.setLineWidth(0.6);
      pdf.line(18, 34, pageWidth - 18, 34);
    };

    const footer = () => {
      const y = pageHeight - 12;
      pdf.setDrawColor(220, 223, 228);
      pdf.setLineWidth(0.3);
      pdf.line(18, y - 4, pageWidth - 18, y - 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...muted);
      pdf.text("Documento gerado pelo LOSI CONECTA", 18, y);
      pdf.text(\`Pagina \${pdf.getNumberOfPages()}\`, pageWidth - 18, y, { align: "right" });
    };

    const section = (title: string, y: number) => {
      pdf.setFillColor(...light);
      pdf.roundedRect(18, y - 5, pageWidth - 36, 10, 2, 2, "F");
      pdf.setTextColor(...navy);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(title.toUpperCase(), 22, y + 1);
    };

    header();
    let y = 54;

    pdf.setTextColor(...navy);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text(draft.eventTitle || "Proposta comercial", 18, y);
    y += 8;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...muted);
    pdf.text(\`Emitida em \${new Date().toLocaleDateString("pt-BR")}\`, 18, y);
    y += 12;

    section("Destinatario", y);
    y += 9;
    pdf.setTextColor(...ink);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("Nome", 18, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(draft.recipientName || "Nao informado", 45, y);
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.text("WhatsApp", 18, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(draft.recipientPhone || "Nao informado", 45, y);
    y += 6;
    y += 4;

    section("Dados do evento", y);
    y += 9;
    const eventRows: [string, string][] = [
      ["Evento", draft.eventTitle || "Nao informado"],
      ["Data", formatQuoteDate(draft.eventDate)],
      ["Local", draft.eventLocation || "Nao informado"],
    ];
    pdf.setFontSize(8.5);
    for (const [label, value] of eventRows) {
      pdf.setTextColor(...ink);
      pdf.setFont("helvetica", "bold");
      pdf.text(label, 18, y);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(value, pageWidth - 66);
      pdf.text(lines, 45, y);
      y += Math.max(6, lines.length * 4.5);
    }
    if (draft.eventDescription) {
      y += 2;
      pdf.setFont("helvetica", "bold");
      pdf.text("Detalhes", 18, y);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(draft.eventDescription, pageWidth - 45);
      pdf.text(lines, 45, y);
      y += lines.length * 4.5;
    }
    y += 5;

    section("Itens da proposta", y);
    y += 5;
    pdf.setFillColor(...navy);
    pdf.rect(18, y - 5, pageWidth - 36, 9, "F");
    pdf.setTextColor(...gold);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("Item", 21, y + 1);
    pdf.text("Qtd.", 108, y + 1, { align: "center" });
    pdf.text("Unitario", 149, y + 1, { align: "right" });
    pdf.text("Total", pageWidth - 21, y + 1, { align: "right" });
    y += 7;

    for (const item of draft.items) {
      if (y > pageHeight - 70) {
        footer();
        pdf.addPage();
        header();
        y = 54;
      }
      pdf.setFillColor(249, 250, 251);
      const desc = pdf.splitTextToSize(item.description, 78);
      const rowHeight = Math.max(8, desc.length * 4.2);
      pdf.rect(18, y - 4, pageWidth - 36, rowHeight, "F");
      pdf.setTextColor(...ink);
      pdf.setFont("helvetica", "normal");
      pdf.text(desc.slice(0, 3), 21, y + 1);
      pdf.text(String(item.quantity), 108, y + 1, { align: "center" });
      pdf.text(money(item.unit_price), 149, y + 1, { align: "right" });
      pdf.setFont("helvetica", "bold");
      pdf.text(money(item.total), pageWidth - 21, y + 1, { align: "right" });
      y += rowHeight;
      pdf.setDrawColor(225, 228, 232);
      pdf.line(18, y - 4, pageWidth - 18, y - 4);
    }
    y += 5;

    const totalsX = pageWidth - 82;
    const totalsW = 64;
    pdf.setFillColor(...light);
    pdf.roundedRect(totalsX, y, totalsW, 31, 2, 2, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text("Subtotal", totalsX + 5, y + 8);
    pdf.text(money(draft.subtotal), totalsX + totalsW - 5, y + 8, { align: "right" });
    pdf.text("Desconto", totalsX + 5, y + 15);
    pdf.text(money(draft.discount), totalsX + totalsW - 5, y + 15, { align: "right" });
    pdf.setDrawColor(210, 214, 220);
    pdf.line(totalsX + 5, y + 19, totalsX + totalsW - 5, y + 19);
    pdf.setTextColor(...navy);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("TOTAL", totalsX + 5, y + 26);
    pdf.setTextColor(...gold);
    pdf.text(money(draft.total), totalsX + totalsW - 5, y + 26, { align: "right" });
    y += 40;

    if (draft.validityUntil || draft.notes) {
      section("Condicoes da proposta", y);
      y += 9;
      pdf.setTextColor(...ink);
      pdf.setFontSize(8.5);
      if (draft.validityUntil) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Validade:", 18, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(formatQuoteDate(draft.validityUntil), 39, y);
        y += 6;
      }
      if (draft.notes) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Observacoes:", 18, y);
        pdf.setFont("helvetica", "normal");
        const notes = pdf.splitTextToSize(draft.notes, pageWidth - 60);
        pdf.text(notes, 43, y);
        y += notes.length * 4.5 + 3;
      }
    }

    if (draft.supplierPhone || draft.supplierEmail || draft.supplierProfileUrl) {
      y += 4;
      section("Contato do fornecedor", y);
      y += 9;
      pdf.setFontSize(8.5);
      pdf.setTextColor(...ink);
      if (draft.supplierPhone) {
        pdf.setFont("helvetica", "bold"); pdf.text("Telefone:", 18, y);
        pdf.setFont("helvetica", "normal"); pdf.text(draft.supplierPhone, 45, y); y += 5;
      }
      if (draft.supplierEmail) {
        pdf.setFont("helvetica", "bold"); pdf.text("E-mail:", 18, y);
        pdf.setFont("helvetica", "normal"); pdf.text(draft.supplierEmail, 45, y); y += 5;
      }
      if (draft.supplierProfileUrl) {
        pdf.setFont("helvetica", "bold"); pdf.text("Perfil:", 18, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(pdf.splitTextToSize(draft.supplierProfileUrl, pageWidth - 55), 45, y);
        y += 5;
      }
    }

    y = Math.max(y + 9, pageHeight - 47);
    if (y > pageHeight - 28) {
      footer();
      pdf.addPage();
      header();
      y = 54;
    }
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(0.7);
    pdf.line(18, y, 78, y);
    pdf.setTextColor(...navy);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(draft.supplierName || "Fornecedor", 18, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...muted);
    pdf.text(draft.companyName || "LOSI CONECTA", 18, y + 11);

    footer();
    return pdf;
  }

  async function downloadQuotePdf(quote: QuoteRow) {
    try {
      setMessageType("");
      setMessage("Gerando PDF...");
      const pdf = await generateQuotePdf(quote);
      const fileName = buildPdfFileName(quote);
      downloadPdfBlob(pdf, fileName);

      setMessageType("success");
      setMessage("PDF profissional gerado com sucesso.");
    } catch (error: any) {
      console.error("Erro ao gerar/baixar PDF:", error);
      setMessageType("error");
      setMessage(error?.message || "Não foi possível gerar o PDF. Tente novamente.");
    }
  }

  async function shareQuotePdfOnWhatsApp(quote: QuoteRow) {
    const request = quote.quote_requests;
    const recipientPhone = normalizeWhatsAppNumber(request?.client_phone);
    const recipientName = request?.client_name || "cliente";
    const pdf = await generateQuotePdf(quote);
    const blob = pdf.output("blob");
    const file = new File([blob], buildPdfFileName(quote), { type: "application/pdf" });
    const message = `Olá, ${recipientName}! Preparei seu orçamento pelo LOSI CONECTA. Vou enviar o PDF da proposta por aqui.`;
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Orçamento LOSI CONECTA", text: message });
        setMessageType("success");
        setMessage("PDF pronto para ser compartilhado pelo WhatsApp.");
        return;
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("Erro ao compartilhar PDF:", error);
    }

    downloadPdfBlob(pdf, buildPdfFileName(quote));
    const whatsappUrl = recipientPhone
      ? "https://wa.me/" + recipientPhone + "?text=" + encodeURIComponent(message)
      : "https://wa.me/?text=" + encodeURIComponent(message);
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    setMessageType("success");
    setMessage("O PDF foi baixado. O WhatsApp foi aberto para você anexar o PDF à conversa.");
  }

  function shareQuoteOnWhatsApp(quote: QuoteRow) {
    const request = quote.quote_requests;
    const recipientPhone = request?.client_phone;
    const number = normalizeWhatsAppNumber(recipientPhone);
    if (!number) {
      setMessageType("error");
      setMessage("O WhatsApp do cliente não foi informado ou está inválido neste orçamento.");
      return;
    }
    const business = businessContacts[quote.business_id];
    const message = buildQuoteWhatsAppMessage(
      quote,
      request?.client_name || "cliente",
      business?.business_name || "Fornecedor",
    );
    const url = "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function respondToQuote(quote: QuoteRow, status: "accepted" | "rejected") {
    const { error } = await supabase.from("quotes").update({
      status,
      responded_at: new Date().toISOString(),
    }).eq("id", quote.id).eq("client_id", userId);

    if (error) {
      console.error("Erro ao responder orçamento:", error);
      setMessage(error.message || "Não foi possível atualizar o orçamento.");
      return;
    }

    setClientQuotes((current) => current.map((item) => item.id === quote.id ? { ...item, status } : item));
  }

  const selectedSupplier = selectedQuote ? businessContacts[selectedQuote.business_id] : null;
  const selectedRequester = selectedQuote?.quote_requests;
  const selectedRequesterProfile = selectedRequester ? requesterProfiles[selectedRequester.requester_id] : null;
  const selectedSupplierSlug = selectedSupplier?.slug || "";
  const selectedItemLines = selectedQuote?.quote_items ?? [];

  const closeQuoteModal = () => setSelectedQuote(null);
  function prepareProposalFromRequest(request: RequestRow) {
    setProposalMode("request");
    setProposalRequestId(request.id);
    setProposalRecipientName(request.client_name || "");
    setProposalRecipientPhone(request.client_phone || "");
    setProposalEventTitle(request.event_title || "");
    setProposalEventDate(request.event_date || "");
    setProposalEventLocation(request.event_location || "");
    setProposalEventDescription(request.description || "");
    setProposalProfileLink("");
    setResolvedProposalRecipient(null);
    setSelectedRequest(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const closeRequestModal = () => setSelectedRequest(null);
  const closeDashboardModal = () => { setDashboardFilter(null); setDashboardDateFilter("all"); setDashboardDateValue(""); };


  const isSupplier = Boolean(businessId);

  // Uma solicitação só deixa de estar "Aguardando orçamento" quando existe
  // um orçamento vinculado a ela. O status textual da solicitação não é
  // usado como fonte única da verdade, evitando divergência entre os painéis.
  const clientQuoteRequestIds = new Set(clientQuotes.map((quote) => quote.request_id));
  const supplierQuoteRequestIds = new Set(quotes.map((quote) => quote.request_id));

  const clientPendingRequests = clientRequests.filter(
    (request) => request.source !== "direct" && !clientQuoteRequestIds.has(request.id),
  );

  const supplierPendingRequests = requests.filter(
    (request) => request.source !== "direct" && !supplierQuoteRequestIds.has(request.id),
  );

  function dateOnly(value: string | null) {
    return value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";
  }

  function dateTime(value: string | null) {
    return value
      ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "Não informada";
  }

  function proposalSubtotal() {
    return proposalItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice.replace(",", ".")) || 0;
      return sum + quantity * unitPrice;
    }, 0);
  }

  function proposalTotal() {
    return Math.max(0, proposalSubtotal() - (Number(proposalDiscount.replace(",", ".")) || 0));
  }

  function addProposalItem() {
    setProposalItems((items) => [...items, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeProposalItem(index: number) {
    setProposalItems((items) => items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateProposalItem(index: number, field: "description" | "quantity" | "unitPrice", value: string) {
    setProposalItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function resetProposalForm() {
    setProposalMode("direct");
    setProposalRequestId("");
    setProposalRecipientName("");
    setProposalRecipientPhone("");
    setProposalEventTitle("");
    setProposalEventDate("");
    setProposalEventLocation("");
    setProposalEventDescription("");
    setProposalItems([{ description: "", quantity: "1", unitPrice: "" }]);
    setProposalDiscount("0");
    setProposalValidity("");
    setProposalNotes("");
    setProposalProfileLink("");
    setResolvedProposalRecipient(null);
  }

  function extractPublicProfileSlug(value: string) {
    const normalized = value.trim();
    if (!normalized) return "";
    const match = normalized.match(/\/fornecedor\/([^/?#]+)/i);
    return match?.[1]?.replace(/\/$/, "") || "";
  }

  async function resolveProposalRecipient(value: string, request?: RequestRow): Promise<BusinessContact | null> {
    setProposalProfileLink(value);
    setResolvedProposalRecipient(null);
    const slug = extractPublicProfileSlug(value);
    if (!slug) return null;
    setResolvingProposalRecipient(true);
    try {
      const { data, error } = await supabase
        .from("business_profiles")
        .select("id,owner_id,business_name,slug,whatsapp,phone,address,bairro,city,state,cep")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Perfil público não encontrado. Confira o link informado.");
      if (request && data.owner_id !== request.requester_id) throw new Error("Este perfil público não pertence ao solicitante desta solicitação. Confira o link antes de enviar.");
      if (!data.whatsapp && !data.phone) throw new Error("O perfil público foi encontrado, mas não possui WhatsApp ou telefone cadastrado.");
      const recipient = data as BusinessContact;
      setResolvedProposalRecipient(recipient);
      setProposalRecipientName(recipient.business_name || "");
      setProposalRecipientPhone(recipient.whatsapp || recipient.phone || "");
      return recipient;
    } catch (error: any) {
      console.error("Erro ao identificar destinatário pelo perfil público:", error);
      setMessageType("error");
      setMessage(error?.message || "Não foi possível identificar o destinatário pelo perfil público.");
      return null;
    } finally {
      setResolvingProposalRecipient(false);
    }
  }

  async function createAndSendProposal(delivery: "whatsapp" | "pdf" | "pdf-whatsapp" = "whatsapp") {
    if (!businessId || !userId) return;

    const request = proposalMode === "request"
      ? supplierPendingRequests.find((item) => item.id === proposalRequestId) || null
      : null;

    if (proposalMode === "request" && !request) {
      setMessageType("error");
      setMessage("Selecione uma solicitação para montar a proposta.");
      return;
    }

    const recipientNameInput = proposalRecipientName.trim();
    if (!recipientNameInput) {
      setMessageType("error");
      setMessage("Informe o nome do destinatário.");
      return;
    }

    if (!proposalEventTitle.trim()) {
      setMessageType("error");
      setMessage("Informe o nome ou título do evento.");
      return;
    }

    const validItems = proposalItems.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unit_price: Number(item.unitPrice.replace(",", ".")),
    })).filter((item) =>
      item.description &&
      item.quantity > 0 &&
      Number.isFinite(item.unit_price) &&
      item.unit_price >= 0
    );

    if (!validItems.length) {
      setMessageType("error");
      setMessage("Adicione pelo menos um item válido à proposta.");
      return;
    }

    const subtotal = validItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const discount = Math.max(0, Number(proposalDiscount.replace(",", ".")) || 0);
    const total = Math.max(0, subtotal - discount);

    // Abrimos as janelas no próprio clique. Assim, Safari/iPhone e bloqueadores
    // de popup não impedem a entrega depois que o PDF ou Supabase terminarem.
    let whatsappWindow: Window | null = null;
    let pdfWindow: Window | null = null;
    if (delivery === "whatsapp" || delivery === "pdf-whatsapp") {
      whatsappWindow = window.open("about:blank", "_blank");
    }
    if (delivery === "pdf" || delivery === "pdf-whatsapp") {
      pdfWindow = window.open("about:blank", "_blank");
    }

    setSavingProposal(true);
    setMessage("");

    try {
      let linkedRecipient = resolvedProposalRecipient;
      if (proposalProfileLink.trim() && !linkedRecipient) {
        linkedRecipient = await resolveProposalRecipient(proposalProfileLink.trim(), request ?? undefined);
      }

      if (proposalProfileLink.trim() && !linkedRecipient) {
        throw new Error("Identifique o destinatário pelo link do perfil público antes de enviar a proposta.");
      }

      if (request && linkedRecipient && linkedRecipient.owner_id !== request.requester_id) {
        throw new Error("O perfil público informado não corresponde ao solicitante desta solicitação.");
      }

      const finalRecipientName = linkedRecipient?.business_name || recipientNameInput;
      const recipientPhone = linkedRecipient?.whatsapp
        || linkedRecipient?.phone
        || proposalRecipientPhone.trim()
        || request?.client_phone
        || "";

      if ((delivery === "whatsapp" || delivery === "pdf-whatsapp") && !normalizeWhatsAppNumber(recipientPhone)) {
        throw new Error("Informe um WhatsApp válido do destinatário para enviar a proposta.");
      }

      const supplier = businessContacts[businessId];
      const supplierName = personalIdentity?.full_name || supplier?.business_name || "Fornecedor";
      const companyName = supplier?.business_name || "LOSI CONECTA";
      const supplierPhone = supplier?.whatsapp || supplier?.phone || "";
      const supplierProfileUrl = supplier?.slug
        ? window.location.origin + "/fornecedor/" + supplier.slug
        : "";

      const draft: ProposalDraft = {
        recipientName: finalRecipientName,
        recipientPhone,
        eventTitle: proposalEventTitle.trim(),
        eventDate: proposalEventDate || request?.event_date || null,
        eventLocation: proposalEventLocation.trim() || request?.event_location || "",
        eventDescription: proposalEventDescription.trim() || request?.description || "",
        items: validItems.map((item) => ({
          ...item,
          total: item.quantity * item.unit_price,
        })),
        subtotal,
        discount,
        total,
        validityUntil: proposalValidity || null,
        notes: proposalNotes.trim(),
        supplierName,
        companyName,
        supplierPhone,
        supplierEmail: userEmail,
        supplierProfileUrl,
      };

      // A entrega é independente do banco. Primeiro geramos/abrimos o material
      // pedido pelo usuário; a gravação no Supabase acontece depois e não bloqueia
      // PDF ou WhatsApp se houver uma falha de permissão/relação.
      if (delivery === "pdf" || delivery === "pdf-whatsapp") {
        const pdf = await generateProposalPdf(draft);
        downloadPdfBlob(pdf, buildPdfFileName(draft), pdfWindow);
      }

      const whatsappMessage = [
        "Olá, " + draft.recipientName + "!",
        "",
        "Preparei sua proposta comercial pelo LOSI CONECTA.",
        "",
        "FORNECEDOR",
        "Nome: " + draft.supplierName,
        "Empresa: " + draft.companyName,
        draft.supplierPhone ? "Telefone: " + draft.supplierPhone : "",
        draft.supplierEmail ? "E-mail: " + draft.supplierEmail : "",
        "",
        "DADOS DO EVENTO",
        "Evento: " + draft.eventTitle,
        draft.eventDate ? "Data: " + formatQuoteDate(draft.eventDate) : "",
        draft.eventLocation ? "Local: " + draft.eventLocation : "",
        "",
        "ITENS DA PROPOSTA",
        ...draft.items.map((item) => "• " + item.quantity + "x " + item.description + " — " + money(item.total)),
        "",
        "Subtotal: " + money(draft.subtotal),
        "Desconto: " + money(draft.discount),
        "TOTAL: " + money(draft.total),
        draft.validityUntil ? "Validade: " + formatQuoteDate(draft.validityUntil) : "",
        draft.notes ? "Observações: " + draft.notes : "",
        draft.supplierProfileUrl ? "" : "",
        draft.supplierProfileUrl ? "Perfil público: " + draft.supplierProfileUrl : "",
        "",
        "Proposta enviada pelo LOSI CONECTA.",
      ].filter(Boolean).join("\n");

      if (delivery === "whatsapp" || delivery === "pdf-whatsapp") {
        const whatsappUrl = "https://wa.me/" + normalizeWhatsAppNumber(draft.recipientPhone) + "?text=" + encodeURIComponent(whatsappMessage);
        if (whatsappWindow && !whatsappWindow.closed) {
          whatsappWindow.location.href = whatsappUrl;
        } else {
          window.location.href = whatsappUrl;
        }
      }

      // Persistência opcional/isolada: se o banco falhar, o material já foi
      // entregue ao usuário. O erro é mostrado sem desfazer PDF/WhatsApp.
      let persistenceError: string | null = null;
      try {
        const recipientOwnerId = linkedRecipient?.owner_id || request?.requester_id || null;
        const requestOwnerId = recipientOwnerId || userId;
        const requestPayload = {
          business_id: businessId,
          requester_id: requestOwnerId,
          service_id: request?.service_id || null,
          client_name: draft.recipientName,
          client_email: request?.client_email || null,
          client_phone: draft.recipientPhone,
          event_title: draft.eventTitle,
          event_date: draft.eventDate,
          event_location: draft.eventLocation || null,
          description: draft.eventDescription || null,
          status: "quoted",
          source: proposalMode,
        };

        let quoteRequest = request;
        if (!quoteRequest) {
          const { data: createdRequest, error: requestError } = await supabase
            .from("quote_requests")
            .insert(requestPayload)
            .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,source")
            .single();

          if (requestError || !createdRequest) throw requestError || new Error("Não foi possível salvar os dados da proposta.");
          quoteRequest = createdRequest as RequestRow;
        }

        const { data: quote, error: quoteError } = await supabase.from("quotes").insert({
          request_id: quoteRequest.id,
          business_id: businessId,
          client_id: recipientOwnerId,
          subtotal: draft.subtotal,
          discount: draft.discount,
          total: draft.total,
          validity_until: draft.validityUntil,
          notes: draft.notes || null,
          status: "sent",
          sent_at: new Date().toISOString(),
        }).select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,responded_at,created_at,public_response_token").single();

        if (quoteError || !quote) throw quoteError || new Error("Não foi possível salvar a proposta.");

        const { error: itemsError } = await supabase.from("quote_items").insert(
          draft.items.map((item) => ({
            quote_id: quote.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          }))
        );

        if (itemsError) throw itemsError;
        if (request) {
          await supabase.from("quote_requests").update({ status: "quoted" }).eq("id", request.id).eq("business_id", businessId);
        }

        const createdQuote = {
          ...(quote as QuoteRow),
          quote_items: draft.items.map((item, index) => ({ id: "local-" + index, ...item })),
          quote_requests: quoteRequest,
        } as QuoteRow;
        setQuotes((current) => [createdQuote, ...current]);
        if (request) {
          setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: "quoted" } : item));
        }
      } catch (error: any) {
        console.error("Falha ao salvar proposta (entrega já realizada):", error);
        persistenceError = error?.message || "A proposta foi enviada, mas não foi salva no histórico.";
      }

      resetProposalForm();
      setMessageType(persistenceError ? "error" : "success");
      if (delivery === "pdf") {
        setMessage(persistenceError
          ? "PDF gerado. O envio foi concluído, mas a proposta não pôde ser salva no histórico."
          : "Proposta gerada em PDF com sucesso. O PDF foi aberto para salvar ou compartilhar.");
      } else if (delivery === "pdf-whatsapp") {
        setMessage(persistenceError
          ? "PDF e WhatsApp foram preparados. A proposta não pôde ser salva no histórico."
          : "PDF gerado e WhatsApp aberto com a proposta pronta para envio.");
      } else {
        setMessage(persistenceError
          ? "WhatsApp aberto com a proposta pronta. Ela não pôde ser salva no histórico."
          : "WhatsApp aberto com a proposta pronta para envio.");
      }
    } catch (error: any) {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
      console.error("Erro ao preparar proposta:", error);
      setMessageType("error");
      setMessage(error?.message || "Não foi possível preparar a proposta.");
    } finally {
      setSavingProposal(false);
    }
  }

  async function deleteQuote(quote: QuoteRow) {
    const confirmed = window.confirm("Excluir este orçamento? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    let query = supabase.from("quotes").delete().eq("id", quote.id);
    query = isSupplier
      ? query.eq("business_id", businessId)
      : query.eq("client_id", userId);

    const { data: deletedRows, error } = await query.select("id");
    if (error) {
      console.error("Erro ao excluir orçamento:", error);
      setMessageType("error");
      setMessage(error.message || "Não foi possível excluir o orçamento.");
      return;
    }

    if (!deletedRows?.length) {
      setMessageType("error");
      setMessage("Não foi possível excluir este orçamento. Ele pode não pertencer à sua conta ou já ter sido excluído.");
      return;
    }

    setQuotes((current) => current.filter((item) => item.id !== quote.id));
    setClientQuotes((current) => current.filter((item) => item.id !== quote.id));
    if (selectedQuote?.id === quote.id) setSelectedQuote(null);
    setMessageType("success");
    setMessage("Orçamento excluído com sucesso.");
  }

  function serviceName(request: RequestRow | null | undefined) {
    return request?.services?.name || "Serviço não informado";
  }

  const sentQuotesCount = quotes.filter((quote) =>
    Boolean(quote.sent_at) ||
    ["sent", "viewed", "accepted", "rejected"].includes(quote.status)
  ).length;
  const acceptedQuotesCount = quotes.filter((quote) => quote.status === "accepted").length;
  const rejectedQuotesCount = quotes.filter((quote) => quote.status === "rejected").length;


  if (loading) return <main className="quotes-page-state">Carregando orçamentos...</main>;

  return (
    <main className="quotes-page">
      <style>{`
        .quotes-dashboard{margin:28px 0 34px;padding:26px;border:1px solid rgba(11,24,42,.09);border-radius:22px;background:linear-gradient(145deg,#fff,#f7f8fa);box-shadow:0 16px 36px rgba(7,17,31,.07)}
        .quotes-dashboard-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}
        .quotes-dashboard-head h2{margin:5px 0 7px;color:#172033;font-size:24px;line-height:1.2}
        .quotes-dashboard-head p{margin:0;color:#687386;font-size:14px;line-height:1.55}
        .quotes-dashboard-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .quotes-dashboard-card{min-width:0;padding:20px;border:1px solid rgba(11,24,42,.10);border-radius:16px;background:#fff;box-shadow:0 8px 22px rgba(7,17,31,.06)}.quotes-dashboard-card-button{font:inherit;text-align:left;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.quotes-dashboard-card-button:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(7,17,31,.10)}.quotes-dashboard-card-button:focus-visible{outline:3px solid rgba(214,180,106,.3);outline-offset:3px}.quotes-dashboard-filters{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:0 0 16px;padding:14px;border:1px solid #e1e5eb;border-radius:14px;background:#f8f9fb}.quotes-dashboard-filters label{display:grid;gap:6px;min-width:150px}.quotes-dashboard-filters label span{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085}.quotes-dashboard-filters select,.quotes-dashboard-filters input{height:42px;border:1px solid #d7dce4;border-radius:10px;background:#fff;color:#172033;padding:0 11px;font:inherit;outline:none}.quotes-dashboard-filters select:focus,.quotes-dashboard-filters input:focus{border-color:#d6b46a;box-shadow:0 0 0 3px rgba(214,180,106,.13)}.quotes-dashboard-filter-count{margin-left:auto;padding-bottom:10px;color:#687386;font-size:12px;font-weight:700}.quotes-dashboard-response{font-weight:800}.quotes-dashboard-response.accepted{color:#237345}.quotes-dashboard-response.rejected{color:#a32f2f}.quote-modal-response.accepted{color:#237345}.quote-modal-response.rejected{color:#a32f2f}..quotes-dashboard-list{display:grid;gap:10px;max-height:58vh;overflow:auto}.quotes-dashboard-list-item{display:flex;align-items:center;justify-content:space-between;gap:18px;width:100%;padding:16px;border:1px solid #dfe4eb;border-radius:14px;background:#fff;color:#172033;text-align:left;cursor:pointer;transition:.18s ease}.quotes-dashboard-list-item:hover{border-color:#d6b46a;box-shadow:0 8px 20px rgba(7,17,31,.07);transform:translateY(-1px)}.quotes-dashboard-list-item>div:first-child{display:grid;gap:4px;min-width:0}.quotes-dashboard-list-item strong{font-size:14px}.quotes-dashboard-list-item span,.quotes-dashboard-list-item small{color:#687386;font-size:12px}.quotes-dashboard-list-item small{font-size:11px}.quotes-dashboard-list-value{display:grid;justify-items:end;gap:6px;flex:none}.quotes-dashboard-list-value>strong{font-size:15px}.quote-status-pill{padding:5px 9px;border-radius:999px;background:#f2f4f7;color:#475467;font-weight:800}.quote-status-pill.accepted{background:#eefaf3;color:#237345}.quote-status-pill.rejected{background:#fff1f1;color:#a32f2f}.quotes-dashboard-empty{padding:30px 18px;text-align:center;border:1px dashed #d7dce4;border-radius:14px;color:#687386}@media(max-width:700px){.quotes-dashboard-list-item{align-items:flex-start}.quotes-dashboard-list-value{justify-items:end}.quotes-dashboard-list-item>div:first-child{min-width:0}.quotes-dashboard-list-item strong,.quotes-dashboard-list-item span,.quotes-dashboard-list-item small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:54vw}}
        .quotes-dashboard-card.accepted{border-color:rgba(35,115,69,.16)}
        .quotes-dashboard-card.rejected{border-color:rgba(163,47,47,.16)}
        .quotes-dashboard-icon{width:34px;height:34px;display:flex;align-items:center;justify-content:flex-start;margin-bottom:15px;background:none;color:#0b182a}
        .quotes-dashboard-card.accepted .quotes-dashboard-icon{background:transparent;color:#237345}
        .quotes-dashboard-card.rejected .quotes-dashboard-icon{background:transparent;color:#a32f2f}
        .quotes-dashboard-icon svg{width:30px;height:30px;display:block;overflow:visible;filter:drop-shadow(0 2px 3px rgba(7,17,31,.08))}
        .quotes-dashboard-label{margin-bottom:5px;color:#687386;font-size:11px;font-weight:800;letter-spacing:.12em}
        .quotes-dashboard-card strong{display:block;color:#172033;font-size:34px;line-height:1.05;font-weight:850}
        .quotes-dashboard-card span{display:block;margin-top:8px;color:#687386;font-size:13px;line-height:1.45}
        .proposal-builder{margin:28px 0 34px;padding:30px;border:1px solid rgba(11,24,42,.10);border-radius:24px;background:linear-gradient(145deg,#fff,#fafbfc);box-shadow:0 18px 44px rgba(7,17,31,.09)}
        .proposal-builder-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:26px;padding-bottom:20px;border-bottom:1px solid #edf0f4}
        .proposal-builder-head h2{margin:4px 0 7px;color:#172033;font-size:25px;line-height:1.2;letter-spacing:-.02em}
        .proposal-builder-head p{margin:0;color:#667085;font-size:14px;line-height:1.55}
        .proposal-form-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(180px,.6fr);gap:18px;margin-bottom:20px}
        .proposal-field{display:flex;flex-direction:column;gap:8px;min-width:0}
        .proposal-field label{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#475467}
        .proposal-field input,.proposal-field select,.proposal-field textarea{width:100%;box-sizing:border-box;border:1px solid #d7dce4;border-radius:13px;background:#fff;color:#172033;padding:13px 14px;font:inherit;outline:none;min-height:48px;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
        .proposal-field input:focus,.proposal-field select:focus,.proposal-field textarea:focus{border-color:#d6b46a;box-shadow:0 0 0 4px rgba(214,180,106,.14)}
        .proposal-field textarea{min-height:94px;resize:vertical}
        .proposal-items{border:1px solid #e1e5eb;border-radius:17px;overflow:hidden;margin:22px 0;background:#fff;box-shadow:0 8px 22px rgba(7,17,31,.04)}
        .proposal-items-title{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 18px;background:#f7f8fa;border-bottom:1px solid #e7eaf0}
        .proposal-items-title strong{font-size:14px;color:#101828}
        .proposal-add{border:0;background:transparent;color:#344054;font-weight:700;cursor:pointer;padding:8px 4px}
        .proposal-item{display:grid;grid-template-columns:minmax(0,1fr) 92px 145px 42px;gap:12px;padding:17px 18px;border-bottom:1px solid #edf0f4}
        .proposal-item:last-child{border-bottom:0}
        .proposal-remove{border:1px solid #d0d5dd;background:#fff;border-radius:10px;cursor:pointer;font-size:18px;color:#667085}
        .proposal-summary{display:flex;justify-content:flex-end;margin:18px 0}
        .proposal-summary-box{width:min(100%,380px);border:1px solid #dfe4eb;border-radius:17px;padding:18px;background:#f8f9fb;box-shadow:0 8px 20px rgba(7,17,31,.04)}
        .proposal-summary-line{display:flex;justify-content:space-between;gap:20px;margin:7px 0;color:#475467;font-size:14px}
        .proposal-summary-line.total{margin-top:12px;padding-top:12px;border-top:1px solid #d0d5dd;color:#101828;font-size:17px;font-weight:800}
        .proposal-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px}
        .proposal-primary{border:1px solid #d6b46a;border-radius:13px;padding:13px 21px;background:linear-gradient(145deg,#0b182a,#07111f);color:#f0d99a;font-weight:850;letter-spacing:.01em;cursor:pointer;min-height:48px;box-shadow:0 10px 22px rgba(7,17,31,.16);transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease}
        .proposal-primary:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 13px 26px rgba(7,17,31,.20)}
        .proposal-primary:disabled{opacity:.55;cursor:not-allowed}
        .proposal-hint{margin:12px 0 0;color:#667085;font-size:12px;line-height:1.5}
        .proposal-recipient{padding:19px;border-radius:17px;background:linear-gradient(145deg,#f8f9fb,#fff);border:1px solid #dfe4eb;margin-bottom:20px;box-shadow:0 8px 22px rgba(7,17,31,.04)}
        .proposal-recipient-head strong{display:block;color:#172033;font-size:13px;letter-spacing:.04em}
        .proposal-recipient-head span{display:block;color:#687386;font-size:12px;line-height:1.5;margin-top:4px}
        .proposal-mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.proposal-mode-button{width:100%}.proposal-mode-button.active{border-color:#d6b46a;color:#8a6d2f;background:#fffaf0}.proposal-recipient-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr);gap:14px;margin-top:14px}
        .proposal-recipient-grid label{display:block;margin-bottom:6px;color:#475467;font-size:11px;font-weight:800;text-transform:uppercase}
        .proposal-recipient-grid input{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:11px;background:#fff;color:#101828;padding:12px 13px;font:inherit;outline:none}
        .proposal-recipient-grid input:focus{border-color:#d6b46a;box-shadow:0 0 0 3px rgba(214,180,106,.15)}
        .proposal-recipient-grid small{display:block;color:#687386;font-size:11px;line-height:1.45;margin-top:6px}
        .proposal-recipient-status{padding:12px 14px;border:1px solid #d9dee8;border-radius:12px;background:#fff}
        .proposal-recipient-status>span{display:block;color:#8a6d2f;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
        .proposal-recipient-status strong{display:block;color:#172033;margin-top:3px}
        .proposal-recipient-status p{margin:6px 0 0;color:#475467;font-size:13px}
        .proposal-recipient-status a{display:inline-block;margin-top:8px;color:#8a6d2f;font-size:12px;font-weight:800;text-decoration:none}

        @media(max-width:700px){
          .proposal-mode-grid{grid-template-columns:1fr !important}
          .proposal-builder{padding:18px;margin-top:20px;border-radius:16px}
          .proposal-builder-head{display:block}
          .proposal-builder-head h2{font-size:21px}
          .proposal-form-grid{grid-template-columns:1fr}
          .proposal-recipient-grid{grid-template-columns:1fr}
          .proposal-item{grid-template-columns:minmax(0,1fr) 76px;gap:9px}
          .proposal-item .proposal-price{grid-column:1}
          .proposal-remove{grid-column:2;grid-row:1;align-self:end}
          .proposal-actions{display:grid;grid-template-columns:1fr}
          .proposal-primary{width:100%}
          .proposal-summary{justify-content:stretch}
          .proposal-summary-box{width:100%;box-sizing:border-box}
        }
        @media (max-width:700px){
          .quotes-dashboard{margin:20px 0 26px;padding:18px;border-radius:16px}
          .quotes-dashboard-head{margin-bottom:16px}
          .quotes-dashboard-head h2{font-size:21px}
          .quotes-dashboard-head p{font-size:13px}
          .quotes-dashboard-grid{grid-template-columns:1fr;gap:10px}
          .quotes-dashboard-card{padding:16px}
          .quotes-dashboard-icon{margin-bottom:12px}
          .quotes-dashboard-card strong{font-size:30px}
        }
      `}</style>
      <header className="quotes-header">
        <AppLogo className="catalog-logo">LOSI <span>CONECTA</span></AppLogo>
              <Link to="/painel" className="quotes-back">Voltar ao painel</Link>
      </header>

      <section className="quotes-content">
        <div className="quotes-kicker">ORÇAMENTOS</div>
        <h1>Orçamentos e solicitações</h1>
        <p className="quotes-intro">Acompanhe suas solicitações e propostas. Como fornecedor, você pode enviar uma proposta para qualquer cliente, tenha ele solicitado orçamento ou não.</p>

        {isSupplier && (
          <section className="proposal-builder" aria-labelledby="proposal-builder-title">
            <div className="proposal-builder-head">
              <div>
                <div className="quotes-kicker">NOVA PROPOSTA</div>
                <h2 id="proposal-builder-title">Enviar proposta para o cliente</h2>
                <p>Crie uma proposta diretamente para o cliente ou responda a uma solicitação já recebida. O cliente não precisa ter solicitado orçamento para você enviar uma proposta.</p>
              </div>
            </div>

            <div className="proposal-field" style={{ marginBottom: 18 }}>
              <label>Origem da proposta</label>
              <div className="proposal-mode-grid">
                <button type="button" className={"quotes-secondary proposal-mode-button " + (proposalMode === "direct" ? "active" : "")} onClick={() => setProposalMode("direct")}>Novo orçamento para cliente</button>
                <button type="button" className={"quotes-secondary proposal-mode-button " + (proposalMode === "request" ? "active" : "")} onClick={() => setProposalMode("request")}>Responder solicitação recebida</button>
              </div>
            </div>
            {proposalMode === "request" && (
              <div className="proposal-field" style={{ marginBottom: 18 }}>
                <label htmlFor="proposal-request">Solicitação existente</label>
                <select id="proposal-request" value={proposalRequestId} onChange={(event) => {
                  const id = event.target.value; setProposalRequestId(id);
                  const selected = supplierPendingRequests.find((item) => item.id === id);
                  if (selected) {
                    setProposalRecipientName(selected.client_name || ""); setProposalRecipientPhone(selected.client_phone || "");
                    setProposalEventTitle(selected.event_title || ""); setProposalEventDate(selected.event_date || "");
                    setProposalEventLocation(selected.event_location || ""); setProposalEventDescription(selected.description || "");
                  }
                }}>
                  <option value="">Selecione a solicitação</option>
                  {supplierPendingRequests.map((request) => <option key={request.id} value={request.id}>{request.client_name} — {request.event_title} — {serviceName(request)}</option>)}
                </select>
              </div>
            )}
            <div className="proposal-recipient">
              <div className="proposal-recipient-head"><strong>DADOS DO DESTINATÁRIO</strong><span>Preencha o WhatsApp manualmente ou use o link do perfil público caso o destinatário também seja fornecedor.</span></div>
              <div className="proposal-recipient-grid">
                <div><label htmlFor="proposal-recipient-name">Nome do cliente</label><input id="proposal-recipient-name" value={proposalRecipientName} onChange={(event) => setProposalRecipientName(event.target.value)} placeholder="Nome do cliente ou empresa" /></div>
                <div><label htmlFor="proposal-recipient-phone">WhatsApp</label><input id="proposal-recipient-phone" inputMode="tel" value={proposalRecipientPhone} onChange={(event) => setProposalRecipientPhone(event.target.value)} placeholder="(11) 99999-9999" /></div>
                <div><label htmlFor="proposal-profile-link">Link do perfil público</label><input id="proposal-profile-link" value={proposalProfileLink} onChange={(event) => { setProposalProfileLink(event.target.value); setResolvedProposalRecipient(null); }} onBlur={(event) => resolveProposalRecipient(event.target.value, proposalMode === "request" ? supplierPendingRequests.find((item) => item.id === proposalRequestId) : undefined)} placeholder="https://.../fornecedor/..." /><small>Se o destinatário for fornecedor, o sistema identifica o perfil e usa o WhatsApp cadastrado nele.</small></div>
                <div className="proposal-recipient-status"><span>Destinatário</span><strong>{resolvedProposalRecipient?.business_name || proposalRecipientName || "Aguardando dados"}</strong><p>WhatsApp: {resolvingProposalRecipient ? "Identificando..." : resolvedProposalRecipient ? (resolvedProposalRecipient.whatsapp || resolvedProposalRecipient.phone) : (proposalRecipientPhone || "Não informado")}</p>{resolvedProposalRecipient?.slug && <a href={window.location.origin + "/fornecedor/" + resolvedProposalRecipient.slug} target="_blank" rel="noreferrer">Abrir perfil público</a>}</div>
              </div>
            </div>
            <div className="proposal-recipient">
              <div className="proposal-recipient-head"><strong>DADOS DO EVENTO</strong><span>Esses dados também ficam registrados junto à proposta.</span></div>
              <div className="proposal-form-grid" style={{ marginTop: 14, marginBottom: 0 }}>
                <div className="proposal-field"><label htmlFor="proposal-event-title">Nome do evento</label><input id="proposal-event-title" value={proposalEventTitle} onChange={(event) => setProposalEventTitle(event.target.value)} placeholder="Ex.: Festa de aniversário, evento corporativo..." /></div>
                <div className="proposal-field"><label htmlFor="proposal-event-date">Data do evento</label><input id="proposal-event-date" type="date" value={proposalEventDate} onChange={(event) => setProposalEventDate(event.target.value)} /></div>
                <div className="proposal-field"><label htmlFor="proposal-event-location">Local do evento</label><input id="proposal-event-location" value={proposalEventLocation} onChange={(event) => setProposalEventLocation(event.target.value)} placeholder="Cidade, espaço ou endereço" /></div>
                <div className="proposal-field"><label htmlFor="proposal-event-description">Descrição</label><textarea id="proposal-event-description" value={proposalEventDescription} onChange={(event) => setProposalEventDescription(event.target.value)} placeholder="Detalhes importantes do evento ou serviço." /></div>
              </div>
            </div>

                <div className="proposal-items">
                  <div className="proposal-items-title">
                    <strong>Itens da proposta</strong>
                    <button type="button" className="proposal-add" onClick={addProposalItem}>+ Adicionar item</button>
                  </div>
                  {proposalItems.map((item, index) => (
                    <div className="proposal-item" key={index}>
                      <div className="proposal-field">
                        <label>Descrição</label>
                        <input value={item.description} onChange={(event) => updateProposalItem(index, "description", event.target.value)} placeholder="Ex.: Recreação e monitoria" />
                      </div>
                      <div className="proposal-field">
                        <label>Qtd.</label>
                        <input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateProposalItem(index, "quantity", event.target.value)} />
                      </div>
                      <div className="proposal-field proposal-price">
                        <label>Valor unitário</label>
                        <input inputMode="decimal" value={item.unitPrice} onChange={(event) => updateProposalItem(index, "unitPrice", event.target.value)} placeholder="0,00" />
                      </div>
                      <button type="button" className="proposal-remove" onClick={() => removeProposalItem(index)} aria-label="Remover item">×</button>
                    </div>
                  ))}
                </div>

                <div className="proposal-form-grid">
                  <div className="proposal-field">
                    <label htmlFor="proposal-notes">Observações da proposta</label>
                    <textarea id="proposal-notes" value={proposalNotes} onChange={(event) => setProposalNotes(event.target.value)} placeholder="Inclua condições, prazo, detalhes do serviço ou informações importantes." />
                  </div>
                  <div>
                    <div className="proposal-field">
                      <label htmlFor="proposal-discount">Desconto</label>
                      <input id="proposal-discount" inputMode="decimal" value={proposalDiscount} onChange={(event) => setProposalDiscount(event.target.value)} placeholder="0,00" />
                    </div>
                    <div className="proposal-field" style={{ marginTop: 12 }}>
                      <label htmlFor="proposal-validity">Validade</label>
                      <input id="proposal-validity" type="date" value={proposalValidity} onChange={(event) => setProposalValidity(event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="proposal-summary">
                  <div className="proposal-summary-box">
                    <div className="proposal-summary-line"><span>Subtotal</span><strong>{money(proposalSubtotal())}</strong></div>
                    <div className="proposal-summary-line"><span>Desconto</span><strong>{money(Number(proposalDiscount.replace(",", ".")) || 0)}</strong></div>
                    <div className="proposal-summary-line total"><span>Total da proposta</span><strong>{money(proposalTotal())}</strong></div>
                  </div>
                </div>

                <div className="proposal-actions">
                  <button type="button" className="quotes-secondary" onClick={resetProposalForm}>Limpar</button>
                  <button type="button" className="quotes-whatsapp" disabled={savingProposal} onClick={() => createAndSendProposal("whatsapp")}>
                    {savingProposal ? "Preparando..." : "Enviar proposta pelo WhatsApp"}
                  </button>
                  <button type="button" className="proposal-primary" disabled={savingProposal} onClick={() => createAndSendProposal("pdf")}>
                    {savingProposal ? "Gerando PDF..." : "Gerar proposta em PDF"}
                  </button>
                  <button type="button" className="quotes-secondary" disabled={savingProposal} onClick={() => createAndSendProposal("pdf-whatsapp")}>
                    {savingProposal ? "Preparando..." : "PDF + WhatsApp"}
                  </button>
                </div>
                <p className="proposal-hint">Esta ferramenta é para o fornecedor criar e enviar uma proposta comercial ao cliente. No envio direto, informe os dados do destinatário. O PDF usa a identidade premium do LOSI CONECTA e pode ser salvo ou compartilhado pelo navegador.</p>
          </section>
        )}

        {isSupplier && (
          <div className="quotes-supplier-intro">
            <div>
              <div className="quotes-kicker">ÁREA DO FORNECEDOR</div>
              <h2>Receber solicitações e enviar orçamentos</h2>
              <p>Esta área aparece porque sua conta também possui um perfil de fornecedor.</p>
            </div>
          </div>
        )}

        <section className="quotes-dashboard" aria-label="Resumo dos orçamentos">
          <div className="quotes-dashboard-head">
            <div>
              <div className="quotes-kicker">PAINEL DE ORÇAMENTOS</div>
              <h2>Acompanhe suas propostas</h2>
              <p>Veja rapidamente quantos orçamentos foram enviados e qual foi a resposta dos clientes.</p>
            </div>
          </div>

          <div className="quotes-dashboard-grid">
            <button type="button" className="quotes-dashboard-card quotes-dashboard-card-button" onClick={() => setDashboardFilter("sent")}>
              <div className="quotes-dashboard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3.75h7.2L19 8.55V20.25H7z"/><path d="M14 3.75v4.8h5"/><path d="M10 15.25h7"/><path d="M14.5 11.75 18 15.25l-3.5 3.5"/></svg></div>
              <div className="quotes-dashboard-label">ORÇAMENTOS ENVIADOS</div>
              <strong>{sentQuotesCount}</strong>
              <span>Total de propostas enviadas aos clientes</span>
            </button>

            <button type="button" className="quotes-dashboard-card accepted quotes-dashboard-card-button" onClick={() => setDashboardFilter("accepted")}>
              <div className="quotes-dashboard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.75"/><path d="m8.25 12.15 2.55 2.55 4.95-5.2"/></svg></div>
              <div className="quotes-dashboard-label">ORÇAMENTOS ACEITOS</div>
              <strong>{acceptedQuotesCount}</strong>
              <span>Propostas que foram aceitas pelo cliente</span>
            </button>

            <button type="button" className="quotes-dashboard-card rejected quotes-dashboard-card-button" onClick={() => setDashboardFilter("rejected")}>
              <div className="quotes-dashboard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.75"/><path d="m9.15 9.15 5.7 5.7M14.85 9.15l-5.7 5.7"/></svg></div>
              <div className="quotes-dashboard-label">ORÇAMENTOS REJEITADOS</div>
              <strong>{rejectedQuotesCount}</strong>
              <span>Propostas que foram recusadas pelo cliente</span>
            </button>
          </div>
        </section>

        {dashboardFilter && (() => {
          const categoryQuotes = quotes
            .filter((quote) => dashboardFilter === "sent"
              ? Boolean(quote.sent_at) || ["sent", "viewed", "accepted", "rejected"].includes(quote.status)
              : quote.status === dashboardFilter)
            .filter((quote) => {
              if (dashboardDateFilter === "all" || !dashboardDateValue) return true;
              const sourceDate = quote.sent_at || quote.created_at;
              const date = new Date(sourceDate);
              if (Number.isNaN(date.getTime())) return false;
              const [year, month, day] = dashboardDateValue.split("-").map(Number);
              if (dashboardDateFilter === "year") return date.getFullYear() === year;
              if (dashboardDateFilter === "month") return date.getFullYear() === year && date.getMonth() + 1 === month;
              return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
            })
            .sort((a, b) => new Date(b.sent_at || b.created_at).getTime() - new Date(a.sent_at || a.created_at).getTime());

          return (
            <div className="quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDashboardModal(); }}>
              <section className="quote-modal quotes-dashboard-list-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-list-title">
                <div className="quote-modal-head">
                  <div>
                    <div className="quotes-kicker">PAINEL DE ORÇAMENTOS</div>
                    <h2 id="dashboard-list-title">{dashboardFilter === "sent" ? "Orçamentos enviados" : dashboardFilter === "accepted" ? "Orçamentos aceitos" : "Orçamentos rejeitados"}</h2>
                    <p>Consulte as propostas por período e abra qualquer uma para ver os detalhes.</p>
                  </div>
                  <button type="button" className="quotes-secondary quote-modal-close" onClick={closeDashboardModal} aria-label="Fechar">Fechar</button>
                </div>

                <div className="quotes-dashboard-filters">
                  <label>
                    <span>Período</span>
                    <select value={dashboardDateFilter} onChange={(event) => { setDashboardDateFilter(event.target.value as typeof dashboardDateFilter); setDashboardDateValue(""); }}>
                      <option value="all">Todos</option>
                      <option value="day">Dia</option>
                      <option value="month">Mês</option>
                      <option value="year">Ano</option>
                    </select>
                  </label>
                  {dashboardDateFilter !== "all" && (
                    <label>
                      <span>{dashboardDateFilter === "day" ? "Escolha o dia" : dashboardDateFilter === "month" ? "Escolha o mês" : "Escolha o ano"}</span>
                      <input
                        type={dashboardDateFilter === "year" ? "number" : dashboardDateFilter === "month" ? "month" : "date"}
                        value={dashboardDateValue}
                        onChange={(event) => setDashboardDateValue(event.target.value)}
                        min={dashboardDateFilter === "year" ? "2000" : undefined}
                        max={dashboardDateFilter === "year" ? "2100" : undefined}
                        placeholder={dashboardDateFilter === "year" ? "AAAA" : undefined}
                      />
                    </label>
                  )}
                  <div className="quotes-dashboard-filter-count">{categoryQuotes.length} {categoryQuotes.length === 1 ? "proposta encontrada" : "propostas encontradas"}</div>
                </div>

                <div className="quotes-dashboard-list">
                  {categoryQuotes.length === 0 ? (
                    <div className="quotes-dashboard-empty">Nenhum orçamento encontrado para este período.</div>
                  ) : categoryQuotes.map((quote) => {
                    const recipient = quote.quote_requests?.client_name || "Destinatário não informado";
                    const responseDate = quote.status === "accepted" || quote.status === "rejected" ? quote.quote_requests?.status === quote.status ? quote.quote_requests?.created_at : null : null;
                    return (
                      <button key={quote.id} type="button" className="quotes-dashboard-list-item" onClick={() => { setDashboardFilter(null); setSelectedQuote(quote); }}>
                        <div>
                          <strong>{recipient}</strong>
                          <span>{quote.quote_requests?.event_title || "Evento não informado"}</span>
                          <small>Enviado em {dateTime(quote.sent_at || quote.created_at)}</small>
                          {quote.status === "accepted" && <small className="quotes-dashboard-response accepted">Aceito pelo cliente</small>}
                          {quote.status === "rejected" && <small className="quotes-dashboard-response rejected">Recusado pelo cliente</small>}
                        </div>
                        <div className="quotes-dashboard-list-value">
                          <strong>{money(Number(quote.total))}</strong>
                          <span className={"quote-status-pill " + quote.status}>{statusLabel(quote.status)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          );
        })()}

        {selectedRequest && (
          <div className="quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRequestModal(); }}>
            <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
              <div className="quote-modal-head">
                <div>
                  <div className="quotes-kicker">DETALHAMENTO DA SOLICITAÇÃO</div>
                  <h2 id="request-modal-title">{selectedRequest.event_title}</h2>
                </div>
                <button type="button" className="quotes-secondary quote-modal-close" onClick={closeRequestModal} aria-label="Fechar">Fechar</button>
              </div>

              <div className="quote-modal-parties">
                <div className="quote-modal-party">
                  <span>CLIENTE / SOLICITANTE</span>
                  <strong>{selectedRequest.client_name || "Não informado"}</strong>
                  <p>E-mail: {selectedRequest.client_email || "Não informado"}</p>
                  <p>WhatsApp/Telefone: {selectedRequest.client_phone || "Não informado"}</p>
                </div>
              </div>

              <div className="quote-modal-event">
                <h3>Dados do evento</h3>
                <p><strong>Serviço solicitado:</strong> {serviceName(selectedRequest)}</p>
                <p><strong>Data do evento:</strong> {dateOnly(selectedRequest.event_date)}</p>
                <p><strong>Local:</strong> {selectedRequest.event_location || "Não informado"}</p>
                <p><strong>Solicitação recebida em:</strong> {dateTime(selectedRequest.created_at)}</p>
                <p><strong>Status:</strong> {statusLabel(selectedRequest.status)}</p>
              </div>

              <div className="quote-modal-items">
                <h3>Detalhes do pedido</h3>
                <div className="quote-modal-request-description">
                  {selectedRequest.description
                    ? <p>{selectedRequest.description}</p>
                    : <p>Nenhuma descrição adicional foi informada pelo solicitante.</p>}
                </div>
              </div>

              {isSupplier && (
                <>
                  <div className="quote-modal-total quote-modal-request-next">
                    <span>Próxima etapa</span>
                    <strong>Preparar e enviar o orçamento ao cliente.</strong>
                  </div>
                  <div className="quote-modal-actions">
                  <button
                    type="button"
                    className="proposal-primary"
                    onClick={() => prepareProposalFromRequest(selectedRequest)}
                  >
                    Preparar orçamento
                  </button>
                  <button
                    type="button"
                    className="quotes-whatsapp"
                    onClick={() => openWhatsApp(selectedRequest.client_phone, buildRequestWhatsAppMessage(selectedRequest))}
                  >
                    Responder pelo WhatsApp
                  </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {selectedQuote && (
          <div className="quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeQuoteModal(); }}>
            <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-modal-title">
              <div className="quote-modal-head">
                <div>
                  <div className="quotes-kicker">DETALHAMENTO DA PROPOSTA</div>
                  <h2 id="quote-modal-title">{selectedRequester?.event_title || "Proposta"}</h2>
                </div>
                <button type="button" className="quotes-secondary quote-modal-close" onClick={closeQuoteModal}>Fechar</button>
              </div>

              <div className="quote-modal-parties">
                <div className="quote-modal-party">
                  <span>{isSupplier ? "SOLICITANTE" : "FORNECEDOR"}</span>
                  <strong>{isSupplier ? (selectedRequester?.client_name || "Não informado") : (selectedSupplier?.business_name || "Fornecedor")}</strong>
                  <p>E-mail: {isSupplier ? (selectedRequester?.client_email || "Não informado") : "E-mail não disponibilizado no perfil"}</p>
                  <p>Contato: {isSupplier ? (selectedRequester?.client_phone || "Não informado") : (selectedSupplier?.whatsapp || selectedSupplier?.phone || "Não informado")}</p>
                  {!isSupplier && selectedSupplier?.id && (
                    <Link className="quote-modal-profile-link" to={"/fornecedor/" + selectedSupplierSlug}>Perfil público do fornecedor</Link>
                  )}
                  {isSupplier && selectedRequesterProfile?.slug && (
                    <Link className="quote-modal-profile-link" to={"/fornecedor/" + selectedRequesterProfile.slug}>Perfil público do solicitante</Link>
                  )}
                </div>
              </div>

              <div className="quote-modal-event">
                <h3>Dados do evento</h3>
                <p><strong>Serviço:</strong> {serviceName(selectedRequester)}</p>
                <p><strong>Data:</strong> {dateOnly(selectedRequester?.event_date ?? null)}</p>
                <p><strong>Local:</strong> {selectedRequester?.event_location || "Não informado"}</p>
                <p><strong>Enviado em:</strong> {dateTime(selectedQuote.sent_at || selectedQuote.created_at)}</p>
                {selectedQuote.status === "accepted" && <p className="quote-modal-response accepted"><strong>Aceito em:</strong> {selectedQuote.responded_at ? dateTime(selectedQuote.responded_at) : "Resposta registrada"}</p>}
                {selectedQuote.status === "rejected" && <p className="quote-modal-response rejected"><strong>Recusado em:</strong> {selectedQuote.responded_at ? dateTime(selectedQuote.responded_at) : "Resposta registrada"}</p>}
                {selectedRequester?.description && <p><strong>Detalhes:</strong> {selectedRequester.description}</p>}
              </div>

              <div className="quote-modal-items">
                <h3>Itens da proposta</h3>
                {selectedItemLines.length ? selectedItemLines.map((item) => (
                  <div key={item.id} className="quote-modal-item">
                    <div><strong>{item.description}</strong><span>{item.quantity} x {money(Number(item.unit_price))}</span></div>
                    <strong>{money(Number(item.total))}</strong>
                  </div>
                )) : <p>Nenhum item detalhado.</p>}
              </div>

              <div className="quote-modal-total">
                <div><span>Subtotal</span><strong>{money(Number(selectedQuote.subtotal))}</strong></div>
                <div><span>Desconto</span><strong>{money(Number(selectedQuote.discount))}</strong></div>
                <div className="grand"><span>TOTAL</span><strong>{money(Number(selectedQuote.total))}</strong></div>
              </div>

              {selectedQuote.validity_until && <p className="quote-modal-note"><strong>Validade:</strong> {dateOnly(selectedQuote.validity_until)}</p>}
              {selectedQuote.notes && <p className="quote-modal-note"><strong>Observações:</strong> {selectedQuote.notes}</p>}
              <div className="quote-modal-actions quote-modal-actions-enhanced">
                {isSupplier && (
                  <>
                    <button type="button" className="quotes-whatsapp" onClick={() => shareQuoteOnWhatsApp(selectedQuote)}>
                      Enviar pelo WhatsApp
                    </button>
                    <button type="button" className="quotes-secondary" onClick={() => downloadQuotePdf(selectedQuote)}>
                      Gerar PDF
                    </button>
                    <button type="button" className="quotes-secondary" onClick={() => shareQuotePdfOnWhatsApp(selectedQuote)}>
                      PDF + WhatsApp
                    </button>
                  </>
                )}
                <button type="button" className="quotes-secondary quote-delete-button" onClick={() => deleteQuote(selectedQuote)}>
                  Excluir orçamento
                </button>
              </div>
            </section>
          </div>
        )}
        {message && <div className={"quotes-message " + messageType} role="status">{message}</div>}



      </section>
    </main>
  );
}
