import { useEffect, useRef, useState } from 'react';
import { chatAction, type ChatMessage } from '../lib/losi-chat';

type Results = { messages: ChatMessage[]; hasMore: boolean };
function SearchIcon({ name }: { name: 'up'|'down'|'close' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={name === 'up' ? 'm6 15 6-6 6 6' : name === 'down' ? 'm6 9 6 6 6-6' : 'm6 6 12 12 M18 6 6 18'} /></svg>;
}
export function LosiChatSearch({ threadId, group, onSelect, onClose }: { threadId: string; group: boolean; onSelect: (m: ChatMessage)=>void; onClose: ()=>void }) {
  const [query, setQuery] = useState(''), [results, setResults] = useState<ChatMessage[]>([]);
  const [index, setIndex] = useState(0), [more, setMore] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const version = useRef(0), select = useRef(onSelect), input = useRef<HTMLInputElement>(null);
  select.current = onSelect;
  useEffect(()=>{input.current?.focus();},[]);
  useEffect(()=>{
    const current = ++version.current;
    setResults([]); setIndex(0); setMore(false); setError('');
    if (!query.trim()) { setBusy(false); return; }
    setBusy(true);
    const timer = setTimeout(()=>{
      void chatAction<Results>('search-messages', {threadId, group, query:query.trim()}).then(data=>{
        if (version.current!==current) return;
        setResults(data.messages); setMore(data.hasMore);
        if (data.messages[0]) select.current(data.messages[0]);
      }).catch(e=>{if(version.current===current)setError(e instanceof Error?e.message:'Não foi possível buscar. Tente novamente.');})
        .finally(()=>{if(version.current===current)setBusy(false);});
    },350);
    return ()=>{clearTimeout(timer);version.current++;};
  },[query,threadId,group,revision]);
  async function next() {
    if (busy) return;
    if (index+1<results.length) { setIndex(index+1); select.current(results[index+1]); return; }
    const last=results.at(-1); if (!more||!last) return;
    const current=version.current;setBusy(true);setError('');
    try {
      const data=await chatAction<Results>('search-messages',{threadId,group,query:query.trim(),before:{at:last.created_at,id:last.id}});
      if(version.current!==current)return;
      setMore(data.hasMore);setResults(old=>[...old,...data.messages]);
      if(data.messages[0]) { setIndex(results.length);select.current(data.messages[0]); }
    } catch(e) { if(version.current===current)setError(e instanceof Error?e.message:'Não foi possível carregar mais resultados.'); }
    finally {if(version.current===current)setBusy(false);}
  }
  return <section className="lc-conversation-search" aria-label="Busca nesta conversa" onKeyDown={e=>{if(e.key==='Escape')onClose();}}>
    <div className="lc-conversation-search-controls"><input ref={input} type="text" inputMode="search" enterKeyHint="search" maxLength={120} value={query} onChange={e=>{setQuery(e.target.value);setBusy(Boolean(e.target.value.trim()));}} aria-label="Buscar texto ou nome de arquivo nesta conversa" placeholder="Buscar nesta conversa"/>
      <span className="lc-search-count" aria-label={results.length?`Resultado ${index+1} de ${results.length}${more?', há mais resultados':''}`:'Sem resultados'}>{results.length?`${index+1}/${results.length}${more?'+':''}`:'0/0'}</span>
      <button type="button" disabled={busy||index===0} aria-label="Resultado mais recente" onClick={()=>{setIndex(index-1);select.current(results[index-1]);}}><SearchIcon name="up"/></button>
      <button type="button" disabled={busy||!results.length||(index+1===results.length&&!more)} aria-label="Resultado mais antigo" onClick={()=>void next()}><SearchIcon name="down"/></button>
      <button type="button" className="lc-search-close" aria-label="Fechar busca" onPointerDown={e=>e.preventDefault()} onPointerUp={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();onClose();}} onClick={e=>{e.stopPropagation();onClose();}}><SearchIcon name="close"/></button>
    </div>
    <p role="status">{busy?'Buscando…':error||(!query.trim()?'Busque mensagens e nomes de arquivos.':!results.length?'Nenhuma mensagem encontrada.':'Use as setas para percorrer os resultados.')}{error&&<button type="button" onClick={()=>setRevision(r=>r+1)}>Tentar novamente</button>}</p>
  </section>;
}
