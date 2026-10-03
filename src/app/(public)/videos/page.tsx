import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { getDestination } from '@/modules/destinations';
import { listPublishedVideos } from '@/modules/media';

export const dynamic='force-dynamic';

export default async function VideosPage(){
  const destination=getDestination();
  const locale=getRequestLocale();
  let videos=await listPublishedVideos(prisma,destination.key,locale);
  if(!videos.length&&locale!=='en') videos=await listPublishedVideos(prisma,destination.key,'en');
  const labels=await getLabels({
    'videos.kicker':'MYUNO VIDEO',
    'videos.title':'See the place, not just the listing.',
    'videos.body':'Published videos carry their source and recorded date. They do not replace canonical property facts.',
    'videos.provenance':'Source',
    'videos.recorded':'Recorded',
    'videos.empty':'No public videos have been published yet.',
  });
  return <main className="min-h-screen bg-surface-ivory">
    <section className="border-b border-border-line bg-surface-paper px-20 py-56 md:px-32 md:py-80"><div className="mx-auto max-w-7xl"><p className="text-kicker font-semibold uppercase tracking-[0.18em] text-brand-andaman">{labels['videos.kicker']}</p><h1 className="mt-12 max-w-4xl font-display text-display-xl font-semibold text-text-ink">{labels['videos.title']}</h1><p className="mt-16 max-w-3xl text-body text-text-secondary">{labels['videos.body']}</p></div></section>
    <section className="mx-auto max-w-7xl px-20 py-56 md:px-32 md:py-80">
      {videos.length?<div className="grid gap-20 md:grid-cols-2">{videos.map(video=><article key={video.id} className="overflow-hidden rounded-2xl border border-border-line bg-surface-paper"><video controls className="aspect-video w-full bg-black"><source src={video.mediaAsset.storageKey} type={video.mediaAsset.mimeType}/></video><div className="p-20"><h2 className="font-display text-title font-semibold text-text-ink">{video.title}</h2>{video.description?<p className="mt-8 text-body text-text-secondary">{video.description}</p>:null}<div className="mt-16 flex flex-wrap gap-12 text-small text-text-secondary"><span>{labels['videos.provenance']}: {video.provenance}</span>{video.recordedOn?<span>{labels['videos.recorded']}: {video.recordedOn.toLocaleDateString(locale)}</span>:null}</div></div></article>)}</div>:<p className="rounded-2xl border border-border-line bg-surface-paper p-24 text-text-secondary">{labels['videos.empty']}</p>}
    </section>
  </main>;
}
