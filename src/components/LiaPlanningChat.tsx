import { useEffect, useRef, useState } from "react";
import { LiaMascot } from "./LiaMascot";
import { PanelMenuIcon } from "./PanelMenuIcon";
import { callLosiAi, type AiStatus } from "../lib/losi-ai";
import "../losi-ai.css";
import "../lia-planning-chat.css";

type Message = { id: string; role: "user" | "assistant"; text: string };
type Conversation = { id: string; title: string; updatedAt: string; messages: Message[]; context?: string };
export type LiaRequest = typeof callLosiAi;
const prompts = [
  {icon:"activity",label:"Criar um plano de trabalho",text:"Quero criar um plano de trabalho para um evento. Me ajude a organizar o briefing e faça perguntas sobre as informações que faltam."},
  {icon:"businesses",label:"Estruturar meu negócio",text:"Quero estruturar um plano de negócios para minha empresa de eventos. Me ajude a definir os serviços e os próximos passos, começando pelas informações que você precisa."},
  {icon:"users",label:"Planejar equipe e atividades",text:"Quero organizar a equipe e as atividades de um evento. Me ajude a levantar público, duração, espaço e tarefas antes de sugerir uma estrutura."},
];
function isConversation(v: unknown): v is Conversation {
  if(!v || typeof v!=="object")return false;
  const c=v as Conversation;
  return typeof c.id==="string" && typeof c.title==="string" && typeof c.updatedAt==="string" && (c.context===undefined||typeof c.context==="string") && Array.isArray(c.messages) && c.messages.every(m=>m&&typeof m.id==="string"&&["user","assistant"].includes(m.role)&&typeof m.text==="string");
}
export function LiaPlanningChat({userId,onOpenSteps,planContext,onContextConsumed,request=callLosiAi}:{userId:string;onOpenSteps:()=>void;planContext?:string;onContextConsumed:()=>void;request?:LiaRequest}) {
  const [threads,setThreads]=useState<Conversation[]>([]);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [input,setInput]=useState("");
  const [search,setSearch]=useState("");
  const [sidebar,setSidebar]=useState(false);
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [storageError,setStorageError]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [status,setStatus]=useState<AiStatus|null>(null);
  const [statusError,setStatusError]=useState("");
  const [loadingStatus,setLoadingStatus]=useState(true);
  const locked=useRef(false);
  const mounted=useRef(true);
  const end=useRef<HTMLDivElement>(null);
  const textarea=useRef<HTMLTextAreaElement>(null);
  const sidebarRef=useRef<HTMLElement>(null);
  const menuButton=useRef<HTMLButtonElement>(null);
  const active=threads.find(t=>t.id===activeId);
  const messages=active?.messages||[];
  const key=`losi-lia-planning-v1:${userId}`;
  async function refreshStatus() {
    setLoadingStatus(true);setStatusError("");
    try {const result=await request({action:"status"});if(mounted.current)setStatus(result);}
    catch(e){if(mounted.current)setStatusError(e instanceof Error?e.message:"Não foi possível verificar o acesso à Lia.");}
    finally{if(mounted.current)setLoadingStatus(false);}
  }
  useEffect(()=>{mounted.current=true;void refreshStatus();return()=>{mounted.current=false;};},[request]);
  useEffect(()=>{
    try {const saved=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(saved)||!saved.every(isConversation))throw Error();setThreads(saved);setActiveId(saved[0]?.id||null);}
    catch {setStorageError("Não foi possível carregar o histórico. As conversas existentes não serão sobrescritas; as novas ficarão apenas nesta sessão.");}
    setReady(true);
  },[key]);
  useEffect(()=>{
    if(!ready||storageError)return;
    try {localStorage.setItem(key,JSON.stringify(threads));}
    catch {setStorageError("Não foi possível salvar neste navegador. Mantenha esta página aberta e copie seu plano para não perder o conteúdo.");}
  },[threads,ready,key,storageError]);
  useEffect(()=>{
    if(!ready||!planContext)return;
    const thread:Conversation={id:crypto.randomUUID(),title:"Continuar meu plano",updatedAt:new Date().toISOString(),messages:[],context:planContext};
    setThreads(all=>[thread,...all]);setActiveId(thread.id);setInput("Me ajude a desenvolver este plano. Aponte o que falta e sugira os próximos passos.");onContextConsumed();
  },[planContext,ready,onContextConsumed]);
  useEffect(()=>{end.current?.scrollIntoView({behavior:"instant",block:"end"});},[activeId,messages.length,busy]);
  useEffect(()=>{if(textarea.current){textarea.current.style.height="auto";textarea.current.style.height=Math.min(textarea.current.scrollHeight,180)+"px";}},[input]);
  useEffect(()=>{
    if(!sidebar)return;
    sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){setSidebar(false);menuButton.current?.focus();}
      if(e.key==="Tab"&&sidebarRef.current){const els=Array.from(sidebarRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a, input'));const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    };
    document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);
  },[sidebar]);
  const remaining=status?Math.max(0,(status.access.materialLimit||0)-status.used.material):0;
  const available=Boolean(status?.configured&&status.access.allowed&&remaining>0);
  const availability=loadingStatus?"Verificando acesso à Lia…":statusError?"Não foi possível verificar o acesso":!status?.configured?"Lia aguardando ativação":!status.access.allowed?"Acesso à Lia não habilitado":remaining<1?"Sua franquia de materiais foi utilizada":`${remaining} ${remaining===1?"geração disponível":"gerações disponíveis"}`;
  function newChat(){if(locked.current)return;setActiveId(null);setInput("");setError("");setNotice("");setSidebar(false);requestAnimationFrame(()=>textarea.current?.focus());}
  function updateThread(thread:Conversation){setThreads(all=>[thread,...all.filter(t=>t.id!==thread.id)]);setActiveId(thread.id);}
  async function send(){
    const text=input.trim();if(!text||!available||locked.current||!ready)return;
    locked.current=true;setBusy(true);setError("");setNotice("");
    const user:Message={id:crypto.randomUUID(),role:"user",text};
    const thread:Conversation=active?{...active,messages:[...active.messages,user],updatedAt:new Date().toISOString()}:{id:crypto.randomUUID(),title:text.slice(0,65),updatedAt:new Date().toISOString(),messages:[user]};
    updateThread(thread);setInput("");
    // Existing Lia content service accepts 6,000 characters. Keep the latest turns
    // and the supplied briefing within that contract; never fabricate retrieval.
    const history=thread.messages.slice(0,-1).map(m=>`${m.role==="user"?"Usuário":"Lia"}: ${m.text}`).join("\n\n").slice(-2800);
    const instructions=`Você é a Lia, assistente da LOSI. Responda ao último pedido do usuário, considerando a conversa. Ajude a construir e revisar um plano de trabalho ou negócios. Faça perguntas objetivas quando faltarem informações e ofereça sugestões práticas. Diferencie sugestões de dados confirmados. Não invente preços de mercado, pesquisa na internet, fornecedores cadastrados ou proporções de equipe. Não afirme ter pesquisado ou gerado um PDF. Não há busca na internet ou catálogo conectados a este chat.\nConversa anterior:\n${history}\nÚltimo pedido:\n${text}`;
    try {
      const response=await request({action:"generate",kind:"material",tone:"educational",depth:"standard",requestId:crypto.randomUUID(),instructions,context:{description:thread.context||"Planejamento de eventos e negócios na LOSI"}});
      if(!response.result?.content||typeof response.result.content!=="string")throw Error("A Lia não retornou um texto. Tente novamente.");
      if(mounted.current)updateThread({...thread,updatedAt:new Date().toISOString(),messages:[...thread.messages,{id:crypto.randomUUID(),role:"assistant",text:response.result.content}]});
    }catch(e){if(mounted.current){updateThread({...thread,messages:thread.messages.slice(0,-1)});setInput(text);setError(e instanceof Error?e.message:"Não foi possível enviar. Tente novamente.");}}
    finally{locked.current=false;if(mounted.current){setBusy(false);void refreshStatus();requestAnimationFrame(()=>textarea.current?.focus());}}
  }
  async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice("Texto copiado.");}catch{setNotice("Não foi possível copiar. Selecione o texto e copie manualmente.");}}
  function removeThread(id:string){if(locked.current||!window.confirm("Excluir esta conversa deste dispositivo?"))return;setThreads(all=>all.filter(t=>t.id!==id));if(activeId===id)newChat();}
  const visible=threads.filter(t=>t.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  return <div className="lia-chat-shell">
    {sidebar&&<button className="lia-chat-scrim" aria-label="Fechar histórico" onClick={()=>{setSidebar(false);menuButton.current?.focus();}}/>}
    <aside ref={sidebarRef} id="lia-chat-history" className={`lia-chat-sidebar${sidebar?" is-open":""}`} aria-label="Conversas com a Lia" role={sidebar?"dialog":undefined} aria-modal={sidebar?true:undefined}>
      <div className="lia-chat-side-brand"><a href="/painel" aria-label="Voltar ao painel LOSI"><strong>LOSI<span> CONECTA</span></strong></a><button className="lia-chat-mobile-close" aria-label="Fechar histórico" onClick={()=>{setSidebar(false);menuButton.current?.focus();}}><PanelMenuIcon name="close"/></button></div>
      <button className="lia-chat-new" disabled={busy} onClick={newChat}><PanelMenuIcon name="plus"/>Nova conversa</button>
      <label className="lia-chat-search"><PanelMenuIcon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas"/></label>
      <button className="lia-chat-plans" disabled={busy} onClick={onOpenSteps}><PanelMenuIcon name="activity"/>Planos e rascunhos<PanelMenuIcon name="down"/></button>
      <div className="lia-chat-history-heading">Suas conversas</div>
      <div className="lia-chat-history-list">{!ready?<p>Carregando histórico…</p>:visible.length?visible.map(t=><div className={`lia-chat-history-row${activeId===t.id?" is-active":""}`} key={t.id}><button disabled={busy} onClick={()=>{setActiveId(t.id);setError("");setInput("");setSidebar(false);}} title={t.title}>{t.title}</button><button disabled={busy} aria-label={`Excluir conversa: ${t.title}`} onClick={()=>removeThread(t.id)}><PanelMenuIcon name="trash"/></button></div>):<p>{search?"Nenhuma conversa encontrada.":"Seu próximo plano começa aqui. As conversas aparecerão neste espaço."}</p>}</div>
      <div className="lia-chat-side-footer"><a href="/painel"><PanelMenuIcon name="back"/>Voltar ao painel</a><small>Histórico salvo neste dispositivo.</small></div>
    </aside>
    <section className="lia-chat-main" aria-label="Chat de planejamento com a Lia">
      <header className="lia-chat-topbar"><div><button ref={menuButton} className="lia-chat-menu" aria-label="Abrir histórico de conversas" aria-expanded={sidebar} aria-controls="lia-chat-history" onClick={()=>setSidebar(true)}><PanelMenuIcon name="overview"/></button><details className="lia-chat-info"><summary>Lia <PanelMenuIcon name="down"/></summary><div><strong>Sua assistente LOSI</strong><p>Desenvolva e revise seu plano pela conversa. A Lia utiliza o assistente de conteúdo já disponível na LOSI.</p><p>Pesquisa na internet, indicação de fornecedores e PDF deste plano serão conectados depois.</p></div></details></div><button className="lia-chat-step-button" disabled={busy} onClick={onOpenSteps}><PanelMenuIcon name="activity"/><span>Etapas guiadas</span></button></header>
      <div className={`lia-chat-scroll${messages.length?" has-messages":""}`}>
        {!messages.length?<div className="lia-chat-welcome"><LiaMascot className="lia-chat-welcome-mascot"/><h1>{active?.context?"Vamos continuar seu plano?":"O que vamos planejar hoje?"}</h1><p>{active?.context?"Seu briefing está nesta conversa. Conte o que você quer desenvolver ou mudar.":"Conte sua ideia à Lia. Juntos, vamos organizar os próximos passos."}</p><div className="lia-chat-suggestions">{prompts.map(p=><button key={p.label} onClick={()=>{setInput(p.text);textarea.current?.focus();}}><PanelMenuIcon name={p.icon}/>{p.label}</button>)}</div></div>:<div className="lia-chat-messages" role="log" aria-label="Mensagens da conversa">{messages.map(m=><article key={m.id} className={`lia-chat-message is-${m.role}`} aria-label={m.role==="user"?"Sua mensagem":"Resposta da Lia"}>{m.role==="assistant"&&<div className="lia-chat-answer-author"><img src="/lia-pavoa.webp" alt=""/>Lia</div>}<div className="lia-chat-message-text">{m.text}</div>{m.role==="assistant"&&<button className="lia-chat-copy" aria-label="Copiar resposta da Lia" onClick={()=>void copy(m.text)}><PanelMenuIcon name="copy"/></button>}</article>)}</div>}
        {busy&&<div className="lia-chat-thinking" role="status"><LiaMascot state="working"/><span>A Lia está preparando sua resposta…</span></div>}<div ref={end}/>
      </div>
      <div className="lia-chat-compose-area">
        {active?.context&&<details className="lia-chat-context"><summary><PanelMenuIcon name="forms"/>Briefing do plano nesta conversa</summary><pre>{active.context}</pre></details>}
        {storageError&&<p className="lia-chat-notice" role="alert">{storageError}</p>}
        {error&&<p className="lia-chat-error" role="alert">{error}</p>}
        {notice&&<p className="lia-chat-notice" role="status">{notice}</p>}
        <form className="lia-chat-composer" onSubmit={e=>{e.preventDefault();void send();}}><label className="lia-chat-sr" htmlFor="lia-planning-message">Mensagem para a Lia</label><textarea ref={textarea} id="lia-planning-message" rows={1} maxLength={2000} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} placeholder="Pergunte à Lia ou descreva seu evento"/><div className="lia-chat-composer-tools"><span><PanelMenuIcon name="aiCredits"/>Planejamento com a Lia</span><button type="submit" className="lia-chat-send" aria-label="Enviar mensagem" disabled={!input.trim()||busy||!available||!ready}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div></form>
        <div className="lia-chat-access"><span>{availability}</span>{statusError&&<button disabled={loadingStatus||busy} onClick={()=>void refreshStatus()}>Tentar novamente</button>}<small>Cada resposta concluída usa 1 geração de materiais.</small></div>
        <p className="lia-chat-footnote">A Lia pode cometer erros. Revise o plano. Pesquisa, fornecedores e PDF: em breve.</p>
      </div>
    </section>
  </div>;
}
