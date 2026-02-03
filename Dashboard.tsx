
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { Linha, Produto } from './types/database';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { 
  Activity, 
  Timer, 
  AlertTriangle, 
  Package, 
  RefreshCw, 
  TrendingUp, 
  BarChart3, 
  Clock, 
  Calendar, 
  ChevronRight, 
  Cpu, 
  Zap, 
  AlertCircle, 
  X, 
  History, 
  Target, 
  Scale, 
  ShieldAlert,
  ListChecks,
  CalendarCheck,
  CheckCircle2,
  AlertCircle as AlertIcon,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';

const COLORS = ['#facc15', '#ef4444', '#3b82f6', '#10b981', '#a78bfa', '#f43f5e', '#06b6d4'];

const Dashboard: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [programacaoSemanal, setProgramacaoSemanal] = useState<any[]>([]);
  const [todosRegistrosSemana, setTodosRegistrosSemana] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filtroData, setFiltroData] = useState(getHoje());
  const [filtroTurno, setFiltroTurno] = useState<'GLOBAL' | 'MANHÃ' | 'TARDE'>('GLOBAL');
  
  const [modalLinha, setModalLinha] = useState<any | null>(null);

  // Helper para cálculo da semana vigente (Segunda a Domingo)
  const getPeriodoSemana = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Dom, 1 = Seg...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return {
      inicio: monday.toISOString().split('T')[0],
      fim: sunday.toISOString().split('T')[0],
      hoje: day === 0 ? 7 : day // 1 a 7
    };
  };

  const mapTurnoParaDB = (uiValue: string) => {
    if (uiValue === 'MANHÃ') return '1º turno';
    if (uiValue === 'TARDE') return '2º turno';
    return null;
  };

  const parseMinutos = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const match = String(val).match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  };

  const fetchData = async () => {
    setLoading(true);
    const periodo = getPeriodoSemana();
    try {
      const [linRes, prodRes, regRes, progRes, regSemanaRes] = await Promise.all([
        supabase.from('linhas').select('*').order('nome'),
        supabase.from('produtos').select('*'),
        supabase.from('registros_producao').select('*').eq('data_registro', filtroData).order('created_at', { ascending: false }),
        supabase.from('programacao_semanal' as any).select('*').gte('dia_semana', periodo.inicio).lte('dia_semana', periodo.fim),
        supabase.from('registros_producao').select('*').gte('data_registro', periodo.inicio).lte('data_registro', periodo.fim)
      ]);

      setLinhas(linRes.data || []);
      setProdutos(prodRes.data || []);
      setRegistros(regRes.data || []);
      setProgramacaoSemanal(progRes.data || []);
      setTodosRegistrosSemana(regSemanaRes.data || []);
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filtroData]);

  // Inteligência de Cumprimento de Metas (Independente de Filtros de Turno)
  const metasSemanais = useMemo(() => {
    const periodo = getPeriodoSemana();
    const diasRestantes = 7 - periodo.hoje;
    
    // Agrupa Metas por SKU
    const metaPorSKU: Record<string, { programado: number, realizado: number, nome: string }> = {};

    programacaoSemanal.forEach(prog => {
      const prod = produtos.find(p => p.id === prog.produto_id);
      const pid = prog.produto_id;
      if (!metaPorSKU[pid]) {
        metaPorSKU[pid] = { programado: 0, realizado: 0, nome: prod?.nome || 'SKU INDEFINIDO' };
      }
      metaPorSKU[pid].programado += (Number(prog.quantidade_planejada) || 0);
    });

    // Soma Realizado por SKU na semana
    todosRegistrosSemana.forEach(reg => {
      const pid = reg.produto_volume;
      // Tenta achar pelo ID ou Nome para retrocompatibilidade
      const prod = produtos.find(p => p.id === pid || p.nome === pid);
      if (prod && metaPorSKU[prod.id]) {
        metaPorSKU[prod.id].realizado += (Number(reg.quantidade_produzida) || 0);
      }
    });

    return Object.entries(metaPorSKU).map(([id, data]) => {
      const progresso = data.programado > 0 ? (data.realizado / data.programado) * 100 : 0;
      let status: 'CONCLUÍDO' | 'EM ANDAMENTO' | 'ATRASADO' = 'EM ANDAMENTO';
      
      if (progresso >= 100) status = 'CONCLUÍDO';
      else if (diasRestantes <= 2 && progresso < 50) status = 'ATRASADO';

      return { id, ...data, progresso, status };
    }).sort((a, b) => a.progresso - b.progresso);
  }, [programacaoSemanal, todosRegistrosSemana, produtos]);

  const registrosFiltrados = useMemo(() => {
    if (filtroTurno === 'GLOBAL') return registros;
    const dbValue = mapTurnoParaDB(filtroTurno);
    return registros.filter(r => {
      const turnoRegistro = String(r.turno || '').toLowerCase().trim();
      return dbValue ? turnoRegistro.includes(dbValue) : true;
    });
  }, [registros, filtroTurno]);

  const metrics = useMemo(() => {
    const totalProduzido = registrosFiltrados.reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);
    let totalDowntime = 0;
    let totalIncidentes = 0;
    let totalMetaAcumuladaGlobal = 0;
    const motivosMap: Record<string, number> = {};

    registrosFiltrados.forEach(r => {
      const prod = produtos.find(p => p.id === r.produto_volume || p.nome === r.produto_volume);
      const capNominal = prod ? (Number(prod.capacidade_nominal) || 0) : 0;
      totalMetaAcumuladaGlobal += capNominal;

      const paradasArr = Array.isArray(r.paradas) ? r.paradas : [];
      totalIncidentes += paradasArr.length;
      paradasArr.forEach((p: any) => {
        const dur = parseMinutos(p.duracao || p.total_min);
        totalDowntime += dur;
        const motivo = (p.motivo || 'OUTROS').toUpperCase();
        motivosMap[motivo] = (motivosMap[motivo] || 0) + dur;
      });
    });

    const chartData = Object.entries(motivosMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const oeeMedio = totalMetaAcumuladaGlobal > 0 ? (totalProduzido / totalMetaAcumuladaGlobal) * 100 : 0;
    return { totalProduzido, totalDowntime, totalIncidentes, oeeMedio, chartData };
  }, [registrosFiltrados, produtos]);

  const lineMonitor = useMemo(() => {
    const dbValueTarget = mapTurnoParaDB(filtroTurno);

    return linhas.map(l => {
      const lineRegsAll = registros.filter(r => 
        String(r.linha_producao).toUpperCase() === String(l.id).toUpperCase() ||
        String(r.linha_producao).toUpperCase() === String(l.nome).toUpperCase()
      );

      const lineRegsContext = filtroTurno === 'GLOBAL' 
        ? lineRegsAll 
        : lineRegsAll.filter(r => String(r.turno || '').toLowerCase().trim().includes(dbValueTarget || ''));
      
      let somaProduzido = 0;
      let somaMetaTurnosLinha = 0;
      let totalDowntimeLinha = 0;
      const skus = new Set<string>();
      const allParadas: any[] = [];
      const motivosAgregados: Record<string, number> = {};

      lineRegsContext.forEach(reg => {
        somaProduzido += (Number(reg.quantidade_produzida) || 0);
        const produto = produtos.find(p => p.id === reg.produto_volume || p.nome === reg.produto_volume);
        const capNominal = produto ? (Number(produto.capacidade_nominal) || 0) : 0;
        somaMetaTurnosLinha += capNominal;

        if (produto) skus.add(produto.nome.toUpperCase());
        else skus.add(String(reg.produto_volume).toUpperCase());

        const paradas = Array.isArray(reg.paradas) ? reg.paradas : [];
        paradas.forEach((p: any) => {
          const dur = parseMinutos(p.duracao || p.total_min);
          totalDowntimeLinha += dur;
          allParadas.push(p);
          const mot = String(p.motivo || 'OUTROS').toUpperCase();
          motivosAgregados[mot] = (motivosAgregados[mot] || 0) + dur;
        });
      });

      const oee = somaMetaTurnosLinha > 0 ? (somaProduzido / somaMetaTurnosLinha) * 100 : 0;
      
      let alertSeverity: 'NONE' | 'MODERATE' | 'CRITICAL' = 'NONE';
      if (totalDowntimeLinha > 30) alertSeverity = 'CRITICAL';
      else if (totalDowntimeLinha > 0) alertSeverity = 'MODERATE';

      let status = lineRegsContext.length > 0 ? 'Operando' : 'Sem Apontamento';
      if (alertSeverity === 'CRITICAL') status = `CRÍTICO: ${totalDowntimeLinha} MIN`;
      else if (alertSeverity === 'MODERATE') status = `PARADA OPERACIONAL`;

      const resumoMotivos = Object.entries(motivosAgregados)
        .map(([mot, tempo]) => `${tempo}m ${mot}`)
        .join(' / ');

      return {
        id: l.id,
        nome: l.nome,
        status,
        alertSeverity,
        totalDowntime: totalDowntimeLinha,
        resumoMotivos,
        oee,
        produzido: somaProduzido,
        metaPCP: Math.round(somaMetaTurnosLinha), 
        progresso: Math.min(100, oee),
        paradas: allParadas,
        produto: skus.size > 0 ? Array.from(skus).join(' / ') : 'AGUARDANDO SKU'
      };
    });
  }, [linhas, registros, filtroTurno, produtos]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      
      {/* Header Nexus */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="bg-[#facc15] p-4 rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.3)]">
            <Zap className="text-black w-7 h-7" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Nexus Command</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" /> Gestão de Planta em Tempo Real
            </p>
          </div>
        </div>
      </div>

      {/* Bar de Controle */}
      <div className="bg-[#141414] border border-white/5 p-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
           <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
              <button onClick={() => {
                  const d = new Date(filtroData);
                  d.setDate(d.getDate() - 1);
                  setFiltroData(d.toISOString().split('T')[0]);
                }} className="p-1.5 hover:bg-[#facc15] hover:text-black rounded-lg text-slate-400 transition-all">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
              <div className="relative group px-3">
                <Calendar className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#facc15]" />
                <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-white pl-5 cursor-pointer" />
              </div>
              <button onClick={() => {
                  const d = new Date(filtroData);
                  d.setDate(d.getDate() + 1);
                  setFiltroData(d.toISOString().split('T')[0]);
                }} className="p-1.5 hover:bg-[#facc15] hover:text-black rounded-lg text-slate-400 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              {(['GLOBAL', 'MANHÃ', 'TARDE'] as const).map((t) => (
                <button 
                  key={t} 
                  onClick={() => setFiltroTurno(t)} 
                  className={`px-6 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filtroTurno === t ? 'bg-[#facc15] text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'text-slate-500 hover:text-white'}`}
                >
                  {t === 'GLOBAL' ? 'Global' : t === 'MANHÃ' ? '1º Turno' : '2º Turno'}
                </button>
              ))}
           </div>
           <button onClick={fetchData} className="p-3 bg-white/5 hover:bg-[#facc15] hover:text-black rounded-xl text-slate-500 transition-all group">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#facc15]' : ''}`} />
           </button>
        </div>
      </div>

      {/* KPIs Globais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-24 h-24 bg-[#facc15]/5 rounded-full -mr-12 -mt-12 blur-2xl" />
           <div className="flex items-center justify-between mb-4 relative z-10">
              <BarChart3 className="w-5 h-5 text-[#facc15]" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rendimento ({filtroTurno})</span>
           </div>
           <h3 className="text-4xl font-black text-white tracking-tighter leading-none mb-1">
             {metrics.oeeMedio > 0 ? metrics.oeeMedio.toFixed(1) + '%' : '0.0%'}
           </h3>
           <p className="text-[10px] font-bold text-[#22c55e] flex items-center gap-1 uppercase tracking-widest">
             <Activity className="w-3 h-3" /> Eficiência Consolidada
           </p>
        </div>

        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl relative overflow-hidden">
           <div className="flex items-center justify-between mb-4">
              <AlertCircle className={`w-5 h-5 ${metrics.totalIncidentes > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-600'}`} />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Incidentes</span>
           </div>
           <h3 className={`text-4xl font-black tracking-tighter leading-none mb-1 ${metrics.totalIncidentes > 0 ? 'text-rose-500' : 'text-white'}`}>
             {metrics.totalIncidentes}
           </h3>
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Apontamentos com Falha</p>
        </div>

        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl relative overflow-hidden">
           <div className="flex items-center justify-between mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Downtime Total</span>
           </div>
           <h3 className="text-4xl font-black text-white tracking-tighter leading-none mb-1">
             {metrics.totalDowntime}m
           </h3>
           <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Minutos de Inatividade</p>
        </div>

        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
           <div className="flex items-center justify-between mb-4 relative z-10">
              <Package className="w-5 h-5 text-[#facc15]" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Produzido</span>
           </div>
           <h3 className="text-4xl font-black text-white tracking-tighter leading-none mb-1">
             {metrics.totalProduzido.toLocaleString()}
           </h3>
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Volume Realizado</p>
        </div>
      </div>

      {/* Cockpit de Linhas */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
           <div className="flex items-center gap-4">
             <div className="w-1 h-8 bg-[#facc15] shadow-[0_0_10px_#facc15]" />
             <h2 className="text-xl font-black text-white uppercase tracking-tighter">Cockpit de Produção - {filtroTurno}</h2>
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {lineMonitor.map(line => (
            <div key={line.id} className={`bg-[#141414] border p-8 rounded-[32px] group transition-all duration-500 shadow-xl relative overflow-hidden ${
              line.alertSeverity === 'CRITICAL' ? 'border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.15)] animate-pulse' : 
              line.alertSeverity === 'MODERATE' ? 'border-amber-500 shadow-[0_0_20px_rgba(250,204,21,0.1)]' : 'border-white/5 hover:border-[#facc15]/20'
            }`}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-6">
                  <div className={`p-5 rounded-2xl ${
                    line.alertSeverity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-500' : 
                    line.alertSeverity === 'MODERATE' ? 'bg-amber-500/20 text-amber-500' :
                    line.status.includes('Operando') ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-slate-800 text-slate-500'
                  } transition-all group-hover:scale-105`}>
                    <Cpu className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{line.nome}</h4>
                      {line.alertSeverity !== 'NONE' && (
                        <div className={`p-1 rounded-md ${line.alertSeverity === 'CRITICAL' ? 'bg-rose-500 text-white animate-bounce' : 'text-amber-500'}`}>
                          {line.alertSeverity === 'CRITICAL' ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full ${
                        line.alertSeverity === 'CRITICAL' ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 
                        line.alertSeverity === 'MODERATE' ? 'bg-amber-500 shadow-[0_0_10px_#facc15]' :
                        line.status.includes('Operando') ? 'bg-[#22c55e] shadow-[0_0_10px_#22c55e]' : 'bg-slate-700'
                      }`} />
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                        line.alertSeverity === 'CRITICAL' ? 'text-rose-500' : 
                        line.alertSeverity === 'MODERATE' ? 'text-amber-500' :
                        line.status.includes('Operando') ? 'text-[#22c55e]' : 'text-slate-500'
                      }`}>
                        {line.status}
                      </span>
                      <button onClick={() => setModalLinha(line)} className="ml-2 p-1 bg-white/5 text-slate-500 hover:text-[#facc15] rounded-md transition-all">
                        <History className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-10">
                  <div className="text-right">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Eficiência Real</p>
                      <p className={`text-3xl font-black ${line.oee >= 80 ? 'text-[#22c55e]' : line.oee >= 50 ? 'text-[#facc15]' : 'text-rose-500'}`}>
                        {line.oee > 0 ? line.oee.toFixed(1) + '%' : '0.0%'}
                      </p>
                  </div>
                  <div className="text-right border-l border-white/5 pl-10">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Produzido</p>
                      <p className="text-3xl font-black text-white">{line.produzido.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className={`text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-2 truncate ${
                        line.alertSeverity === 'CRITICAL' ? 'text-rose-400' : 'text-[#facc15]'
                      }`}>
                        <Package className="w-3 h-3 shrink-0" /> {line.produto}
                      </p>
                      {line.alertSeverity !== 'NONE' && (
                        <p className={`text-[9px] font-bold uppercase mt-1 italic truncate ${
                          line.alertSeverity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'
                        }`}>
                          ALERTA: {line.resumoMotivos || 'NÃO ESPECIFICADO'}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 shrink-0 ml-4">
                      <Target className="w-3.5 h-3.5 text-blue-500" /> META PCP: {line.metaPCP.toLocaleString()} UN
                    </p>
                </div>
                <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className={`h-full transition-all duration-1000 ease-out ${
                      line.alertSeverity === 'CRITICAL' ? 'bg-rose-500 shadow-[0_0_15px_#ef4444]' : 
                      line.alertSeverity === 'MODERATE' ? 'bg-amber-500 shadow-[0_0_15px_#facc15]' :
                      line.status.includes('Operando') ? 'bg-[#22c55e] shadow-[0_0_15px_#22c55e]' : 'bg-slate-700'
                    }`} style={{ width: `${line.progresso}%` }} />
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                    <span>Base: Cap. Nominal do SKU (Turno Integral)</span>
                    <span>{line.oee.toFixed(1)}% Realizado</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PAINEL DE CUMPRIMENTO DE METAS SEMANAIS - EVOLUÍDO E GRANULAR */}
      <div className="bg-[#141414] border border-white/5 p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-8">
             <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20">
                  <ListChecks className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Status de Entrega Semanal</h3>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 italic">Consolidação Absoluta (Meta Semanal vs. Realizado Acumulado)</p>
                </div>
             </div>
             <div className="flex items-center gap-3">
                <CalendarCheck className="w-5 h-5 text-[#facc15]" />
                <span className="text-[11px] font-black text-[#facc15] uppercase tracking-widest">Ciclo PCP Vigente</span>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {metasSemanais.length > 0 ? metasSemanais.map((meta) => (
              <div key={meta.id} className="bg-black/40 border border-white/5 p-6 rounded-3xl hover:border-white/10 transition-all group relative overflow-hidden">
                 {/* Indicador de Status Neon */}
                 <div className={`absolute top-0 left-0 w-full h-1 ${
                   meta.status === 'CONCLUÍDO' ? 'bg-[#22c55e] shadow-[0_0_10px_#22c55e]' : 
                   meta.status === 'ATRASADO' ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 
                   'bg-blue-500 shadow-[0_0_10px_#3b82f6]'
                 }`} />

                 <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-1 max-w-[70%]">
                       <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ativo Industrial</span>
                       <h4 className="text-xs font-black text-white uppercase truncate">{meta.nome}</h4>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[8px] font-black border uppercase tracking-widest flex items-center gap-1.5 ${
                       meta.status === 'CONCLUÍDO' ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20' : 
                       meta.status === 'ATRASADO' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse' : 
                       'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                       {meta.status === 'CONCLUÍDO' ? <CheckCircle2 className="w-3 h-3" /> : meta.status === 'ATRASADO' ? <AlertIcon className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
                       {meta.status}
                    </div>
                 </div>

                 <div className="flex justify-between items-end mb-4">
                    <div className="text-left">
                       <p className="text-[11px] font-black text-white tracking-tighter">
                         {meta.realizado.toLocaleString()} <span className="text-slate-500 text-[9px] font-bold">/ {meta.programado.toLocaleString()}</span>
                       </p>
                       <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Unidades Produzidas</p>
                    </div>
                    <span className={`text-lg font-black tracking-tighter ${
                      meta.status === 'CONCLUÍDO' ? 'text-[#22c55e]' : 
                      meta.status === 'ATRASADO' ? 'text-rose-500' : 
                      'text-blue-400'
                    }`}>
                       {meta.progresso.toFixed(0)}%
                    </span>
                 </div>

                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${
                       meta.status === 'CONCLUÍDO' ? 'bg-[#22c55e]' : 
                       meta.status === 'ATRASADO' ? 'bg-rose-500' : 
                       'bg-blue-500'
                    }`} style={{ width: `${Math.min(100, meta.progresso)}%` }} />
                 </div>
              </div>
            )) : (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30">
                 <LayoutGrid className="w-10 h-10 mx-auto mb-4 text-slate-500" />
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sem programação registrada para a semana vigente</p>
              </div>
            )}
          </div>
      </div>

      {/* Pareto de Inatividade */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#141414] border border-white/5 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
           <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-blue-500/10 rounded-xl"><TrendingUp className="w-5 h-5 text-blue-400" /></div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Pareto de Inatividade ({filtroTurno})</h3>
           </div>
           <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="h-[250px] w-full md:w-1/2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={metrics.chartData} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                      {metrics.chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-4">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Minutos Acumulados</p>
                 <div className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar pr-2">
                    {metrics.chartData.map((item, index) => (
                      <div key={item.name} className="flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                           <span className="text-[9px] font-black text-slate-400 uppercase group-hover:text-white transition-colors">{item.name}</span>
                        </div>
                        <span className="text-sm font-black text-white">{item.value}m</span>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        <div className="bg-[#141414] border border-white/5 p-8 rounded-[40px] shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden group">
           <Scale className="w-12 h-12 text-blue-400 mb-6" />
           <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Impacto Produtivo</h4>
           <p className="text-3xl font-black text-white tracking-tighter mb-4">{(metrics.totalDowntime / 60).toFixed(1)} h</p>
           <p className="text-[10px] font-bold text-slate-600 uppercase leading-relaxed max-w-[200px]">
             Tempo de inatividade sobre os turnos registrados no período.
           </p>
        </div>
      </div>

      {/* Modal Logs */}
      {modalLinha && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setModalLinha(null)} />
          <div className="bg-[#1a1a1a] rounded-[40px] shadow-2xl w-full max-w-2xl relative z-10 border border-white/10 overflow-hidden animate-in zoom-in-95 duration-500">
            <header className="px-10 py-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`p-4 rounded-2xl ${
                  modalLinha.alertSeverity === 'CRITICAL' ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]' : 
                  modalLinha.alertSeverity === 'MODERATE' ? 'bg-amber-500 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'bg-[#facc15]'
                } text-black`}>
                  <Timer className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Eventos do Dia</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-2">{modalLinha.nome} • {modalLinha.produto}</p>
                </div>
              </div>
              <button onClick={() => setModalLinha(null)} className="p-4 text-slate-500 hover:text-white transition-all"><X className="w-10 h-10" /></button>
            </header>
            <div className="p-10 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
              {modalLinha.paradas.length > 0 ? modalLinha.paradas.map((p: any, idx: number) => (
                <div key={idx} className="bg-black/40 border border-white/5 p-6 rounded-[24px] flex items-center justify-between group hover:border-[#facc15]/20 transition-all">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Motivo</p>
                      <h5 className="text-sm font-black text-white uppercase">{p.motivo || 'NÃO ESPECIFICADO'}</h5>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Duração</p>
                    <span className="text-2xl font-black text-white">{parseMinutos(p.duracao || p.total_min)}m</span>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center text-slate-600 font-black uppercase text-sm tracking-widest">
                   Operação Contínua
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
