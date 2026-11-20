/** HTML-compatible local date values, validated without Date's rollover normalization. */
export function validDateValue(value:string,type:'date'|'month'|'datetime-local'='date',min?:string,max?:string){
 if(!value)return true;
 const pattern=type==='month'?/^(\d{4})-(\d{2})$/:type==='datetime-local'?/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::([0-9]{2}))?$/:/^(\d{4})-(\d{2})-(\d{2})$/;
 const match=value.match(pattern);if(!match)return false;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]||1);
 const days=new Date(Date.UTC(year,month,0)).getUTCDate();
 if(year<100||month<1||month>12||day<1||day>days)return false;
 if(type==='datetime-local'&&(Number(match[4])>23||Number(match[5])>59||Number(match[6]||0)>59))return false;
 return (!min||value>=min)&&(!max||value<=max);
}
