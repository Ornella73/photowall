import Link from 'next/link'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 flex-1 flex flex-col justify-center">
      <Card className="border-slate-800 bg-slate-900/90 text-center shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 mb-3">
            <FileQuestion className="h-7 w-7" />
          </div>
          <CardTitle className="text-3xl font-extrabold text-white">404</CardTitle>
          <CardDescription>
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-2">
          <Button asChild className="w-full">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Retour à l&apos;accueil
            </Link>
          </Button>

          <Button variant="outline" asChild className="w-full">
            <Link href="/wall">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voir le Mur Live
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
