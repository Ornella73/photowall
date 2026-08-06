'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Link as LinkIcon, Image as ImageIcon, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getUploaderToken } from '@/lib/uploader-token'
import { addPhoto } from '@/lib/photos-service'

export default function UploadPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file')
  const [imageUrl, setImageUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Handle file selection & preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.type.startsWith('image/')) {
        setError('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).')
        return
      }
      setError(null)
      setFile(selectedFile)
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

      if (activeTab === 'file' && !file) {
        throw new Error('Veuillez sélectionner un fichier image.')
      }

      if (activeTab === 'url' && !imageUrl.trim()) {
        throw new Error('Veuillez fournir une URL d\'image valide.')
      }

      await addPhoto({
        imageUrl: imageUrl.trim(),
        file: activeTab === 'file' ? file : null,
        uploaderToken,
      })

      setSuccess(true)
      setTimeout(() => {
        router.push('/wall')
      }, 1200)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors de l\'envoi.'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center mb-8 space-y-3">
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
          Ajouter une <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Photo</span>
        </h1>
        <p className="text-slate-400">
          Publiez une photo pour l&apos;afficher instantanément sur le mur interactif.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-violet-400" />
            Choisissez le mode d&apos;envoi
          </CardTitle>
          <CardDescription>
            Importez un fichier depuis votre appareil ou renseignez l&apos;URL directe d&apos;une image.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="file" onValueChange={(val) => setActiveTab(val as 'file' | 'url')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Fichier Image
                </TabsTrigger>
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" /> URL Web
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4 pt-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl p-8 text-center bg-slate-950/50 hover:border-violet-500/50 transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer space-y-3 flex flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-400">
                      <Upload className="h-7 w-7" />
                    </div>
                    <span className="text-sm font-semibold text-slate-200">
                      {file ? file.name : 'Glissez-déposez votre image ici, ou cliquez pour parcourir'}
                    </span>
                    <span className="text-xs text-slate-500">Formats supportés : PNG, JPG, WebP (Max 10 Mo)</span>
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="url" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="image-url">Lien / URL de l&apos;image</Label>
                  <Input
                    id="image-url"
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value)
                      setPreviewUrl(e.target.value)
                    }}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Live Preview */}
            {previewUrl && (
              <div className="space-y-2">
                <Label>Prévisualisation</Label>
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Prévisualisation"
                    className="max-h-80 w-full object-contain"
                  />
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
                <span>Photo publiée avec succès ! Redirection vers le mur...</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (!previewUrl && !imageUrl)}
              className="w-full h-12 text-base font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Publication en cours...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Publier sur le Mur
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
