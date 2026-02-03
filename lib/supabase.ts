
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// Credenciais Nexus PCP Atualizadas
// Credenciais Nexus PCP Atualizadas
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Inicialização do cliente Supabase.
 * Configurado com persistência de sessão e auto-refresh para garantir 
 * que o cabeçalho de autorização seja mantido durante a navegação.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

console.log('Nexus Connectivity: Sistema operando em', supabaseUrl);
