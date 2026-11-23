'use client';

import {useId,useRef,useState,type FormEvent} from 'react';
import {vehicleDocumentCategories} from '@/lib/validation';
import {FilterSelect} from '../filter-select';
import {PremiumDateInput} from '../premium-date-input';
import {useApplicationLanguage} from '../application-locale';

type Props={
  vehicles: ReadonlyArray<{brand:string;model:string;plate:string;vin:string|null}>;
  busy:boolean;
  onDirty:()=>void;
  onCancel:()=>void;
  onSave:(event:FormEvent<HTMLFormElement>)=>Promise<void>;
};

export function VehicleCreateForm({vehicles,busy,onDirty,onCancel,onSave}:Props){
  const en=useApplicationLanguage()==='en';
  const t=(ro:string,english:string)=>en?english:ro;
  const [step,setStep]=useState(0);
  const [make,setMake]=useState('');
  const [summary,setSummary]=useState<FormData|null>(null);
  const [error,setError]=useState('');
  const title=useRef<HTMLHeadingElement>(null);
  const suggestions=useId();
  const makes=[...new Set(vehicles.map(vehicle=>vehicle.brand))];
  const models=[...new Set(vehicles.filter(vehicle=>vehicle.brand.trim().toLowerCase()===make.trim().toLowerCase()).map(vehicle=>vehicle.model))];
  const steps=[t('Identificare','Identification'),t('Date tehnice','Technical details'),t('Documente','Documents'),t('Confirmare','Review')];
  const changeStep=(next:number)=>{
    setError('');
    setStep(next);
    requestAnimationFrame(()=>title.current?.focus());
  };
  const submit=async (event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(busy)return;
    const form=event.currentTarget;
    if(step===3){await onSave(event);return;}
    const active=form.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-vehicle-step="'+step+'"] input, [data-vehicle-step="'+step+'"] select');
    for(const input of active){
      if(!input.reportValidity())return;
    }
    const values=new FormData(form);
    if(step===1){
      const normalize=(value:unknown)=>String(value??'').replace(/\s/g,'').toUpperCase();
      const plate=normalize(values.get('plate'));
      const vin=normalize(values.get('vin'));
      if(vehicles.some(vehicle=>normalize(vehicle.plate)===plate||(vin&&normalize(vehicle.vin)===vin))){
        setError(t('Există deja o mașină cu acest număr sau VIN.','A vehicle with this plate or VIN already exists.'));
        return;
      }
    }
    if(step===2)setSummary(values);
    changeStep(step+1);
  };
  return <form className="ac-premium-vehicle-form rg-vehicle-wizard" noValidate onSubmit={submit} onChange={()=>{onDirty();setError('');}}>
    <ol className="rg-vehicle-progress" aria-label={t('Pașii formularului','Form steps')}>
      {steps.map((label,index)=><li key={label} aria-current={index===step?'step':undefined}><span>{index+1}</span>{label}</li>)}
    </ol>
    <h3 ref={title} tabIndex={-1}>{steps[step]}</h3>
    <div hidden={step!==0} data-vehicle-step={0}>
      <div className="form-grid">
        <label>{t('Marcă','Make')}<input name="brand" required list={suggestions+'-makes'} value={make} onChange={e=>setMake(e.target.value)}/></label>
        <datalist id={suggestions+'-makes'}>{makes.map(value=><option key={value} value={value}/>)}</datalist>
        <label>{t('Model','Model')}<input name="model" required list={suggestions+'-models'}/></label>
        <datalist id={suggestions+'-models'}>{models.map(value=><option key={value} value={value}/>)}</datalist>
        <label>{t('An','Year')}<input name="year" type="number" required min={1886} max={new Date().getFullYear()+1} defaultValue={new Date().getFullYear()}/></label>
        <label>{t('Combustibil','Fuel')}<FilterSelect name="fuel" defaultValue="Benzină">
          {['Benzină','Diesel','Hibrid','Electric','GPL','Altul'].map(fuel=><option key={fuel} value={fuel}>{fuel}</option>)}
        </FilterSelect></label>
        <label className="full">{t('Motorizare','Engine')}<input name="engine"/></label>
      </div>
    </div>
    <div hidden={step!==1} data-vehicle-step={1}>
      <div className="form-grid">
        <label>{t('Număr de înmatriculare','Registration plate')}<input name="plate" required minLength={2} maxLength={20}/></label>
        <label>VIN<input name="vin" maxLength={17} pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" title={t('17 caractere, fără I, O sau Q','17 characters, excluding I, O and Q')}/></label>
        <label>{t('Kilometraj actual','Current odometer')}<input name="odometer" type="number" required min={0} max={10000000} defaultValue={0}/></label>
        <label>{t('Capacitate (cm³)','Displacement (cm³)')}<input name="capacity" type="number" min={0} max={30000}/></label>
        <label className="full">{t('Data achiziției','Purchase date')}<PremiumDateInput name="purchasedAt" type="date"/></label>
        <label className="full">{t('Note','Notes')}<textarea name="notes" maxLength={4000}/></label>
      </div>
    </div>
    <div hidden={step!==2} data-vehicle-step={2}>
      <p>{t('Poți adăuga acum datele de expirare sau le poți completa din Documente.','Add expiration dates now or enter them later in Documents.')}</p>
      <div className="form-grid">
        {vehicleDocumentCategories.map(category=><label key={category}>{category}<PremiumDateInput name={'document-'+category} type="date"/></label>)}
      </div>
    </div>
    {step===3&&summary&&<dl className="rg-vehicle-review">
      <div><dt>{t('Vehicul','Vehicle')}</dt><dd>{String(summary.get('brand'))} {String(summary.get('model'))} · {String(summary.get('year'))}</dd></div>
      <div><dt>{t('Număr de înmatriculare','Registration plate')}</dt><dd>{String(summary.get('plate')).toUpperCase()}</dd></div>
      <div><dt>{t('Kilometraj','Odometer')}</dt><dd>{Number(summary.get('odometer')).toLocaleString(en?'en-GB':'ro-RO')} km</dd></div>
      <div><dt>VIN</dt><dd>{String(summary.get('vin')||'—').toUpperCase()}</dd></div>
      {vehicleDocumentCategories.map(category=>{
        const expiresAt=summary.get('document-'+category);
        return expiresAt&&<div key={category}><dt>{category}</dt><dd>{String(expiresAt)}</dd></div>;
      })}
    </dl>}
    {error&&<p role="alert">{error}</p>}
    <div className="actions">
      <button type="button" disabled={busy} onClick={step===0?onCancel:()=>changeStep(step-1)}>{step===0?t('Renunță','Cancel'):t('Înapoi','Back')}</button>
      <button className="primary" disabled={busy}>{step<3?t('Continuă','Continue'):busy?t('Se salvează…','Saving…'):t('Salvează mașina','Save vehicle')}</button>
    </div>
  </form>;
}
