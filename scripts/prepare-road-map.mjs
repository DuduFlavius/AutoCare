import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('public/maps',{recursive:true});
// Both files are required: MapLibre 6's module worker imports its shared module.
for(const name of ['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs'])await copyFile('node_modules/maplibre-gl/dist/'+name,'public/maps/'+name);
