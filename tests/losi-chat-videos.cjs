const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const context={exports:{},TextDecoder,Uint8Array,DataView};vm.createContext(context);vm.runInContext(ts.transpileModule(fs.readFileSync('supabase/functions/losi-chat/media-rules.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
const {mediaMetadata,verifyMedia}=context.exports,dir=fs.mkdtempSync(path.join(os.tmpdir(),'losi-chat-video-test-'));
try{
 const cases=[['test.mp4','video/mp4',['-f','lavfi','-i','color=c=navy:s=32x32:d=0.2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart']],['test.mov','video/quicktime',['-f','lavfi','-i','color=c=navy:s=32x32:d=0.2','-c:v','libx264','-pix_fmt','yuv420p']],['test.webm','video/webm',['-f','lavfi','-i','color=c=navy:s=32x32:d=0.2','-c:v','libvpx','-deadline','realtime']],['audio.mp4','video/mp4',['-f','lavfi','-i','sine=frequency=440:duration=0.2','-c:a','aac']]];
 for(const [name,mime,args] of cases){const file=path.join(dir,name);cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error',...args,file],{timeout:15000});const bytes=fs.readFileSync(file),meta=mediaMetadata(name,bytes.length);assert.equal(meta.kind,'video');assert.equal(meta.mime,mime);assert.equal(verifyMedia(bytes,mime),name!=='audio.mp4',name);assert.equal(verifyMedia(bytes.subarray(0,15),mime),false,'truncated '+name);}
 assert.equal(verifyMedia(new TextEncoder().encode('%PDF-1.7'),'video/mp4'),false);
 assert.throws(()=>mediaMetadata('big.mp4',20971521));
 const mp4=fs.readFileSync(path.join(dir,'test.mp4'));assert.equal(verifyMedia(mp4,'video/quicktime'),false,'wrong MOV brand');
 const webm=fs.readFileSync(path.join(dir,'test.webm'));assert.equal(verifyMedia(webm,'video/mp4'),false,'wrong container');
 const ui=fs.readFileSync('src/components/LosiChatAttachments.tsx','utf8');const expression=ui.match(/export const mediaCost\s*=([^;]+);/)[1];const cost=vm.runInNewContext(ts.transpileModule('('+expression+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);for(const size of [100,2097152,20971520])for(const caption of ['', 'Legenda'])assert.equal(cost({type:'video/mp4',size},caption),10);
 console.log('PASS: real MP4/MOV/WEBM video tracks, reject audio-only/fake/truncated containers, video price 10 at all sizes and captions');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
