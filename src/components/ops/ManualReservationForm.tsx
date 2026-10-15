'use client';

import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
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
  const [addedGuests,setAddedGuests]=useState<Guest[]>([]);
  const [selectedUnit,setSelectedUnit]=useState('');
  const [selectedGuest,setSelectedGuest]=useState('');
  const [addingGuest,setAddingGuest]=useState(false);
  const [guestBusy,setGuestBusy]=useState(false);
  const [guestError,setGuestError]=useState('');
  const [guestSaved,setGuestSaved]=useState(false);
  const [createdBooking,setCreatedBooking]=useState('');
  const savingGuest=useRef(false);
  const allGuests=Array.from(new Map([...guests,...addedGuests].map(guest=>[guest.id,guest])).values());
  const guestLabel=(key:string)=>labels['reservations.guest_entry.'+key] || key;

  async function saveGuest(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(savingGuest.current)return;
    savingGuest.current=true;setGuestBusy(true);setGuestError('');
    const form=event.currentTarget;
    const data=new FormData(form);
    try {
      const response=await fetch('/api/ops/reservation-guests',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({operatingSpaceId,unitId:selectedUnit,firstName:data.get('firstName'),lastName:data.get('lastName'),
          email:data.get('email'),phone:data.get('phone')}),
      });
      const body=await response.json();
      if(!response.ok){setGuestError(body?.error||guestLabel('failed'));return;}
      if(!body?.guest?.id)throw new Error('Missing saved guest');
      setAddedGuests(previous=>[...previous.filter(g=>g.id!==body.guest.id),body.guest]);
      setSelectedGuest(body.guest.id);setGuestSaved(true);setAddingGuest(false);
    }catch{setGuestError(guestLabel('failed'));}
    finally{savingGuest.current=false;setGuestBusy(false);}
  }

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');setCreatedBooking('');
    // React clears currentTarget after the event handler yields.
    const form=event.currentTarget;
    const data=new FormData(form);
    try {
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
    if(!response.ok){setError(body?.error||labels['reservations.create_failed']);return;}
    if(!body?.booking?.id)throw new Error('Missing saved reservation');
    form.reset();setSelectedUnit('');setSelectedGuest('');setCreatedBooking(body.booking.id);
    router.refresh();
    } catch {
      setError(labels['reservations.create_failed']);
    } finally {
      setBusy(false);
    }
  }

  return <><form onSubmit={submit} className="space-y-12 stitch-panel p-16">
    <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['reservations.create']}</h2>
    <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.unit']}
        <select required name="unitId" value={selectedUnit} disabled={busy||guestBusy} onChange={event=>setSelectedUnit(event.target.value)} className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-12">
          <option value="">{labels['reservations.select']}</option>
          {units.map(unit=><option key={unit.id} value={unit.id}>{unit.project.name} · {unit.name}</option>)}
        </select>
      </label>
      <label className="text-small font-semibold text-text-secondary">{labels['reservations.guest']}
        <select required name="guestIdentityId" value={selectedGuest} onChange={event=>setSelectedGuest(event.target.value)} className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-12">
          <option value="">{labels['reservations.select']}</option>
          {allGuests.map(guest=><option key={guest.id} value={guest.id}>{guest.firstName} {guest.lastName}{guest.email?' · '+guest.email:''}</option>)}
        </select>
        <button type="button" disabled={busy||guestBusy||!selectedUnit} onClick={()=>{setAddingGuest(true);setGuestError('');setGuestSaved(false);}}
          className="mt-8 text-small font-semibold text-brand-andaman underline">{guestLabel('add')}</button>
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
    {guestSaved?<p role="status" className="text-small text-brand-andaman">{guestLabel('saved')}</p>:null}
    <textarea name="guestNote" placeholder={labels['reservations.note']} className="min-h-20 w-full rounded-md border border-border-line p-12"/>
    <div className="flex items-center gap-12">
      <button disabled={busy||guestBusy} className="rounded-lg bg-brand-deep px-16 py-8 text-small font-semibold text-white transition hover:bg-brand-andaman">
        {busy?labels['reservations.creating']:labels['reservations.create_action']}
      </button>
      {error?<span role="alert" className="text-small text-state-error">{error}</span>:null}
    </div>
    {createdBooking?<div role="status" className="space-y-8">
      <p>{guestLabel('created')}</p>
      <Link href={'/ops/stays/'+encodeURIComponent(createdBooking)} className="font-semibold text-brand-andaman underline">{guestLabel('open')}</Link>
    </div>:null}
  </form>
  {addingGuest?<form onSubmit={saveGuest} className="stitch-panel space-y-12 p-16" aria-label={guestLabel('add')}>
    <h2 className="font-display text-heading-2 font-semibold">{guestLabel('add')}</h2>
    <p className="text-small text-text-secondary">{guestLabel('note')}</p>
    <fieldset disabled={guestBusy} className="grid gap-12 md:grid-cols-2">
      <label>{guestLabel('first')}<input required name="firstName" maxLength={100} autoComplete="given-name" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label>{guestLabel('last')}<input required name="lastName" maxLength={100} autoComplete="family-name" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label>{guestLabel('email')}<input name="email" type="email" maxLength={254} autoComplete="email" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label>{guestLabel('phone')}<input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="+66…" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
    </fieldset>
    <div className="flex flex-wrap gap-12">
      <button disabled={guestBusy} className="rounded-lg bg-brand-deep px-16 py-8 text-white">{guestLabel(guestBusy?'saving':'save')}</button>
      <button type="button" disabled={guestBusy} onClick={()=>setAddingGuest(false)} className="rounded-lg border border-border-line px-16 py-8">{guestLabel('cancel')}</button>
    </div>
    {guestError?<p role="alert" className="text-small text-state-error">{guestError}</p>:null}
  </form>:null}</>;
}

