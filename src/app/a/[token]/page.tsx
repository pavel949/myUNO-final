import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic='force-dynamic';

export default async function AgentSharedPage({params}:{params:{token:string}}){
  const link=await prisma.agentSharedLink.findUnique({
    where:{token:params.token},
    include:{
      shortlist:{
        include:{
          items:{
            include:{
              unit:{
                select:{
                  id:true,name:true,bedrooms:true,bathrooms:true,sizeSqm:true,
                  project:{select:{name:true,city:true,district:true}}
                }
              }
            },
            orderBy:{sortOrder:'asc'}
          }
        }
      },
      quote:{
        include:{
          items:{
            include:{
              unit:{
                select:{
                  id:true,name:true,bedrooms:true,bathrooms:true,sizeSqm:true,
                  project:{select:{name:true,city:true,district:true}}
                }
              }
            }
          }
        }
      }
    }
  });
  if(!link)notFound();
  if(link.expiresAt&&link.expiresAt<=new Date())notFound();

  const title=link.shortlist?.title ?? 'Property quote';
  const quote=link.quote;
  const items=link.shortlist?.items ?? quote?.items.map(item=>({id:item.id,unit:item.unit,sortOrder:0,note:null})) ?? [];

  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-5xl space-y-24">
      <header className="rounded-xl border border-border-line bg-surface-paper p-20">
        <p className="text-kicker font-bold tracking-widest text-brand-andaman">{link.brandMode==='neutral'?'PROPERTY SELECTION':'myUNO'}</p>
        <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{title}</h1>
        {quote?<div className="mt-16 grid gap-10 md:grid-cols-3">
          <div><p className="text-small text-text-secondary">Client total</p><p className="font-display text-heading-2 font-bold">฿{Math.round(quote.clientTotalSatang/100).toLocaleString()}</p></div>
          <div><p className="text-small text-text-secondary">Availability</p><p className="font-semibold">{quote.availabilityState}</p></div>
          <div><p className="text-small text-text-secondary">Valid until</p><p className="font-semibold">{quote.validUntil?quote.validUntil.toISOString().slice(0,16).replace('T',' '):'—'}</p></div>
        </div>:null}
      </header>

      <section className="grid gap-12 md:grid-cols-2">
        {items.map(item=><article key={item.id} className="rounded-xl border border-border-line bg-surface-paper p-18">
          <p className="text-small font-semibold text-brand-andaman">{item.unit.project.name}</p>
          <h2 className="mt-4 font-display text-heading-3 font-semibold text-text-ink">{item.unit.name}</h2>
          <p className="mt-6 text-small text-text-secondary">{item.unit.bedrooms} BR · {item.unit.bathrooms} BA{item.unit.sizeSqm?' · '+item.unit.sizeSqm+' sqm':''}</p>
          <a href={'/units/'+encodeURIComponent(item.unit.id)} className="mt-14 inline-flex rounded-md bg-brand-deep px-14 py-8 text-small font-semibold text-white">View property</a>
        </article>)}
      </section>
    </div>
  </main>;
}
