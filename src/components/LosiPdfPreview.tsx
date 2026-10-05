import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { materialPdf, pdfBlob, PDF_LAYOUTS, type PdfLayout } from "../lib/lia-pdfs";

export function LosiPdfPreview({title,content,company,layout,savedPdfId}:{title:string;content:string;company:string;layout:PdfLayout;savedPdfId?:string}){
 const [url,setUrl]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const example=!savedPdfId&&(!title.trim()||!content.trim());
 useEffect(()=>{
  let cancelled=false,objectUrl:string|undefined;
  setUrl(null);setLoading(true);setError("");
  async function render(){
   try{
    let encoded:string;
    if(savedPdfId){
     const {data,error}=await supabase.from("losi_ai_documents").select("pdf_base64").eq("id",savedPdfId).single();
     if(error||!data)throw new Error("saved PDF unavailable");
     encoded=data.pdf_base64;
    }else{
     encoded=materialPdf(title.trim()||"Título do seu material",content.trim()?content:"Seu conteúdo aparecerá aqui. Escreva no editor ou aplique um rascunho da LIA para visualizar o material completo.",company,layout);
    }
    if(cancelled)return;
    objectUrl=URL.createObjectURL(pdfBlob(encoded));setUrl(objectUrl);
   }catch{if(!cancelled)setError("Não foi possível carregar a prévia do PDF. Tente novamente.");}
   finally{if(!cancelled)setLoading(false);}
  }
  // Wait for typing to pause before rebuilding the local document.
  const timer=setTimeout(()=>void render(),savedPdfId?0:450);
  return()=>{cancelled=true;clearTimeout(timer);if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[title,content,company,layout,savedPdfId,retry]);
 return <section className="lia-pdf-viewer lia-pdf-live-preview" aria-labelledby="lia-pdf-preview-title">
  <h3 id="lia-pdf-preview-title">Prévia do PDF · {PDF_LAYOUTS[layout].label}</h3>
  <p className="losi-ai-caption">{savedPdfId?"Arquivo salvo na sua conta.":example?"Prévia do layout com texto de exemplo. Preencha o editor para visualizar seu conteúdo.":"Prévia do conteúdo do editor. Trocar o layout ou editar o texto atualiza esta visualização, sem consumir a franquia."}</p>
  {loading&&<p role="status" className="losi-ai-caption">Atualizando prévia…</p>}
  {error&&<><p role="status" className="losi-ai-notice">{error}</p><button type="button" className="proposals-secondary" onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></>}
  {url&&<>
   <div className="losi-ai-actions"><a href={url} target="_blank" rel="noopener noreferrer">Abrir prévia em outra aba</a></div>
   <iframe key={url} src={url+"#view=FitH"} title={"Prévia do PDF no layout "+PDF_LAYOUTS[layout].label}/>
  </>}
 </section>;
}
