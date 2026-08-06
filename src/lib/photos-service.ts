import { createClient } from '@/lib/supabase/client'
import { Photo, PhotoStatus } from '@/types/database.types'

const LOCAL_STORAGE_KEY = 'photowall_local_photos_v1'
const BROADCAST_CHANNEL_NAME = 'photowall_realtime_channel'

/**
 * Check if the Supabase environment URL is configured with a real project.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return false
  if (url.includes('your-supabase-project')) return false
  if (url.includes('placeholder')) return false
  if (url.includes('example.com')) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.supabase.co') || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

/**
 * Initial sample photos when local storage is empty
 */
const INITIAL_DEMO_PHOTOS: Photo[] = [
  {
    id: 'demo-1',
    image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1000&auto=format&fit=crop',
    status: 'active',
    uploader_token: 'demo',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    deleted_at: null,
  },
  {
    id: 'demo-2',
    image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop',
    status: 'active',
    uploader_token: 'demo',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    deleted_at: null,
  },
  {
    id: 'demo-3',
    image_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop',
    status: 'active',
    uploader_token: 'demo',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    deleted_at: null,
  },
]

/**
 * Helper to compress image file into JPEG Data URL for local storage
 */
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 1200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width)
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height)
            height = MAX_HEIGHT
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        } else {
          resolve(e.target?.result as string || '')
        }
      }
      img.onerror = () => resolve(reader.result as string || '')
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

/**
 * Local Storage Helpers
 */
export function getLocalPhotos(): Photo[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_PHOTOS
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!data) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_PHOTOS))
      return INITIAL_DEMO_PHOTOS
    }
    return JSON.parse(data) as Photo[]
  } catch {
    return INITIAL_DEMO_PHOTOS
  }
}

export function saveLocalPhotos(photos: Photo[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(photos))
    notifyBroadcastChannel()
  } catch (err) {
    console.warn('Failed to save photos to localStorage:', err)
  }
}

/**
 * Realtime BroadcastChannel for cross-tab local updates
 */
function notifyBroadcastChannel() {
  if (typeof window === 'undefined') return
  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.postMessage({ type: 'PHOTOS_UPDATED', timestamp: Date.now() })
    channel.close()
  } catch {
    // BroadcastChannel unsupported or restricted
  }
  // Also dispatch window custom event for same-tab updates
  window.dispatchEvent(new Event('photowall_local_update'))
}

/**
 * Get all active photos (combines Supabase and LocalStorage safely)
 */
export async function getActivePhotos(): Promise<Photo[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (!error && data) {
        return data
      }
    } catch {
      // Supabase network request failed, fallback to local storage
    }
  }

  const local = getLocalPhotos()
  return local.filter((p) => p.status === 'active')
}

/**
 * Get all photos for Admin view (active and deleted)
 */
export async function getAllAdminPhotos(): Promise<Photo[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        return data
      }
    } catch {
      // Supabase network failure, fallback to local storage
    }
  }

  return getLocalPhotos()
}

/**
 * Upload & Create Photo
 */
export async function addPhoto(params: {
  imageUrl: string
  file?: File | null
  uploaderToken: string
}): Promise<Photo> {
  const { imageUrl, file, uploaderToken } = params
  let finalUrl = imageUrl

  // If Supabase is configured, try Supabase upload & insert first
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()

      if (file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        const filePath = `uploads/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, file)

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('photos')
            .getPublicUrl(filePath)
          finalUrl = publicUrlData.publicUrl
        }
      }

      if (finalUrl) {
        const { data, error } = await supabase
          .from('photos')
          .insert({
            image_url: finalUrl,
            status: 'active',
            uploader_token: uploaderToken,
          })
          .select()
          .single()

        if (!error && data) {
          notifyBroadcastChannel()
          return data
        }
      }
    } catch {
      // If network error happens, continue to fallback local storage mode
    }
  }

  // Local Storage Fallback Mode
  if (file && (!finalUrl || finalUrl === imageUrl)) {
    finalUrl = await compressImageFile(file)
  }

  if (!finalUrl) {
    throw new Error("L'image n'a pas pu être préparée pour l'envoi.")
  }

  const newPhoto: Photo = {
    id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    image_url: finalUrl,
    status: 'active',
    uploader_token: uploaderToken,
    created_at: new Date().toISOString(),
    deleted_at: null,
  }

  const currentLocal = getLocalPhotos()
  const updatedLocal = [newPhoto, ...currentLocal]
  saveLocalPhotos(updatedLocal)

  return newPhoto
}

/**
 * Update Photo Status (e.g. active <-> deleted)
 */
export async function updatePhotoStatus(
  photoId: string,
  newStatus: PhotoStatus,
  uploaderToken?: string
): Promise<boolean> {
  let updatedInSupabase = false

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      let query = supabase
        .from('photos')
        .update({
          status: newStatus,
          deleted_at: newStatus === 'deleted' ? new Date().toISOString() : null,
        })
        .eq('id', photoId)

      if (uploaderToken) {
        query = query.eq('uploader_token', uploaderToken)
      }

      const { error } = await query
      if (!error) updatedInSupabase = true
    } catch {
      // Supabase network failure
    }
  }

  // Update in Local Storage as well
  const currentLocal = getLocalPhotos()
  const updatedLocal = currentLocal.map((p) => {
    if (p.id === photoId) {
      if (!uploaderToken || p.uploader_token === uploaderToken) {
        return {
          ...p,
          status: newStatus,
          deleted_at: newStatus === 'deleted' ? new Date().toISOString() : null,
        }
      }
    }
    return p
  })

  saveLocalPhotos(updatedLocal)
  return updatedInSupabase || true
}

/**
 * Hard Delete Photo Permanently
 */
export async function deletePhotoPermanently(photoId: string): Promise<boolean> {
  let deletedInSupabase = false

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('photos').delete().eq('id', photoId)
      if (!error) deletedInSupabase = true
    } catch {
      // Supabase network failure
    }
  }

  const currentLocal = getLocalPhotos()
  const updatedLocal = currentLocal.filter((p) => p.id !== photoId)
  saveLocalPhotos(updatedLocal)

  return deletedInSupabase || true
}

/**
 * Download Photo helper function
 */
export async function downloadPhoto(imageUrl: string, photoId?: string) {
  const filename = `photowall_${photoId || Date.now()}.jpg`

  try {
    if (imageUrl.startsWith('data:')) {
      const a = document.createElement('a')
      a.href = imageUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    const response = await fetch(imageUrl, { mode: 'cors' })
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}
