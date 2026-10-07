export const mediaTypes:Record<string,string>={mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export function mediaMetadata(name:unknown,size:unknown){
 if(typeof name!=='string'||!Number.isInteger(size)||Number(size)<1||Number(size)>20971520)throw new Error('ANEXO_INVALIDO');
 const fileName=name.replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(0,160),ext=fileName.split('.').at(-1)?.toLowerCase()??'',mime=mediaTypes[ext];
 if(!mime)throw new Error('ANEXO_FORMATO');
 return {file_name:fileName,mime,kind:mime.startsWith('video/')?'video':mime.startsWith('image/')?'image':'document',byte_size:Number(size),ext};
}
export function verifyMedia(bytes:Uint8Array,mime:string){
 if(mime.startsWith('video/'))return verifyVideo(bytes,mime);
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

// Bounded container inspection: reject audio-only containers and fake extensions.
// Browser codec support remains independent; users can download unsupported videos.
function verifyVideo(bytes:Uint8Array,mime:string):boolean{
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=(start:number,end:number)=>new TextDecoder().decode(bytes.slice(start,end));
 if(mime==='video/mp4'||mime==='video/quicktime'){
  const boxes=(start:number,end:number)=>{
   const result:Array<{type:string;start:number;end:number}>=[];let pos=start;
   while(pos<end){if(result.length>=4096||pos+8>end)return null;let size=v.getUint32(pos),header=8;if(size===1){if(pos+16>end)return null;const n=v.getBigUint64(pos+8);if(n>BigInt(end-pos))return null;size=Number(n);header=16;}else if(size===0)size=end-pos;
    if(size<header||size>end-pos)return null;result.push({type:text(pos+4,pos+8),start:pos+header,end:pos+size});pos+=size;
   }return result;
  };
  const top=boxes(0,bytes.length);if(!top)return false;const ftyp=top.find(b=>b.type==='ftyp');if(!ftyp||ftyp.end-ftyp.start<8)return false;
  const brands=[text(ftyp.start,ftyp.start+4)];for(let p=ftyp.start+8;p+4<=ftyp.end;p+=4)brands.push(text(p,p+4));
  const allowed=mime==='video/quicktime'?['qt  ']:['isom','iso2','iso3','iso4','iso5','iso6','avc1','mp41','mp42','M4V ','dash'];
  if(!brands.some(b=>allowed.includes(b))||!top.some(b=>b.type==='mdat'&&b.end>b.start))return false;
  for(const moov of top.filter(b=>b.type==='moov')){
   const children=boxes(moov.start,moov.end);if(!children)return false;
   for(const trak of children.filter(b=>b.type==='trak')){const tracks=boxes(trak.start,trak.end);if(!tracks)return false;
    for(const mdia of tracks.filter(b=>b.type==='mdia')){const media=boxes(mdia.start,mdia.end);if(!media)return false;if(media.some(b=>b.type==='hdlr'&&b.end-b.start>=12&&text(b.start+8,b.start+12)==='vide'))return true;}
   }
  }return false;
 }
 if(mime!=='video/webm')return false;
 const elements=(start:number,end:number)=>{
  const result:Array<{id:number;start:number;end:number}>=[];let pos=start;
  const vint=(at:number,max:number,keep:boolean)=>{if(at>=end||bytes[at]===0)return null;let len=1,mask=128;while(!(bytes[at]&mask)){mask>>=1;len++;}if(len>max||at+len>end)return null;let value=BigInt(keep?bytes[at]:bytes[at]&(mask-1));for(let j=1;j<len;j++)value=value*256n+BigInt(bytes[at+j]);return {len,value,unknown:!keep&&value===(1n<<BigInt(7*len))-1n};};
  while(pos<end){if(result.length>=4096)return null;const id=vint(pos,4,true);if(!id)return null;pos+=id.len;const size=vint(pos,8,false);if(!size)return null;pos+=size.len;const length=size.unknown?end-pos:Number(size.value);if(size.value>BigInt(end-pos)&&!size.unknown||length<0||pos+length>end)return null;result.push({id:Number(id.value),start:pos,end:pos+length});pos+=length;}
  return result;
 };
 const top=elements(0,bytes.length);if(!top)return false;const header=top.find(e=>e.id===0x1a45dfa3),segment=top.find(e=>e.id===0x18538067);if(!header||!segment)return false;
 const info=elements(header.start,header.end);if(!info?.some(e=>e.id===0x4282&&text(e.start,e.end)==='webm'))return false;
 const children=elements(segment.start,segment.end);if(!children||!children.some(e=>e.id===0x1f43b675&&e.end>e.start))return false;
 for(const tracks of children.filter(e=>e.id===0x1654ae6b)){const entries=elements(tracks.start,tracks.end);if(!entries)return false;for(const entry of entries.filter(e=>e.id===0xae)){const fields=elements(entry.start,entry.end);if(fields?.some(e=>e.id===0x83&&e.end-e.start===1&&bytes[e.start]===1))return true;}}
 return false;
}
