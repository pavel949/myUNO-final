import crypto from 'crypto';
import { put } from '@vercel/blob';
import type { PrismaClient } from '@prisma/client';

const MAX_BYTES=12*1024*1024;
const ALLOWED=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
const IV_BYTES=12;
const TAG_BYTES=16;
const PREFIX='private/deals/';

function key():Buffer{
  const raw=process.env.ENCRYPTION_KEY;
  if(!raw||!/^[a-f0-9]{64}$/i.test(raw))throw new Error('private_evidence_encryption_key_not_configured');
  return Buffer.from(raw,'hex');
}
export function encryptDealFile(source:Buffer):Buffer{
  const iv=crypto.randomBytes(IV_BYTES);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const payload=Buffer.concat([cipher.update(source),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),payload]);
}
export function decryptDealFile(source:Buffer):Buffer{
  if(source.length<IV_BYTES+TAG_BYTES)throw new Error('invalid_private_evidence_ciphertext');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),source.subarray(0,IV_BYTES));
  decipher.setAuthTag(source.subarray(IV_BYTES,IV_BYTES+TAG_BYTES));
  return Buffer.concat([decipher.update(source.subarray(IV_BYTES+TAG_BYTES)),decipher.final()]);
}

export async function saveDealEvidence(db:PrismaClient,input:{
  buffer:Buffer; mimeType:string; actorIdentityId:string; fileName:string;
}){
  if(!ALLOWED.has(input.mimeType))throw new Error('unsupported_private_evidence_type');
  if(!input.buffer.length||input.buffer.length>MAX_BYTES)throw new Error('private_evidence_size_out_of_range');
  if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('private_evidence_storage_not_configured');
  const encrypted=encryptDealFile(input.buffer);
  // Public blob only ever contains authenticated AES-GCM ciphertext. No
  // plaintext Vercel Blob URL is generated or returned. ENCRYPTION_KEY must
  // be restricted to server-side configuration; do not prefix it NEXT_PUBLIC_.
  const blob=await put(PREFIX+crypto.randomUUID()+'.bin',encrypted,{
    access:'public',contentType:'application/octet-stream',addRandomSuffix:true,
  });
  return db.mediaAsset.create({data:{
    storageKey:blob.url,kind:'document',mimeType:input.mimeType,
    sizeBytes:input.buffer.byteLength,uploadedByIdentityId:input.actorIdentityId,
    encrypted:true,
  }});
}
export async function readDealEvidence(storageKey:string):Promise<Buffer>{
  const url=new URL(storageKey);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.blob.vercel-storage.com')||
    !url.pathname.includes('/'+PREFIX))throw new Error('invalid_private_evidence_location');
  const response=await fetch(url.toString(),{cache:'no-store'});
  if(!response.ok)throw new Error('private_evidence_storage_unavailable');
  const raw=Buffer.from(await response.arrayBuffer());
  if(raw.length>MAX_BYTES+IV_BYTES+TAG_BYTES)throw new Error('oversized_private_evidence');
  return decryptDealFile(raw);
}
export function isAllowedDealEvidenceType(mimeType:string){return ALLOWED.has(mimeType);}
export { MAX_BYTES as MAX_DEAL_EVIDENCE_BYTES };
