-- ==========================================
-- TABELA DADOS POCOS (MONITORAMENTO DE POÇO ARTESIANO)
-- ==========================================
-- Execute no Editor SQL do Supabase.
-- Base original: dados_poco_antigo_1.xlsx (4558 registros)

CREATE TABLE IF NOT EXISTS dados_poco (
  id BIGSERIAL PRIMARY KEY,
  data_registro DATE NOT NULL,
  hora_registro TIME NOT NULL,
  condutividade_us_cm NUMERIC,        -- CONDUT. µS/CM
  nivel_dinamico_m NUMERIC,            -- NV DINAMICO (M)
  nivel_estatico_m NUMERIC,            -- NV ESTATICO (M)
  ph NUMERIC,                          -- PH
  temperatura_c NUMERIC,               -- TEMPERATURA °C
  vazao_instantanea NUMERIC,           -- VAZÃO INSTANT.
  volume_acumulado NUMERIC,            -- VOLUME ACUMULADO
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (data_registro, hora_registro)
);

-- Habilitar RLS (Segurança)
ALTER TABLE dados_poco ENABLE ROW LEVEL SECURITY;

-- Política de acesso total (padrão Nexus PCP)
DROP POLICY IF EXISTS "Acesso Total Dados Poco" ON dados_poco;
CREATE POLICY "Acesso Total Dados Poco" ON dados_poco
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para consultas por período
CREATE INDEX IF NOT EXISTS idx_dados_poco_data ON dados_poco (data_registro);
CREATE INDEX IF NOT EXISTS idx_dados_poco_data_hora ON dados_poco (data_registro, hora_registro);

-- Confirmação
SELECT 'Tabela dados_poco criada com sucesso!' as status;