/** Analytics uses a fixed event vocabulary and never sends names, document content, queries or IDs. */
export type PublicConversion='sign_up'|'login'|'support_request';
export function analyticsMeasurementId(value:string|undefined){return value&&/^G-[A-Z0-9]{6,20}$/.test(value)?value:null;}
export function analyticsEventAllowed(value:string):value is PublicConversion{return ['sign_up','login','support_request'].includes(value);}
export function publicConversion(event:PublicConversion){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('autocare-public-conversion',{detail:event}));}
