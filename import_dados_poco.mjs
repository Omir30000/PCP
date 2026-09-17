// Importa os dados do arquivo dados_poco.json para a tabela dados_poco
// Executar após criar a tabela no Supabase (supabase_dados_poco.sql):
//   npm run import:poco
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nwgpokljcfowkysuswot.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_K19QawgDiOeieEGIerN6Aw_pNpRjXHd';

const supabase = createClient(supabaseUrl, supabaseKey);

const dados = JSON.parse(readFileSync(join(__dirname, 'dados_poco.json'), 'utf-8'));
console.log(`Importando ${dados.length} registros...`);

const BATCH = 500;
let inseridos = 0;

for (let i = 0; i < dados.length; i += BATCH) {
  const lote = dados.slice(i, i + BATCH);
  const { data, error } = await supabase.from('dados_poco').insert(lote);
  if (error) {
    console.error(`Erro no lote ${i}:`, error.message);
    process.exit(1);
  }
  inseridos += lote.length;
  console.log(`${inseridos}/${dados.length} registros importados`);
}

console.log('Importação concluída com sucesso!');