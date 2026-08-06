import Link from 'next/link'
import { Sparkles, Camera, Zap, ShieldCheck, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export default async function HomePage() {
  let photos: Array<{ id: string; image_url: string; created_at: string }> | null = null

  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(4)

    photos = data
  } catch {
    photos = null
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-violet-600/20 via-indigo-600/20 to-purple-600/10 blur-[120px]" />

      {/* Hero Section */}
      <section className="relative px-4 pt-20 pb-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <Badge variant="violet" className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            <Sparkles className="mr-2 h-3.5 w-3.5 text-violet-400" />
            Expérience Photo Temps Réel
          </Badge>

          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Partagez vos moments sur le{' '}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Mur Photo Interactif
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-slate-300 sm:text-xl">
            Postez vos photos en un instant et observez-les apparaître en direct sur l’écran géant grâce à la puissance de Supabase Realtime.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" asChild className="w-full sm:w-auto shadow-violet-600/30">
              <Link href="/upload">
                <Camera className="mr-2 h-5 w-5" />
                Ajouter une Photo
              </Link>
            </Button>

            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/wall">
                <Sparkles className="mr-2 h-5 w-5 text-violet-400" />
                Voir le Mur Live
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Preview Section */}
      {photos && photos.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white">Dernières photos ajoutées</h2>
              <p className="text-sm text-slate-400">Directement synchronisées sur le mur</p>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/wall">
                Voir toutes ({photos.length}) <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-violet-500/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.image_url}
                  alt="Photo Wall"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-xs font-medium text-slate-200">
                    {new Date(photo.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <Card className="hover:border-violet-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 mb-6">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Supabase Realtime</h3>
            <p className="text-sm text-slate-400">
              Les nouvelles photos sont transmises en temps réel sans rechargement de page.
            </p>
          </Card>

          <Card className="hover:border-violet-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 mb-6">
              <Camera className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Upload Instantané</h3>
            <p className="text-sm text-slate-400">
              Uploadez une image par fichier local ou via une URL en un clic avec prévisualisation immédiate.
            </p>
          </Card>

          <Card className="hover:border-violet-500/40 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-6">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Modération Admin</h3>
            <p className="text-sm text-slate-400">
              Espace sécurisé pour masquer ou supprimer les images inappropriées avec Supabase Auth & RLS.
            </p>
          </Card>
        </div>
      </section>
    </div>
  )
}
