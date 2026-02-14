-- ==========================================
-- SCRIPT DE REDEFINIÇÃO DE RLS (ROW LEVEL SECURITY)
-- ==========================================
-- Este script remove todas as políticas de segurança existentes nas tabelas principais
-- e cria novas políticas permissivas para garantir que o aplicativo funcione corretamente.
-- Execute este script no Editor SQL do seu projeto no Supabase.

-- 1. Habilitar RLS (caso não esteja) nas tabelas principais
ALTER TABLE registros_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE paradas ENABLE ROW LEVEL SECURITY; -- Se existir como tabela independente
ALTER TABLE linhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas para evitar conflitos
-- (O comando DROP POLICY IF EXISTS garante que não dê erro se a política não existir)

DROP POLICY IF EXISTS "Permitir leitura para todos" ON registros_producao;
DROP POLICY IF EXISTS "Permitir inserção para todos" ON registros_producao;
DROP POLICY IF EXISTS "Permitir atualização para todos" ON registros_producao;
DROP POLICY IF EXISTS "Permitir exclusão para todos" ON registros_producao;

DROP POLICY IF EXISTS "Permitir leitura para todos" ON linhas;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON produtos;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON maquinas;

-- 3. Criar NOVAS políticas PERMISSIVAS (Públicas)
-- ATENÇÃO: Estas políticas permitem que qualquer usuário (autenticado ou anônimo com a chave correta) leia e modifique os dados.
-- Ideal para desenvolvimento ou apps internos onde o controle de acesso é feito na aplicação.

-- Tabela: registros_producao
CREATE POLICY "Acesso Total Registros"
ON registros_producao
FOR ALL
USING (true)
WITH CHECK (true);

-- Tabela: linhas (Geralmente apenas leitura, mas vamos liberar tudo para garantir)
CREATE POLICY "Acesso Total Linhas"
ON linhas
FOR ALL
USING (true)
WITH CHECK (true);

-- Tabela: produtos
CREATE POLICY "Acesso Total Produtos"
ON produtos
FOR ALL
USING (true)
WITH CHECK (true);

-- Tabela: maquinas
CREATE POLICY "Acesso Total Maquinas"
ON maquinas
FOR ALL
USING (true)
WITH CHECK (true);

-- Confirmação
SELECT 'RLS reconfigurado com sucesso!' as status;
