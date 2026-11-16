import {mkdir,writeFile} from 'node:fs/promises';
import {vehicleReport} from '../../src/lib/vehicle-report';
async function main(){
 const folder=process.argv[2]||'/tmp/autocare-pdf';await mkdir(folder,{recursive:true});
 const vehicles=[{id:'one',brand:'AutoCare',model:'Vehicul de test',plate:'TEST 01',odometer:125048},{id:'two',brand:'AutoCare',model:'Vehicul secundar',plate:'TEST 02',odometer:48000}];
 for(const [name,count,cars] of [['single',2,1],['multiple',8,2],['long',90,2],['empty',0,1]] as const){
 const records=Array.from({length:count},(_,i)=>({id:'r'+i,vehicleId:i%2&&cars===2?'two':'one',kind:i%3===0?'document':'service',title:i%3===0?'Asigurare și documente':'Revizie, reparații și întreținere',category:i%3===0?'RCA':'Service',date:'2026-11-16',expiresAt:i%3===0?'2027-11-16':null,nextKm:i%3?140000:null,odometer:125000+i,amountBani:12345+i*10,amountKnown:i%7!==0,provider:'Atelier autorizat',notes:name==='long'?'Observații cu diacritice: ș, ț, ă, î, â. '.repeat(12):'Verificare fără modificarea documentelor originale.',parts:'Ulei motor\nFiltre\nAutoCare · intervalUlei: 15000'}));
 await writeFile(folder+'/'+name+'.pdf',await vehicleReport({vehicles:vehicles.slice(0,cars),records,generatedAt:'16.11.2026',title:'Fișă de service',asOf:'2026-11-16'}));
 }
 console.log('Generated isolated report samples in '+folder);
}
void main();
