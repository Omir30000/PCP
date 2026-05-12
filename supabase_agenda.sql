-- Tabela de Agenda de Contatos Nexus
CREATE TABLE IF NOT EXISTS contatos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  apelido TEXT,
  telefone TEXT NOT NULL,
  email TEXT,
  categoria TEXT DEFAULT 'Geral', -- Exemplos: Manutenção, Fornecedor, Operador, Diretoria
  observacoes TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Segurança)
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso total para usuários autenticados (ajuste conforme necessário)
CREATE POLICY "Acesso total para usuários autenticados" ON contatos
  FOR ALL USING (auth.role() = 'authenticated');

-- Gatilho para atualizar o updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contatos_updated_at
    BEFORE UPDATE ON contatos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
