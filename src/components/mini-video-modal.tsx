'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, SkipForward, SkipBack, Maximize2, Minimize2, Volume2, VolumeX, X, Download, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Photo } from '@/types/database.types'
import { downloadPhoto } from '@/lib/photos-service'

interface MiniVideoModalProps {
  isOpen: boolean
  onClose: () => void
  photos: Photo[]
}

export function MiniVideoModal({ isOpen, onClose, photos }: MiniVideoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState<number>(3500) // ms per slide
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const activePhotos = photos.filter((p) => p.status === 'active')

  // Ambient sound synthesis via Web Audio API
  const playCozyChime = useCallback(() => {
    if (!audioEnabled) return
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      const freqs = [261.63, 329.63, 392.00, 523.25, 659.25]
      const freq = freqs[Math.floor(Math.random() * freqs.length)]

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)

      gain.gain.setValueAtTime(0.01, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 1.25)
    } catch {
      // Audio synth unsupported
    }
  }, [audioEnabled])

  // Timer loop for slideshow video playback
  useEffect(() => {
    if (!isOpen || !isPlaying || activePhotos.length === 0) return

    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activePhotos.length)
      playCozyChime()
    }, speed)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isOpen, isPlaying, currentIndex, speed, activePhotos.length, playCozyChime])

  // Reset index when opening modal
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0)
      setIsPlaying(true)
    }
  }, [isOpen])

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const currentPhoto = activePhotos[currentIndex]

  if (!isOpen || activePhotos.length === 0) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border-amber-900/40 bg-stone-950 p-0 overflow-hidden shadow-2xl">
        <div
          ref={containerRef}
          className="relative flex flex-col items-center justify-center bg-black min-h-[500px] sm:min-h-[600px] w-full overflow-hidden select-none"
        >
          {/* Top Bar Header */}
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4">
            <div className="flex items-center gap-2 text-amber-200">
              <Film className="h-5 w-5 text-amber-400 animate-pulse" />
              <span className="font-bold text-sm tracking-wide">Mini Film PhotoWall</span>
              <span className="text-xs text-amber-400/70 font-mono">
                ({currentIndex + 1} / {activePhotos.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-stone-300 hover:text-amber-300 hover:bg-stone-800/60"
                onClick={() => setAudioEnabled(!audioEnabled)}
                title={audioEnabled ? 'Désactiver les sons' : 'Activer les sons ambiance'}
              >
                {audioEnabled ? <Volume2 className="h-4 w-4 text-amber-400" /> : <VolumeX className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-stone-300 hover:text-amber-300 hover:bg-stone-800/60"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-stone-300 hover:text-rose-400 hover:bg-stone-800/60"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Video Frame Animation Container */}
          <div className="relative w-full h-[450px] sm:h-[550px] flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              {currentPhoto && (
                <motion.div
                  key={currentPhoto.id}
                  initial={{ opacity: 0, scale: 1.08, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="relative w-full h-full flex items-center justify-center p-4 sm:p-8"
                >
                  {/* Blurred Background for aesthetic depth */}
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl transform scale-110"
                    style={{ backgroundImage: `url(${currentPhoto.image_url})` }}
                  />

                  {/* Polaroid Frame Container */}
                  <div className="relative z-10 max-h-full max-w-full p-3 sm:p-4 bg-amber-50/95 dark:bg-stone-900 rounded-2xl shadow-2xl border border-amber-200/40 flex flex-col items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentPhoto.image_url}
                      alt="Mini Film Frame"
                      className="max-h-[320px] sm:max-h-[400px] w-auto max-w-full object-contain rounded-lg shadow-md"
                    />

                    {/* Caption Overlay */}
                    <div className="mt-3 text-center px-2 max-w-md">
                      <p className="font-bold text-amber-950 dark:text-amber-100 text-sm sm:text-base font-handwriting text-lg leading-tight">
                        {currentPhoto.caption || 'Souvenir du Mur Photo ✨'}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                        {new Date(currentPhoto.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Progress Bar & Video Controls */}
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex flex-col gap-3">
            {/* Timeline Progress Bar */}
            <div className="flex items-center gap-1.5 w-full">
              {activePhotos.map((photo, idx) => (
                <div
                  key={photo.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1.5 flex-1 rounded-full cursor-pointer transition-all ${
                    idx === currentIndex
                      ? 'bg-amber-400 h-2 shadow-lg shadow-amber-500/50'
                      : idx < currentIndex
                      ? 'bg-amber-600/70'
                      : 'bg-stone-800'
                  }`}
                />
              ))}
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-stone-300 hover:text-white"
                  onClick={() => setCurrentIndex((prev) => (prev - 1 + activePhotos.length) % activePhotos.length)}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 shadow-md hover:scale-105"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause className="h-5 w-5 fill-stone-950" /> : <Play className="h-5 w-5 fill-stone-950 ml-0.5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-stone-300 hover:text-white"
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % activePhotos.length)}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              {/* Speed Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 hidden sm:inline">Vitesse:</span>
                <div className="flex rounded-lg bg-stone-900 p-1 border border-stone-800">
                  <button
                    onClick={() => setSpeed(5000)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                      speed === 5000 ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                    }`}
                  >
                    Lente (5s)
                  </button>
                  <button
                    onClick={() => setSpeed(3500)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                      speed === 3500 ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                    }`}
                  >
                    Normal (3.5s)
                  </button>
                  <button
                    onClick={() => setSpeed(2000)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                      speed === 2000 ? 'bg-amber-500 text-stone-950' : 'text-stone-400'
                    }`}
                  >
                    Rapide (2s)
                  </button>
                </div>

                {currentPhoto && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-900/50 bg-stone-900 text-amber-200 hover:bg-stone-800 text-xs hidden sm:flex items-center gap-1.5"
                    onClick={() => downloadPhoto(currentPhoto.image_url, currentPhoto.id)}
                  >
                    <Download className="h-3.5 w-3.5" /> Fichier
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
