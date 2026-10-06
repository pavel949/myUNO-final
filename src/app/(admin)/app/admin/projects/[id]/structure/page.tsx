import Link from 'next/link';
import { PageHeading, Panel } from '@/components/premium/StitchPage';
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
    'property.structure.back':'← Property onboarding',
    'property.structure.title':'Physical hierarchy',
    'property.structure.description':'Build the real phase / building / wing / floor tree. Rates and room types remain independent.',
  });
  const labels = {back:translated['property.structure.back'],title:translated['property.structure.title'],description:translated['property.structure.description']};
  return <div className="max-w-5xl space-y-24">
    <Link href={'/app/admin/properties/'+project.id+'/onboarding'} className="text-small font-semibold text-brand-andaman">{labels.back}</Link>
    <PageHeading kicker={project.name} title={labels.title} subtitle={labels.description} />
    <Panel><StructureEditor projectId={project.id} initialNodes={project.structureNodes}/></Panel>
  </div>;
}
