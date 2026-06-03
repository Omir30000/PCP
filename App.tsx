
import React, { useState } from 'react';
import { ToastProvider } from './lib/toast';
import Dashboard from './Dashboard';
import Vendas from './Vendas';
import ProgramacaoKanban from './ProgramacaoKanban';
import PaginaRegistro from './PaginaRegistro';
import Produtos from './Produtos';
import AnaliseDisponibilidade from './AnaliseDisponibilidade';
import Relatorios from './Relatorios';
import RelatoriosProdutos from './RelatoriosProdutos';
import RelatoriosDowntime from './RelatoriosDowntime';
import RelatorioRegistros from './RelatorioRegistros';
import RelatorioAnaliticoPorLinha from './RelatorioAnaliticoPorLinha';
import CalendarioVendas from './CalendarioVendas';
import RelatorioBoletim from './RelatorioBoletim';
import RelatorioBoletimAI from './RelatorioBoletimAI';
import RelatorioAnaliticaDowntimeAI from './RelatorioAnaliticaDowntimeAI';
import RelatoriosDowntimeHoras from './RelatoriosDowntimeHoras';
import RelatorioDowntimeTecnico from './RelatorioDowntimeTecnico';
import RelatorioBoletimPro from './RelatorioBoletimPro';
import RelatorioTop5Equipamentos from './RelatorioTop5Equipamentos';
import Auth from './Auth';
import Perfil from './Perfil';
import Usuarios from './Usuarios';
import AgendaContatos from './AgendaContatos';
import BaseConhecimento from './BaseConhecimento';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

import {
  LayoutDashboard,
  ShoppingCart,
  CalendarDays,
  ClipboardPenLine,
  Package,
  Activity,
  FileText,
  TrendingUp,
  Settings,
  User,
  ChevronDown,
  Scale,
  ZapOff,
  Layers,
  LayoutGrid,
  TrendingDown,
  Calculator,
  Clock,
  LogOut,
  Menu,
  X,
  Wrench,
  BrainCircuit,
  Timer,
  Zap,
  Users,
  Sparkles,
  BookOpen,
  Gauge
} from 'lucide-react';

type Tab =
  | 'dashboard'
  | 'kanban'
  | 'vendas'
  | 'registro'
  | 'produtos'
  | 'analise_disponibilidade'
  | 'relatorios'
  | 'relatorios_produtos'
  | 'relatorios_downtime'
  | 'relatorios_downtime_horas'
  | 'relatorio_downtime_tecnico'
  | 'relatorio_registros'
  | 'analise_gargalos'
  | 'calendario_vendas'
  | 'relatorio_boletim'
  | 'relatorio_boletim_ai'
  | 'relatorio_boletim_pro'
  | 'analitica_downtime_ai'
  | 'top5_equipamentos'
  | 'agenda'
  | 'perfil'
  | 'usuarios'
  | 'base_conhecimento';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isAIReportsOpen, setIsAIReportsOpen] = useState(false);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [screenPermissions, setScreenPermissions] = useState<Set<string>>(new Set());

  // PWA: ler aba da URL (shortcuts)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['dashboard', 'registro', 'kanban', 'vendas', 'relatorios'].includes(tabParam)) {
      setActiveTab(tabParam as Tab);
    }
  }, []);

  // Forçar Dark Mode fixo
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  React.useEffect(() => {
    // Busca a sessão atual ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
      else setIsAuthLoading(false);
    });

    // Escuta mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setIsAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getDefaultPermissions = (role: string): Set<string> => {
    const perms = new Set<string>(['dashboard', 'registro', 'agenda', 'relatorio_registros', 'perfil', 'base_conhecimento']);
    if (role === 'admin') {
      ['kanban', 'vendas', 'calendario_vendas', 'produtos', 'usuarios',
       'analise_disponibilidade', 'relatorios', 'relatorio_boletim', 'top5_equipamentos',
       'relatorios_downtime', 'relatorios_downtime_horas', 'relatorio_downtime_tecnico',
       'analise_gargalos', 'relatorio_boletim_pro', 'relatorio_boletim_ai',
       'analitica_downtime_ai'].forEach(t => perms.add(t));
    } else if (role === 'lider') {
      ['analise_disponibilidade', 'relatorios', 'relatorio_boletim', 'top5_equipamentos',
       'relatorios_downtime', 'relatorios_downtime_horas', 'relatorio_downtime_tecnico',
       'analise_gargalos', 'relatorio_boletim_pro', 'relatorio_boletim_ai',
       'analitica_downtime_ai'].forEach(t => perms.add(t));
    }
    return perms;
  };

  const fetchScreenPermissions = async (role: string) => {
    const defaults = getDefaultPermissions(role);
    try {
      const { data } = await supabase
        .from('permissoes_papeis')
        .select('tela')
        .eq('papel', role);

      if (data && data.length > 0) {
        setScreenPermissions(new Set(data.map(d => d.tela)));
        return;
      }
    } catch {
      // Tabela ainda não existe, usa defaults
    }
    setScreenPermissions(defaults);
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        if (data.ativo === false) {
          handleLogout();
          return;
        }
        setUserProfile(data);
        fetchScreenPermissions(data.nivel_acesso || 'mecanico');
        return;
      }

      // Perfil não encontrado — tenta criar automaticamente
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email || '';
      const nome = userData?.user?.user_metadata?.nome || email.split('@')[0] || 'Usuário';

      const { data: newProfile, error: insertError } = await supabase
        .from('perfis')
        .insert({
          id: userId,
          nome,
          email,
          nivel_acesso: 'mecanico',
          especialidade: 'geral',
          turno: 1,
          ativo: true
        })
        .select()
        .single();

      if (!insertError && newProfile) {
        setUserProfile(newProfile);
        fetchScreenPermissions('mecanico');
      }
    } catch (err) {
      console.error('Erro ao buscar perfil:', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleProfileUpdate = (newProfile: any) => {
    setUserProfile(newProfile);
    if (newProfile?.nivel_acesso) {
      fetchScreenPermissions(newProfile.nivel_acesso);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#facc15] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const NavItem = ({ id, icon: Icon, label, isSubItem = false, onClick }: { id: Tab, icon: any, label: string, isSubItem?: boolean, onClick?: () => void }) => {
    const isActive = activeTab === id;
    const isDesktopSidebar = !onClick;
    
    return (
      <button
        onClick={() => {
          setActiveTab(id);
          if (onClick) onClick();
          if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        }}
        className={`w-full flex items-center transition-all duration-300 relative group/item select-none
          ${isDesktopSidebar ? (isSidebarExpanded ? (isSubItem ? 'pl-12 pr-4 py-2.5' : 'px-4 py-3 gap-4') : 'justify-center py-4') : 'px-4 py-3.5 gap-4 rounded-xl mb-1'}
          ${isSubItem && isDesktopSidebar ? 'pl-12' : ''}
          ${isDesktopSidebar ? 'rounded-xl mb-0.5' : 'mb-0.5'}
          ${isActive
            ? 'text-[#facc15] bg-gradient-to-r from-[#facc15]/10 to-transparent'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}
          ${!isDesktopSidebar && isActive ? 'bg-[#facc15]/10 border border-[#facc15]/20' : ''}
        `}
      >
        {isActive && isDesktopSidebar && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#facc15] rounded-r-full shadow-[0_0_12px_rgba(250,204,21,0.4)]" />
        )}
        <Icon className={`${isDesktopSidebar ? (isSidebarExpanded ? (isSubItem ? 'w-3.5 h-3.5' : 'w-5 h-5') : 'w-6 h-6') : 'w-5 h-5'} shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover/item:scale-110'}`} />
        {(isSidebarExpanded || !isDesktopSidebar) && (
          <span className={`font-bold uppercase tracking-[0.12em] whitespace-nowrap overflow-hidden text-[10px] transition-all duration-300 ${isActive ? 'text-[#facc15]' : 'group-hover/item:text-slate-200'}`}>
            {label}
          </span>
        )}
      </button>
    );
  };

  const ExternalNavItem = ({ icon: Icon, label, url, isDesktopSidebar }: { icon: any, label: string, url: string, isDesktopSidebar: boolean }) => {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full flex items-center transition-all duration-300 relative group/item select-none
          ${isDesktopSidebar ? (isSidebarExpanded ? 'px-4 py-3 gap-4' : 'justify-center py-4') : 'px-4 py-3.5 gap-4 rounded-xl mb-1'}
          text-slate-400 hover:text-[#facc15] hover:bg-white/[0.04] rounded-xl mb-0.5
        `}
      >
        <Icon className={`${isDesktopSidebar ? (isSidebarExpanded ? 'w-5 h-5' : 'w-6 h-6') : 'w-5 h-5'} shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]`} />
        {(isSidebarExpanded || !isDesktopSidebar) && (
          <span className={`font-bold uppercase tracking-[0.12em] whitespace-nowrap overflow-hidden text-[10px] transition-colors duration-300 group-hover:text-[#facc15]`}>
            {label}
          </span>
        )}
      </a>
    );
  };

  return (
    <ToastProvider>
    <div className={`min-h-screen flex overflow-hidden font-sans selection:bg-[#facc15]/30 bg-[#0a0a0a] text-slate-100`}>
      
      {/* Desktop Sidebar */}
      <aside
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className={`hidden lg:flex flex-col h-screen sticky top-0 z-50 transition-all duration-500 border-r border-white/5 shadow-2xl
          ${isSidebarExpanded ? 'w-64' : 'w-20'}
          bg-[#0a0a0a] border-r border-white/[0.04]
        `}
      >
        <div className={`pt-6 pb-4 mb-6 flex items-center ${isSidebarExpanded ? 'gap-4 px-5' : 'justify-center'}`}>
          <div className="w-9 h-9 bg-gradient-to-br from-[#facc15] to-[#f59e0b] rounded-xl flex items-center justify-center font-black text-black text-lg shadow-[0_0_20px_rgba(250,204,21,0.25)] shrink-0">
            N
          </div>
          {isSidebarExpanded && (
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm tracking-tight uppercase leading-none">Nexus PCP</span>
              <span className="text-[#facc15]/70 text-[7px] font-bold tracking-[0.35em] mt-1">MONITOR</span>
            </div>
          )}
        </div>

        <div className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar pb-10">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          
          {screenPermissions.has('kanban') && (
            <NavItem id="kanban" icon={LayoutGrid} label="Programação" />
          )}
          {screenPermissions.has('vendas') && (
            <NavItem id="vendas" icon={ShoppingCart} label="Pedidos" />
          )}
          {screenPermissions.has('calendario_vendas') && (
            <NavItem id="calendario_vendas" icon={CalendarDays} label="Calendário de Pedidos" />
          )}

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-5 mx-4" />

          <NavItem id="registro" icon={ClipboardPenLine} label="Apontamento" />
          
          <NavItem id="agenda" icon={Users} label="Agenda" />
          <NavItem id="relatorio_registros" icon={ClipboardPenLine} label="Registros" />

          {screenPermissions.has('produtos') && (
            <NavItem id="produtos" icon={Package} label="Catálogo" />
          )}

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-5 mx-4" />

          {(screenPermissions.has('relatorios') || screenPermissions.has('analise_disponibilidade')) && (
            <>
              {isSidebarExpanded && (
                <button
                  onClick={() => setIsReportsOpen(!isReportsOpen)}
                  className="w-full flex items-center justify-between px-4 mb-3 group ring-0 outline-none select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.06] transition-all">
                      <FileText className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] group-hover:text-slate-300 transition-colors">Relatórios de Produção</p>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-slate-600 transition-all duration-300 ${isReportsOpen ? '' : '-rotate-90'}`} />
                </button>
              )}
              <div className={`space-y-0.5 transition-all duration-500 overflow-hidden ${isReportsOpen || !isSidebarExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {screenPermissions.has('analise_disponibilidade') && <NavItem id="analise_disponibilidade" icon={Scale} label="Balanço" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('relatorios') && <NavItem id="relatorios" icon={FileText} label="Boletim" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('relatorio_boletim') && <NavItem id="relatorio_boletim" icon={Calculator} label="Boletim Turno" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('top5_equipamentos') && <NavItem id="top5_equipamentos" icon={Gauge} label="Top 5 Equipamentos" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('relatorios_downtime') && <NavItem id="relatorios_downtime" icon={ZapOff} label="Downtime (Min)" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('relatorios_downtime_horas') && <NavItem id="relatorios_downtime_horas" icon={Clock} label="Downtime (Horas)" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('relatorio_downtime_tecnico') && <NavItem id="relatorio_downtime_tecnico" icon={Activity} label="Downtime Técnico" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('analise_gargalos') && <NavItem id="analise_gargalos" icon={TrendingDown} label="Gargalos" isSubItem={isSidebarExpanded} />}
              </div>
            </>
          )}

          {(screenPermissions.has('relatorio_boletim_pro') || screenPermissions.has('relatorio_boletim_ai')) && (
            <>
              {isSidebarExpanded && (
                <button
                  onClick={() => setIsAIReportsOpen(!isAIReportsOpen)}
                  className="w-full flex items-center justify-between px-4 mb-3 mt-3 group ring-0 outline-none select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.06] transition-all">
                      <BrainCircuit className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] group-hover:text-slate-300 transition-colors">Relatórios com IA</p>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-slate-600 transition-all duration-300 ${isAIReportsOpen ? '' : '-rotate-90'}`} />
                </button>
              )}
              <div className={`space-y-0.5 transition-all duration-500 overflow-hidden ${isAIReportsOpen || !isSidebarExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {screenPermissions.has('relatorio_boletim_pro') && <NavItem id="relatorio_boletim_pro" icon={Sparkles} label="Boletim Pro" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('relatorio_boletim_ai') && <NavItem id="relatorio_boletim_ai" icon={BrainCircuit} label="Boletim com IA" isSubItem={isSidebarExpanded} />}
                {screenPermissions.has('analitica_downtime_ai') && <NavItem id="analitica_downtime_ai" icon={Timer} label="Analítica Downtime (AI)" isSubItem={isSidebarExpanded} />}
              </div>
            </>
          )}

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-5 mx-4" />

          <NavItem id="perfil" icon={User} label="Meu Perfil" />
          
          {screenPermissions.has('usuarios') && (
            <NavItem id="usuarios" icon={Settings} label="Gestão de Equipe" />
          )}

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent my-5 mx-4" />

          <ExternalNavItem 
            icon={Wrench} 
            label="Nexus Manutenção" 
            url="https://nexus-cmms.vercel.app/" 
            isDesktopSidebar={true} 
          />

          <div className="h-px bg-white/5 my-6 mx-4" />

          {isSidebarExpanded && (
            <button
              onClick={() => setIsKnowledgeOpen(!isKnowledgeOpen)}
              className="w-full flex items-center justify-between px-4 mb-3 mt-2 group ring-0 outline-none select-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.06] transition-all">
                  <BookOpen className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] group-hover:text-slate-300 transition-colors">Base de Conhecimento</p>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-600 transition-all duration-300 ${isKnowledgeOpen ? '' : '-rotate-90'}`} />
            </button>
          )}

          <div className={`space-y-0.5 transition-all duration-500 overflow-hidden ${isKnowledgeOpen || !isSidebarExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <NavItem id="base_conhecimento" icon={FileText} label="Descrição Geral" isSubItem={isSidebarExpanded} />
          </div>
        </div>

        <div className={`p-3 mt-auto border-t border-white/[0.04] bg-black/20`}>
          <div 
            onClick={() => setActiveTab('perfil')}
            className="flex items-center gap-3 cursor-pointer hover:bg-white/[0.04] p-2 rounded-xl transition-all duration-300 group/profile"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-[#facc15] shrink-0 border border-white/[0.06] uppercase font-black text-xs overflow-hidden shadow-lg">
              {userProfile?.foto_url ? (
                <img src={userProfile.foto_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userProfile?.nome ? userProfile.nome.charAt(0) : <User className="w-4 h-4" />
              )}
            </div>
            {isSidebarExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white/90 uppercase truncate group-hover/profile:text-[#facc15] transition-colors">{userProfile?.nome || 'Usuário Nexus'}</p>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-[0.15em]">{userProfile?.nivel_acesso || 'Operacional'}</p>
              </div>
            )}
            
            {isSidebarExpanded && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all duration-300 shrink-0 opacity-0 group-hover/profile:opacity-100"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 min-w-0 relative overflow-y-auto h-screen scroll-smooth transition-colors duration-500 bg-[#0a0a0a]`}>
        <div className="relative z-10 px-4 py-6 md:px-6 md:py-8 lg:px-10 lg:py-10 max-w-[1800px] mx-auto pb-24 lg:pb-10 animate-in fade-in duration-500">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'kanban' && <ProgramacaoKanban />}
          {activeTab === 'vendas' && <Vendas />}
          {activeTab === 'registro' && <PaginaRegistro />}
          {activeTab === 'produtos' && <Produtos />}
          {activeTab === 'analise_disponibilidade' && <AnaliseDisponibilidade />}
          {activeTab === 'relatorios' && <Relatorios />}
          {activeTab === 'relatorios_produtos' && <RelatoriosProdutos />}
          {activeTab === 'relatorio_registros' && <RelatorioRegistros />}
          {activeTab === 'relatorios_downtime' && <RelatoriosDowntime />}
          {activeTab === 'relatorios_downtime_horas' && <RelatoriosDowntimeHoras />}
          {activeTab === 'relatorio_downtime_tecnico' && <RelatorioDowntimeTecnico />}
          {activeTab === 'analise_gargalos' && <RelatorioAnaliticoPorLinha />}
          {activeTab === 'calendario_vendas' && <CalendarioVendas />}
          {activeTab === 'relatorio_boletim' && <RelatorioBoletim />}
          {activeTab === 'relatorio_boletim_pro' && <RelatorioBoletimPro />}
          {activeTab === 'relatorio_boletim_ai' && <RelatorioBoletimAI />}
          {activeTab === 'analitica_downtime_ai' && <RelatorioAnaliticaDowntimeAI />}
          {activeTab === 'top5_equipamentos' && <RelatorioTop5Equipamentos />}
          {activeTab === 'perfil' && <Perfil userProfile={userProfile} onProfileUpdate={handleProfileUpdate} />}
          {activeTab === 'usuarios' && screenPermissions.has('usuarios') && <Usuarios />}
          {activeTab === 'agenda' && <AgendaContatos />}
          {activeTab === 'base_conhecimento' && <BaseConhecimento />}
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0d0d0d]/90 backdrop-blur-xl border-t border-white/5 z-50 flex items-center justify-around px-2 py-3 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === 'dashboard' ? 'text-[#facc15]' : 'text-slate-500'}`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-widest">Dash</span>
        </button>
        <button 
          onClick={() => setActiveTab('registro')}
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === 'registro' ? 'text-[#facc15]' : 'text-slate-500'}`}
        >
          <ClipboardPenLine className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-widest">Apontar</span>
        </button>
        {screenPermissions.has('relatorios') && (
          <button 
            onClick={() => setActiveTab('relatorios')}
            className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === 'relatorios' ? 'text-[#facc15]' : 'text-slate-500'}`}
          >
            <FileText className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-widest">Relats</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('perfil')}
          className={`flex flex-col items-center gap-1 flex-1 transition-colors ${activeTab === 'perfil' ? 'text-[#facc15]' : 'text-slate-500'}`}
        >
          <div className={`w-6 h-6 rounded-full overflow-hidden border ${activeTab === 'perfil' ? 'border-[#facc15]' : 'border-white/10'}`}>
            {userProfile?.foto_url ? <img src={userProfile.foto_url} className="w-full h-full object-cover" /> : <User className="w-full h-full p-1" />}
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest">Perfil</span>
        </button>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 flex-1 text-slate-500"
        >
          <Menu className="w-6 h-6" />
          <span className="text-[8px] font-black uppercase tracking-widest">Mais</span>
        </button>
      </nav>

      {/* Mobile Drawer Slide-over */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[280px] bg-[#0d0d0d] border-l border-white/10 shadow-2xl flex flex-col p-6 animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-white font-black text-base tracking-tighter uppercase">Menu Nexus</h3>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-1 overflow-y-auto no-scrollbar flex-1">
              {screenPermissions.has('kanban') && <NavItem id="kanban" icon={LayoutGrid} label="Programação" onClick={() => setIsMobileMenuOpen(false)} />}
              {screenPermissions.has('vendas') && <NavItem id="vendas" icon={ShoppingCart} label="Pedidos" onClick={() => setIsMobileMenuOpen(false)} />}
              {screenPermissions.has('calendario_vendas') && <NavItem id="calendario_vendas" icon={CalendarDays} label="Calendário" onClick={() => setIsMobileMenuOpen(false)} />}
              {screenPermissions.has('produtos') && <NavItem id="produtos" icon={Package} label="Catálogo" onClick={() => setIsMobileMenuOpen(false)} />}
              {screenPermissions.has('usuarios') && <NavItem id="usuarios" icon={Settings} label="Gestão Equipe" onClick={() => setIsMobileMenuOpen(false)} />}
              
              <div className="h-px bg-white/5 my-4" />
              <ExternalNavItem 
                icon={Wrench} 
                label="Nexus Manutenção" 
                url="https://nexus-cmms.vercel.app/" 
                isDesktopSidebar={false} 
              />

              <div className="h-px bg-white/5 my-4" />
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] px-4 mb-2">Base de Conhecimento</p>
              <NavItem id="base_conhecimento" icon={BookOpen} label="Documentação" onClick={() => setIsMobileMenuOpen(false)} />
              
              {(screenPermissions.has('relatorios') || screenPermissions.has('analise_disponibilidade')) && (
                <>
                  <div className="h-px bg-white/5 my-4" />
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] px-4 mb-2">Relatórios</p>
                  {screenPermissions.has('analise_disponibilidade') && <NavItem id="analise_disponibilidade" icon={Scale} label="Balanço" onClick={() => setIsMobileMenuOpen(false)} />}
                  {screenPermissions.has('relatorio_boletim') && <NavItem id="relatorio_boletim" icon={Calculator} label="Boletim Turno" onClick={() => setIsMobileMenuOpen(false)} />}
                  {screenPermissions.has('top5_equipamentos') && <NavItem id="top5_equipamentos" icon={Gauge} label="Top 5 Equipamentos" onClick={() => setIsMobileMenuOpen(false)} />}
                  {screenPermissions.has('relatorios_downtime') && <NavItem id="relatorios_downtime" icon={ZapOff} label="Downtime" onClick={() => setIsMobileMenuOpen(false)} />}
                  {screenPermissions.has('relatorios_downtime_horas') && <NavItem id="relatorios_downtime_horas" icon={Clock} label="Downtime (Horas)" onClick={() => setIsMobileMenuOpen(false)} />}
                  {screenPermissions.has('relatorio_downtime_tecnico') && <NavItem id="relatorio_downtime_tecnico" icon={Activity} label="Downtime Técnico" onClick={() => setIsMobileMenuOpen(false)} />}
                  {screenPermissions.has('analise_gargalos') && <NavItem id="analise_gargalos" icon={TrendingDown} label="Gargalos" onClick={() => setIsMobileMenuOpen(false)} />}
                  <div className="h-px bg-white/5 my-4" />
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] px-4 mb-2">Relatórios com IA</p>
                  {screenPermissions.has('relatorio_boletim_pro') && <NavItem id="relatorio_boletim_pro" icon={Sparkles} label="Boletim Pro" onClick={() => setIsMobileMenuOpen(false)} />}
                  {screenPermissions.has('relatorio_boletim_ai') && <NavItem id="relatorio_boletim_ai" icon={BrainCircuit} label="Boletim com IA" onClick={() => setIsMobileMenuOpen(false)} />}
                  {screenPermissions.has('analitica_downtime_ai') && <NavItem id="analitica_downtime_ai" icon={Timer} label="Analítica Downtime (AI)" onClick={() => setIsMobileMenuOpen(false)} />}
                </>
              )}
            </div>

            <div className="mt-auto pt-6 border-t border-white/5">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-4 py-4 text-red-400 font-black text-[9px] uppercase tracking-widest bg-red-400/5 rounded-xl border border-red-500/10 hover:bg-red-400/10 transition-all"
              >
                <LogOut className="w-5 h-5" /> Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
    </ToastProvider>
  );
};

export default App;
