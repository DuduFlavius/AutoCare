'use client';
import { ArrowLeft, Wrench } from 'lucide-react';

export default function SmartDriveMaintenance({ english = false, onBack }: { english?: boolean; onBack: () => void }) {
  return (
    <section className="rg-smartdrive-maintenance" aria-labelledby="smartdrive-maintenance-title" role="status" style={{width:'100%',maxWidth:740,margin:'24px auto',padding:'clamp(24px,5vw,48px)',textAlign:'center',borderRadius:26,border:'1px solid #1C8062',background:'radial-gradient(ellipse at top,#123B2D 0%,#091611 50%,#050E0B 100%)',color:'#FFFFFF',boxShadow:'0 18px 55px #0005'}}>
      <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:68,height:68,borderRadius:'50%',background:'#0B1C16',color:'#20E6A2',marginBottom:20}}><Wrench size={32} aria-hidden="true"/></div>
      <h2 id="smartdrive-maintenance-title" style={{color:'#FFFFFF',fontSize:'clamp(24px,4vw,34px)',lineHeight:1.2,margin:'0 0 18px'}}>{english?'We are preparing a better GPS experience':'Pregătim o experiență GPS mai bună'}</h2>
      <p style={{color:'#A8BFB5',fontSize:16,lineHeight:1.7}}>{english?'SmartDrive GPS and AutoCare Premium navigation are temporarily under maintenance.':'SmartDrive GPS și navigația AutoCare Premium se află temporar în mentenanță.'}</p>
      <div style={{border:'1px solid #1C8062',borderRadius:16,background:'#10251E',padding:20,margin:'26px 0'}}>
        <p style={{color:'#A8BFB5',fontSize:14,margin:'0 0 8px'}}>{english?'Estimated return date':'Data estimată de revenire'}</p>
        <strong style={{fontSize:28,color:'#5AFFC4'}}>01.01.2027</strong>
      </div>
      <p style={{color:'#D9E9E1',lineHeight:1.7}}>{english?'We are improving route accuracy, navigation stability and mileage synchronization so every journey is safer and easier to track.':'Lucrăm la precizia traseelor, stabilitatea navigației și sincronizarea kilometrilor, pentru ca fiecare călătorie să fie mai sigură și mai ușor de urmărit.'}</p>
      <p style={{color:'#A8BFB5',fontSize:13,lineHeight:1.6,margin:'18px 0 26px'}}>{english?'Thank you for your patience! The date is estimated, and the service will return after final checks.':'Îți mulțumim pentru răbdare! Data este estimativă, iar serviciul va reveni după finalizarea verificărilor.'}</p>
      <button type="button" onClick={onBack} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:10,border:0,borderRadius:12,background:'#20D99A',color:'#062017',padding:'14px 24px',fontWeight:700,cursor:'pointer'}}><ArrowLeft size={18} aria-hidden="true"/>{english?'Back to Home':'Înapoi la Acasă'}</button>
    </section>
  );
}
