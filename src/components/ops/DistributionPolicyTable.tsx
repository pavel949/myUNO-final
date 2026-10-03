'use client';

import { useMemo, useState } from 'react';

type PolicyDraft={
  inventorySource:string;
  availabilityMode:string;
  bookingMode:string;
  agentDistributionEnabled:boolean;
  directDistributionEnabled:boolean;
  otaDistributionEnabled:boolean;
  allowAgentMarkup:boolean;
  maxAgentMarkupPct:number|null;
  defaultAgentCommissionPct:number;
  confirmationSlaMinutes:number|null;
  staleAfterMinutes:number|null;
  supplyOrganizationId:string|null;
};

type Row={
  id:string;
  offeringType:string;
  propertyName:string;
  unitId:string|null;
  policy:PolicyDraft|null;
  channelHealth:Array<{channel:string;syncState:string;lastSyncAt:string|null;hasErrors:boolean}>;
};

type Supplier={id:string;name:string;orgType:string};

const DEFAULT_POLICY:PolicyDraft={
  inventorySource:'managed',
  availabilityMode:'live',
  bookingMode:'request',
  agentDistributionEnabled:true,
  directDistributionEnabled:true,
  otaDistributionEnabled:false,
  allowAgentMarkup:true,
  maxAgentMarkupPct:null,
  defaultAgentCommissionPct:10,
  confirmationSlaMinutes:null,
  staleAfterMinutes:120,
  supplyOrganizationId:null,
};

export default function DistributionPolicyTable({
  operatingSpaceId,rows,suppliers,labels,canManage,
}:{
  operatingSpaceId:string;
  rows:Row[];
  suppliers:Supplier[];
  labels:Record<string,string>;
  canManage:boolean;
}){
  const initial=useMemo(()=>Object.fromEntries(rows.map(row=>[
    row.id,{...DEFAULT_POLICY,...(row.policy||{})},
  ])),[rows]);
  const [drafts,setDrafts]=useState<Record<string,PolicyDraft>>(initial);
  const [busy,setBusy]=useState<string|null>(null);
  const [status,setStatus]=useState<Record<string,string>>({});

  function patch(id:string,delta:Partial<PolicyDraft>){
    setDrafts(current=>({...current,[id]:{...current[id],...delta}}));
    setStatus(current=>({...current,[id]:''}));
  }

  async function save(id:string){
    const policy=drafts[id];
    if(!policy)return;
    setBusy(id);
    setStatus(current=>({...current,[id]:''}));
    try{
      const response=await fetch('/api/ops/distribution/'+encodeURIComponent(id),{
        method:'PUT',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          operatingSpaceId,
          ...policy,
        }),
      });
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Save failed');
      setStatus(current=>({...current,[id]:labels['distribution.saved']||'Saved'}));
    }catch(error){
      setStatus(current=>({...current,[id]:error instanceof Error?error.message:'Save failed'}));
    }finally{
      setBusy(null);
    }
  }

  return <section className="space-y-12">
    {rows.map(row=>{
      const p=drafts[row.id]||DEFAULT_POLICY;
      const hasChannelError=row.channelHealth.some(channel=>channel.hasErrors);
      return <article key={row.id} className="rounded-xl border border-border-line bg-surface-paper p-16">
        <div className="flex flex-wrap items-start justify-between gap-12">
          <div>
            <p className="text-small font-semibold text-brand-andaman">{row.propertyName}</p>
            <h2 className="mt-4 font-display text-heading-3 font-semibold text-text-ink">{row.offeringType.replace(/_/g,' ')}</h2>
          </div>
          <div className="flex flex-wrap gap-6">
            {row.channelHealth.length===0
              ? <span className="rounded-full bg-surface-ivory px-10 py-4 text-small text-text-secondary">No channel mapping</span>
              : row.channelHealth.map(channel=><span key={channel.channel}
                  title={channel.lastSyncAt||undefined}
                  className={'rounded-full px-10 py-4 text-small font-semibold '+(channel.hasErrors?'bg-red-50 text-red-700':'bg-surface-ivory text-text-secondary')}>
                  {channel.channel} · {channel.hasErrors?(labels['distribution.channel_error']||'Attention'):(labels['distribution.channel_ok']||'Healthy')}
                </span>)}
            {hasChannelError?<span className="sr-only">Channel attention required</span>:null}
          </div>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-small font-semibold text-text-secondary">{labels['distribution.source']}
            <select disabled={!canManage} value={p.inventorySource}
              onChange={e=>patch(row.id,{inventorySource:e.target.value,supplyOrganizationId:e.target.value==='managed'?null:p.supplyOrganizationId})}
              className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-10 text-text-ink">
              <option value="managed">managed</option><option value="partner">partner</option>
            </select>
          </label>

          <label className="text-small font-semibold text-text-secondary">{labels['distribution.availability']}
            <select disabled={!canManage} value={p.availabilityMode}
              onChange={e=>patch(row.id,{availabilityMode:e.target.value,bookingMode:e.target.value==='request'&&p.bookingMode==='instant'?'request':p.bookingMode})}
              className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-10 text-text-ink">
              <option value="live">LIVE</option><option value="synced">SYNCED</option><option value="request">REQUEST</option>
            </select>
          </label>

          <label className="text-small font-semibold text-text-secondary">{labels['distribution.booking']}
            <select disabled={!canManage} value={p.bookingMode}
              onChange={e=>patch(row.id,{bookingMode:e.target.value})}
              className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-10 text-text-ink">
              <option value="instant">instant</option>
              <option value="request">request</option>
              <option value="operator_approval">operator approval</option>
              <option value="partner_approval">partner approval</option>
              <option value="not_agent_bookable">not agent bookable</option>
            </select>
          </label>

          <label className="text-small font-semibold text-text-secondary">{labels['distribution.partner_org']}
            <select disabled={!canManage||p.inventorySource!=='partner'} value={p.supplyOrganizationId||''}
              onChange={e=>patch(row.id,{supplyOrganizationId:e.target.value||null})}
              className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-10 text-text-ink">
              <option value="">{labels['distribution.none']}</option>
              {suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>

          <label className="text-small font-semibold text-text-secondary">{labels['distribution.commission']}
            <input disabled={!canManage} type="number" min="0" step="0.1" value={p.defaultAgentCommissionPct}
              onChange={e=>patch(row.id,{defaultAgentCommissionPct:Number(e.target.value)})}
              className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-10 text-text-ink"/>
          </label>

          <label className="text-small font-semibold text-text-secondary">{labels['distribution.max_markup']}
            <input disabled={!canManage||!p.allowAgentMarkup} type="number" min="0" step="0.1" value={p.maxAgentMarkupPct??''}
              onChange={e=>patch(row.id,{maxAgentMarkupPct:e.target.value===''?null:Number(e.target.value)})}
              className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-10 text-text-ink"/>
          </label>

          <label className="text-small font-semibold text-text-secondary">{labels['distribution.sla']}
            <input disabled={!canManage} type="number" min="1" value={p.confirmationSlaMinutes??''}
              onChange={e=>patch(row.id,{confirmationSlaMinutes:e.target.value===''?null:Number(e.target.value)})}
              className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-10 text-text-ink"/>
          </label>

          <label className="text-small font-semibold text-text-secondary">{labels['distribution.stale']}
            <input disabled={!canManage} type="number" min="1" value={p.staleAfterMinutes??''}
              onChange={e=>patch(row.id,{staleAfterMinutes:e.target.value===''?null:Number(e.target.value)})}
              className="mt-4 h-44 w-full rounded-md border border-border-line bg-white px-10 text-text-ink"/>
          </label>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-16">
          <label className="inline-flex items-center gap-6 text-small font-semibold text-text-secondary">
            <input disabled={!canManage} type="checkbox" checked={p.agentDistributionEnabled}
              onChange={e=>patch(row.id,{agentDistributionEnabled:e.target.checked})}/>
            {labels['distribution.agent']}
          </label>
          <label className="inline-flex items-center gap-6 text-small font-semibold text-text-secondary">
            <input disabled={!canManage} type="checkbox" checked={p.otaDistributionEnabled}
              onChange={e=>patch(row.id,{otaDistributionEnabled:e.target.checked})}/>
            {labels['distribution.ota']}
          </label>
          <label className="inline-flex items-center gap-6 text-small font-semibold text-text-secondary">
            <input disabled={!canManage} type="checkbox" checked={p.allowAgentMarkup}
              onChange={e=>patch(row.id,{allowAgentMarkup:e.target.checked,maxAgentMarkupPct:e.target.checked?p.maxAgentMarkupPct:null})}/>
            {labels['distribution.markup']}
          </label>
          {canManage?<button type="button" disabled={busy===row.id} onClick={()=>save(row.id)}
            className="rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">
            {busy===row.id?labels['distribution.saving']:labels['distribution.save']}
          </button>:null}
          {status[row.id]?<span className="text-small text-text-secondary">{status[row.id]}</span>:null}
        </div>
      </article>;
    })}
  </section>;
}
