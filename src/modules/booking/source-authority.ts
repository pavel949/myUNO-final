import type { PrismaClient } from '@prisma/client';

type MappingReader = Pick<PrismaClient,'externalMapping'>;
const sellable=(config:unknown):boolean=>
  typeof config==='object' && config!==null && !Array.isArray(config) &&
  (config as Record<string,unknown>).bookingAuthority==='myuno' &&
  (config as Record<string,unknown>).cutoverVerified===true;

/**
 * Source-linked units must not enter the public sellable pool until an
 * independently verified cutover. The DB has the same guard as a last resort;
 * this domain check returns a useful 409 instead of leaking a trigger error.
 */
export async function assertLayantaraBookingAuthority(
  db:MappingReader,unitId:string,
):Promise<void>{
  const mapped=await db.externalMapping.findFirst({where:{
    entity_type:'unit',internal_id:unitId,
    externalSystem:{system_key:'layantara_os'},
  },select:{externalSystem:{select:{config:true}}}});
  if(mapped&&!sellable(mapped.externalSystem.config)){
    const error=new Error('This property is not available for new bookings until source-calendar cutover is verified');
    (error as Error&{code:string;blockReason:string}).code='DOUBLE_BOOK';
    (error as Error&{code:string;blockReason:string}).blockReason='source_authority';
    throw error;
  }
}

/** Search/list availability must not offer source-controlled physical units. */
export async function excludedSourceControlledUnits(
  db:MappingReader, unitIds:string[],
):Promise<string[]>{
  if(!unitIds.length)return[];
  const mapped=await db.externalMapping.findMany({where:{
    entity_type:'unit',internal_id:{in:unitIds},
    externalSystem:{system_key:'layantara_os'},
  },select:{internal_id:true,externalSystem:{select:{config:true}}}});
  return mapped.filter(row=>!sellable(row.externalSystem.config)).map(row=>row.internal_id);
}


/**
 * Exclusions for public discovery, including searches without dates. These
 * records are tiny compared with physical inventory and are filtered before
 * pagination/aggregation so totals and category capacity cannot advertise
 * source-controlled villas before their signed cutover.
 */
export async function allExcludedSourceControlledUnitIds(db: MappingReader): Promise<string[]> {
  const mapped = await db.externalMapping.findMany({
    where: {
      entity_type: 'unit',
      externalSystem: { system_key: 'layantara_os' },
    },
    select: {
      internal_id: true,
      externalSystem: { select: { config: true } },
    },
  });
  return mapped.filter(row => !sellable(row.externalSystem.config)).map(row => row.internal_id);
}
