import { getServiceById } from '@/modules/services/server/service.service'
import { FlowersMetaSchema, YachtMetaSchema, HomeMetaSchema } from '@/modules/services/validation/schemas'

/**
 * Validate industry-specific meta for a service before creation/update.
 * Returns parsed meta or throws with details.
 */
export function validateIndustryMeta(taxonomySlug: string | null | undefined, meta: any) {
  if (!taxonomySlug) return meta
  if (taxonomySlug.startsWith('flowers')) {
    const res = FlowersMetaSchema.safeParse(meta || {})
    if (!res.success) throw new Error('Invalid flowers meta: ' + JSON.stringify(res.error.format()))
    return res.data
  }
  if (taxonomySlug.startsWith('yacht')) {
    const res = YachtMetaSchema.safeParse(meta || {})
    if (!res.success) throw new Error('Invalid yacht meta: ' + JSON.stringify(res.error.format()))
    return res.data
  }
  if (taxonomySlug.startsWith('home')) {
    const res = HomeMetaSchema.safeParse(meta || {})
    if (!res.success) throw new Error('Invalid home meta: ' + JSON.stringify(res.error.format()))
    return res.data
  }
  // default: accept any meta
  return meta
}
