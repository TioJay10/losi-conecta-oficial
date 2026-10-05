import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { LIA_PDF_COLUMNS, PDF_LAYOUTS, pdfBlob, pdfFilename, type SavedLiaPdf } from "../lib/lia-pdfs";

export function LosiPdfHistory({version,disabled,onEdit,onDeleted}:{version:number;disabled:boolean;onEdit:(pdf:SavedLiaPdf,content:string)=>void;onDeleted:(id:string)=>void}){
 const [items,setItems]=useState<SavedLiaPdf[]>([]);
 const [loading,setLoading]=useState(true);
 const [more,setMore]=useState(false);
 const [message,setMessage]=useState("");
 const [working,setWorking]=useState(false);
 const [preview,setPreview]=useState<{id:string;title:string;url:string}|null>(null);
 const mounted=useRef(true),operation=useRef(false),listRequest=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url);},[preview]);
 async function load(offset=0){
  const request=++listRequest.current;
  setLoading(true);setMessage("");
  try{
   const {data,error}=await supabase.from("losi_ai_documents").select(LIA_PDF_COLUMNS).order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+49);
   if(error)throw error;
   if(mounted.current&&request===listRequest.current){setItems(current=>offset?[...current,...(data??[])]:data??[]);setMore(data?.length===50);}
  }catch{if(mounted.current&&request===listRequest.current)setMessage("Não foi possível carregar seus PDFs. Clique em Atualizar para tentar novamente.");}
  finally{if(mounted.current&&request===listRequest.current)setLoading(false);}
 }
 useEffect(()=>{setPreview(null);void load();},[version]);
 async function openPdf(pdf:SavedLiaPdf,edit=false){
  if(operation.current||disabled)return;
  operation.current=true;setWorking(true);setMessage("");
  try{
   const {data,error}=await supabase.from("losi_ai_documents").select(edit?LIA_PDF_COLUMNS+",content":"id,title,pdf_base64").eq("id",pdf.id).single();
   if(error||!data)throw new Error("Não foi possível abrir o PDF. Atualize a lista e tente novamente.");
   if(!mounted.current)return;
   if(edit){
    const document=data as unknown as SavedLiaPdf&{content:string};
    if(document.edit_count>=1)throw new Error("Este PDF já utilizou sua única edição.");
    onEdit(document,document.content);
   }else{
    const document=data as unknown as {id:string;title:string;pdf_base64:string};
    setPreview({id:document.id,title:document.title,url:URL.createObjectURL(pdfBlob(document.pdf_base64))});
   }
  }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:"Não foi possível abrir o PDF.");}
  finally{operation.current=false;if(mounted.current)setWorking(false);}
 }
 async function remove(pdf:SavedLiaPdf){
  if(operation.current||disabled||!window.confirm('Excluir o PDF "'+pdf.title+'"? Esta ação remove o arquivo salvo da sua conta.'))return;
  operation.current=true;setWorking(true);setMessage("");
  try{
   const {data,error}=await supabase.from("losi_ai_documents").delete().eq("id",pdf.id).select("id").single();
   if(error||!data)throw new Error("Não foi possível excluir o PDF. Atualize a lista e tente novamente.");
   if(mounted.current){if(preview?.id===pdf.id)setPreview(null);onDeleted(pdf.id);await load();setMessage("PDF excluído da sua conta.");}
  }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:"Não foi possível excluir o PDF.");}
  finally{operation.current=false;if(mounted.current)setWorking(false);}
 }
 const locked=disabled||working||loading;
 return <section className="lia-pdf-history" aria-labelledby="lia-pdf-history-title">
  <div className="losi-ai-heading"><h3 id="lia-pdf-history-title">PDFs gerados</h3><button type="button" className="proposals-secondary" disabled={locked} onClick={()=>void load()}>Atualizar</button></div>
  <p className="losi-ai-caption">Salvos na sua conta. Cada PDF permite salvar uma única edição; visualizar e baixar continuam disponíveis.</p>
  {message&&<p className="losi-ai-notice" role="status">{message}</p>}
  {loading&&<p role="status">Carregando PDFs…</p>}
  {!loading&&!items.length&&!message&&<p>Nenhum PDF salvo. Gere seu primeiro PDF no editor acima.</p>}
  {items.map(pdf=><div className="losi-ai-history-row" key={pdf.id}>
   <div className="lia-pdf-details"><strong>{pdf.title}</strong><small>{new Date(pdf.created_at).toLocaleDateString("pt-BR")} · {PDF_LAYOUTS[pdf.layout].label} · {pdf.edit_count?"Edição utilizada":"1 edição disponível"}</small></div>
   <div className="losi-ai-actions">
    <button type="button" disabled={locked} onClick={()=>void openPdf(pdf)}>Ver PDF</button>
    <button type="button" disabled={locked||pdf.edit_count>=1} onClick={()=>void openPdf(pdf,true)}>Editar PDF</button>
    <button type="button" className="lia-pdf-delete" disabled={locked} aria-label={'Excluir PDF "'+pdf.title+'"'} title="Excluir PDF" onClick={()=>void remove(pdf)}>
     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>
    </button>
   </div>
  </div>)}
  {more&&<button type="button" className="proposals-secondary" disabled={locked} onClick={()=>void load(items.length)}>Carregar mais PDFs</button>}
  {preview&&<div className="lia-pdf-viewer">
   <div className="losi-ai-heading"><h3>{preview.title}</h3><button type="button" className="proposals-secondary" onClick={()=>setPreview(null)}>Fechar visualização</button></div>
   <div className="losi-ai-actions"><a href={preview.url} target="_blank" rel="noopener noreferrer">Abrir em outra aba</a><a href={preview.url} download={pdfFilename(preview.title)}>Baixar PDF</a></div>
   <iframe src={preview.url} title={'Visualização do PDF "'+preview.title+'"'}/>
  </div>}
 </section>;
}
