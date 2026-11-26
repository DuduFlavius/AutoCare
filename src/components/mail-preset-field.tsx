'use client';
import {useState} from 'react';
import {FilterSelect} from './filter-select';

export function MailPresetField({label,value,choices,onChange,disabled,en}:{
  label:string;value:string;choices:{value:string;label:string}[];onChange:(value:string)=>void;disabled:boolean;en:boolean;
}) {
  const [custom,setCustom]=useState(false);
  const represented=choices.some(choice=>choice.value===value);
  const showCustom=custom||Boolean(value&&!represented);
  return <div className="studio-preset-field">
    <label>{label}<FilterSelect value={showCustom?'__custom__':value} disabled={disabled} onChange={event=>{
      const next=event.target.value;
      setCustom(next==='__custom__');
      if(next!=='__custom__')onChange(next);
    }}>
      <option value="">{en?'Choose an option':'Alege o opțiune'}</option>
      {choices.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
      <option value="__custom__">{en?'Custom text…':'Text propriu…'}</option>
    </FilterSelect></label>
    {showCustom&&<input aria-label={label+(en?' — custom':' — text propriu')} value={value} disabled={disabled} maxLength={100} onChange={event=>onChange(event.target.value)}/>}
  </div>;
}
