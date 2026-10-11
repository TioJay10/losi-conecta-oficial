import { PlanningOperations } from "./PlanningOperations";
import { isOperations, type Operations } from "../../supabase/functions/losi-ai-content/planning-operations";
import { isSupplierResult, type SupplierResult } from "../../supabase/functions/losi-ai-content/planning-suppliers";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { AppliedPlan, GeneratedPlan, PlanContext, PlanKind } from "../lib/planning-link";
import { LiaMascot } from "./LiaMascot";
import { PanelMenuIcon } from "./PanelMenuIcon";
import { callLosiAi, type AiStatus } from "../lib/losi-ai";
import "../losi-ai.css";
import "../lia-planning-chat.css";

const ChatPlanPdf=lazy(()=>import("./ChatPlanPdf"));
type Message = { id: string; role: "user" | "assistant"; text: string; title?: string; planKind?: PlanKind; operations?:Operations;suppliers?:SupplierResult; research?: { searchedAt: string; sources: {title:string;url:string}[] } };
type Conversation = { id: string; title: string; updatedAt: string; messages: Message[]; context?: string; kind?: PlanKind; draftId?: string; planContent?: string };
export type LiaRequest = typeof callLosiAi;
const prompts = [
  {icon:"activity",label:"Criar um plano de trabalho",text:"Quero criar um plano de trabalho para um evento. Me ajude a organizar o briefing e faça perguntas sobre as informações que faltam."},
  {icon:"businesses",label:"Estruturar meu negócio",text:"Quero estruturar um plano de negócios para minha empresa de eventos. Me ajude a definir os serviços e os próximos passos, começando pelas informações que você precisa."},
  {icon:"users",label:"Planejar equipe e atividades",text:"Quero organizar a equipe e as atividades de um evento. Me ajude a levantar público, duração, espaço e tarefas antes de sugerir uma estrutura."},
];
function isConversation(v: unknown): v is Conversation {
  if(!v || typeof v!=="object")return false;
  const c=v as Conversation;
  return typeof c.id==="string" && typeof c.title==="string" && typeof c.updatedAt==="string" && (c.context===undefined||typeof c.context==="string") && (c.planContent===undefined||typeof c.planContent==="string") && (c.kind===undefined||["work","business"].includes(c.kind)) && (c.draftId===undefined||typeof c.draftId==="string") && Array.isArray(c.messages) && c.messages.every(m=>m&&typeof m.id==="string"&&["user","assistant"].includes(m.role)&&typeof m.text==="string"&&(m.title===undefined||typeof m.title==="string")&&(m.planKind===undefined||["work","business"].includes(m.planKind))&&(m.operations===undefined||isOperations(m.operations))&&(m.suppliers===undefined||isSupplierResult(m.suppliers))&&(m.research===undefined||(m.research && typeof m.research.searchedAt==="string" && Array.isArray(m.research.sources) && m.research.sources.every(s=>s&&typeof s.title==="string"&&typeof s.url==="string"))));
}
export function LiaPlanningChat({userId,onOpenSteps,planContext,onContextConsumed,onApplyPlan,appliedPlan,request=callLosiAi,providerCompany}:{userId:string;onOpenSteps:()=>void;planContext?:PlanContext;onContextConsumed:()=>void;onApplyPlan:(plan:GeneratedPlan)=>void;appliedPlan?:AppliedPlan;request?:LiaRequest;providerCompany?:string}) {
  const [pdfMessage,setPdfMessage]=useState<Message|null>(null);
  const pdfAnchor=useRef<HTMLDivElement>(null);
  const openPdf=(m:Message)=>{setPdfMessage(m);requestAnimationFrame(()=>{pdfAnchor.current?.scrollIntoView({block:"start"});pdfAnchor.current?.focus();});};
  const [threads,setThreads]=useState<Conversation[]>([]);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [input,setInput]=useState("");
  const [newKind,setNewKind]=useState<PlanKind>("work");
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
  const latestReply=[...messages].reverse().find(m=>m.role==="assistant");
  useEffect(()=>setPdfMessage(null),[activeId]);
  const planKind=active?.kind || newKind;
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
    const existing=threads.find(t=>t.draftId===planContext.draftId);
    const thread:Conversation={...(existing||{id:crypto.randomUUID(),messages:[]}),title:planContext.title,updatedAt:new Date().toISOString(),context:planContext.briefing,kind:planContext.kind,draftId:planContext.draftId,planContent:planContext.content};
    setThreads(all=>[thread,...all.filter(t=>t.id!==thread.id)]);setActiveId(thread.id);setInput("Me ajude a desenvolver este plano. Aponte o que falta e sugira os próximos passos.");onContextConsumed();
  },[planContext,ready,onContextConsumed]);
  useEffect(()=>{
    if(!appliedPlan || !ready)return;
    setThreads(all=>all.map(t=>t.id===appliedPlan.conversationId ? {...t,draftId:appliedPlan.draftId,kind:appliedPlan.kind,context:appliedPlan.briefing,planContent:appliedPlan.content} : t));
  },[appliedPlan,ready]);
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
  function newChat(){if(locked.current)return;setActiveId(null);setNewKind("work");setInput("");setError("");setNotice("");setSidebar(false);requestAnimationFrame(()=>textarea.current?.focus());}
  function updateThread(thread:Conversation){setThreads(all=>[thread,...all.filter(t=>t.id!==thread.id)]);setActiveId(thread.id);}
  async function send(){
    const text=input.trim();if(!text||!available||locked.current||!ready)return;
    locked.current=true;setBusy(true);setError("");setNotice("");
    const user:Message={id:crypto.randomUUID(),role:"user",text};
    const thread:Conversation=active?{...active,messages:[...active.messages,user],updatedAt:new Date().toISOString()}:{id:crypto.randomUUID(),title:text.slice(0,65),updatedAt:new Date().toISOString(),messages:[user],kind:planKind};
    updateThread(thread);setInput("");
    // Existing Lia content service accepts 6,000 characters. Keep the latest turns
    // and the supplied briefing within that contract; never fabricate retrieval.
    const history=thread.messages.slice(0,-1).map(m=>`${m.role==="user"?"Usuário":"Lia"}: ${m.text}`).join("\n\n").slice(-2800);
    const instructions=`Você é a Lia, assistente da LOSI. Responda ao último pedido do usuário, considerando a conversa. O campo currentPlan do contexto é a versão atual revisada do plano; use-o como base e preserve as edições do usuário ao atualizar. O tipo de plano selecionado é ${planKind === "business" ? "PLANO DE NEGÓCIOS" : "PLANO DE TRABALHO"}. Quando o usuário pedir um plano ou uma revisão, entregue o plano completo atualizado, não somente uma lista de alterações. Para negócios, organize objetivos, público, serviços, operação, divulgação e próximos passos; para trabalho, organize objetivo, atividades, execução, recursos e pendências. Se faltarem dados, identifique-os como a definir. Faça perguntas objetivas quando faltarem informações e ofereça sugestões práticas. Diferencie sugestões de dados confirmados. Use a pesquisa fornecida pelo sistema para aprofundar o plano e incluir preços dos serviços, mesmo quando não forem solicitados. Diferencie valores pesquisados de estimativas. Não invente fornecedores cadastrados ou proporções oficiais de equipe.\nConversa anterior:\n${history}\nÚltimo pedido:\n${text}`;
    try {
      const response=await request({action:"generate",kind:"material",tone:"educational",depth:"detailed",planning:true,planType:planKind,requestId:crypto.randomUUID(),instructions,context:{description:thread.context||"Planejamento de eventos e negócios na LOSI",currentPlan:thread.planContent||""}});
      if(!response.result?.content||typeof response.result.content!=="string")throw Error("A Lia não retornou um texto. Tente novamente.");
      if(mounted.current)updateThread({...thread,updatedAt:new Date().toISOString(),messages:[...thread.messages,{id:crypto.randomUUID(),role:"assistant",text:response.result.content,operations:isOperations(response.result.operations)?response.result.operations:undefined,suppliers:isSupplierResult(response.result.suppliers)?response.result.suppliers:undefined,research:response.result.research,title:typeof response.result.title==="string"?response.result.title:thread.title,planKind}]});
    }catch(e){if(mounted.current){updateThread({...thread,messages:thread.messages.slice(0,-1)});setInput(text);setError(e instanceof Error?e.message:"Não foi possível enviar. Tente novamente.");}}
    finally{locked.current=false;if(mounted.current){setBusy(false);void refreshStatus();requestAnimationFrame(()=>textarea.current?.focus());}}
  }
  function applyPlan(m:Message){
    if(!active || busy || storageError)return;
    if(m.text.length>40000){setNotice("Este texto excede 40.000 caracteres. Peça à Lia uma versão mais concisa antes de aplicar.");return;}
    onApplyPlan({requestId:crypto.randomUUID(),conversationId:active.id,messageId:m.id,draftId:active.draftId,title:m.title || active.title,kind:m.planKind || active.kind || "work",content:m.text,operations:m.operations,suppliers:m.suppliers,description:active.messages.find(msg=>msg.role==="user")?.text || ""});
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
      <header className="lia-chat-topbar"><div><button ref={menuButton} className="lia-chat-menu" aria-label="Abrir histórico de conversas" aria-expanded={sidebar} aria-controls="lia-chat-history" onClick={()=>setSidebar(true)}><PanelMenuIcon name="overview"/></button><details className="lia-chat-info"><summary>Lia <PanelMenuIcon name="down"/></summary><div><strong>Sua assistente LOSI</strong><p>Desenvolva e revise seu plano pela conversa. A Lia utiliza o assistente de conteúdo já disponível na LOSI.</p><p>Pesquisa de preços na internet e exportação do plano ou proposta em PDF estão disponíveis. A Lia dimensiona atividades, calcula custos e consulta fornecedores ativos e aprovados da LOSI. Revise premissas, cotação e disponibilidade.</p></div></details></div><div className="lia-chat-top-actions"><button type="button" className="lia-chat-pdf-button" disabled={busy||!latestReply} onClick={()=>latestReply&&openPdf(latestReply)}><PanelMenuIcon name="forms"/>Gerar PDF</button><button className="lia-chat-step-button" disabled={busy} onClick={onOpenSteps}><PanelMenuIcon name="activity"/><span>Etapas guiadas</span></button></div></header>
      <div className={`lia-chat-scroll${messages.length?" has-messages":""}`}>
        {pdfMessage&&<div ref={pdfAnchor} tabIndex={-1} className="lia-chat-pdf-anchor"><Suspense fallback={<p role="status">Preparando PDF…</p>}><ChatPlanPdf key={pdfMessage.id} title={pdfMessage.title||active?.title||"Meu plano"} content={pdfMessage.text} kind={pdfMessage.planKind||planKind} company={providerCompany} onClose={()=>setPdfMessage(null)}/></Suspense></div>}
        {!messages.length?<div className="lia-chat-welcome"><LiaMascot className="lia-chat-welcome-mascot"/><h1>{active?.context?"Vamos continuar seu plano?":"O que vamos planejar hoje?"}</h1><p>{active?.context?"Seu briefing está nesta conversa. Conte o que você quer desenvolver ou mudar.":"Conte sua ideia à Lia. Juntos, vamos organizar os próximos passos."}</p><div className="lia-chat-suggestions">{prompts.map(p=><button key={p.label} onClick={()=>{setInput(p.text);if(!active){setNewKind(p.icon==="businesses"?"business":"work");}textarea.current?.focus();}}><PanelMenuIcon name={p.icon}/>{p.label}</button>)}</div></div>:<div className="lia-chat-messages" role="log" aria-label="Mensagens da conversa">{messages.map(m=><article key={m.id} className={`lia-chat-message is-${m.role}`} aria-label={m.role==="user"?"Sua mensagem":"Resposta da Lia"}>{m.role==="assistant"&&<div className="lia-chat-answer-author"><img src="/lia-pavoa.webp" alt=""/>Lia</div>}{m.role==="assistant"&&<PlanningOperations operations={m.operations} suppliers={m.suppliers}/>}<div className="lia-chat-message-text">{m.text}</div>{m.role==="assistant"&&m.research&&<details className="lia-chat-research"><summary>Fontes consultadas · {new Date(m.research.searchedAt).toLocaleDateString("pt-BR")}</summary><ul>{m.research.sources.filter(s=>/^https?:\/\//i.test(s.url)).map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul></details>}{m.role==="assistant"&&<div className="lia-chat-answer-actions"><button className="lia-chat-apply-plan" disabled={busy||!!storageError} onClick={()=>applyPlan(m)}><PanelMenuIcon name="activity"/>{active?.draftId?"Atualizar plano vinculado":"Aplicar ao plano"}</button><button className="lia-chat-pdf-button" disabled={busy} onClick={()=>openPdf(m)}><PanelMenuIcon name="forms"/>Gerar PDF</button><button className="lia-chat-copy" aria-label="Copiar resposta da Lia" onClick={()=>void copy(m.text)}><PanelMenuIcon name="copy"/></button></div>}</article>)}</div>}
        {busy&&<div className="lia-chat-thinking" role="status"><LiaMascot state="working"/><span>A Lia está pesquisando referências e desenvolvendo seu plano…</span></div>}<div ref={end}/>
      </div>
      <div className="lia-chat-compose-area">
        {active?.context&&<details className="lia-chat-context"><summary><PanelMenuIcon name="forms"/>Briefing do plano nesta conversa</summary><pre>{active.context}</pre></details>}
        {storageError&&<p className="lia-chat-notice" role="alert">{storageError}</p>}
        {error&&<p className="lia-chat-error" role="alert">{error}</p>}
        {notice&&<p className="lia-chat-notice" role="status">{notice}</p>}
        <label className="lia-chat-plan-kind">Tipo de plano<select aria-label="Tipo de plano" disabled={busy || !!active?.draftId} value={planKind} onChange={e=>{const kind=e.target.value as PlanKind;setNewKind(kind);if(active)updateThread({...active,kind});}}><option value="work">Plano de trabalho</option><option value="business">Plano de negócios</option></select></label>
        <form className="lia-chat-composer" onSubmit={e=>{e.preventDefault();void send();}}><label className="lia-chat-sr" htmlFor="lia-planning-message">Mensagem para a Lia</label><textarea ref={textarea} id="lia-planning-message" rows={1} maxLength={2000} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} placeholder="Pergunte à Lia ou descreva seu evento"/><div className="lia-chat-composer-tools"><span><PanelMenuIcon name="aiCredits"/>Planejamento com a Lia</span><button type="submit" className="lia-chat-send" aria-label="Enviar mensagem" disabled={!input.trim()||busy||!available||!ready}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div></form>
        <div className="lia-chat-access"><span>{availability}</span>{statusError&&<button disabled={loadingStatus||busy} onClick={()=>void refreshStatus()}>Tentar novamente</button>}<small>Cada resposta concluída usa 1 geração de materiais.</small></div>
        <p className="lia-chat-footnote">A Lia pode cometer erros. Revise premissas e custos. Valores pesquisados são referências; confirme as cotações.</p>
      </div>
    </section>
  </div>;
}
