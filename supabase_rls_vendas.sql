-- ==========================================
-- POLÍTICAS RLS PARA TABELAS DO DASHBOARD VENDAS
-- ==========================================
-- Execute no Editor SQL do Supabase.

-- programacao_semanal
ALTER TABLE programacao_semanal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Prog Semanal" ON programacao_semanal;
CREATE POLICY "Acesso Total Prog Semanal" ON programacao_semanal FOR ALL USING (true) WITH CHECK (true);

-- pedidos
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Pedidos" ON pedidos;
CREATE POLICY "Acesso Total Pedidos" ON pedidos FOR ALL USING (true) WITH CHECK (true);

-- itens_pedido
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Itens Pedido" ON itens_pedido;
CREATE POLICY "Acesso Total Itens Pedido" ON itens_pedido FOR ALL USING (true) WITH CHECK (true);

-- ajustes_estoque (caso ainda não tenha)
ALTER TABLE ajustes_estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Total Ajustes Estoque" ON ajustes_estoque;
CREATE POLICY "Acesso Total Ajustes Estoque" ON ajustes_estoque FOR ALL USING (true) WITH CHECK (true);

-- Confirmação
SELECT 'RLS das tabelas de vendas configurado!' as status;
