import {useEffect,useState} from 'react';
import {conversationThemes,conversationThemeStyle,type ConversationThemeId} from '../lib/losi-chat-conversation-themes';

export function LosiChatConversationThemes({saved,busy,onApply,globalTheme}:{globalTheme:'dark'|'light';saved?:ConversationThemeId;busy:boolean;onApply:(theme:ConversationThemeId)=>Promise<void>}){
 const [selected,setSelected]=useState<ConversationThemeId>(saved??'default');
 useEffect(()=>{if(saved)setSelected(saved);},[saved]);
 const chosen=conversationThemes.find(t=>t.id===selected)!;
 const previewStyle=(id:ConversationThemeId)=>conversationThemeStyle(id==='default'?(globalTheme==='light'?'light':'navy'):id);
 return <div className="lc-theme-picker">
  <p className="lc-contact-hint">Escolha um tema e confira a prévia. A mudança aparece somente para você nesta conversa.</p>
  <section className="lc-theme-preview" style={previewStyle(selected)} aria-label={`Prévia ilustrativa: ${chosen.name}`}>
   <header><strong>Prévia da conversa</strong><small>{chosen.name}</small></header>
   <div className="lc-theme-preview-messages"><span className="lc-theme-preview-bubble">Tudo pronto para o evento?<small>09:41</small></span><span className="lc-theme-preview-bubble is-sent">Sim! Vamos organizar os detalhes.<small>09:42 <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m3 12 4 4 9-9m-5 9 9-9"/></svg></small></span></div>
  </section>
  {(['colors','textures'] as const).map(category=><section className="lc-theme-category" key={category} aria-label={category==='colors'?'Cores':'Texturas'}><h3>{category==='colors'?'Cores':'Texturas'}</h3><div className="lc-theme-grid">{conversationThemes.filter(t=>t.category===category).map(t=><button type="button" key={t.id} className="lc-theme-option" aria-pressed={selected===t.id} disabled={busy||!saved} onClick={()=>setSelected(t.id)}><span className="lc-theme-thumbnail" style={previewStyle(t.id)} aria-hidden="true"><i/><i/>{selected===t.id&&<span className="lc-theme-check"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4 10-10"/></svg></span>}</span><span className="lc-theme-name">{t.name}</span></button>)}</div></section>)}
  <div className="lc-theme-apply"><span>{saved===selected?'Tema atual':`Selecionado: ${chosen.name}`}</span><button type="button" disabled={busy||!saved||saved===selected} onClick={()=>void onApply(selected)}>{busy?'Aplicando…':'Aplicar tema'}</button></div>
 </div>;
}
