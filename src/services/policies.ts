import { http } from '@/services/api'
import type { Locale } from '@/i18n'
import type { Policy, PolicyKind } from '@/types/policies'

/** A policy for anyone, signed in or not, in `locale`. */
export async function fetchPolicy(kind: PolicyKind, locale: Locale): Promise<Policy> {
  const { data } = await http.get<{ policy: Policy }>(`/policies/${kind}`, { params: { locale } })
  return data.policy
}
