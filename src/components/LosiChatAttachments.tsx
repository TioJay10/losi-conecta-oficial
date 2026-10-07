import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { chatAction, type ChatMessage } from '../lib/losi-chat';
import { LosiChatAudioRecorder } from './LosiChatAudioRecorder';
import '../losi-chat-attachments.css';
const formats:Record<string,string>={m4a:'audio/mp4',weba:'audio/webm',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export const mediaCost=(file:File,text:string)=>file.type.startsWith('audio/')?1:file.type.startsWith('video/')?10:file.type.startsWith('image/')?text.trim()?3:2:file.size<=2097152?2:file.size<=5242880?3:file.size<=10485760?4:8;
const sizeLabel=(size:number)=>size<1048576?`${Math.ceil(size/1024)} KB`:`${(size/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB`;
function Paperclip(){return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m9 15 7-7a3 3 0 0 0-4-4L4 12a5 5 0 0 0 7 7l9-9"/></svg>;}
export function LosiChatComposer({threadId,group,balance,hasNumber,onSent,onError,onText,text,setText,textSending}:{threadId:string;group:boolean;balance:number;hasNumber:boolean;onSent:(m:ChatMessage)=>void;onError:(message:string)=>void;onText:()=>Promise<void>;text:string;setText:(s:string)=>void;textSending:boolean}){
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[stage,setStage]=useState(''),[recording,setRecording]=useState(false);
 const picker=useRef<HTMLInputElement>(null),attachButton=useRef<HTMLButtonElement>(null),attempt=useRef<{uploadId:string;requestId:string;uploaded:boolean;text:string}|null>(null),live=useRef(true),lock=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{if(!file||!file.type.startsWith('image/')&&!file.type.startsWith('video/')&&!file.type.startsWith('audio/')){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const cost=file?mediaCost(file,text):1;
 function choose(f:File|undefined){if(!f)return;const ext=f.name.split('.').at(-1)?.toLowerCase()??'',mime=formats[ext];if(!mime||f.size<1||f.size>20971520){onError('Selecione JPG, PNG, WEBP, GIF, PDF, TXT, DOCX, XLSX PPTX, MP4, MOV, WEBM, M4A ou WEBA de até 20 MB.');return;}setFile(new File([f],f.name,{type:mime}));attempt.current=null;}
 async function send(){
  if(lock.current||textSending||recording)return;if(!file){await onText();return;}lock.current=true;setBusy(true);onError('');
  if(!attempt.current)attempt.current={uploadId:crypto.randomUUID(),requestId:crypto.randomUUID(),uploaded:false,text:text.trim()};
  const a=attempt.current;
  // Once a send has been attempted, keep its caption and identifiers for safe retries.
  try{
   if(!a.uploaded){setStage('Enviando arquivo…');const p=await chatAction<{path:string;token:string;mime:string}>('prepare-media',{threadId,group,uploadId:a.uploadId,fileName:file.name,size:file.size});
    const result=await supabase.storage.from('losi-chat-attachments').uploadToSignedUrl(p.path,p.token,file,{contentType:p.mime,upsert:false});
    if(result.error&&String((result.error as {statusCode?:string}).statusCode)!=='409')throw new Error('Não foi possível enviar o arquivo. Tente novamente.');a.uploaded=true;
   }
   setStage('Conferindo e enviando…');const d=await chatAction<{message:ChatMessage}>('send-media',{uploadId:a.uploadId,requestId:a.requestId,text:a.text});
   if(live.current){setFile(null);setText('');attempt.current=null;}onSent(d.message);
  }catch(e){if(live.current)onError(e instanceof Error?e.message:'Não foi possível enviar. Nenhum crédito foi descontado nesta tentativa.');}
  finally{lock.current=false;if(live.current){setBusy(false);setStage('');}}
 }
 const fixedCaption=attempt.current?.text;
 return <div className="lc-compose-wrap">
  {file&&<section className={`lc-attachment-preview${file.type.startsWith('video/')?' lc-video-preview':file.type.startsWith('audio/')?' lc-audio-preview':''}`} aria-label="Prévia do anexo">{preview?(file.type.startsWith('audio/')?<audio src={preview} controls preload="metadata" aria-label="Ouvir gravação antes de enviar"/>:file.type.startsWith('video/')?<video src={preview} controls playsInline preload="metadata" aria-label="Prévia do vídeo selecionado"/>:<img src={preview} alt="Prévia da imagem selecionada"/>):<Paperclip/>}<div><strong>{file.type.startsWith('audio/')?'Mensagem de áudio':file.name}</strong><small>{sizeLabel(file.size)} · {cost} {cost===1?'crédito':'créditos'}{file.type.startsWith('image/')&&text.trim()?' com texto':''}</small>{fixedCaption!==undefined&&fixedCaption!==text.trim()&&<small>A nova tentativa mantém a legenda original. Remova o arquivo para alterar.</small>}</div><button type="button" disabled={busy} onClick={()=>{setFile(null);attempt.current=null;attachButton.current?.focus();}} aria-label="Remover anexo">×</button></section>}
  <form className="lc-composer" onSubmit={e=>{e.preventDefault();void send();}}>
   <input ref={picker} className="lc-file-picker" type="file" accept={Object.keys(formats).filter(ext=>!formats[ext].startsWith('audio/')).map(x=>'.'+x).join(',')} onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}} disabled={busy||textSending||recording} tabIndex={-1} aria-label="Selecionar imagem, vídeo ou documento"/>
   <button ref={attachButton} type="button" aria-label="Adicionar imagem, vídeo ou documento" disabled={busy||textSending||recording} onClick={()=>picker.current?.click()}><Paperclip/></button>
   <input aria-label={file?'Legenda do anexo':'Mensagem'} disabled={busy||textSending||recording||Boolean(attempt.current)} placeholder={file?'Legenda (opcional)':'Digite uma mensagem'} value={text} onChange={e=>setText(e.target.value)} maxLength={4000}/>
   <LosiChatAudioRecorder disabled={busy||textSending||Boolean(file)||!hasNumber||balance<1} onFile={choose} onError={onError} onRecording={setRecording}/>
   <button className="lc-send" type="submit" aria-label={`Enviar por ${cost} ${cost===1?'crédito':'créditos'}`} title={`Enviar · ${cost} ${cost===1?'crédito':'créditos'}`} disabled={busy||textSending||recording||(!file&&!text.trim())||!hasNumber||balance<cost}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 3 18 9-18 9 4-9Z M7 12h14"/></svg></button>
  </form>
  {busy&&<p className="lc-upload-status" role="status">{stage}</p>}
  {file&&balance<cost&&<p className="lc-upload-status" role="status">Saldo insuficiente: este envio custa {cost} {cost===1?'crédito':'créditos'}.</p>}
 </div>;
}
export function LosiChatAttachment({message}:{message:ChatMessage}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[visible,setVisible]=useState(false);
 const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!container.current)return;if(typeof IntersectionObserver==='undefined'){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'200px'});observer.observe(container.current);return()=>observer.disconnect();},[]);
 const attachment=message.attachment;
 const player=useRef<HTMLVideoElement>(null),audioPlayer=useRef<HTMLAudioElement>(null),position=useRef(0);
 async function openMedia(){if(busy)return;setBusy(true);setError('');try{const d=await chatAction<{url:string}>('media-url',{messageId:message.id});setUrl(d.url);}catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir a mídia.');}finally{setBusy(false);}}
 useEffect(()=>{if(attachment?.kind!=='image'||!visible)return;let live=true;void chatAction<{url:string}>('media-url',{messageId:message.id}).then(d=>{if(live){setUrl(d.url);setError('');}}).catch(()=>{if(live)setError('Não foi possível carregar a imagem.');});return()=>{live=false;};},[message.id,attachment?.kind,reload,visible]);
 if(!attachment)return null;
 async function download(){if(busy)return;setBusy(true);setError('');try{const d=await chatAction<{url:string}>('media-url',{messageId:message.id,download:true});window.location.assign(d.url);}catch(e){setError(e instanceof Error?e.message:'Não foi possível baixar.');}finally{setBusy(false);}}
 return <div ref={container} className="lc-sent-attachment">{attachment.kind==='audio'&&(url?<audio ref={audioPlayer} src={url} controls preload="metadata" aria-label="Mensagem de áudio" onTimeUpdate={()=>{position.current=audioPlayer.current?.currentTime??0;}} onLoadedMetadata={()=>{if(audioPlayer.current&&position.current>0)audioPlayer.current.currentTime=Math.min(position.current,Number.isFinite(audioPlayer.current.duration)?audioPlayer.current.duration:position.current);}} onError={()=>{setUrl('');setError('Não foi possível reproduzir. Reabra o áudio ou baixe o arquivo.');}}/>:<button type="button" disabled={busy} onClick={()=>void openMedia()}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m8 4 12 8-12 8Z"/></svg>{busy?'Abrindo áudio…':'Ouvir áudio'}</button>)}{attachment.kind==='video'&&(url?<video ref={player} src={url} controls playsInline preload="metadata" aria-label={`Vídeo: ${attachment.file_name}`} onTimeUpdate={()=>{position.current=player.current?.currentTime??0;}} onLoadedMetadata={()=>{if(player.current&&position.current>0)player.current.currentTime=Math.min(position.current,Number.isFinite(player.current.duration)?player.current.duration:position.current);}} onError={()=>{setUrl('');setError('Não foi possível reproduzir. Reabra o vídeo ou baixe o arquivo para assistir.');}}/>:<button type="button" disabled={busy} onClick={()=>void openMedia()}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m8 4 12 8-12 8Z"/></svg>{busy?'Abrindo vídeo…':'Ver vídeo'}</button>)}{attachment.kind==='image'&&url&&<img loading="lazy" src={url} alt={attachment.file_name} onError={()=>{setUrl('');setError('A imagem não carregou. Tente novamente.');}}/>}<button type="button" disabled={busy} onClick={()=>void download()}><Paperclip/><span><strong>{attachment.kind==='audio'?'Mensagem de áudio':attachment.file_name}</strong><small>{sizeLabel(attachment.byte_size)} · {busy?'Abrindo…':'Baixar arquivo'}</small></span></button>{error&&<p role="status">{error}{attachment.kind==='image'&&<button type="button" onClick={()=>setReload(n=>n+1)}>Recarregar imagem</button>}</p>}</div>;
}
