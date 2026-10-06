import { useId, useRef, useState } from "react";
import "../calendar-notifications.css";

export type CalendarNotification = { id: string; title: string; message: string; created_at: string; read_at: string | null };
type Props = { notifications: CalendarNotification[]; request: (body: Record<string, string>) => Promise<{ read_at?: string }>; onChange: (items: CalendarNotification[]) => void };
function Icon({ kind }: { kind: "trash" | "check" | "chevron" }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "trash" ? <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></> : kind === "check" ? <path d="m4 12 5 5L20 6" /> : <path d="m6 9 6 6 6-6" />}</svg>;
}
export function CalendarNotifications({ notifications, request, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const regionId = useId();
  const unread = notifications.filter(n => !n.read_at).length;
  async function act(action: string, id?: string) {
    if (lock.current) return;
    if (action === "deleteAllNotifications" && !window.confirm("Excluir todas as suas notificações? Esta ação não pode ser desfeita.")) return;
    if (action === "deleteNotification" && !window.confirm("Excluir esta notificação?")) return;
    lock.current = true; setBusy(id || action); setError(""); setFeedback("");
    try {
      const result = await request({ action, ...(id ? { notificationId: id } : {}) });
      if (action === "deleteAllNotifications") onChange([]);
      else if (action === "deleteNotification") onChange(notifications.filter(n => n.id !== id));
      else onChange(notifications.map(n => (!id || n.id === id) && !n.read_at ? { ...n, read_at: result.read_at || new Date().toISOString() } : n));
      setFeedback(action.startsWith("delete") ? "Notificações excluídas." : "Notificações marcadas como lidas.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar suas notificações. Tente novamente."); }
    finally { lock.current = false; setBusy(""); }
  }
  return <section className="calendar-notifications calendar-inbox">
    <div className="calendar-inbox-heading"><div><h2>Notificações</h2><p>Atualizações sobre suas candidaturas e escalas.</p><span className="calendar-inbox-count">{unread ? `${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Tudo em dia"}</span></div>
      <button type="button" className="calendar-inbox-toggle" aria-expanded={expanded} aria-controls={regionId} onClick={() => setExpanded(!expanded)}><span>{expanded ? "Recolher" : "Ver notificações"}</span><span className={expanded ? "expanded" : ""}><Icon kind="chevron" /></span></button>
    </div>
    <div id={regionId} hidden={!expanded}>
      <div className="calendar-inbox-actions"><button type="button" disabled={!!busy || !unread} onClick={() => void act("readAllNotifications")}><Icon kind="check" /><span>Marcar todas como lidas</span></button><button type="button" className="calendar-inbox-danger" disabled={!!busy || !notifications.length} onClick={() => void act("deleteAllNotifications")}><Icon kind="trash" /><span>Excluir todas</span></button></div>
      <div role="status" className="calendar-inbox-feedback">{busy ? "Atualizando notificações…" : feedback}</div>
      {error && <p role="alert" className="calendar-inbox-error">{error}</p>}
      {notifications.length ? <ul className="calendar-inbox-list">{notifications.map(n => <li key={n.id} className={n.read_at ? "read" : "unread"}>
        <div className="calendar-inbox-content"><strong>{n.title}</strong><p>{n.message}</p><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString("pt-BR")}</time><small>{n.read_at ? "Lida" : "Não lida"}</small></div>
        <div className="calendar-inbox-row-actions">{!n.read_at && <button type="button" disabled={!!busy} title="Marcar como lida" aria-label={`Marcar como lida: ${n.title}`} onClick={() => void act("readNotification", n.id)}><Icon kind="check" /></button>}<button type="button" disabled={!!busy} className="calendar-inbox-danger" title="Excluir notificação" aria-label={`Excluir notificação: ${n.title}`} onClick={() => void act("deleteNotification", n.id)}><Icon kind="trash" /></button></div>
      </li>)}</ul> : <div className="calendar-empty-state"><strong>Nenhuma notificação.</strong><span>Novas atualizações aparecerão aqui.</span></div>}
    </div>
  </section>;
}
