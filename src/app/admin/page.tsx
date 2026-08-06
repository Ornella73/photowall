'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, LogOut, Eye, EyeOff, Trash2, Lock, Mail, RefreshCcw, Loader2, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { Photo, PhotoStatus } from '@/types/database.types'
import { User } from '@supabase/supabase-js'
import { getAllAdminPhotos, updatePhotoStatus, deletePhotoPermanently, isSupabaseConfigured, downloadPhoto } from '@/lib/photos-service'

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  
  // Login Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Photos state
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const supabase = createClient()

  // Fetch all photos (including deleted ones for admin view)
  const fetchAdminPhotos = useCallback(async () => {
    setPhotosLoading(true)
    try {
      const data = await getAllAdminPhotos()
      setPhotos(data)
    } catch (err) {
      console.error('Error fetching admin photos:', err)
    } finally {
      setPhotosLoading(false)
    }
  }, [])

  // Check current session
  useEffect(() => {
    const checkUser = async () => {
      if (isSupabaseConfigured()) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          setUser(user)
          if (user) fetchAdminPhotos()
        } catch {
          // Ignore network error on auth check
        }
      } else {
        // Local demo mode check
        const storedAdmin = localStorage.getItem('photowall_demo_admin_user')
        if (storedAdmin) {
          try {
            setUser(JSON.parse(storedAdmin))
            fetchAdminPhotos()
          } catch {
            // invalid session json
          }
        }
      }
      setLoadingAuth(false)
    }

    checkUser()
  }, [supabase.auth, fetchAdminPhotos])

  // Handle Admin Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setAuthError(null)

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setAuthError(error.message || 'Identifiants invalides.')
          setLoginLoading(false)
        } else {
          setUser(data.user)
          setLoginLoading(false)
          fetchAdminPhotos()
        }
      } catch {
        setAuthError('Erreur de connexion Réseau Supabase.')
        setLoginLoading(false)
      }
    } else {
      // Local/Demo Mode Login
      const demoUser = { id: 'demo-admin-id', email: email || 'admin@example.com' } as User
      localStorage.setItem('photowall_demo_admin_user', JSON.stringify(demoUser))
      setUser(demoUser)
      setLoginLoading(false)
      fetchAdminPhotos()
    }
  }

  // Handle Admin Logout
  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut()
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('photowall_demo_admin_user')
    setUser(null)
    setPhotos([])
  }

  // Toggle Photo Status (active <-> deleted)
  const togglePhotoStatusHandler = async (photoId: string, currentStatus: string) => {
    setActionLoadingId(photoId)
    const newStatus = (currentStatus === 'active' ? 'deleted' : 'active') as PhotoStatus
    const deletedAt = newStatus === 'deleted' ? new Date().toISOString() : null

    try {
      await updatePhotoStatus(photoId, newStatus)
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, status: newStatus, deleted_at: deletedAt } : p
        )
      )
    } catch {
      // ignore
    } finally {
      setActionLoadingId(null)
    }
  }

  // Hard Delete Photo
  const handleDeletePhotoPermanently = async (photoId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer définitivement cette photo ?')) return

    setActionLoadingId(photoId)
    try {
      await deletePhotoPermanently(photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch {
      // ignore
    } finally {
      setActionLoadingId(null)
    }
  }

  if (loadingAuth) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  // Mode Non Connecté : Formulaire de Connexion
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6 flex-1 flex flex-col justify-center">
        <Card className="border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-400 mb-3">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Espace Admin</CardTitle>
            <CardDescription>
              Connectez-vous avec vos identifiants Supabase Auth pour modérer le mur photo.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse Email Admin</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {authError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <Button type="submit" disabled={loginLoading} className="w-full h-11">
                {loginLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mode Connecté : Tableau de Bord Administrateur
  const activePhotos = photos.filter((p) => p.status === 'active')
  const deletedPhotos = photos.filter((p) => p.status === 'deleted')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex-1 flex flex-col space-y-8">
      {/* Top Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Tableau de Modération Admin</h1>
            <p className="text-xs text-slate-400">Connecté en tant que : {user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchAdminPhotos} disabled={photosLoading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${photosLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Total Photos</p>
            <p className="text-2xl font-bold text-white">{photos.length}</p>
          </div>
          <Badge variant="secondary">Total</Badge>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Photos Actives (En ligne)</p>
            <p className="text-2xl font-bold text-emerald-400">{activePhotos.length}</p>
          </div>
          <Badge variant="default">Actives</Badge>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Photos Masquées / Supprimées</p>
            <p className="text-2xl font-bold text-rose-400">{deletedPhotos.length}</p>
          </div>
          <Badge variant="destructive">Masquées</Badge>
        </Card>
      </div>

      {/* Main Moderation Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all">Toutes ({photos.length})</TabsTrigger>
          <TabsTrigger value="active">Actives ({activePhotos.length})</TabsTrigger>
          <TabsTrigger value="deleted">Masquées ({deletedPhotos.length})</TabsTrigger>
        </TabsList>

        {['all', 'active', 'deleted'].map((tabKey) => {
          const displayed =
            tabKey === 'all'
              ? photos
              : tabKey === 'active'
              ? activePhotos
              : deletedPhotos

          return (
            <TabsContent key={tabKey} value={tabKey} className="pt-4">
              {displayed.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-400">
                  Aucune photo dans cette catégorie.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {displayed.map((photo) => (
                    <Card key={photo.id} className="overflow-hidden p-0 border-slate-800 bg-slate-900/80">
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.image_url}
                          alt="Moderation thumbnail"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2 right-2">
                          <Badge variant={photo.status === 'active' ? 'default' : 'destructive'}>
                            {photo.status === 'active' ? 'En ligne' : 'Masquée'}
                          </Badge>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <p className="text-xs text-slate-400">
                          {new Date(photo.created_at).toLocaleString('fr-FR')}
                        </p>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <Button
                            variant={photo.status === 'active' ? 'outline' : 'secondary'}
                            size="sm"
                            className="flex-1 text-xs"
                            disabled={actionLoadingId === photo.id}
                            onClick={() => togglePhotoStatusHandler(photo.id, photo.status)}
                          >
                            {photo.status === 'active' ? (
                              <>
                                <EyeOff className="mr-1.5 h-3.5 w-3.5 text-rose-400" /> Masquer
                              </>
                            ) : (
                              <>
                                <Eye className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> Restaurer
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => downloadPhoto(photo.image_url, photo.id)}
                            title="Télécharger l'image"
                            className="border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="destructive"
                            size="icon"
                            disabled={actionLoadingId === photo.id}
                            onClick={() => handleDeletePhotoPermanently(photo.id)}
                            title="Supprimer définitivement"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
