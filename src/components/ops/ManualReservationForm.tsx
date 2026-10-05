'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Unit={id:string;name:string;project:{name:string};instantBook:boolean};
type Guest={id:string;firstName:string;lastName:string;email:string|null;phone:string|null};
type Group={id:string;title:string|null;guestIdentityId:string};

export default function ManualReservationForm({
  operatingSpaceId,units,guests,groups,labels,
}:{
  operatingSpaceId:string;
  units:Unit[];
  guests:Guest[];
  groups:Group[];
  labels:Record<string,string>;
}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);setError('');
    const data=new FormData(event.currentTarget);
    const response=await fetch('/api/ops/reservations',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        operatingSpaceId,
        unitId:String(data.get('unitId')||''),
        guestIdentityId:String(data.get('guestIdentityId')||''),
        reservationGroupId:String(data.get('reservationGroupId')||'')||undefined,
        startDate:String(data.get('startDate')||''),
        endDate:String(data.get('endDate')||''),
        adults:Number(data.get('adults')||1),
        children:Number(data.get('children')||0),
        infants:Number(data.get('infants')||0),
        pets:Number(data.get('pets')||0),
        guestNote:String(data.get('guestNote')||''),
      }),
    });
    const body=await response.json();
    if(!response.ok){setError(body.error||labels['reservations.create_failed']);setBusy(false);return;}
    event.currentTarget.reset();
    setBusy(false);
    router.refresh();
  }

  return <form onSubmit={submit} className="space-y-12 rounded-md border border-border-line bg-surface-paper p-16">
    <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['reservations.create']}</h2>
    <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.unit']}
        <select required name="unitId" className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-12">
          <option value="">{labels['reservations.select']}</option>
          {units.map(unit=><option key={unit.id} value={unit.id}>{unit.project.name} · {unit.name}</option>)}
        </select>
      </label>
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.guest']}
        <select required name="guestIdentityId" className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-12">
          <option value="">{labels['reservations.select']}</option>
          {guests.map(guest=><option key={guest.id} value={guest.id}>{guest.firstName} {guest.lastName}{guest.email?' · '+guest.email:''}</option>)}
        </select>
      </label>
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.group']}
        <select name="reservationGroupId" className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-12">
          <option value="">{labels['reservations.no_group']}</option>
          {groups.map(group=><option key={group.id} value={group.id}>{group.title||group.id.slice(0,8)}</option>)}
        </select>
      </label>
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.adults']}
        <input name="adults" type="number" min="1" defaultValue="2" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/>
      </label>
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.start']}
        <input required name="startDate" type="date" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/>
      </label>
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.end']}
        <input required name="endDate" type="date" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/>
      </label>
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.children']}
        <input name="children" type="number" min="0" defaultValue="0" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/>
      </label>
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.pets']}
        <input name="pets" type="number" min="0" defaultValue="0" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/>
      </label>
    </div>
    <textarea name="guestNote" placeholder={labels['reservations.note']} className="min-h-20 w-full rounded-md border border-border-line p-12"/>
    <div className="flex items-center gap-12">
      <button disabled={busy} className="rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">
        {busy?labels['reservations.creating']:labels['reservations.create_action']}
      </button>
      {error?<span role="alert" className="text-small text-red-700">{error}</span>:null}
    </div>
  </form>;
}
