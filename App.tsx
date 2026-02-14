
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
  Moon
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
  | 'relatorio_registros'
  | 'analise_gargalos'
  | 'calendario_vendas';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isBiOpen, setIsBiOpen] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('nexus-theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('nexus-theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Sync theme class on mount
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const NavItem = ({ id, icon: Icon, label, isSubItem = false }: { id: Tab, icon: any, label: string, isSubItem?: boolean }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center transition-all duration-300 relative group/item
          ${isSidebarExpanded ? (isSubItem ? 'pl-12 pr-4 py-2.5' : 'px-4 py-3 gap-4') : 'justify-center py-4'}
          ${isActive ? 'text-[#facc15] bg-[#facc15]/5' : 'text-slate-500 hover:text-white hover:bg-white/5'}
          ${!isSubItem ? 'rounded-xl mb-1' : 'mb-0.5'}
        `}
      >
        {isActive && !isSubItem && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#facc15] rounded-r-full shadow-[0_0_15px_#facc15]" />
        )}
        <Icon className={`${isSidebarExpanded ? (isSubItem ? 'w-3.5 h-3.5' : 'w-5 h-5') : 'w-6 h-6'} shrink-0`} />
        {isSidebarExpanded && (
          <span className={`font-black uppercase tracking-[0.15em] whitespace-nowrap overflow-hidden text-[10px]`}>
            {label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`min-h-screen flex overflow-hidden font-sans selection:bg-[#facc15]/30 ${theme === 'dark' ? 'bg-[#0a0a0a] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

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
          <NavItem id="kanban" icon={LayoutGrid} label="Programação" />
          <NavItem id="vendas" icon={ShoppingCart} label="Pedidos" />
          <NavItem id="calendario_vendas" icon={CalendarDays} label="Calendário de Pedidos" />

          <div className="h-px bg-white/5 my-6 mx-4" />

          <NavItem id="registro" icon={ClipboardPenLine} label="Apontamento" />
          <NavItem id="produtos" icon={Package} label="Catálogo" />

          <div className="h-px bg-white/5 my-6 mx-4" />

          {isSidebarExpanded && (
            <p className="px-4 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] mb-4">Inteligência</p>
          )}
          <NavItem id="analise_disponibilidade" icon={Scale} label="Balanço" isSubItem={isSidebarExpanded} />
          <NavItem id="relatorios" icon={FileText} label="Boletim" isSubItem={isSidebarExpanded} />
          <NavItem id="relatorio_registros" icon={ClipboardPenLine} label="Registros" isSubItem={isSidebarExpanded} />
          <NavItem id="relatorios_downtime" icon={ZapOff} label="Downtime" isSubItem={isSidebarExpanded} />
          <NavItem id="analise_gargalos" icon={TrendingDown} label="Gargalos" isSubItem={isSidebarExpanded} />
        </div>

        <div className={`p-4 mt-auto border-t border-white/5 bg-black/40 flex flex-col gap-4`}>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-4 px-2 py-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            {isSidebarExpanded && (
              <span className="text-[10px] font-black uppercase tracking-widest">{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
            )}
          </button>

          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[#facc15] shrink-0 border border-white/5">
              <User className="w-4 h-4" />
            </div>
            {isSidebarExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white uppercase truncate">Gestor Operacional</p>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">NEXUS ID: 001</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className={`flex-1 min-w-0 relative overflow-y-auto h-screen scroll-smooth transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}>
        <div className="relative z-10 px-6 py-8 lg:px-10 lg:py-10 max-w-[1800px] mx-auto">
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
          {activeTab === 'analise_gargalos' && <RelatorioAnaliticoPorLinha />}
          {activeTab === 'calendario_vendas' && <CalendarioVendas />}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default App;
