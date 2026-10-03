'use client';
import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { composeLinks } from '@/modules/agents/domain';

export interface AgentField {
  name:string;label:string;type?:string;required?:boolean;
  options?:Array<{value:string;label:string}>;
}
export function AgentForm({endpoint,fields=[],values={},button,labels,share=false,shareMessage}:{
  endpoint:string;fields?:AgentField[];values?:Record<string,unknown>;
  button:string;labels:Record<string,string>;share?:boolean;shareMessage?:string;
}) {
  const router=useRouter();
  const id=useId();
  const [busy,setBusy]=useState(false);
  const [state,setState]=useState('');
  const [url,setUrl]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setState('');
    const form=event.currentTarget;
    const data=new FormData(form);
    const input:Record<string,unknown>={...values};
    try {
      for(const field of fields) {
        const value=String(data.get(field.name)??'');
        if(field.type==='checkbox') input[field.name]=data.has(field.name);
        else if(field.type==='money') {
          if(!/^\d{1,12}(\.\d{1,2})?$/.test(value)) throw new Error('invalid_amount');
          const [whole,fraction='']=value.split('.');
          input[field.name]=(BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))).toString();
        } else if(field.type==='datetime-local') input[field.name]=new Date(value).toISOString();
        else input[field.name]=value;
      }
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error);
      setState(labels['agent.saved']);
      if(share && result.path) setUrl(new URL(result.path,window.location.origin).toString());
      else {form.reset();router.refresh();}
    } catch {setState(labels['agent.error']);}
    finally {setBusy(false);}
  }
  const links=url?composeLinks(url,shareMessage??button):null;
  return <form onSubmit={submit} className="flex flex-col gap-16">
    {fields.map(field=>field.options
      ?<Select key={field.name} name={field.name} label={field.label} required={field.required}
        options={field.options} defaultValue={field.options[0]?.value}/>
      :field.type==='checkbox'
        ?<label key={field.name} className="flex items-start gap-8 text-small text-text-ink">
          <input name={field.name} type="checkbox" required={field.required} className="mt-4"/>{field.label}
        </label>
        :field.type==='textarea'
          ?<label key={field.name} htmlFor={id+field.name} className="flex flex-col gap-8 text-small text-text-ink">
            {field.label}<textarea id={id+field.name} name={field.name} required={field.required}
              rows={4} maxLength={8000} className="w-full rounded-lg border border-border-line bg-surface-paper p-12"/>
          </label>
          :<Input key={field.name} name={field.name} label={field.label} required={field.required}
            type={field.type==='money'?'text':field.type??'text'} inputMode={field.type==='money'?'decimal':undefined}
            maxLength={2000}/>)}
    <Button type="submit" isLoading={busy} size="sm" variant="secondary">{button}</Button>
    {state?<p role="status" className="text-small text-text-stone">{state}</p>:null}
    {links?<div className="flex flex-col gap-12">
      <Input aria-label={labels['agent.share']} readOnly value={url}/>
      <Button type="button" size="sm" onClick={async()=>{
        try {await navigator.clipboard.writeText(url);setState(labels['agent.copied']);}
        catch {setState(labels['agent.error']);}
      }}>{labels['agent.copy']}</Button>
      <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="text-brand-andaman">{labels['agent.whatsapp']}</a>
      <a href={links.telegram} target="_blank" rel="noopener noreferrer" className="text-brand-andaman">{labels['agent.telegramShare']}</a>
      <p className="text-small text-text-stone">{labels['agent.shareNote']}</p>
    </div>:null}
  </form>;
}
