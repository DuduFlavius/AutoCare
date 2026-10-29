'use client';
import {createContext,useContext,type ReactNode} from 'react';
const ApplicationLanguage=createContext<'ro'|'en'>('ro');
export function ApplicationLanguageProvider({language,children}:{language:'ro'|'en';children:ReactNode}){
 return <ApplicationLanguage.Provider value={language}>{children}</ApplicationLanguage.Provider>;
}
export function useApplicationLanguage(){return useContext(ApplicationLanguage);}
export function useApplicationLocale(){return useApplicationLanguage()==='en'?'en-GB':'ro-RO';}
