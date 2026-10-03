'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Guest={id:string;firstName:string;lastName:string;email:string|null};

export default function ReservationGroupForm({
  operatingSpaceId,guests,labels,
}:{operatingSpaceId:string;guests:Guest[];labels:Record<string,string>}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    const data=new FormData(event.currentTarget);
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
    if(!response.ok){setError(body.error||labels['reservations.group_failed']);setBusy(false);return;}
    event.currentTarget.reset();setBusy(false);router.refresh();
  }
  return <form onSubmit={submit} className="grid gap-10 rounded-xl border border-border-line bg-surface-paper p-16 md:grid-cols-4">
    <input required name="title" placeholder={labels['reservations.group_title']} className="h-44 rounded-md border border-border-line px-10"/>
    <select required name="guestIdentityId" className="h-44 rounded-md border border-border-line bg-white px-10">
      <option value="">{labels['reservations.guest']}</option>
      {guests.map(guest=><option key={guest.id} value={guest.id}>{guest.firstName} {guest.lastName}{guest.email?' · '+guest.email:''}</option>)}
    </select>
    <input name="notes" placeholder={labels['reservations.note']} className="h-44 rounded-md border border-border-line px-10"/>
    <button disabled={busy} className="h-44 rounded-md border border-brand-deep px-12 text-small font-semibold text-brand-deep">
      {busy?labels['reservations.creating']:labels['reservations.create_group']}
    </button>
    {error?<p role="alert" className="md:col-span-4 text-small text-red-700">{error}</p>:null}
  </form>;
}
