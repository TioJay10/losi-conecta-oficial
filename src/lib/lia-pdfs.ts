import { jsPDF } from "jspdf";

export type SavedLiaPdf={id:string;title:string;edit_count:number;created_at:string;updated_at:string};
export const LIA_PDF_COLUMNS="id,title,edit_count,created_at,updated_at";

export function materialPdf(title:string,content:string,company:string){
 const doc=new jsPDF({unit:"mm",format:"a4"}),margin=18;
 const addHeader=()=>{doc.setFont("helvetica","bold");doc.setTextColor(7,26,51);doc.setFontSize(10);doc.text(doc.splitTextToSize(company,174).slice(0,2),margin,18);doc.setDrawColor(190,145,48);doc.line(margin,27,192,27);};
 addHeader();doc.setFontSize(18);
 const titleLines=doc.splitTextToSize(title,174);
 doc.text(titleLines,margin,37);let y=40+titleLines.length*8;
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
 return doc.output("datauristring").split(",")[1];
}
export function pdfBlob(base64:string){
 const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
 return new Blob([bytes],{type:"application/pdf"});
}
export function pdfFilename(title:string){
 return (title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").slice(0,70)||"material")+".pdf";
}
export function downloadPdf(base64:string,title:string){
 const url=URL.createObjectURL(pdfBlob(base64));
 const link=document.createElement("a");link.href=url;link.download=pdfFilename(title);
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
