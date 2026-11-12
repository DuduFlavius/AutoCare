/** One real reminder job invocation. No keep-alive polling or logged secrets. */
const target=process.env.AUTOCARE_APP_URL;
const secret=process.env.CRON_SECRET;
if(!target||!secret){console.error('Configure AUTOCARE_APP_URL and CRON_SECRET in the scheduler.');process.exit(1);}
try{
 const origin=new URL(target);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error('invalid origin');
 const response=await fetch(new URL('/api/v1/jobs/reminders',origin),{headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(150000)});
 if(!response.ok){console.error('Reminder job failed with HTTP '+response.status);process.exitCode=1;}
 else console.log('Reminder job completed successfully.');
}catch{console.error('Reminder job could not complete. Check the configured HTTPS origin and service availability.');process.exitCode=1;}
