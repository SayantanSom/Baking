export function authRedirectUrl(path: string): string {
  const basePath = import.meta.env.VITE_BASE_PATH ?? '/'
  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}${normalizedBase}${normalizedPath}`
}
