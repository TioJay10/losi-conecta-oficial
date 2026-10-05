const fs=require("node:fs"),vm=require("node:vm"),ts=require("typescript"),assert=require("node:assert/strict"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../src/lib/lia-pdfs.ts"),"utf8");
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};
vm.runInNewContext(code,{module:mod,exports:mod.exports,require,atob,Blob,Uint8Array});
const documents=["classic","geometric"].map(layout=>mod.exports.materialPdf("Treinamento de recreação",Array(200).fill("Orientações de atendimento à equipe.").join("\n"),"LOSI Gestão em Lazer",layout));
for(const encoded of documents){
 const bytes=Buffer.from(encoded,"base64");
assert.equal(bytes.subarray(0,5).toString(),"%PDF-");
assert(bytes.toString().includes("%%EOF"));
assert((bytes.toString().match(/\/Type \/Page\b/g)||[]).length>1);
assert(encoded.length<2800000);
assert(/^JVBERi0[A-Za-z0-9+/]*={0,2}$/.test(encoded));
}
assert((Buffer.from(documents[1],"base64").toString().match(/\/Type \/Page\b/g)||[]).length>(Buffer.from(documents[0],"base64").toString().match(/\/Type \/Page\b/g)||[]).length);
assert.equal(mod.exports.pdfFilename("Recreação infantil"),"recreacao-infantil.pdf");
(async()=>{
 for(const encoded of documents){
  const blob=mod.exports.pdfBlob(encoded);
  assert.equal(blob.type,"application/pdf");
  assert(Buffer.from(await blob.arrayBuffer()).equals(Buffer.from(encoded,"base64")));
 }
 console.log("PASS: PDF structure, pagination, saved encoding, exact byte restoration and filenames.");
})().catch(error=>{console.error(error);process.exit(1);});
