/* eslint-disable local-rules/no-literal-ui-text -- authenticated operations editor, labels to content seed before release */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface StructureRow {
  id: string; projectId: string; parentId: string | null;
  code: string; name: string; kind: string; floorNumber: number | null;
  sortOrder: number; _count: { units: number; children: number };
}
const kinds = ['phase','cluster','building','tower','wing','floor','block','zone','standalone'];
type Props = { projectId: string; initialNodes: StructureRow[]; initialUnit?: {
  id: string; name: string; structureNodeId: string | null; floor: string | null;
} };

export default function StructureEditor({projectId,initialNodes,initialUnit}:Props) {
  const router=useRouter();
  const [nodes,setNodes]=useState(initialNodes);
  const [kind,setKind]=useState('building');
  const [parentId,setParentId]=useState('');
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [floorNumber,setFloorNumber]=useState('');
  const [nodeId,setNodeId]=useState(initialUnit?.structureNodeId||'');
  const [floor,setFloor]=useState(initialUnit?.floor||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const endpoint='/api/admin/projects/'+encodeURIComponent(projectId)+'/structure';
  const refresh=async()=>{
    const result=await fetch(endpoint,{cache:'no-store'});
    if(!result.ok)throw new Error('Unable to load physical structure');
    const body=await result.json() as {nodes:StructureRow[]};
    setNodes(body.nodes);
    router.refresh();
  };
  const send=async(url:string,method:string,body?:unknown)=>{
    setBusy(true);setError('');setSuccess('');
    try{
      const result=await fetch(url,{method,headers:{'Content-Type':'application/json'},
        ...(body!==undefined?{body:JSON.stringify(body)}:{})});
      const payload=await result.json();
      if(!result.ok)throw new Error(payload.error||'Save failed');
      await refresh();setSuccess('Saved.');
      return true;
    }catch(e){setError(e instanceof Error?e.message:'Save failed');return false;}
    finally{setBusy(false);}
  };
  const create=async(e:React.FormEvent)=>{
    e.preventDefault();
    const ok=await send(endpoint,'POST',{
      kind,code,name,parentId:parentId||null,
      floorNumber:kind==='floor'&&floorNumber!==''?Number(floorNumber):null,
    });
    if(ok){setCode('');setName('');setFloorNumber('');}
  };
  const attach=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!initialUnit)return;
    const ok=await send('/api/admin/units/'+encodeURIComponent(initialUnit.id),'PUT',{
      structureNodeId:nodeId||null, floor:floor.trim()||null,
    });
    if(ok)router.refresh();
  };
  return <section className="space-y-24">
    <p className="text-body text-text-secondary">
      Physical locations are separate from sellable room or villa categories.
      Existing free-text floors are preserved until mapped to verified nodes.
    </p>
    {error&&<p role="alert" className="rounded-md bg-red-50 p-12 text-red-800">{error}</p>}
    {success&&<p role="status" className="rounded-md bg-green-50 p-12 text-green-800">{success}</p>}
    <form onSubmit={create} className="grid gap-12 rounded-lg border border-border-line bg-surface-paper p-20 md:grid-cols-2">
      <h2 className="md:col-span-2 text-subtitle font-semibold">Add building, wing or floor</h2>
      <label className="text-small">Kind
        <select value={kind} onChange={e=>setKind(e.target.value)} className="mt-4 block w-full rounded-md border p-8">
          {kinds.map(item=><option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="text-small">Parent location
        <select value={parentId} onChange={e=>setParentId(e.target.value)} className="mt-4 block w-full rounded-md border p-8">
          <option value="">Project root</option>
          {nodes.map(item=><option key={item.id} value={item.id}>{item.kind} · {item.name}</option>)}
        </select>
      </label>
      <label className="text-small">Unique code
        <input required pattern="[a-z0-9][a-z0-9_-]{0,79}" value={code}
          onChange={e=>setCode(e.target.value)} placeholder="building_a" className="mt-4 block w-full rounded-md border p-8"/>
      </label>
      <label className="text-small">Name
        <input required value={name} onChange={e=>setName(e.target.value)}
          placeholder="Building A" className="mt-4 block w-full rounded-md border p-8"/>
      </label>
      {kind==='floor'&&<label className="text-small">Floor number
        <input type="number" value={floorNumber} onChange={e=>setFloorNumber(e.target.value)}
          className="mt-4 block w-full rounded-md border p-8"/>
      </label>}
      <button disabled={busy} className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        Create location
      </button>
    </form>
    <div className="rounded-lg border border-border-line bg-surface-paper p-20">
      <h2 className="mb-12 text-subtitle font-semibold">Verified physical hierarchy</h2>
      {!nodes.length?<p className="text-small text-text-secondary">No physical structures added yet.</p>:
        <ul className="space-y-8">{nodes.map(node=><li key={node.id} className="flex flex-wrap items-center gap-12 rounded-md bg-surface-ivory p-12">
          <div className="flex-1">
            <p className="font-semibold">{node.name} <span className="text-small font-normal text-text-secondary">({node.kind} · {node.code})</span></p>
            <p className="text-small text-text-secondary">{node.parentId?'Parent: '+(nodes.find(p=>p.id===node.parentId)?.name||'unknown'):'Project root'} · {node._count.units} units · {node._count.children} children</p>
          </div>
          <button type="button" disabled={busy||node._count.units>0||node._count.children>0}
            onClick={()=>send(endpoint+'/'+encodeURIComponent(node.id),'DELETE')}
            className="rounded-md border border-border-line px-12 py-8 text-small disabled:opacity-30">
            Delete empty node
          </button>
        </li>)}</ul>}
    </div>
    {initialUnit&&<form onSubmit={attach} className="space-y-12 rounded-lg border border-border-line bg-surface-paper p-20">
      <h2 className="text-subtitle font-semibold">Assign {initialUnit.name} to a physical location</h2>
      <label className="block text-small">Verified building / floor
        <select value={nodeId} onChange={e=>setNodeId(e.target.value)} className="mt-4 block w-full rounded-md border p-8">
          <option value="">Not assigned</option>
          {nodes.map(node=><option key={node.id} value={node.id}>{node.kind} · {node.name}</option>)}
        </select>
      </label>
      <label className="block text-small">Legacy floor label (preserved independently)
        <input value={floor} onChange={e=>setFloor(e.target.value)} className="mt-4 block w-full rounded-md border p-8"/>
      </label>
      <button disabled={busy} className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        Save unit location
      </button>
    </form>}
  </section>;
}
