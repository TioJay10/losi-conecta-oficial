import { useEffect, useRef, useState } from 'react';
import { chatAction, type ChatMessage } from '../lib/losi-chat';
import {LosiChatReactionPicker} from './LosiChatReactions';
import {setMessageReaction} from '../lib/losi-chat-reactions';
import { LosiChatActionIcon } from './LosiChatActionIcon';

/** The same actions are opened by the desktop chevron and mobile long press. */
export function LosiChatMessageMenu({ message, own, open, onOpen, onClose, onReply, onDeleted }: {
  message: ChatMessage; own: boolean; open: boolean; onOpen: () => void; onClose: () => void;
  onReply?: () => void; onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [error, setError] = useState('');
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      if (menu.current?.contains(event.target) || trigger.current?.contains(event.target)) return;
      onClose();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    // Capture also sees touches on controls that stop event propagation.
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('touchstart', outside, { capture: true, passive: true });
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('touchstart', outside, true);
      document.removeEventListener('keydown', escape);
    };
  }, [open, onClose]);
  useEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const node = menu.current;
    
    function position() {
      if (!trigger.current) return;
      const visibleTrigger=trigger.current.getBoundingClientRect();
      const anchor=visibleTrigger.width?visibleTrigger:(trigger.current.closest('.lc-bubble,.lc-sent-attachment,.lc-message-text')??trigger.current).getBoundingClientRect();
      const viewport=window.visualViewport;
      const width=viewport?.width??window.innerWidth,height=viewport?.height??window.innerHeight;
      const x=viewport?.offsetLeft??0,y=viewport?.offsetTop??0;
      node.style.maxHeight=`${Math.max(100,height-24)}px`;
      const bounds = node.getBoundingClientRect();
      const margin = 12;
      const left = Math.max(x+margin, Math.min(anchor.right - bounds.width, x+width - bounds.width - margin));
      const below = anchor.bottom + 4;
      const top = below + bounds.height <= y+height - margin ? below : anchor.top - bounds.height - 4;
      node.style.left = `${left}px`;
      node.style.top = `${Math.max(y+margin, Math.min(top, y+height - bounds.height - margin))}px`;
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(node);
    function scroll(event: Event) {
      // Scrolling the menu itself must not dismiss its actions.
      
      if (event.target instanceof Node && node.contains(event.target)) return;
      onClose();
    }
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize',position);
    window.visualViewport?.addEventListener('scroll',position);
    window.addEventListener('scroll', scroll, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize',position);
      window.visualViewport?.removeEventListener('scroll',position);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open, onClose]);
  useEffect(() => {
    if (!open) { setConfirm(false); return; }
    menu.current?.querySelector<HTMLButtonElement>(confirm ? '.lc-media-confirm button:not(:disabled)' : '.lc-reaction-quick button:not(:disabled)')?.focus({ preventScroll: true });
  }, [open, confirm]);
  async function react(emoji:string|null){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await setMessageReaction(message.id,emoji);onClose();}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível reagir. Tente novamente.');}
    finally{lock.current=false;setBusy(false);}
  }
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
    {!message.deleted_at && <button ref={trigger} type="button" className="lc-message-menu-trigger" aria-label="Opções da mensagem" aria-expanded={open}
      onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); if (open) onClose(); else onOpen(); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>}
    <div ref={menu} className="lc-media-menu" hidden={!open} aria-label="Opções da mensagem"
      onPointerDown={e => e.stopPropagation()}>
      <div hidden={confirm}>{open&&!message.deleted_at&&<LosiChatReactionPicker message={message} busy={busy} onReact={emoji=>void react(emoji)}/>}</div>
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
      {error && <p className="lc-message-action-error" role="alert">{error}</p>}
    </div>
  </>;
}
