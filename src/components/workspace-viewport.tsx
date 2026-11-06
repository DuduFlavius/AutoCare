'use client';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
/** Native WebView controls scale; web keeps browser accessibility zoom. */
export default function WorkspaceViewport({service}:{service:boolean}) {
 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;
  const viewport=document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const old=viewport?.content;
  if(viewport)viewport.content='width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
  const gesture=(event:Event)=>{event.preventDefault();};
  document.addEventListener('gesturestart',gesture,{passive:false});
  document.addEventListener('gesturechange',gesture,{passive:false});
  return()=>{if(viewport&&old!==undefined)viewport.content=old;document.removeEventListener('gesturestart',gesture);document.removeEventListener('gesturechange',gesture);};
 },[]);
 useEffect(()=>{
  if(!service)return;
  const surface=document.querySelector<HTMLElement>('.workspace-service');
  const previous=surface?.style.touchAction;
  if(surface)surface.style.touchAction='pan-x pan-y';
  return()=>{if(surface)surface.style.touchAction=previous||'';};
 },[service]);
 return null;
}
