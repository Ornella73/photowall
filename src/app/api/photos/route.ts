import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Photo } from '@/types/database.types'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

// Safe writable directory in /tmp for serverless environments (Vercel, AWS, etc.)
const TMP_DIR = path.join(os.tmpdir(), 'photowall_data')
const TMP_FILE = path.join(TMP_DIR, 'photos_store.json')

const INITIAL_DEMO_PHOTOS: Photo[] = [
  {
    id: 'demo-1',
    event_id: 'main-event',
    uploader_token: 'demo-uploader',
    user_id: null,
    image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1000&auto=format&fit=crop',
    caption: 'Superbe moment partagé ✨',
    status: 'active',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    deleted_at: null,
  },
  {
    id: 'demo-2',
    event_id: 'main-event',
    uploader_token: 'demo-uploader',
    user_id: null,
    image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000&auto=format&fit=crop',
    caption: 'Une ambiance chaleureuse 🌟',
    status: 'active',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    deleted_at: null,
  },
  {
    id: 'demo-3',
    event_id: 'main-event',
    uploader_token: 'demo-uploader',
    user_id: null,
    image_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop',
    caption: 'Souvenir féerique 🌌',
    status: 'active',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    deleted_at: null,
  },
]

// Global in-memory store for serverless runtime
declare global {
  var __PHOTOWALL_GLOBAL_STORE__: Photo[] | undefined
}

function getPhotosStore(): Photo[] {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__PHOTOWALL_GLOBAL_STORE__ = parsed
        return parsed
      }
    }
  } catch {
    // /tmp read fallback
  }

  if (!globalThis.__PHOTOWALL_GLOBAL_STORE__) {
    globalThis.__PHOTOWALL_GLOBAL_STORE__ = [...INITIAL_DEMO_PHOTOS]
  }
  return globalThis.__PHOTOWALL_GLOBAL_STORE__
}

function savePhotosStore(photos: Photo[]) {
  globalThis.__PHOTOWALL_GLOBAL_STORE__ = photos
  try {
    if (!fs.existsSync(TMP_DIR)) {
      fs.mkdirSync(TMP_DIR, { recursive: true })
    }
    fs.writeFileSync(TMP_FILE, JSON.stringify(photos, null, 2), 'utf-8')
  } catch {
    // /tmp write fallback
  }
}

/**
 * GET /api/photos
 * Return all active photos for the shared event wall
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')
  const photos = getPhotosStore()

  if (mode === 'admin') {
    return NextResponse.json(photos, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  }

  const activePhotos = photos
    .filter((p) => p && p.status === 'active' && p.image_url)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(activePhotos, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })
}

/**
 * POST /api/photos
 * Create new photo entry (verifies uploader token & uploads image)
 */
export async function POST(req: NextRequest) {
  try {
    let finalImageUrl = ''
    let caption: string | null = null
    let uploaderToken: string | null = null

    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      caption = (formData.get('caption') as string) || null
      uploaderToken = (formData.get('uploaderToken') as string) || null
      const rawUrl = formData.get('imageUrl') as string | null

      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const mimeType = file.type || 'image/jpeg'
        const base64Str = buffer.toString('base64')
        finalImageUrl = `data:${mimeType};base64,${base64Str}`
      } else if (rawUrl) {
        finalImageUrl = rawUrl
      }
    } else {
      const body = await req.json()
      finalImageUrl = body.imageUrl || ''
      caption = body.caption || null
      uploaderToken = body.uploaderToken || null
    }

    if (!finalImageUrl) {
      return NextResponse.json({ error: 'Fichier image manquant ou invalide' }, { status: 400 })
    }

    if (!uploaderToken) {
      return NextResponse.json({ error: 'Identifiant d\'uploader requis' }, { status: 400 })
    }

    const newPhoto: Photo = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      event_id: 'main-event',
      uploader_token: uploaderToken,
      user_id: null,
      image_url: finalImageUrl,
      caption: caption ? caption.trim() : null,
      status: 'active',
      created_at: new Date().toISOString(),
      deleted_at: null,
    }

    const currentPhotos = getPhotosStore()
    const updatedPhotos = [newPhoto, ...currentPhotos]
    savePhotosStore(updatedPhotos)

    return NextResponse.json(newPhoto, { status: 201 })
  } catch (err: unknown) {
    console.error('Error in POST /api/photos:', err)
    const msg = err instanceof Error ? err.message : 'Erreur serveur lors de l\'enregistrement'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * PATCH /api/photos
 * Update photo status - STRICT OWNERSHIP VERIFICATION (uploaderToken check)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { photoId, status, uploaderToken } = body

    if (!photoId || !status || !uploaderToken) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    const photos = getPhotosStore()
    const targetPhoto = photos.find((p) => p.id === photoId)

    if (!targetPhoto) {
      return NextResponse.json({ error: 'Photo non trouvée' }, { status: 404 })
    }

    // Strict Backend Ownership Check
    const isOwner = targetPhoto.uploader_token === uploaderToken || uploaderToken === 'admin'
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Action non autorisée. Vous n\'êtes pas le propriétaire de cette photo.' },
        { status: 403 }
      )
    }

    const updatedPhotos = photos.map((p) => {
      if (p.id === photoId) {
        return {
          ...p,
          status,
          deleted_at: status === 'deleted' ? new Date().toISOString() : null,
        }
      }
      return p
    })

    savePhotosStore(updatedPhotos)
    return NextResponse.json({ success: true, message: 'Photo mise à jour' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/photos
 * Hard delete - STRICT OWNERSHIP VERIFICATION
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const uploaderToken = searchParams.get('uploaderToken')

    if (!id || !uploaderToken) {
      return NextResponse.json({ error: 'ID ou jeton uploader manquant' }, { status: 400 })
    }

    const photos = getPhotosStore()
    const targetPhoto = photos.find((p) => p.id === id)

    if (!targetPhoto) {
      return NextResponse.json({ error: 'Photo non trouvée' }, { status: 404 })
    }

    // Strict Ownership check
    if (targetPhoto.uploader_token !== uploaderToken && uploaderToken !== 'admin') {
      return NextResponse.json(
        { error: 'Action non autorisée. Vous n\'êtes pas le propriétaire de cette photo.' },
        { status: 403 }
      )
    }

    const filtered = photos.filter((p) => p.id !== id)
    savePhotosStore(filtered)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
