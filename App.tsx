
import React, { useState } from 'react';
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
import RelatoriosDowntimeHoras from './RelatoriosDowntimeHoras';
import Auth from './Auth';
import Perfil from './Perfil';
import Usuarios from './Usuarios';
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
  Sun,
  Moon,
  Calculator,
  Clock,
  LogOut,
  Menu,
  X
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
  | 'relatorio_registros'
  | 'analise_gargalos'
  | 'calendario_vendas'
  | 'relatorio_boletim'
  | 'perfil'
  | 'usuarios';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
      }
    } catch (err) {
      console.error('Erro ao buscar perfil:', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleProfileUpdate = (newProfile: any) => {
    setUserProfile(newProfile);
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

  const role = userProfile?.nivel_acesso || 'mecanico';

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
        className={`w-full flex items-center transition-all duration-300 relative group/item
          ${isDesktopSidebar ? (isSidebarExpanded ? (isSubItem ? 'pl-12 pr-4 py-2.5' : 'px-4 py-3 gap-4') : 'justify-center py-4') : 'px-4 py-3.5 gap-4 rounded-xl mb-1'}
          ${isActive ? 'text-[#facc15] bg-[#facc15]/5' : 'text-slate-500 hover:text-white hover:bg-white/5'}
          ${!isSubItem && isDesktopSidebar ? 'rounded-xl mb-1' : 'mb-0.5'}
          ${!isDesktopSidebar && isActive ? 'bg-[#facc15]/10 border border-[#facc15]/20' : ''}
        `}
      >
        {isActive && !isSubItem && isDesktopSidebar && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#facc15] rounded-r-full shadow-[0_0_15px_#facc15]" />
        )}
        <Icon className={`${isDesktopSidebar ? (isSidebarExpanded ? (isSubItem ? 'w-3.5 h-3.5' : 'w-5 h-5') : 'w-6 h-6') : 'w-5 h-5'} shrink-0`} />
        {(isSidebarExpanded || !isDesktopSidebar) && (
          <span className={`font-black uppercase tracking-[0.15em] whitespace-nowrap overflow-hidden text-[10px]`}>
            {label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`min-h-screen flex overflow-hidden font-sans selection:bg-[#facc15]/30 bg-[#0a0a0a] text-slate-100`}>
      
      {/* Desktop Sidebar */}
      <aside
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className={`hidden lg:flex flex-col h-screen sticky top-0 z-50 transition-all duration-500 border-r border-white/5 shadow-2xl
          ${isSidebarExpanded ? 'w-64' : 'w-20'}
          bg-[#0d0d0d] backdrop-blur-xl
        `}
      >
        <div className={`p-6 mb-8 flex items-center ${isSidebarExpanded ? 'gap-4' : 'justify-center'}`}>
          <div className="w-10 h-10 bg-[#facc15] rounded-lg flex items-center justify-center font-black text-black text-xl shadow-[0_0_20px_rgba(250,204,21,0.3)] shrink-0">
            N
          </div>
          {isSidebarExpanded && (
            <div className="flex flex-col">
              <span className="text-white font-black text-base tracking-tighter uppercase leading-none">Nexus PCP</span>
              <span className="text-[#facc15] text-[8px] font-black tracking-[0.4em] mt-1 italic">PREMIUM</span>
            </div>
          )}
        </div>

        <div className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar pb-10">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          
          {role === 'admin' && (
            <>
              <NavItem id="kanban" icon={LayoutGrid} label="Programação" />
              <NavItem id="vendas" icon={ShoppingCart} label="Pedidos" />
              <NavItem id="calendario_vendas" icon={CalendarDays} label="Calendário de Pedidos" />
            </>
          )}

          <div className="h-px bg-white/5 my-6 mx-4" />

          <NavItem id="registro" icon={ClipboardPenLine} label="Apontamento" />
          
          {role === 'admin' && (
            <NavItem id="produtos" icon={Package} label="Catálogo" />
          )}

          <div className="h-px bg-white/5 my-6 mx-4" />

          {isSidebarExpanded && (role === 'admin' || role === 'lider') && (
            <button
              onClick={() => setIsReportsOpen(!isReportsOpen)}
              className="w-full flex items-center justify-between px-4 mb-4 group ring-0 outline-none"
            >
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] group-hover:text-slate-400 transition-colors">Relatórios de Produção</p>
              <ChevronDown className={`w-3 h-3 text-slate-600 transition-transform duration-300 ${isReportsOpen ? '' : '-rotate-90'}`} />
            </button>
          )}

          {(role === 'admin' || role === 'lider') && (
            <div className={`space-y-0.5 transition-all duration-500 overflow-hidden ${isReportsOpen || !isSidebarExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <NavItem id="analise_disponibilidade" icon={Scale} label="Balanço" isSubItem={isSidebarExpanded} />
              <NavItem id="relatorios" icon={FileText} label="Boletim" isSubItem={isSidebarExpanded} />
              <NavItem id="relatorio_boletim" icon={Calculator} label="Boletim Turno" isSubItem={isSidebarExpanded} />
              <NavItem id="relatorio_registros" icon={ClipboardPenLine} label="Registros" isSubItem={isSidebarExpanded} />
              <NavItem id="relatorios_downtime" icon={ZapOff} label="Downtime (Min)" isSubItem={isSidebarExpanded} />
              <NavItem id="relatorios_downtime_horas" icon={Clock} label="Downtime (Horas)" isSubItem={isSidebarExpanded} />
              <NavItem id="analise_gargalos" icon={TrendingDown} label="Gargalos" isSubItem={isSidebarExpanded} />
            </div>
          )}

          <div className="h-px bg-white/5 my-6 mx-4" />

          <NavItem id="perfil" icon={User} label="Meu Perfil" />
          
          {role === 'admin' && (
            <NavItem id="usuarios" icon={Settings} label="Gestão de Equipe" />
          )}
        </div>

        <div className={`p-4 mt-auto border-t border-white/5 bg-black/40 flex flex-col gap-4`}>
          <div 
            onClick={() => setActiveTab('perfil')}
            className="flex items-center gap-4 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors group/profile"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[#facc15] shrink-0 border border-white/5 uppercase font-black text-xs overflow-hidden">
              {userProfile?.foto_url ? (
                <img src={userProfile.foto_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userProfile?.nome ? userProfile.nome.charAt(0) : <User className="w-4 h-4" />
              )}
            </div>
            {isSidebarExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white uppercase truncate group-hover/profile:text-[#facc15] transition-colors">{userProfile?.nome || 'Usuário Nexus'}</p>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{userProfile?.nivel_acesso || 'Operacional'}</p>
              </div>
            )}
            
            {isSidebarExpanded && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
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
          {activeTab === 'analise_gargalos' && <RelatorioAnaliticoPorLinha />}
          {activeTab === 'calendario_vendas' && <CalendarioVendas />}
          {activeTab === 'relatorio_boletim' && <RelatorioBoletim />}
          {activeTab === 'perfil' && <Perfil userProfile={userProfile} onProfileUpdate={handleProfileUpdate} />}
          {activeTab === 'usuarios' && userProfile?.nivel_acesso === 'admin' && <Usuarios />}
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
        {(role === 'admin' || role === 'lider') && (
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
              {role === 'admin' && (
                <>
                  <NavItem id="kanban" icon={LayoutGrid} label="Programação" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="vendas" icon={ShoppingCart} label="Pedidos" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="calendario_vendas" icon={CalendarDays} label="Calendário" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="produtos" icon={Package} label="Catálogo" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="usuarios" icon={Settings} label="Gestão Equipe" onClick={() => setIsMobileMenuOpen(false)} />
                </>
              )}
              {(role === 'admin' || role === 'lider') && (
                <>
                  <div className="h-px bg-white/5 my-4" />
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] px-4 mb-2">Relatórios</p>
                  <NavItem id="analise_disponibilidade" icon={Scale} label="Balanço" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="relatorio_boletim" icon={Calculator} label="Boletim Turno" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="relatorio_registros" icon={ClipboardPenLine} label="Registros Detalhados" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="relatorios_downtime" icon={ZapOff} label="Downtime" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="relatorios_downtime_horas" icon={Clock} label="Downtime (Horas)" onClick={() => setIsMobileMenuOpen(false)} />
                  <NavItem id="analise_gargalos" icon={TrendingDown} label="Gargalos" onClick={() => setIsMobileMenuOpen(false)} />
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
  );
};

export default App;
