-- Tabela de permissões por papel (nivel_acesso)
-- Permite definir dinamicamente quais telas cada papel pode acessar

CREATE TABLE IF NOT EXISTS permissoes_papeis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  papel TEXT NOT NULL,
  tela TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(papel, tela)
);

-- Admin: acesso a todas as telas do sistema
INSERT INTO permissoes_papeis (papel, tela) VALUES
('admin', 'dashboard'),
('admin', 'kanban'),
('admin', 'vendas'),
('admin', 'calendario_vendas'),
('admin', 'registro'),
('admin', 'agenda'),
('admin', 'relatorio_registros'),
('admin', 'produtos'),
('admin', 'analise_disponibilidade'),
('admin', 'relatorios'),
('admin', 'relatorio_boletim'),
('admin', 'top5_equipamentos'),
('admin', 'relatorios_downtime'),
('admin', 'relatorios_downtime_horas'),
('admin', 'relatorio_downtime_tecnico'),
('admin', 'analise_gargalos'),
('admin', 'relatorio_boletim_pro'),
('admin', 'relatorio_boletim_ai'),
('admin', 'analitica_downtime_ai'),
('admin', 'perfil'),
('admin', 'usuarios'),
('admin', 'base_conhecimento')
ON CONFLICT (papel, tela) DO NOTHING;

-- Lider: relatórios, produção, agenda
INSERT INTO permissoes_papeis (papel, tela) VALUES
('lider', 'dashboard'),
('lider', 'registro'),
('lider', 'agenda'),
('lider', 'relatorio_registros'),
('lider', 'analise_disponibilidade'),
('lider', 'relatorios'),
('lider', 'relatorio_boletim'),
('lider', 'top5_equipamentos'),
('lider', 'relatorios_downtime'),
('lider', 'relatorios_downtime_horas'),
('lider', 'relatorio_downtime_tecnico'),
('lider', 'analise_gargalos'),
('lider', 'relatorio_boletim_pro'),
('lider', 'relatorio_boletim_ai'),
('lider', 'analitica_downtime_ai'),
('lider', 'perfil'),
('lider', 'base_conhecimento')
ON CONFLICT (papel, tela) DO NOTHING;

-- Mecanico: acesso básico (apontamento, dashboard, agenda)
INSERT INTO permissoes_papeis (papel, tela) VALUES
('mecanico', 'dashboard'),
('mecanico', 'registro'),
('mecanico', 'agenda'),
('mecanico', 'relatorio_registros'),
('mecanico', 'perfil'),
('mecanico', 'base_conhecimento')
ON CONFLICT (papel, tela) DO NOTHING;

-- Vendas: pedidos, calendário, agenda
INSERT INTO permissoes_papeis (papel, tela) VALUES
('vendas', 'dashboard'),
('vendas', 'vendas'),
('vendas', 'calendario_vendas'),
('vendas', 'agenda'),
('vendas', 'perfil'),
('vendas', 'base_conhecimento')
ON CONFLICT (papel, tela) DO NOTHING;
