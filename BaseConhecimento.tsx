import React, { useState } from 'react';
import {
  BookOpen,
  FileText,
  Monitor,
  Database,
  Shield,
  LayoutDashboard,
  ClipboardPenLine,
  BarChart3,
  ShoppingCart,
  CalendarDays,
  Layers,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  FileSearch,
  Printer,
  Download,
  Search,
  Users,
  Settings,
  Clock,
  Timer,
  ArrowRight,
  BookMarked,
  HelpCircle,
  Star,
  Zap,
  TrendingUp,
  Package,
  Calculator,
  ZapOff,
  Activity,
  Scale
} from 'lucide-react';

type ConhecimentoTab = 'descricao' | 'manual';

const BaseConhecimento: React.FC = () => {
  const [tab, setTab] = useState<ConhecimentoTab>('descricao');

  const TabButton = ({ id, icon: Icon, label }: { id: ConhecimentoTab; icon: any; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all duration-300 ${
        tab === id
          ? 'bg-[#facc15]/10 border-[#facc15]/30 text-[#facc15] shadow-lg shadow-[#facc15]/5'
          : 'bg-[#0d0d0d] border-white/5 text-slate-500 hover:text-white hover:border-white/20'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</span>
    </button>
  );

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-700 pb-20 font-sans">
      {/* HEADER */}
      <div className="bg-[#0d0d0d] border border-white/5 p-8 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-gradient-to-br from-[#facc15] to-amber-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.2)]">
            <BookOpen className="w-8 h-8 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Base de Conhecimento</h1>
            <p className="text-[10px] font-bold text-[#facc15] uppercase tracking-[0.3em] mt-2 opacity-80">
              Nexus PCP — Documentação Técnica e Manual do Usuário
            </p>
          </div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex gap-3">
        <TabButton id="descricao" icon={FileText} label="Descrição Geral do Sistema" />
        <TabButton id="manual" icon={BookMarked} label="Manual do Usuário" />
      </div>

      {/* DESCRIÇÃO GERAL */}
      {tab === 'descricao' && (
        <div className="space-y-6">
          {/* VISÃO GERAL */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-[#facc15]/10 rounded-lg">
                  <Monitor className="w-5 h-5 text-[#facc15]" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Visão Geral do Sistema</h2>
              </div>
              <div className="prose prose-invert max-w-none space-y-4 text-slate-300 text-[12px] leading-relaxed">
                <p>
                  O <strong className="text-white">Nexus PCP</strong> é um sistema web moderno e completo para o 
                  Planejamento e Controle da Produção (PCP) industrial, desenvolvido especialmente para indústrias 
                  de envase de água mineral e bebidas. A plataforma oferece uma visão integrada e em tempo real 
                  de todo o chão de fábrica, desde o apontamento da produção até a geração de relatórios analíticos 
                  avançados com inteligência artificial.
                </p>
                <p>
                  Construído sobre uma arquitetura moderna em nuvem, o Nexus PCP combina a robustez do 
                  <strong className="text-white"> React 19</strong> com o <strong className="text-white">TypeScript</strong> 
                  para uma experiência de usuário fluida e responsiva, aliada ao <strong className="text-white">Supabase</strong> 
                  como backend database-as-a-service, garantindo escalabilidade, segurança e disponibilidade contínua.
                </p>
              </div>
            </div>

            {/* ARQUITETURA */}
            <div className="p-8 border-b border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Arquitetura Tecnológica</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: Monitor, label: 'Frontend', value: 'React 19 + Vite 6', desc: 'SPA moderna com TypeScript, hot-reload e tree-shaking nativo' },
                  { icon: Database, label: 'Backend / BD', value: 'Supabase (PostgreSQL)', desc: 'Autenticação, RLS, queries em tempo real e armazenamento' },
                  { icon: Shield, label: 'Estilização', value: 'Tailwind CSS 3', desc: 'Design system escuro com classes utilitárias responsivas' },
                  { icon: BarChart3, label: 'Visualização', value: 'Recharts + jsPDF', desc: 'Gráficos interativos e exportação de relatórios em PDF' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <item.icon className="w-4 h-4 text-[#facc15]" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                    </div>
                    <p className="text-xs font-black text-white mb-1">{item.value}</p>
                    <p className="text-[9px] text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* MÓDULOS */}
            <div className="p-8 border-b border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <LayoutDashboard className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Módulos do Sistema</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: LayoutDashboard, label: 'Dashboard', desc: 'Visão executiva com KPIs em tempo real: eficiência por linha, metas semanais, gráfico de Pareto de paradas e desempenho produtivo.' },
                  { icon: Layers, label: 'Programação Kanban', desc: 'Planejamento semanal da produção com drag & drop, visualização por linha e turno, e sugestão por IA de escala otimizada.' },
                  { icon: ShoppingCart, label: 'Gestão de Pedidos', desc: 'Cadastro e acompanhamento de pedidos industriais, controle de saldo de SKUs, finalização com baixa lógica de estoque.' },
                  { icon: ClipboardPenLine, label: 'Apontamento de Produção', desc: 'Registro diário da produção por linha/turno com paradas, motivos, tempos, observações e envio de notificação via WhatsApp.' },
                  { icon: CalendarDays, label: 'Calendário de Pedidos', desc: 'Visualização mensal dos pedidos programados com status por dia, facilitando o planejamento de médio prazo.' },
                  { icon: FileText, label: 'Relatório Boletim', desc: 'Boletim diário de produção consolidado por linha, com totais, eficiência e observações técnicas.' },
                  { icon: BarChart3, label: 'Relatório Analítico', desc: 'Análise de gargalos, downtime técnico, disponibilidade por linha, impacto produtivo e MTTR.' },
                  { icon: TrendingUp, label: 'Relatórios com IA', desc: 'Boletim inteligente e análise de downtime com resumo gerado por inteligência artificial (Gemini).' },
                  { icon: Users, label: 'Gestão de Equipe', desc: 'Cadastro de operadores, líderes e mecânicos com níveis de acesso (admin, líder, mecânico) e especialidades.' },
                  { icon: Package, label: 'Catálogo de Produtos', desc: 'Cadastro de SKUs com volumes, capacidades nominais, unidades por fardo e vínculo com linhas de produção.' },
                ].map((mod, idx) => (
                  <div key={idx} className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:bg-white/[0.04] transition-colors">
                    <div className="p-2 bg-white/5 rounded-lg shrink-0">
                      <mod.icon className="w-4 h-4 text-[#facc15]" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{mod.label}</h4>
                      <p className="text-[9px] text-slate-500 leading-relaxed">{mod.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ESPECIFICAÇÕES */}
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Settings className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">Especificações Técnicas</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-5 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Componente</th>
                      <th className="px-5 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Especificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      ['Framework Frontend', 'React 19.2 com TypeScript 5.8'],
                      ['Bundler', 'Vite 6.4 — compilação em ~12s'],
                      ['Backend / BaaS', 'Supabase (PostgreSQL 15 + Auth + Storage)'],
                      ['Estilização', 'Tailwind CSS 3 via PostCSS com tema escuro customizado'],
                      ['Gráficos', 'Recharts 2.12 — PieChart, BarChart, LineChart'],
                      ['Exportação', 'jsPDF 2.5 + jspdf-autotable para PDF A4'],
                      ['Ícones', 'Lucide React v0.562 — biblioteca de ícones open-source'],
                      ['Autenticação', 'Supabase Auth com sessão persistente e auto-refresh'],
                      ['Segurança', 'RLS (Row Level Security) por perfil de usuário'],
                      ['Responsividade', 'Layout adaptável até 1366x768 com breakpoints Tailwind'],
                      ['Idioma', 'Português Brasileiro (pt-BR)'],
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-tight">{row[0]}</td>
                        <td className="px-5 py-3 text-[10px] font-bold text-white">{row[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL DO USUÁRIO */}
      {tab === 'manual' && (
        <div className="space-y-6">
          {/* APONTAMENTO DE PRODUÇÃO */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <ClipboardPenLine className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">1. Apontamento de Produção</h2>
              </div>

              <div className="space-y-8">
                <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black shrink-0">1</div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Acesse a Página de Apontamento</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      No menu lateral, clique em <strong className="text-[#facc15]">APONTAMENTO</strong>. Você será direcionado ao formulário 
                      principal de registro de produção. Certifique-se de que a data e o turno corretos estão selecionados no topo da página.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black shrink-0">2</div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Selecione a Linha e o Produto</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Escolha a <strong className="text-white">linha de produção</strong> (ex: Linha 1, Linha 2) e o 
                      <strong className="text-white"> produto/SKU</strong> que está sendo produzido. O sistema exibirá 
                      a capacidade nominal da linha para referência.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black shrink-0">3</div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Registre o Volume Produzido</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      No campo <strong className="text-white">VOLUME PRODUZIDO</strong>, informe a quantidade total de unidades 
                      produzidas no turno. O sistema calculará automaticamente a eficiência com base na capacidade nominal 
                      e na carga horária informada.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black shrink-0">4</div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Registre as Paradas (Inatividade)</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Na seção <strong className="text-white">REGISTRO DE INATIVIDADE</strong>, adicione cada parada ocorrida durante 
                      o turno. Para cada parada, preencha:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {['Tipo: Planejada, Não Planejada, Manutenção, Logística, etc.', 'Motivo: Selecione entre os motivos pré-cadastrados', 'Horário: Informe o início e o fim da parada', 'Máquina: Selecione o equipamento relacionado'].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-[9px] text-slate-500">
                          <ChevronRight className="w-3 h-3 text-[#facc15] mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-6 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-black shrink-0">5</div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Adicione Observações e Finalize</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      No campo <strong className="text-white">OBSERVAÇÕES</strong>, registre informações relevantes sobre o turno 
                      (manutenções realizadas, qualidade, intercorrências). Clique em 
                      <strong className="text-[#facc15]"> SALVAR REGISTRO</strong> para finalizar. Uma notificação será enviada 
                      via WhatsApp para o grupo de gestão.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RELATÓRIOS */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FileSearch className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">2. Utilização dos Relatórios</h2>
              </div>

              <div className="space-y-6">
                {[
                  {
                    icon: FileText,
                    title: 'Boletim de Produção',
                    desc: 'Acesse pelo menu RELATÓRIOS > BOLETIM. Selecione o período e visualize a produção consolidada por linha, com totais, eficiência e observações. Use o botão IMPRIMIR A4 para gerar uma versão para assinatura.',
                  },
                  {
                    icon: Calculator,
                    title: 'Boletim por Turno',
                    desc: 'Relatório detalhado por turno com carga horária, capacidade nominal, volume produzido, eficiência calculada e paradas registradas. Ideal para a reunião de passagem de turno.',
                  },
                  {
                    icon: ZapOff,
                    title: 'Relatório de Downtime',
                    desc: 'No menu RELATÓRIOS > DOWNTIME, você encontra duas visualizações: em minutos e em horas. Ambas apresentam o tempo de inatividade por tipo de parada, impacto produtivo e representatividade percentual.',
                  },
                  {
                    icon: Activity,
                    title: 'Downtime Técnico',
                    desc: 'Relatório avançado com análise de MTTR, top 3 equipamentos críticos, impacto por tipo de parada e detalhamento técnico com histórico diário de cada máquina. Utilize os filtros de data, linha e turno para refinar a análise.',
                  },
                  {
                    icon: BarChart3,
                    title: 'Análise de Gargalos',
                    desc: 'Identifique gargalos produtivos comparando o desempenho entre linhas. O relatório exibe KPIs como downtime total, gargalo atual, MTTR e número de ocorrências, além de gráficos de evolução temporal.',
                  },
                  {
                    icon: Scale,
                    title: 'Balanço / Disponibilidade',
                    desc: 'Visualize o saldo de produção por produto, comparando estoque atual, pedidos pendentes, volume programado e saldo disponível. Utilize para o planejamento semanal de produção.',
                  },
                  {
                    icon: Star,
                    title: 'Relatórios com IA',
                    desc: 'Os relatórios BOLETIM COM IA e ANALÍTICA DOWNTIME (AI) utilizam inteligência artificial para gerar resumos e análises preditivas automáticas baseadas nos dados de produção do período selecionado.',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Relatório por Produto',
                    desc: 'Acompanhe o desempenho individual de cada SKU, com volume produzido por período, eficiência média e comparativo entre linhas que produzem o mesmo produto.',
                  },
                ].map((rel, idx) => (
                  <div key={idx} className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:bg-white/[0.04] transition-colors">
                    <div className="p-2 bg-white/5 rounded-lg shrink-0">
                      <rel.icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{rel.title}</h4>
                      <p className="text-[9px] text-slate-500 leading-relaxed">{rel.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PEDIDOS */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">3. Gestão de Pedidos</h2>
              </div>

              <div className="space-y-4 text-[10px] text-slate-400 leading-relaxed">
                <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-black shrink-0">1</div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Cadastrar Pedido</h3>
                    <p>No menu <strong className="text-white">PEDIDOS</strong>, clique em <strong className="text-[#facc15]">NOVO PEDIDO</strong>. Informe o cliente, a data de entrega e adicione os itens (SKU + quantidade). O sistema validará o saldo disponível em estoque.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-black shrink-0">2</div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Finalizar Pedido</h3>
                    <p>Após a produção, localize o pedido na lista e clique em <strong className="text-[#facc15]">FINALIZAR</strong>. O sistema baixará o saldo dos SKUs do estoque lógico automaticamente. Pedidos finalizados não podem ser editados.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-black shrink-0">3</div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Calendário de Pedidos</h3>
                    <p>O <strong className="text-white">CALENDÁRIO DE PEDIDOS</strong> exibe uma visão mensal com todos os pedidos programados. As cores indicam o status: amarelo para pendente, verde para finalizado, vermelho para atrasado.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DICAS E BOAS PRÁTICAS */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">4. Dicas e Boas Práticas</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: Clock, title: 'Registro Diário', desc: 'Registre a produção ao final de cada turno. Dados inconsistentes ou registros atrasados comprometem a acurácia dos relatórios.' },
                  { icon: AlertCircle, title: 'Paradas Detalhadas', desc: 'Quanto mais detalhado o registro de paradas (tipo, motivo, máquina), mais precisa será a análise de downtime e a identificação de gargalos.' },
                  { icon: CheckCircle2, title: 'Consistência de Dados', desc: 'Mantenha o catálogo de produtos e o cadastro de máquinas sempre atualizados para evitar inconsistências nos relatórios.' },
                  { icon: Timer, title: 'Carga Horária', desc: 'Informe a carga horária real trabalhada no turno (descontando intervalos). O cálculo de eficiência depende diretamente deste valor.' },
                  { icon: Users, title: 'Perfis de Acesso', desc: 'Utilize os níveis de acesso corretamente: admin para gestores, líder para supervisores e mecânico para a manutenção. Isso protege dados sensíveis.' },
                  { icon: Search, title: 'Filtros de Período', desc: 'Ao gerar relatórios, selecione períodos adequados ao tipo de análise. Períodos muito longos podem diluir métricas importantes como o MTTR.' },
                  { icon: Printer, title: 'Impressão de Relatórios', desc: 'Utilize o botão IMPRIMIR nos relatórios para gerar versões em PDF otimizadas para A4. O sistema ajusta automaticamente o layout para impressão.' },
                  { icon: Download, title: 'Exportação de Dados', desc: 'Os dados dos relatórios podem ser impressos em PDF com formatação profissional, prontos para arquivamento e auditoria.' },
                ].map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:bg-white/[0.04] transition-colors">
                    <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                      <tip.icon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">{tip.title}</h4>
                      <p className="text-[9px] text-slate-500 leading-relaxed">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ATALHOS E NAVEGAÇÃO */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <HelpCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">5. Suporte e Contato</h2>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Suporte Técnico</h3>
                  <p className="text-[9px] text-slate-500 leading-relaxed">
                    Em caso de dúvidas ou problemas técnicos, consulte esta base de conhecimento ou entre em contato 
                    com o administrador do sistema.
                  </p>
                </div>
                <div className="flex-1 bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Versão do Sistema</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-white">Nexus PCP Premium</span>
                    <span className="text-[8px] bg-[#facc15]/10 text-[#facc15] px-2 py-0.5 rounded font-black">v2.5</span>
                  </div>
                  <p className="text-[8px] text-slate-600 mt-1 uppercase tracking-widest">Nexus Cloud • Engenharia de Processos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaseConhecimento;
