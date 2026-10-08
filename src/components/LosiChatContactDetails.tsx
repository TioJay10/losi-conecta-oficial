import { useEffect, useRef, useState, type ReactNode } from 'react';
import { chatAction, formatLosiNumber, type ChatMessage, type ChatThread } from '../lib/losi-chat';
import { LosiChatAttachment } from './LosiChatAttachments';
import '../losi-chat-contact.css';

export type ContactSettings = { media:number; documents:number; links:number; bytes:number; favorite:boolean; theme:'default'|'navy'|'light'|'gold'; blocked:boolean; canSend:boolean };
type Cursor = {at:string;id:string};
type AssetPage = {messages:ChatMessage[];hasMore:boolean;nextCursor:Cursor|null};
type View = 'contact'|'media'|'links'|'documents'|'theme';
const paths = {
 back:'m15 5-7 7 7 7', next:'m9 5 7 7-7 7', chat:'M4 4h16v13H8l-4 4Z M8 9h8 M8 13h5',
 search:'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14 m5-2 6 6',
 media:'M3 4h18v16H3Z M3 16l6-6 5 5 3-3 4 4 M16 8h.01',
 storage:'M4 5h16v14H4Z M8 9h8 M8 13h5',
 star:'m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.3L12 17.3l-5.6 3 1-6.3L3 9.6l6.2-.9Z',
 theme:'M12 3a9 9 0 1 0 9 9c0-2-2-2-3-2h-2a2 2 0 0 1-2-2c0-1 1-2 1-3s-1-2-3-2Z M7 10h.01 M8 15h.01 M12 17h.01',
 share:'M12 16V3 m-4 4 4-4 4 4 M5 12v9h14v-9',
 file:'M5 3h9l5 5v13H5Z M14 3v5h5 M8 12h8 M8 16h6',
 block:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M6 6l12 12',
 check:'m5 12 4 4 10-10',
} as const;
function Icon({name}:{name:keyof typeof paths}) { return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>; }
const bytesLabel=(bytes:number)=>bytes<1048576?`${Math.round(bytes/1024).toLocaleString('pt-BR')} KB`:`${(bytes/1048576).toLocaleString('pt-BR',{maximumFractionDigits:1})} MB`;
const themes = [{id:'default',name:'Padrão do chat'},{id:'navy',name:'Azul-marinho'},{id:'light',name:'Claro'},{id:'gold',name:'Dourado suave'}] as const;
function Row({icon,label,value,onClick,danger=false,disabled=false,pressed}:{icon:keyof typeof paths;label:string;value?:ReactNode;onClick:()=>void;danger?:boolean;disabled?:boolean;pressed?:boolean}) {
 return <button type="button" className={`lc-contact-row${danger?' is-danger':''}`} onClick={onClick} disabled={disabled} aria-pressed={pressed}><Icon name={icon}/><span>{label}</span>{value!==undefined&&<small>{value}</small>}<Icon name="next"/></button>;
}
export function LosiChatContactDetails({thread,userId,onClose,onSearch,onSettings,onFavorite}:{thread:ChatThread;userId:string;onClose:()=>void;onSearch:()=>void;onSettings:(settings:ContactSettings)=>void;onFavorite:()=>Promise<void>}) {
 const [view,setView]=useState<View>('contact'),[settings,setSettings]=useState<ContactSettings|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [assets,setAssets]=useState<ChatMessage[]>([]),[loading,setLoading]=useState(false),[more,setMore]=useState(false),[confirmBlock,setConfirmBlock]=useState(false);
 const cursor=useRef<Cursor|null>(null),request=useRef(0),lock=useRef(false),scroll=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null),confirmation=useRef<HTMLDivElement>(null),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;request.current++;};},[]);
 async function refresh() { const data=await chatAction<ContactSettings>('contact-details',{threadId:thread.id});if(live.current){setSettings(data);onSettings(data);} }
 useEffect(()=>{void refresh().catch(e=>{if(live.current)setError(e instanceof Error?e.message:'Não foi possível carregar. Tente novamente.');});},[thread.id]);
 useEffect(()=>{scroll.current?.scrollTo(0,0);heading.current?.focus({preventScroll:true});setNotice('');setError('');},[view]);
 useEffect(()=>{if(confirmBlock){confirmation.current?.scrollIntoView({block:'nearest'});confirmation.current?.querySelector('button')?.focus({preventScroll:true});}},[confirmBlock]);
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(confirmBlock)setConfirmBlock(false);else if(view==='contact')onClose();else setView('contact');}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[view,confirmBlock,onClose]);
 async function loadAssets(reset=false) {
  if(!['media','links','documents'].includes(view))return;
  const version=reset?++request.current:request.current;setLoading(true);setError('');
  try {const page=await chatAction<AssetPage>('contact-assets',{threadId:thread.id,kind:view,before:reset?undefined:cursor.current});if(live.current&&version===request.current){setAssets(old=>reset?page.messages:[...old,...page.messages]);cursor.current=page.nextCursor;setMore(page.hasMore);}}
  catch(e){if(live.current&&version===request.current)setError(e instanceof Error?e.message:'Não foi possível carregar. Tente novamente.');}
  finally{if(live.current&&version===request.current)setLoading(false);}
 }
 useEffect(()=>{setAssets([]);setMore(false);cursor.current=null;if(['media','links','documents'].includes(view))void loadAssets(true);return()=>{request.current++;};},[view,thread.id]);
 async function save(change:{theme?:ContactSettings['theme'];blocked?:boolean}) {
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const data=await chatAction<ContactSettings>('contact-settings',{threadId:thread.id,...change});if(live.current){setSettings(data);onSettings(data);setConfirmBlock(false);setNotice(change.theme?'Tema salvo para esta conversa.':change.blocked?'Contato bloqueado.':'Contato desbloqueado.');}}
  catch(e){if(live.current)setError(e instanceof Error?e.message:'Não foi possível salvar. Tente novamente.');}
  finally{lock.current=false;if(live.current)setBusy(false);}
 }
 async function share() {
  const text=`${thread.name}\nNúmero digital LOSI: ${formatLosiNumber(thread.number)}`,url=`${window.location.origin}/chat-losi?numero=${encodeURIComponent(thread.number??'')}`;
  try{if(navigator.share)await navigator.share({title:thread.name,text,url});else{await navigator.clipboard.writeText(`${text}\n${url}`);setNotice('Contato copiado. Cole na conversa em que quiser compartilhar.');}}
  catch(e){if(e instanceof Error&&e.name==='AbortError')return;setError('Não foi possível compartilhar. Copie o número exibido no contato.');}
 }
 async function exportConversation() {
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('Preparando exportação…');
  try {
   const chunks:string[]=[];let before:Cursor|null=null;
   do{const page:AssetPage=await chatAction('contact-assets',{threadId:thread.id,kind:'all',before:before??undefined});if(!live.current)return;chunks.push(...page.messages.map(m=>`[${new Date(m.created_at).toLocaleString('pt-BR')}] ${m.sender_id===userId?'Você':thread.name}: ${m.body}${m.attachment?` [${m.attachment.file_name}]`:''}\n`));before=page.hasMore?page.nextCursor:null;}while(before);
   const url=URL.createObjectURL(new Blob([`Chat LOSI — ${thread.name}\nNúmero: ${formatLosiNumber(thread.number)}\n\n`,...chunks.reverse()],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`conversa-losi-${thread.number??'contato'}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);setNotice('Conversa exportada em texto. Arquivos aparecem pelo nome.');
  }catch(e){if(live.current)setError(e instanceof Error?e.message:'Não foi possível exportar. Tente novamente.');}
  finally{lock.current=false;if(live.current)setBusy(false);}
 }
 const title=view==='contact'?'Dados do contato':view==='theme'?'Tema da conversa':'Mídias, links e documentos';
 return <section className="lc-contact-details" aria-label={title}>
  <header className="lc-contact-top"><button type="button" aria-label={view==='contact'?'Voltar à conversa':'Voltar aos dados do contato'} onClick={()=>view==='contact'?onClose():setView('contact')}><Icon name="back"/></button><h2 ref={heading} tabIndex={-1}>{title}</h2><span/></header>
  <div ref={scroll} className="lc-contact-scroll">
   {view==='contact'?<>
    <div className="lc-contact-identity"><span className="lc-contact-photo">{thread.photo?<img src={thread.photo} alt={`Foto de ${thread.name}`}/>:thread.name.split(/\s+/).slice(0,2).map(n=>n[0]).join('')}</span><h3>{thread.name}</h3><p>{formatLosiNumber(thread.number)}</p></div>
    <div className="lc-contact-shortcuts"><button type="button" onClick={onClose}><Icon name="chat"/><span>Conversar</span></button><button type="button" onClick={onSearch}><Icon name="search"/><span>Pesquisar</span></button></div>
    <div className="lc-contact-rows"><Row icon="media" label="Mídias, links e documentos" value={settings?settings.media+settings.documents+settings.links:'…'} onClick={()=>setView('media')}/><Row icon="storage" label="Armazenamento da conversa" value={settings?bytesLabel(settings.bytes):'…'} onClick={()=>setView('media')}/></div>
    <div className="lc-contact-rows"><Row icon="theme" label="Tema da conversa" value={themes.find(t=>t.id===settings?.theme)?.name??'…'} onClick={()=>setView('theme')}/><Row icon="star" label={thread.favorite?'Remover dos favoritos':'Adicionar aos favoritos'} pressed={thread.favorite} disabled={busy} onClick={()=>{if(lock.current)return;lock.current=true;setBusy(true);void onFavorite().catch(e=>setError(e instanceof Error?e.message:'Não foi possível salvar o favorito.')).finally(()=>{lock.current=false;if(live.current)setBusy(false);});}}/></div>
    <div className="lc-contact-rows"><Row icon="share" label="Compartilhar contato" onClick={()=>void share()}/><Row icon="file" label={busy?'Aguarde…':'Exportar conversa em texto'} disabled={busy} onClick={()=>void exportConversation()}/></div>
    <div className="lc-contact-rows"><Row icon="block" label={settings?.blocked?'Desbloquear contato':'Bloquear contato'} danger={!settings?.blocked} disabled={!settings||busy} onClick={()=>settings?.blocked?void save({blocked:false}):setConfirmBlock(true)}/></div>
    {confirmBlock&&<div ref={confirmation} className="lc-contact-confirm" role="alert"><strong>Bloquear {thread.name}?</strong><p>Vocês não poderão enviar mensagens nesta conversa. O histórico será mantido e você poderá desbloquear depois.</p><div><button type="button" disabled={busy} onClick={()=>setConfirmBlock(false)}>Cancelar</button><button type="button" className="is-danger" disabled={busy} onClick={()=>void save({blocked:true})}>{busy?'Bloqueando…':'Bloquear contato'}</button></div></div>}
   </>:view==='theme'?<><p className="lc-contact-hint">Este tema muda somente a sua visualização desta conversa.</p><div className="lc-contact-rows">{themes.map(t=><button type="button" key={t.id} className="lc-contact-row" aria-pressed={settings?.theme===t.id} disabled={busy||!settings} onClick={()=>void save({theme:t.id})}><span className={`lc-contact-swatch lc-contact-swatch-${t.id}`}/><span>{t.name}</span>{settings?.theme===t.id&&<Icon name="check"/>}</button>)}</div></>:<>
    <div className="lc-contact-tabs" aria-label="Tipo de conteúdo">{(['media','links','documents'] as const).map((tab,i)=><button type="button" key={tab} aria-pressed={view===tab} onClick={()=>setView(tab)}>{['Mídias','Links','Docs'][i]}</button>)}</div>
    <p className="lc-contact-hint">Arquivos e links compartilhados com {thread.name}.{settings&&` Arquivos: ${bytesLabel(settings.bytes)}.`}</p>
    <div className={`lc-contact-assets ${view==='media'?'is-media':''}`}>{assets.map(m=><article key={m.id} className="lc-contact-asset">{view==='links'?<div className="lc-contact-links">{[...new Set(m.body.match(/https?:\/\/[^\s<>]+/gi)??[])].map(url=><a key={url} href={url} target="_blank" rel="noopener noreferrer">{url}</a>)}</div>:<LosiChatAttachment message={m} own={m.sender_id===userId} footer={<small className="lc-storage-file-meta">{m.sender_id===userId?'Você':thread.name} · {new Date(m.created_at).toLocaleDateString('pt-BR')}</small>} onDeleted={id=>{setAssets(old=>old.filter(item=>item.id!==id));void refresh();window.dispatchEvent(new Event('losi-chat-sync'));}}/>}{view==='links'&&<small>{m.sender_id===userId?'Você':thread.name} · {new Date(m.created_at).toLocaleDateString('pt-BR')}</small>}</article>)}</div>
    {!loading&&!assets.length&&!error&&<p className="lc-contact-empty">{view==='media'?'Nenhuma mídia nesta conversa.':view==='links'?'Nenhum link nesta conversa.':'Nenhum documento nesta conversa.'}</p>}
    {loading&&<p className="lc-contact-empty" role="status">Carregando…</p>}{more&&!loading&&<button type="button" className="lc-contact-load" onClick={()=>void loadAssets()}>Carregar mais</button>}
   </>}
   {error&&<p className="lc-contact-feedback" role="alert">{error}<button type="button" disabled={busy||loading} onClick={()=>view==='contact'||view==='theme'?void refresh().then(()=>setError('')).catch(()=>{}):void loadAssets(!assets.length)}>Tentar novamente</button></p>}
   {notice&&<p className="lc-contact-feedback" role="status">{notice}</p>}
  </div>
 </section>;
}
