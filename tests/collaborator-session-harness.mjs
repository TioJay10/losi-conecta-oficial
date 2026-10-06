import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {webcrypto} from 'node:crypto';
export function sessionHelpers(){
 const exports={};
 const source=fs.readFileSync('supabase/functions/_shared/collaborator-sessions.ts','utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,crypto:webcrypto,TextEncoder,Uint8Array});
 return exports;
}
export function stripSessionImport(source){return source.replace(/import \{[^}]+\} from "\.\.\/_shared\/collaborator-sessions\.ts";\n/,'')}
