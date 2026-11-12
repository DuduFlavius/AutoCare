/** Match the public OAuth origin, including HTTPS terminated by Render's edge proxy. */
export function isGoogleMailProductionRequest(request:Request,callback:string,renderProxy=false){
 try {
  const expected=new URL(callback);
  const actual=new URL(request.url);
  if(request.method!=='GET'&&request.headers.get('origin')!==expected.origin)return false;
  if(actual.origin===expected.origin)return true;
  // Forwarded headers are considered only on the configured Render deployment.
  // Require the actual Host too: a forwarded host alone never establishes trust.
  if(!renderProxy||expected.protocol!=='https:')return false;
  const host=request.headers.get('host')?.trim().toLowerCase();
  const forwardedHost=request.headers.get('x-forwarded-host')?.trim().toLowerCase();
  return host===expected.host&&request.headers.get('x-forwarded-proto')==='https'&&(!forwardedHost||forwardedHost===expected.host);
 }catch{return false;}
}
