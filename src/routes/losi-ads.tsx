import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "../losi-ads.css";

export const Route = createFileRoute("/losi-ads")({
  component: LosiAdsPage,
});

type AdType = "event" | "opportunity";

type CreditPackage = {
  id: string;
  credits: number;
  price_cents: number;
  featured: boolean;
};

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

type MyAd = {
  id: string;
  ad_type: AdType;
  status: string;
  title: string;
  category: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  city: string | null;
  state: string | null;
  quantity: number | null;
  value_cents: number | null;
  published_at: string | null;
  expires_at: string | null;
};

type Application = {
  id: string;
  ad_id: string;
  user_id: string;
  message: string | null;
  status: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    city: string | null;
    state: string | null;
  } | null;
};

type MyApplication = {
  id: string;
  ad_id: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  ad: {
    title: string;
    ad_type: AdType;
    category: string | null;
    event_date: string | null;
    start_time: string | null;
    end_time: string | null;
    city: string | null;
    state: string | null;
    contact: string | null;
  } | null;
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
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(10);
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchaseDocument, setPurchaseDocument] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [myAds, setMyAds] = useState<MyAd[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [selectedMyAd, setSelectedMyAd] = useState<MyAd | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [myApplications, setMyApplications] = useState<MyApplication[]>([]);
  const [myApplicationsLoading, setMyApplicationsLoading] = useState(true);
  const [pendingInvoices, setPendingInvoices] = useState<Array<{id:string;status:string|null;dueDate:string|null;invoiceUrl:string|null;bankSlipUrl:string|null;billingType:string|null;value:number|null;description:string|null;type:"ads"|"subscription"|"other";title:string}>>([]);
  const [pendingInvoicesOpen, setPendingInvoicesOpen] = useState(false);
  const [pendingInvoicesLoading, setPendingInvoicesLoading] = useState(false);
  const [cancellingInvoiceId, setCancellingInvoiceId] = useState<string | null>(null);
  const [pendingInvoicesMessage, setPendingInvoicesMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) { navigate({ to: "/entrar" }); return; }
      const { data } = await supabase.auth.getUser();
      if (!data.user) { navigate({ to: "/entrar" }); return; }
      if (mounted) {
        const [{ data: wallet }, { data: packages }, { data: ownAds }] = await Promise.all([
          supabase.from("losi_ads_wallets").select("balance").eq("user_id", data.user.id).maybeSingle(),
          supabase.from("losi_ads_credit_packages").select("id,credits,price_cents,featured").eq("active", true).order("credits"),
          supabase.from("losi_ads").select("id,ad_type,status,title,category,event_date,start_time,end_time,city,state,quantity,value_cents,published_at,expires_at").eq("user_id", data.user.id).order("created_at", { ascending: false }),
        ]);
        if (wallet) setCreditBalance(wallet.balance ?? 0);
        setCreditPackages((packages ?? []) as CreditPackage[]);
        setMyAds((ownAds ?? []) as MyAd[]);
        setAdsLoading(false);

        const { data: applicationRows } = await supabase
          .from("losi_ads_applications")
          .select("id,ad_id,message,status,created_at")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false });

        const rows = applicationRows ?? [];
        if (rows.length) {
          const adIds = [...new Set(rows.map(item => item.ad_id))];
          const { data: adRows } = await supabase
            .from("losi_ads")
            .select("id,title,ad_type,category,event_date,start_time,end_time,city,state,contact")
            .in("id", adIds);

          const adMap = new Map((adRows ?? []).map(ad => [ad.id, ad]));
          setMyApplications(rows.map(item => ({
            ...item,
            ad: adMap.get(item.ad_id) ?? null,
          })) as MyApplication[]);
        } else {
          setMyApplications([]);
        }
        setMyApplicationsLoading(false);
        if (packages?.length && !packages.some(pkg => pkg.credits === 10)) setSelectedPackage(packages[0].credits);
        setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [navigate]);

  async function loadPendingInvoices() {
    if (!supabase) return;
    setPendingInvoicesLoading(true);
    setPendingInvoicesMessage("");
    setPendingInvoices([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente para continuar.");
      const response = await fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/asaas-manage-pending-subscription", { method: "POST", headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify({ action: "ads_invoices" }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || "Não foi possível carregar as faturas.");
      setPendingInvoices(Array.isArray(result.invoices) ? result.invoices : []);
    } catch (error) { setPendingInvoicesMessage(error instanceof Error ? error.message : "Não foi possível carregar as faturas."); }
    finally { setPendingInvoicesLoading(false); }
  }

  async function cancelAdsInvoice(invoice: typeof pendingInvoices[number]) {
    if (!supabase || invoice.type !== "ads" || cancellingInvoiceId) return;
    if (!window.confirm("Deseja cancelar esta fatura de créditos ADS? Esta ação cancela a cobrança pendente no Asaas.")) return;
    setCancellingInvoiceId(invoice.id);
    setPendingInvoicesMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente para continuar.");
      const response = await fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/asaas-manage-pending-subscription", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_ads_invoice", paymentId: invoice.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || "Não foi possível cancelar a fatura ADS.");
      setPendingInvoices(current => current.filter(item => item.id !== invoice.id));
      setPendingInvoicesMessage("Fatura ADS cancelada com sucesso.");
    } catch (error) {
      setPendingInvoicesMessage(error instanceof Error ? error.message : "Não foi possível cancelar a fatura ADS.");
    } finally {
      setCancellingInvoiceId(null);
    }
  }

  function openPendingInvoice(invoice: typeof pendingInvoices[number]) {
    const url = invoice.invoiceUrl || invoice.bankSlipUrl;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  }

  function changeType(nextType: AdType) {
    setType(nextType);
    setMessage("");
  }

  async function startCreditPurchase() {
    if (!supabase) return;
    const selected = creditPackages.find(pkg => pkg.credits === selectedPackage);
    if (!selected) {
      setPurchaseMessage("Selecione um pacote disponível.");
      return;
    }

    setPurchaseLoading(true);
    setPurchaseMessage("");
    setPurchaseUrl("");

    const { data, error } = await supabase.functions.invoke("asaas-create-ads-credit-purchase", {
      body: { packageId: selected.id, document: purchaseDocument },
    });

    if (error || !data?.success) {
      let detail = data?.error ?? "";

      if (!detail && error) {
        const context = (error as { context?: Response }).context;
        if (context) {
          try {
            const body = await context.clone().json();
            detail = body?.error ?? body?.message ?? "";
            if (body?.details?.errors?.length) {
              detail += " " + body.details.errors
                .map((item: { description?: string }) => item.description)
                .filter(Boolean)
                .join(" ");
            }
          } catch {
            // Keep the SDK error message when the response is not JSON.
          }
        }
      }

      setPurchaseMessage(detail || error?.message || "Não foi possível iniciar o pagamento.");
      setPurchaseLoading(false);
      return;
    }

    const url = data.payment?.invoiceUrl ?? data.payment?.bankSlipUrl ?? "";
    setPurchaseUrl(url);
    setPurchaseMessage(
      "Cobrança criada. Conclua o pagamento pela página do Asaas. Os créditos entram automaticamente após a confirmação."
    );
    setPurchaseLoading(false);
  }

  async function removeMyAd(ad: MyAd) {
    if (!supabase) return;
    const confirmed = window.confirm(`Deseja remover o anúncio "${ad.title}"? Ele deixará de aparecer no LOSI CONECTA. O crédito utilizado na publicação não será devolvido.`);
    if (!confirmed) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("losi_ads").delete().eq("id", ad.id).eq("user_id", userData.user?.id ?? "");
    if (error) { setMessage("Não foi possível remover o anúncio."); console.error("Erro ao remover anúncio:", error); return; }
    setMyAds(current => current.filter(item => item.id !== ad.id));
    if (selectedMyAd?.id === ad.id) setSelectedMyAd(null);
    setMessage("Anúncio removido com sucesso.");
  }

  async function openApplications(ad: MyAd) {
    setSelectedMyAd(ad);
    setApplications([]);
    if (ad.ad_type !== "opportunity") return;
    setApplicationsLoading(true);
    const { data, error } = await supabase
      .from("losi_ads_applications")
      .select("id,ad_id,user_id,message,status,created_at")
      .eq("ad_id", ad.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const userIds = [...new Set(data.map(item => item.user_id))];
      let profiles: Array<{ id: string; full_name: string | null; phone: string | null; avatar_url: string | null; city: string | null; state: string | null }> = [];
      if (userIds.length) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id,full_name,phone,avatar_url,city,state")
          .in("id", userIds);
        profiles = profileRows ?? [];
      }
      setApplications(data.map(item => ({
        ...item,
        profile: profiles.find(profile => profile.id === item.user_id) ?? null,
      })) as Application[]);
    }
    setApplicationsLoading(false);
  }
  async function updateApplicationStatus(applicationId: string, status: "accepted" | "rejected") {
    if (!supabase || !selectedMyAd) return;
    const { error } = await supabase
      .from("losi_ads_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", applicationId)
      .eq("ad_id", selectedMyAd.id);
    if (error) return;
    setApplications(current => current.map(item =>
      item.id === applicationId ? { ...item, status } : item
    ));
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (creditBalance < 1) {
      setMessage("Você precisa de pelo menos 1 crédito ADS para publicar.");
      return;
    }

    const draft = type === "event" ? eventDraft : opportunityDraft;
    const payload = type === "event"
      ? {
          p_ad_type: "event",
          p_title: eventDraft.name,
          p_category: eventDraft.category,
          p_event_date: eventDraft.date || null,
          p_start_time: eventDraft.startTime || null,
          p_end_time: eventDraft.endTime || null,
          p_city: eventDraft.city,
          p_state: eventDraft.state,
          p_cep: eventDraft.cep,
          p_description: eventDraft.description,
          p_contact: eventDraft.contact,
        }
      : {
          p_ad_type: "opportunity",
          p_title: opportunityDraft.title,
          p_role: opportunityDraft.role,
          p_quantity: opportunityDraft.quantity ? Number(opportunityDraft.quantity) : null,
          p_event_date: opportunityDraft.date || null,
          p_start_time: opportunityDraft.startTime || null,
          p_end_time: opportunityDraft.endTime || null,
          p_city: opportunityDraft.city,
          p_state: opportunityDraft.state,
          p_cep: opportunityDraft.cep,
          p_value_cents: opportunityDraft.value
            ? Math.round(Number(opportunityDraft.value.replace(",", ".")) * 100)
            : null,
          p_description: opportunityDraft.description,
          p_requirements: opportunityDraft.requirements,
        };

    if (!draft) return;

    const { data, error } = await supabase.rpc("publish_losi_ad", payload);

    if (error || !data) {
      setMessage(error?.message ?? "Não foi possível publicar o anúncio.");
      return;
    }

    setCreditBalance((value) => Math.max(0, value - 1));
    setMessage("Anúncio publicado com sucesso. 1 crédito ADS foi utilizado.");
    if (type === "event") setEventDraft(emptyEvent);
    else setOpportunityDraft(emptyOpportunity);
    const { data: refreshedAds } = await supabase
      .from("losi_ads")
      .select("id,ad_type,status,title,category,event_date,start_time,end_time,city,state,quantity,value_cents,published_at,expires_at")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .order("created_at", { ascending: false });
    setMyAds((refreshedAds ?? []) as MyAd[]);
  }

  if (loading) return <main className="dashboard-loading">Carregando LOSI ADS...</main>;

  return (
    <main className="dashboard-page losi-ads-dashboard">
      {mobileMenuOpen && <button type="button" className="dashboard-mobile-menu-overlay" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={"dashboard-sidebar" + (mobileMenuOpen ? " mobile-open" : "")}>
        <div className="dashboard-sidebar-brand"><span>LOSI</span><strong>CONECTA</strong></div>
        <div className="dashboard-sidebar-caption">PAINEL PROFISSIONAL</div>
        <nav className="dashboard-sidebar-nav" aria-label="Menu do painel">
          <a className="dashboard-nav-item" href="/painel"><span className="dashboard-nav-mark">01</span><span><strong>Visão Geral</strong><small>Resumo da conta</small></span></a>
          <a className="dashboard-nav-item" href="/buscar"><span className="dashboard-nav-mark">02</span><span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span></a>
          <a className="dashboard-nav-item" href="/meu-perfil"><span className="dashboard-nav-mark">03</span><span><strong>Meu perfil</strong><small>Dados pessoais</small></span></a>
          <a className="dashboard-nav-item" href="/meus-servicos"><span className="dashboard-nav-mark">04</span><span><strong>Minha empresa</strong><small>Serviços e presença</small></span></a>
          <a className="dashboard-nav-item" href="/notificar-inconsistencia"><span className="dashboard-nav-mark">05</span><span><strong>Notificar inconsistência</strong><small>Falar com o administrador</small></span></a>
          <div className="dashboard-nav-divider"><span>Operacional</span></div>
          <a className="dashboard-nav-item" href="/orcamentos"><span className="dashboard-nav-mark">06</span><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span></a>
          <a className="dashboard-nav-item" href="/recibos"><span className="dashboard-nav-mark">07</span><span><strong>Recibos</strong><small>Comprovantes de serviço</small></span></a>
          <a className="dashboard-nav-item" href="/propostas"><span className="dashboard-nav-mark">08</span><span><strong>Propostas</strong><small>Apresentações comerciais</small></span></a>
          <a className="dashboard-nav-item active" href="/losi-ads"><span className="dashboard-nav-mark">09</span><span><strong>LOSI ADS</strong><small>Eventos e oportunidades</small></span></a>
                  <a className="dashboard-nav-item" href="/equipe-escalas"><span className="dashboard-nav-mark">10</span><span><strong>Equipe & Escalas</strong><small>Rede e calendário</small></span></a>
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
                <strong>{creditBalance}</strong>
                <button type="button" onClick={() => setCreditsOpen(true)}>Comprar créditos</button>
                 <button type="button" className="losi-ads-invoices-button" onClick={() => { void loadPendingInvoices(); setPendingInvoicesOpen(true); }}>{pendingInvoices.length ? "Faturas pendentes (" + pendingInvoices.length + ")" : "Ver faturas pendentes"}</button>
              </div>
            </header>

            {pendingInvoicesOpen && (
              <div className="losi-ads-modal-backdrop" role="presentation" onMouseDown={() => setPendingInvoicesOpen(false)}>
                <section className="losi-ads-credit-modal losi-ads-invoices-modal" role="dialog" aria-modal="true" aria-labelledby="losi-ads-invoices-title" onMouseDown={event => event.stopPropagation()}>
                  <div className="losi-ads-modal-topline">
                    <div>
                      <div className="losi-ads-section-label">COBRANÇAS</div>
                      <h2 id="losi-ads-invoices-title">Faturas pendentes</h2>
                      <p>Consulte, pague ou cancele suas faturas de créditos ADS pelo Asaas.</p>
                    </div>
                    <button type="button" className="losi-ads-modal-close" aria-label="Fechar faturas pendentes" onClick={() => setPendingInvoicesOpen(false)}>×</button>
                  </div>

                  {pendingInvoicesMessage && <p className="losi-ads-invoices-message" role="status">{pendingInvoicesMessage}</p>}
                  <div className="losi-ads-pending-invoices-list">
                    {pendingInvoicesLoading ? (
                      <p className="losi-ads-invoices-empty">Carregando faturas...</p>
                    ) : pendingInvoices.length ? (
                      pendingInvoices.map(invoice => (
                        <article className="losi-ads-pending-invoice" key={invoice.id}>
                          <div>
                            <span>{invoice.type === "ads" ? "CRÉDITOS ADS" : invoice.type === "subscription" ? "ASSINATURA" : "COBRANÇA"}</span>
                            <strong>{invoice.title || invoice.description || "Fatura pendente"}</strong>
                            <small>
                              {typeof invoice.value === "number" ? "R$ " + invoice.value.toFixed(2).replace(".", ",") : ""}
                              {invoice.dueDate ? " · Vencimento " + new Date(invoice.dueDate + "T12:00:00").toLocaleDateString("pt-BR") : ""}
                            </small>
                          </div>
                          <div className="losi-ads-pending-invoice-actions">
                            <button type="button" onClick={() => openPendingInvoice(invoice)} disabled={!invoice.invoiceUrl && !invoice.bankSlipUrl}>
                              ABRIR FATURA
                            </button>
                            {invoice.type === "ads" && (
                              <button type="button" className="losi-ads-cancel-invoice" onClick={() => void cancelAdsInvoice(invoice)} disabled={cancellingInvoiceId !== null}>
                                {cancellingInvoiceId === invoice.id ? "CANCELANDO..." : "CANCELAR FATURA"}
                              </button>
                            )}
                          </div>
                        </article>
                      ))
                    ) : pendingInvoicesMessage ? (
                      <button type="button" className="losi-ads-invoices-button" onClick={() => void loadPendingInvoices()}>Atualizar faturas</button>
                    ) : (
                      <p className="losi-ads-invoices-empty">Você não possui faturas pendentes no momento.</p>
                    )}
                  </div>
                </section>
              </div>
            )}

            {creditsOpen && (
              <div className="losi-ads-modal-backdrop" role="presentation" onMouseDown={() => setCreditsOpen(false)}>
                <section className="losi-ads-credit-modal" role="dialog" aria-modal="true" aria-labelledby="losi-ads-credit-title" onMouseDown={event => event.stopPropagation()}>
                  <div className="losi-ads-modal-topline">
                    <div>
                      <div className="losi-ads-section-label">CRÉDITOS LOSI ADS</div>
                      <h2 id="losi-ads-credit-title">Escolha seu pacote</h2>
                      <p>Use créditos para publicar eventos e oportunidades dentro do LOSI CONECTA.</p>
                    </div>
                    <button type="button" className="losi-ads-modal-close" aria-label="Fechar compra de créditos" onClick={() => setCreditsOpen(false)}>×</button>
                  </div>

                  <div className="losi-ads-package-grid">
                    {creditPackages.map(pkg => {
                      const unit = pkg.price_cents / pkg.credits / 100;
                      return (
                        <button
                          type="button"
                          key={pkg.credits}
                          className={"losi-ads-package-card" + (selectedPackage === pkg.credits ? " selected" : "")}
                          onClick={() => setSelectedPackage(pkg.credits)}
                          aria-pressed={selectedPackage === pkg.credits}
                        >
                          <span>{pkg.credits === 1 ? "1 CRÉDITO" : pkg.credits + " CRÉDITOS"}</span>
                          <strong>R$ {(pkg.price_cents / 100).toFixed(2).replace(".", ",")}</strong>
                          <small>R$ {unit.toFixed(2).replace(".", ",")} por crédito</small>
                          {pkg.featured && <em>MAIS ESCOLHIDO</em>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="losi-ads-purchase-footer">
                    <div className="losi-ads-purchase-copy">
                      <label className="losi-ads-purchase-document">
                        <span>Documento (CPF/CNPJ)</span>
                        <input
                          value={purchaseDocument}
                          onChange={event => setPurchaseDocument(event.target.value)}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="Digite seu CPF ou CNPJ"
                        />
                        <small>Necessário somente na primeira compra, caso seu cadastro ainda não exista no Asaas.</small>
                      </label>
                      <span>Você será direcionado para a cobrança do pacote escolhido. Os créditos só entram após a confirmação do pagamento.</span>
                      {purchaseMessage && <small role="status">{purchaseMessage}</small>}
                      {purchaseUrl && <a href={purchaseUrl} target="_blank" rel="noreferrer" className="losi-ads-payment-link">ABRIR PAGAMENTO</a>}
                    </div>
                    <button type="button" className="losi-ads-purchase-button" onClick={() => void startCreditPurchase()} disabled={purchaseLoading}>
                      {purchaseLoading ? "CRIANDO COBRANÇA..." : "CONTINUAR"}
                    </button>
                  </div>
                </section>
              </div>
            )}

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
              <div className="losi-ads-my-ads-header">
                <div>
                  <div className="losi-ads-section-label">03 · MINHAS PUBLICAÇÕES</div>
                  <h2>Meus anúncios</h2>
                  <p>Acompanhe o status das publicações e veja quem demonstrou interesse nas oportunidades.</p>
                </div>
                <span className="losi-ads-my-ads-count">{myAds.length} {myAds.length === 1 ? "ANÚNCIO" : "ANÚNCIOS"}</span>
              </div>

              {adsLoading ? (
                <div className="losi-ads-empty">Carregando seus anúncios...</div>
              ) : myAds.length === 0 ? (
                <div className="losi-ads-empty"><strong>Você ainda não publicou nenhum anúncio.</strong><span>Escolha EVENTO ou OPORTUNIDADE acima para começar.</span></div>
              ) : (
                <div className="losi-ads-own-grid">
                  {myAds.map(ad => (
                    <article className="losi-ads-own-card" key={ad.id}>
                      <div className="losi-ads-own-card-top">
                        <span className={"losi-ads-own-type " + ad.ad_type}>{ad.ad_type === "event" ? "EVENTO" : "OPORTUNIDADE"}</span>
                        <span className={"losi-ads-own-status " + ad.status}>{ad.status === "published" ? "PUBLICADO" : ad.status.toUpperCase()}</span>
                      </div>
                      <h3>{ad.title}</h3>
                      <div className="losi-ads-own-meta">
                        {ad.city && <span>{ad.city}{ad.state ? " · " + ad.state : ""}</span>}
                        {ad.event_date && <span>{new Date(ad.event_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                        {ad.ad_type === "opportunity" && ad.quantity && <span>{ad.quantity} vaga{ad.quantity === 1 ? "" : "s"}</span>}
                        {ad.ad_type === "opportunity" && ad.value_cents && <span>R$ {(ad.value_cents / 100).toFixed(2).replace(".", ",")}</span>}
                      </div>
                      <div className="losi-ads-own-footer">
                        {ad.ad_type === "opportunity" ? (
                          <button type="button" onClick={() => void openApplications(ad)}>VER CANDIDATURAS</button>
                        ) : (
                          <span>Publicação ativa no LOSI CONECTA</span>
                        )}
                        <span>{ad.published_at ? "Publicado em " + new Date(ad.published_at).toLocaleDateString("pt-BR") : "Ainda não publicado"}</span>
                        <button type="button" className="losi-ads-remove-button" onClick={() => void removeMyAd(ad)}>REMOVER ANÚNCIO</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section id="minhas-candidaturas" className="losi-ads-my-applications">
              <div className="losi-ads-my-applications-header">
                <div>
                  <div className="losi-ads-section-label">04 · MINHAS CANDIDATURAS</div>
                  <h2>Minhas candidaturas</h2>
                  <p>Acompanhe as oportunidades em que você demonstrou interesse e veja quando o anunciante responder.</p>
                </div>
                <span className="losi-ads-my-ads-count">{myApplications.length} {myApplications.length === 1 ? "CANDIDATURA" : "CANDIDATURAS"}</span>
              </div>

              {myApplicationsLoading ? (
                <div className="losi-ads-empty">Carregando suas candidaturas...</div>
              ) : myApplications.length === 0 ? (
                <div className="losi-ads-empty">
                  <strong>Você ainda não se candidatou a nenhuma oportunidade.</strong>
                  <span>Quando demonstrar interesse em uma oportunidade, ela aparecerá aqui.</span>
                  <button type="button" onClick={() => navigate({ to: "/buscar" })}>VER OPORTUNIDADES</button>
                </div>
              ) : (
                <div className="losi-ads-my-applications-list">
                  {myApplications.map(application => (
                    <article className="losi-ads-my-application-card" key={application.id}>
                      <div className="losi-ads-my-application-top">
                        <span className={"losi-ads-own-type " + (application.ad?.ad_type ?? "opportunity")}>
                          {application.ad?.ad_type === "event" ? "EVENTO" : "OPORTUNIDADE"}
                        </span>
                        <span className={"losi-ads-my-application-status " + application.status}>
                          {application.status === "pending" ? "PENDENTE" :
                           application.status === "accepted" ? "ACEITA" :
                           application.status === "rejected" ? "RECUSADA" : "CANCELADA"}
                        </span>
                      </div>

                      <h3>{application.ad?.title ?? "Oportunidade indisponível"}</h3>

                      {application.ad && (
                        <div className="losi-ads-my-application-meta">
                          {application.ad.city && <span>{application.ad.city}{application.ad.state ? " · " + application.ad.state : ""}</span>}
                          {application.ad.event_date && <span>{new Date(application.ad.event_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                          {application.ad.start_time && application.ad.end_time && <span>{application.ad.start_time.slice(0, 5)} às {application.ad.end_time.slice(0, 5)}</span>}
                        </div>
                      )}

                      {application.message && (
                        <p className="losi-ads-my-application-message">Sua mensagem: “{application.message}”</p>
                      )}

                      <div className="losi-ads-my-application-footer">
                        <span>Enviada em {new Date(application.created_at).toLocaleDateString("pt-BR")}</span>
                        {application.status === "accepted" && application.ad?.contact ? (
                          <a
                            href={application.ad.contact.startsWith("http") ? application.ad.contact : "https://wa.me/" + application.ad.contact.replace(/\D/g, "")}
                            target="_blank"
                            rel="noreferrer"
                          >
                            CONTATO DO ANUNCIANTE
                          </a>
                        ) : application.status === "pending" ? (
                          <span className="losi-ads-my-application-waiting">Aguardando resposta</span>
                        ) : application.status === "rejected" ? (
                          <span className="losi-ads-my-application-waiting">O anunciante recusou esta candidatura</span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {selectedMyAd && (
              <div className="losi-ads-applications-backdrop" role="presentation" onMouseDown={() => setSelectedMyAd(null)}>
                <section className="losi-ads-applications-modal" role="dialog" aria-modal="true" aria-labelledby="losi-ads-applications-title" onMouseDown={event => event.stopPropagation()}>
                  <div className="losi-ads-modal-topline">
                    <div>
                      <div className="losi-ads-section-label">CANDIDATURAS</div>
                      <h2 id="losi-ads-applications-title">{selectedMyAd.title}</h2>
                      <p>Profissionais que demonstraram interesse nesta oportunidade.</p>
                    </div>
                    <button type="button" className="losi-ads-modal-close" aria-label="Fechar candidaturas" onClick={() => setSelectedMyAd(null)}>×</button>
                  </div>
                  {applicationsLoading ? (
                    <div className="losi-ads-empty">Carregando candidaturas...</div>
                  ) : applications.length === 0 ? (
                    <div className="losi-ads-empty"><strong>Nenhuma candidatura ainda.</strong><span>Quando um profissional demonstrar interesse, ela aparecerá aqui.</span></div>
                  ) : (
                    <div className="losi-ads-applications-list">
                      {applications.map(application => (
                        <article className="losi-ads-application-card" key={application.id}>
                          <div className="losi-ads-application-avatar">
                            {application.profile?.avatar_url ? <img src={application.profile.avatar_url} alt="" /> : <span>{(application.profile?.full_name ?? "P").slice(0, 1).toUpperCase()}</span>}
                          </div>
                          <div className="losi-ads-application-main">
                            <strong>{application.profile?.full_name ?? "Profissional"}</strong>
                            <span>{[application.profile?.city, application.profile?.state].filter(Boolean).join(" · ") || "Localização não informada"}</span>
                            {application.message && <p>“{application.message}”</p>}
                            <small>{new Date(application.created_at).toLocaleDateString("pt-BR")}</small>
                          </div>
                          <div className="losi-ads-application-actions">
                            <span className={"losi-ads-application-status " + application.status}>{application.status === "pending" ? "PENDENTE" : application.status.toUpperCase()}</span>
                            {application.profile?.phone && <a href={"https://wa.me/" + application.profile.phone.replace(/\D/g, "")} target="_blank" rel="noreferrer">WHATSAPP</a>}
                            {application.status === "pending" && (
                              <>
                                <button type="button" className="losi-ads-application-accept" onClick={() => void updateApplicationStatus(application.id, "accepted")}>ACEITAR</button>
                                <button type="button" className="losi-ads-application-reject" onClick={() => void updateApplicationStatus(application.id, "rejected")}>RECUSAR</button>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
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
