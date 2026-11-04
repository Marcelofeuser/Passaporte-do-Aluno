export const SUPER_ADMIN_EMAIL = 'marcelofeuser.go@gmail.com'

export function isApprovedSuperAdminEmail(email: string) {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL
}
