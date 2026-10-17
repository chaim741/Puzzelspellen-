const fs=require('fs'),es=require('esbuild');
const [src,dst]=process.argv.slice(2);let h=fs.readFileSync(src,'utf8');
h=h.replace(/<script>([\s\S]*?)<\/script>/g,(m,c)=>'<script>'+es.transformSync(c,{minify:true,target:'es2019'}).code.trim()+'</script>');
h=h.replace(/<style>([\s\S]*?)<\/style>/g,(m,c)=>'<style>'+es.transformSync(c,{minify:true,loader:'css'}).code.trim()+'</style>');
h=h.replace(/>\s+</g,'><');fs.writeFileSync(dst,h);console.log(dst,h.length);
