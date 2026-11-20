export type ConfirmationRequest={message:string;language:'ro'|'en';action?:()=>Promise<void>;resolve:(value:boolean)=>void};
/** Fail closed without a mounted host; never queue repeat destructive clicks. */
export class ConfirmationQueue{
 private current:ConfirmationRequest|null=null;
 private subscribers=new Set<(value:ConfirmationRequest|null)=>void>();
 subscribe(listener:(value:ConfirmationRequest|null)=>void){this.subscribers.add(listener);return()=>{this.subscribers.delete(listener);if(!this.subscribers.size)this.settle(false);};}
 request(message:string,language:'ro'|'en',action?:()=>Promise<void>):Promise<boolean>{
  if(this.current||!this.subscribers.size)return Promise.resolve(false);
  return new Promise(resolve=>{this.current={message,language,action,resolve};this.subscribers.forEach(fn=>fn(this.current));});
 }
 settle(value:boolean){const request=this.current;if(!request)return;this.current=null;this.subscribers.forEach(fn=>fn(null));request.resolve(value);}
}
