const { createClient } = require('@supabase/supabase-api');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
  const { data: prods } = await supabase.from('produtos').select('*').ilike('nome', '%Copo 200ml%');
  console.log('--- PRODUTOS ---');
  console.log(JSON.stringify(prods, null, 2));

  const { data: regs } = await supabase.from('registros_producao').select('id, data_registro, produto_id, capacidade_producao, produto_volume').order('data_registro', { ascending: false }).limit(5);
  console.log('--- REGISTROS ---');
  console.log(JSON.stringify(regs, null, 2));
}
check();
