
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Variáveis de ambiente VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas.');
    process.exit(1);
}

console.log('Testando conexão com:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        const { data, error } = await supabase.from('linhas').select('*').limit(1);
        if (error) {
            console.error('Erro na consulta:', error);
        } else {
            console.log('Conexão bem-sucedida! Dados encontrados:', data.length);
        }
    } catch (err) {
        console.error('Erro inesperado:', err);
    }
}

test();
