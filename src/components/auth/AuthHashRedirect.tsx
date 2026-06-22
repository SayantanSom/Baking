import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Sends Supabase auth hash callbacks (e.g. type=recovery) to the right route. */
export function AuthHashRedirect() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash === '#') return

    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
    const type = params.get('type')

    if (type === 'recovery' && location.pathname !== '/reset-password') {
      navigate(`/reset-password${hash}`, { replace: true })
    }
  }, [location.pathname, navigate])

  return null
}
