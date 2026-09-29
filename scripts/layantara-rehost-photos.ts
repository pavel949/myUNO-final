/**
 * Rehost verified public Layantara photo bytes into myUNO-owned Vercel Blob.
 * Dry-run by default. Requires DATABASE_URL + BLOB_READ_WRITE_TOKEN and
 * LAYANTARA_MEDIA_WRITE=1 for writes. Source storage is NEVER modified.
 */
import { PrismaClient } from '@prisma/client';
import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';

const prisma=new PrismaClient();
const PREFIX='https://omwoglpcwaiflaprgrne.supabase.co/storage/v1/object/public/villa-media/';
const WRITE=process.env.LAYANTARA_MEDIA_WRITE==='1';
const MIME=new Set(['image/jpeg','image/png','image/webp']);
async function main(){
  if(WRITE&&!process.env.BLOB_READ_WRITE_TOKEN)throw Error('BLOB_READ_WRITE_TOKEN required for media writes');
  const mappings=await prisma.externalMapping.findMany({where:{entity_type:'photo',externalSystem:{system_key:'layantara_os'}},
    select:{id:true,external_id:true,internal_id:true,metadata:true}});
  let already=0,completed=0,failed=0;
  for(const m of mappings){
    const metadata=(typeof m.metadata==='object'&&m.metadata&&!Array.isArray(m.metadata)?m.metadata:{}) as Record<string,unknown>;
    if(metadata.physicalCopyComplete===true){already++;continue;}
    const asset=await prisma.mediaAsset.findUnique({where:{id:m.internal_id},
      select:{id:true,storageKey:true,mimeType:true,sizeBytes:true}});
    if(!asset||!asset.storageKey.startsWith(PREFIX)||!MIME.has(asset.mimeType)||asset.sizeBytes<1||asset.sizeBytes>8*1024*1024){
      failed++;continue;
    }
    if(!WRITE)continue;
    try{
      const url=new URL(asset.storageKey);
      if(url.origin!=='https://omwoglpcwaiflaprgrne.supabase.co'||!url.pathname.startsWith('/storage/v1/object/public/villa-media/'))
        throw Error('Unexpected source image origin');
      const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('Source media fetch failed with '+response.status);
      const type=(response.headers.get('content-type')||'').split(';')[0].trim();
      if(type!==asset.mimeType)throw Error('Source MIME mismatch');
      const bytes=Buffer.from(await response.arrayBuffer());
      if(bytes.byteLength!==asset.sizeBytes||bytes.byteLength>8*1024*1024)throw Error('Source file size mismatch');
      const extension=asset.mimeType==='image/jpeg'?'jpg':asset.mimeType==='image/png'?'png':'webp';
      const sourceSha256=createHash('sha256').update(bytes).digest('hex');
      const blob=await put('layantara/'+m.external_id+'.'+extension,bytes,{
        access:'public',contentType:asset.mimeType,addRandomSuffix:true,
      });
      // Never mark the physical copy complete based only on a successful
      // upload response. Read the new object back and compare actual bytes.
      const copied=await fetch(blob.url,{signal:AbortSignal.timeout(20000)});
      if(!copied.ok)throw Error('Target media verification fetch failed');
      const targetBytes=Buffer.from(await copied.arrayBuffer());
      const targetSha256=createHash('sha256').update(targetBytes).digest('hex');
      if(targetBytes.length!==bytes.length||targetSha256!==sourceSha256)
        throw Error('Target media SHA-256/byte-size mismatch');
      await prisma.$transaction(async tx=>{
        await tx.mediaAsset.update({where:{id:asset.id},data:{storageKey:blob.url}});
        await tx.externalMapping.update({where:{id:m.id},data:{
          metadata:{...metadata,physicalCopyComplete:true,verifiedByteSize:bytes.byteLength,
            sourceSha256,targetSha256,
            targetStorage:'vercel_blob',rehostedAt:new Date().toISOString()},
        }});
      });
      completed++;
    }catch{failed++;}
  }
  console.log(JSON.stringify({sourceRows:mappings.length,alreadyRehosted:already,completed,failed,dryRun:!WRITE}));
  if(failed)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Rehosting failed');process.exitCode=1;})
  .finally(()=>prisma.$disconnect());
