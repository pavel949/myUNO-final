/** JSON boundaries cannot serialize Prisma BigInt. Agreement satang are decimal
 * strings (never float baht) and ISO dates; the DB remains authoritative. */
export function propertyDealJson<T>(value:T):T {
  return JSON.parse(JSON.stringify(value,(_key,item)=>
    typeof item==='bigint'?item.toString():item)) as T;
}
