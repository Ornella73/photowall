'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App Error:', error)
  }, [error])

  return (
    <div className="mx-auto max-w-md px-4 py-20 flex-1 flex flex-col justify-center">
      <Card className="border-slate-800 bg-slate-900/90 text-center shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 mb-3">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Une erreur est survenue</CardTitle>
          <CardDescription>
            {error.message || "Une interruption s'est produite lors de l'exécution de la page."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-2">
          <Button onClick={() => reset()} className="w-full">
            <RefreshCcw className="mr-2 h-4 w-4" /> Réessayer
          </Button>

          <Button variant="outline" asChild className="w-full">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Retour à l&apos;accueil
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
