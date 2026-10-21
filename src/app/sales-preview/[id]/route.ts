import { randomBytes } from 'node:crypto';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { readOffer } from '@/modules/sales-offers/offer.service';
import { proposalShell } from '@/modules/sales-offers/public-shell';
import { offerFailure } from '@/modules/sales-offers/http';
/** Authenticated staff preview also bypasses the application shell, including in print output. */
export async function GET(_req:Request,props:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();if(!user)return new Response(null,{status:302,headers:{Location:'/login'}});
  try{
    const {id}=await props.params;await readOffer(prisma,user.identityId,id);
    const nonce=randomBytes(18).toString('base64');
    return new Response(proposalShell(nonce,`/api/ops/sales-offers/${encodeURIComponent(id)}/preview`),{headers:{
      'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer',
      'X-Robots-Tag':'noindex, nofollow, noarchive',
      'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    }});
  }catch(error){return offerFailure(error);}
}
