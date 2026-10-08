import type { CSSProperties } from 'react';

type Palette = { bg:string; panel:string; raised:string; sent:string; text:string; muted:string; accent:string; line:string; light?:boolean };
const navy:Palette={bg:'#0b182a',panel:'#101f33',raised:'#1a2c43',sent:'#243e60',text:'#f5f7fa',muted:'#b7c6d9',accent:'#d6b46a',line:'#293b52'};
const paper:Palette={bg:'#f5f6f8',panel:'#ffffff',raised:'#eaf0f6',sent:'#e0eaf5',text:'#12243a',muted:'#526377',accent:'#806020',line:'#d3dbe5',light:true};
const lavender:Palette={bg:'#eeeaf6',panel:'#ffffff',raised:'#e5def0',sent:'#d9cdeb',text:'#302341',muted:'#635272',accent:'#70508a',line:'#d1c6df',light:true};
const rose:Palette={bg:'#f8edef',panel:'#ffffff',raised:'#f0dfe5',sent:'#eecfdc',text:'#432634',muted:'#715060',accent:'#924465',line:'#e3cbd5',light:true};
const teal:Palette={bg:'#0c2428',panel:'#123237',raised:'#21434a',sent:'#205259',text:'#eff9f7',muted:'#b1d1cf',accent:'#dfc78e',line:'#35565b'};
const plum:Palette={bg:'#211a30',panel:'#30263f',raised:'#423551',sent:'#523d6a',text:'#faf5ff',muted:'#cbbbdc',accent:'#e3c692',line:'#574365'};
const blue:Palette={bg:'#eaf2fa',panel:'#ffffff',raised:'#dce9f5',sent:'#c3dcf1',text:'#18344e',muted:'#405d74',accent:'#365e88',line:'#c3d5e5',light:true};
const sand:Palette={bg:'#f5f0e6',panel:'#ffffff',raised:'#eae1cf',sent:'#e4d5b8',text:'#3d3425',muted:'#635640',accent:'#795b24',line:'#d9ccb6',light:true};
function texture(size:number,shapes:string){return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${shapes}</svg>`)}")`;}
const wallpapers={
 linen:texture(12,'<path d="M2 0v12M8 0v12M0 3h12M0 9h12" stroke="#795b24" stroke-opacity=".06" stroke-width=".8"/>'),
 waves:texture(160,'<path d="M-20 35Q20 5 60 35T140 35T220 35M-20 95Q20 65 60 95T140 95T220 95M-20 155Q20 125 60 155T140 155T220 155" fill="none" stroke="#d6b46a" stroke-opacity=".13" stroke-width="1.2"/>'),
 confetti:texture(180,'<g opacity=".13"><path d="m20 26 8 12m100-20-9 11m-64 92 12 4m81 25 6-11" stroke="#924465" stroke-width="2"/><circle cx="86" cy="52" r="3" fill="#70508a"/><circle cx="18" cy="140" r="2" fill="#924465"/><path d="m138 72 8 2-4 8Z" fill="#795b24"/></g>'),
 petals:texture(180,'<g fill="none" stroke="#70508a" stroke-opacity=".12"><ellipse cx="45" cy="45" rx="12" ry="27" transform="rotate(35 45 45)"/><ellipse cx="122" cy="133" rx="12" ry="27" transform="rotate(-35 122 133)"/><path d="m62 72 10 12m70-44 8-10"/></g>'),
 stars:texture(180,'<g fill="#dfc78e" opacity=".18"><circle cx="24" cy="32" r="1.7"/><circle cx="99" cy="16" r="1"/><circle cx="139" cy="83" r="2"/><circle cx="50" cy="133" r="1"/></g><path d="M89 87h10m-5-5v10M154 149h6m-3-3v6" stroke="#dfc78e" stroke-opacity=".2"/>'),
 arches:texture(120,'<path d="M15 105V55a30 30 0 0 1 60 0v50M25 105V55a20 20 0 0 1 40 0v50M35 105V55a10 10 0 0 1 20 0v50" fill="none" stroke="#795b24" stroke-opacity=".12"/>'),
 terrazzo:texture(150,'<g opacity=".12"><path d="m12 19 15-5 6 15-18 7Z" fill="#365e88"/><path d="m96 31 11 2-5 12-12-4Z" fill="#70508a"/><path d="m68 90 12 7-6 14-15-3Z" fill="#365e88"/><path d="m122 125 10-8 7 10-9 7Z" fill="#795b24"/><circle cx="23" cy="117" r="3" fill="#365e88"/></g>'),
 diamonds:texture(120,'<path d="m60 10 35 50-35 50-35-50Z m0 18 23 32-23 32-23-32Z" fill="none" stroke="#e3c692" stroke-opacity=".1"/>'),
};
export const conversationThemes=[
 {id:'default',name:'Padrão do chat',category:'colors'},
 {id:'navy',name:'Azul-marinho',category:'colors',palette:navy},
 {id:'light',name:'Claro',category:'colors',palette:paper},
 {id:'gold',name:'Dourado suave',category:'colors',palette:{...sand,bg:'#f7f2e7',sent:'#eadbb8'}},
 {id:'blue',name:'Azul sereno',category:'colors',palette:blue},
 {id:'lavender',name:'Lavanda',category:'colors',palette:lavender},
 {id:'rose',name:'Rosa suave',category:'colors',palette:rose},
 {id:'teal',name:'Petróleo',category:'colors',palette:teal},
 {id:'plum',name:'Ameixa',category:'colors',palette:plum},
 {id:'linen',name:'Linho',category:'textures',palette:sand,wallpaper:wallpapers.linen},
 {id:'waves',name:'Ondas',category:'textures',palette:navy,wallpaper:wallpapers.waves},
 {id:'confetti',name:'Confetes',category:'textures',palette:rose,wallpaper:wallpapers.confetti},
 {id:'petals',name:'Pétalas',category:'textures',palette:lavender,wallpaper:wallpapers.petals},
 {id:'stars',name:'Constelação',category:'textures',palette:teal,wallpaper:wallpapers.stars},
 {id:'arches',name:'Arcos',category:'textures',palette:sand,wallpaper:wallpapers.arches},
 {id:'terrazzo',name:'Terrazzo',category:'textures',palette:blue,wallpaper:wallpapers.terrazzo},
 {id:'diamonds',name:'Diamantes',category:'textures',palette:plum,wallpaper:wallpapers.diamonds},
] as const;
export type ConversationThemeId=typeof conversationThemes[number]['id'];
export function conversationThemeStyle(id:string):CSSProperties {
 const theme=conversationThemes.find(t=>t.id===id);
 if(!theme||!('palette' in theme))return {};
 const p:Palette=theme.palette;
 return {colorScheme:p.light?'light':'dark','--lc-bg':p.bg,'--lc-panel':p.panel,'--lc-raised':p.raised,'--lc-sent':p.sent,'--lc-text':p.text,'--lc-muted':p.muted,'--lc-gold':p.accent,'--lc-accent':p.accent,'--lc-on-accent':p.light?'#fff':'#0b182a','--lc-line':p.line,'--lc-control-border':p.muted,'--lc-scrollbar':p.muted,'--lc-focus':p.accent,'--lc-menu':p.panel,'--lc-menu-hover':p.raised,'--lc-menu-border':p.line,'--lc-menu-divider':p.line,'--lc-quote':p.raised,'--lc-receipt':p.muted,'--lc-receipt-read':p.light?'#136b9c':'#65b9f5','--lc-danger':p.light?'#a52832':'#ffb3b3','--lc-attachment-text':p.text,'--lc-media-canvas':p.raised,'--lc-media-surface':p.panel,'--lc-media-border':p.line,'--lc-audio-bg':p.sent,'--lc-audio-text':p.text,'--lc-audio-avatar':p.raised,'--lc-audio-play':p.text,'--lc-audio-play-hover':p.muted,'--lc-audio-meta':p.muted,'--lc-audio-gold':p.accent,'--lc-waveform':p.accent,'--lc-wave-opacity':'.75','--lc-progress-dot':p.light?'#2671b5':'#65b9f5','--lc-wallpaper':'wallpaper' in theme?theme.wallpaper:'none'} as CSSProperties;
}
