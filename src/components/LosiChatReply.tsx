import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../lib/losi-chat';

const mediaLabels = { audio: 'Mensagem de áudio', image: 'Imagem', video: 'Vídeo', document: 'Documento' };
export function replyText(message: ChatMessage) {
  return message.body?.trim().slice(0, 240) || (message.attachment ? mediaLabels[message.attachment.kind] : 'Mensagem');
}
export function LosiChatQuote({ message }: { message: ChatMessage }) {
  if (!message.reply_to) return null;
  const quote = message.reply;
  return <div className="lc-quote"><strong>{quote?.unavailable || !quote ? 'Mensagem indisponível' : quote.name}</strong>{quote && !quote.unavailable && <p>{quote.text || (quote.kind ? mediaLabels[quote.kind] : 'Mensagem')}</p>}</div>;
}
export function LosiChatText({ message, onReply }: { message: ChatMessage; onReply: () => void }) {
  const [menu, setMenu] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef({ x: 0, y: 0 });
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => () => cancel(), []);
  useEffect(() => {
    if (!menu) return;
    area.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = (e: PointerEvent) => { if (!area.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  return <div ref={area} className="lc-message-text" tabIndex={0} aria-label="Mensagem. Segure ou abra o menu de contexto para responder."
    onPointerDown={e => { if (e.button !== 0 || menu) return; cancel(); origin.current = { x: e.clientX, y: e.clientY }; timer.current = setTimeout(() => setMenu(true), 500); }}
    onPointerMove={e => { if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 12) cancel(); }}
    onPointerUp={cancel} onPointerCancel={cancel}
    onContextMenu={e => { e.preventDefault(); cancel(); setMenu(true); }}
    onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'Escape') { setMenu(false); area.current?.focus(); } else if (e.key === 'ContextMenu' || e.key === 'Enter' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); setMenu(true); } }}>
    {message.body}
    {menu && <div className="lc-media-menu" aria-label="Opções da mensagem"><button type="button" onClick={() => { setMenu(false); onReply(); }}>Responder</button><button type="button" onClick={() => { setMenu(false); area.current?.focus(); }}>Fechar</button></div>}
  </div>;
}
