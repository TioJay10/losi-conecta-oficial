import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";
import { callLosiAi, type AiResult, type AiStatus } from "../lib/losi-ai";
import "../losi-ai.css";

type Material={id:string;title:string;content:string;updated_at:string};
export function LosiAiWorkspace({context,company,onApply}:{context:Record<string,unknown>;company:string;onApply:(result:AiResult)=>void}){
 const [open,setOpen]=useState(false);
 const [kind,setKind]=useState<"proposal"|"material">("proposal");
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
 const generating=useRef(false);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
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
   const data=await callLosiAi({action:"generate",kind,requestId:crypto.randomUUID(),instructions,
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
  if(saving||!title.trim()||!content.trim())return;
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
 function download(){
  try{
   const doc=new jsPDF({unit:"mm",format:"a4"}),margin=18;
   let y=42;
   const addHeader=()=>{doc.setFont("helvetica","bold");doc.setTextColor(7,26,51);doc.setFontSize(10);doc.text(doc.splitTextToSize(company,174).slice(0,2),margin,18);doc.setDrawColor(190,145,48);doc.line(margin,27,192,27);};
   addHeader();doc.setFontSize(18);
   const titleLines=doc.splitTextToSize(title,174);
   doc.text(titleLines,margin,37);y=40+titleLines.length*8;
   doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(27,38,53);
   for(const paragraph of content.split("\n")){
    const lines=doc.splitTextToSize(paragraph.replace(/\t/g,"    "),174);
    for(const line of lines){
     if(y>270){doc.addPage();addHeader();doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(27,38,53);y=37;}
     doc.text(line,margin,y);y+=5.5;
    }
    y+=2;
   }
   const pages=doc.getNumberOfPages();
   for(let page=1;page<=pages;page++){doc.setPage(page);doc.setFontSize(8);doc.setTextColor(104,116,132);doc.text("LOSI CONECTA · "+page+" / "+pages,margin,285);}
   doc.setProperties({title,author:company});
   doc.save((title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").slice(0,70)||"material")+".pdf");
   setMessage("PDF gerado. Salve o material para encontrá-lo novamente.");
  }catch{setMessage("Não foi possível gerar o PDF. Tente novamente.");}
 }
 const locked=busy||saving;
 return <section className="losi-ai-workspace" aria-labelledby="losi-ai-title">
  <div className="losi-ai-heading"><div><span className="proposals-kicker">CONTEÚDO PROFISSIONAL</span><h2 id="losi-ai-title">Propostas e materiais com IA</h2><p>Crie um rascunho, revise e use seus documentos no formato habitual.</p></div>
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
   <label className="losi-ai-field"><span>{kind==="proposal"?"Como a IA deve ajudar nesta proposta?":"Qual material você quer criar?"}</span>
    <textarea value={instructions} maxLength={6000} rows={4} disabled={locked} onChange={event=>setInstructions(event.target.value)} placeholder={kind==="proposal"?"Descreva o objetivo, o público e o que deve ser destacado. A IA usará os dados do formulário.":"Ex.: Treinamento de atendimento para monitores iniciantes, com exemplos e perguntas de revisão."}/>
   </label>
   <p className="losi-ai-caption">Cada geração concluída consome uma unidade. Edição manual e download não consomem a franquia. Revise informações e orientações antes de compartilhar.</p>
   <button type="button" className="proposals-primary" disabled={!available||locked||instructions.trim().length<15} onClick={()=>void generate()}>{busy?"Gerando conteúdo…":"Gerar conteúdo com IA"}</button>
   {message&&<p role="status" className="losi-ai-notice">{message}</p>}
   {result&&<div className="losi-ai-review"><h3>{result.title}</h3><div className="losi-ai-preview">{kind==="material"?result.content:[result.description,result.objective,result.methodology,result.notes].filter(Boolean).join("\n\n")}</div>
    <div className="losi-ai-actions"><button type="button" className="proposals-primary" onClick={apply}>Aplicar rascunho</button><button type="button" className="proposals-secondary" onClick={()=>setResult(null)}>Descartar rascunho</button></div>
   </div>}
   {kind==="material"&&<div className="losi-ai-material-editor">
    <div className="losi-ai-heading"><h3>Editor do material</h3><button type="button" className="proposals-secondary" disabled={locked} onClick={()=>{if(content&&!window.confirm("Abrir um novo material? Salve o atual antes de continuar."))return;setMaterialId(null);setTitle("");setContent("");setResult(null);}}>Novo material</button></div>
    <label className="losi-ai-field"><span>Título</span><input value={title} maxLength={160} onChange={event=>setTitle(event.target.value)}/></label>
    <label className="losi-ai-field"><span>Conteúdo</span><textarea value={content} maxLength={60000} rows={14} onChange={event=>setContent(event.target.value)} placeholder="Escreva seu material ou aplique um rascunho gerado pela IA."/></label>
    <div className="losi-ai-actions"><button type="button" className="proposals-secondary" disabled={locked||!title.trim()||!content.trim()} onClick={()=>void save()}>{saving?"Salvando…":"Salvar material"}</button><button type="button" className="proposals-primary" disabled={locked||!title.trim()||!content.trim()} onClick={download}>Baixar PDF</button></div>
    <h3>Materiais salvos</h3>
    {historyLoading?<p>Carregando materiais…</p>:materials.length?materials.map(material=><div className="losi-ai-history-row" key={material.id}><span>{material.title}</span><div className="losi-ai-actions"><button type="button" disabled={locked} onClick={()=>{if(content&&!window.confirm("Abrir este material? Alterações não salvas do editor serão substituídas."))return;setMaterialId(material.id);setTitle(material.title);setContent(material.content);setResult(null);}}>Abrir</button><button type="button" disabled={locked} onClick={()=>void remove(material)}>Excluir</button></div></div>):<p>Nenhum material salvo. Escreva um conteúdo e salve para começar.</p>}
   </div>}
  </>}
 </section>;
}
