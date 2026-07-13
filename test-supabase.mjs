// test-supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://govpqfkilmfzicyxwdrn.supabase.co';
const supabaseAnonKey = 'sb_publishable_pGQ2bvFph9eCX0vCnFqEjw_uuZEX15v';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase
    .from('products')
    .select('*');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Datos:', data);
  }
}

test();