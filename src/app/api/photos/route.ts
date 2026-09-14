import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Photo } from '@/types/database.types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'photos_store.json')
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

// Initial default photos if store is empty
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

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DEMO_PHOTOS, null, 2), 'utf-8')
  }
}

// Read photos from file
function readPhotos(): Photo[] {
  ensureDirectories()
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as Photo[]
  } catch {
    return INITIAL_DEMO_PHOTOS
  }
}

// Write photos to file
function savePhotos(photos: Photo[]) {
  ensureDirectories()
  fs.writeFileSync(DATA_FILE, JSON.stringify(photos, null, 2), 'utf-8')
}

/**
 * GET /api/photos
 * Return photos list (optional query parameter mode=admin to return deleted photos too)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode')
  const photos = readPhotos()

  if (mode === 'admin') {
    return NextResponse.json(photos)
  }

  // Active photos sorted by newest first
  const activePhotos = photos
    .filter((p) => p.status === 'active')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(activePhotos)
}

/**
 * POST /api/photos
 * Create new photo entry (supports base64 image data URL or direct image URL)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl, caption, uploaderToken } = body

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL or file required' }, { status: 400 })
    }

    ensureDirectories()
    let finalImageUrl = imageUrl

    // If imageUrl is a Data URL (base64 image), save it to public/uploads
    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
      const matches = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
        const base64Data = matches[2]
        const filename = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`
        const filepath = path.join(UPLOADS_DIR, filename)

        fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'))
        finalImageUrl = `/uploads/${filename}`
      }
    }

    const newPhoto: Photo = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      image_url: finalImageUrl,
      caption: caption ? caption.trim() : null,
      status: 'active',
      uploader_token: uploaderToken || null,
      created_at: new Date().toISOString(),
      deleted_at: null,
    }

    const currentPhotos = readPhotos()
    const updatedPhotos = [newPhoto, ...currentPhotos]
    savePhotos(updatedPhotos)

    return NextResponse.json(newPhoto, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * PATCH /api/photos
 * Update photo status (active <-> deleted)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { photoId, status, uploaderToken } = body

    if (!photoId || !status) {
      return NextResponse.json({ error: 'Missing photoId or status' }, { status: 400 })
    }

    const photos = readPhotos()
    let updated = false

    const updatedPhotos = photos.map((p) => {
      if (p.id === photoId) {
        // Verify owner token if provided or allow admin update
        if (!uploaderToken || p.uploader_token === uploaderToken || uploaderToken === 'admin') {
          updated = true
          return {
            ...p,
            status,
            deleted_at: status === 'deleted' ? new Date().toISOString() : null,
          }
        }
      }
      return p
    })

    if (updated) {
      savePhotos(updatedPhotos)
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Photo not found or unauthorized' }, { status: 403 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/photos
 * Delete photo permanently (Admin action)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing photo ID' }, { status: 400 })
    }

    const photos = readPhotos()
    const filtered = photos.filter((p) => p.id !== id)
    savePhotos(filtered)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
