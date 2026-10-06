import Link from 'next/link';
import { PageHeading, Panel } from '@/components/premium/StitchPage';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import StructureEditor from '@/components/property/StructureEditor';
import { getLabels } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function UnitStructurePage({params}:{params:{id:string}}){
  const unit=await prisma.unit.findUnique({
    where:{id:params.id},
    select:{id:true,name:true,projectId:true,structureNodeId:true,floor:true,
      project:{select:{name:true,structureNodes:{
        include:{_count:{select:{units:true,children:true}}},
        orderBy:[{sortOrder:'asc'},{name:'asc'}],
      }}},
    },
  });
  if(!unit)notFound();
  const translated = await getLabels({
    'unit.structure.back':'← Physical unit',
    'unit.structure.title':'Location',
    'unit.structure.description':'Assign a verified building, wing or floor without changing the commercial category.',
  });
  const labels = {back:translated['unit.structure.back'],title:translated['unit.structure.title'],description:translated['unit.structure.description']};
  return <div className="max-w-5xl space-y-24">
    <Link href={'/app/admin/units/'+unit.id} className="text-small font-semibold text-brand-andaman">{labels.back}</Link>
    <PageHeading kicker={unit.project.name} title={<>{unit.name} · {labels.title}</>} subtitle={labels.description} />
    <Panel><StructureEditor projectId={unit.projectId} initialNodes={unit.project.structureNodes}
      initialUnit={{id:unit.id,name:unit.name,structureNodeId:unit.structureNodeId,floor:unit.floor}}/></Panel>
  </div>;
}
