'use client';
import {useEffect,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {ArrowUpRight,Smartphone,Globe} from 'lucide-react';
import {androidAppIntent,safeAppDestination} from '@/lib/app-links';
export default function OpenApp({destination,english=false}:{destination:string;english?:boolean}){
 const target=safeAppDestination(destination),[android,setAndroid]=useState(false),t=(ro:string,en:string)=>english?en:ro;
 useEffect(()=>{setAndroid(/Android/i.test(navigator.userAgent));if(Capacitor.isNativePlatform()||window.matchMedia('(display-mode: standalone)').matches||('standalone' in navigator&&navigator.standalone))window.location.replace(target);},[target]);
 return <main className="ac-open-app"><section><img src="/icon-192.png" width={76} height={76} alt="AutoCare"/><p className="eyebrow">AUTOCARE · GARAJUL TĂU DIGITAL</p><h1>{t('Continuă în AutoCare','Continue in AutoCare')}</h1><p>{t('Ai aplicația instalată? Deschide-o și continuă cu același cont.','Already installed? Open the app and continue with your existing account.')}</p>{android&&<a className="primary button" href={androidAppIntent(target)}><Smartphone size={20}/>{t('Deschide aplicația','Open the app')}<ArrowUpRight size={18}/></a>}<a className="button" href={target}><Globe size={19}/>{t('Continuă pe site','Continue on the website')}</a><a className="ac-open-app-install" href={english?'/en/install':'/instaleaza'}>{t('Nu ai aplicația? Instalează AutoCare','Need the app? Install AutoCare')}</a><small>{t('Dacă Android deschide linkul în browser, apasă „Deschide aplicația”. Este necesară versiunea Android 1.5.4 sau mai nouă.','If Android opens the browser, tap “Open the app”. Android app version 1.5.4 or later is required.')}</small></section></main>;
}
