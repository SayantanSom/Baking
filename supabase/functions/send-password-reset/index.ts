import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const redirectTo =
      typeof body.redirectTo === 'string' ? body.redirectTo.trim() : undefined

    if (!email) {
      return json({ error: 'Email is required' }, 400)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: appUser, error: appUserError } = await supabaseAdmin
      .from('app_users')
      .select('role, status, email')
      .eq('user_id', user.id)
      .single()

    if (appUserError || !appUser || appUser.status !== 'approved') {
      return json({ error: 'Account not approved' }, 403)
    }

    const isSelf = user.email?.toLowerCase() === email.toLowerCase()
    const isSuperAdmin = appUser.role === 'super_admin'

    if (!isSelf && !isSuperAdmin) {
      return json({ error: 'Only super admins can reset other users' }, 403)
    }

    const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        email,
        redirect_to: redirectTo,
      }),
    })

    if (!recoverRes.ok) {
      const errBody = await recoverRes.json().catch(() => ({}))
      const message =
        (errBody as { msg?: string; error_description?: string }).msg ||
        (errBody as { error_description?: string }).error_description ||
        'Failed to send password reset email'
      return json({ error: message }, 400)
    }

    return json({ success: true, email })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
