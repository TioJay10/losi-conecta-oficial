import { useCallback, useEffect, useRef, useState } from "react";
import { chatAction, formatLosiNumber, useLosiChatAccount, type ChatMessage, type ChatThread } from "../lib/losi-chat";
import { LosiChatGroupCreate, LosiChatGroupDetails } from "./LosiChatGroups";
import { LosiChatNumberPurchase } from "./LosiChatNumberPurchase";
import { LosiChatComposer, LosiChatAttachment } from "./LosiChatAttachments";
import "../chat-losi.css";

const icons = {
 chat:"M4 3h16a1 1 0 0 1 1 1v13H8l-5 4V4a1 1 0 0 1 1-1Z M7 8h10 M7 12h7",
 search:"M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15 m5.5-2 5 5",
 plus:"M12 4v16 M4 12h16",more:"M5 12h.01 M12 12h.01 M19 12h.01",
 camera:"M3 7h4l2-3h6l2 3h4v13H3Z M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
 back:"m15 5-7 7 7 7",send:"m3 3 18 9-18 9 4-9Z M7 12h14",
 attach:"m9 15 7-7a3 3 0 0 0-4-4L4 12a5 5 0 0 0 7 7l9-9",
 file:"M5 3h9l5 5v13H5Z M14 3v5h5 M8 12h8 M8 16h6",
 users:"M2 21v-3a5 5 0 0 1 10 0v3 M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M16 4a4 4 0 0 1 0 8 M16 15a5 5 0 0 1 5 5v1",
 wallet:"M3 6h18v14H3Z M3 6l15-3v3 M16 12h5v5h-5Z",
 profile:"M4 21v-2a8 8 0 0 1 16 0v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
 archive:"M3 3h18v5H3Z M5 8v13h14V8 M9 12h6",
 check:"m2 12 5 5 10-11 M12 17l10-11",pin:"m8 3 8 0-1 6 4 5H5l4-5Z M12 14v7",
 star:"m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.3L12 17.3l-5.6 3 1-6.3L3 9.6l6.2-.9Z",
 home:"m3 11 9-8 9 8 M5 9v12h5v-7h4v7h5V9", close:"m5 5 14 14 M19 5 5 19",
 smile:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M8 9h.01 M16 9h.01 M7 14a6 6 0 0 0 10 0",
} as const;
type IconName=keyof typeof icons;
function Icon({name}:{name:IconName}){return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]}/></svg>;}
type Chat=ChatThread & {initials:string;text:string;time:string;pinned:boolean;group:boolean;file:boolean;color:string};
type Section="chats"|"contacts"|"credits"|"account"|"new-group";
const filters=[{id:"all",label:"Todas"},{id:"unread",label:"Não lidas"},{id:"favorites",label:"Favoritos"},{id:"groups",label:"Grupos"}] as const;
export function LosiChatPreview(){
 const {account,loading:accountLoading,error:accountError,refresh:refreshAccount}=useLosiChatAccount();
 const [conversations,setConversations]=useState<Chat[]>([]);
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [userId,setUserId]=useState('');
 const [hasOlder,setHasOlder]=useState(false),[olderLoading,setOlderLoading]=useState(false);
 const initialMessages=useRef(true);
 const [sending,setSending]=useState(false),[chatLoading,setChatLoading]=useState(true),[messageLoading,setMessageLoading]=useState(false);
 const [contactNumber,setContactNumber]=useState(''),[opening,setOpening]=useState(false);
 const retry=useRef<{id:string;text:string;thread:string}|null>(null);
 const bottom=useRef<HTMLDivElement>(null);
 const balance=Math.max(0,Number(account?.balance??0)).toLocaleString('pt-BR');
 const loadThreads=useCallback(async()=>{const d=await chatAction<{threads:ChatThread[];userId:string}>('threads');setUserId(d.userId);setConversations(d.threads.map(t=>({...t,initials:t.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase(),text:t.last?(t.last.body||'Imagem, vídeo ou documento'):'Comece esta conversa',time:t.last?new Date(t.last.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'',pinned:false,group:t.group===true,file:false,color:t.group?'sand':'ocean'})));},[]);
 const [section,setSection]=useState<Section>("chats");
 const [filter,setFilter]=useState<string>("all");
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState<Chat|null>(null);
 const [menu,setMenu]=useState(false);
 const [notice,setNotice]=useState("");
 const [draft,setDraft]=useState("");
 const [viewingGroup,setViewingGroup]=useState(false);
 useEffect(()=>{let live=true;const sync=async()=>{try{await loadThreads();if(live)setChatLoading(false);}catch(e){if(live){setNotice(e instanceof Error?e.message:'Erro ao carregar conversas.');setChatLoading(false);}}};void sync();const timer=setInterval(()=>{if(document.visibilityState==='visible')void sync();},10000);return()=>{live=false;clearInterval(timer);};},[loadThreads]);
 const selectedId=selected?.id;
 const selectedGroup=selected?.group===true;
 useEffect(()=>{if(!selectedId)return;const current=conversations.find(c=>c.id===selectedId);if(current)setSelected(current);else if(selectedGroup&&!chatLoading){setSelected(null);setViewingGroup(false);setNotice('Você não participa mais deste grupo.');}},[conversations]);
 const activeThread=useRef(selectedId);activeThread.current=selectedId;
 useEffect(()=>{setMessages([]);setHasOlder(false);initialMessages.current=true;if(!selectedId||viewingGroup)return;let live=true;setMessageLoading(true);const sync=async()=>{try{const d=await chatAction<{messages:ChatMessage[];userId:string;hasMore:boolean}>('messages',{threadId:selectedId,group:selectedGroup});if(live){if(initialMessages.current){setMessages(d.messages);setHasOlder(d.hasMore);initialMessages.current=false;}else setMessages(old=>{const map=new Map(old.map(m=>[m.id,m]));d.messages.forEach(m=>map.set(m.id,m));return [...map.values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));});setUserId(d.userId);setMessageLoading(false);}}catch(e){if(live){setNotice(e instanceof Error?e.message:'Erro ao carregar mensagens.');setMessageLoading(false);}}};void sync();const timer=setInterval(()=>{if(document.visibilityState==='visible')void sync();},5000);return()=>{live=false;clearInterval(timer);};},[selectedId,selectedGroup,viewingGroup]);
 useEffect(()=>{if(!olderLoading)bottom.current?.scrollIntoView({block:'end'});},[messages.at(-1)?.id]);
 useEffect(()=>{const n=new URLSearchParams(window.location.search).get('numero');if(n){setContactNumber(formatLosiNumber(n));setSection('contacts');}},[]);
 async function loadOlder(){if(!selectedId||!messages.length||olderLoading)return;const thread=selectedId;setOlderLoading(true);try{const d=await chatAction<{messages:ChatMessage[];hasMore:boolean}>('messages',{threadId:thread,group:selectedGroup,before:{at:messages[0].created_at,id:messages[0].id}});if(activeThread.current===thread){setMessages(old=>[...d.messages,...old]);setHasOlder(d.hasMore);}}catch(e){setNotice(e instanceof Error?e.message:'Não foi possível carregar o histórico.');}finally{setOlderLoading(false);}}
 async function findContact(){if(opening)return;setOpening(true);setNotice('');try{const d=await chatAction<{threadId:string}>('open',{number:contactNumber});await loadThreads();const details=await chatAction<{threads:ChatThread[];userId:string}>('threads');const t=details.threads.find(t=>t.id===d.threadId);if(t)openChat({...t,initials:t.name.slice(0,2).toUpperCase(),text:t.last?.body??'',time:'',pinned:false,group:t.group===true,file:false,color:t.group?'sand':'ocean'});}catch(e){setNotice(e instanceof Error?e.message:'Contato indisponível.');}finally{setOpening(false);}}
 async function sendText(){if(!selected||sending||!draft.trim())return;const text=draft.trim(),thread=selected.id;setSending(true);setNotice('');if(!retry.current||retry.current.text!==text||retry.current.thread!==thread)retry.current={id:crypto.randomUUID(),text,thread};try{const d=await chatAction<{message:ChatMessage;balance:number}>('send',{threadId:thread,group:selected.group,requestId:retry.current.id,text});if(activeThread.current===thread){setMessages(m=>m.some(x=>x.id===d.message.id)?m:[...m,d.message]);setDraft('');}retry.current=null;await Promise.allSettled([refreshAccount(),loadThreads()]);}catch(e){setNotice(e instanceof Error?e.message:'Não foi possível enviar. Tente novamente.');}finally{setSending(false);}}
 const visible=conversations.filter(c=>(filter!=="unread"||c.unread>0)&&(filter!=="favorites"||c.favorite)&&(filter!=="groups"||c.group)&&`${c.name} ${c.text}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
 const unread=conversations.filter(c=>c.unread>0).length;
 function go(next:Section){setViewingGroup(false);setSection(next);setSelected(null);setMenu(false);setNotice("");}
 function openChat(chat:Chat){setViewingGroup(false);setSelected(chat);setSection("chats");setDraft("");setNotice("");}
 function previewNotice(){setNotice("Abra uma conversa e toque no clipe para enviar imagens, vídeos ou documentos.");}
 const nav=[{id:"contacts",icon:"users",label:"Contatos"},{id:"credits",icon:"wallet",label:"Créditos"},{id:"chats",icon:"chat",label:"Conversas"},{id:"account",icon:"profile",label:"Você"}] as const;
 return <main className={`lc-app${selected?" lc-chat-open":""}`} aria-label="Chat LOSI">
  <aside className="lc-rail" aria-label="Navegação do chat">
   <button className={section==="chats"?"is-active":""} aria-label="Conversas" onClick={()=>go("chats")}><Icon name="chat"/><span className="lc-rail-count">{unread}</span></button>
   <button className={section==="contacts"?"is-active":""} aria-label="Contatos" onClick={()=>go("contacts")}><Icon name="users"/></button>
   <button className={section==="credits"?"is-active":""} aria-label="Saldo e recarga" onClick={()=>go("credits")}><Icon name="wallet"/></button>
   <span className="lc-rail-rule"/>
   <a href="/painel" aria-label="Voltar ao painel LOSI"><Icon name="home"/></a>
   <button className="lc-rail-profile" aria-label="Meu número digital" onClick={()=>go("account")}><Icon name="profile"/></button>
  </aside>
  <section className="lc-sidebar" aria-label="Conversas e saldo">
   <header className="lc-list-header">
    <div className="lc-mobile-actions"><button aria-label="Abrir opções" onClick={()=>setMenu(!menu)} aria-expanded={menu}><Icon name="more"/></button><span/><button aria-label="Câmera" onClick={previewNotice}><Icon name="camera"/></button><button className="lc-add" aria-label="Nova conversa" onClick={()=>go("contacts")}><Icon name="plus"/></button></div>
    <div className="lc-desktop-heading"><strong>Chat LOSI</strong><button aria-label="Abrir opções" onClick={()=>setMenu(!menu)} aria-expanded={menu}><Icon name="more"/></button><button className="lc-add" aria-label="Nova conversa" onClick={()=>go("contacts")}><Icon name="plus"/></button></div>
    {menu&&<div className="lc-menu"><button onClick={()=>go("new-group")}>Novo grupo</button><button onClick={()=>go("account")}>Meu número digital</button><button onClick={()=>go("credits")}>Saldo e recarga</button><a href="/painel">Voltar ao painel</a></div>}
    <h1 className="lc-mobile-title">{section==="chats"?"Conversas":section==="contacts"?"Contatos":section==="credits"?"Créditos":section==="new-group"?"Novo grupo":"Você"}</h1>
    <button className="lc-balance" onClick={()=>go("credits")} aria-label="Ver saldo de créditos"><Icon name="wallet"/><span><strong>{accountLoading?"…":balance}</strong> créditos</span></button>
    {accountError&&<p className="lc-demo-note" role="status">{accountError}</p>}
    <label className="lc-search"><Icon name="search"/><input aria-label="Pesquisar conversas" placeholder="Pesquisar ou começar uma nova conversa" value={search} onChange={e=>{setSearch(e.target.value);if(section!=="chats"&&section!=="contacts")setSection("chats");}}/></label>
    <nav className="lc-filters" aria-label="Filtrar conversas">{filters.map(f=><button key={f.id} aria-pressed={filter===f.id} onClick={()=>{setFilter(f.id);setSection("chats");setSelected(null);}}>{f.label}{f.id==="unread"&&<span> {unread}</span>}</button>)}</nav>
   </header>
   {(section==="chats"||section==="contacts")&&<div className="lc-conversations">
    {section==="contacts"&&<button className="lc-group-new-link" onClick={()=>go("new-group")}><Icon name="users"/>Criar novo grupo</button>}
    {section==="contacts"&&<form className="lc-contact-form" onSubmit={e=>{e.preventDefault();void findContact();}}><p>Encontre um fornecedor pelo número digital LOSI.</p><label>Número digital<input value={contactNumber} onChange={e=>setContactNumber(e.target.value)} inputMode="numeric" placeholder="154.444.566" maxLength={11}/></label><button disabled={opening}>{opening?'Buscando…':'Abrir conversa'}</button>{!account?.digital_number&&<a href="/meus-servicos">Comprar ou resgatar meu número</a>}</form>}
    {visible.map(c=><button className={`lc-conversation${selected?.id===c.id?" is-selected":""}`} key={c.id} onClick={()=>openChat(c)}>
     <span className={`lc-avatar lc-avatar-${c.color}`} aria-hidden="true">{c.photo?<img src={c.photo} alt=""/>:c.initials}</span>
     <span className="lc-conversation-details"><span className="lc-conversation-top"><strong>{c.name}</strong><time className={c.unread?"has-unread":""}>{c.time}</time></span>
      <span className="lc-conversation-bottom"><span className="lc-last-message">{!c.group&&<Icon name="check"/>}{c.file&&<Icon name="file"/>}<span>{c.text}</span></span><span className="lc-message-marks">{c.pinned&&<Icon name="pin"/>}{c.unread>0&&<b>{c.unread}</b>}</span></span>
     </span>
    </button>)}
    {visible.length===0&&<p className="lc-no-results">{chatLoading?'Carregando conversas…':filter==='groups'?'Seus grupos aparecerão aqui. Use “Novo grupo” no menu ou em Contatos.':filter==='all'&&!search?'Suas conversas aparecerão aqui. Toque em + para encontrar um fornecedor.':'Nenhuma conversa encontrada neste filtro.'}</p>}
   </div>}
   {section==="new-group"&&<div className="lc-account-panel lc-group-create-panel"><LosiChatGroupCreate hasNumber={Boolean(account?.digital_number)} onCancel={()=>go("contacts")} onCreated={async id=>{const d=await chatAction<{threads:ChatThread[];userId:string}>('threads');await loadThreads();const t=d.threads.find(t=>t.id===id);if(t)openChat({...t,initials:t.name.slice(0,2).toUpperCase(),text:t.last?.body??'',time:'',pinned:false,group:true,file:false,color:'sand'});}}/></div>}
   {section==="credits"&&<div className="lc-account-panel"><LosiChatNumberPurchase businessId={account?.business_id} compact/><h3>Consumo por envio</h3><dl><div><dt>Mensagem de texto</dt><dd>1 crédito</dd></div><div><dt>Receber mensagens</dt><dd>Gratuito</dd></div></dl><dl><div><dt>Vídeo (legenda incluída)</dt><dd>10 créditos</dd></div><div><dt>Imagem</dt><dd>2 créditos</dd></div><div><dt>Imagem com texto</dt><dd>3 créditos</dd></div><div><dt>Documento até 2 / 5 / 10 / 20 MB</dt><dd>2 / 3 / 4 / 8 créditos</dd></div></dl><p>A legenda está incluída no custo dos documentos.</p><a href="/meus-servicos">Ir para Minha Empresa</a></div>}
   {section==="account"&&<div className="lc-account-panel"><span className="lc-account-avatar"><Icon name="profile"/></span><h2>Meu número digital LOSI</h2><strong className="lc-digital-number">{formatLosiNumber(account?.digital_number)}</strong><small>{account?.digital_number?'Vinculado permanentemente à sua conta':'Compra opcional em Minha Empresa'}</small><LosiChatNumberPurchase businessId={account?.business_id} compact/><a href="/meus-servicos">Ir para Minha Empresa</a><a href="/painel">Voltar ao painel LOSI</a></div>}
   {notice&&!selected&&<p className="lc-notice" role="status">{notice}<button aria-label="Fechar aviso" onClick={()=>setNotice("")}><Icon name="close"/></button></p>}
  </section>
  <section className="lc-main" aria-label={selected?`Conversa com ${selected.name}`:"Apresentação do Chat LOSI"}>
   {selected?<>
    <header className="lc-thread-header"><button className="lc-thread-back" aria-label="Voltar às conversas" onClick={()=>setSelected(null)}><Icon name="back"/></button><span className={`lc-avatar lc-avatar-${selected.color}`} aria-hidden="true">{selected.photo?<img src={selected.photo} alt=""/>:selected.initials}</span><div><strong>{selected.name}</strong><small>{selected.group?`${selected.memberCount??0} participantes`:formatLosiNumber(selected.number)}</small></div>{selected.group&&<button className="lc-group-info" aria-expanded={viewingGroup} onClick={()=>setViewingGroup(!viewingGroup)}>Dados do grupo</button>}<button className="lc-thread-balance" onClick={()=>go("credits")}><Icon name="wallet"/><span>{balance} <small>créditos</small></span></button></header>
    {selected.group&&viewingGroup?<LosiChatGroupDetails key={selected.id} groupId={selected.id} onClose={()=>setViewingGroup(false)} onChanged={loadThreads} onLeft={()=>{setSelected(null);setViewingGroup(false);setNotice('Você saiu do grupo.');void loadThreads();}}/>:<>
    <div className="lc-thread-messages" aria-live="polite"><span className="lc-day">Mensagens</span>{hasOlder&&<button className="lc-favorite-toggle" disabled={olderLoading} onClick={()=>void loadOlder()}>{olderLoading?"Carregando…":"Ver mensagens anteriores"}</button>}<button className="lc-favorite-toggle" aria-pressed={selected.favorite} onClick={async()=>{try{await chatAction('favorite',{threadId:selected.id,group:selected.group,favorite:!selected.favorite});setSelected({...selected,favorite:!selected.favorite});await loadThreads();}catch(e){setNotice(e instanceof Error?e.message:'Não foi possível salvar o favorito.');}}}><Icon name="star"/>{selected.favorite?'Remover dos favoritos':'Adicionar aos favoritos'}</button>{messageLoading?<p className="lc-thread-disclaimer">Carregando mensagens…</p>:messages.length===0?<p className="lc-thread-disclaimer">Comece a conversa. Cada texto enviado consome 1 crédito.</p>:messages.map(m=><div key={m.id} className={`lc-bubble ${m.sender_id===userId?'sent':'received'}`}>{selected.group&&m.sender_id!==userId&&<strong className="lc-group-sender">{m.sender_name||"Fornecedor LOSI"}</strong>}<LosiChatAttachment message={m}/>{m.body}<span><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time>{m.sender_id===userId&&<Icon name="check"/>}</span></div>)}<div ref={bottom}/></div>
    {notice&&<p className="lc-notice" role="status">{notice}<button aria-label="Fechar aviso" onClick={()=>setNotice("")}><Icon name="close"/></button></p>}
    <LosiChatComposer key={selected.id} threadId={selected.id} group={selected.group} balance={Number(account?.balance??0)} hasNumber={Boolean(account?.digital_number)} text={draft} setText={setDraft} textSending={sending} onText={sendText} onError={setNotice} onSent={m=>{if(activeThread.current===m.thread_id||activeThread.current===m.group_id)setMessages(old=>old.some(x=>x.id===m.id)?old:[...old,m]);void Promise.allSettled([refreshAccount(),loadThreads()]);}}/></>}
   </>:<div className="lc-welcome"><div className="lc-welcome-card"><img src="/losi-conecta-symbol.svg" alt="" width="110" height="110"/><h2>Seu próximo parceiro está aqui</h2><p>Troque experiências e desenvolva seu networking com outros fornecedores da LOSI.</p><button onClick={()=>go("contacts")}>Encontrar contatos</button></div><div className="lc-shortcuts"><button onClick={previewNotice}><span><Icon name="file"/></span>Enviar documento</button><button onClick={()=>go("contacts")}><span><Icon name="users"/></span>Adicionar contato</button><button onClick={()=>go("credits")}><span><Icon name="wallet"/></span>Saldo e recarga</button><button onClick={()=>go("account")}><span><Icon name="profile"/></span>Meu número LOSI</button></div><p className="lc-welcome-footnote">Chat LOSI · 1 crédito por texto enviado · receber mensagens é gratuito</p></div>}
  </section>
  <nav className="lc-mobile-nav" aria-label="Navegação do Chat LOSI">{nav.map(n=><button key={n.id} className={section===n.id?"is-active":""} aria-current={section===n.id?"page":undefined} onClick={()=>go(n.id)}><span><Icon name={n.icon}/>{n.id==="chats"&&<b>{unread}</b>}</span><strong>{n.label}</strong></button>)}</nav>
 </main>;
}
