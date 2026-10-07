import { useEffect, useRef, useState } from 'react';
export function LosiChatAudioRecorder({disabled,onFile,onError,onRecording}:{disabled:boolean;onFile:(file:File)=>void;onError:(message:string)=>void;onRecording:(active:boolean)=>void}){
 const [state,setState]=useState<'idle'|'permission'|'recording'>('idle'),[seconds,setSeconds]=useState(0);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),generation=useRef(0),alive=useRef(true),discard=useRef(false),opening=useRef(false);
 const callbacks=useRef({onFile,onError,onRecording});callbacks.current={onFile,onError,onRecording};
 function release(){if(timer.current){clearInterval(timer.current);timer.current=null;}stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;}
 function finish(cancel=false){if(cancel)discard.current=true;generation.current++;opening.current=false;const r=recorder.current;if(r&&r.state!=='inactive')r.stop();release();if(alive.current){setState('idle');callbacks.current.onRecording(false);}}
 useEffect(()=>{alive.current=true;const hidden=()=>{if(document.visibilityState==='hidden')finish();},leaving=()=>finish(true);document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leaving);return()=>{alive.current=false;finish(true);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leaving);};},[]);
 async function start(){
  if(disabled||opening.current||recorder.current)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){callbacks.current.onError('Este navegador não permite gravar áudio. Abra o chat em um navegador atualizado.');return;}
  const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime){callbacks.current.onError('Este navegador não oferece um formato de gravação compatível.');return;}
  const current=++generation.current;opening.current=true;discard.current=false;setState('permission');callbacks.current.onRecording(true);callbacks.current.onError('');
  try{
   const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(!alive.current||current!==generation.current){mic.getTracks().forEach(t=>t.stop());return;}
   stream.current=mic;const r=new MediaRecorder(mic,{mimeType:mime,audioBitsPerSecond:128000});recorder.current=r;const chunks:Blob[]=[];let size=0,failed=false;
   r.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);size+=event.data.size;if(size>20971520){failed=true;finish(true);if(alive.current)callbacks.current.onError('A gravação excedeu 20 MB. Grave um áudio menor.');}}};
   r.onerror=()=>{failed=true;finish(true);if(alive.current)callbacks.current.onError('A gravação foi interrompida. Confira o microfone e tente novamente.');};
   r.onstop=()=>{release();recorder.current=null;opening.current=false;if(!alive.current)return;setState('idle');callbacks.current.onRecording(false);if(discard.current||failed)return;const type=r.mimeType.split(';')[0],ext=type==='audio/mp4'?'m4a':'weba';const blob=new Blob(chunks,{type});if(!blob.size||blob.size>20971520){callbacks.current.onError('Nenhum áudio válido foi gravado. Tente novamente.');return;}callbacks.current.onFile(new File([blob],`Audio-${Date.now()}.${ext}`,{type}));};
   r.start(1000);opening.current=false;setSeconds(0);setState('recording');const started=Date.now();timer.current=setInterval(()=>{const elapsed=Math.floor((Date.now()-started)/1000);if(alive.current)setSeconds(Math.min(elapsed,300));if(elapsed>=300)finish();},250);
  }catch(e){if(!alive.current||current!==generation.current)return;const failed=recorder.current;if(failed){failed.ondataavailable=null;failed.onerror=null;failed.onstop=null;}recorder.current=null;release();opening.current=false;if(alive.current&&current===generation.current){setState('idle');callbacks.current.onRecording(false);callbacks.current.onError(e instanceof DOMException&&e.name==='NotAllowedError'?'Permita o acesso ao microfone nas configurações do navegador para gravar.':'Não foi possível acessar o microfone. Confira o aparelho e tente novamente.');}}
 }
 const time=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
 if(state==='idle')return <button type="button" aria-label="Gravar áudio por 1 crédito" title="Gravar áudio · 1 crédito" disabled={disabled} onClick={()=>void start()}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8"/></svg></button>;
 return <div className="lc-audio-recording"><span role="status">{state==='permission'?'Aguardando microfone…':`Gravando ${time} / 05:00`}</span>{state==='recording'&&<button type="button" onClick={()=>finish()} aria-label="Parar e ouvir gravação"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg><span>Parar</span></button>}<button type="button" onClick={()=>finish(true)} aria-label="Descartar gravação"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7"/></svg></button></div>;
}
