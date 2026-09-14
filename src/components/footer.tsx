import { Camera, Heart } from 'lucide-react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-amber-900/30 bg-stone-950/80 py-8 backdrop-blur-md pb-20 sm:pb-8">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Camera className="h-4 w-4" />
            </div>
            <span className="font-extrabold text-amber-100">PhotoWall</span>
            <span className="text-xs text-stone-400">— Mur Photo Souvenirs</span>
          </Link>

          <p className="flex items-center gap-1.5 text-xs text-stone-400">
            Fait avec <Heart className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> pour vos plus beaux moments
          </p>
        </div>
      </div>
    </footer>
  )
}
