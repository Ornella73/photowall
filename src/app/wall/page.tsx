'use client'

import { useEffect, useState, useCallback } from 'react'
import { Image as ImageIcon, Calendar, Maximize2, Sparkles, Wifi, WifiOff, Trash2, UserCheck, Download, Film, Archive, PlusCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Photo } from '@/types/database.types'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { getUploaderToken } from '@/lib/uploader-token'
import { getActivePhotos, deletePhotoPermanently, isSupabaseConfigured, downloadPhoto, downloadPhotosAlbum, saveLocalPhotos, getLocalPhotos } from '@/lib/photos-service'
import { MiniVideoModal } from '@/components/mini-video-modal'

export default function WallPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING')
  const [notification, setNotification] = useState<string | null>(null)
  const [uploaderToken, setUploaderToken] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Mini Video modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  // Zip download state
  const [isZipping, setIsZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)

  const showNotification = useCallback((msg: string) => {
    setNotification(msg)
    setTimeout(() => {
      setNotification((current) => (current === msg ? null : current))
    }, 4000)
  }, [])

  // Handle single photo download
  const handleDownloadPhoto = async (imageUrl: string, photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    showNotification('📥 Téléchargement de la photo en cours...')
    await downloadPhoto(imageUrl, photoId)
  }

  // Handle Album Zip Download
  const handleDownloadAlbum = async () => {
    if (photos.length === 0) return
    setIsZipping(true)
    setZipProgress(0)
    showNotification('📦 Préparation de l\'album photo ZIP...')

    try {
      await downloadPhotosAlbum(photos, (progress) => {
        setZipProgress(progress)
      })
      showNotification('✅ Album ZIP téléchargé avec succès !')
    } catch {
      showNotification('❌ Erreur lors du téléchargement de l\'album ZIP.')
    } finally {
      setIsZipping(false)
    }
  }

  // Initialize uploader token from localStorage
  useEffect(() => {
    setUploaderToken(getUploaderToken())
  }, [])

  // Handle owner self-deletion — PERMANENT and INSTANT
  const handleDeleteMyPhoto = async (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm('Voulez-vous vraiment supprimer définitivement votre photo ?')) return

    setDeletingId(photoId)

    // 1. Remove from UI IMMEDIATELY — don't wait for server
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    setSelectedPhoto(null)

    // 2. Remove from local cache IMMEDIATELY
    const updatedLocal = getLocalPhotos().filter((p) => p.id !== photoId)
    saveLocalPhotos(updatedLocal, true) // broadcast to all tabs

    // 3. Permanently delete from server in background
    try {
      await deletePhotoPermanently(photoId)
      showNotification('🗑️ Photo supprimée définitivement.')
    } catch {
      showNotification('⚠️ Supprimé localement — erreur serveur, sera retiré au prochain rechargement.')
    } finally {
      setDeletingId(null)
    }
  }

  // Fetch photos & setup automatic multi-channel realtime listeners + polling
  useEffect(() => {
    let isMounted = true

    const loadPhotos = async () => {
      try {
        const data = await getActivePhotos()
        if (isMounted) setPhotos(data)
      } catch (err) {
        console.error('Error fetching photos:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadPhotos()

    // Setup Fallback Auto-Polling (Intervalle de 3 sec) pour mise à jour en temps réel pour tous
    const pollingInterval = setInterval(async () => {
      try {
        const updated = await getActivePhotos()
        if (isMounted) {
          setPhotos((prev) => {
            const prevIds = prev.map((p) => p.id).join(',')
            const updatedIds = updated.map((p) => p.id).join(',')
            if (prevIds !== updatedIds) {
              if (updated.length > prev.length) {
                showNotification('✨ Une nouvelle photo vient d\'apparaître sur le mur !')
              }
              return updated
            }
            return prev
          })
        }
      } catch {
        // Silent polling fail
      }
    }, 3000)

    // Setup Local Storage & BroadcastChannel listeners
    const handleLocalUpdate = async () => {
      const updated = await getActivePhotos()
      if (isMounted) {
        setPhotos((prev) => {
          const prevIds = prev.map((p) => p.id).join(',')
          const updatedIds = updated.map((p) => p.id).join(',')
          if (prevIds !== updatedIds) {
            return updated
          }
          return prev
        })
      }
    }

    window.addEventListener('photowall_local_update', handleLocalUpdate)
    window.addEventListener('storage', handleLocalUpdate)

    let broadcastChannel: BroadcastChannel | null = null
    try {
      broadcastChannel = new BroadcastChannel('photowall_realtime_channel')
      broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'PHOTOS_UPDATED') {
          handleLocalUpdate()
          showNotification('✨ Une nouvelle photo vient d\'apparaître sur le mur !')
        }
      }
    } catch {
      // BroadcastChannel not supported
    }

    // Setup Supabase Realtime channel if configured
    let supabaseChannel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        supabaseChannel = supabase
          .channel('realtime-photos-wall', {
            config: { broadcast: { self: true } },
          })
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'photos',
            },
            (payload: RealtimePostgresChangesPayload<Photo>) => {
              const eventType = payload.eventType
              const newRow = payload.new as Photo | null
              const oldRow = payload.old as Partial<Photo> | null

              if (eventType === 'INSERT') {
                if (newRow && newRow.status === 'active') {
                  setPhotos((prev) => {
                    const exists = prev.some((p) => p.id === newRow.id)
                    if (exists) return prev
                    return [newRow, ...prev]
                  })
                  showNotification('✨ Une nouvelle photo vient d\'apparaître sur le mur !')
                }
              } else if (eventType === 'UPDATE') {
                if (newRow) {
                  if (newRow.status === 'active') {
                    setPhotos((prev) => {
                      const exists = prev.some((p) => p.id === newRow.id)
                      return exists
                        ? prev.map((p) => (p.id === newRow.id ? newRow : p))
                        : [newRow, ...prev]
                    })
                  } else {
                    setPhotos((prev) => prev.filter((p) => p.id !== newRow.id))
                  }
                }
              } else if (eventType === 'DELETE') {
                if (oldRow && oldRow.id) {
                  setPhotos((prev) => prev.filter((p) => p.id !== oldRow.id))
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setConnectionStatus('CONNECTED')
            } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
              setConnectionStatus('DISCONNECTED')
            } else {
              setConnectionStatus('CONNECTING')
            }
          })
      } catch {
        setConnectionStatus('CONNECTED')
      }
    } else {
      setConnectionStatus('CONNECTED')
    }

    return () => {
      isMounted = false
      clearInterval(pollingInterval)
      window.removeEventListener('photowall_local_update', handleLocalUpdate)
      window.removeEventListener('storage', handleLocalUpdate)
      if (broadcastChannel) broadcastChannel.close()
      if (supabaseChannel) {
        const supabase = createClient()
        supabase.removeChannel(supabaseChannel)
      }
    }
  }, [showNotification])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 flex-1 flex flex-col relative pb-28 sm:pb-12">
      {/* Realtime Toast Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 z-50 flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-stone-900/95 px-5 py-3 text-sm font-medium text-amber-100 shadow-2xl backdrop-blur-xl"
          >
            <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-amber-50 sm:text-4xl">
              Mur Photo <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Live</span>
            </h1>

            {/* Connection Status Badge */}
            {connectionStatus === 'CONNECTED' ? (
              <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 text-xs text-amber-300 border-amber-500/40 bg-amber-500/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <Wifi className="h-3 w-3 mr-0.5 text-amber-400" />
                Mise à jour en direct
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 text-xs text-amber-400 border-amber-500/30">
                <WifiOff className="h-3 w-3 mr-0.5" />
                {connectionStatus === 'CONNECTING' ? 'Connexion Live...' : 'Reconnexion...'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-stone-400 mt-1">
            Chaque photo publiée s&apos;affiche instantanément pour tous les visiteurs.
          </p>
        </div>

        {/* Header Action Buttons (Mini Video + Album Zip Download) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            onClick={() => setIsVideoModalOpen(true)}
            disabled={photos.length === 0}
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold hover:brightness-110 shadow-md shadow-amber-900/30 text-xs sm:text-sm"
          >
            <Film className="mr-1.5 h-4 w-4" />
            Mini Film Vidéo
          </Button>

          <Button
            variant="outline"
            onClick={handleDownloadAlbum}
            disabled={isZipping || photos.length === 0}
            className="border-amber-900/50 bg-stone-900/80 text-amber-200 hover:bg-stone-800 text-xs sm:text-sm"
          >
            <Archive className="mr-1.5 h-4 w-4 text-amber-400" />
            {isZipping ? `ZIP (${zipProgress}%)` : 'Album ZIP'}
          </Button>

          <Button asChild variant="secondary" className="bg-stone-800 text-stone-200 hover:bg-stone-700 text-xs sm:text-sm">
            <Link href="/upload">
              <PlusCircle className="mr-1.5 h-4 w-4 text-amber-400" /> Ajouter
            </Link>
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-stone-900/80 border border-amber-900/20 animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        /* Empty Wall State */
        <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-amber-900/40 bg-stone-900/40 p-12 text-center my-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 mb-4">
            <ImageIcon className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-amber-100 mb-2">Le mur photo est vide pour l&apos;instant</h3>
          <p className="text-stone-400 max-w-sm mb-6 text-sm">
            Soyez le premier à poster une photo ! Elle apparaîtra ici en temps réel pour tout le monde.
          </p>
          <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold">
            <Link href="/upload">Prendre / Poster une photo</Link>
          </Button>
        </div>
      ) : (
        /* DIY Polaroid Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 sm:gap-8">
          <AnimatePresence mode="popLayout">
            {photos.map((photo, index) => {
              const isMyPhoto = Boolean(uploaderToken && photo.uploader_token === uploaderToken)
              // Subtle tilt via CSS style (not Framer animate) to avoid Framer Layout conflicts
              const tiltAngles = [-1.5, 1, -0.8, 1.2, -1.2, 0.8]
              const tilt = tiltAngles[index % tiltAngles.length]

              return (
                <motion.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.7, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: -30 }}
                  transition={{
                    layout: { type: 'spring', stiffness: 300, damping: 30 },
                    opacity: { duration: 0.25 },
                    scale: { duration: 0.25 },
                  }}
                  style={{ rotate: `${tilt}deg` }}
                  whileHover={{ scale: 1.04, rotate: 0, zIndex: 20 }}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative polaroid-card p-2 sm:p-2.5 rounded-xl cursor-pointer select-none"
                >
                  {/* Washi tape accent on top center */}
                  <div className="washi-tape top-[-8px] left-1/2 -translate-x-1/2" />

                  {/* Photo Container */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-stone-900 shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.image_url}
                      alt={photo.caption || 'Photo du Mur'}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1000&auto=format&fit=crop'
                      }}
                    />

                    {/* Owner Badge */}
                    {isMyPhoto && (
                      <div className="absolute top-2 left-2 z-10">
                        <Badge className="text-[10px] px-2 py-0.5 shadow-md flex items-center gap-1 bg-amber-500 text-stone-950 font-bold border-none">
                          <UserCheck className="h-3 w-3" /> Ma photo
                        </Badge>
                      </div>
                    )}

                    {/* Hover Quick Actions */}
                    <div className="absolute inset-0 bg-stone-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        onClick={(e) => handleDownloadPhoto(photo.image_url, photo.id, e)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors shadow-lg"
                        title="Télécharger la photo"
                      >
                        <Download className="h-4 w-4 font-bold" />
                      </button>

                      {/* Owner Delete Button (Only visible for photo owner!) */}
                      {isMyPhoto && (
                        <button
                          onClick={(e) => handleDeleteMyPhoto(photo.id, e)}
                          disabled={deletingId === photo.id}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-lg"
                          title="Supprimer ma photo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}

                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900/90 text-stone-200">
                        <Maximize2 className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  {/* Caption & Timestamp Footer */}
                  <div className="mt-2.5 px-1 text-center">
                    <p className="font-handwriting font-bold text-amber-950 dark:text-amber-100 text-base sm:text-lg leading-tight truncate">
                      {photo.caption || 'Souvenir Photo ✨'}
                    </p>
                    <p className="text-[10px] font-medium text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1 mt-0.5">
                      <Calendar className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                      {new Date(photo.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Lightbox Modal Preview */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl border-amber-900/40 bg-stone-950 p-3 sm:p-6 text-stone-100">
          <DialogHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-900/30 pb-4">
            <div>
              <DialogTitle className="font-handwriting text-2xl sm:text-3xl text-amber-100 font-bold">
                {selectedPhoto?.caption || 'Photo du Mur'}
              </DialogTitle>
              <p className="text-xs text-stone-400 flex items-center gap-1.5 mt-1">
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                Publiée le {selectedPhoto && new Date(selectedPhoto.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {selectedPhoto && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-900/50 bg-stone-900 text-amber-200 hover:bg-stone-800 text-xs"
                  onClick={() => handleDownloadPhoto(selectedPhoto.image_url, selectedPhoto.id)}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" /> Télécharger
                </Button>

                {uploaderToken && selectedPhoto.uploader_token === uploaderToken && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs"
                    disabled={deletingId === selectedPhoto.id}
                    onClick={() => handleDeleteMyPhoto(selectedPhoto.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Supprimer ma photo
                  </Button>
                )}
              </div>
            )}
          </DialogHeader>

          {selectedPhoto && (
            <div className="relative max-h-[75vh] w-full overflow-hidden rounded-xl bg-black flex items-center justify-center p-2 mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.image_url}
                alt="Agrandissement photo"
                className="max-h-[70vh] w-full object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mini Video Modal */}
      <MiniVideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        photos={photos}
      />
    </div>
  )
}
