import type { jsPDF } from "jspdf";

export type ProposalLayout="classic"|"geometric";
const shapes=[
 {points:[[0,0],[86,0],[29,100],[68,234],[31,297],[0,297]],color:[7,26,51]},
 {points:[[0,167],[65,54],[77,77],[0,210]],color:[20,94,168]},
 {points:[[0,210],[77,77],[78,80],[0,215]],color:[190,145,48]},
 {points:[[37,284],[53,256],[75,297],[30,297]],color:[20,94,168]},
];
const hexagons=Array.from({length:54},(_,i)=>{
 const column=Math.floor(i/9),row=i%9,x=20+column*39,y=20+row*45+(column%2?22.5:0);
 return Array.from({length:6},(_,point)=>[x+26*Math.cos(point*Math.PI/3),y+26*Math.sin(point*Math.PI/3)]);
});
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" preserveAspectRatio="none">'+hexagons.map(points=>'<polygon points="'+points.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="#eff2f6" stroke-width="0.25"/>').join('')+shapes.map(shape=>'<polygon points="'+shape.points.map(p=>p.join(',')).join(' ')+'" fill="rgb('+shape.color.join(',')+')"/>').join('')+'</svg>';
export const PROPOSAL_GEOMETRIC_BACKGROUND='data:image/svg+xml,'+encodeURIComponent(svg);

export function drawProposalGeometry(doc:jsPDF){
 doc.setDrawColor(239,242,246);doc.setLineWidth(.25);
 for(const points of hexagons)doc.lines(points.slice(1).map((p,i)=>[p[0]-points[i][0],p[1]-points[i][1]]),points[0][0],points[0][1],[1,1],"S",true);
 for(const shape of shapes){
  doc.setFillColor(shape.color[0],shape.color[1],shape.color[2]);
  doc.lines(shape.points.slice(1).map((p,i)=>[p[0]-shape.points[i][0],p[1]-shape.points[i][1]]),shape.points[0][0],shape.points[0][1],[1,1],"F",true);
 }
}
export function drawGeometricProposalCover(doc:jsPDF,supplier:string,title:string,recipient:string,location:string){
 drawProposalGeometry(doc);
 doc.setTextColor(7,26,51);doc.setFont("helvetica","bold");doc.setFontSize(14);
 const brand=doc.splitTextToSize(supplier,108).slice(0,4);
 doc.text(brand,190,30,{align:"right",lineHeightFactor:1.2});
 doc.setDrawColor(190,145,48);doc.setLineWidth(.8);doc.line(153,Math.max(48,30+brand.length*6),190,Math.max(48,30+brand.length*6));
 doc.setFontSize(21);doc.text("PROPOSTA",80,92);doc.text("COMERCIAL",80,102);
 doc.setFillColor(190,145,48);doc.rect(80,108,48,1.6,"F");
 let size=17,lines:string[]=[];
 do{doc.setFontSize(size);lines=doc.splitTextToSize(title,110);if(lines.length<=6)break;size-=1;}while(size>10);
 doc.setFontSize(size);doc.text(lines,80,124,{lineHeightFactor:1.25});
 const recipientY=Math.max(168,124+lines.length*size*.3528*1.25+12);
 doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(104,116,132);doc.text("APRESENTADA PARA",80,recipientY);
 doc.setFont("helvetica","bold");doc.setFontSize(12);doc.setTextColor(7,26,51);
 doc.text(doc.splitTextToSize(recipient||"Cliente / empresa",110).slice(0,4),80,recipientY+9,{lineHeightFactor:1.2});
 doc.setFontSize(7);doc.setTextColor(190,145,48);doc.text("PREPARADA POR",80,238);
 doc.setFontSize(10);doc.setTextColor(7,26,51);doc.text(doc.splitTextToSize(supplier,110).slice(0,3),80,247,{lineHeightFactor:1.2});
 doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(104,116,132);doc.text(doc.splitTextToSize(location||"Prestador de serviços",110).slice(0,2),80,263);
}
