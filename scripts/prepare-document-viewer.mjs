import {copyFile,mkdir,cp} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
await mkdir(new URL('../public/',import.meta.url),{recursive:true});
await copyFile(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'),new URL('../public/pdf.worker.min.mjs',import.meta.url));

for(const folder of ["cmaps","standard_fonts"]){await cp(new URL("../node_modules/pdfjs-dist/"+folder+"/",import.meta.url),new URL("../public/pdfjs/"+folder+"/",import.meta.url),{recursive:true});}
