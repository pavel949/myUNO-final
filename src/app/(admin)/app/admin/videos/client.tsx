'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

const VIDEO_ACCEPT = 'video/mp4,video/webm';

type Video = { id:string; slug:string; locale:string; title:string; description:string|null; provenance:string|null; status:string; mediaUrl:string; mimeType:string };

async function post(payload: Record<string,unknown>) {
  const response = await fetch('/api/admin/videos', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Action failed');
  return data;
}

export default function VideoAdminClient({ videos, labels }: { videos:Video[]; labels:Record<string,string> }) {
  const router=useRouter();
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  const run=async(payload:Record<string,unknown>)=>{setBusy(true);setError(null);try{await post(payload);router.refresh();}catch(e){setError(e instanceof Error?e.message:labels['admin.video.error']);}finally{setBusy(false);}};

  const create=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const file=form.get('file');
    if(!(file instanceof File)||file.size===0){setError(labels['admin.video.upload']);return;}
    setBusy(true);setError(null);
    try{
      const upload=new FormData();upload.set('file',file);upload.set('kind','video');
      const response=await fetch('/api/media/upload',{method:'POST',body:upload});
      const uploaded=await response.json().catch(()=>null);
      if(!response.ok) throw new Error(uploaded?.error||labels['admin.video.error']);
      await post({
        action:'create',mediaAssetId:uploaded.mediaAssetId,slug:form.get('slug'),locale:form.get('locale'),
        title:form.get('title'),description:form.get('description'),provenance:form.get('provenance'),
        recordedOn:form.get('recordedOn')||null,scopeType:form.get('scopeType')||null,scopeId:form.get('scopeId')||null,
      });
      event.currentTarget.reset();router.refresh();
    }catch(e){setError(e instanceof Error?e.message:labels['admin.video.error']);}
    finally{setBusy(false);}
  };

  return <main className="max-w-5xl">
    <p className="text-kicker font-semibold uppercase tracking-[0.18em] text-brand-andaman">{labels['admin.video.kicker']}</p>
    <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['admin.video.title']}</h1>
    <p className="mt-12 max-w-3xl text-body text-text-secondary">{labels['admin.video.body']}</p>
    {error?<p role="alert" className="mt-16 rounded-lg bg-state-error-soft p-12 text-state-error">{error}</p>:null}

    <form onSubmit={create} className="mt-32 grid gap-12 rounded-2xl border border-border-line bg-surface-paper p-24 md:grid-cols-2">
      <input name="slug" required placeholder={labels['admin.video.slug']} className="rounded-lg border border-border-line p-12"/>
      <select name="locale" className="rounded-lg border border-border-line p-12"><option value="en">{labels['nav.locale.en']}</option><option value="ru">{labels['nav.locale.ru']}</option><option value="th">{labels['nav.locale.th']}</option><option value="zh">{labels['nav.locale.zh']}</option></select>
      <input name="title" required placeholder={labels['admin.video.video_title']} className="rounded-lg border border-border-line p-12 md:col-span-2"/>
      <textarea name="description" placeholder={labels['admin.video.description']} className="rounded-lg border border-border-line p-12 md:col-span-2"/>
      <input name="provenance" required placeholder={labels['admin.video.provenance']} className="rounded-lg border border-border-line p-12 md:col-span-2"/>
      <label className="text-small text-text-secondary">{labels['admin.video.recorded_on']}<input name="recordedOn" type="date" className="mt-8 block w-full rounded-lg border border-border-line p-12"/></label>
      <input name="file" required type="file" accept={VIDEO_ACCEPT} className="rounded-lg border border-border-line p-12"/>
      <select name="scopeType" className="rounded-lg border border-border-line p-12"><option value="">{labels['admin.video.scope_none']}</option><option value="area">{labels['admin.video.scope_area']}</option><option value="project">{labels['admin.video.scope_project']}</option><option value="unit">{labels['admin.video.scope_unit']}</option></select>
      <input name="scopeId" placeholder={labels['admin.video.scope_id']} className="rounded-lg border border-border-line p-12"/>
      <Button type="submit" disabled={busy}>{labels['admin.video.create']}</Button>
    </form>

    <div className="mt-32 grid gap-20 md:grid-cols-2">
      {videos.length===0?<p className="text-text-secondary">{labels['admin.video.empty']}</p>:videos.map(video=><article key={video.id} className="overflow-hidden rounded-2xl border border-border-line bg-surface-paper">
        <video controls className="aspect-video w-full bg-black"><source src={video.mediaUrl} type={video.mimeType}/></video>
        <div className="p-20"><div className="flex items-start justify-between gap-12"><h2 className="font-display text-title font-semibold text-text-ink">{video.title}</h2><span className="text-small">{labels['admin.video.status']}: {video.status}</span></div>
        {video.description?<p className="mt-8 text-small text-text-secondary">{video.description}</p>:null}
        <p className="mt-8 text-small text-text-secondary">{video.provenance}</p>
        <div className="mt-16 flex gap-8">{video.status==='draft'?<Button size="sm" disabled={busy} onClick={()=>run({action:'publish',videoId:video.id})}>{labels['admin.video.publish']}</Button>:null}{video.status==='published'?<Button size="sm" variant="secondary" disabled={busy} onClick={()=>run({action:'archive',videoId:video.id})}>{labels['admin.video.archive']}</Button>:null}</div>
        </div>
      </article>)}
    </div>
  </main>;
}
