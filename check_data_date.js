
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const dataAlvo = '2026-02-10';
    try {
        const { data, error, count } = await supabase
            .from('registros_producao')
            .select('*', { count: 'exact' })
            .eq('data_registro', dataAlvo);

        if (error) {
            console.error('Erro na consulta:', error);
        } else {
            console.log(`Data: ${dataAlvo} | Registros encontrados: ${count}`);
            if (data.length > 0) {
                console.log('Primeiro registro:', data[0].id);
            }
        }
    } catch (err) {
        console.error('Erro inesperado:', err);
    }
}

test();
