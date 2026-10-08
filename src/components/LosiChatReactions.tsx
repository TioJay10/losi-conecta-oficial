import {useEffect,useRef,useState} from 'react';
import type {ChatMessage} from '../lib/losi-chat';
import {reactionEmojis,reactionLabel,setMessageReaction} from '../lib/losi-chat-reactions';
import '../losi-chat-reactions.css';

export function LosiChatReactionPicker({message,busy,onReact}:{message:ChatMessage;busy:boolean;onReact:(emoji:string|null)=>void}){
 const [expanded,setExpanded]=useState(false),[search,setSearch]=useState('');
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(expanded)input.current?.focus({preventScroll:true});},[expanded]);
 const normalized=search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const emojis=reactionEmojis.filter(([emoji,label])=>`${emoji} ${label}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').includes(normalized));
 function option([emoji,label]:typeof reactionEmojis[number]){const mine=message.reactions?.some(r=>r.emoji===emoji&&r.mine);return <button type="button" key={emoji} className="lc-emoji-button" aria-label={`${label}${mine?' — remover minha reação':''}`} title={label} aria-pressed={Boolean(mine)} disabled={busy} onClick={()=>onReact(mine?null:emoji)}><span aria-hidden="true">{emoji}</span></button>;}
 return <div className="lc-reaction-picker" aria-label="Reagir à mensagem">
  <div className="lc-reaction-quick">{reactionEmojis.slice(0,6).map(option)}<button type="button" className="lc-emoji-button lc-emoji-more" aria-label={expanded?'Fechar lista de emojis':'Mais emojis'} aria-expanded={expanded} disabled={busy} onClick={()=>setExpanded(e=>!e)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={expanded?'m6 6 12 12M6 18 18 6':'M12 5v14M5 12h14'}/></svg></button></div>
  {expanded&&<div className="lc-reaction-expanded"><label className="lc-emoji-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input ref={input} type="search" placeholder="Pesquisar reação" aria-label="Pesquisar reação" value={search} onChange={e=>setSearch(e.target.value)} maxLength={60}/></label><p>Negócios, trabalho e eventos</p><div className="lc-reaction-grid">{emojis.map(option)}</div>{!emojis.length&&<p role="status">Nenhuma reação encontrada.</p>}</div>}
 </div>;
}

export function LosiChatReactions({message}:{message:ChatMessage}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 if(message.deleted_at||!message.reactions?.length)return null;
 async function react(emoji:string|null){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await setMessageReaction(message.id,emoji);}catch(e){setError(e instanceof Error?e.message:'Não foi possível reagir. Tente novamente.');}finally{lock.current=false;setBusy(false);}}
 return <div className="lc-reaction-summary" aria-label="Reações da mensagem">{message.reactions.map(r=><button type="button" key={r.emoji} className="lc-reaction-count" aria-label={`${reactionLabel(r.emoji)}: ${r.count} ${r.count===1?'reação':'reações'}${r.mine?'. Remover minha reação':'. Reagir também'}`} aria-pressed={r.mine} disabled={busy} onClick={()=>void react(r.mine?null:r.emoji)}><span aria-hidden="true">{r.emoji}</span><span>{r.count}</span></button>)}{error&&<p role="alert">{error}</p>}</div>;
}
