import { createClient } from '@/lib/supabase/client'
import { Photo, PhotoStatus } from '@/types/database.types'
import JSZip from 'jszip'

const LOCAL_STORAGE_KEY = 'photowall_local_photos_v1'
const BROADCAST_CHANNEL_NAME = 'photowall_realtime_channel'

/**
 * Check if Supabase environment is configured with a real external project.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return false
  if (url.includes('your-supabase-project')) return false
  if (url.includes('placeholder')) return false
  if (url.includes('example.com')) return false
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

/**
 * Initial sample photos when storage is empty
 */
const INITIAL_DEMO_PHOTOS: Photo[] = [
  {
    id: 'demo-1',
    image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1000&auto=format&fit=crop',
    caption: 'Superbe moment partagé ✨',
    status: 'active',
    uploader_token: 'demo',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    deleted_at: null,
  },
  {
    id: 'demo-2',
    image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop',
    caption: 'Une ambiance chaleureuse 🌟',
    status: 'active',
    uploader_token: 'demo',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    deleted_at: null,
  },
  {
    id: 'demo-3',
    image_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop',
    caption: 'Souvenir féerique 🌌',
    status: 'active',
    uploader_token: 'demo',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    deleted_at: null,
  },
]

/**
 * Local Storage Fallback Helpers
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

function notifyBroadcastChannel() {
  if (typeof window === 'undefined') return
  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    channel.postMessage({ type: 'PHOTOS_UPDATED', timestamp: Date.now() })
    channel.close()
  } catch {
    // BroadcastChannel unsupported
  }
  window.dispatchEvent(new Event('photowall_local_update'))
}

/**
 * Get all active photos globally (from Supabase or shared server API /api/photos)
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
      // Supabase network failure
    }
  }

  // Fetch shared server API
  try {
    const res = await fetch('/api/photos', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (res.ok) {
      const serverPhotos = (await res.json()) as Photo[]
      saveLocalPhotos(serverPhotos)
      return serverPhotos
    }
  } catch {
    // network fallback
  }

  const local = getLocalPhotos()
  return local.filter((p) => p.status === 'active')
}

/**
 * Get all photos for Admin view
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
      // Supabase failure
    }
  }

  try {
    const res = await fetch('/api/photos?mode=admin', { cache: 'no-store' })
    if (res.ok) {
      return (await res.json()) as Photo[]
    }
  } catch {
    // fallback
  }

  return getLocalPhotos()
}

/**
 * Upload & Create Photo (Uses FormData to send photos reliably from Mobile or PC)
 */
export async function addPhoto(params: {
  imageUrl: string
  file?: File | null
  caption?: string | null
  uploaderToken: string
}): Promise<Photo> {
  const { imageUrl, file, caption, uploaderToken } = params

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      let finalUrl = imageUrl

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
            caption: caption ? caption.trim() : null,
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
      // Continue to server API
    }
  }

  // Upload to Global Server API /api/photos using FormData
  try {
    const formData = new FormData()
    if (file) {
      formData.append('file', file, file.name || 'mobile_photo.jpg')
    }
    if (imageUrl) {
      formData.append('imageUrl', imageUrl)
    }
    if (caption) {
      formData.append('caption', caption.trim())
    }
    if (uploaderToken) {
      formData.append('uploaderToken', uploaderToken)
    }

    const res = await fetch('/api/photos', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const createdPhoto = (await res.json()) as Photo
      const currentLocal = getLocalPhotos()
      saveLocalPhotos([createdPhoto, ...currentLocal])
      return createdPhoto
    } else {
      const errJson = await res.json().catch(() => ({}))
      throw new Error(errJson.error || 'Erreur lors de la sauvegarde sur le serveur.')
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Impossible de contacter le serveur.'
    throw new Error(errorMsg)
  }
}

/**
 * Update Photo Status (active <-> deleted)
 */
export async function updatePhotoStatus(
  photoId: string,
  newStatus: PhotoStatus,
  uploaderToken?: string
): Promise<boolean> {
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
      if (!error) return true
    } catch {
      // Supabase failure
    }
  }

  try {
    const res = await fetch('/api/photos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photoId,
        status: newStatus,
        uploaderToken,
      }),
    })
    if (res.ok) {
      notifyBroadcastChannel()
      return true
    }
  } catch {
    // API failure
  }

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
  return true
}

/**
 * Hard Delete Photo Permanently
 */
export async function deletePhotoPermanently(photoId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('photos').delete().eq('id', photoId)
      if (!error) return true
    } catch {
      // Supabase failure
    }
  }

  try {
    const res = await fetch(`/api/photos?id=${encodeURIComponent(photoId)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      notifyBroadcastChannel()
      return true
    }
  } catch {
    // API failure
  }

  const currentLocal = getLocalPhotos()
  const updatedLocal = currentLocal.filter((p) => p.id !== photoId)
  saveLocalPhotos(updatedLocal)

  return true
}

/**
 * Download Single Photo
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

/**
 * Download Photos Album as ZIP Archive
 */
export async function downloadPhotosAlbum(
  photos: Photo[],
  onProgress?: (percent: number) => void
): Promise<void> {
  if (!photos || photos.length === 0) {
    throw new Error('Aucune photo à télécharger.')
  }

  const zip = new JSZip()
  const folder = zip.folder('photowall_album')

  let count = 0
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    try {
      let blob: Blob
      if (photo.image_url.startsWith('data:')) {
        const res = await fetch(photo.image_url)
        blob = await res.blob()
      } else {
        const response = await fetch(photo.image_url, { mode: 'cors' })
        blob = await response.blob()
      }
      const mimeType = blob.type
      let ext = 'jpg'
      if (mimeType.includes('png')) ext = 'png'
      else if (mimeType.includes('webp')) ext = 'webp'

      const captionSlug = photo.caption
        ? photo.caption.toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 15)
        : ''
      const filename = `photo_${i + 1}${captionSlug ? '_' + captionSlug : ''}.${ext}`

      folder?.file(filename, blob)
      count++
      if (onProgress) {
        onProgress(Math.round(((i + 1) / photos.length) * 100))
      }
    } catch (err) {
      console.warn(`Could not fetch photo ${photo.id} for zip:`, err)
    }
  }

  if (count === 0) {
    throw new Error('Impossible d\'extraire les fichiers images.')
  }

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = `photowall_album_${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
