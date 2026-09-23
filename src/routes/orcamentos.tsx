import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { AppLogo } from "../components/AppLogo";

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
  services?: { name: string } | null;
};

type QuoteRow = {
  id: string;
  request_id: string;
  business_id: string;
  client_id: string;
  subtotal: number;
  discount: number;
  total: number;
  validity_until: string | null;
  notes: string | null;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
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
  const [proposalRequestId, setProposalRequestId] = useState("");
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
            .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
          supabase.from("quotes")
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
        ]);

        if (requestsError) console.error("Erro ao carregar solicitações de orçamento:", requestsError);
        if (quotesError) console.error("Erro ao carregar orçamentos enviados:", quotesError);

        const { data: requestedByUser } = await supabase
          .from("quote_requests")
          .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
          .eq("requester_id", currentUser.id)
          .order("created_at", { ascending: false });

        const { data: receivedByUser } = await supabase
          .from("quotes")
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
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
          setRequests((requestRows ?? []) as unknown as RequestRow[]);
          setQuotes((quoteRows ?? []) as unknown as QuoteRow[]);
          setClientRequests((requestedByUser ?? []) as unknown as RequestRow[]);
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
          .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
          .eq("requester_id", currentUser.id)
          .order("created_at", { ascending: false });

        const { data: received, error: receivedError } = await supabase
          .from("quotes")
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (requestedError) console.error("Erro ao carregar solicitações enviadas:", requestedError);
        if (receivedError) console.error("Erro ao carregar orçamentos recebidos:", receivedError);

        if (mounted) {
          setClientRequests((requested ?? []) as unknown as RequestRow[]);
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
        .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
        .eq("requester_id", userId)
        .order("created_at", { ascending: false });

      const clientQuotesPromise = supabase
        .from("quotes")
        .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
        .eq("client_id", userId)
        .order("created_at", { ascending: false });

      const [requestedResult, receivedResult] = await Promise.all([
        clientRequestsPromise,
        clientQuotesPromise,
      ]);

      if (!active) return;

      if (!requestedResult.error) {
        setClientRequests((requestedResult.data ?? []) as unknown as RequestRow[]);
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
            .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
          supabase
            .from("quotes")
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
        ]);

        if (!active) return;

        if (!supplierRequestsResult.error) {
          setRequests((supplierRequestsResult.data ?? []) as unknown as RequestRow[]);
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

  function shareQuoteOnWhatsApp(quote: QuoteRow) {
    const request = quote.quote_requests;
    const business = businessContacts[quote.business_id];
    const message = buildQuoteWhatsAppMessage(
      quote,
      request?.client_name || "cliente",
      business?.business_name || "Fornecedor",
    );
    const number = normalizeWhatsAppNumber(request?.client_phone);
    const url = number
      ? "https://wa.me/" + number + "?text=" + encodeURIComponent(message)
      : "https://wa.me/?text=" + encodeURIComponent(message);
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
  const closeRequestModal = () => setSelectedRequest(null);


  const isSupplier = Boolean(businessId);

  // Uma solicitação só deixa de estar "Aguardando orçamento" quando existe
  // um orçamento vinculado a ela. O status textual da solicitação não é
  // usado como fonte única da verdade, evitando divergência entre os painéis.
  const clientQuoteRequestIds = new Set(clientQuotes.map((quote) => quote.request_id));
  const supplierQuoteRequestIds = new Set(quotes.map((quote) => quote.request_id));

  const clientPendingRequests = clientRequests.filter(
    (request) => !clientQuoteRequestIds.has(request.id),
  );

  const supplierPendingRequests = requests.filter(
    (request) => !supplierQuoteRequestIds.has(request.id),
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
    setProposalRequestId("");
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

  async function resolveProposalRecipient(value: string, request: RequestRow): Promise<BusinessContact | null> {
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
      if (data.owner_id !== request.requester_id) {
        throw new Error("Este perfil público não pertence ao solicitante desta solicitação. Confira o link antes de enviar.");
      }
      if (!data.whatsapp && !data.phone) {
        throw new Error("O perfil público foi encontrado, mas não possui WhatsApp ou telefone cadastrado.");
      }
      const recipient = data as BusinessContact;
      setResolvedProposalRecipient(recipient);
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

  async function createAndSendProposal() {
    if (!businessId || !userId) return;
    const request = supplierPendingRequests.find((item) => item.id === proposalRequestId);
    if (!request) {
      setMessageType("error");
      setMessage("Selecione uma solicitação para montar a proposta.");
      return;
    }

    const profileLink = proposalProfileLink.trim();
    let linkedRecipient = resolvedProposalRecipient;
    if (profileLink && !linkedRecipient) {
      linkedRecipient = await resolveProposalRecipient(profileLink, request);
    }
    if (profileLink) {
      const slug = extractPublicProfileSlug(profileLink);
      if (!slug || !linkedRecipient) {
        setMessageType("error");
        setMessage("Identifique o destinatário pelo link do perfil público antes de enviar a proposta.");
        return;
      }
      if (linkedRecipient.owner_id !== request.requester_id) {
        setMessageType("error");
        setMessage("O perfil público informado não corresponde ao solicitante desta solicitação.");
        return;
      }
    }

    const recipientPhone = linkedRecipient?.whatsapp || linkedRecipient?.phone || request.client_phone;
    if (!recipientPhone) {
      setMessageType("error");
      setMessage("Não encontramos um WhatsApp para este destinatário. Informe o link do perfil público que possui o WhatsApp cadastrado.");
      return;
    }

    const validItems = proposalItems
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice.replace(",", ".")),
      }))
      .filter((item) => item.description && item.quantity > 0 && Number.isFinite(item.unit_price) && item.unit_price >= 0);

    if (!validItems.length) {
      setMessageType("error");
      setMessage("Adicione pelo menos um item válido à proposta.");
      return;
    }

    const subtotal = validItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const discount = Math.max(0, Number(proposalDiscount.replace(",", ".")) || 0);
    const total = Math.max(0, subtotal - discount);

    setSavingProposal(true);
    setMessage("");
    try {
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          request_id: request.id,
          business_id: businessId,
          client_id: request.requester_id,
          subtotal,
          discount,
          total,
          validity_until: proposalValidity || null,
          notes: proposalNotes.trim() || null,
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at")
        .single();

      if (quoteError || !quote) throw quoteError || new Error("Não foi possível criar a proposta.");

      const { error: itemsError } = await supabase.from("quote_items").insert(
        validItems.map((item) => ({
          quote_id: quote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        })),
      );

      if (itemsError) {
        await supabase.from("quotes").delete().eq("id", quote.id).eq("business_id", businessId);
        throw itemsError;
      }

      await supabase.from("quote_requests").update({ status: "quoted" }).eq("id", request.id).eq("business_id", businessId);

      const supplier = businessContacts[businessId];
      const profileUrl = supplier?.slug
        ? window.location.origin + "/fornecedor/" + supplier.slug + "?proposta=" + quote.id
        : "";
      const supplierName = personalIdentity?.full_name || supplier?.business_name || "Fornecedor";
      const whatsappMessage = [
        "Olá, " + request.client_name + "!",
        "",
        "Preparei sua proposta pelo LOSI CONECTA.",
        "",
        "Fornecedor: " + supplierName,
        "Empresa: " + (supplier?.business_name || "Não informada"),
        "Telefone: " + (supplier?.phone || supplier?.whatsapp || "Não informado"),
        "E-mail: " + userEmail,
        linkedRecipient ? "Perfil público do destinatário: " + (window.location.origin + "/fornecedor/" + linkedRecipient.slug) : "",
        linkedRecipient ? "WhatsApp do destinatário: " + recipientPhone : "",
        "",
        "Valor total: " + money(total),
        proposalValidity ? "Validade: " + formatQuoteDate(proposalValidity) : "",
        "",
        profileUrl ? "Acesse sua proposta pelo link abaixo:" : "",
        profileUrl,
      ].filter(Boolean).join("\n");

      const number = normalizeWhatsAppNumber(recipientPhone);
      const whatsappUrl = number
        ? "https://wa.me/" + number + "?text=" + encodeURIComponent(whatsappMessage)
        : "https://wa.me/?text=" + encodeURIComponent(whatsappMessage);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      const createdQuote = {
        ...(quote as QuoteRow),
        quote_items: validItems.map((item, index) => ({
          id: "local-" + index,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        })),
        quote_requests: request,
      } as QuoteRow;
      setQuotes((current) => [createdQuote, ...current]);
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: "quoted" } : item));
      resetProposalForm();
      setMessageType("success");
      setMessage("Proposta criada e o WhatsApp foi aberto para envio ao cliente.");
    } catch (error: any) {
      console.error("Erro ao criar proposta:", error);
      setMessageType("error");
      setMessage(error?.message || "Não foi possível criar a proposta.");
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
        .quotes-dashboard-card{min-width:0;padding:20px;border:1px solid rgba(11,24,42,.10);border-radius:16px;background:#fff;box-shadow:0 8px 22px rgba(7,17,31,.06)}
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
        .proposal-recipient-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr);gap:14px;margin-top:14px}
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
        <p className="quotes-intro">Acompanhe o que você solicitou, os orçamentos que recebeu e, quando também for fornecedor, as solicitações e propostas da sua empresa.</p>

        {isSupplier && (
          <section className="proposal-builder" aria-labelledby="proposal-builder-title">
            <div className="proposal-builder-head">
              <div>
                <div className="quotes-kicker">NOVA PROPOSTA</div>
                <h2 id="proposal-builder-title">Preparar orçamento para o cliente</h2>
                <p>Monte uma proposta detalhada com os dados do fornecedor e envie o acesso diretamente pelo WhatsApp.</p>
              </div>
            </div>

            
                <div className="proposal-field" style={{ marginBottom: 18 }}>
                  <label htmlFor="proposal-request">Cliente e solicitação</label>
                  <select id="proposal-request" value={proposalRequestId} onChange={(event) => setProposalRequestId(event.target.value)}>
                    <option value="">Selecione a solicitação</option>
                    {supplierPendingRequests.map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.client_name} — {request.event_title} — {serviceName(request)}
                      </option>
                    ))}
                  </select>
                </div>

                {proposalRequestId && (() => {
                  const request = supplierPendingRequests.find((item) => item.id === proposalRequestId);
                  if (!request) return null;
                  return (
                    <div className="proposal-recipient">
                      <div className="proposal-recipient-head">
                        <strong>DESTINATÁRIO DA PROPOSTA</strong>
                        <span>Use o link do perfil público quando o solicitante também for fornecedor.</span>
                      </div>
                      <div className="proposal-recipient-grid">
                        <div>
                          <label htmlFor="proposal-profile-link">Link do perfil público do solicitante</label>
                          <input
                            id="proposal-profile-link"
                            value={proposalProfileLink}
                            onChange={(event) => {
                              setProposalProfileLink(event.target.value);
                              setResolvedProposalRecipient(null);
                            }}
                            onBlur={(event) => resolveProposalRecipient(event.target.value, request)}
                            placeholder="Cole aqui o link /fornecedor/..."
                          />
                          <small>O sistema usa esse perfil para encontrar automaticamente o WhatsApp cadastrado.</small>
                        </div>
                        <div className="proposal-recipient-status">
                          <span>Solicitante</span>
                          <strong>{resolvedProposalRecipient?.business_name || request.client_name}</strong>
                          <p>
                            WhatsApp:{" "}
                            {resolvingProposalRecipient
                              ? "Identificando..."
                              : resolvedProposalRecipient
                                ? (resolvedProposalRecipient.whatsapp || resolvedProposalRecipient.phone)
                                : (proposalProfileLink ? "Aguardando identificação" : (request.client_phone || "Não informado"))}
                          </p>
                          {resolvedProposalRecipient?.slug && (
                            <a href={window.location.origin + "/fornecedor/" + resolvedProposalRecipient.slug} target="_blank" rel="noreferrer">
                              Abrir perfil público
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                  <button type="button" className="proposal-primary" disabled={savingProposal || !proposalRequestId} onClick={createAndSendProposal}>
                    {savingProposal ? "Preparando proposta..." : "Criar proposta e enviar pelo WhatsApp"}
                  </button>
                </div>
                <p className="proposal-hint">O WhatsApp será aberto com a mensagem pronta e o link da proposta.</p>
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
            <article className="quotes-dashboard-card">
              <div className="quotes-dashboard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3.75h7.2L19 8.55V20.25H7z"/><path d="M14 3.75v4.8h5"/><path d="M10 15.25h7"/><path d="M14.5 11.75 18 15.25l-3.5 3.5"/></svg></div>
              <div className="quotes-dashboard-label">ORÇAMENTOS ENVIADOS</div>
              <strong>{sentQuotesCount}</strong>
              <span>Total de propostas enviadas aos clientes</span>
            </article>

            <article className="quotes-dashboard-card accepted">
              <div className="quotes-dashboard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.75"/><path d="m8.25 12.15 2.55 2.55 4.95-5.2"/></svg></div>
              <div className="quotes-dashboard-label">ORÇAMENTOS ACEITOS</div>
              <strong>{acceptedQuotesCount}</strong>
              <span>Propostas que foram aceitas pelo cliente</span>
            </article>

            <article className="quotes-dashboard-card rejected">
              <div className="quotes-dashboard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.75"/><path d="m9.15 9.15 5.7 5.7M14.85 9.15l-5.7 5.7"/></svg></div>
              <div className="quotes-dashboard-label">ORÇAMENTOS REJEITADOS</div>
              <strong>{rejectedQuotesCount}</strong>
              <span>Propostas que foram recusadas pelo cliente</span>
            </article>
          </div>
        </section>

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
              <div className="quote-modal-actions">
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
