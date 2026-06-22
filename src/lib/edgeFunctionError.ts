import { FunctionsHttpError } from '@supabase/supabase-js'

export async function getEdgeFunctionErrorMessage(
  error: unknown,
  response?: Response
): Promise<string> {
  const res =
    response ??
    (error instanceof FunctionsHttpError ? (error.context as Response) : undefined)

  if (res) {
    try {
      const body = (await res.clone().json()) as { error?: string }
      if (body?.error) return body.error
    } catch {
      try {
        const text = await res.clone().text()
        if (text) return text
      } catch {
        /* ignore */
      }
    }
  }

  if (error instanceof Error) return error.message
  return 'Request failed'
}
