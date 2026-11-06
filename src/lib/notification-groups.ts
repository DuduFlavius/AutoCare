type Notice={userId:string;recordId:string;revision:number;offset:string;localDate:string;channel:string;readAt:Date|null;status?:string};
export const notificationGroupKey=(n:Notice)=>JSON.stringify([n.userId,n.recordId,n.revision,n.offset,n.localDate]);
export function groupedNotifications<T extends Notice>(notices:T[]):T[]{
 const dismissed=new Set(notices.filter(n=>n.channel==='app'&&n.status==='dismissed').map(notificationGroupKey)),groups=new Map<string,T>();
 for(const notice of notices){const key=notificationGroupKey(notice);if(dismissed.has(key))continue;const previous=groups.get(key);if(!previous){groups.set(key,{...notice});continue;}const preferred=notice.channel==='app'?notice:previous;groups.set(key,{...preferred,readAt:previous.readAt&&notice.readAt?preferred.readAt:null});}
 return [...groups.values()];
}
