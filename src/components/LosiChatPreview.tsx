import { useState } from "react";
import "../chat-losi.css";

const icons = {
 chat:"M4 3h16a1 1 0 0 1 1 1v13H8l-5 4V4a1 1 0 0 1 1-1Z M7 8h10 M7 12h7",
 search:"M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15 m5.5-2 5 5",
 plus:"M12 4v16 M4 12h16",more:"M5 12h.01 M12 12h.01 M19 12h.01",
 camera:"M3 7h4l2-3h6l2 3h4v13H3Z M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
 back:"m15 5-7 7 7 7",send:"m3 3 18 9-18 9 4-9Z M7 12h14",
 attach:"m9 15 7-7a3 3 0 0 0-4-4L4 12a5 5 0 0 0 7 7l9-9",
 file:"M5 3h9l5 5v13H5Z M14 3v5h5 M8 12h8 M8 16h6",
 users:"M2 21v-3a5 5 0 0 1 10 0v3 M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M16 4a4 4 0 0 1 0 8 M16 15a5 5 0 0 1 5 5v1",
 wallet:"M3 6h18v14H3Z M3 6l15-3v3 M16 12h5v5h-5Z",
 profile:"M4 21v-2a8 8 0 0 1 16 0v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
 archive:"M3 3h18v5H3Z M5 8v13h14V8 M9 12h6",
 check:"m2 12 5 5 10-11 M12 17l10-11",pin:"m8 3 8 0-1 6 4 5H5l4-5Z M12 14v7",
 star:"m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.3L12 17.3l-5.6 3 1-6.3L3 9.6l6.2-.9Z",
 home:"m3 11 9-8 9 8 M5 9v12h5v-7h4v7h5V9", close:"m5 5 14 14 M19 5 5 19",
 smile:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M8 9h.01 M16 9h.01 M7 14a6 6 0 0 0 10 0",
} as const;
type IconName=keyof typeof icons;
function Icon({name}:{name:IconName}){return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]}/></svg>;}
const conversations=[
 {id:1,name:"Meu espaço (você)",initials:"EU",text:"Proposta de recreação.pdf · 5 páginas",time:"20:14",unread:0,pinned:true,favorite:true,group:false,file:true,color:"ocean"},
 {id:2,name:"Marina · Recreação",initials:"MR",text:"Vamos trocar ideias sobre as oficinas?",time:"Ontem",unread:0,pinned:true,favorite:true,group:false,file:false,color:"rose"},
 {id:3,name:"Rafael · Monitoria",initials:"RM",text:"Combinado! Até o próximo evento.",time:"20:45",unread:0,pinned:true,favorite:false,group:false,file:false,color:"sage"},
 {id:4,name:"Parceiros de eventos",initials:"PE",text:"Marina: Compartilhei o roteiro da atividade.",time:"17:59",unread:4,pinned:false,favorite:false,group:true,file:false,color:"sand"},
 {id:5,name:"Networking · São Paulo",initials:"SP",text:"Rafael: Quem trabalha com oficinas lúdicas?",time:"20:53",unread:12,pinned:false,favorite:false,group:true,file:false,color:"plum"},
 {id:6,name:"Camila · Animação",initials:"CA",text:"Obrigada pela indicação!",time:"20:39",unread:0,pinned:false,favorite:false,group:false,file:false,color:"ocean"},
 {id:7,name:"Profissionais do lazer",initials:"PL",text:"Camila: Vamos compartilhar experiências.",time:"20:24",unread:3,pinned:false,favorite:false,group:true,file:false,color:"sage"},
];
type Chat=typeof conversations[number];
type Section="chats"|"contacts"|"credits"|"account";
const filters=[{id:"all",label:"Todas"},{id:"unread",label:"Não lidas"},{id:"favorites",label:"Favoritos"},{id:"groups",label:"Grupos"}] as const;
export function LosiChatPreview(){
 const [section,setSection]=useState<Section>("chats");
 const [filter,setFilter]=useState<string>("all");
 const [search,setSearch]=useState("");
 const [selected,setSelected]=useState<Chat|null>(null);
 const [menu,setMenu]=useState(false);
 const [notice,setNotice]=useState("");
 const [draft,setDraft]=useState("");
 const visible=conversations.filter(c=>(filter!=="unread"||c.unread>0)&&(filter!=="favorites"||c.favorite)&&(filter!=="groups"||c.group)&&`${c.name} ${c.text}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
 const unread=conversations.filter(c=>c.unread>0).length;
 function go(next:Section){setSection(next);setSelected(null);setMenu(false);setNotice("");}
 function openChat(chat:Chat){setSelected(chat);setSection("chats");setDraft("");setNotice("");}
 function previewNotice(){setNotice("Esta é uma prévia da interface. Envios e anexos serão habilitados na próxima etapa.");}
 const nav=[{id:"contacts",icon:"users",label:"Contatos"},{id:"credits",icon:"wallet",label:"Créditos"},{id:"chats",icon:"chat",label:"Conversas"},{id:"account",icon:"profile",label:"Você"}] as const;
 return <main className={`lc-app${selected?" lc-chat-open":""}`} aria-label="Chat LOSI">
  <aside className="lc-rail" aria-label="Navegação do chat">
   <button className={section==="chats"?"is-active":""} aria-label="Conversas" onClick={()=>go("chats")}><Icon name="chat"/><span className="lc-rail-count">{unread}</span></button>
   <button className={section==="contacts"?"is-active":""} aria-label="Contatos" onClick={()=>go("contacts")}><Icon name="users"/></button>
   <button className={section==="credits"?"is-active":""} aria-label="Saldo e recarga" onClick={()=>go("credits")}><Icon name="wallet"/></button>
   <span className="lc-rail-rule"/>
   <a href="/painel" aria-label="Voltar ao painel LOSI"><Icon name="home"/></a>
   <button className="lc-rail-profile" aria-label="Meu número digital" onClick={()=>go("account")}><Icon name="profile"/></button>
  </aside>
  <section className="lc-sidebar" aria-label="Conversas e saldo">
   <header className="lc-list-header">
    <div className="lc-mobile-actions"><button aria-label="Abrir opções" onClick={()=>setMenu(!menu)} aria-expanded={menu}><Icon name="more"/></button><span/><button aria-label="Câmera" onClick={previewNotice}><Icon name="camera"/></button><button className="lc-add" aria-label="Nova conversa" onClick={()=>go("contacts")}><Icon name="plus"/></button></div>
    <div className="lc-desktop-heading"><strong>Chat LOSI</strong><button aria-label="Abrir opções" onClick={()=>setMenu(!menu)} aria-expanded={menu}><Icon name="more"/></button><button className="lc-add" aria-label="Nova conversa" onClick={()=>go("contacts")}><Icon name="plus"/></button></div>
    {menu&&<div className="lc-menu"><button onClick={()=>go("account")}>Meu número digital</button><button onClick={()=>go("credits")}>Saldo e recarga</button><a href="/painel">Voltar ao painel</a></div>}
    <h1 className="lc-mobile-title">{section==="chats"?"Conversas":section==="contacts"?"Contatos":section==="credits"?"Créditos":"Você"}</h1>
    <button className="lc-balance" onClick={()=>go("credits")} aria-label="Ver saldo demonstrativo de 10 mil créditos"><Icon name="wallet"/><span><strong>10.000</strong> créditos <small>· saldo demonstrativo</small></span></button>
    <div className="lc-demo-note">Prévia da interface · dados ilustrativos</div>
    <label className="lc-search"><Icon name="search"/><input aria-label="Pesquisar conversas" placeholder="Pesquisar ou começar uma nova conversa" value={search} onChange={e=>{setSearch(e.target.value);if(section!=="chats"&&section!=="contacts")setSection("chats");}}/></label>
    <nav className="lc-filters" aria-label="Filtrar conversas">{filters.map(f=><button key={f.id} aria-pressed={filter===f.id} onClick={()=>{setFilter(f.id);setSection("chats");setSelected(null);}}>{f.label}{f.id==="unread"&&<span> {unread}</span>}</button>)}</nav>
   </header>
   {(section==="chats"||section==="contacts")&&<div className="lc-conversations">
    {section==="contacts"&&<p className="lc-section-intro">Contatos de demonstração. A busca por número LOSI será conectada na próxima etapa.</p>}
    {visible.map(c=><button className={`lc-conversation${selected?.id===c.id?" is-selected":""}`} key={c.id} onClick={()=>openChat(c)}>
     <span className={`lc-avatar lc-avatar-${c.color}`} aria-hidden="true">{c.initials}</span>
     <span className="lc-conversation-details"><span className="lc-conversation-top"><strong>{c.name}</strong><time className={c.unread?"has-unread":""}>{c.time}</time></span>
      <span className="lc-conversation-bottom"><span className="lc-last-message">{!c.group&&<Icon name="check"/>}{c.file&&<Icon name="file"/>}<span>{c.text}</span></span><span className="lc-message-marks">{c.pinned&&<Icon name="pin"/>}{c.unread>0&&<b>{c.unread}</b>}</span></span>
     </span>
    </button>)}
    {visible.length===0&&<p className="lc-no-results">Nenhuma conversa encontrada. Tente outro nome ou filtro.</p>}
   </div>}
   {section==="credits"&&<div className="lc-account-panel"><h2>Saldo e recarga</h2><p>Seu saldo ficará disponível aqui e no cabeçalho do chat.</p><strong className="lc-credit-total">10.000 créditos</strong><small>Saldo ilustrativo · nenhuma compra realizada</small><h3>Número + créditos iniciais</h3><div className="lc-pack"><span>10 mil créditos<strong>R$ 29,90</strong></span><button disabled>Comprar em breve</button></div><div className="lc-pack"><span>50 mil créditos<strong>R$ 79,90</strong></span><button disabled>Comprar em breve</button></div><p>Quando o saldo acabar, você mantém seu número. Os pacotes de recarga serão disponibilizados na próxima etapa.</p><h3>Consumo por envio</h3><dl>{[["Texto","1 crédito"],["Imagem","2 créditos"],["Texto + imagem","3 créditos"],["Vídeo","10 créditos"],["Documento leve","2–3 créditos"],["Documento pesado","4–8 créditos"]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>}
   {section==="account"&&<div className="lc-account-panel"><span className="lc-account-avatar"><Icon name="profile"/></span><h2>Meu número digital LOSI</h2><strong className="lc-digital-number">154.444.566</strong><small>Número ilustrativo · ainda não vinculado à sua conta</small><p>A compra será opcional em Minha Empresa. Após a confirmação do pagamento, você receberá uma notificação para resgatar seu número.</p><a href="/meus-servicos">Ir para Minha Empresa</a><a href="/painel">Voltar ao painel LOSI</a></div>}
   {notice&&!selected&&<p className="lc-notice" role="status">{notice}<button aria-label="Fechar aviso" onClick={()=>setNotice("")}><Icon name="close"/></button></p>}
  </section>
  <section className="lc-main" aria-label={selected?`Conversa com ${selected.name}`:"Apresentação do Chat LOSI"}>
   {selected?<>
    <header className="lc-thread-header"><button className="lc-thread-back" aria-label="Voltar às conversas" onClick={()=>setSelected(null)}><Icon name="back"/></button><span className={`lc-avatar lc-avatar-${selected.color}`} aria-hidden="true">{selected.initials}</span><div><strong>{selected.name}</strong><small>Conversa demonstrativa</small></div><button className="lc-thread-balance" onClick={()=>go("credits")}><Icon name="wallet"/><span>10.000 <small>créditos · prévia</small></span></button></header>
    <div className="lc-thread-messages"><span className="lc-day">Hoje</span><p className="lc-thread-disclaimer">Demonstração · estas mensagens não foram enviadas.</p><div className="lc-bubble received">Olá! Vamos trocar experiências sobre os próximos eventos?<time>20:10</time></div><div className="lc-bubble sent">Claro! Podemos compartilhar ideias e conhecer novos parceiros.<span><time>20:12</time><Icon name="check"/></span></div><div className="lc-bubble received">{selected.text}<time>{selected.time}</time></div></div>
    {notice&&<p className="lc-notice" role="status">{notice}<button aria-label="Fechar aviso" onClick={()=>setNotice("")}><Icon name="close"/></button></p>}
    <form className="lc-composer" onSubmit={e=>{e.preventDefault();previewNotice();}}><button type="button" aria-label="Adicionar anexo" onClick={previewNotice}><Icon name="plus"/></button><button type="button" aria-label="Emojis" onClick={previewNotice}><Icon name="smile"/></button><input aria-label="Mensagem demonstrativa" placeholder="Digite uma mensagem" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={4000}/><button className="lc-send" type="submit" aria-label="Testar botão de enviar na prévia"><Icon name="send"/></button></form>
   </>:<div className="lc-welcome"><div className="lc-welcome-card"><img src="/losi-conecta-symbol.svg" alt="" width="110" height="110"/><h2>Seu próximo parceiro está aqui</h2><p>Troque experiências e desenvolva seu networking com outros fornecedores da LOSI.</p><button onClick={()=>go("contacts")}>Encontrar contatos</button></div><div className="lc-shortcuts"><button onClick={previewNotice}><span><Icon name="file"/></span>Enviar documento</button><button onClick={()=>go("contacts")}><span><Icon name="users"/></span>Adicionar contato</button><button onClick={()=>go("credits")}><span><Icon name="wallet"/></span>Saldo e recarga</button><button onClick={()=>go("account")}><span><Icon name="profile"/></span>Meu número LOSI</button></div><p className="lc-welcome-footnote">Prévia visual · mensagens e pagamentos ainda não estão habilitados</p></div>}
  </section>
  <nav className="lc-mobile-nav" aria-label="Navegação do Chat LOSI">{nav.map(n=><button key={n.id} className={section===n.id?"is-active":""} aria-current={section===n.id?"page":undefined} onClick={()=>go(n.id)}><span><Icon name={n.icon}/>{n.id==="chats"&&<b>{unread}</b>}</span><strong>{n.label}</strong></button>)}</nav>
 </main>;
}
