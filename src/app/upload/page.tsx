'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Link as LinkIcon, Camera, RefreshCw, Sparkles, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Smartphone, Images } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getUploaderToken } from '@/lib/uploader-token'
import { addPhoto } from '@/lib/photos-service'

export default function UploadPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'camera' | 'gallery' | 'url'>('camera')
  const [imageUrl, setImageUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // WebCam Live Stream States for PC / WebRTC
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isWebcamActive, setIsWebcamActive] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const streamRef = useRef<MediaStream | null>(null)

  // Stop WebCam Stream
  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsWebcamActive(false)
  }, [])

  // Start WebCam Stream (PC)
  const startWebcam = useCallback(async (mode = facingMode) => {
    stopWebcam()
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setIsWebcamActive(true)
    } catch {
      setIsWebcamActive(false)
    }
  }, [facingMode, stopWebcam])

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    startWebcam(nextMode)
  }

  // WebCam snapshot capture (PC)
  const captureWebcamSnapshot = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 800
    canvas.height = video.videoHeight || 600
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      setPreviewUrl(dataUrl)

      canvas.toBlob((blob) => {
        if (blob) {
          const snapshotFile = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' })
          setFile(snapshotFile)
        }
      }, 'image/jpeg')

      stopWebcam()
    }
  }

  useEffect(() => {
    if (activeTab === 'camera' && !previewUrl) {
      startWebcam()
    } else {
      stopWebcam()
    }
    return () => stopWebcam()
  }, [activeTab, previewUrl, startWebcam, stopWebcam])

  // Handle native mobile camera / gallery photo selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setError('Veuillez sélectionner un fichier image valide.')
        return
      }
      setError(null)
      setFile(selectedFile)
      stopWebcam()
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setError(null)
      setFile(droppedFile)
      stopWebcam()
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(droppedFile)
    }
  }

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const uploaderToken = getUploaderToken()

      if (!previewUrl && !file && !imageUrl) {
        throw new Error('Veuillez prendre ou sélectionner une photo.')
      }

      await addPhoto({
        imageUrl: (activeTab === 'url' ? imageUrl.trim() : previewUrl) || '',
        file,
        caption: caption.trim(),
        uploaderToken,
      })

      stopWebcam()
      setSuccess(true)
      setTimeout(() => {
        router.push('/wall')
      }, 1000)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'envoi.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 pb-28 sm:pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
        <Link
          href="/wall"
          className="text-xs sm:text-sm font-bold text-stone-400 hover:text-amber-300 transition-colors"
        >
          Voir le mur live →
        </Link>
      </div>

      <div className="text-center mb-6 space-y-1.5">
        <h1 className="text-3xl font-black text-amber-50 sm:text-4xl">
          Poster sur le <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">PhotoWall</span>
        </h1>
        <p className="text-stone-400 text-xs sm:text-sm max-w-md mx-auto">
          Prenez une photo en direct avec votre téléphone ou choisissez un fichier de votre galerie.
        </p>
      </div>

      <Card className="border-amber-900/40 bg-stone-900/90 shadow-2xl backdrop-blur-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-amber-100 text-lg sm:text-xl">
            <Camera className="h-5 w-5 text-amber-400" />
            Méthode d&apos;envoi
          </CardTitle>
          <CardDescription className="text-stone-400 text-xs">
            Sélectionnez votre mode d&apos;ajout ci-dessous.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="camera" onValueChange={(val) => setActiveTab(val as 'camera' | 'gallery' | 'url')}>
              <TabsList className="grid w-full grid-cols-3 bg-stone-950 p-1 border border-stone-800 rounded-xl">
                <TabsTrigger value="camera" className="flex items-center gap-1 text-xs font-bold">
                  <Camera className="h-4 w-4 text-amber-400" /> 📷 Caméra
                </TabsTrigger>
                <TabsTrigger value="gallery" className="flex items-center gap-1 text-xs font-bold">
                  <Images className="h-4 w-4 text-amber-400" /> 🖼️ Galerie
                </TabsTrigger>
                <TabsTrigger value="url" className="flex items-center gap-1 text-xs font-bold">
                  <LinkIcon className="h-4 w-4 text-amber-400" /> 🔗 Lien
                </TabsTrigger>
              </TabsList>

              {/* Camera Tab (Mobile Native Camera + PC WebCam) */}
              <TabsContent value="camera" className="space-y-4 pt-4">
                {previewUrl && activeTab === 'camera' ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs font-bold text-amber-400">Photo capturée ! Prête à être publiée.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPreviewUrl(null)
                        setFile(null)
                        startWebcam()
                      }}
                      className="border-amber-900/50 bg-stone-950 text-amber-200 hover:bg-stone-800 text-xs"
                    >
                      <RefreshCw className="mr-2 h-4 w-4 text-amber-400" /> Reprendre une autre photo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Primary Native Smartphone Camera Trigger Button */}
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-amber-500/60 rounded-2xl bg-amber-500/10 text-center space-y-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-stone-950 shadow-lg shadow-amber-600/40">
                        <Smartphone className="h-8 w-8" />
                      </div>

                      <div>
                        <h4 className="text-base font-black text-amber-100">Caméra du Téléphone</h4>
                        <p className="text-xs text-stone-400 mt-1 max-w-xs">
                          Ouvre directement l&apos;appareil photo natif de votre smartphone pour prendre un cliché
                        </p>
                      </div>

                      <label className="cursor-pointer inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-8 py-3.5 text-base font-black text-stone-950 shadow-xl hover:scale-105 transition-transform active:scale-95">
                        <Camera className="h-5 w-5" />
                        <span>Prendre une photo 📸</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="hidden"
                          id="native-camera-input"
                        />
                      </label>
                    </div>

                    {/* PC WebCam Live Feed (If WebCam stream is active on desktop) */}
                    {isWebcamActive && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-amber-900/40 bg-black flex flex-col items-center justify-center mt-4 shadow-xl">
                        <video
                          ref={videoRef}
                          playsInline
                          muted
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-3">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            onClick={toggleCameraFacing}
                            className="h-10 w-10 rounded-full bg-stone-900/90 text-amber-300 border border-stone-700"
                            title="Changer de caméra"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            onClick={captureWebcamSnapshot}
                            className="h-12 w-12 rounded-full bg-amber-500 text-stone-950 font-bold shadow-lg hover:scale-105"
                          >
                            <Camera className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Gallery Tab */}
              <TabsContent value="gallery" className="space-y-4 pt-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-amber-900/50 rounded-2xl p-8 text-center bg-stone-950/60 hover:border-amber-500/50 transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="gallery-file-upload"
                  />
                  <label htmlFor="gallery-file-upload" className="cursor-pointer space-y-3 flex flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                      <Upload className="h-7 w-7" />
                    </div>
                    <span className="text-sm font-semibold text-stone-200">
                      {file ? file.name : 'Choisir une photo depuis la galerie ou vos dossiers'}
                    </span>
                    <span className="text-xs text-stone-500">Formats : PNG, JPG, WebP</span>
                  </label>
                </div>
              </TabsContent>

              {/* Web URL Tab */}
              <TabsContent value="url" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="image-url" className="text-stone-300 text-xs font-bold">Lien / URL de l&apos;image</Label>
                  <Input
                    id="image-url"
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value)
                      setPreviewUrl(e.target.value)
                    }}
                    className="border-amber-900/40 bg-stone-950 text-stone-100 text-sm"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Polaroid Preview & Optional Caption Input */}
            {previewUrl && (
              <div className="space-y-4 pt-2 border-t border-amber-900/30">
                <div className="space-y-2">
                  <Label htmlFor="caption-input" className="text-amber-200 font-bold text-sm flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    Ajouter une légende / description (Optionnel)
                  </Label>
                  <Input
                    id="caption-input"
                    type="text"
                    placeholder="Ex: Souvenir de la soirée ✨"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={100}
                    className="border-amber-900/50 bg-stone-950 text-amber-100 placeholder:text-stone-500"
                  />
                </div>

                {/* Aesthetic Polaroid Preview Card */}
                <div className="space-y-2">
                  <Label className="text-xs text-stone-400">Aperçu style Polaroid sur le mur</Label>
                  <div className="flex justify-center p-4 bg-stone-950/80 rounded-2xl border border-stone-800">
                    <div className="polaroid-card p-3 rounded-xl max-w-xs w-full shadow-2xl transform rotate-1">
                      <div className="aspect-square w-full overflow-hidden rounded-lg bg-stone-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Prévisualisation"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="mt-3 text-center px-1">
                        <p className="font-handwriting text-xl text-amber-950 dark:text-amber-100 font-bold min-h-[28px]">
                          {caption || 'Votre souvenir...'}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-0.5">À l&apos;instant</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Photo publiée sur le mur avec succès ! Redirection...</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (!previewUrl && !imageUrl)}
              className="w-full h-12 text-base font-black bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-stone-950 shadow-lg shadow-amber-900/30 hover:brightness-110"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Publication sur le mur...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Publier sur le Mur Photo
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
