import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function FinanceLineChart({ data, valueLabel }: { data: Array<{ label: string; value: number }>; valueLabel: string }) {
  const width = 720;
  const height = 250;
  const padding = { top: 20, right: 18, bottom: 38, left: 58 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...data.map(item => item.value));
  const points = data.map((item, index) => {
    const x = data.length === 1 ? padding.left + chartWidth / 2 : padding.left + (index / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight;
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const areaPath = points.length ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + chartHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + chartHeight).toFixed(1)} Z` : "";
  const money = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return (
    <div className="admin-finance-line-chart">
      {data.length === 0 ? <div className="admin-empty">Ainda não há faturamento suficiente para gerar o gráfico.</div> : (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={valueLabel}>
          {[0, 1, 2, 3, 4].map(step => {
            const y = padding.top + (step / 4) * chartHeight;
            const value = maxValue * (1 - step / 4);
            return <g key={step}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="admin-finance-grid-line" /><text x={padding.left - 8} y={y + 4} textAnchor="end" className="admin-finance-axis-label">{money(value)}</text></g>;
          })}
          {areaPath && <path d={areaPath} className="admin-finance-area" />}
          {linePath && <path d={linePath} className="admin-finance-line" />}
          {points.map((point, index) => <g key={`${point.label}-${index}`}>
            <title>{`${point.label}: ${money(point.value)}`}</title>
            <circle cx={point.x} cy={point.y} r="4.5" className="admin-finance-line-point" />
            <text x={point.x} y={height - 12} textAnchor="middle" className="admin-finance-axis-label admin-finance-x-label">{point.label}</text>
          </g>)}
        </svg>
      )}
    </div>
  );
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    send_broadcast: "Envio de comunicação",
    create_coupon: "Criação de cupom",
    send_coupon: "Envio de cupom",
    delete_coupon: "Exclusão de cupom",
    cancel_subscription: "Encerramento de plano",
    update_plan: "Alteração de plano",
    update_business: "Alteração de fornecedor",
    delete_user: "Exclusão de usuário",
    block_user: "Bloqueio de usuário",
    admin_block_user: "Bloqueio administrativo",
    admin_unblock_user: "Desbloqueio administrativo",
    unblock_user: "Desbloqueio de usuário",
    resolve_supplier_report: "Denúncia resolvida",
    dismiss_supplier_report: "Denúncia arquivada",
  };
  return labels[action] || action.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function auditEntityLabel(entityType: string) {
  const labels: Record<string, string> = {
    communication: "Comunicação",
    subscription: "Plano",
    plan: "Plano",
    business: "Fornecedor",
    user: "Usuário",
    supplier_report: "Denúncia",
  };
  return labels[entityType] || entityType.replaceAll("_", " ");
}

function auditDetailLabel(key: string, value: unknown) {
  const labels: Record<string, string> = {
    target_type: "Público",
    target_value: "Destino específico",
    recipient_count: "Destinatários",
    plan: "Plano",
    status: "Resultado",
    resolution_action: "Medida aplicada",
    resolution_note: "Observação",
    business_id: "Fornecedor",
    reporter_id: "Denunciante",
    reason: "Motivo",
  };
  const targetLabels: Record<string, string> = {
    all_suppliers: "Todos os fornecedores ativos",
    all_users: "Todos os usuários",
    plan: "Usuários de um plano",
    user: "Usuário específico",
  };
  if (key === "target_type" && typeof value === "string") return targetLabels[value] || value;
  if (key === "status" && typeof value === "string") return value === "resolved" ? "Resolvida" : value === "dismissed" ? "Arquivada" : value === "open" ? "Em análise" : value;
  if (key === "resolution_action" && typeof value === "string") return ({none:"Nenhuma medida",keep_active:"Fornecedor mantido ativo",suspend_supplier:"Fornecedor suspenso",block_supplier:"Responsável pela conta bloqueado"} as Record<string,string>)[value] || value;
  if (key === "reason" && typeof value === "string") return ({inappropriate:"Conteúdo ou comportamento inadequado",fraud:"Suspeita de fraude",spam:"Spam ou abordagem indevida",other:"Outro motivo"} as Record<string,string>)[value] || value;
  if (key === "entity_status" && typeof value === "string") return ({active:"Ativo",blocked:"Bloqueado",inactive:"Inativo",approved:"Aprovado",pending:"Pendente",rejected:"Rejeitado"} as Record<string,string>)[value] || value;
  if (value === null || value === undefined || value === "") return "Não informado";
  return String(value);
}

function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, businesses: 0, categories: 0, services: 0, reviews: 0 });
  const [users, setUsers] = useState<Array<{ id: string; full_name: string | null; user_type: string; city: string | null; state: string | null; blocked: boolean; phone: string | null; created_at: string }>>([]);
  const [businesses, setBusinesses] = useState<Array<{ id: string; business_name: string; description: string | null; phone: string | null; whatsapp: string | null; website: string | null; instagram: string | null; address: string | null; logo_url: string | null; cover_url: string | null; portfolio_urls: string[]; city: string | null; state: string | null; owner_id: string; verified: boolean; active: boolean; approval_status: "pending" | "approved" | "rejected"; created_at: string }>>([]);
  const [section, setSection] = useState<"dashboard" | "overview" | "security" | "users" | "businesses" | "subscriptions" | "alerts" | "categories" | "services" | "reviews" | "commercial" | "coupons" | "notifications" | "communication" | "activity">("dashboard");
  const [dashboardView, setDashboardView] = useState<"day" | "month" | "year">("month");
  const [dashboardDate, setDashboardDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState<Array<{id:string;name:string;slug:string;description:string|null;price_cents:number;billing_period:string;highlighted:boolean;active:boolean}>>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planSavingId, setPlanSavingId] = useState<string | null>(null);
  const [activatingBusinessId, setActivatingBusinessId] = useState<string | null>(null);
  const [activationPlanByBusiness, setActivationPlanByBusiness] = useState<Record<string, string>>({});
  const [subscriptions, setSubscriptions] = useState<Array<{id:string;business_id:string;plan_id:string;status:string;starts_at:string;created_at:string;ends_at:string|null;activated_by:string|null;asaas_payment_id:string|null;paid_amount:number|null;paid_at:string|null;business:{business_name:string}|null;plan:{name:string;price_cents:number;slug:string}|null}>>([]);
  const [coupons, setCoupons] = useState<Array<{id:string;code:string;assigned_user_id:string;plan_id:string|null;discount_type:"percent"|"fixed";discount_value:number;active:boolean;expires_at:string|null;claimed_at:string|null;used_at:string|null}>>([]);
  const [couponSearch, setCouponSearch] = useState("");
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponSaving, setCouponSaving] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [dataError, setDataError] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");
  const [businessStatusFilter, setBusinessStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState("");
  const [createUserSuccess, setCreateUserSuccess] = useState("");
  const [categories, setCategories] = useState<Array<{ id:string; name:string; slug:string; active:boolean }>>([]);
  const [services, setServices] = useState<Array<{ id:string; name:string; description:string|null; active:boolean; business:{business_name:string}|null; category:{name:string}|null }>>([]);
  const [reviews, setReviews] = useState<Array<{ id:string; rating:number; comment:string|null; active:boolean; created_at:string; business:{business_name:string}|null; reviewer:{full_name:string|null}|null }>>([]);
  const [supplierReports, setSupplierReports] = useState<Array<{ id:string; business_id:string; reporter_id:string; reason:string; details:string|null; status:"open"|"resolved"|"dismissed"; resolved_by:string|null; resolved_at:string|null; resolution_note:string|null; resolution_action:"none"|"keep_active"|"suspend_supplier"|"block_supplier"; created_at:string; business:{business_name:string; owner_id:string}|null; reporter:{full_name:string|null}|null }>>([]);
  const [selectedReportId, setSelectedReportId] = useState<string|null>(null);
  const [reportResolutionNote, setReportResolutionNote] = useState("");
  const [reportResolutionStatus, setReportResolutionStatus] = useState<"resolved"|"dismissed">("resolved");
  const [reportResolutionAction, setReportResolutionAction] = useState<"none"|"keep_active"|"suspend_supplier"|"block_supplier">("none");
  const [reportSaving, setReportSaving] = useState(false);
  const [securitySearch, setSecuritySearch] = useState("");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<"all" | "active" | "pending" | "cancelled">("all");
  const [adminAlertFilter, setAdminAlertFilter] = useState<"all" | "urgent" | "finance" | "moderation">("all");
  const [adminNotifications, setAdminNotifications] = useState<Array<{id:string;type:string;title:string;message:string;link:string|null;entity_id:string|null;read_at:string|null;created_at:string}>>([]);
  const [broadcasts, setBroadcasts] = useState<Array<{id:string;title:string;message:string;target_type:string;target_value:string|null;recipient_count:number;created_at:string}>>([]);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState<"all_suppliers"|"all_users"|"plan"|"user">("all_suppliers");
  const [broadcastTargetValue, setBroadcastTargetValue] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastMessageStatus, setBroadcastMessageStatus] = useState("");
  const [notificationSounds, setNotificationSounds] = useState<Array<{id:string;name:string;file_path:string;public_url:string;active:boolean;created_at:string}>>([]);
  const [notificationSoundFile, setNotificationSoundFile] = useState<File | null>(null);
  const [notificationSoundName, setNotificationSoundName] = useState("");
  const [notificationSoundMessage, setNotificationSoundMessage] = useState("");
  const [notificationSoundSaving, setNotificationSoundSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<{id:string;action:string;entity_type:string;entity_name:string|null;details:Record<string, unknown>;created_at:string;admin_name:string|null}>>([]);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityActionFilter, setActivityActionFilter] = useState("all");
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { navigate({ to: "/entrar" }); return; }
      const currentUser = sessionData.session.user;
      const { data, error } = await supabase.from("profiles").select("full_name,avatar_url,user_type,blocked").eq("id", currentUser.id).maybeSingle();
      if (!mounted) return;
      if (error || !data) { await supabase.auth.signOut(); navigate({ to: "/entrar" }); return; }
      if (data.blocked) { await supabase.auth.signOut(); navigate({ to: "/entrar" }); return; }
      if (data.user_type !== "admin") { navigate({ to: "/painel" }); return; }
      setUser(currentUser);
      setName(data.full_name || currentUser.email?.split("@")[0] || "administrador");
      setAvatarUrl(data.avatar_url ?? null);
      const [usersResult,businessesResult,categoriesResult,servicesResult,reviewsResult,plansResult,subscriptionsResult,couponsResult,reportsResult,notificationsResult,auditResult,broadcastsResult] = await Promise.all([
        supabase.from("profiles").select("id,full_name,user_type,city,state,blocked,phone,created_at").order("created_at",{ascending:false}),
        supabase.from("business_profiles").select("id,business_name,description,phone,whatsapp,website,instagram,address,logo_url,cover_url,portfolio_urls,city,state,owner_id,verified,active,approval_status,created_at").order("created_at",{ascending:false}),
        supabase.from("categories").select("id,name,slug,active").order("name"),
        supabase.from("services").select("id,name,description,active,business:business_profiles(business_name),category:categories(name)").order("created_at",{ascending:false}),
        supabase.from("reviews").select("id,rating,comment,active,created_at,business:business_profiles(business_name),reviewer:profiles(full_name)").order("created_at",{ascending:false}),
        supabase.from("plans").select("id,name,slug,description,price_cents,billing_period,highlighted,active").order("price_cents"),
        supabase.from("business_subscriptions").select("id,business_id,plan_id,status,starts_at,created_at,ends_at,activated_by,asaas_payment_id,paid_amount,paid_at").order("created_at",{ascending:false}),
        supabase.from("coupons").select("id,code,assigned_user_id,plan_id,discount_type,discount_value,active,expires_at,claimed_at,used_at").order("created_at",{ascending:false}),
        supabase.from("supplier_reports").select("id,business_id,reporter_id,reason,details,status,resolved_by,resolved_at,resolution_note,resolution_action,created_at,business:business_profiles(business_name,owner_id),reporter:profiles!supplier_reports_reporter_id_fkey(full_name)").order("created_at",{ascending:false}),
        supabase.from("admin_notifications").select("id,type,title,message,link,entity_id,read_at,created_at").order("created_at",{ascending:false}).limit(100),
        supabase.from("admin_audit_logs_safe").select("id,action,entity_type,entity_name,details,created_at,admin_name").order("created_at",{ascending:false}).limit(200),
        supabase.from("admin_broadcasts").select("id,title,message,target_type,target_value,recipient_count,created_at").order("created_at",{ascending:false}).limit(100),
      ]);
      if (!mounted) return;
      const firstError = [usersResult, businessesResult, categoriesResult, servicesResult, reviewsResult, plansResult, subscriptionsResult, couponsResult, reportsResult, notificationsResult, auditResult, broadcastsResult].find((result) => result.error)?.error;
      if (firstError) setDataError(firstError.message);
      setUsers((usersResult.data ?? []) as typeof users);
      setBusinesses((businessesResult.data ?? []) as typeof businesses);
      setCategories((categoriesResult.data ?? []) as typeof categories);
      setServices((servicesResult.data ?? []) as unknown as typeof services);
      setReviews((reviewsResult.data ?? []) as unknown as typeof reviews);
      setPlans((plansResult.data ?? []) as typeof plans);
      const subscriptionRows = (subscriptionsResult.data ?? []) as Array<{
        id:string;business_id:string;plan_id:string;status:string;starts_at:string;created_at:string;ends_at:string|null;activated_by:string|null;asaas_payment_id:string|null;paid_amount:number|null;paid_at:string|null;
      }>;
      setSubscriptions(subscriptionRows.map(item => ({
        ...item,
        business: businessesResult.data?.find((business) => business.id === item.business_id)
          ? { business_name: (businessesResult.data.find((business) => business.id === item.business_id) as { business_name: string }).business_name }
          : null,
        plan: plansResult.data?.find((plan) => plan.id === item.plan_id)
          ? (() => {
              const plan = plansResult.data.find((candidate) => candidate.id === item.plan_id) as { name:string; price_cents:number; slug:string };
              return { name: plan.name, price_cents: plan.price_cents, slug: plan.slug };
            })()
          : null,
      })) as typeof subscriptions);
      setCoupons((couponsResult.data ?? []) as typeof coupons);
      setSupplierReports((reportsResult.data ?? []) as unknown as typeof supplierReports);
      setAdminNotifications((notificationsResult.data ?? []) as typeof adminNotifications);
      setAuditLogs((auditResult.data ?? []) as unknown as typeof auditLogs);
      setBroadcasts((broadcastsResult.data ?? []) as typeof broadcasts);
      const { data: soundsData, error: soundsError } = await supabase.from("notification_sounds").select("id,name,file_path,public_url,active,created_at").order("created_at", { ascending: false });
      if (soundsError) setDataError(soundsError.message);
      setNotificationSounds((soundsData ?? []) as typeof notificationSounds);
      setStats({users:usersResult.data?.length??0,businesses:businessesResult.data?.length??0,categories:categoriesResult.data?.length??0,services:servicesResult.data?.length??0,reviews:reviewsResult.data?.length??0});
      setLoading(false);
    }
    load();

    // Recarrega os dados quando o administrador volta para a aba.
    // Isso faz novas assinaturas/pagamentos aparecerem sem precisar sair da página.
    const handleRefresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);

    const requestedSection = new URLSearchParams(window.location.search).get("section");
    if (requestedSection && ["dashboard","overview","security","users","businesses","subscriptions","alerts","categories","services","reviews","commercial","coupons","notifications","sounds","communication","activity"].includes(requestedSection)) {
      setSection(requestedSection as typeof section);
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) navigate({ to: "/entrar" }); });
    return () => {
      mounted = false;
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  async function recordAdminAction(action:string, entityType:string, entityId:string|null, entityName:string|null, details:Record<string, unknown> = {}) {
    if (!user) return;
    const { data } = await supabase.from("admin_audit_logs").insert({admin_user_id:user.id,action,entity_type:entityType,entity_id:entityId,entity_name:entityName,details}).select("id,admin_user_id,action,entity_type,entity_id,entity_name,details,created_at,admin:profiles(full_name)").single();
    if (data) setAuditLogs(current => [data as unknown as typeof auditLogs[number], ...current].slice(0,200));
  }

  async function markAdminNotificationRead(id:string) {
    if (!user) return;
    const stamp=new Date().toISOString();
    const { error } = await supabase.from("admin_notifications").update({read_at:stamp}).eq("id",id).eq("admin_user_id",user.id);
    if (!error) setAdminNotifications(current => current.map(item => item.id===id ? {...item,read_at:stamp}:item));
  }

  async function markAllAdminNotificationsRead() {
    if (!user) return;
    const stamp=new Date().toISOString();
    const { error } = await supabase.from("admin_notifications").update({read_at:stamp}).eq("admin_user_id",user.id).is("read_at",null);
    if (!error) setAdminNotifications(current => current.map(item => ({...item,read_at:item.read_at ?? stamp})));
  }

  async function uploadNotificationSound() {
    if (!user || !notificationSoundFile || notificationSoundSaving) return;
    const file = notificationSoundFile;
    if (!file.type.startsWith("audio/") || file.size > 5 * 1024 * 1024) {
      setNotificationSoundMessage(file.size > 5 * 1024 * 1024 ? "O arquivo deve ter no máximo 5 MB." : "Selecione um arquivo de áudio válido.");
      return;
    }
    setNotificationSoundSaving(true);
    setNotificationSoundMessage("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const filePath = "sounds/" + crypto.randomUUID() + "." + extension;
      // Alguns navegadores enviam WAV como audio/x-wav. O bucket aceita audio/wav,
      // então normalizamos o MIME antes do upload para evitar rejeição do Storage.
      const normalizedMimeType =
        file.type === "audio/x-wav" || file.type === "audio/vnd.wave"
          ? "audio/wav"
          : file.type === "audio/x-m4a"
            ? "audio/mp4"
            : file.type || "audio/mpeg";
      const { error: uploadError } = await supabase.storage
        .from("notification-sounds")
        .upload(filePath, file, { contentType: normalizedMimeType, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: publicData } = supabase.storage.from("notification-sounds").getPublicUrl(filePath);
      const name = notificationSoundName.trim() || file.name;
      const { data, error } = await supabase.from("notification_sounds").insert({ name, file_path: filePath, public_url: publicData.publicUrl }).select("id,name,file_path,public_url,active,created_at").single();
      if (error) { await supabase.storage.from("notification-sounds").remove([filePath]); throw new Error(error.message); }
      setNotificationSounds(current => [data as typeof notificationSounds[number], ...current]);
      setNotificationSoundFile(null);
      setNotificationSoundName("");
      setNotificationSoundMessage("Som enviado com sucesso. Agora você pode testá-lo ou defini-lo como som das notificações.");
    } catch (error) {
      setNotificationSoundMessage(error instanceof Error ? error.message : "Não foi possível enviar o som.");
    } finally {
      setNotificationSoundSaving(false);
    }
  }

  async function activateNotificationSound(soundId: string) {
    if (notificationSoundSaving) return;
    setNotificationSoundSaving(true);
    setNotificationSoundMessage("");
    try {
      const { error: clearError } = await supabase.from("notification_sounds").update({ active: false }).eq("active", true);
      if (clearError) throw new Error(clearError.message);
      const { error } = await supabase.from("notification_sounds").update({ active: true }).eq("id", soundId);
      if (error) throw new Error(error.message);
      setNotificationSounds(current => current.map(item => ({ ...item, active: item.id === soundId })));
      setNotificationSoundMessage("Som de notificação atualizado. As próximas notificações usarão este som.");
    } catch (error) {
      setNotificationSoundMessage(error instanceof Error ? error.message : "Não foi possível definir o som.");
    } finally {
      setNotificationSoundSaving(false);
    }
  }

  async function deleteNotificationSound(sound: typeof notificationSounds[number]) {
    if (notificationSoundSaving) return;
    if (sound.active) { setNotificationSoundMessage("Defina outro som como ativo antes de remover este."); return; }
    if (!window.confirm("Remover este som?")) return;
    setNotificationSoundSaving(true);
    setNotificationSoundMessage("");
    try {
      const { error: storageError } = await supabase.storage.from("notification-sounds").remove([sound.file_path]);
      if (storageError) throw new Error(storageError.message);
      const { error } = await supabase.from("notification_sounds").delete().eq("id", sound.id);
      if (error) throw new Error(error.message);
      setNotificationSounds(current => current.filter(item => item.id !== sound.id));
      setNotificationSoundMessage("Som removido.");
    } catch (error) {
      setNotificationSoundMessage(error instanceof Error ? error.message : "Não foi possível remover o som.");
    } finally {
      setNotificationSoundSaving(false);
    }
  }
  async function manageUser(userId: string, action: "block" | "unblock" | "delete") {
    const target = users.find((item) => item.id === userId);
    if (!target) return;

    const label = target.full_name || "este usuário";
    if (action === "delete" && !window.confirm(`Remover ${label}? Esta ação exclui a conta e não pode ser desfeita.`)) return;
    if (action === "block" && !window.confirm(`Bloquear ${label}? O usuário não poderá entrar no aplicativo enquanto estiver bloqueado.`)) return;

    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: { user_id: userId, action },
    });

    if (error || data?.error) {
      setDataError(data?.error || error?.message || "Não foi possível alterar o usuário.");
      return;
    }

    if (action === "delete") {
      setUsers((current) => current.filter((item) => item.id !== userId));
      setStats((current) => ({ ...current, users: Math.max(0, current.users - 1) }));
    } else {
      setUsers((current) => current.map((item) => item.id === userId ? { ...item, blocked: action === "block" } : item));
    }
    await recordAdminAction(action === "delete" ? "delete_user" : action === "block" ? "block_user" : "unblock_user", "user", userId, label);
    setDataError("");
  }

  async function resolveSupplierReport(reportId: string, status: "resolved" | "dismissed") {
    if (!user || reportSaving) return;
    const report = supplierReports.find(item => item.id === reportId);
    if (!report) return;
    if (status === "dismissed" && reportResolutionAction !== "none") {
      setDataError("Uma denúncia arquivada sem procedência não pode aplicar uma medida ao fornecedor.");
      return;
    }
    if (!window.confirm(status === "resolved" ? "Confirmar a resolução desta denúncia e a medida selecionada?" : "Confirmar que esta denúncia será arquivada sem procedência?")) return;
    setReportSaving(true);
    const resolvedAt = new Date().toISOString();
    if (status === "resolved" && reportResolutionAction === "suspend_supplier") {
      const { error } = await supabase.from("business_profiles").update({active:false}).eq("id", report.business_id);
      if (error) { setReportSaving(false); setDataError(error.message || "Não foi possível suspender o fornecedor."); return; }
      setBusinesses(current => current.map(item => item.id === report.business_id ? {...item, active:false} : item));
    }
    if (status === "resolved" && reportResolutionAction === "block_supplier") {
      const ownerId = report.business?.owner_id;
      if (!ownerId) { setReportSaving(false); setDataError("Não foi possível identificar o responsável pelo fornecedor."); return; }
      const { data, error } = await supabase.functions.invoke("admin-manage-user", { body:{user_id:ownerId, action:"block"} });
      if (error || data?.error) { setReportSaving(false); setDataError(data?.error || error?.message || "Não foi possível bloquear o responsável."); return; }
      setUsers(current => current.map(item => item.id === ownerId ? {...item, blocked:true} : item));
    }
    const { error } = await supabase.from("supplier_reports").update({
      status,
      resolved_by: user.id,
      resolved_at: resolvedAt,
      resolution_note: reportResolutionNote.trim() || null,
      resolution_action: reportResolutionAction,
    }).eq("id", reportId);
    setReportSaving(false);
    if (error) {
      setDataError(error.message || "Não foi possível atualizar a denúncia.");
      return;
    }
    setSupplierReports(current => current.map(item => item.id === reportId ? {...item, status, resolved_by:user.id, resolved_at:resolvedAt, resolution_note:reportResolutionNote.trim() || null} : item));
    await recordAdminAction(status === "resolved" ? "resolve_supplier_report" : "dismiss_supplier_report", "supplier_report", reportId, report.business?.business_name || "Denúncia", {status,business_id:report.business_id,reporter_id:report.reporter_id,reason:report.reason,resolution_action:reportResolutionAction,resolution_note:reportResolutionNote.trim() || null});
    setSelectedReportId(null);
    setReportResolutionNote("");
    setReportResolutionStatus("resolved");
    setReportResolutionAction("none");
    setDataError("");
  }

  async function updateBusiness(id: string, changes: { verified?: boolean; active?: boolean; approval_status?: "pending" | "approved" | "rejected" }) {
    const current = businesses.find(item => item.id === id);
    if (!current) return;
    const normalized = {...changes};
    if (normalized.approval_status === "pending" || normalized.approval_status === "rejected") {
      normalized.active = false;
      if (normalized.approval_status === "rejected") normalized.verified = false;
    }
    if (normalized.active === true && (normalized.approval_status ?? current.approval_status) !== "approved") {
      setDataError("Um fornecedor só pode ficar ativo depois de aprovado.");
      return;
    }
    if (normalized.verified === true && (normalized.approval_status ?? current.approval_status) !== "approved") {
      setDataError("A verificação só pode ser concedida a um fornecedor aprovado.");
      return;
    }
    const { error } = await supabase.from("business_profiles").update(normalized).eq("id", id);
    if (error) {
      setDataError(error.message || "Não foi possível atualizar a empresa.");
      return;
    }
    setBusinesses((current) => current.map((item) => item.id === id ? { ...item, ...normalized } : item));
    await recordAdminAction("update_business", "business", id, current.business_name, {changes:normalized});
    setDataError("");
  }

  async function updatePlan(id: string, changes: { name: string; slug: string; description: string; price_cents: number; billing_period: string; highlighted: boolean; active: boolean }) {
    setPlanSavingId(id);
    const { data, error } = await supabase.from("plans").update(changes).eq("id", id).select("id,name,slug,description,price_cents,billing_period,highlighted,active").maybeSingle();
    setPlanSavingId(null);
    if (error || !data) {
      setDataError(error?.message || "Não foi possível salvar o plano.");
      return;
    }
    setPlans((current) => current.map((item) => item.id === id ? data as typeof item : item));
    setEditingPlanId(null);
    await recordAdminAction("update_plan", "plan", id, data.name, {changes});
    setDataError("");
  }

  async function activateSubscription(businessId: string, planId: string) {
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;
    setActivatingBusinessId(businessId);
    const now = new Date();
    const endsAt = new Date(now);
    if (plan.billing_period === "quarterly") endsAt.setMonth(endsAt.getMonth() + 3);
    else if (plan.billing_period === "yearly") endsAt.setFullYear(endsAt.getFullYear() + 1);
    else if (plan.billing_period === "monthly") endsAt.setMonth(endsAt.getMonth() + 1);
    else endsAt.setFullYear(endsAt.getFullYear() + 100);

    const existing = subscriptions.find((item) => item.business_id === businessId && item.status === "active");
    if (existing) {
      const { data: cancelData, error: cancelError } = await supabase.functions.invoke("admin-manage-user", {
        body: { user_id: existing.business_id, action: "cancel_subscription", subscription_id: existing.id },
      });
      if (cancelError || cancelData?.error) {
        setActivatingBusinessId(null);
        setDataError(cancelData?.error || cancelError?.message || "Não foi possível encerrar o plano atual.");
        return;
      }
    }
    const payload = { plan_id: planId, status: "active", starts_at: now.toISOString(), ends_at: endsAt.toISOString(), activated_by: user?.id ?? null };
    const result = await supabase.from("business_subscriptions").insert({ business_id: businessId, ...payload }).select("id,business_id,plan_id,status,starts_at,created_at,ends_at,activated_by,asaas_payment_id,paid_amount,paid_at,business:business_profiles(business_name),plan:plans(name,price_cents,slug)").single();

    setActivatingBusinessId(null);
    if (result.error || !result.data) {
      setDataError(result.error?.message || "Não foi possível ativar a assinatura.");
      return;
    }
    const updated = result.data as unknown as typeof subscriptions[number];
    setSubscriptions((current) => existing ? [{...updated}, ...current.map((item) => item.id === existing.id ? {...item, status:"cancelled", ends_at:now.toISOString()} : item)] : [updated, ...current]);
    setActivationPlanByBusiness((current) => ({ ...current, [businessId]: "" }));
    await recordAdminAction("manual_activate_subscription", "subscription", updated.id, plan.name, {business_id:businessId,plan_id:planId,previous_subscription_id:existing?.id ?? null});
  }

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (couponSaving) return;
    setCouponSaving(true);
    setCouponMessage("");
    const form = new FormData(event.currentTarget);
    const id = String(form.get("id") || "").trim() || null;
    const code = String(form.get("code") || "").trim().toUpperCase();
    const assignedUserId = String(form.get("assigned_user_id") || "").trim();
    const planId = String(form.get("plan_id") || "").trim() || null;
    const discountType = String(form.get("discount_type") || "percent") as "percent" | "fixed";
    const rawDiscount = Number(String(form.get("discount_value") || "0").replace(",", "."));
    const discountValue = discountType === "fixed" ? Math.round(rawDiscount * 100) : Math.round(rawDiscount);
    const expiresRaw = String(form.get("expires_at") || "").trim();
    const expiresAt = expiresRaw ? new Date(expiresRaw + "T23:59:59").toISOString() : null;
    const active = form.get("active") === "on";

    if (!code || !assignedUserId || !Number.isFinite(rawDiscount) || rawDiscount <= 0 || (discountType === "percent" && rawDiscount > 100)) {
      setCouponMessage(discountType === "percent" ? "Informe um desconto percentual entre 0,01% e 100%." : "Informe um valor de desconto maior que zero.");
      setCouponSaving(false);
      return;
    }

    const payload = { code, assigned_user_id: assignedUserId, plan_id: planId, discount_type: discountType, discount_value: discountValue, active, expires_at: expiresAt };
    const result = id
      ? await supabase.from("coupons").update(payload).eq("id", id).select("id,code,assigned_user_id,plan_id,discount_type,discount_value,active,expires_at,claimed_at,used_at").single()
      : await supabase.from("coupons").insert(payload).select("id,code,assigned_user_id,plan_id,discount_type,discount_value,active,expires_at,claimed_at,used_at").single();

    if (result.error || !result.data) {
      setCouponMessage(result.error?.message || "Não foi possível salvar o cupom.");
      setCouponSaving(false);
      return;
    }

    const saved = result.data as typeof coupons[number];
    setCoupons(current => id ? current.map(item => item.id === id ? saved : item) : [saved, ...current]);
    setEditingCouponId(null);

    setCouponMessage(id ? "Cupom atualizado com sucesso. Use “Enviar cupom” para notificar o usuário novamente." : "Cupom criado com sucesso. Agora use “Enviar cupom” para avisar o usuário.");
    await recordAdminAction(id ? "update_coupon" : "create_coupon", "coupon", saved.id, saved.code, { assigned_user_id: saved.assigned_user_id, plan_id: saved.plan_id, discount_type: saved.discount_type, discount_value: saved.discount_value, active: saved.active });
    setCouponSaving(false);
  }

  async function sendCoupon(couponId: string) {
    if (couponSaving) return;
    const coupon = coupons.find(item => item.id === couponId);
    if (!coupon) return;
    if (!coupon.active || coupon.used_at) {
      setCouponMessage("Este cupom não pode ser enviado porque está desativado ou já foi utilizado.");
      return;
    }

    setCouponSaving(true);
    setCouponMessage("");
    const assignedUser = users.find(item => item.id === coupon.assigned_user_id);
    const plan = plans.find(item => item.id === coupon.plan_id);
    const discountLabel = coupon.discount_type === "percent"
      ? `${coupon.discount_value}% de desconto`
      : `R$ ${(coupon.discount_value / 100).toFixed(2).replace(".", ",")} de desconto`;

    const { error } = await supabase.from("notifications").insert({
      user_id: coupon.assigned_user_id,
      type: "coupon_available",
      title: "Você recebeu um cupom de desconto 🎁",
      message: `Olá${assignedUser?.full_name ? `, ${assignedUser.full_name.split(" ")[0]}` : ""}! O LOSI CONECTA liberou o cupom ${coupon.code} para você: ${discountLabel}${plan ? ` no plano ${plan.name}` : " em um plano pago"}. Acesse seu painel para conferir e utilizar o benefício.`,
      link: "/painel#planos",
    });

    if (error) {
      setCouponMessage(`Não foi possível enviar o cupom: ${error.message}`);
      setCouponSaving(false);
      return;
    }

    setCouponMessage(`Cupom ${coupon.code} enviado com sucesso para ${assignedUser?.full_name || "o usuário"}.`);
    await recordAdminAction("send_coupon", "coupon", coupon.id, coupon.code, {
      assigned_user_id: coupon.assigned_user_id,
      plan_id: coupon.plan_id,
    });
    setCouponSaving(false);
  }
  async function removeCoupon(id: string) {
    const coupon = coupons.find(item => item.id === id);
    if (!coupon) return;
    if (!window.confirm(`Remover o cupom "${coupon.code}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) {
      setCouponMessage(error.message || "Não foi possível remover o cupom.");
      return;
    }
    setCoupons(current => current.filter(item => item.id !== id));
    if (editingCouponId === id) setEditingCouponId(null);
    setCouponMessage("Cupom removido com sucesso.");
    await recordAdminAction("delete_coupon", "coupon", id, coupon.code);
  }

  function categorySlug(value: string) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameValue = newCategoryName.trim();
    if (!nameValue || categorySaving) return;
    setCategorySaving(true);
    setCategoryMessage("");
    const slug = categorySlug(nameValue);
    const { data: existing } = await supabase.from("categories").select("id").or(`name.ilike.${nameValue},slug.eq.${slug}`).limit(1).maybeSingle();
    if (existing) {
      setCategoryMessage("Essa categoria já está cadastrada.");
      setCategorySaving(false);
      return;
    }
    const { data, error } = await supabase.from("categories").insert({ name: nameValue, slug, active: true }).select("id,name,slug,active").single();
    if (error || !data) {
      setCategoryMessage(error?.message || "Não foi possível adicionar a categoria.");
      setCategorySaving(false);
      return;
    }
    setCategories((current) => [...current, data as typeof categories[number]].sort((a,b) => a.name.localeCompare(b.name, "pt-BR")));
    setStats((current) => ({ ...current, categories: current.categories + 1 }));
    setNewCategoryName("");
    setShowCreateCategory(false);
    await recordAdminAction("create_category", "category", data.id, data.name);
    setCategoryMessage("Categoria adicionada com sucesso.");
    setCategorySaving(false);
  }

  async function deleteCategory(id: string, name: string) {
    if (!window.confirm(`Remover a categoria "${name}"? Essa ação não pode ser desfeita.`)) return;
    setCategoryMessage("");
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      setCategoryMessage(error.code === "23503" ? "Não é possível remover esta categoria porque existem serviços vinculados a ela. Desative a categoria em vez de removê-la." : (error.message || "Não foi possível remover a categoria."));
      return;
    }
    setCategories((current) => current.filter((item) => item.id !== id));
    setStats((current) => ({ ...current, categories: Math.max(0, current.categories - 1) }));
    await recordAdminAction("delete_category", "category", id, name);
    setCategoryMessage("Categoria removida com sucesso.");
  }

  async function updateReview(id:string, changes:{active?:boolean}) {
    const { error } = await supabase.from("reviews").update(changes).eq("id",id);
    if (!error) { setReviews(current=>current.map(item=>item.id===id?{...item,...changes}:item)); await recordAdminAction("update_review","review",id,"Avaliação",{changes}); }
  }
  async function deleteReview(id:string) {
    const { error } = await supabase.from("reviews").delete().eq("id",id);
    if (!error) { setReviews(current=>current.filter(item=>item.id!==id)); await recordAdminAction("delete_review","review",id,"Avaliação"); }
  }
  async function createManualUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateUserError("");
    setCreateUserSuccess("");
    setCreatingUser(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: String(form.get("full_name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
      phone: String(form.get("phone") || "").trim(),
      city: String(form.get("city") || "").trim(),
      state: String(form.get("state") || "").trim(),
      user_type: String(form.get("user_type") || "professional"),
    };

    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: payload });

    setCreatingUser(false);

    if (error || data?.error) {
      let detailedMessage = data?.error || "";
      if (!detailedMessage && error) {
        try {
          const response = (error as unknown as { context?: Response }).context;
          if (response && typeof response.json === "function") {
            const body = await response.clone().json();
            detailedMessage = body?.error || body?.message || "";
          }
        } catch {
          // Mantém a mensagem padrão quando a resposta não puder ser lida.
        }
      }
      setCreateUserError(detailedMessage || error?.message || "Não foi possível cadastrar o usuário.");
      return;
    }

    setCreateUserSuccess("Usuário cadastrado com sucesso. O acesso já está liberado.");
    event.currentTarget.reset();
    const { data: refreshedUsers } = await supabase
      .from("profiles")
      .select("id,full_name,user_type,city,state,blocked,phone,created_at")
      .order("created_at", { ascending: false });
    if (refreshedUsers) {
      setUsers(refreshedUsers as typeof users);
      setStats((current) => ({ ...current, users: refreshedUsers.length }));
    }
    await recordAdminAction("create_user","user",null,payload.full_name,{email:payload.email,user_type:payload.user_type});
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    navigate({ to: "/entrar" });
  }

  if (loading) return <main className="admin-loading">Carregando administração...</main>;
  if (!user) return null;

  const unreadAdminNotifications = adminNotifications.filter(item => !item.read_at).length;
  const menu = [
    { id: "dashboard" as const, label: "Dashboard financeiro" },
    { id: "overview" as const, label: "Visão geral" },
    { id: "security" as const, label: "Central de segurança" },
    { id: "users" as const, label: "Usuários", count: stats.users },
    { id: "businesses" as const, label: "Empresas", count: stats.businesses },
    { id: "subscriptions" as const, label: "Assinaturas", count: subscriptions.filter(item => item.status === "pending").length },
    { id: "alerts" as const, label: "Central de alertas" },
    { id: "services" as const, label: "Serviços", count: stats.services },
    { id: "categories" as const, label: "Categorias", count: stats.categories },
    { id: "reviews" as const, label: "Avaliações", count: stats.reviews },
    { id: "commercial" as const, label: "Comercial" },
    { id: "coupons" as const, label: "Cupons", count: coupons.filter(item => item.active && !item.used_at).length },
    { id: "notifications" as const, label: "Notificações", count: unreadAdminNotifications },
    { id: "sounds" as const, label: "Sons de notificação", count: notificationSounds.length },
    { id: "communication" as const, label: "Central de comunicação" },
    { id: "activity" as const, label: "Auditoria" },
  ];
  const pendingBusinesses = businesses.filter((item) => item.approval_status === "pending");
  const approvedBusinesses = businesses.filter((item) => item.approval_status === "approved");
  const activeBusinesses = businesses.filter((item) => item.active);
  const visibleReviews = reviews.filter((item) => item.active);
  const averageRating = visibleReviews.length ? visibleReviews.reduce((sum, item) => sum + item.rating, 0) / visibleReviews.length : 0;
  const filteredBusinesses = businesses.filter((item) => {
    const query = businessSearch.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !query || [item.business_name, item.city ?? "", item.state ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(query);
    return matchesSearch && (businessStatusFilter === "all" || item.approval_status === businessStatusFilter);
  });
  const selectedBusiness = selectedBusinessId ? businesses.find((item) => item.id === selectedBusinessId) ?? null : null;
  const activeSubscriptions = subscriptions.filter(item => item.status === "active");
  const pendingSubscriptions = subscriptions.filter(item => item.status === "pending");
  const paidSubscriptions = subscriptions.filter(item => item.asaas_payment_id && item.paid_amount != null);
  const recentBusinessCount = businesses.filter(item => Date.now() - new Date(item.created_at).getTime() <= 30*24*60*60*1000).length;
  const sectionTitle = section === "dashboard" ? "Dashboard financeiro" : section === "overview" ? "Visão geral" : section === "security" ? "Central de segurança" : section === "users" ? "Usuários cadastrados" : section === "businesses" ? "Empresas cadastradas" : section === "subscriptions" ? "Assinaturas" : section === "alerts" ? "Central de alertas" : section === "services" ? "Serviços cadastrados" : section === "categories" ? "Categorias cadastradas" : section === "reviews" ? "Avaliações recebidas" : section === "commercial" ? "Comercial" : section === "coupons" ? "Cupons de desconto" : section === "notifications" ? "Notificações administrativas" : section === "sounds" ? "Sons de notificação" : section === "communication" ? "Central de comunicação" : "Auditoria administrativa";

  return (
    <main className="admin-page">
      <header className="admin-header">
        <button type="button" id="admin-mobile-menu" className="admin-mobile-menu-button" aria-label={mobileMenuOpen ? "Fechar menu administrativo" : "Abrir menu administrativo"} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(value => !value)}>
          <span></span><span></span><span></span>
        </button>
        <div className="admin-header-brand">
          <div className="mobile-centered-brand">LOSI <span>CONECTA</span></div>
          <div className="admin-mobile-subtitle">PAINEL ADMINISTRATIVO</div>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="admin-profile-link" onClick={() => navigate({ to: "/admin-perfil" })} aria-label="Abrir perfil do administrador">
            {avatarUrl ? <img src={avatarUrl} alt="" className="admin-header-avatar" /> : <span className="admin-header-avatar admin-header-avatar-fallback">{name.slice(0, 1).toUpperCase()}</span>}
            <span className="admin-header-user-name">{name}</span>
          </button>
          <button type="button" className="admin-logout" onClick={logout}>Sair</button>
        </div>
      </header>
      <div className="admin-shell">
        {mobileMenuOpen && <button type="button" className="admin-mobile-menu-overlay" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
        <aside className={`admin-sidebar${mobileMenuOpen ? " mobile-open" : ""}`}>
          <div className="admin-sidebar-title">GESTÃO</div>
          <nav className="admin-menu">
            {menu.map(item => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => { setSection(item.id); setMobileMenuOpen(false); window.history.replaceState(null, "", `/admin?section=${item.id}`); }}><span>{item.label}</span>{item.count !== undefined && <em>{item.count}</em>}</button>)}
          </nav>
          <div className="admin-sidebar-logout">
            <button type="button" onClick={logout}>Sair do painel</button>
          </div>
        </aside>
        <section className="admin-content">
          <div className="admin-badge">ADMINISTRADOR</div>
          <h1>{section === "overview" ? `Olá, ${name}.` : sectionTitle}</h1>
          <p className="admin-text">{section === "overview" ? "Centro de gestão do LOSI CONECTA." : "Gerencie e acompanhe as informações da plataforma."}</p>
          {dataError && <div className="admin-data-error">Não foi possível carregar alguns dados: {dataError}</div>}
          {section === "dashboard" ? (
            (() => {
              const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
              const localKey = (value: string | Date) => {
                const date = typeof value === "string" ? new Date(value) : value;
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              };
              const monthKey = (value: string | Date) => localKey(value).slice(0, 7);
              const yearKey = (value: string | Date) => String(new Date(value).getFullYear());
              const closedSubscriptions = subscriptions.filter(item => item.status === "active" || Boolean(item.asaas_payment_id) || Boolean(item.activated_by));
              const subscriptionValue = (item: typeof subscriptions[number]) => item.asaas_payment_id && item.paid_amount != null ? Math.round(Number(item.paid_amount) * 100) : (item.plan?.price_cents ?? 0);
              const today = new Date();
              const todayKey = localKey(today);
              const currentMonthKey = monthKey(today);
              const currentYearKey = yearKey(today);
              const weekStart = new Date(today);
              const dayOfWeek = weekStart.getDay();
              weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
              weekStart.setHours(0, 0, 0, 0);
              const paymentDate = (item: typeof subscriptions[number]) => item.paid_at || item.starts_at;
              const todayClosed = closedSubscriptions.filter(item => localKey(paymentDate(item)) === todayKey);
              const weekClosed = closedSubscriptions.filter(item => new Date(paymentDate(item)) >= weekStart && new Date(paymentDate(item)) <= today);
              const monthClosed = closedSubscriptions.filter(item => monthKey(paymentDate(item)) === currentMonthKey);
              const revenue = (items: typeof closedSubscriptions) => items.reduce((sum, item) => sum + subscriptionValue(item), 0);
              const selectedMatch = (item: typeof subscriptions[number]) => {
                if (dashboardView === "day") return localKey(paymentDate(item)) === dashboardDate;
                if (dashboardView === "year") return yearKey(paymentDate(item)) === dashboardDate.slice(0, 4);
                return monthKey(paymentDate(item)) === dashboardDate.slice(0, 7);
              };
              const selectedClosed = closedSubscriptions.filter(selectedMatch);
              const selectedRevenue = revenue(selectedClosed);
              const byPlan = Array.from(selectedClosed.reduce((map, item) => {
                const key = item.plan?.name || "Plano não identificado";
                const current = map.get(key) || { name: key, count: 0, revenue: 0 };
                current.count += 1;
                current.revenue += subscriptionValue(item);
                map.set(key, current);
                return map;
              }, new Map<string, {name:string;count:number;revenue:number}>()).values()).sort((a,b) => b.count - a.count);
              const periods = dashboardView === "day"
                ? selectedClosed.map(item => ({ label: new Date(item.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), count: 1, revenue: subscriptionValue(item) }))
                : dashboardView === "month"
                  ? Array.from({ length: new Date(Number(dashboardDate.slice(0, 4)), Number(dashboardDate.slice(5, 7)), 0).getDate() }, (_, index) => {
                      const day = index + 1;
                      const key = `${dashboardDate.slice(0, 7)}-${String(day).padStart(2, "0")}`;
                      const items = selectedClosed.filter(item => localKey(paymentDate(item)) === key);
                      return { label: String(day).padStart(2, "0"), count: items.length, revenue: revenue(items) };
                    })
                  : Array.from({ length: 12 }, (_, index) => {
                      const key = `${dashboardDate.slice(0, 4)}-${String(index + 1).padStart(2, "0")}`;
                      const items = selectedClosed.filter(item => monthKey(paymentDate(item)) === key);
                      return { label: new Date(Number(dashboardDate.slice(0, 4)), index, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), count: items.length, revenue: revenue(items) };
                    });
              const maxRevenue = Math.max(1, ...periods.map(item => item.revenue));
              const currentMonthIndex = today.getMonth();
              const monthlyHistory = Array.from({ length: 12 }, (_, index) => {
                const date = new Date(today.getFullYear(), currentMonthIndex - (11 - index), 1);
                const key = monthKey(date);
                const items = closedSubscriptions.filter(item => monthKey(paymentDate(item)) === key);
                return { label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), value: revenue(items), period: key };
              });
              const availableYears = Array.from(new Set(closedSubscriptions.map(item => yearKey(paymentDate(item))))).sort();
              const annualHistory = availableYears.map(year => ({
                label: year,
                value: revenue(closedSubscriptions.filter(item => yearKey(paymentDate(item)) === year)),
              }));
              const selectedDateInput = dashboardView === "day" ? dashboardDate : dashboardView === "month" ? dashboardDate.slice(0, 7) : dashboardDate.slice(0, 4);
              const selectedInputType = dashboardView === "day" ? "date" : dashboardView === "month" ? "month" : "number";
              return (
                <div className="admin-finance-dashboard">
                  <div className="admin-finance-hero">
                    <div>
                      <div className="admin-badge">VISÃO COMERCIAL</div>
                      <h2>Faturamento e planos</h2>
                      <p>Acompanhe contratos fechados, receita e desempenho por dia, mês ou ano.</p>
                    </div>
                    <div className="admin-finance-controls">
                      <div className="admin-finance-periods">
                        {(["day", "month", "year"] as const).map(view => <button type="button" key={view} className={dashboardView === view ? "active" : ""} onClick={() => setDashboardView(view)}>{view === "day" ? "Dia" : view === "month" ? "Mês" : "Ano"}</button>)}
                      </div>
                      <input type={selectedInputType} value={selectedDateInput} min={dashboardView === "year" ? "2020" : undefined} max={dashboardView === "year" ? "2100" : undefined} onChange={event => {
                        const value = event.target.value;
                        if (!value) return;
                        setDashboardDate(dashboardView === "year" ? `${value}-01-01` : dashboardView === "month" ? `${value}-01` : value);
                      }} />
                    </div>
                  </div>

                  <section className="admin-operational-metrics admin-dashboard-operations">
                    <div className="admin-operational-head">
                      <div>
                        <div className="admin-badge">OPERAÇÃO</div>
                        <h2>Pendências e atividade</h2>
                        <p>Veja rapidamente o que precisa da sua atenção antes de acompanhar os indicadores financeiros.</p>
                      </div>
                      <span>{unreadAdminNotifications} notificação(ões) não lida(s)</span>
                    </div>
                    <div className="admin-operational-grid">
                      <article>
                        <span>Fornecedores pendentes</span>
                        <strong>{pendingBusinesses.length}</strong>
                        <small>aguardando aprovação</small>
                        {pendingBusinesses.length > 0 && <button type="button" className="admin-action-button" onClick={() => { setSection("businesses"); setBusinessStatusFilter("pending"); window.history.replaceState(null, "", "/admin?section=businesses&status=pending"); }}>Analisar</button>}
                      </article>
                      <article>
                        <span>Pagamentos pendentes</span>
                        <strong>{pendingSubscriptions.length}</strong>
                        <small>aguardando conclusão</small>
                        {pendingSubscriptions.length > 0 && <button type="button" className="admin-action-button" onClick={() => { setSection("subscriptions"); window.history.replaceState(null, "", "/admin?section=subscriptions"); }}>Ver assinaturas</button>}
                      </article>
                      <article>
                        <span>Denúncias recebidas</span>
                        <strong>{supplierReports.length}</strong>
                        <small>registros para análise</small>
                        {supplierReports.length > 0 && <button type="button" className="admin-action-button" onClick={() => { setSection("security"); window.history.replaceState(null, "", "/admin?section=security"); }}>Analisar</button>}
                      </article>
                      <article>
                        <span>Notificações administrativas</span>
                        <strong>{unreadAdminNotifications}</strong>
                        <small>pendentes de leitura</small>
                        {unreadAdminNotifications > 0 && <button type="button" className="admin-action-button" onClick={() => { setSection("notifications"); window.history.replaceState(null, "", "/admin?section=notifications"); }}>Abrir</button>}
                      </article>
                    </div>
                  </section>

                  <details className="admin-finance-panel admin-dashboard-activity" style={{ margin: 0 }}>
                    <summary style={{ listStyle: "none", cursor: "pointer" }}>
                      <div className="admin-finance-panel-head" style={{ margin: 0 }}>
                        <div><div className="admin-badge">ATIVIDADE RECENTE</div><h3>O que aconteceu recentemente</h3></div>
                        <span className="admin-filter-count">Últimas movimentações · {Math.min(8, businesses.length + subscriptions.length + supplierReports.length)} registro(s) ▾</span>
                      </div>
                    </summary>
                    <div className="admin-dashboard-activity-list">
                      {[
                        ...businesses.map(item => ({ id:`business-${item.id}`, date:item.created_at, title:"Novo fornecedor cadastrado", detail:`${item.business_name} · ${item.city || "Localização não informada"}`, action:"Ver fornecedor", run:()=>{setSection("businesses");setSelectedBusinessId(item.id);window.history.replaceState(null,"","/admin?section=businesses");} })),
                        ...subscriptions.map(item => ({ id:`subscription-${item.id}`, date:item.created_at, title:item.status==="pending"?"Nova assinatura pendente":"Assinatura registrada", detail:`${item.business?.business_name || "Fornecedor"} · ${item.plan?.name || "Plano"}`, action:"Ver assinatura", run:()=>{setSection("subscriptions");window.history.replaceState(null,"","/admin?section=subscriptions");} })),
                        ...supplierReports.map(item => ({ id:`report-${item.id}`, date:item.created_at, title:"Denúncia registrada", detail:`${item.business?.business_name || "Fornecedor"} · ${item.reason.replaceAll("_"," ")}`, action:"Ver segurança", run:()=>{setSection("security");window.history.replaceState(null,"","/admin?section=security");} }))
                      ].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).slice(0,8).map(item=><article key={item.id}>
                        <div><strong>{item.title}</strong><span>{item.detail}</span><small>{new Date(item.date).toLocaleString("pt-BR")}</small></div>
                        <button type="button" className="admin-action-button" onClick={item.run}>{item.action}</button>
                      </article>)}
                      {businesses.length===0 && subscriptions.length===0 && supplierReports.length===0 && <div className="admin-empty">Nenhuma movimentação recente encontrada.</div>}
                    </div>
                  </details>

                  <div className="admin-finance-kpis">
                    <article><span>Faturamento hoje</span><strong>{money(revenue(todayClosed))}</strong><small>{todayClosed.length} plano(s) fechado(s)</small></article>
                    <article><span>Faturamento da semana</span><strong>{money(revenue(weekClosed))}</strong><small>{weekClosed.length} plano(s) fechado(s)</small></article>
                    <article><span>Faturamento do mês</span><strong>{money(revenue(monthClosed))}</strong><small>{monthClosed.length} plano(s) fechado(s)</small></article>
                    <article><span>Total de planos fechados</span><strong>{selectedClosed.length}</strong><small>{money(selectedRevenue)} no período selecionado</small></article>
                  </div>

                  <div className="admin-finance-growth-grid">
                    <section className="admin-finance-panel">
                      <div className="admin-finance-panel-head"><div><div className="admin-badge">EVOLUÇÃO</div><h3>Faturamento mensal</h3></div><span>Últimos 12 meses</span></div>
                      <FinanceLineChart data={monthlyHistory.map(item => ({ label: item.label, value: item.value }))} valueLabel="Evolução do faturamento mensal nos últimos 12 meses" />
                    </section>
                    <section className="admin-finance-panel">
                      <div className="admin-finance-panel-head"><div><div className="admin-badge">CRESCIMENTO</div><h3>Faturamento por ano</h3></div><span>{annualHistory.length} ano(s)</span></div>
                      <FinanceLineChart data={annualHistory} valueLabel="Evolução do faturamento anual da empresa" />
                    </section>
                  </div>

                  <div className="admin-finance-grid">
                    <section className="admin-finance-panel">
                      <div className="admin-finance-panel-head"><div><div className="admin-badge">PLANOS FECHADOS</div><h3>{dashboardView === "day" ? "Contratos do dia" : dashboardView === "month" ? "Desempenho diário" : "Desempenho mensal"}</h3></div><strong>{money(selectedRevenue)}</strong></div>
                      <div className="admin-finance-chart">
                        {periods.map((period, index) => <div className="admin-finance-bar-wrap" key={`${period.label}-${index}`} title={`${period.label}: ${period.count} plano(s) · ${money(period.revenue)}`}>
                          <div className="admin-finance-bar" style={{ height: `${Math.max(4, (period.revenue / maxRevenue) * 100)}%` }}></div>
                          <span>{period.label}</span>
                          {period.count > 0 && <em>{period.count}</em>}
                        </div>)}
                        {periods.length === 0 && <div className="admin-empty">Nenhum fechamento no período.</div>}
                      </div>
                    </section>

                    <section className="admin-finance-panel">
                      <div className="admin-finance-panel-head"><div><div className="admin-badge">POR PLANO</div><h3>Quais planos foram fechados</h3></div><span>{selectedClosed.length} fechamento(s)</span></div>
                      <div className="admin-finance-plan-list">
                        {byPlan.length === 0 ? <div className="admin-empty">Nenhum plano fechado no período selecionado.</div> : byPlan.map(plan => <div className="admin-finance-plan-row" key={plan.name}><div><strong>{plan.name}</strong><span>{plan.count} fechamento{plan.count === 1 ? "" : "s"}</span></div><strong>{money(plan.revenue)}</strong></div>)}
                      </div>
                    </section>
                  </div>

                  <section className="admin-finance-panel admin-finance-sales">
                    <div className="admin-finance-panel-head"><div><div className="admin-badge">FECHAMENTOS</div><h3>Vendas registradas no período</h3></div><span>{selectedClosed.length} total</span></div>
                    <div className="admin-finance-sales-list">
                      {selectedClosed.length === 0 ? <div className="admin-empty">Nenhuma venda registrada neste período.</div> : selectedClosed.slice().sort((a,b) => new Date(paymentDate(b)).getTime() - new Date(paymentDate(a)).getTime()).map(item => <div className="admin-finance-sale" key={item.id}><div><strong>{item.plan?.name || "Plano"}</strong><span>{item.business?.business_name || "Fornecedor"} · {new Date(paymentDate(item)).toLocaleString("pt-BR")}</span></div><strong>{money(subscriptionValue(item))}</strong></div>)}
                    </div>
                  </section>
                </div>
              );
            })()
          ) : section === "overview" ? (
            <div className="admin-overview-content">
            <div className="admin-metrics-grid">
              <div className="admin-metric"><span>Usuários</span><strong>{stats.users}</strong><small>contas cadastradas</small></div>
              <div className="admin-metric"><span>Empresas</span><strong>{stats.businesses}</strong><small>{activeBusinesses.length} ativas</small></div>
              <div className="admin-metric"><span>Pendentes</span><strong>{pendingBusinesses.length}</strong><small>aguardando análise</small></div>
              <div className="admin-metric"><span>Aprovadas</span><strong>{approvedBusinesses.length}</strong><small>publicadas</small></div>
              <div className="admin-metric"><span>Serviços</span><strong>{stats.services}</strong><small>cadastrados</small></div>
              <div className="admin-metric"><span>Avaliação média</span><strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong><small>{visibleReviews.length} visíveis</small></div>
            </div>
            <section className="admin-operational-metrics">
              <div className="admin-operational-head"><div><div className="admin-badge">OPERAÇÃO</div><h2>Indicadores da plataforma</h2><p>Visão rápida da saúde operacional do LOSI CONECTA.</p></div><span>Últimos 30 dias: {recentBusinessCount} novo(s) fornecedor(es)</span></div>
              <div className="admin-operational-grid">
                <article><span>Assinaturas ativas</span><strong>{activeSubscriptions.length}</strong><small>com acesso no momento</small></article>
                <article><span>Pagamentos confirmados</span><strong>{paidSubscriptions.length}</strong><small>registros com pagamento Asaas</small></article>
                <article><span>Pagamentos pendentes</span><strong>{pendingSubscriptions.length}</strong><small>aguardando conclusão</small></article>
                <article><span>Denúncias</span><strong>{supplierReports.length}</strong><small>registros recebidos</small></article>
              </div>
            </section>
            {pendingBusinesses.length > 0 && (
              <section className="admin-pending-panel">
                <div className="admin-section-head"><div><div className="admin-badge">AÇÃO NECESSÁRIA</div><h2 className="admin-section-title">Fornecedores aguardando análise</h2><p className="admin-text admin-text-compact">Revise os perfis pendentes diretamente desta tela.</p></div><button className="admin-back-button" onClick={() => { setSection("businesses"); setBusinessStatusFilter("pending"); window.history.replaceState(null, "", "/admin?section=businesses&status=pending"); }}>Ver todos</button></div>
                <div className="admin-pending-list">
                  {pendingBusinesses.slice(0, 5).map((item) => <article className="admin-pending-item" key={item.id}><div><strong>{item.business_name}</strong><span>{item.city || "Localização não informada"}{item.state ? " - " + item.state : ""}</span></div><div className="admin-item-actions"><button className="admin-action-button" onClick={() => updateBusiness(item.id,{approval_status:"approved"})}>Aprovar</button><button className="admin-action-button" onClick={() => updateBusiness(item.id,{approval_status:"rejected"})}>Rejeitar</button></div></article>)}
                </div>
              </section>
            )}
            <div className="admin-grid" >
              <button className="admin-overview-card" onClick={() => { setSection("users"); window.history.replaceState(null, "", "/admin?section=users"); }}><strong>Usuários <em>{stats.users}</em></strong><span>Contas cadastradas na plataforma.</span></button>
              <button className="admin-overview-card" onClick={() => { setSection("businesses"); window.history.replaceState(null, "", "/admin?section=businesses"); }}><strong>Empresas <em>{stats.businesses}</em></strong><span>Perfis comerciais e aprovação.</span></button>
              <button className="admin-overview-card" onClick={() => { setSection("services"); window.history.replaceState(null, "", "/admin?section=services"); }}><strong>Serviços <em>{stats.services}</em></strong><span>Serviços publicados pelos profissionais.</span></button>
              <button className="admin-overview-card" onClick={() => { setSection("categories"); window.history.replaceState(null, "", "/admin?section=categories"); }}><strong>Categorias <em>{stats.categories}</em></strong><span>Organização do catálogo.</span></button>
              <button className="admin-overview-card" onClick={() => { setSection("reviews"); window.history.replaceState(null, "", "/admin?section=reviews"); }}><strong>Avaliações <em>{stats.reviews}</em></strong><span>Moderação das avaliações.</span></button>
              <div className="admin-operation-card"><strong>Operação</strong><span>Use a fila de pendentes para analisar novos fornecedores e manter o catálogo atualizado.</span></div>
            </div>
            </div>
          ) : section === "security" ? (
            <div className="admin-security-center">
              <div className="admin-security-hero"><div><div className="admin-badge">SEGURANÇA</div><h2>Central de segurança</h2><p>Monitore contas em risco, denúncias novas, contas bloqueadas e perfis aguardando verificação.</p></div><span className="admin-security-status">MONITORAMENTO ATIVO</span></div>
              {(() => {
                const normalizePhone = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");
                const phoneCounts = users.reduce<Record<string, number>>((acc, item) => { const phone=normalizePhone(item.phone); if(phone) acc[phone]=(acc[phone]||0)+1; return acc; }, {});
                const reportCounts = supplierReports.reduce<Record<string, number>>((acc, item) => { acc[item.business_id]=(acc[item.business_id]||0)+1; return acc; }, {});
                const blockedUsers=users.filter(item=>item.blocked);
                const pendingVerification=businesses.filter(item=>item.approval_status==="pending");
                const riskUsers=users.map(item=>{ const reasons:string[]=[]; const phone=normalizePhone(item.phone); if(phone&&phoneCounts[phone]>1) reasons.push("Telefone associado a outra conta"); if(Date.now()-new Date(item.created_at).getTime()<2*60*60*1000) reasons.push("Conta criada há menos de 2 horas"); const business=businesses.find(b=>b.owner_id===item.id); const reports=business?(reportCounts[business.id]||0):0; if(reports>=4) reasons.push(`${reports} denúncias recebidas`); if(reports>=2) reasons.push("Comportamento considerado anormal"); return {item,reasons}; }).filter(x=>x.reasons.length>0||x.item.blocked);
                const riskBusinesses=businesses.map(business=>{ const reports=reportCounts[business.id]||0; const reasons:string[]=[]; if(reports>0) reasons.push(`${reports} denúncia${reports===1?"":"s"} recebida${reports===1?"":"s"}`); if(business.approval_status==="pending") reasons.push("Perfil aguardando verificação"); if(!business.verified) reasons.push("Perfil ainda não verificado"); return {business,reasons}; }).filter(x=>x.reasons.length>0);
                const search=securitySearch.trim().toLocaleLowerCase("pt-BR");
                const matches=(v:string)=>!search||v.toLocaleLowerCase("pt-BR").includes(search);
                const visibleUsers=riskUsers.filter(({item,reasons})=>matches(`${item.full_name??""} ${item.city??""} ${reasons.join(" ")}`));
                const visibleBusinesses=riskBusinesses.filter(({business,reasons})=>matches(`${business.business_name} ${business.city??""} ${reasons.join(" ")}`));
                const newReports=supplierReports.filter(r=>Date.now()-new Date(r.created_at).getTime()<=7*24*60*60*1000);
                return <>
                  <div className="admin-security-metrics"><article><span>Contas em risco</span><strong>{riskUsers.length+riskBusinesses.length}</strong></article><article><span>Denúncias novas</span><strong>{newReports.length}</strong></article><article><span>Contas bloqueadas</span><strong>{blockedUsers.length}</strong></article><article><span>Perfil aguardando verificação</span><strong>{pendingVerification.length}</strong></article></div>
                  <div className="admin-security-toolbar"><input value={securitySearch} onChange={event=>setSecuritySearch(event.target.value)} placeholder="Buscar conta, fornecedor ou motivo..." aria-label="Buscar riscos de segurança" /></div>
                  <section className="admin-security-section"><div className="admin-security-section-head"><div><div className="admin-badge">CONTAS EM RISCO</div><h3>Contas que exigem atenção</h3></div><span>{visibleUsers.length+visibleBusinesses.length} encontrado(s)</span></div><div className="admin-security-list">
                    {visibleUsers.map(({item,reasons})=><article className="admin-security-card" key={`user-${item.id}`}><div className="admin-security-card-main"><strong>{item.full_name||"Usuário sem nome"}</strong><span>{item.user_type==="admin"?"Administrador":"Profissional"}{item.city?` · ${item.city}`:""}{item.state?` - ${item.state}`:""}</span><div className="admin-security-reasons">{reasons.map(reason=><span key={reason}>{reason}</span>)}</div></div><div className="admin-security-actions">{item.blocked?<button type="button" className="admin-action-button" onClick={()=>manageUser(item.id,"unblock")}>Desbloquear</button>:<button type="button" className="admin-security-danger" onClick={()=>manageUser(item.id,"block")}>Suspender / bloquear</button>}</div></article>)}
                    {visibleBusinesses.map(({business,reasons})=><article className="admin-security-card" key={`business-${business.id}`}><div className="admin-security-card-main"><strong>{business.business_name}</strong><span>Fornecedor{business.city?` · ${business.city}`:""}{business.state?` - ${business.state}`:""}</span><div className="admin-security-reasons">{reasons.map(reason=><span key={reason}>{reason}</span>)}</div></div><div className="admin-security-actions">{business.approval_status!=="approved"&&<button type="button" className="admin-action-button" onClick={()=>updateBusiness(business.id,{approval_status:"approved",verified:true,active:true})}>Aprovar</button>}<button type="button" className="admin-action-button" onClick={()=>updateBusiness(business.id,{approval_status:"pending",verified:false})}>Solicitar verificação</button>{business.active&&<button type="button" className="admin-security-danger" onClick={()=>updateBusiness(business.id,{active:false})}>Suspender / bloquear</button>}</div></article>)}
                    {visibleUsers.length===0&&visibleBusinesses.length===0&&<div className="admin-empty">Nenhum sinal de risco encontrado.</div>}
                  </div></section>
                  <section className="admin-security-section"><div className="admin-security-section-head"><div><div className="admin-badge">DENÚNCIAS NOVAS</div><h3>Últimas denúncias</h3></div><span>{newReports.length} nos últimos 7 dias</span></div><div className="admin-security-list">
                    {newReports.slice(0,20).map(report=><article className="admin-security-card" key={report.id}><div className="admin-security-card-main"><strong>{report.business?.business_name||"Fornecedor"}</strong><span>{report.reporter?.full_name||"Usuário"} · {new Date(report.created_at).toLocaleString("pt-BR")}</span><div className="admin-security-reasons"><span>{report.reason.replaceAll("_"," ")}</span></div>{report.details&&<p>{report.details}</p>}</div><div className="admin-security-actions"><button type="button" className="admin-action-button" onClick={()=>{setSelectedReportId(report.id);setReportResolutionNote(report.resolution_note||"");setReportResolutionStatus(report.status==="dismissed"?"dismissed":"resolved");setReportResolutionAction(report.resolution_action||"none");}}>Ver denúncia</button>{report.status==="open"&&<button type="button" className="admin-security-danger" onClick={()=>{setSelectedReportId(report.id);setReportResolutionNote("");setReportResolutionStatus("resolved");setReportResolutionAction("none");}}>Resolver denúncia</button>}</div></article>)}
                    {newReports.length===0&&<div className="admin-empty">Nenhuma denúncia nova nos últimos 7 dias.</div>}
                  </div></section>
                  {selectedReportId && (() => {
                    const report = supplierReports.find(item => item.id === selectedReportId);
                    if (!report) return null;
                    return <div className="admin-modal-backdrop" role="presentation" onClick={() => !reportSaving && setSelectedReportId(null)}>
                      <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Detalhes da denúncia" onClick={event => event.stopPropagation()}>
                        <div className="admin-modal-header"><div><div className="admin-badge">DENÚNCIA</div><h3>Detalhes da denúncia</h3></div><button type="button" className="admin-modal-close" onClick={() => !reportSaving && setSelectedReportId(null)} aria-label="Fechar">×</button></div>
                        <div className="admin-modal-body">
                          <p><strong>Fornecedor:</strong> {report.business?.business_name || "Fornecedor não identificado"}</p>
                          <p><strong>Denunciante:</strong> {report.reporter?.full_name || "Usuário não identificado"}</p>
                          <p><strong>Motivo:</strong> {report.reason.replaceAll("_"," ")}</p>
                          <p><strong>Data:</strong> {new Date(report.created_at).toLocaleString("pt-BR")}</p>
                          {report.details && <div className="admin-modal-detail"><strong>Relato</strong><p>{report.details}</p></div>}
                          <label className="admin-form-field"><span>Resultado da análise</span><select value={reportResolutionStatus} onChange={event => setReportResolutionStatus(event.target.value as "resolved"|"dismissed")} disabled={reportSaving}><option value="resolved">Denúncia procedente / resolvida</option><option value="dismissed">Denúncia sem procedência / arquivada</option></select></label><label className="admin-form-field"><span>Medida sobre o fornecedor</span><select value={reportResolutionAction} onChange={event => setReportResolutionAction(event.target.value as "none"|"keep_active"|"suspend_supplier"|"block_supplier")} disabled={reportSaving || report.status!=="open"}><option value="none">Nenhuma medida</option><option value="keep_active">Manter fornecedor ativo</option><option value="suspend_supplier">Suspender fornecedor</option><option value="block_supplier">Bloquear responsável pela conta</option></select></label>
                          <label className="admin-form-field"><span>Observação administrativa</span><textarea value={reportResolutionNote} onChange={event => setReportResolutionNote(event.target.value)} placeholder="Registre o que foi analisado ou qual medida foi tomada." maxLength={1000} disabled={reportSaving} /></label>
                          {report.status!=="open" && <p><strong>Status:</strong> {report.status==="resolved"?"Resolvida":"Arquivada"}{report.resolved_at ? " · " + new Date(report.resolved_at).toLocaleString("pt-BR") : ""}</p>}
                        </div>
                        <div className="admin-modal-actions"><button type="button" className="admin-action-button" onClick={()=>{setSection("businesses");setSelectedBusinessId(report.business_id);window.history.replaceState(null,"","/admin?section=businesses");}}>Analisar fornecedor</button>{report.status==="open"&&<button type="button" className="admin-security-danger" disabled={reportSaving} onClick={()=>resolveSupplierReport(report.id, reportResolutionStatus)}>{reportSaving?"Salvando...":"Salvar resolução"}</button>}</div>
                      </div>
                    </div>;
                  })()}
                  <section className="admin-security-section"><div className="admin-security-section-head"><div><div className="admin-badge">CONTAS BLOQUEADAS</div><h3>Contas atualmente bloqueadas</h3></div><span>{blockedUsers.length}</span></div><div className="admin-security-list">
                    {blockedUsers.map(item=><article className="admin-security-card" key={item.id}><div className="admin-security-card-main"><strong>{item.full_name||"Usuário sem nome"}</strong><span>Conta bloqueada{item.city?` · ${item.city}`:""}</span></div><div className="admin-security-actions"><button type="button" className="admin-action-button" onClick={()=>manageUser(item.id,"unblock")}>Desbloquear</button></div></article>)}
                    {blockedUsers.length===0&&<div className="admin-empty">Nenhuma conta bloqueada.</div>}
                  </div></section>
                  <section className="admin-security-section"><div className="admin-security-section-head"><div><div className="admin-badge">AGUARDANDO VERIFICAÇÃO</div><h3>Perfis aguardando verificação</h3></div><span>{pendingVerification.length}</span></div><div className="admin-security-list">
                    {pendingVerification.map(business=><article className="admin-security-card" key={business.id}><div className="admin-security-card-main"><strong>{business.business_name}</strong><span>{business.city||"Localização não informada"}{business.state?` - ${business.state}`:""}</span></div><div className="admin-security-actions"><button type="button" className="admin-action-button" onClick={()=>{setSection("businesses");setSelectedBusinessId(business.id);window.history.replaceState(null,"","/admin?section=businesses");}}>Analisar</button><button type="button" className="admin-action-button" onClick={()=>updateBusiness(business.id,{approval_status:"approved",verified:true,active:true})}>Aprovar</button></div></article>)}
                    {pendingVerification.length===0&&<div className="admin-empty">Nenhum perfil aguardando verificação.</div>}
                  </div></section>
                </>;
              })()}
            </div>
          ) : (
            <section className="admin-table-section">
              <div className="admin-section-head"><div className="admin-badge">{sectionTitle.toUpperCase()}</div><button className="admin-back-button" onClick={() => { setSection("overview"); window.history.replaceState(null, "", "/admin"); }}>Visão geral</button></div>
              {section === "users" ? <div className="admin-inline-list">
                <div className="admin-users-toolbar">
                  <div>
                    <strong>Controle de usuários</strong>
                    <span>Cadastre acessos diretamente pelo painel administrativo.</span>
                  </div>
                  <button type="button" className="admin-primary-button" onClick={() => { setShowCreateUser((value) => !value); setCreateUserError(""); setCreateUserSuccess(""); }}>
                    {showCreateUser ? "Fechar cadastro" : "Cadastrar usuário"}
                  </button>
                </div>
                {showCreateUser && (
                  <form className="admin-user-form" onSubmit={createManualUser}>
                    <div className="admin-form-heading">
                      <div>
                        <span className="admin-form-kicker">NOVO ACESSO</span>
                        <h2>Cadastrar usuário manualmente</h2>
                        <p>Crie o acesso e o perfil do usuário sem precisar passar pela tela pública de cadastro.</p>
                      </div>
                    </div>
                    <div className="admin-form-grid">
                      <label className="admin-form-field admin-form-field-wide">
                        <span>Nome completo</span>
                        <input name="full_name" required placeholder="Ex.: João da Silva" autoComplete="name" />
                      </label>
                      <label className="admin-form-field">
                        <span>E-mail de acesso</span>
                        <input name="email" type="email" required placeholder="nome@empresa.com.br" autoComplete="email" />
                      </label>
                      <label className="admin-form-field">
                        <span>Senha inicial</span>
                        <input name="password" type="password" minLength={6} required placeholder="Mínimo de 6 caracteres" autoComplete="new-password" />
                      </label>
                      <label className="admin-form-field">
                        <span>Telefone</span>
                        <input name="phone" type="tel" placeholder="(11) 99999-9999" autoComplete="tel" />
                      </label>
                      <label className="admin-form-field">
                        <span>Cidade</span>
                        <input name="city" placeholder="Ex.: São Paulo" autoComplete="address-level2" />
                      </label>
                      <label className="admin-form-field admin-form-field-small">
                        <span>UF</span>
                        <input name="state" maxLength={2} placeholder="SP" />
                      </label>
                      <label className="admin-form-field">
                        <span>Tipo de acesso</span>
                        <select name="user_type" defaultValue="professional">
                          <option value="professional">Profissional</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </label>
                    </div>
                    {createUserError && <div className="admin-form-message admin-form-message-error">{createUserError}</div>}
                    {createUserSuccess && <div className="admin-form-message admin-form-message-success">{createUserSuccess}</div>}
                    <div className="admin-form-actions">
                      <button type="button" className="admin-secondary-button" onClick={() => setShowCreateUser(false)}>Cancelar</button>
                      <button type="submit" className="admin-primary-button" disabled={creatingUser}>{creatingUser ? "Criando acesso..." : "Criar usuário"}</button>
                    </div>
                  </form>
                )}
                <div className="admin-filters admin-simple-filter"><input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Buscar usuário, cidade ou estado..." aria-label="Buscar usuários" /><span className="admin-filter-count">{users.filter(item => `${item.full_name ?? ""} ${item.city ?? ""} ${item.state ?? ""}`.toLocaleLowerCase("pt-BR").includes(userSearch.trim().toLocaleLowerCase("pt-BR"))).length} resultado(s)</span></div><div className="admin-list">{users.length === 0 ? <div className="admin-empty">Nenhum usuário encontrado.</div> : users.filter(item => `${item.full_name ?? ""} ${item.city ?? ""} ${item.state ?? ""}`.toLocaleLowerCase("pt-BR").includes(userSearch.trim().toLocaleLowerCase("pt-BR"))).map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.full_name || "Usuário sem nome"}</strong><span>{item.user_type === "admin" ? "Administrador" : "Profissional"}{item.city ? " · " + item.city : ""}{item.state ? " - " + item.state : ""}</span>{item.blocked && <span className="admin-user-status admin-user-status-blocked">Bloqueado</span>}</div><span className="admin-id">ID: {item.id.slice(0,8)}…</span><div className="admin-item-actions"><button type="button" className={item.blocked ? "admin-user-unblock" : "admin-user-block"} disabled={item.user_type === "admin" && item.id === user?.id} onClick={() => manageUser(item.id, item.blocked ? "unblock" : "block")}>{item.blocked ? "Desbloquear" : "Bloquear"}</button><button type="button" className="admin-user-delete" disabled={item.user_type === "admin" && item.id === user?.id} onClick={() => manageUser(item.id, "delete")}>Remover</button></div></div></article>)}</div></div>
              : section === "businesses" ? <div>
                <div className="admin-filters">
                  <input value={businessSearch} onChange={(e) => setBusinessSearch(e.target.value)} placeholder="Buscar empresa, cidade ou estado..." aria-label="Buscar empresas" />
                  <select value={businessStatusFilter} onChange={(e) => setBusinessStatusFilter(e.target.value as typeof businessStatusFilter)} aria-label="Filtrar status">
                    <option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="approved">Aprovadas</option><option value="rejected">Rejeitadas</option>
                  </select>
                  <span className="admin-filter-count">{filteredBusinesses.length} resultado(s)</span>
                </div>
                {selectedBusiness && (
                  <div className="admin-review-card">
                    <div className="admin-section-head">
                      <div><div className="admin-badge">ANÁLISE DO FORNECEDOR</div><h2 className="admin-section-title">{selectedBusiness.business_name}</h2><p className="admin-text admin-text-compact">{selectedBusiness.city || "Localização não informada"}{selectedBusiness.state ? " - " + selectedBusiness.state : ""}</p></div>
                      <button className="admin-back-button" onClick={() => setSelectedBusinessId(null)}>Fechar análise</button>
                    </div>
                    <div className="admin-review-media">{selectedBusiness.cover_url && <img src={selectedBusiness.cover_url} alt="" className="admin-review-cover" />}{selectedBusiness.logo_url && <img src={selectedBusiness.logo_url} alt="" className="admin-review-logo" />}</div><div className="admin-review-status"><span>Status: <strong>{selectedBusiness.approval_status === "approved" ? "Aprovada" : selectedBusiness.approval_status === "rejected" ? "Rejeitada" : "Pendente"}</strong></span><span>{selectedBusiness.verified ? "Verificada" : "Não verificada"} · {selectedBusiness.active ? "Ativa" : "Inativa"}</span></div>
                    <div className="admin-item-actions"><button className="admin-action-button" onClick={() => updateBusiness(selectedBusiness.id,{approval_status:"approved"})}>Aprovar fornecedor</button><button className="admin-action-button" onClick={() => updateBusiness(selectedBusiness.id,{approval_status:"rejected"})}>Rejeitar fornecedor</button></div>
                  </div>
                )}
                <div className="admin-list">{filteredBusinesses.length === 0 ? <div className="admin-empty">Nenhuma empresa encontrada com esses filtros.</div> : filteredBusinesses.map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.business_name}</strong><span>{item.city || "Localização não informada"}{item.state ? " - " + item.state : ""} · {item.verified ? "Verificada" : "Não verificada"} · {item.active ? "Ativa" : "Inativa"} · {item.approval_status === "approved" ? "Aprovada" : item.approval_status === "rejected" ? "Rejeitada" : "Pendente"}</span></div><div className="admin-item-actions"><button className="admin-action-button" onClick={() => setSelectedBusinessId(item.id)}>Analisar</button><button className="admin-action-button" onClick={() => updateBusiness(item.id,{verified:!item.verified})}>{item.verified ? "Retirar verificação" : "Verificar empresa"}</button>{item.approval_status !== "approved" && <button className="admin-action-button" onClick={() => updateBusiness(item.id,{approval_status:"approved"})}>Aprovar</button>}{item.approval_status !== "rejected" && <button className="admin-action-button" onClick={() => updateBusiness(item.id,{approval_status:"rejected"})}>Rejeitar</button>}<button className="admin-action-button" onClick={() => updateBusiness(item.id,{active:!item.active})}>{item.active ? "Desativar" : "Ativar"}</button></div></div></article>)}</div>
              </div>
              : section === "alerts" ? (() => {
                const alerts = [
                  ...businesses.filter(item => item.approval_status === "pending").map(item => ({ id:`business-${item.id}`, kind:"urgent" as const, title:"Fornecedor aguardando aprovação", message:`${item.business_name} ainda precisa ser analisado.`, date:null as string|null, action:"Analisar fornecedor", run:()=>{setSelectedBusinessId(item.id);setSection("businesses");window.history.replaceState(null,"","/admin?section=businesses");} })),
                  ...subscriptions.filter(item => item.status === "pending").map(item => ({ id:`subscription-${item.id}`, kind:"finance" as const, title:"Pagamento pendente", message:`${item.business?.business_name || "Fornecedor"} · ${item.plan?.name || "Plano"} aguardando conclusão.`, date:item.created_at, action:"Ver assinatura", run:()=>{setSection("subscriptions");window.history.replaceState(null,"","/admin?section=subscriptions");} })),
                  ...supplierReports.map(item => ({ id:`report-${item.id}`, kind:"moderation" as const, title:"Nova denúncia registrada", message:`${item.business?.business_name || "Fornecedor"} · ${item.reason.replaceAll("_"," ")}`, date:item.created_at, action:"Analisar denúncia", run:()=>{setSection("security");window.history.replaceState(null,"","/admin?section=security");} })),
                  ...subscriptions.filter(item => item.status === "active" && item.asaas_payment_id && item.paid_at).map(item => ({ id:`payment-${item.id}`, kind:"finance" as const, title:"Pagamento confirmado", message:`${item.business?.business_name || "Fornecedor"} · ${item.plan?.name || "Plano"}`, date:item.paid_at, action:"Ver assinatura", run:()=>{setSection("subscriptions");window.history.replaceState(null,"","/admin?section=subscriptions");} })),
                ];
                const filteredAlerts = alerts.filter(item => adminAlertFilter === "all" || item.kind === adminAlertFilter);
                return (
                  <div className="admin-alerts-page">
                    <div className="admin-alerts-hero">
                      <div><div className="admin-badge">OPERAÇÃO</div><h2>Central de alertas</h2><p>Um único lugar para acompanhar situações que precisam da sua atenção.</p></div>
                      <strong>{alerts.length} alerta(s)</strong>
                    </div>
                    <div className="admin-alerts-summary">
                      <article><span>Urgentes</span><strong>{alerts.filter(x=>x.kind==="urgent").length}</strong></article>
                      <article><span>Financeiro</span><strong>{alerts.filter(x=>x.kind==="finance").length}</strong></article>
                      <article><span>Moderação</span><strong>{alerts.filter(x=>x.kind==="moderation").length}</strong></article>
                    </div>
                    <div className="admin-alerts-filters">
                      {([["all","Todos"],["urgent","Urgentes"],["finance","Financeiro"],["moderation","Moderação"]] as const).map(([value,label]) => <button type="button" key={value} className={adminAlertFilter===value?"active":""} onClick={()=>setAdminAlertFilter(value)}>{label}</button>)}
                    </div>
                    <div className="admin-alerts-list">
                      {filteredAlerts.length===0 ? <div className="admin-empty">Nenhum alerta nesta categoria.</div> : filteredAlerts.map(alert => <article className={`admin-alert-card admin-alert-${alert.kind}`} key={alert.id}>
                        <div className="admin-alert-card-main"><span className="admin-alert-type">{alert.kind==="urgent"?"AÇÃO NECESSÁRIA":alert.kind==="finance"?"FINANCEIRO":"MODERAÇÃO"}</span><h3>{alert.title}</h3><p>{alert.message}</p>{alert.date&&<small>{new Date(alert.date).toLocaleString("pt-BR")}</small>}</div>
                        <button type="button" className="admin-action-button" onClick={alert.run}>{alert.action}</button>
                      </article>)}
                    </div>
                  </div>
                );
              })()
              : section === "subscriptions" ? (() => {
                const query = subscriptionSearch.trim().toLocaleLowerCase("pt-BR");
                const filteredSubscriptions = subscriptions.filter(item => {
                  const haystack = [
                    item.business?.business_name ?? "",
                    item.plan?.name ?? "",
                    item.asaas_payment_id ?? "",
                    item.status,
                  ].join(" ").toLocaleLowerCase("pt-BR");
                  return (!query || haystack.includes(query)) && (subscriptionStatusFilter === "all" || item.status === subscriptionStatusFilter);
                });
                const activeCount = subscriptions.filter(item => item.status === "active").length;
                const pendingCount = subscriptions.filter(item => item.status === "pending").length;
                const cancelledCount = subscriptions.filter(item => item.status === "cancelled").length;
                const paidRevenue = subscriptions.filter(item => item.asaas_payment_id && item.paid_amount != null).reduce((sum,item) => sum + Number(item.paid_amount ?? 0), 0);
                const statusLabel = (status: string) => status === "active" ? "Ativa" : status === "pending" ? "Pendente" : status === "cancelled" ? "Cancelada" : status;
                return (
                  <div className="admin-subscriptions-page">
                    <div className="admin-subscriptions-summary">
                      <article><span>Ativas</span><strong>{activeCount}</strong><small>planos com acesso ativo</small></article>
                      <article><span>Pendentes</span><strong>{pendingCount}</strong><small>aguardando pagamento</small></article>
                      <article><span>Canceladas</span><strong>{cancelledCount}</strong><small>histórico registrado</small></article>
                      <article><span>Receita registrada</span><strong>{paidRevenue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><small>pagamentos confirmados</small></article>
                    </div>
                    <div className="admin-subscriptions-toolbar">
                      <input value={subscriptionSearch} onChange={e => setSubscriptionSearch(e.target.value)} placeholder="Buscar fornecedor, plano ou ID Asaas..." aria-label="Buscar assinaturas" />
                      <select value={subscriptionStatusFilter} onChange={e => setSubscriptionStatusFilter(e.target.value as typeof subscriptionStatusFilter)} aria-label="Filtrar assinaturas">
                        <option value="all">Todos os status</option>
                        <option value="active">Ativas</option>
                        <option value="pending">Pendentes</option>
                        <option value="cancelled">Canceladas</option>
                      </select>
                      <span className="admin-filter-count">{filteredSubscriptions.length} resultado(s)</span>
                    </div>
                    <div className="admin-subscriptions-list">
                      {filteredSubscriptions.length === 0 ? <div className="admin-empty">Nenhuma assinatura encontrada com os filtros atuais.</div> : filteredSubscriptions.map(item => {
                        const amount = item.paid_amount != null ? Number(item.paid_amount) : Number(item.plan?.price_cents ?? 0) / 100;
                        return (
                          <article className="admin-subscription-card" key={item.id}>
                            <div className="admin-subscription-main">
                              <div>
                                <div className="admin-subscription-plan">{item.plan?.name || "Plano não identificado"}</div>
                                <h3>{item.business?.business_name || "Fornecedor não identificado"}</h3>
                                <p>{item.paid_at ? `Pagamento: ${new Date(item.paid_at).toLocaleString("pt-BR")}` : `Criada: ${new Date(item.created_at).toLocaleString("pt-BR")}`}{item.ends_at ? ` · término: ${new Date(item.ends_at).toLocaleDateString("pt-BR")}` : ""}</p>
                              </div>
                              <div className="admin-subscription-meta">
                                <strong>{amount.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong>
                                <span className={`admin-subscription-status admin-subscription-status-${item.status}`}>{statusLabel(item.status)}</span>
                              </div>
                            </div>
                            <div className="admin-subscription-details">
                              <span>Asaas: {item.asaas_payment_id ? item.asaas_payment_id : "Ainda não confirmado"}</span>
                              <span>Plano: {item.plan?.slug || "—"}</span>
                              <span>ID: {item.id.slice(0,8)}…</span>
                            </div>
                            {item.status === "active" && <div className="admin-item-actions">
                              <button type="button" className="admin-security-danger" onClick={async () => {
                                if (!window.confirm(`Encerrar o acesso de ${item.business?.business_name || "este fornecedor"} a este plano?`)) return;
                                const { data: cancelData, error: cancelError } = await supabase.functions.invoke("admin-manage-user", {
                                  body: { user_id: item.business_id, action: "cancel_subscription", subscription_id: item.id },
                                });
                                if (cancelError || cancelData?.error) { setDataError(cancelData?.error || cancelError?.message || "Não foi possível encerrar o acesso."); return; }
                                const now = new Date().toISOString();
                                setSubscriptions(current => current.map(x => x.id === item.id ? { ...x, status: "cancelled", ends_at: now } : x));
                                await recordAdminAction("cancel_subscription","subscription",item.id,item.business?.business_name || "Fornecedor",{plan:item.plan?.name || null});
                                setDataError("");
                              }}>Encerrar acesso</button>
                            </div>}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
                            : section === "sounds" ? (
                <div className="admin-admin-center">
                  <section className="admin-admin-center-hero">
                    <div><div className="admin-badge">NOTIFICAÇÕES</div><h2>Sons de notificação</h2><p>Envie sons personalizados e escolha qual deles será reproduzido quando qualquer usuário receber uma nova notificação.</p></div>
                    <strong>{notificationSounds.length} som(ns)</strong>
                  </section>
                  <form className="admin-plan-editor" onSubmit={(event) => { event.preventDefault(); void uploadNotificationSound(); }}>
                    <label>Nome do som<input value={notificationSoundName} onChange={event => setNotificationSoundName(event.target.value)} maxLength={80} placeholder="Ex.: Plin LOSI" /></label>
                    <label>Arquivo de áudio<input type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,audio/webm,.mp3,.wav,.ogg,.m4a,.webm" onChange={event => setNotificationSoundFile(event.target.files?.[0] ?? null)} /></label>
                    <div className="admin-item-actions"><button type="submit" className="admin-action-button" disabled={!notificationSoundFile || notificationSoundSaving}>{notificationSoundSaving ? "Enviando..." : "Enviar som"}</button></div>
                    <small className="admin-text">Formatos de áudio · máximo de 5 MB.</small>
                  </form>
                  {notificationSoundMessage && <div className="admin-category-message">{notificationSoundMessage}</div>}
                  <div className="admin-list">
                    {notificationSounds.length === 0 ? <div className="admin-empty">Nenhum som cadastrado ainda.</div> : notificationSounds.map(sound => (
                      <article className="admin-list-item" key={sound.id}>
                        <div className="admin-item-main">
                          <div><strong>{sound.name}</strong><span>{sound.active ? "Som atual das notificações" : "Disponível para seleção"} · {new Date(sound.created_at).toLocaleString("pt-BR")}</span><audio controls preload="none" src={sound.public_url} style={{ width: "min(100%, 360px)", marginTop: 10 }} /></div>
                          <div className="admin-item-actions"><button type="button" className="admin-action-button" onClick={() => void activateNotificationSound(sound.id)} disabled={sound.active || notificationSoundSaving}>{sound.active ? "Em uso" : "Usar como notificação"}</button><button type="button" className="admin-category-delete" onClick={() => void deleteNotificationSound(sound)} disabled={sound.active || notificationSoundSaving}>Remover</button></div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : section === "communication" ? (
                <div className="admin-admin-center admin-communication-center">
                  <section className="admin-admin-center-hero">
                    <div><div className="admin-badge">COMUNICAÇÃO</div><h2>Central de comunicação</h2><p>Envie avisos personalizados para usuários, fornecedores ou assinantes de um plano.</p></div>
                    <strong>{broadcasts.length} envio(s)</strong>
                  </section>
                  <form className="admin-broadcast-form" onSubmit={async (event: FormEvent) => {
                    event.preventDefault();
                    if (!user || broadcastSending) return;
                    setBroadcastMessageStatus("");
                    if (!broadcastTitle.trim() || !broadcastMessage.trim()) { setBroadcastMessageStatus("Preencha o título e a mensagem."); return; }
                    if ((broadcastTarget === "plan" || broadcastTarget === "user") && !broadcastTargetValue) { setBroadcastMessageStatus("Selecione o público."); return; }
                    if (!window.confirm("Enviar esta comunicação agora para o público selecionado?")) return;
                    setBroadcastSending(true);
                    const { data, error } = await supabase.functions.invoke("admin-manage-user", { body: {
                      action: "send_broadcast",
                      title: broadcastTitle.trim(),
                      message: broadcastMessage.trim(),
                      target_type: broadcastTarget,
                      target_value: broadcastTargetValue || null
                    }});
                    if (error || data?.error) { setBroadcastMessageStatus(data?.error || error?.message || "Não foi possível enviar a comunicação."); setBroadcastSending(false); return; }
                    const recipientCount = Number(data?.recipient_count ?? 0);
                    await recordAdminAction("send_broadcast","communication",null,broadcastTitle.trim(),{target_type:broadcastTarget,target_value:broadcastTargetValue||null,recipient_count:recipientCount});
                    setBroadcasts(current => [{id:data?.broadcast?.id || crypto.randomUUID(),title:broadcastTitle.trim(),message:broadcastMessage.trim(),target_type:broadcastTarget,target_value:broadcastTargetValue||null,recipient_count:recipientCount,created_at:new Date().toISOString()},...current].slice(0,100));
                    setBroadcastTitle("");
                    setBroadcastMessage("");
                    setBroadcastTargetValue("");
                    setBroadcastMessageStatus(`Comunicação enviada para ${recipientCount} destinatário(s).`);
                    setBroadcastSending(false);
                  }}>
                    <div className="admin-broadcast-fields">
                      <label><span>Título</span><input maxLength={120} value={broadcastTitle} onChange={e=>setBroadcastTitle(e.target.value)} placeholder="Ex.: Novidade no LOSI CONECTA" /></label>
                      <label><span>Mensagem</span><textarea maxLength={1000} rows={5} value={broadcastMessage} onChange={e=>setBroadcastMessage(e.target.value)} placeholder="Escreva a comunicação que aparecerá no sino de notificações do usuário." /></label>
                      <label><span>Público</span><select value={broadcastTarget} onChange={e=>{setBroadcastTarget(e.target.value as typeof broadcastTarget);setBroadcastTargetValue("");}}>
                        <option value="all_suppliers">Todos os fornecedores ativos</option>
                        <option value="all_users">Todos os usuários</option>
                        <option value="plan">Usuários de um plano</option>
                        <option value="user">Usuário específico</option>
                      </select></label>
                      {broadcastTarget === "plan" && <label><span>Plano</span><select value={broadcastTargetValue} onChange={e=>setBroadcastTargetValue(e.target.value)}><option value="">Selecione o plano</option>{plans.filter(item=>item.active).map(plan=><option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>}
                      {broadcastTarget === "user" && <label><span>Usuário</span><select value={broadcastTargetValue} onChange={e=>setBroadcastTargetValue(e.target.value)}><option value="">Selecione o usuário</option>{users.filter(item=>!item.blocked).map(item=><option key={item.id} value={item.id}>{item.full_name || "Sem nome"}{item.city ? ` · ${item.city}` : ""}</option>)}</select></label>}
                    </div>
                    <div className="admin-broadcast-footer"><small>A mensagem será entregue como uma notificação normal no painel do usuário.</small><button type="submit" className="admin-action-button" disabled={broadcastSending}>{broadcastSending ? "Enviando..." : "Enviar comunicação"}</button></div>
                    {broadcastMessageStatus && <div className="admin-broadcast-status">{broadcastMessageStatus}</div>}
                  </form>
                  <div className="admin-broadcast-history">
                    <div className="admin-broadcast-history-head"><h3>Histórico de envios</h3><span>{broadcasts.reduce((sum,item)=>sum+item.recipient_count,0)} destinatários nos últimos 100 envios</span></div>
                    {broadcasts.length===0 ? <div className="admin-empty">Nenhuma comunicação enviada ainda.</div> : broadcasts.map(item=><article key={item.id} className="admin-broadcast-item"><div><span>{item.target_type==="all_suppliers"?"FORNECEDORES":item.target_type==="all_users"?"TODOS OS USUÁRIOS":item.target_type==="plan"?"PLANO":"USUÁRIO"}</span><h4>{item.title}</h4><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("pt-BR")} · {item.recipient_count} destinatário(s)</small></div></article>)}
                  </div>
                </div>
              ) : section === "coupons" ? (
                <div className="admin-admin-center">
                  <section className="admin-admin-center-hero">
                    <div><div className="admin-badge">COMERCIAL</div><h2>Cupons de desconto</h2><p>Crie cupons exclusivos para usuários, defina o desconto, prazo e plano. Cada cupom pertence a um único usuário e só pode ser utilizado uma vez.</p></div>
                    <strong>{coupons.filter(item => item.active && !item.used_at).length} disponível(is)</strong>
                  </section>

                  <form key={editingCouponId ?? "new"} className="admin-plan-editor" onSubmit={saveCoupon}>
                    <input type="hidden" name="id" value={editingCouponId ? editingCouponId : ""} />
                    <label>Código do cupom<input name="code" defaultValue={editingCouponId ? coupons.find(item => item.id === editingCouponId)?.code ?? "" : ""} placeholder="Ex.: JAY20OFF" maxLength={40} required /></label>
                    <label>Usuário<select name="assigned_user_id" defaultValue={editingCouponId ? coupons.find(item => item.id === editingCouponId)?.assigned_user_id ?? "" : ""} required><option value="">Selecione o usuário</option>{users.filter(item => !item.blocked).map(item => <option key={item.id} value={item.id}>{item.full_name || "Sem nome"}{item.city ? ` · ${item.city}` : ""}</option>)}</select></label>
                    <label>Plano<select name="plan_id" defaultValue={editingCouponId ? coupons.find(item => item.id === editingCouponId)?.plan_id ?? "" : ""}><option value="">Qualquer plano pago</option>{plans.filter(item => item.active && item.billing_period !== "free").map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
                    <label>Tipo de desconto<select name="discount_type" defaultValue={editingCouponId ? coupons.find(item => item.id === editingCouponId)?.discount_type ?? "percent" : "percent"}><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></label>
                    <label>Desconto<input name="discount_value" type="number" min="0.01" step="0.01" defaultValue={editingCouponId ? (coupons.find(item => item.id === editingCouponId)?.discount_type === "fixed" ? ((coupons.find(item => item.id === editingCouponId)?.discount_value ?? 0) / 100).toFixed(2) : coupons.find(item => item.id === editingCouponId)?.discount_value ?? "") : ""} placeholder="Ex.: 20" required /></label>
                    <label>Validade<input name="expires_at" type="date" defaultValue={editingCouponId && coupons.find(item => item.id === editingCouponId)?.expires_at ? new Date(coupons.find(item => item.id === editingCouponId)!.expires_at!).toISOString().slice(0,10) : ""} /></label>
                    <div className="admin-plan-checks"><label><input name="active" type="checkbox" defaultChecked={editingCouponId ? Boolean(coupons.find(item => item.id === editingCouponId)?.active) : true} /> Cupom ativo</label></div>
                    <div className="admin-item-actions"><button type="submit" className="admin-action-button" disabled={couponSaving}>{couponSaving ? "Salvando..." : editingCouponId ? "Salvar cupom" : "Criar cupom"}</button>{editingCouponId && <button type="button" className="admin-action-button" onClick={() => setEditingCouponId(null)}>Cancelar edição</button>}</div>{!editingCouponId && <p className="admin-text" style={{ margin: "8px 0 0" }}>Depois de criar o cupom, envie-o manualmente pelo botão “Enviar cupom”.</p>}
                  </form>

                  {couponMessage && <div className="admin-category-message">{couponMessage}</div>}
                  <div className="admin-admin-toolbar"><input value={couponSearch} onChange={e => setCouponSearch(e.target.value)} placeholder="Buscar código ou usuário..." aria-label="Buscar cupons" /><span className="admin-filter-count">{coupons.filter(item => { const userName = users.find(u => u.id === item.assigned_user_id)?.full_name || ""; return `${item.code} ${userName}`.toLocaleLowerCase("pt-BR").includes(couponSearch.trim().toLocaleLowerCase("pt-BR")); }).length} cupom(ns)</span></div>
                  <div className="admin-list">
                    {coupons.filter(item => { const userName = users.find(u => u.id === item.assigned_user_id)?.full_name || ""; return `${item.code} ${userName}`.toLocaleLowerCase("pt-BR").includes(couponSearch.trim().toLocaleLowerCase("pt-BR")); }).map(item => {
                      const assigned = users.find(u => u.id === item.assigned_user_id);
                      const plan = plans.find(p => p.id === item.plan_id);
                      const status = item.used_at ? "Utilizado" : !item.active ? "Desativado" : item.expires_at && new Date(item.expires_at).getTime() < Date.now() ? "Expirado" : item.claimed_at ? "Resgatado — aguardando pagamento" : "Disponível";
                      return <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.code}</strong><span>{assigned?.full_name || "Usuário"} · {item.discount_type === "percent" ? item.discount_value + "%" : "R$ " + (item.discount_value/100).toFixed(2).replace(".",",")} de desconto{plan ? " · " + plan.name : " · qualquer plano pago"}</span><span>Status: {status}{item.claimed_at ? " · resgatado em " + new Date(item.claimed_at).toLocaleString("pt-BR") : ""}{item.used_at ? " · usado em " + new Date(item.used_at).toLocaleString("pt-BR") : ""}</span></div><div className="admin-item-actions"><button type="button" className="admin-action-button" onClick={() => void sendCoupon(item.id)} disabled={Boolean(item.used_at) || !item.active || couponSaving}>Enviar cupom</button><button type="button" className="admin-action-button" onClick={() => setEditingCouponId(item.id)} disabled={Boolean(item.used_at) || couponSaving}>Editar</button><button type="button" className="admin-category-delete" onClick={() => void removeCoupon(item.id)} disabled={couponSaving}>Remover</button></div></div></article>;
                    })}
                    {coupons.length === 0 && <div className="admin-empty">Nenhum cupom cadastrado.</div>}
                  </div>
                </div>
              ) : section === "notifications" ? (
                <div className="admin-admin-center">
                  <section className="admin-admin-center-hero"><div><div className="admin-badge">CENTRAL ADMINISTRATIVA</div><h2>Notificações administrativas</h2><p>Eventos importantes da operação ficam registrados aqui até você marcar como lidos.</p></div><strong>{unreadAdminNotifications} não lida(s)</strong></section>
                  <div className="admin-admin-center-actions"><button type="button" className="admin-action-button" onClick={markAllAdminNotificationsRead} disabled={!unreadAdminNotifications}>Marcar todas como lidas</button></div>
                  <div className="admin-admin-notification-list">{adminNotifications.length===0 ? <div className="admin-empty">Nenhuma notificação administrativa registrada.</div> : adminNotifications.map(item=><article className={`admin-admin-notification ${item.read_at ? "read" : "unread"}`} key={item.id}><div><span>{item.type.replaceAll("_"," ").toUpperCase()}</span><h3>{item.title}</h3><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString("pt-BR")}</small></div><div className="admin-item-actions">{!item.read_at&&<button type="button" className="admin-action-button" onClick={()=>markAdminNotificationRead(item.id)}>Marcar como lida</button>}{item.link&&<button type="button" className="admin-action-button" onClick={()=>{const target=item.link!;const url=new URL(target,window.location.origin);setSection((url.searchParams.get("section") as typeof section)||"dashboard");window.history.replaceState(null,"",target);void markAdminNotificationRead(item.id);}}>Abrir</button>}</div></article>)}</div>
                </div>
              ) : section === "activity" ? (
                <div className="admin-admin-center">
                  <section className="admin-admin-center-hero"><div><div className="admin-badge">AUDITORIA</div><h2>Atividade administrativa</h2><p>Histórico das ações executadas dentro do painel administrativo.</p></div><strong className="admin-filter-count">{auditLogs.length} registro(s)</strong></section>
                  <div className="admin-admin-toolbar"><input value={activitySearch} onChange={e=>setActivitySearch(e.target.value)} placeholder="Buscar ação, administrador ou item..." aria-label="Buscar atividade administrativa" /><select value={activityActionFilter} onChange={e=>setActivityActionFilter(e.target.value)} aria-label="Filtrar ação"><option value="all">Todas as ações</option>{Array.from(new Set(auditLogs.map(item=>item.action))).map(action=><option key={action} value={action}>{auditActionLabel(action)}</option>)}</select></div>
                  <div className="admin-admin-notification-list">{auditLogs.filter(item=>{const q=activitySearch.trim().toLocaleLowerCase("pt-BR");const hay=[item.action,auditActionLabel(item.action),item.entity_type,auditEntityLabel(item.entity_type),item.entity_name??"",item.admin_name??"",...Object.entries(item.details??{}).map(([key,value])=>key+" "+auditDetailLabel(key,value))].join(" ").toLocaleLowerCase("pt-BR");return(!q||hay.includes(q))&&(activityActionFilter==="all"||item.action===activityActionFilter)}).map(item=><article className="admin-admin-notification read" key={item.id}>
                    <div>
                      <span>{auditActionLabel(item.action)}</span>
                      <h3>{item.entity_name || auditEntityLabel(item.entity_type)}</h3>
                      <p>Administrador: {item.admin_name || "Administrador"}</p>
                      <small>{new Date(item.created_at).toLocaleString("pt-BR")}</small>
                    </div>
                    <div className="admin-audit-details">
                      {Object.entries(item.details ?? {}).map(([key,value]) => (
                        <span key={key}><strong>{key === "status" ? "Status" : key === "discount" ? "Desconto" : key === "assigned_user" ? "Usuário vinculado" : key === "plan" ? "Plano" : auditDetailLabel(key,null)}</strong>: {auditDetailLabel(key,value)}</span>
                      ))}
                    </div>
                  </article>)}</div>
                  {auditLogs.length===0&&<div className="admin-empty">Nenhuma ação administrativa registrada ainda.</div>}
                </div>
              ) : section === "commercial" ? <div className="admin-commercial-grid">
                {plans.map(plan => <article className="admin-commercial-card" key={plan.id}>
                  <div className="admin-commercial-card-head"><span>{plan.billing_period === "free" ? "PLANO GRATUITO" : "PLANO PAGO"}</span><button type="button" className="admin-action-button" onClick={() => setEditingPlanId(editingPlanId === plan.id ? null : plan.id)}>{editingPlanId === plan.id ? "Fechar" : "Editar plano"}</button></div>
                  {editingPlanId === plan.id ? (
                    <form className="admin-plan-editor" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const rawPrice = String(form.get("price_cents") || "0").replace(",", "."); updatePlan(plan.id, { name: String(form.get("name") || "").trim(), slug: String(form.get("slug") || "").trim(), description: String(form.get("description") || "").trim(), price_cents: Math.max(0, Math.round(Number(rawPrice) * 100)), billing_period: String(form.get("billing_period") || "monthly"), highlighted: form.get("highlighted") === "on", active: form.get("active") === "on" }); }}>
                      <label>Nome<input name="name" defaultValue={plan.name} required /></label>
                      <label>Slug<input name="slug" defaultValue={plan.slug} required /></label>
                      <label>Descrição<textarea name="description" defaultValue={plan.description ?? ""} rows={3} /></label>
                      <label>Preço mensal (R$)<input name="price_cents" type="number" min="0" step="0.01" defaultValue={(plan.price_cents / 100).toFixed(2)} /></label>
                      <label>Periodicidade<select name="billing_period" defaultValue={plan.billing_period}><option value="free">Grátis</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label>
                      <div className="admin-plan-checks"><label><input name="highlighted" type="checkbox" defaultChecked={plan.highlighted} /> Destacar plano</label><label><input name="active" type="checkbox" defaultChecked={plan.active} /> Plano ativo</label></div>
                      <button type="submit" className="admin-action-button" disabled={planSavingId === plan.id}>{planSavingId === plan.id ? "Salvando..." : "Salvar alterações"}</button>
                    </form>
                  ) : (
                    <div className="admin-plan-summary"><h2>{plan.name}</h2><strong>{plan.price_cents === 0 ? "R$ 0,00" : `R$ ${(plan.price_cents/100).toFixed(2).replace(".",",")}/mês`}</strong><p>{plan.description || (plan.active ? "Plano disponível para fornecedores." : "Plano atualmente desativado.")}</p><div className="admin-plan-meta"><span>{plan.active ? "Ativo" : "Inativo"}</span>{plan.highlighted && <span>Destacado</span>}</div>
                  </div>)}
                </article>)}
                <section className="admin-commercial-subscriptions">
                  <div className="admin-badge">ATIVAÇÃO MANUAL</div>
                  <h2>Ativar plano após pagamento</h2>
                  <p className="admin-text">Confirme o pagamento pelo WhatsApp antes de selecionar o fornecedor e ativar o plano.</p>
                  <div className="admin-commercial-activation">
                    {businesses.map((business) => (
                      <div className="admin-list-item" key={business.id}>
                        <div className="admin-item-main"><div><strong>{business.business_name}</strong><span>{business.city || "Localização não informada"}{business.state ? " - " + business.state : ""} · {business.approval_status === "approved" ? "Aprovado" : business.approval_status === "rejected" ? "Rejeitado" : "Aguardando análise"} · {business.active ? "Ativo" : "Inativo"}</span></div>
                          <div className="admin-item-actions">
                            <select aria-label={`Plano para ${business.business_name}`}  value={activationPlanByBusiness[business.id] ?? ""} onChange={(event) => setActivationPlanByBusiness((current) => ({ ...current, [business.id]: event.target.value }))}>
                              <option value="">Escolha um plano pago</option>
                              {plans.filter((plan) => plan.billing_period !== "free" && plan.active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · R$ {(plan.price_cents / 100).toFixed(2).replace(".", ",")}</option>)}
                            </select>
                            <button type="button" className="admin-action-button" disabled={!activationPlanByBusiness[business.id] || activatingBusinessId === business.id} onClick={() => activateSubscription(business.id, activationPlanByBusiness[business.id])}>{activatingBusinessId === business.id ? "Ativando..." : "Confirmar ativação"}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="admin-subscriptions-section">
                    <div className="admin-badge">ASSINATURAS</div><h2>Fornecedores com plano</h2>
                    {subscriptions.length === 0 ? <p className="admin-text">Nenhuma assinatura ativa ou registrada.</p> : subscriptions.map(item => <div className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.business?.business_name || "Fornecedor"}</strong><span>{item.plan?.name || "Plano"} · {item.status}{item.ends_at ? ` · até ${new Date(item.ends_at).toLocaleDateString("pt-BR")}` : ""}</span></div></div></div>)}
                  </div>
                </section>
              </div>
              : section === "categories" ? <div>
                <div className="admin-category-toolbar">
                  <div><strong>Categorias cadastradas</strong><span>Adicione novas categorias e remova categorias que não serão mais utilizadas.</span></div>
                  <button type="button" className="admin-primary-button" onClick={() => { setShowCreateCategory((value) => !value); setCategoryMessage(""); }}>
                    {showCreateCategory ? "Fechar" : "Nova categoria"}
                  </button>
                </div>
                {showCreateCategory && (
                  <form className="admin-category-create" onSubmit={createCategory}>
                    <label><span>Nome da categoria</span><input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Ex.: Cerimonial e Assessoria" maxLength={80} required /></label>
                    <button type="submit" className="admin-primary-button" disabled={categorySaving}>{categorySaving ? "Adicionando..." : "Adicionar categoria"}</button>
                  </form>
                )}
                {categoryMessage && <div className="admin-category-message">{categoryMessage}</div>}
                <div className="admin-filters admin-simple-filter">
                  <input value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Buscar categoria..." aria-label="Buscar categorias" />
                  <span className="admin-filter-count">{categories.filter(item => `${item.name} ${item.slug}`.toLocaleLowerCase("pt-BR").includes(categorySearch.trim().toLocaleLowerCase("pt-BR"))).length} resultado(s)</span>
                </div>
                <div className="admin-list">
                  {categories.filter(item => `${item.name} ${item.slug}`.toLocaleLowerCase("pt-BR").includes(categorySearch.trim().toLocaleLowerCase("pt-BR"))).map(item => (
                    <article className="admin-list-item" key={item.id}>
                      <div className="admin-item-main">
                        <div>
                          <strong>{item.name}</strong>
                          <span className={item.active ? "admin-category-status admin-category-status-active" : "admin-category-status admin-category-status-inactive"}>{item.active ? "Ativado" : "Desativada"}</span>
                        </div>
                        <div className="admin-item-actions">
                          <button type="button" className="admin-action-button" onClick={async () => {
                            const next = !item.active;
                            const { error } = await supabase.from("categories").update({ active: next }).eq("id", item.id);
                            if (!error) setCategories(current => current.map(x => x.id === item.id ? { ...x, active: next } : x));
                          }}>{item.active ? "Desativar" : "Ativar"}</button>
                          <button type="button" className="admin-category-delete" onClick={() => deleteCategory(item.id, item.name)}>Remover</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
               : section === "services" ? <div className="admin-inline-list"><div className="admin-filters admin-simple-filter"><input value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} placeholder="Buscar serviço ou fornecedor..." aria-label="Buscar serviços" /><span className="admin-filter-count">{services.filter(item => `${item.name} ${item.business?.business_name ?? ""} ${item.category?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(serviceSearch.trim().toLocaleLowerCase("pt-BR"))).length} resultado(s)</span></div><div className="admin-list">{services.filter(item => `${item.name} ${item.business?.business_name ?? ""} ${item.category?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(serviceSearch.trim().toLocaleLowerCase("pt-BR"))).map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{item.name}</strong><span>{item.business?.business_name || "Empresa não informada"} · {item.category?.name || "Sem categoria"} · {item.active ? "Ativo" : "Inativo"}</span></div><div className="admin-item-actions"><button className="admin-action-button" onClick={async()=>{const next=!item.active;const {error}=await supabase.from("services").update({active:next}).eq("id",item.id);if(!error)setServices(cur=>cur.map(x=>x.id===item.id?{...x,active:next}:x));}}>{item.active ? "Desativar" : "Ativar"}</button></div></div></article>)}</div></div>
              : <div><div className="admin-filters admin-simple-filter"><input value={reviewSearch} onChange={(e) => setReviewSearch(e.target.value)} placeholder="Buscar avaliação, fornecedor ou autor..." aria-label="Buscar avaliações" /><span className="admin-filter-count">{reviews.filter(item => `${item.comment ?? ""} ${item.business?.business_name ?? ""} ${item.reviewer?.full_name ?? ""}`.toLocaleLowerCase("pt-BR").includes(reviewSearch.trim().toLocaleLowerCase("pt-BR"))).length} resultado(s)</span></div><div className="admin-list">{reviews.filter(item => `${item.comment ?? ""} ${item.business?.business_name ?? ""} ${item.reviewer?.full_name ?? ""}`.toLocaleLowerCase("pt-BR").includes(reviewSearch.trim().toLocaleLowerCase("pt-BR"))).map(item => <article className="admin-list-item" key={item.id}><div className="admin-item-main"><div><strong>{"★".repeat(item.rating)} · {item.business?.business_name || "Empresa"}</strong><span>{item.reviewer?.full_name || "Usuário"} · {item.comment || "Sem comentário"} · {item.active ? "Visível" : "Oculta"}</span></div><div className="admin-item-actions"><button className="admin-action-button" onClick={()=>updateReview(item.id,{active:!item.active})}>{item.active ? "Ocultar" : "Publicar"}</button><button className="admin-action-button" onClick={()=>deleteReview(item.id)}>Excluir</button></div></div></article>)}</div></div>}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}