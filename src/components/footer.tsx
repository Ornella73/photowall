import { Camera } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/80 py-8 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
              <Camera className="h-4 w-4" />
            </div>
            <span className="font-bold text-white">PhotoWall</span>
            <span className="text-sm text-slate-500">— Mur Photo Temps Réel</span>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            Propulsé par Next.js 15 & Supabase
          </p>
        </div>
      </div>
    </footer>
  )
}
