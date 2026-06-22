import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { fetchMyAppUser } from '@/services/users'
import type { AppUser } from '@/types/database'

interface AuthContextValue {
  user: User | null
  session: Session | null
  appUser: AppUser | null
  loading: boolean
  profileLoading: boolean
  isApproved: boolean
  isSuperAdmin: boolean
  refreshAppUser: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadAppUserProfile(): Promise<AppUser | null> {
  try {
    return await fetchMyAppUser()
  } catch {
    return null
  }
}

function assertCanAccessApp(profile: AppUser | null): void {
  if (!profile) {
    throw new Error('Account profile not found. Contact your administrator.')
  }
  if (profile.status === 'pending') {
    throw new Error('Your account is pending approval by an administrator.')
  }
  if (profile.status === 'rejected') {
    throw new Error('Your account registration was not approved.')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const refreshAppUser = useCallback(async () => {
    if (!user) {
      setAppUser(null)
      return
    }
    setProfileLoading(true)
    try {
      const profile = await loadAppUserProfile()
      setAppUser(profile)
    } finally {
      setProfileLoading(false)
    }
  }, [user])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user) {
        setProfileLoading(true)
        const profile = await loadAppUserProfile()
        if (!mounted) return
        setAppUser(profile)
        setProfileLoading(false)

        if (profile && profile.status !== 'approved') {
          await supabase.auth.signOut()
          if (!mounted) return
          setSession(null)
          setUser(null)
          setAppUser(null)
        }
      }
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user) {
        setProfileLoading(true)
        const profile = await loadAppUserProfile()
        setAppUser(profile)
        setProfileLoading(false)

        if (profile && profile.status !== 'approved') {
          await supabase.auth.signOut()
          setSession(null)
          setUser(null)
          setAppUser(null)
        }
      } else {
        setAppUser(null)
        setProfileLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error

    const profile = await loadAppUserProfile()
    try {
      assertCanAccessApp(profile)
      setAppUser(profile)
    } catch (accessError) {
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setAppUser(null)
      throw accessError
    }
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    if (data.session) {
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setAppUser(null)
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setAppUser(null)
  }

  const isApproved = appUser?.status === 'approved'
  const isSuperAdmin =
    appUser?.status === 'approved' && appUser.role === 'super_admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        appUser,
        loading,
        profileLoading,
        isApproved,
        isSuperAdmin,
        refreshAppUser,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
