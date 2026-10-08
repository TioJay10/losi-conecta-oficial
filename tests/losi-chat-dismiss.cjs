const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
class Node { constructor(parent=null){this.parent=parent;} contains(node){for(;node;node=node.parent)if(node===this)return true;return false;} }
function harness(path,mocks={}){
 let cursor=0;const slots=[],effects=[],listeners=[];
 const react={useRef(v){const i=cursor++;return slots[i]??(slots[i]={current:v});},useState(v){const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},useEffect(fn){cursor++;if(fn.toString().includes("'pointerdown'"))effects.push(fn);},useCallback:fn=>fn};
 const jsx=(type,props)=>({type,props});
 const doc={addEventListener(type,fn,capture=false){listeners.push({type,fn,capture});},removeEventListener(type,fn,capture=false){const i=listeners.findIndex(x=>x.type===type&&x.fn===fn&&x.capture===capture);assert.notEqual(i,-1);listeners.splice(i,1);}};
 const ctx={exports:{},Node,document:doc,require(n){if(n==='react')return react;if(n==='react/jsx-runtime')return{jsx,jsxs:jsx};return mocks[n]||{};}};
 vm.createContext(ctx);vm.runInContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,ctx);
 return {render(name,props){cursor=0;effects.length=0;return ctx.exports[name](props);},mount(){return effects.map(f=>f()).filter(Boolean);},fire(type,event){for(const l of [...listeners].filter(x=>x.type===type))l.fn(event);},listeners};
}
function find(t,p){if(Array.isArray(t)){for(const x of t){const r=find(x,p);if(r)return r;}}else if(t&&typeof t==='object'){if(p(t))return t;return find(t.props?.children,p);}}
let closed=0;
const h=harness('src/components/LosiChatMessageMenu.tsx');
let tree=h.render('LosiChatMessageMenu',{message:{id:'x'},own:true,open:true,onClose:()=>closed++,onOpen(){},onDeleted(){}});
const menu=find(tree,x=>x.props?.className==='lc-media-menu'),trigger=find(tree,x=>x.props?.className==='lc-message-menu-trigger');menu.props.ref.current=new Node();trigger.props.ref.current=new Node();
const cleanup=h.mount();assert.equal(h.listeners.find(x=>x.type==='pointerdown').capture,true);
h.fire('pointerdown',{target:new Node(menu.props.ref.current),pointerType:'touch'});h.fire('pointerdown',{target:new Node(trigger.props.ref.current)});assert.equal(closed,0,'inside and trigger preserve menu');
h.fire('pointerdown',{target:new Node(),pointerType:'touch'});assert.equal(closed,1,'mobile tap outside closes');h.fire('pointerdown',{target:new Node(),pointerType:'mouse'});assert.equal(closed,2,'desktop click outside closes');h.fire('keydown',{key:'a'});assert.equal(closed,2);h.fire('keydown',{key:'Escape'});assert.equal(closed,3);cleanup.forEach(f=>f());assert.equal(h.listeners.length,0);
const main=harness('src/components/LosiChatPreview.tsx',{'../lib/losi-chat':{useLosiChatAccount:()=>({account:{balance:100},loading:false}),formatLosiNumber:x=>x},'../lib/losi-chat-theme':{useLosiChatTheme:()=>({theme:'dark',toggleTheme(){}})}});
tree=main.render('LosiChatPreview');find(tree,x=>x.props?.['aria-label']==='Abrir opções').props.onClick();tree=main.render('LosiChatPreview');
const panel=find(tree,x=>x.props?.className==='lc-menu');panel.props.ref.current=new Node();const triggerMain=find(tree,x=>x.props?.['aria-label']==='Abrir opções');triggerMain.props.ref.current=new Node();const dispose=main.mount();
main.fire('pointerdown',{target:new Node(panel.props.ref.current),pointerType:'touch'});tree=main.render('LosiChatPreview');assert.ok(find(tree,x=>x.props?.className==='lc-menu'));
main.fire('pointerdown',{target:new Node(),pointerType:'touch'});tree=main.render('LosiChatPreview');assert.equal(find(tree,x=>x.props?.className==='lc-menu'),undefined);dispose.forEach(f=>f());assert.equal(main.listeners.length,0);
console.log('PASS: main and message menus close on outside touch/click, keep internal actions and triggers, Escape and listener cleanup');
