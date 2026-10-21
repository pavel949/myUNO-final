'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Guest={id:string;firstName:string;lastName:string;email:string|null};

export default function ReservationGroupForm({
  operatingSpaceId,guests,labels,
}:{operatingSpaceId:string;guests:Guest[];labels:Record<string,string>}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const saving=useRef(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(saving.current)return;
    saving.current=true;setBusy(true);setError('');
    const form=event.currentTarget;
    const data=new FormData(form);
    try {
    const response=await fetch('/api/ops/reservation-groups',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        operatingSpaceId,
        guestIdentityId:String(data.get('guestIdentityId')||''),
        title:String(data.get('title')||''),
        notes:String(data.get('notes')||''),
      }),
    });
    const body=await response.json();
    if(!response.ok){setError(body?.error||labels['reservations.group_failed']);return;}
    if(!body?.group?.id)throw new Error('Missing saved reservation group');
    form.reset();router.refresh();
    }catch{
      setError(labels['reservations.group_failed']);
    }finally{
      saving.current=false;setBusy(false);
    }
  }
  return <form onSubmit={submit} className="grid gap-12 stitch-panel p-16 md:grid-cols-4">
    <input required name="title" placeholder={labels['reservations.group_title']} className="h-44 rounded-md border border-border-line px-12"/>
    <select required name="guestIdentityId" className="h-44 rounded-md border border-border-line bg-white px-12">
      <option value="">{labels['reservations.guest']}</option>
      {guests.map(guest=><option key={guest.id} value={guest.id}>{guest.firstName} {guest.lastName}{guest.email?' · '+guest.email:''}</option>)}
    </select>
    <input name="notes" placeholder={labels['reservations.note']} className="h-44 rounded-md border border-border-line px-12"/>
    <button disabled={busy} className="h-44 rounded-md border border-brand-deep px-12 text-small font-semibold text-brand-deep">
      {busy?labels['reservations.creating']:labels['reservations.create_group']}
    </button>
    {error?<p role="alert" className="md:col-span-4 text-small text-state-error">{error}</p>:null}
  </form>;
}
