import Link from 'next/link'
import { Sparkles, Camera, Film, ArrowRight, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { Photo } from '@/types/database.types'

import fs from 'fs'
import path from 'path'

import { isSupabaseConfigured } from '@/lib/photos-service'

export const revalidate = 0

export default async function HomePage() {
  let photos: Photo[] | null = null

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('photos')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(6)

      photos = data
    } catch {
      photos = null
    }
  }

  // Fallback to shared server data store
  if (!photos || photos.length === 0) {
    try {
      const storePath = path.join(process.cwd(), 'data', 'photos_store.json')
      if (fs.existsSync(storePath)) {
        const raw = fs.readFileSync(storePath, 'utf-8')
        const parsed = JSON.parse(raw) as Photo[]
        photos = parsed
          .filter((p) => p.status === 'active')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 6)
      }
    } catch {
      photos = null
    }
  }

  return (
    <div className="relative overflow-hidden pb-24 sm:pb-16">
      {/* Warm Ambient Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-amber-600/20 via-orange-600/15 to-amber-700/10 blur-[130px]" />

      {/* Hero Section */}
      <section className="relative px-4 pt-16 pb-12 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Badge className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border-amber-500/30 backdrop-blur-md">
            <Sparkles className="mr-2 h-3.5 w-3.5 text-amber-400" />
            Mur Photo Souvenirs Temps Réel
          </Badge>

          <h1 className="text-4xl font-black tracking-tight text-amber-50 sm:text-6xl lg:text-7xl">
            Immortalisez vos plus beaux moments sur le{' '}
            <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
              Mur Interactif
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-xl text-stone-300">
            Prenez ou partagez vos photos en direct et regardez-les apparaître instantanément sur l’écran géant du mur photo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" asChild className="w-full sm:w-auto bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-stone-950 font-extrabold shadow-lg shadow-amber-900/40 hover:brightness-110">
              <Link href="/upload">
                <Camera className="mr-2 h-5 w-5" />
                Poster une Photo
              </Link>
            </Button>

            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto border-amber-900/50 bg-stone-900/80 text-amber-200 hover:bg-stone-800">
              <Link href="/wall">
                <Sparkles className="mr-2 h-5 w-5 text-amber-400" />
                Découvrir le Mur Live
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Polaroid Preview Section */}
      {photos && photos.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-amber-100">Derniers souvenirs partagés</h2>
              <p className="text-xs text-stone-400">Mises à jour instantanées sur le mur</p>
            </div>
            <Button variant="ghost" asChild className="text-amber-400 hover:text-amber-300 hover:bg-stone-900">
              <Link href="/wall">
                Voir toutes les photos <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {photos.map((photo, i) => {
              const tiltAngles = [-1, 1.2, -0.8, 1, -1.5, 0.9]
              const tilt = tiltAngles[i % tiltAngles.length]

              return (
                <div
                  key={photo.id}
                  style={{ transform: `rotate(${tilt}deg)` }}
                  className="polaroid-card p-2 rounded-xl shadow-lg transition-transform duration-300 hover:scale-105 hover:rotate-0"
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-stone-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.image_url}
                      alt={photo.caption || 'Photo Wall'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-2 text-center px-1">
                    <p className="font-handwriting font-bold text-amber-950 dark:text-amber-100 text-sm truncate">
                      {photo.caption || 'Moment partagé'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="border-amber-900/40 bg-stone-900/60 p-6 backdrop-blur-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 mb-4">
              <Camera className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-amber-100 mb-2">Capture Caméra & Légendes</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Prenez des photos en direct depuis l&apos;appareil de votre smartphone et personnalisez-les avec une petite légende.
            </p>
          </Card>

          <Card className="border-amber-900/40 bg-stone-900/60 p-6 backdrop-blur-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 mb-4">
              <Film className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-amber-100 mb-2">Mini Film & Diaporama</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Regardez un défilé animé style film vidéo de toutes les photos du mur avec musique d&apos;ambiance et plein écran.
            </p>
          </Card>

          <Card className="border-amber-900/40 bg-stone-900/60 p-6 backdrop-blur-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 mb-4">
              <Archive className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-amber-100 mb-2">Téléchargement Album ZIP</h3>
            <p className="text-xs text-stone-400 leading-relaxed">
              Téléchargez vos souvenirs un à un ou sauvegardez l&apos;intégralité du mur sous forme d&apos;album ZIP complet.
            </p>
          </Card>
        </div>
      </section>
    </div>
  )
}
