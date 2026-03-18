import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function test() {
  const { error } = await supabase.from('projects').insert({
    topic: 'test',
    user_id: 'bc9db6f4-fe3d-49d7-bf41-e94f85e485ea', // placeholder
    status: 'draft'
  }).select()
  console.log('Error:', error)
}
test()
