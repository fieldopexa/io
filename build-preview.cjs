/* Standalone, non-writing preview. Usage: node build-preview.cjs OUTPUT.html */
const fs=require('node:fs');
const path=require('node:path');
const output=process.argv[2];
if(!output)throw new Error('Supply an output HTML path.');
let html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
html=html.replace(/<link[^>]+rel="(?:manifest|apple-touch-icon|icon)"[^>]*>/g,'').replace('<script defer src="./install.js"></script>','');
html=html.replace(/<link rel="stylesheet" href="([^" ]+)"\s*>/g,(tag,file)=>{
  const local=path.join(__dirname,file);return fs.existsSync(local)?'<style>'+fs.readFileSync(local,'utf8')+'</style>':tag;
});
const script=js=>'<script>'+js.replace(/<\/script/gi,'<\\/script')+'</script>';
html=html.replace(/<script src="([^" ]+)"><\/script>/g,(tag,file)=>{
  const local=path.join(__dirname,file);if(!fs.existsSync(local))return tag;
  let js=fs.readFileSync(local,'utf8');
  if(file==='service-form.js')js=js.replace("new URL('service-form-reference.png', document.baseURI).href",JSON.stringify('data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'service-form-reference.png')).toString('base64')));
  return script(js);
});
html=html.replace('<head>','<head>'+script('window.fetch=()=>Promise.reject(new Error("Offline preview: network requests disabled."));'));
html+=script(fs.readFileSync(path.join(__dirname,'preview-fixtures.js'),'utf8'));
fs.writeFileSync(output,html);
console.log('Created '+output);
