// Read-only provider checks. Never generate AI content, charge money, or log credentials.
const plans=[['MONTHLY','month',1,15000,3000],['QUARTERLY','month',3,45000,9000],['ANNUAL','year',1,170000,34000]];
export async function providerReadiness(env,request=fetch) {
 const read=async(url,headers)=>{
  try{const response=await request(url,{headers,redirect:'error',signal:AbortSignal.timeout(12000)});return {status:response.status,data:response.ok?await response.json():null};}
  catch{return {status:0,data:null};}
 };
 const stripe=async()=>{
  const key=env.STRIPE_SECRET_KEY?.trim();
  if(!key)return {status:'missing_key'};
  const mode=/^(?:sk|rk)_live_/.test(key)?'live':/^(?:sk|rk)_test_/.test(key)?'test':'invalid';
  if(mode==='invalid')return {status:'invalid_key_type'};
  let checked=0;
  for(const [stem,interval,count,ron,eur] of plans){
   for(const [currency,amount] of [['ron',ron],['eur',eur]]){
    const id=env[`STRIPE_${stem}${currency==='eur'?'_EUR':''}_PRICE_ID`];
    if(!/^price_[a-zA-Z0-9]+$/.test(id??''))return {status:'missing_price',plan:stem.toLowerCase(),currency,checked};
    const result=await read('https://api.stripe.com/v1/prices/'+id,{Authorization:'Bearer '+key});
    if(result.status!==200)return {status:'price_lookup_failed',httpStatus:result.status,plan:stem.toLowerCase(),currency,checked};
    const p=result.data;
    if(!p.active||p.type!=='recurring'||p.currency!==currency||p.unit_amount!==amount||p.recurring?.interval!==interval||p.recurring?.interval_count!==count||p.recurring?.usage_type!=='licensed'||p.livemode!==(mode==='live'))return {status:'price_mismatch',plan:stem.toLowerCase(),currency,checked};
    checked++;
   }
  }
  return {status:'catalog_ready',mode,checked,webhookConfigured:!!env.STRIPE_WEBHOOK_SECRET,livePaymentsEnabled:env.AUTOCARE_ENABLE_LIVE_PAYMENTS==='true',eurEnabled:env.AUTOCARE_ENABLE_EUR_PAYMENTS==='true'};
 };
 const ai=async()=>{
  const key=env.GEMINI_API_KEY?.trim();
  if(!key)return {status:env.OPENAI_API_KEY?'alternative_provider_not_checked':'missing_key'};
  const result=await read('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{'x-goog-api-key':key});
  if(result.status!==200)return {status:'model_lookup_failed',httpStatus:result.status};
  const names=(result.data?.models??[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name?.replace(/^models\//,''));
  const preferred=env.GEMINI_MODEL?.trim()||'gemini-2.5-flash-lite';
  const compatible=names.filter(m=>typeof m==='string'&&/^gemini-.*(?:flash|pro)/.test(m)&&!/(?:tts|audio|image|live|embedding|robotics|computer-use)/i.test(m));
  return {status:compatible.length?'models_available':'no_compatible_models',preferredModelAvailable:compatible.includes(preferred),compatibleModels:compatible.length};
 };
 const [billing,assistant]=await Promise.all([stripe(),ai()]);
 const gmailKeys=['GOOGLE_MAIL_CLIENT_ID','GOOGLE_MAIL_CLIENT_SECRET','GOOGLE_MAIL_FROM','GOOGLE_MAIL_REDIRECT_URI'];
 const missing=gmailKeys.filter(key=>!env[key]);
 const mail={gmail:missing.length?{status:'missing_configuration',missing}:{status:'configured_oauth_and_delivery_test_required'},resend:env.RESEND_API_KEY&&env.EMAIL_FROM?'configured_not_delivery_verified':'not_configured',automationsEnabled:env.AUTOCARE_MAIL_AUTOMATIONS_ENABLED==='true'};
 return {event:'autocare_provider_readiness',stripe:billing,ai:assistant,mail,founderConfigured:!!env.AUTOCARE_FOUNDER_USER_ID?.trim()};
}
