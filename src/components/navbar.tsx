'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, Upload, LayoutGrid, ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Accueil', icon: Sparkles },
  { href: '/wall', label: 'Mur Live', icon: LayoutGrid },
  { href: '/upload', label: 'Ajouter', icon: Upload },
  { href: '/admin', label: 'Admin', icon: ShieldCheck },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg shadow-violet-500/30 group-hover:scale-105 transition-transform">
            <Camera className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white">
            Photo<span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">Wall</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="flex items-center gap-1 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-1.5 backdrop-blur-md">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
