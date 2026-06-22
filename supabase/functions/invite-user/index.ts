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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const { data: appUser, error: appUserError } = await supabaseAdmin
      .from('app_users')
      .select('role, status')
      .eq('user_id', user.id)
      .single()

    if (
      appUserError ||
      !appUser ||
      appUser.role !== 'super_admin' ||
      appUser.status !== 'approved'
    ) {
      return json({ error: 'Only super admins can invite users' }, 403)
    }

    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const redirectTo =
      typeof body.redirectTo === 'string' ? body.redirectTo.trim() : undefined

    if (!email) {
      return json({ error: 'Email is required' }, 400)
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          invited_by_admin: true,
          invited_by: user.id,
        },
        redirectTo,
      }
    )

    if (error) {
      return json({ error: error.message }, 400)
    }

    if (data.user?.id) {
      await supabaseAdmin.from('app_users').upsert(
        {
          user_id: data.user.id,
          email,
          status: 'approved',
          role: 'user',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        },
        { onConflict: 'user_id' }
      )

      const { data: enterprise } = await supabaseAdmin
        .from('enterprises')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (enterprise?.id) {
        await supabaseAdmin.from('enterprise_members').upsert(
          {
            enterprise_id: enterprise.id,
            user_id: data.user.id,
            role: 'editor',
          },
          { onConflict: 'enterprise_id,user_id', ignoreDuplicates: true }
        )
      }
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
