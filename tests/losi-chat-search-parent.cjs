// Exercise the actual chat parent's search visibility and focus policy without network effects.
const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
const code=ts.transpileModule(fs.readFileSync('src/components/LosiChatPreview.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const thread={id:'fixture',name:'Fornecedor teste',initials:'FT',number:'123456789',color:'ocean',group:false,text:'',unread:0};
let cursor=0;const slots=[],frames=[];const Search=()=>null;
const react={useState(v){const i=cursor++;if(!(i in slots))slots[i]=i===0?[thread]:v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useEffect(){cursor++;},useCallback(fn){cursor++;return fn;}};
const jsx=(type,props)=>({type,props});const context={exports:{},Map,URLSearchParams,requestAnimationFrame:fn=>frames.push(fn),require(n){if(n==='react')return react;if(n==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:'fragment'};if(n==='../lib/losi-chat')return{useLosiChatAccount:()=>({account:{balance:100,digital_number:'123456789'},loading:false}),formatLosiNumber:v=>v};if(n==='./LosiChatSearch')return{LosiChatSearch:Search};return{};}};
vm.createContext(context);vm.runInContext(code,context);
function render(){cursor=0;return context.exports.LosiChatPreview();}
function find(t,p){if(!t)return;if(Array.isArray(t)){for(const x of t){const r=find(x,p);if(r)return r;}}else if(typeof t==='object'){if(p(t))return t;return find(t.props?.children,p);}}
let tree=render();find(tree,n=>n.props?.className==='lc-conversation').props.onClick();tree=render();
find(tree,n=>n.props?.['aria-label']==='Buscar nesta conversa').props.onClick();tree=render();assert.equal(find(tree,n=>n.type===Search).props.open,true);
find(tree,n=>n.type===Search).props.onClose(false);tree=render();assert.equal(find(tree,n=>n.type===Search).props.open,false);assert.equal(frames.length,0,'touch must not immediately focus the opener');
const opener=find(tree,n=>n.props?.['aria-label']==='Buscar nesta conversa');opener.props.onClick();tree=render();
find(tree,n=>n.props?.['aria-label']==='Fechar busca nesta conversa').props.onClick();tree=render();assert.equal(find(tree,n=>n.type===Search).props.open,false);
find(tree,n=>n.props?.['aria-label']==='Buscar nesta conversa').props.onClick();tree=render();
const focus=[];find(tree,n=>n.props?.className==='lc-thread-search-button').props.ref.current={focus:options=>focus.push(options)};
find(tree,n=>n.type===Search).props.onClose(true);tree=render();assert.equal(find(tree,n=>n.type===Search).props.open,false);assert.equal(focus.length,0);frames.shift()();assert.equal(focus[0].preventScroll,true);
console.log('PASS: child X and header X hide the stable search; pointer close avoids focus transfer; keyboard focus returns after close');
