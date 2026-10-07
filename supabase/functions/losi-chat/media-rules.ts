export const mediaTypes:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export function mediaMetadata(name:unknown,size:unknown){
 if(typeof name!=='string'||!Number.isInteger(size)||Number(size)<1||Number(size)>20971520)throw new Error('ANEXO_INVALIDO');
 const fileName=name.replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(0,160),ext=fileName.split('.').at(-1)?.toLowerCase()??'',mime=mediaTypes[ext];
 if(!mime)throw new Error('ANEXO_FORMATO');
 return {file_name:fileName,mime,kind:mime.startsWith('image/')?'image':'document',byte_size:Number(size),ext};
}
export function verifyMedia(bytes:Uint8Array,mime:string){
 const starts=(s:number[])=>s.every((n,i)=>bytes[i]===n);
 if(mime==='image/jpeg')return starts([255,216,255]);
 if(mime==='image/png')return starts([137,80,78,71,13,10,26,10]);
 if(mime==='image/gif')return new TextDecoder().decode(bytes.slice(0,6)).match(/^GIF8[79]a$/)!==null;
 if(mime==='image/webp')return new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 if(mime==='application/pdf')return new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
 if(mime==='text/plain'){try{return !bytes.includes(0)&&Boolean(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return false;}}
 // Inspect ZIP central directory names without inflating untrusted archives.
 if(!starts([80,75,3,4]))return false;
 const names=new Set<string>();const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(v.getUint32(i,true)===0x06054b50){end=i;break;}}
 if(end<0)return false;let pos=v.getUint32(end+16,true);const count=v.getUint16(end+10,true);if(count>10000)return false;
 for(let i=0;i<count;i++){if(pos+46>bytes.length||v.getUint32(pos,true)!==0x02014b50)return false;const n=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true);if(pos+46+n+extra+comment>bytes.length)return false;names.add(new TextDecoder().decode(bytes.slice(pos+46,pos+46+n)));pos+=46+n+extra+comment;}
 const entry=mime===mediaTypes.docx?'word/document.xml':mime===mediaTypes.xlsx?'xl/workbook.xml':mime===mediaTypes.pptx?'ppt/presentation.xml':'';
 return Boolean(entry)&&names.has('[Content_Types].xml')&&names.has(entry);
}
