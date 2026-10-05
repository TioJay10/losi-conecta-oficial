import { useEffect, useRef, useState } from "react";
import { AI_TONES, callLosiAi, type AiResult, type AiStatus, type AiTone } from "../lib/losi-ai";
import "../losi-ai.css";

export function LosiAiWorkspace({context,company,onApply}:{context:Record<string,unknown>;company:string;onApply:(result:AiResult)=>void}){
 const [open,setOpen]=useState(false);
 const [tone,setTone]=useState<AiTone>("formal");
 const [status,setStatus]=useState<AiStatus|null>(null);
 const [statusLoading,setStatusLoading]=useState(false);
 const [instructions,setInstructions]=useState("");
 const [result,setResult]=useState<AiResult|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const generating=useRef(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function refresh(){
  setStatusLoading(true);
  try{const data=await callLosiAi({action:"status"});if(mounted.current)setStatus(data);}
  catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:"Não foi possível atualizar o saldo.");}
  finally{if(mounted.current)setStatusLoading(false);}
 }
 useEffect(()=>{if(open)void refresh();},[open]);
 const limit=status?.access.proposalLimit;
 const remaining=Math.max(0,(limit??0)-(status?.used.proposal??0));
 const available=Boolean(status?.configured&&status.access.allowed&&remaining>0);
 async function generate(){
  if(generating.current||!available)return;
  generating.current=true;setBusy(true);setMessage("");setResult(null);
  try{
   const data=await callLosiAi({action:"generate",kind:"proposal",tone,requestId:crypto.randomUUID(),instructions,
    context:{...context,company}});
   if(mounted.current){setResult(data.result);setMessage("Rascunho pronto. Revise antes de aplicar.");}
  }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:"Não foi possível gerar o conteúdo.");}
  finally{generating.current=false;if(mounted.current){setBusy(false);void refresh();}}
 }
 function apply(){
  if(!result)return;
  if(!window.confirm("Aplicar este rascunho? Os textos atuais de título, descrição, objetivo, metodologia e considerações serão substituídos."))return;
  onApply(result);
  setResult(null);setMessage("Conteúdo aplicado. Você pode editar antes de gerar o PDF.");
 }
 const locked=busy;
 return <section className="losi-ai-workspace" aria-labelledby="losi-ai-title">
  <div className="losi-ai-heading">
   <div className="losi-ai-brand">
    <div className={"lia-mascot"+(busy?" is-working":"")} aria-hidden="true">
     <img key={open?"open":"closed"} src="/lia-pavoa.webp" alt="" width={384} height={461} decoding="async" />
    </div>
    <div className="losi-ai-brand-copy"><span className="proposals-kicker">ASSISTENTE DE CONTEÚDO</span>
     <h2 id="losi-ai-title">LIA · Assistente LOSI</h2>
     <p>Crie os textos da proposta com a LIA. Revise o conteúdo antes de aplicar.</p>
     <span className="lia-activity">{busy?"A LIA está preparando seu rascunho…":open?"Vamos preparar seu próximo conteúdo?":"Sua assistente para propostas."}</span>
    </div>
   </div>
   <button type="button" className="proposals-secondary lia-tools-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M9 2h6l.5 2.5 2 1.2 2.5-.8 3 5.2-2 1.7v.4l2 1.7-3 5.2-2.5-.8-2 1.2L15 22H9l-.5-2.5-2-1.2-2.5.8-3-5.2 2-1.7v-.4l-2-1.7 3-5.2 2.5.8 2-1.2z"/><circle cx="12" cy="12" r="3"/></svg><span>{open?"Recolher":"Abrir ferramentas"}</span></button></div>
  {open&&<>
   <div className="losi-ai-balance">
    <span>{statusLoading?"Atualizando franquia…":status?.access.allowed?remaining+" de "+limit+" gerações disponíveis":"Acesso à IA em preparação"}</span>
    {status?.access.periodEnd&&<small>Renovação: {new Date(status.access.periodEnd).toLocaleDateString("pt-BR")}</small>}
    <button type="button" disabled={locked||statusLoading} onClick={()=>void refresh()}>Atualizar saldo</button>
   </div>
   {status&&!status.configured&&<p className="losi-ai-notice">A geração com IA aguarda ativação. Você pode continuar escrevendo e gerando seus documentos manualmente.</p>}
   {status?.configured&&!status.access.allowed&&<p className="losi-ai-notice">Sua conta ainda não tem acesso à geração com IA.</p>}
   <label className="losi-ai-field"><span>Tom do conteúdo</span>
    <select value={tone} disabled={locked} aria-describedby="losi-ai-tone-help" onChange={event=>setTone(event.target.value as AiTone)}>
     {Object.entries(AI_TONES).map(([value,option])=><option key={value} value={value}>{option.label}</option>)}
    </select>
   </label>
   <p id="losi-ai-tone-help" className="losi-ai-caption">{AI_TONES[tone].description}</p>
   <label className="losi-ai-field"><span>Como a LIA deve ajudar nesta proposta?</span>
    <textarea value={instructions} maxLength={6000} rows={4} disabled={locked} onChange={event=>setInstructions(event.target.value)} placeholder="Descreva o objetivo, o público e o que deve ser destacado. A IA usará os dados do formulário."/>
   </label>
   <p className="losi-ai-caption">Cada geração concluída consome uma unidade. Edição manual e download não consomem a franquia. Revise informações e orientações antes de compartilhar.</p>
   <button type="button" className="proposals-primary" disabled={!available||locked||instructions.trim().length<15} onClick={()=>void generate()}>{busy?"LIA está gerando…":"Gerar conteúdo com a LIA"}</button>
   {busy&&<div className="lia-generation-status" role="status" aria-live="polite" aria-atomic="true">
    <img className="lia-generation-image" src="/lia-pavoa.webp" alt="" width={384} height={461} aria-hidden="true" />
    <div><strong>LIA está criando seu conteúdo…</strong><p>Seu rascunho aparecerá aqui assim que estiver pronto.</p></div>
   </div>}
   {message&&<p role="status" className="losi-ai-notice">{message}</p>}
   {result&&<div className="losi-ai-review"><h3>{result.title}</h3><div className="losi-ai-preview">{[result.description,result.objective,result.methodology,result.notes].filter(Boolean).join("\n\n")}</div>
    <div className="losi-ai-actions"><button type="button" className="proposals-primary" onClick={apply}>Aplicar rascunho</button><button type="button" className="proposals-secondary" onClick={()=>setResult(null)}>Descartar rascunho</button></div>
   </div>}

  </>}
 </section>;
}
