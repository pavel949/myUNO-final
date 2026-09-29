/* eslint-disable local-rules/no-literal-ui-text -- admin commercial workflow */
'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Offer={id:string;offeringType:string;status:string};
type Deal={
  id:string;kind:string;status:string;amountThb:string;depositThb:string;
  startsOn:string|null;endsOn:string|null;contractMediaId:string|null;
  completionMediaId:string|null;settlementReference:string|null;
  handoverAt:string|null;signedAt:string|null;closedAt:string|null;
};
type Props={
  opportunityId:string;unitId:string;opportunityType:string;
  opportunityStage:string;unitName:string;offers:Offer[];initialDeal:Deal|null;
};
const next:Record<string,string[]>={
  draft:['proposed','cancelled'],proposed:['accepted','cancelled'],
  accepted:['signed','cancelled'],signed:['closed'],
  closed:[],cancelled:[],
};
const dateValue=(value:string|null)=>value?.slice(0,10)||'';
function baht(satang:string|number){return Number(satang)/100;}

export default function PropertyDealClient(props:Props){
  const router=useRouter();
  const kind=props.opportunityType==='rental'?'long_term_rental':'sale';
  const [deal,setDeal]=useState(props.initialDeal);
  const [offeringId,setOfferingId]=useState(props.offers.find(o=>o.offeringType===kind)?.id||'');
  const [amount,setAmount]=useState(props.initialDeal?String(baht(props.initialDeal.amountThb)):'');
  const [deposit,setDeposit]=useState(props.initialDeal?String(baht(props.initialDeal.depositThb)):'0');
  const [startsOn,setStartsOn]=useState(dateValue(props.initialDeal?.startsOn||null));
  const [endsOn,setEndsOn]=useState(dateValue(props.initialDeal?.endsOn||null));
  const [contract,setContract]=useState<File|null>(null);
  const [completion,setCompletion]=useState<File|null>(null);
  const [reference,setReference]=useState(props.initialDeal?.settlementReference||'');
  const [handover,setHandover]=useState(dateValue(props.initialDeal?.handoverAt||null));
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const endpoint=`/api/admin/crm/opportunities/${props.opportunityId}/deal`;
  const evidenceEndpoint=`/api/admin/crm/opportunities/${props.opportunityId}/deal/evidence`;
  const transitionEndpoint=`/api/admin/crm/opportunities/${props.opportunityId}/deal/transition`;

  async function request(url:string,method:string,body:unknown):Promise<any>{
    const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Action failed');
    return result;
  }
  async function execute(callback:()=>Promise<void>){
    setBusy(true);setError('');setMessage('');
    try{await callback();setMessage('Saved.');router.refresh();}
    catch(e){setError(e instanceof Error?e.message:'Unable to save agreement');}
    finally{setBusy(false);}
  }
  const draftBody=()=>({
    amountBaht:Number(amount),depositBaht:Number(deposit),
    startsOn:kind==='long_term_rental'?startsOn:null,
    endsOn:kind==='long_term_rental'?endsOn:null,
    termsSnapshot:{
      currency:'THB',amountScope:'total_agreement',
      note:'Terms require a separately signed and encrypted document.',
    },
  });
  async function saveDraft(e:FormEvent){
    e.preventDefault();
    await execute(async()=>{
      const data=deal
        ?await request(endpoint,'PATCH',draftBody())
        :await request(endpoint,'POST',{
          ...draftBody(),kind,unitId:props.unitId,offeringId,
        });
      setDeal(data);
    });
  }
  async function upload(file:File):Promise<string>{
    const form=new FormData();form.set('file',file);
    const result=await fetch(evidenceEndpoint,{method:'POST',body:form});
    const body=await result.json();
    if(!result.ok)throw new Error(body.error||'Secure evidence upload failed');
    return body.mediaAssetId as string;
  }
  async function advance(status:string){
    await execute(async()=>{
      let contractMediaId:string|undefined,completionMediaId:string|undefined;
      if(status==='signed'){
        if(!contract)throw new Error('Select the signed PDF/photo before signing.');
        contractMediaId=await upload(contract);
      }
      if(status==='closed'){
        if(!completion)throw new Error('Select settlement/handover evidence before closing.');
        completionMediaId=await upload(completion);
      }
      const data=await request(transitionEndpoint,'POST',{
        nextStatus:status,contractMediaId,completionMediaId,
        ...(status==='closed'?{settlementReference:reference,handoverAt:handover}:{}),
      });
      setDeal(data);
    });
  }
  const matching=props.offers.filter(o=>o.offeringType===kind);
  const actions=deal?next[deal.status]||[]:[];
  return <div className="space-y-24">
    {error&&<p role="alert" className="rounded-md bg-red-50 p-12 text-red-800">{error}</p>}
    {message&&<p role="status" className="rounded-md bg-green-50 p-12 text-green-800">{message}</p>}
    <section className="rounded-lg border border-border-line bg-surface-paper p-20">
      <p className="text-kicker font-semibold text-brand-andaman">CANONICAL CRM · COMMERCIAL OFFERING · PHYSICAL HOME</p>
      <h2 className="mt-8 font-display text-heading-lg font-semibold">{props.unitName} · {kind==='sale'?'Sale':'Long-term lease'}</h2>
      <p className="mt-8 text-small text-text-secondary">
        Agreement state: <strong>{deal?.status||'not created'}</strong> · CRM: {props.opportunityStage}.
        A completed sale never automatically changes title. A signed lease reserves physical inventory in the same shared calendar as stays.
      </p>
    </section>
    {(!deal||deal.status==='draft')&&<form onSubmit={saveDraft} className="grid gap-12 rounded-lg border border-border-line bg-surface-paper p-20 md:grid-cols-2">
      <h3 className="md:col-span-2 font-semibold">Commercial terms</h3>
      {!deal&&<label className="block text-small">Commercial offering
        <select className="mt-4 block w-full rounded-md border p-8" value={offeringId} onChange={e=>setOfferingId(e.target.value)} required>
          <option value="">Choose matching offering</option>
          {matching.map(offer=><option key={offer.id} value={offer.id}>{offer.offeringType} · {offer.status}</option>)}
        </select>
      </label>}
      <label className="block text-small">Total agreement amount (THB)
        <input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-4 block w-full rounded-md border p-8"/>
      </label>
      <label className="block text-small">Deposit (THB)
        <input required type="number" min="0" step="0.01" value={deposit} onChange={e=>setDeposit(e.target.value)} className="mt-4 block w-full rounded-md border p-8"/>
      </label>
      {kind==='long_term_rental'&&<>
        <label className="block text-small">Lease begins
          <input required type="date" value={startsOn} onChange={e=>setStartsOn(e.target.value)} className="mt-4 block w-full rounded-md border p-8"/>
        </label>
        <label className="block text-small">Lease ends (checkout-exclusive)
          <input required type="date" value={endsOn} onChange={e=>setEndsOn(e.target.value)} className="mt-4 block w-full rounded-md border p-8"/>
        </label>
      </>}
      <p className="md:col-span-2 text-small text-text-secondary">Amounts are displayed in baht; the agreement ledger stores lossless satang. Contract documents are encrypted and never use the public gallery.</p>
      <button disabled={busy||(!deal&&!offeringId)} className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        {deal?'Update draft':'Create draft agreement'}
      </button>
    </form>}
    {deal&&<section className="space-y-12 rounded-lg border border-border-line bg-surface-paper p-20">
      <h3 className="font-semibold">Agreement lifecycle</h3>
      <p className="text-small text-text-secondary">Draft → Proposed → Accepted → Signed → Closed. Signed financial and lease terms are immutable.</p>
      {deal.status==='accepted'&&<label className="block text-small">Signed contract (PDF, JPEG, PNG or WebP; encrypted upload)
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setContract(e.target.files?.[0]||null)} className="mt-8 block w-full"/>
      </label>}
      {deal.status==='signed'&&<>
        <label className="block text-small">Settlement / handover proof
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setCompletion(e.target.files?.[0]||null)} className="mt-8 block w-full"/>
        </label>
        <label className="block text-small">Verified settlement reference
          <input value={reference} onChange={e=>setReference(e.target.value)} className="mt-4 block w-full rounded-md border p-8" required/>
        </label>
        <label className="block text-small">Handover date
          <input type="date" value={handover} onChange={e=>setHandover(e.target.value)} className="mt-4 block w-full rounded-md border p-8"/>
        </label>
      </>}
      {deal.contractMediaId&&<a className="block text-small font-semibold text-brand-andaman underline" href={endpoint+'/evidence?mediaId='+encodeURIComponent(deal.contractMediaId)}>View authenticated signed contract</a>}
      {deal.completionMediaId&&<a className="block text-small font-semibold text-brand-andaman underline" href={endpoint+'/evidence?mediaId='+encodeURIComponent(deal.completionMediaId)}>View authenticated completion evidence</a>}
      <div className="flex flex-wrap gap-8">{actions.map(status=><button key={status} disabled={busy}
        onClick={()=>advance(status)} className="rounded-md border border-border-line px-16 py-12 text-small font-semibold disabled:opacity-50">
        {status==='cancelled'?'Cancel unsigned agreement':'Mark '+status}
      </button>)}</div>
      {deal.status==='closed'&&<p className="text-small text-text-secondary">Commercial close is recorded in canonical CRM. Record legal title transfer through the separate verified ownership workflow; no payment or transfer is inferred.</p>}
    </section>}
  </div>;
}
