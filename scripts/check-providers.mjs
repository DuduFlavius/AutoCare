import {providerReadiness} from './provider-readiness.mjs';
try{console.log(JSON.stringify(await providerReadiness(process.env)));}
catch{console.warn(JSON.stringify({event:'autocare_provider_readiness',status:'check_failed'}));}
