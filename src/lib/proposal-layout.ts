import type { jsPDF } from "jspdf";
import { ShadingPattern } from "jspdf";

export type ProposalLayout="classic"|"geometric"|"editorial"|"waves"|"modern"|"corporate";
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

/** Curved editorial cover, drawn as PDF vectors rather than a template bitmap. */
export function drawEditorialProposalCover(doc:jsPDF,supplier:string,title:string,recipient:string,location:string,image=""){
 doc.setFillColor(7,26,51);doc.rect(0,0,210,297,"F");
 doc.setFillColor(190,145,48);
 doc.path([{op:"m",c:[0,0]},{op:"l",c:[210,0]},{op:"l",c:[210,109]},{op:"c",c:[170,112,158,69,112,65]},{op:"c",c:[75,60,92,22,0,12]},{op:"h",c:[]}]);doc.fill();
 doc.setFillColor(255,255,255);doc.circle(99,134,69,"F");
 doc.path([{op:"m",c:[112,67]},{op:"c",c:[159,70,162,123,210,110]},{op:"l",c:[210,168]},{op:"c",c:[160,157,162,195,112,201]},{op:"h",c:[]}]);doc.fill();
 doc.setFillColor(18,42,69);doc.circle(99,134,53,"F");
 if(image){
  doc.saveGraphicsState();doc.circle(99,134,53,null);doc.clip();doc.discardPath();
  doc.addImage(image,"JPEG",46,81,106,106);doc.restoreGraphicsState();
 }else{
  doc.setFont("helvetica","bold");doc.setFontSize(40);doc.setTextColor(240,217,154);
  const initials=supplier.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase()||"LC";
  doc.text(initials,99,139,{align:"center"});
 }
 doc.setTextColor(7,26,51);doc.setFont("helvetica","bold");doc.setFontSize(12);
 const brand=doc.splitTextToSize(supplier,105);
 doc.text(brand.slice(0,3),192,24,{align:"right",lineHeightFactor:1.2});
 doc.setTextColor(255,255,255);doc.setFontSize(9);doc.setFont("helvetica","normal");doc.text("PROPOSTA COMERCIAL",18,218);
 let size=24,lines:string[]=[];
 do{doc.setFont("helvetica","bold");doc.setFontSize(size);lines=doc.splitTextToSize(title,174);if(lines.length*size*.3528*1.15<=25)break;size-=1;}while(size>10);
 doc.setFontSize(size);doc.text(lines,18,231,{lineHeightFactor:1.15});
 const recipientY=Math.max(254,231+lines.length*size*.3528*1.15+3);
 doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(240,217,154);
 doc.text(doc.splitTextToSize(recipient||"Cliente / empresa",174).slice(0,2),18,recipientY,{lineHeightFactor:1.2});
 doc.setTextColor(220,229,241);doc.setFontSize(7);
 doc.text(doc.splitTextToSize(location||"Prestador de serviços",174).slice(0,1),18,269);
}

/** Airy blue ribbons remain sharp at print resolution. */
export function drawWaveProposalCover(doc:jsPDF,supplier:string,title:string,recipient:string,location:string){
 doc.setFillColor(255,255,255);doc.rect(0,0,210,297,"F");
 const ribbon=(path:Array<{op:string;c:number[]}>,color:[number,number,number])=>{
  doc.setFillColor(...color);doc.path(path);doc.fill();
 };
 ribbon([{op:"m",c:[0,0]},{op:"l",c:[76,0]},{op:"c",c:[56,92,25,126,55,194]},{op:"c",c:[67,229,80,263,85,297]},{op:"l",c:[52,297]},{op:"c",c:[30,230,2,173,10,106]},{op:"c",c:[15,67,30,28,12,0]},{op:"h",c:[]}],[225,244,253]);
 ribbon([{op:"m",c:[0,70]},{op:"c",c:[22,86,71,100,72,148]},{op:"c",c:[73,211,24,231,0,256]},{op:"l",c:[0,225]},{op:"c",c:[22,203,52,174,41,140]},{op:"c",c:[30,106,15,104,0,94]},{op:"h",c:[]}],[199,231,249]);
 doc.setLineWidth(.17);
 for(let i=0;i<27;i++){
  const shift=i*.9;
  doc.setDrawColor(123,192,229);
  doc.path([{op:"m",c:[17+shift,0]},{op:"c",c:[50+shift,87,4+shift,120,27+shift,189]},{op:"c",c:[42+shift,235,59+shift,271,65+shift,297]}]);doc.stroke();
  doc.setDrawColor(145,203,235);
  doc.path([{op:"m",c:[0,96+shift]},{op:"c",c:[58,122+shift,57,178+shift,0,216+shift]}]);doc.stroke();
 }
 doc.setDrawColor(39,134,191);doc.setLineWidth(.45);
 doc.path([{op:"m",c:[36,0]},{op:"c",c:[66,89,20,118,45,189]},{op:"c",c:[64,241,76,273,82,297]}]);doc.stroke();
 doc.setTextColor(7,26,51);doc.setFont("helvetica","bold");doc.setFontSize(13);
 doc.text(doc.splitTextToSize(supplier,104).slice(0,3),192,26,{align:"right",lineHeightFactor:1.2});
 doc.setFontSize(24);doc.text("PROPOSTA",88,113);doc.text("COMERCIAL",88,125);
 doc.setDrawColor(39,134,191);doc.setLineWidth(.7);doc.line(88,133,126,133);
 let size=16,lines:string[]=[];
 do{doc.setFontSize(size);lines=doc.splitTextToSize(title,104);if(lines.length*size*.3528*1.25<=38)break;size-=1;}while(size>10);
 doc.text(lines,88,149,{lineHeightFactor:1.25});
 const recipientY=Math.max(196,149+lines.length*size*.3528*1.25+10);
 doc.setTextColor(82,97,116);doc.setFont("helvetica","normal");doc.setFontSize(7);doc.text("APRESENTADA PARA",88,recipientY);
 doc.setTextColor(7,26,51);doc.setFont("helvetica","bold");doc.setFontSize(11);
 doc.text(doc.splitTextToSize(recipient||"Cliente / empresa",104).slice(0,3),88,recipientY+9,{lineHeightFactor:1.2});
 doc.setTextColor(39,111,155);doc.setFontSize(7);doc.text("PREPARADA POR",88,241);
 doc.setTextColor(7,26,51);doc.setFontSize(10);doc.text(doc.splitTextToSize(supplier,104).slice(0,3),88,250,{lineHeightFactor:1.2});
 doc.setTextColor(82,97,116);doc.setFont("helvetica","normal");doc.setFontSize(7);
 doc.text(doc.splitTextToSize(location||"Prestador de serviços",104).slice(0,1),88,266);
}

/** White editorial field and layered orange/charcoal sweep, matching the reference composition. */
export function drawModernProposalCover(doc:jsPDF,supplier:string,title:string,recipient:string,location:string){
 doc.setFillColor(52,58,70);doc.rect(0,0,210,297,"F");
 doc.setFillColor(42,47,59);
 doc.path([{op:"m",c:[0,297]},{op:"c",c:[108,278,176,189,210,120]},{op:"l",c:[210,52]},{op:"c",c:[175,190,107,269,0,297]},{op:"h",c:[]}]);doc.fill();
 doc.setFillColor(62,68,81);
 doc.path([{op:"m",c:[0,297]},{op:"c",c:[97,288,164,251,210,204]},{op:"l",c:[210,297]},{op:"h",c:[]}]);doc.fill();
 doc.saveGraphicsState();
 doc.path([{op:"m",c:[181,0]},{op:"l",c:[210,0]},{op:"l",c:[210,52]},{op:"c",c:[178,190,105,267,0,297]},{op:"c",c:[108,236,165,139,181,0]},{op:"h",c:[]}]);doc.clip();doc.discardPath();
 doc.advancedAPI(pdf=>{
  const gradient=new ShadingPattern("axial",[0,0,0,297],[{offset:0,color:[255,215,48]},{offset:1,color:[255,96,0]}]);
  pdf.addShadingPattern("modern-orange",gradient);
  pdf.rect(0,0,210,297,null);pdf.fill({key:"modern-orange",matrix:pdf.unitMatrix});
 });
 doc.restoreGraphicsState();
 doc.setFillColor(239,240,242);
 doc.path([{op:"m",c:[0,0]},{op:"l",c:[181,0]},{op:"c",c:[165,139,108,236,0,297]},{op:"h",c:[]}]);doc.fill();
 doc.setFillColor(255,255,255);
 doc.path([{op:"m",c:[0,0]},{op:"l",c:[154,0]},{op:"c",c:[167,141,96,241,0,297]},{op:"h",c:[]}]);doc.fill();
 doc.setFont("helvetica","bold");doc.setFontSize(28);doc.setTextColor(226,88,5);
 doc.text("PROPOSTA",20,65);doc.text("COMERCIAL",20,78);
 let size=15,lines:string[]=[];
 do{doc.setFontSize(size);lines=doc.splitTextToSize(title,105);if(lines.length*size*.3528*1.25<=32)break;size-=1;}while(size>9);
 doc.setTextColor(42,47,59);doc.text(lines,20,96,{lineHeightFactor:1.25});
 const recipientY=Math.max(144,96+lines.length*size*.3528*1.25+10);
 doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(82,97,116);doc.text("APRESENTADA PARA",20,recipientY);
 doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(42,47,59);
 doc.text(doc.splitTextToSize(recipient||"Cliente / empresa",80).slice(0,3),20,recipientY+9,{lineHeightFactor:1.2});
 doc.setFontSize(7);doc.setTextColor(160,64,8);doc.text("PREPARADA POR",20,190);
 doc.setFontSize(10);doc.setTextColor(42,47,59);doc.text(doc.splitTextToSize(supplier,64).slice(0,3),20,199,{lineHeightFactor:1.2});
 doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(82,97,116);
 doc.text(doc.splitTextToSize(location||"Prestador de serviços",48).slice(0,2),20,220,{lineHeightFactor:1.2});
}

/** Purple folded bands and a lime capsule frame the charcoal title panel. */
export function drawCorporateProposalCover(doc:jsPDF,supplier:string,title:string,recipient:string,location:string){
 doc.setFillColor(255,255,255);doc.rect(0,0,210,297,"F");
 const polygon=(points:number[][],color:[number,number,number])=>{
  doc.setFillColor(...color);doc.lines(points.slice(1).map((p,i)=>[p[0]-points[i][0],p[1]-points[i][1]]),points[0][0],points[0][1],[1,1],"F",true);
 };
 polygon([[0,0],[17,0],[50,86],[0,86]],[82,17,104]);
 polygon([[144,155],[185,155],[210,200],[210,297],[198,297]],[82,17,104]);
 polygon([[22,162],[32,177],[44,162]],[64,12,83]);
 doc.setFillColor(154,201,57);doc.rect(0,86,170,76,"F");doc.circle(170,124,38,"F");
 polygon([[0,0],[13,0],[13,86],[0,86]],[92,20,110]);
 polygon([[13,86],[13,162],[0,162],[0,86]],[162,208,63]);
 polygon([[32,177],[39,177],[84,78],[75,72]],[64,12,83]);
 polygon([[121,177],[129,177],[174,83],[166,74]],[229,231,232]);
 doc.setFillColor(46,45,48);
 doc.path([{op:"m",c:[75,72]},{op:"l",c:[161,72]},{op:"c",c:[169,72,171,76,167,85]},{op:"l",c:[121,177]},{op:"l",c:[34,177]},{op:"c",c:[28,177,27,172,31,164]},{op:"h",c:[]}]);doc.fill();
 doc.setFont("helvetica","bold");doc.setFontSize(13);doc.setTextColor(82,17,104);
 doc.text(doc.splitTextToSize(supplier,110).slice(0,3),192,25,{align:"right",lineHeightFactor:1.2});
 doc.setTextColor(255,255,255);doc.setFont("helvetica","normal");doc.setFontSize(17);doc.text("PROPOSTA",102,113,{align:"center"});
 doc.setTextColor(154,201,57);doc.setFont("helvetica","bold");doc.setFontSize(22);doc.text("COMERCIAL",101,127,{align:"center"});
 let size=11,lines:string[]=[];
 do{doc.setFontSize(size);lines=doc.splitTextToSize(title,66);if(lines.length*size*.3528*1.25<=20)break;size-=1;}while(size>8);
 doc.setFont("helvetica","normal");doc.setTextColor(255,255,255);doc.text(lines,96,141,{align:"center",lineHeightFactor:1.25});
 doc.setTextColor(82,17,104);doc.setFontSize(7);doc.text("APRESENTADA PARA",102,215,{align:"center"});
 doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(doc.splitTextToSize(recipient||"Cliente / empresa",112).slice(0,3),102,225,{align:"center",lineHeightFactor:1.2});
 doc.setFontSize(7);doc.setTextColor(54,100,24);doc.text("PREPARADA POR",102,247,{align:"center"});
 doc.setTextColor(82,17,104);doc.setFontSize(10);doc.text(doc.splitTextToSize(supplier,112).slice(0,2),102,256,{align:"center",lineHeightFactor:1.2});
 doc.setFont("helvetica","normal");doc.setTextColor(82,97,116);doc.setFontSize(7);doc.text(doc.splitTextToSize(location||"Prestador de serviços",104).slice(0,1),102,268,{align:"center"});
}
