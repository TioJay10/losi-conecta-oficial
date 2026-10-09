const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
const code=ts.transpileModule(fs.readFileSync('src/components/LosiChatMessageMenu.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const effects=[],events={},viewportEvents={};let closed=0,disconnected=false;class Node{};
const viewport={width:1024,height:700,offsetLeft:0,offsetTop:0,addEventListener:(n,f)=>viewportEvents[n]=f,removeEventListener:n=>delete viewportEvents[n]};
const window={visualViewport:viewport,addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]};
const react={useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:f=>effects.push(f)};
const jsx=(type,props)=>({type,props});
const context={exports:{},window,Node,ResizeObserver:class{observe(){}disconnect(){disconnected=true}},require:n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:{}};
vm.createContext(context);vm.runInContext(code,context);
const tree=context.exports.LosiChatMessageMenu({message:{id:'1'},own:true,open:true,onOpen(){},onClose(){closed++},onDeleted(){}});
function find(t,c){if(Array.isArray(t)){for(const n of t){const x=find(n,c);if(x)return x}}else if(t&&typeof t==='object'){if(t.props?.className===c)return t;return find(t.props?.children,c)}}
let anchor={width:28,right:900,top:100,bottom:124},bubble={right:370,top:90,bottom:400},historyBounds={left:0,right:1024,top:72,bottom:620};
const history={getBoundingClientRect:()=>historyBounds},child=new Node(),style={};
const node={style,contains:x=>x===child,getBoundingClientRect:()=>({width:Math.min(224,parseFloat(style.maxWidth)),height:Math.min(290,parseFloat(style.maxHeight))})};
find(tree,'lc-message-menu-trigger').props.ref.current={getBoundingClientRect:()=>anchor,closest:s=>s==='.lc-thread-messages'?history:{getBoundingClientRect:()=>bubble}};
find(tree,'lc-media-menu').props.ref.current=node;
const cleanup=effects.find(f=>f.toString().includes('ResizeObserver'))();
assert.equal(style.left,'676px');assert.equal(style.top,'128px','top message opens down');
anchor={width:28,right:100,top:550,bottom:574};events.resize();assert.equal(style.left,'12px');assert.equal(style.top,'256px','bottom message opens up');
anchor={width:28,right:1200,top:300,bottom:324};events.resize();assert.equal(style.left,'788px');assert.equal(style.top,'318px','middle message stays inside conversation');
// Mobile hidden trigger anchors to image, independent of its total height.
viewport.width=390;viewport.height=844;historyBounds={left:0,right:390,top:100,bottom:760};anchor={width:0};
bubble={right:370,top:130,bottom:900};events.resize();assert.equal(style.top,'134px','tall top image opens down');
bubble={right:370,top:390,bottom:600};events.resize();assert.equal(style.top,'394px','middle opens down');
bubble={right:370,top:690,bottom:740};events.resize();assert.equal(style.top,'396px','bottom opens up');
// Header growth and a keyboard/landscape viewport cannot hide any actions.
historyBounds.top=150;viewport.height=360;viewport.offsetTop=20;viewportEvents.resize();
assert.equal(style.maxHeight,'206px');assert.equal(style.top,'162px');
assert.ok(parseFloat(style.top)>=historyBounds.top+12);
assert.ok(parseFloat(style.top)+parseFloat(style.maxHeight)<=viewport.offsetTop+viewport.height-12);
events.scroll({target:child});assert.equal(closed,0);events.scroll({target:new Node()});assert.equal(closed,1);
cleanup();assert.ok(disconnected);assert.deepEqual(events,{});assert.deepEqual(viewportEvents,{});
const css=fs.readFileSync('src/losi-chat-attachments.css','utf8');assert.ok(css.indexOf('.lc-bubble .lc-media-menu{position:fixed')<css.indexOf('@media(min-width:769px)'),'fixed overlay applies to mobile too');
console.log('PASS: desktop/mobile menu directions, header/composer bounds, tall images, keyboard, resize, scrolling and cleanup');
