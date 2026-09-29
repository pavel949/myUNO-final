import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import StructureEditor from '@/components/property/StructureEditor';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function ProjectStructurePage({params}:{params:{id:string}}){
  const project=await prisma.project.findUnique({
    where:{id:params.id},
    select:{id:true,name:true,structureNodes:{
      include:{_count:{select:{units:true,children:true}}},
      orderBy:[{sortOrder:'asc'},{name:'asc'}],
    }},
  });
  if(!project)notFound();
  const translated = await getLabels({
    'property.structure.back':'{labels.back}',
    'property.structure.title':'Physical hierarchy',
    'property.structure.description':'{labels.description}',
  });
  const labels = {back:translated['property.structure.back'],title:translated['property.structure.title'],description:translated['property.structure.description']};
  return <main className="mx-auto max-w-5xl space-y-24 px-16 py-32">
    <Link href={'/app/admin/properties/'+project.id+'/onboarding'} className="text-small font-semibold text-brand-andaman">← Property onboarding</Link>
    <header><h1 className="font-display text-heading-1 font-semibold text-text-ink">{project.name} · {labels.title}</h1>
      <p className="text-body text-text-secondary">Build the real phase / building / wing / floor tree. Rates and room types remain independent.</p>
    </header>
    <StructureEditor projectId={project.id} initialNodes={project.structureNodes}/>
  </main>;
}
