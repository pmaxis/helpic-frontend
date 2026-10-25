export type PolicyKind = 'privacy' | 'terms' | 'cookies'

export const POLICY_KINDS: PolicyKind[] = ['privacy', 'terms', 'cookies']

/** A policy in one language: an admin's text, or else the one Helpic comes with. */
export interface Policy {
  kind: PolicyKind
  locale: 'en' | 'uk'
  /** Plain lines: "## " a heading, "- " a list item, an empty line between paragraphs. */
  body: string
  custom: boolean
  updated_at: string | null
}

/** A policy as the admin panel sees it: who wrote it last too. */
export interface AdminPolicy extends Policy {
  /** Empty for the default, or once the admin's account is gone. */
  updated_by: string
}
