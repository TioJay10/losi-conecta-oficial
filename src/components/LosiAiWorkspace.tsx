import { useEffect, useRef, useState } from "react";
import { LosiPdfHistory } from "./LosiPdfHistory";
import { downloadPdf, LIA_PDF_COLUMNS, materialPdf, PDF_LAYOUTS, type PdfLayout, type SavedLiaPdf } from "../lib/lia-pdfs";
import { supabase } from "../lib/supabase";
import { AI_TONES, callLosiAi, type AiResult, type AiStatus, type AiTone } from "../lib/losi-ai";
import "../losi-ai.css";

type Material={id:string;title:string;content:string;updated_at:string};
export function LosiAiWorkspace({context,company,onApply}:{context:Record<string,unknown>;company:string;onApply:(result:AiResult)=>void}){
 const [open,setOpen]=useState(false);
 const [kind,setKind]=useState<"proposal"|"material">("proposal");
 const [tones,setTones]=useState<{proposal:AiTone;material:AiTone}>({proposal:"formal",material:"educational"});
 const tone=tones[kind];
 const [status,setStatus]=useState<AiStatus|null>(null);
 const [statusLoading,setStatusLoading]=useState(false);
 const [instructions,setInstructions]=useState("");
 const [result,setResult]=useState<AiResult|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [title,setTitle]=useState("");
 const [content,setContent]=useState("");
 const [materialId,setMaterialId]=useState<string|null>(null);
 const [materials,setMaterials]=useState<Material[]>([]);
 const [saving,setSaving]=useState(false);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [pdfVersion,setPdfVersion]=useState(0);
 const [activePdf,setActivePdf]=useState<SavedLiaPdf|null>(null);
 const [editingPdf,setEditingPdf]=useState(false);
 const [pdfLayout,setPdfLayout]=useState<PdfLayout>("classic");
 const pdfSaving=useRef(false);
 const editor=useRef<HTMLDivElement>(null);
 const generating=useRef(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(editingPdf)editor.current?.querySelector<HTMLInputElement>('input:not([type="radio"])')?.focus({preventScroll:true});},[editingPdf,activePdf?.id]);
 async function refresh(){
  setStatusLoading(true);
  try{const data=await callLosiAi({action:"status"});if(mounted.current)setStatus(data);}
  catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:"Não foi possível atualizar o saldo.");}
  finally{if(mounted.current)setStatusLoading(false);}
 }
 async function loadMaterials(){
  setHistoryLoading(true);
  try{
   const {data,error}=await supabase.from("losi_ai_materials").select("id,title,content,updated_at").order("updated_at",{ascending:false}).limit(50);
   if(error) throw error;
   if(mounted.current)setMaterials(data??[]);
  }catch{if(mounted.current)setMessage("Não foi possível carregar os materiais salvos.");}
  finally{if(mounted.current)setHistoryLoading(false);}
 }
 useEffect(()=>{if(open){void refresh();void loadMaterials();}},[open]);
 const limit=kind==="proposal"?status?.access.proposalLimit:status?.access.materialLimit;
 const remaining=Math.max(0,(limit??0)-(status?.used[kind]??0));
 const available=Boolean(status?.configured&&status.access.allowed&&remaining>0);
 async function generate(){
  if(generating.current||!available)return;
  generating.current=true;setBusy(true);setMessage("");setResult(null);
  try{
   const data=await callLosiAi({action:"generate",kind,tone,requestId:crypto.randomUUID(),instructions,
    context:kind==="proposal"?{...context,company}:{title,company}});
   if(mounted.current){setResult(data.result);setMessage("Rascunho pronto. Revise antes de aplicar.");}
  }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:"Não foi possível gerar o conteúdo.");}
  finally{generating.current=false;if(mounted.current){setBusy(false);void refresh();}}
 }
 function apply(){
  if(!result)return;
  if(kind==="proposal"){
   if(!window.confirm("Aplicar este rascunho? Os textos atuais de título, descrição, objetivo, metodologia e considerações serão substituídos."))return;
   onApply(result);
  }else{
   if(content.trim()&&!window.confirm("Substituir o texto atual pelo rascunho gerado?"))return;
   setTitle(result.title);setContent(result.content);
  }
  setResult(null);setMessage("Conteúdo aplicado. Você pode editar antes de gerar o PDF.");
 }
 async function save(){
  if(saving||activePdf||!title.trim()||!content.trim())return;
  setSaving(true);setMessage("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw new Error("Entre novamente para salvar.");
   const id=materialId??crypto.randomUUID();
   const {error}=await supabase.from("losi_ai_materials").upsert({id,user_id:session.user.id,title:title.trim(),content,updated_at:new Date().toISOString()});
   if(error)throw new Error("Não foi possível salvar o material.");
   setMaterialId(id);setMessage("Material salvo na sua conta.");await loadMaterials();
  }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível salvar.");}
  finally{setSaving(false);}
 }
 async function remove(material:Material){
  if(!window.confirm('Excluir o material "'+material.title+'"?'))return;
  const {error}=await supabase.from("losi_ai_materials").delete().eq("id",material.id);
  if(error){setMessage("Não foi possível excluir o material.");return;}
  if(materialId===material.id){setMaterialId(null);setTitle("");setContent("");}
  await loadMaterials();setMessage("Material excluído.");
 }
 async function download(){
  if(pdfSaving.current||busy||saving||!title.trim()||!content.trim())return;
  if(editingPdf&&!window.confirm("Salvar esta correção? Esta é a única edição permitida para este PDF. Depois de salvar, você poderá visualizar, baixar ou excluir o arquivo."))return;
  pdfSaving.current=true;setSaving(true);setMessage("");
  try{
   if(activePdf&&!editingPdf){
    const {data,error}=await supabase.from("losi_ai_documents").select("title,pdf_base64").eq("id",activePdf.id).single();
    if(error||!data)throw new Error("Não foi possível baixar o PDF salvo. Atualize a lista e tente novamente.");
    downloadPdf(data.pdf_base64,data.title);return;
   }
   const pdf_base64=materialPdf(title.trim(),content,company,pdfLayout);
   if(pdf_base64.length>2800000)throw new Error("O PDF ficou muito grande. Reduza o conteúdo antes de salvar.");
   const payload={title:title.trim(),content,pdf_base64,layout:pdfLayout};
   const query=activePdf&&editingPdf
    ?supabase.from("losi_ai_documents").update(payload).eq("id",activePdf.id).eq("edit_count",0)
    :supabase.from("losi_ai_documents").insert(payload);
   const {data,error}=await query.select(LIA_PDF_COLUMNS).single();
   if(error||!data){
    if(activePdf&&editingPdf&&(error?.message?.includes("PDF_EDIT_LIMIT")||error?.code==="PGRST116"))throw new Error("Este PDF já foi editado ou excluído. Atualize a lista. Seu texto continua no editor.");
    throw new Error("Não foi possível salvar o PDF. Seu texto continua no editor; tente novamente.");
   }
   setActivePdf(data);setEditingPdf(false);setMaterialId(null);setResult(null);setPdfVersion(value=>value+1);
   setMessage(activePdf?"Correção salva. A única edição deste PDF foi utilizada.":"PDF salvo automaticamente na sua conta. Você pode abri-lo em PDFs gerados.");
   downloadPdf(pdf_base64,title);
  }catch(error){setMessage(error instanceof Error?error.message:"Não foi possível gerar o PDF. Tente novamente.");}
  finally{pdfSaving.current=false;setSaving(false);}
 }
 function editPdf(pdf:SavedLiaPdf,text:string){
  if(content.trim()&&!window.confirm("Abrir este PDF para editar? O texto atual do editor será substituído."))return;
  setActivePdf(pdf);setEditingPdf(true);setPdfLayout(pdf.layout);setMaterialId(null);setTitle(pdf.title);setContent(text);setResult(null);
  setMessage("Faça a correção e clique em Salvar edição e baixar PDF. Cancelar não utiliza sua edição.");
  editor.current?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
 }
 const locked=busy||saving;
 const editorLocked=locked||Boolean(activePdf&&!editingPdf);
 return <section className="losi-ai-workspace" aria-labelledby="losi-ai-title">
  <div className="losi-ai-heading">
   <div className="losi-ai-brand">
    <div className={"lia-mascot"+(busy?" is-working":"")} aria-hidden="true">
     <img key={open?"open":"closed"} src="/lia-pavoa.webp" alt="" width={384} height={461} decoding="async" />
    </div>
    <div className="losi-ai-brand-copy"><span className="proposals-kicker">ASSISTENTE DE CONTEÚDO</span>
     <h2 id="losi-ai-title">LIA · Assistente LOSI</h2>
     <p>Crie propostas e materiais com a LIA. Revise o conteúdo e gere seus documentos.</p>
     <span className="lia-activity">{busy?"A LIA está preparando seu rascunho…":open?"Vamos preparar seu próximo conteúdo?":"Sua assistente para propostas e materiais."}</span>
    </div>
   </div>
   <button type="button" className="proposals-secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?"Recolher":"Abrir ferramentas"}</button></div>
  {open&&<>
   <div className="losi-ai-tabs" role="group" aria-label="Tipo de conteúdo">
    <button type="button" aria-pressed={kind==="proposal"} disabled={locked} onClick={()=>{setKind("proposal");setResult(null);setMessage("");}}>Propostas</button>
    <button type="button" aria-pressed={kind==="material"} disabled={locked} onClick={()=>{setKind("material");setResult(null);setMessage("");}}>Materiais em PDF</button>
   </div>
   <div className="losi-ai-balance">
    <span>{statusLoading?"Atualizando franquia…":status?.access.allowed?remaining+" de "+limit+" gerações disponíveis":"Acesso à IA em preparação"}</span>
    {status?.access.periodEnd&&<small>Renovação: {new Date(status.access.periodEnd).toLocaleDateString("pt-BR")}</small>}
    <button type="button" disabled={locked||statusLoading} onClick={()=>void refresh()}>Atualizar saldo</button>
   </div>
   {status&&!status.configured&&<p className="losi-ai-notice">A geração com IA aguarda ativação. Você pode continuar escrevendo e gerando seus documentos manualmente.</p>}
   {status?.configured&&!status.access.allowed&&<p className="losi-ai-notice">Sua conta ainda não tem acesso à geração com IA.</p>}
   <label className="losi-ai-field"><span>Tom do conteúdo</span>
    <select value={tone} disabled={locked} aria-describedby="losi-ai-tone-help" onChange={event=>setTones(current=>({...current,[kind]:event.target.value as AiTone}))}>
     {Object.entries(AI_TONES).map(([value,option])=><option key={value} value={value}>{option.label}</option>)}
    </select>
   </label>
   <p id="losi-ai-tone-help" className="losi-ai-caption">{AI_TONES[tone].description}</p>
   <label className="losi-ai-field"><span>{kind==="proposal"?"Como a LIA deve ajudar nesta proposta?":"Qual material você quer criar?"}</span>
    <textarea value={instructions} maxLength={6000} rows={4} disabled={locked} onChange={event=>setInstructions(event.target.value)} placeholder={kind==="proposal"?"Descreva o objetivo, o público e o que deve ser destacado. A IA usará os dados do formulário.":"Ex.: Treinamento de atendimento para monitores iniciantes, com exemplos e perguntas de revisão."}/>
   </label>
   <p className="losi-ai-caption">Cada geração concluída consome uma unidade. Edição manual e download não consomem a franquia. Revise informações e orientações antes de compartilhar.</p>
   <button type="button" className="proposals-primary" disabled={!available||locked||(kind==="material"&&Boolean(activePdf&&!editingPdf))||instructions.trim().length<15} onClick={()=>void generate()}>{busy?"LIA está gerando…":"Gerar conteúdo com a LIA"}</button>
   {busy&&<div className="lia-generation-status" role="status" aria-live="polite" aria-atomic="true">
    <img className="lia-generation-image" src="/lia-pavoa.webp" alt="" width={384} height={461} aria-hidden="true" />
    <div><strong>LIA está criando seu conteúdo…</strong><p>Seu rascunho aparecerá aqui assim que estiver pronto.</p></div>
   </div>}
   {message&&<p role="status" className="losi-ai-notice">{message}</p>}
   {result&&<div className="losi-ai-review"><h3>{result.title}</h3><div className="losi-ai-preview">{kind==="material"?result.content:[result.description,result.objective,result.methodology,result.notes].filter(Boolean).join("\n\n")}</div>
    <div className="losi-ai-actions"><button type="button" className="proposals-primary" onClick={apply}>Aplicar rascunho</button><button type="button" className="proposals-secondary" onClick={()=>setResult(null)}>Descartar rascunho</button></div>
   </div>}
   {kind==="material"&&<div className="losi-ai-material-editor" ref={editor}>
    <div className="losi-ai-heading"><h3>Editor do material</h3><button type="button" className="proposals-secondary" disabled={locked} onClick={()=>{if(content&&!window.confirm("Abrir um novo material? Salve o atual antes de continuar."))return;setMaterialId(null);setActivePdf(null);setEditingPdf(false);setTitle("");setContent("");setResult(null);setMessage("");}}>Novo material</button></div>
    <fieldset className="lia-pdf-layouts" disabled={editorLocked}><legend>Layout do PDF</legend>
     <div className="lia-pdf-layout-options">{(Object.entries(PDF_LAYOUTS) as [PdfLayout,typeof PDF_LAYOUTS[PdfLayout]][]).map(([value,option])=><label key={value} className={"lia-pdf-layout-option"+(pdfLayout===value?" is-selected":"")}>
      <img src={option.preview} alt="" width={212} height={300} loading="lazy"/>
      <span><input type="radio" name="lia-pdf-layout" value={value} checked={pdfLayout===value} onChange={()=>setPdfLayout(value)}/><strong>{option.label}</strong></span>
      <small>{option.description}</small>
     </label>)}</div>
    </fieldset>
    <label className="losi-ai-field"><span>Título</span><input disabled={editorLocked} value={title} maxLength={160} onChange={event=>setTitle(event.target.value)}/></label>
    <label className="losi-ai-field"><span>Conteúdo</span><textarea disabled={editorLocked} value={content} maxLength={60000} rows={14} onChange={event=>setContent(event.target.value)} placeholder="Escreva seu material ou aplique um rascunho gerado pela IA."/></label>
    {editingPdf&&<p className="losi-ai-notice">Você pode salvar uma única edição deste PDF. Revise todo o texto antes de confirmar.</p>}
    {activePdf&&!editingPdf&&<p className="losi-ai-caption">Este PDF está salvo. {activePdf.edit_count?"A edição já foi utilizada.":"Para corrigir, use Editar PDF no histórico abaixo."}</p>}
    <div className="losi-ai-actions"><button type="button" className="proposals-secondary" disabled={locked||Boolean(activePdf)||!title.trim()||!content.trim()} onClick={()=>void save()}>{saving?"Salvando…":"Salvar rascunho"}</button><button type="button" className="proposals-primary" disabled={locked||!title.trim()||!content.trim()} onClick={()=>void download()}>{saving?"Aguarde…":editingPdf?"Salvar edição e baixar PDF":activePdf?"Baixar PDF":"Gerar e salvar PDF"}</button>
     {editingPdf&&<button type="button" className="proposals-secondary" disabled={locked} onClick={()=>{if(!window.confirm("Cancelar a correção? As alterações do editor serão descartadas e sua edição continuará disponível."))return;setActivePdf(null);setEditingPdf(false);setTitle("");setContent("");setResult(null);setMessage("Edição cancelada. O PDF salvo foi preservado.");}}>Cancelar edição</button>}
    </div>
    <LosiPdfHistory version={pdfVersion} disabled={locked} onEdit={editPdf} onDeleted={id=>{if(activePdf?.id===id){setActivePdf(null);setEditingPdf(false);setTitle("");setContent("");setResult(null);}}}/>
    <h3>Rascunhos salvos</h3>
    {historyLoading?<p>Carregando materiais…</p>:materials.length?materials.map(material=><div className="losi-ai-history-row" key={material.id}><span>{material.title}</span><div className="losi-ai-actions"><button type="button" disabled={locked} onClick={()=>{if(content&&!window.confirm("Abrir este material? Alterações não salvas do editor serão substituídas."))return;setMaterialId(material.id);setActivePdf(null);setEditingPdf(false);setTitle(material.title);setContent(material.content);setResult(null);}}>Abrir</button><button type="button" disabled={locked} onClick={()=>void remove(material)}>Excluir</button></div></div>):<p>Nenhum material salvo. Escreva um conteúdo e salve para começar.</p>}
   </div>}
  </>}
 </section>;
}
