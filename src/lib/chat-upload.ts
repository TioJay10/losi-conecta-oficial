/** Upload directly to the server-issued capability, with finite wait and progress. */
export function uploadChatFile(url:string,file:File,mime:string,onProgress:(percent:number)=>void):Promise<void>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('PUT',url);xhr.timeout=180000;
  xhr.setRequestHeader('content-type',mime);xhr.setRequestHeader('x-upsert','false');xhr.setRequestHeader('cache-control','max-age=3600');
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(100,Math.round(e.loaded/e.total*100)));};
  xhr.onload=()=>{let status='';try{status=String(JSON.parse(xhr.responseText).statusCode??'');}catch{/* Non-JSON response. */}
   if(xhr.status>=200&&xhr.status<300||xhr.status===409||status==='409')resolve();else reject(new Error('Não foi possível enviar o arquivo. Tente novamente.'));};
  xhr.onerror=()=>reject(new Error('A conexão foi interrompida. Confira sua internet e tente novamente.'));
  xhr.ontimeout=()=>reject(new Error('O envio demorou demais. Confira sua internet e tente novamente.'));
  xhr.onabort=()=>reject(new Error('Envio interrompido. Tente novamente.'));
  xhr.send(file);
 });
}
