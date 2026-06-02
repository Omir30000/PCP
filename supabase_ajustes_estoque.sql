-- ==========================================
-- TABELA DE AJUSTES MANUAIS DE ESTOQUE FÍSICO
-- ==========================================
-- Permite ao usuário informar o estoque real de cada SKU,
-- sobrescrevendo o saldo lógico calculado (produção - pedidos).
-- Execute no Editor SQL do Supabase.

CREATE TABLE IF NOT EXISTS ajustes_estoque (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade_real NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT DEFAULT '',
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Garante apenas um ajuste por produto (upsert pelo produto_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ajustes_estoque_produto ON ajustes_estoque(produto_id);

-- RLS
ALTER TABLE ajustes_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para todos" ON ajustes_estoque;
CREATE POLICY "Permitir tudo para todos" ON ajustes_estoque
  USING (true)
  WITH CHECK (true);
