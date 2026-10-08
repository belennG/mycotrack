export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  role: MemberRole
}

/** GET /api/v1/me — the profile plus the organization the requests act on. */
export interface Me {
  id: string
  email: string | null
  name: string | null
  picture: string | null
  created_at: string
  last_login_at: string | null
  organization: OrganizationSummary
  organizations: OrganizationSummary[]
}
