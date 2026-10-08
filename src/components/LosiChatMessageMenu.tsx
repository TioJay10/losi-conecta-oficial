import { useEffect, useRef, useState } from 'react';
import { chatAction, type ChatMessage } from '../lib/losi-chat';
import { LosiChatActionIcon } from './LosiChatActionIcon';

/** The same actions are opened by the desktop chevron and mobile long press. */
export function LosiChatMessageMenu({ message, own, open, onOpen, onClose, onReply, onDeleted }: {
  message: ChatMessage; own: boolean; open: boolean; onOpen: () => void; onClose: () => void;
  onReply?: () => void; onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [error, setError] = useState('');
  const menu = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!open) { setConfirm(false); return; }
    menu.current?.querySelector<HTMLButtonElement>(confirm ? '.lc-media-confirm button:not(:disabled)' : '.lc-media-actions button:not(:disabled)')?.focus({ preventScroll: true });
  }, [open, confirm]);
  async function remove(everyone: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await chatAction('delete-media', { messageId: message.id, everyone }); onClose(); onDeleted(message.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível excluir. Tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function download() {
    if (lock.current || !message.attachment) return;
    lock.current = true; setBusy(true); setError('');
    try { const data = await chatAction<{ url: string }>('media-url', { messageId: message.id, download: true }); onClose(); window.location.assign(data.url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível baixar. Tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    {!message.deleted_at && <button type="button" className="lc-message-menu-trigger" aria-label="Opções da mensagem" aria-expanded={open}
      onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (open) onClose(); else onOpen(); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>}
    <div ref={menu} className="lc-media-menu" hidden={!open} aria-label="Opções da mensagem"
      onPointerDown={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div className="lc-media-actions" hidden={confirm}>
        {onReply && <button type="button" disabled={busy} onClick={() => { onClose(); onReply(); }}><LosiChatActionIcon name="reply"/><span>Responder</span></button>}
        {message.attachment && <button type="button" disabled={busy} onClick={() => void download()}><LosiChatActionIcon name="download"/><span>Baixar arquivo</span></button>}
        <button type="button" disabled={busy} onClick={() => void remove(false)}><LosiChatActionIcon name="trash"/><span>Excluir só pra mim</span></button>
        {own && <button type="button" disabled={busy} onClick={() => setConfirm(true)}><LosiChatActionIcon name="trash"/><span>Excluir para todos</span></button>}
        <button type="button" onClick={onClose}><LosiChatActionIcon name="close"/><span>Fechar</span></button>
      </div>
      <div className="lc-media-confirm" hidden={!confirm}>
        <p>Excluir esta mensagem para todos?</p>
        <button type="button" disabled={busy} onClick={() => void remove(true)}><LosiChatActionIcon name="trash"/><span>Confirmar exclusão</span></button>
        <button type="button" disabled={busy} onClick={() => setConfirm(false)}><LosiChatActionIcon name="back"/><span>Voltar</span></button>
        <button type="button" onClick={onClose}><LosiChatActionIcon name="close"/><span>Fechar</span></button>
      </div>
    </div>
    {error && <p className="lc-message-action-error" role="status">{error}</p>}
  </>;
}
