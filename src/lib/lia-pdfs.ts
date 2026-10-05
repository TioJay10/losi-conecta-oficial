import { jsPDF } from "jspdf";

export const PDF_LAYOUTS={
 classic:{label:"Clássico LOSI",description:"Modelo atual: título e conteúdo direto na primeira página.",preview:"/pdf-layout-classic.webp"},
 geometric:{label:"Executivo geométrico",description:"Capa com faixas diagonais, fundo geométrico discreto e páginas com cabeçalho azul.",preview:"/pdf-layout-geometric.webp"},
} as const;
export type PdfLayout=keyof typeof PDF_LAYOUTS;
export type SavedLiaPdf={id:string;title:string;layout:PdfLayout;edit_count:number;created_at:string;updated_at:string};
export const LIA_PDF_COLUMNS="id,title,layout,edit_count,created_at,updated_at";

export function materialPdf(title:string,content:string,company:string,layout:PdfLayout="classic"){
 if(layout==="geometric")return geometricPdf(title,content,company);
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

function geometricPdf(title:string,content:string,company:string){
 const doc=new jsPDF({unit:"mm",format:"a4"});
 const polygon=(points:number[][],fill:[number,number,number])=>{
  doc.setFillColor(...fill);
  doc.lines(points.slice(1).map((point,index)=>[point[0]-points[index][0],point[1]-points[index][1]]),points[0][0],points[0][1],[1,1],"F",true);
 };
 // Authored vector geometry; the reference's logo and text are never reused.
 doc.setDrawColor(239,242,246);doc.setLineWidth(.25);
 for(let column=0;column<6;column++)for(let row=0;row<9;row++){
  const x=20+column*39,y=20+row*45+(column%2?22.5:0),r=26;
  const points=Array.from({length:6},(_,i)=>[x+r*Math.cos(i*Math.PI/3),y+r*Math.sin(i*Math.PI/3)]);
  doc.lines(points.slice(1).map((point,index)=>[point[0]-points[index][0],point[1]-points[index][1]]),points[0][0],points[0][1],[1,1],"S",true);
 }
 polygon([[0,0],[86,0],[29,100],[68,234],[31,297],[0,297]],[7,26,51]);
 polygon([[0,167],[65,54],[77,77],[0,210]],[20,94,168]);
 polygon([[0,210],[77,77],[78,80],[0,215]],[190,145,48]);
 polygon([[37,284],[53,256],[75,297],[30,297]],[20,94,168]);
 doc.setFont("helvetica","bold");doc.setFontSize(15);doc.setTextColor(7,26,51);
 const companyLines=doc.splitTextToSize(company,104);
 doc.text(companyLines.slice(0,4),190,30,{align:"right",lineHeightFactor:1.3});
 const companyRuleY=Math.max(48,30+(Math.min(companyLines.length,4)-1)*6.9+6);
 doc.setDrawColor(190,145,48);doc.setLineWidth(.8);doc.line(151,companyRuleY,190,companyRuleY);
 let fontSize=32,titleLines:string[]=[];
 do{doc.setFontSize(fontSize);titleLines=doc.splitTextToSize(title,110);if(titleLines.length<=6)break;fontSize-=2;}while(fontSize>=20);
 doc.setFontSize(fontSize);doc.setTextColor(7,26,51);
 const titleHeight=titleLines.length*fontSize*.3528*1.2;
 doc.text(titleLines,80,Math.max(94,145-titleHeight/2),{lineHeightFactor:1.2});
 doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(83,97,116);
 doc.text("LOSI CONECTA",190,263,{align:"right"});

 const margin=22,width=166;
 const header=()=>{
  doc.setFillColor(7,26,51);doc.rect(0,0,210,28,"F");
  polygon([[185,0],[210,0],[210,28],[170,28]],[20,94,168]);
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.setTextColor(255,255,255);
  doc.text(doc.splitTextToSize(company,140).slice(0,2),margin,12);
  doc.setDrawColor(190,145,48);doc.setLineWidth(.6);doc.line(margin,28,188,28);
 };
 const bodyFont=()=>{doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(27,38,53);};
 doc.addPage();header();
 doc.setFontSize(19);doc.setTextColor(7,26,51);
 const heading=doc.splitTextToSize(title,width);doc.text(heading,margin,45);
 let y=48+heading.length*8;bodyFont();
 for(const paragraph of content.split("\n")){
  for(const line of doc.splitTextToSize(paragraph.replace(/\t/g,"    "),width)){
   if(y>270){doc.addPage();header();bodyFont();y=43;}
   doc.text(line,margin,y);y+=5.5;
  }
  y+=2;
 }
 const pages=doc.getNumberOfPages();
 for(let page=1;page<=pages;page++){
  doc.setPage(page);doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(page===1?83:104,116,132);
  doc.text(page+" / "+pages,188,285,{align:"right"});
  if(page>1){doc.setDrawColor(220,225,231);doc.setLineWidth(.25);doc.line(margin,279,188,279);doc.text("LOSI CONECTA",margin,285);}
 }
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
