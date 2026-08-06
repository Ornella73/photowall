/**
 * Get or generate a unique secret uploader token stored in browser localStorage.
 * This token allows the uploader to identify and delete their own uploaded photos.
 */
export function getUploaderToken(): string {
  if (typeof window === 'undefined') return ''

  const STORAGE_KEY = 'photowall_uploader_token'
  let token = localStorage.getItem(STORAGE_KEY)

  if (!token) {
    token = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    localStorage.setItem(STORAGE_KEY, token)
  }

  return token
}
