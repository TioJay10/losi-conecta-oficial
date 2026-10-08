export const CHAT_FILE_LIMIT = 20 * 1024 * 1024;
export const chatFileFormats: Record<string, string> = { m4a:'audio/mp4',weba:'audio/webm',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
// MIME hints are essential for the mobile photo/video library, alongside file extensions.
export const CHAT_FILE_ACCEPT = ['video/*', ...new Set(Object.values(chatFileFormats).filter(mime=>!mime.startsWith('audio/'))), ...Object.keys(chatFileFormats).filter(ext=>!chatFileFormats[ext].startsWith('audio/')).map(ext=>'.'+ext), '.m4v'].join(',');

export function selectChatFile(file: File): File {
  if (!file.size) throw new Error('O arquivo está vazio. Selecione outro vídeo ou arquivo.');
  if (file.size > CHAT_FILE_LIMIT) throw new Error(`O arquivo tem ${(file.size / 1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB. O limite é 20 MB. Reduza o vídeo ou escolha um trecho menor.`);
  let name = file.name.replace(/[\\/\x00-\x1f\x7f]/g,'_');
  let ext = name.split('.').length > 1 ? name.split('.').at(-1)?.toLowerCase() ?? '' : '';
  // iOS and exported clips can supply a MIME type without a usable extension.
  const videoExt: Record<string,string> = { 'video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm' };
  if (ext === 'm4v') { name = name.slice(0,-4)+'.mp4'; ext='mp4'; }
  if (!ext && videoExt[file.type.toLowerCase()]) { ext=videoExt[file.type.toLowerCase()];name=(name||'video')+'.'+ext; }
  const mime = chatFileFormats[ext];
  if (!mime) throw new Error('Formato não suportado. Para vídeos, selecione MP4, MOV, WEBM ou M4V de até 20 MB.');
  // Preserve the extension when shortening names, so the server can validate the container.
  if (name.length>160) name=name.slice(0,159-ext.length)+'.'+ext;
  // Reuse native files whenever possible; do not rebuild every selected mobile video.
  return name===file.name && file.type===mime ? file : new File([file],name,{type:mime,lastModified:file.lastModified});
}
