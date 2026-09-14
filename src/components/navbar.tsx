'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, Upload, LayoutGrid, Home, PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/wall', label: 'Mur Live', icon: LayoutGrid },
  { href: '/upload', label: 'Ajouter Photo', icon: Upload },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-amber-900/30 bg-stone-950/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo - Always links to Home */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 shadow-lg shadow-amber-900/40 group-hover:scale-105 transition-transform">
              <Camera className="h-5 w-5 text-amber-950" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-amber-50 leading-tight">
                Photo<span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Wall</span>
              </span>
              <span className="text-[10px] font-semibold text-amber-400/80 -mt-1 hidden sm:inline">
                Mur Photo Souvenirs DIY
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-amber-900/40 bg-stone-900/70 p-1.5 backdrop-blur-md">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 shadow-md shadow-amber-600/30 font-bold'
                      : 'text-stone-300 hover:bg-stone-800/70 hover:text-amber-300'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Quick Upload CTA on Header Desktop */}
          <div className="hidden sm:block">
            <Link
              href="/upload"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-4 py-2 text-xs font-bold text-stone-950 shadow-md hover:brightness-110 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Poster une photo</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Thumb Friendly) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden border-t border-amber-900/40 bg-stone-950/95 backdrop-blur-xl py-2 px-6 shadow-2xl">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all',
                  isActive
                    ? 'text-amber-400 font-bold scale-105'
                    : 'text-stone-400 hover:text-stone-200'
                )}
              >
                <div
                  className={cn(
                    'p-1.5 rounded-xl transition-all',
                    isActive ? 'bg-amber-500/20 text-amber-400' : 'bg-transparent'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-medium tracking-tight">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
