import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
)

async function test() {
  const { data, error } = await supabase.from('projects').insert({
    topic: 'test',
    user_id: 'bc9db6f4-fe3d-49d7-bf41-e94f85e485ea', 
    status: 'draft'
  }).select()
  console.log('Error object:', JSON.stringify(error, null, 2))
  console.log('Data object:', data)
}
test()
