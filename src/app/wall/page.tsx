'use client'

import { useEffect, useState } from 'react'
import { Image as ImageIcon, Calendar, Maximize2, Sparkles, Wifi, WifiOff, Trash2, UserCheck, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Photo } from '@/types/database.types'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { getUploaderToken } from '@/lib/uploader-token'
import { getActivePhotos, updatePhotoStatus, isSupabaseConfigured, downloadPhoto } from '@/lib/photos-service'

export default function WallPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING')
  const [notification, setNotification] = useState<string | null>(null)
  const [uploaderToken, setUploaderToken] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => {
      setNotification((current) => (current === msg ? null : current))
    }, 4000)
  }

  // Handle downloading photo
  const handleDownloadPhoto = async (imageUrl: string, photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    showNotification('📥 Téléchargement de la photo en cours...')
    await downloadPhoto(imageUrl, photoId)
  }

  // Initialize uploader token from localStorage
  useEffect(() => {
    setUploaderToken(getUploaderToken())
  }, [])

  // Handle owner self-deletion
  const handleDeleteMyPhoto = async (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm('Voulez-vous vraiment supprimer votre photo du mur ?')) return

    setDeletingId(photoId)

    try {
      await updatePhotoStatus(photoId, 'deleted', uploaderToken)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      setSelectedPhoto(null)
      showNotification('🗑️ Votre photo a été retirée du mur.')
    } catch {
      showNotification('❌ Erreur lors de la suppression.')
    } finally {
      setDeletingId(null)
    }
  }

  // Fetch initial photos and set up subscriptions
  useEffect(() => {
    const loadPhotos = async () => {
      try {
        const data = await getActivePhotos()
        setPhotos(data)
      } catch (err) {
        console.error('Error fetching photos:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPhotos()

    // Setup Local Storage & BroadcastChannel listeners
    const handleLocalUpdate = async () => {
      const updated = await getActivePhotos()
      setPhotos(updated)
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
      window.removeEventListener('photowall_local_update', handleLocalUpdate)
      window.removeEventListener('storage', handleLocalUpdate)
      if (broadcastChannel) broadcastChannel.close()
      if (supabaseChannel) {
        const supabase = createClient()
        supabase.removeChannel(supabaseChannel)
      }
    }
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 flex flex-col relative">
      {/* Realtime Toast Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 z-50 flex items-center gap-3 rounded-2xl border border-violet-500/40 bg-slate-900/95 px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-xl"
          >
            <Sparkles className="h-4 w-4 text-violet-400 animate-spin" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
              Mur Photo <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Live</span>
            </h1>

            {/* Connection Status Badge */}
            {connectionStatus === 'CONNECTED' ? (
              <Badge variant="violet" className="flex items-center gap-1.5 px-3 py-1 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="h-3 w-3 mr-1" />
                Realtime Connecté
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1 text-xs text-amber-400 border-amber-500/30">
                <WifiOff className="h-3 w-3 mr-1" />
                {connectionStatus === 'CONNECTING' ? 'Connexion Live...' : 'Reconnexion...'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Mises à jour et apparitions instantanées en direct sans rafraîchissement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs text-slate-300 bg-slate-900/60 px-3 py-1.5 border-slate-800">
            {photos.length} photo{photos.length > 1 ? 's' : ''} en ligne
          </Badge>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-slate-900/80 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        /* Empty Wall State */
        <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center my-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-400 mb-4">
            <ImageIcon className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Le mur photo est prêt et à l&apos;écoute</h3>
          <p className="text-slate-400 max-w-sm mb-6">
            Ajoutez une photo depuis la page d&apos;envoi, elle s&apos;affichera ici en temps réel !
          </p>
          <Button asChild>
            <a href="/upload">Ajouter une photo</a>
          </Button>
        </div>
      ) : (
        /* Grid with Owner Deletion support */
        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6"
        >
          <AnimatePresence mode="popLayout">
            {photos.map((photo) => {
              const isMyPhoto = Boolean(uploaderToken && photo.uploader_token === uploaderToken)

              return (
                <motion.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.7, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6, y: -20 }}
                  transition={{
                    layout: { type: 'spring', stiffness: 350, damping: 25 },
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.3 },
                  }}
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-xl backdrop-blur-md cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:border-violet-500/50 hover:shadow-violet-500/25"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.image_url}
                    alt="Photo du Mur"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Owner badge */}
                  {isMyPhoto && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge variant="violet" className="text-[10px] px-2 py-0.5 shadow-lg flex items-center gap-1 backdrop-blur-md bg-violet-600/80 text-white border-none">
                        <UserCheck className="h-3 w-3" /> Ma photo
                      </Badge>
                    </div>
                  )}

                  {/* Overlay hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 sm:p-4">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                      <Calendar className="h-3.5 w-3.5 text-violet-400" />
                      {new Date(photo.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleDownloadPhoto(photo.image_url, photo.id, e)}
                        className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-violet-600/90 text-white hover:bg-violet-700 transition-colors shadow-md"
                        title="Télécharger la photo"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      {isMyPhoto && (
                        <button
                          onClick={(e) => handleDeleteMyPhoto(photo.id, e)}
                          disabled={deletingId === photo.id}
                          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-rose-600/90 text-white hover:bg-rose-700 transition-colors shadow-md"
                          title="Supprimer ma photo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-slate-900/80 text-slate-200">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Lightbox Preview Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl border-slate-800 bg-slate-950 p-2 sm:p-4">
          <DialogHeader className="p-4 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-slate-200">
              <Calendar className="h-4 w-4 text-violet-400" />
              Publiée le {selectedPhoto && new Date(selectedPhoto.created_at).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </DialogTitle>

            {selectedPhoto && (
              <div className="flex items-center gap-2 mr-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200"
                  onClick={() => handleDownloadPhoto(selectedPhoto.image_url, selectedPhoto.id)}
                >
                  <Download className="mr-1.5 h-4 w-4 text-violet-400" /> Télécharger
                </Button>

                {uploaderToken && selectedPhoto.uploader_token === uploaderToken && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deletingId === selectedPhoto.id}
                    onClick={() => handleDeleteMyPhoto(selectedPhoto.id)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Supprimer ma photo
                  </Button>
                )}
              </div>
            )}
          </DialogHeader>

          {selectedPhoto && (
            <div className="relative aspect-auto max-h-[75vh] w-full overflow-hidden rounded-xl bg-slate-900 flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.image_url}
                alt="Agrandissement photo"
                className="max-h-[70vh] w-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
