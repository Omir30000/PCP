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
  ChevronLeft,
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

  const getPeriodoSemana = () => {
    const now = new Date();
    const day = now.getDay();
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
      hoje: day === 0 ? 7 : day
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

  const metasSemanais = useMemo(() => {
    const periodo = getPeriodoSemana();
    const diasRestantes = 7 - periodo.hoje;
    const metaPorSKU: Record<string, { programado: number, realizado: number, nome: string }> = {};
    programacaoSemanal.forEach(prog => {
      const prod = produtos.find(p => p.id === prog.produto_id);
      const pid = prog.produto_id;
      if (!metaPorSKU[pid]) {
        metaPorSKU[pid] = { programado: 0, realizado: 0, nome: prod?.nome || 'SKU INDEFINIDO' };
      }
      metaPorSKU[pid].programado += (Number(prog.quantidade_planejada) || 0);
    });
    todosRegistrosSemana.forEach(reg => {
      const pid = reg.produto_volume;
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
      let somaFardos = 0;
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
      {/* Header Nexus Premium */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl mb-4">
        <div className="flex items-center gap-5">
          <div className="bg-[#facc15] p-4 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.3)] text-black">
            <Zap className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Nexus Command</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" /> Gestão de Planta em Tempo Real
            </p>
          </div>
        </div>
      </div>

      {/* Bar de Controle Premium */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={() => {
            const d = new Date(filtroData);
            d.setDate(d.getDate() - 1);
            setFiltroData(d.toISOString().split('T')[0]);
          }} className="p-2 hover:bg-[#facc15] hover:text-black rounded-xl text-slate-400 transition-all bg-white/5 border border-white/5">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl border-2 border-white/5 focus-within:border-[#facc15] transition-all shadow-sm">
            <Calendar className="w-5 h-5 text-[#facc15]" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Data de Operação</span>
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-[#facc15] transition-colors"
              />
            </div>
          </div>
          <button onClick={() => {
            const d = new Date(filtroData);
            d.setDate(d.getDate() + 1);
            setFiltroData(d.toISOString().split('T')[0]);
          }} className="p-2 hover:bg-[#facc15] hover:text-black rounded-xl text-slate-400 transition-all bg-white/5 border border-white/5">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 backdrop-blur-sm">
          {['GLOBAL', 'MANHÃ', 'TARDE'].map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTurno(t as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filtroTurno === t ? 'bg-[#facc15] text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'text-slate-400 hover:text-white'
                }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs Globais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="w-5 h-5 text-[#facc15]" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rendimento</span>
          </div>
          <h3 className="text-4xl font-black text-white tracking-tighter leading-none mb-1">
            {metrics.oeeMedio.toFixed(1)}%
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
        </div>
        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Downtime</span>
          </div>
          <h3 className="text-4xl font-black text-white tracking-tighter leading-none mb-1">{metrics.totalDowntime}m</h3>
        </div>
        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <Package className="w-5 h-5 text-[#facc15]" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Produzido</span>
          </div>
          <h3 className="text-4xl font-black text-white tracking-tighter leading-none mb-1">{metrics.totalProduzido.toLocaleString()}</h3>
        </div>
      </div>

      {/* Cockpit de Linhas */}
      <div className="space-y-6">
        <h2 className="text-xl font-black text-white uppercase tracking-tighter border-l-4 border-[#facc15] pl-4">Cockpit de Produção</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {lineMonitor.map(line => (
            <div key={line.id} className={`bg-[#141414] border p-8 rounded-[32px] transition-all duration-500 shadow-xl ${line.alertSeverity === 'CRITICAL' ? 'border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.15)]' : 'border-white/5 hover:border-[#facc15]/20'
              }`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                  <div className={`p-5 rounded-2xl ${line.alertSeverity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-500' : 'bg-[#22c55e]/10 text-[#22c55e]'}`}>
                    <Cpu className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white uppercase tracking-tighter">{line.nome}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-2 h-2 rounded-full ${line.alertSeverity === 'CRITICAL' ? 'bg-rose-500' : 'bg-[#22c55e]'}`} />
                      <span className="text-[10px] font-black uppercase text-slate-500">{line.status}</span>
                      <button onClick={() => setModalLinha(line)} className="p-1 bg-white/5 text-slate-500 hover:text-[#facc15] rounded-md transition-all">
                        <History className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-500 uppercase">Eficiência</p>
                  <p className="text-3xl font-black text-white">{line.oee.toFixed(1)}%</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
                  <span className="text-[#facc15] uppercase tracking-widest">{line.produto}</span>
                  <span className="uppercase">Meta: {line.metaPCP.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${line.alertSeverity === 'CRITICAL' ? 'bg-rose-500' : 'bg-[#22c55e]'}`} style={{ width: `${line.progresso}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metas Semanais */}
      <div className="bg-[#141414] border border-white/5 p-10 rounded-[40px] shadow-2xl overflow-hidden">
        <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
          <ListChecks className="w-6 h-6 text-blue-400" /> Metas Semanais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {metasSemanais.map((meta) => (
            <div key={meta.id} className="bg-black/40 border border-white/5 p-6 rounded-3xl relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 ${meta.status === 'CONCLUÍDO' ? 'bg-[#22c55e]' : 'bg-blue-500'}`} />
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-xs font-black text-white uppercase truncate pr-4">{meta.nome}</h4>
                <span className="text-lg font-black text-white">{meta.progresso.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${meta.status === 'CONCLUÍDO' ? 'bg-[#22c55e]' : 'bg-blue-500'}`} style={{ width: `${meta.progresso}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pareto e Impacto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#141414] border border-white/5 p-8 rounded-[40px] shadow-2xl overflow-hidden">
          <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-4">
            <TrendingUp className="w-5 h-5 text-blue-400" /> Pareto de Inatividade
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.chartData} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                  {metrics.chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[#141414] border border-white/5 p-8 rounded-[40px] shadow-2xl flex flex-col justify-center items-center text-center">
          <Scale className="w-12 h-12 text-blue-400 mb-6" />
          <h4 className="text-sm font-black text-slate-400 uppercase mb-2">Impacto Total</h4>
          <p className="text-4xl font-black text-white">{(metrics.totalDowntime / 60).toFixed(1)}h</p>
        </div>
      </div>

      {/* Modal Logs */}
      {modalLinha && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setModalLinha(null)} />
          <div className="bg-[#1a1a1a] rounded-[40px] shadow-2xl w-full max-w-2xl relative z-10 border border-white/10 overflow-hidden">
            <header className="px-10 py-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`p-4 rounded-2xl ${modalLinha.alertSeverity === 'CRITICAL' ? 'bg-rose-500' : 'bg-[#facc15]'} text-black`}>
                  <Timer className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Eventos do Dia</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase mt-2">{modalLinha.nome}</p>
                </div>
              </div>
              <button onClick={() => setModalLinha(null)} className="p-4 text-slate-500 hover:text-white"><X className="w-10 h-10" /></button>
            </header>
            <div className="p-10 space-y-4 max-h-[60vh] overflow-y-auto">
              {modalLinha.paradas.map((p: any, idx: number) => (
                <div key={idx} className="bg-black/40 border border-white/5 p-6 rounded-[24px] flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <AlertTriangle className="w-6 h-6 text-slate-500" />
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase">Motivo</p>
                      <h5 className="text-sm font-black text-white uppercase">{p.motivo || 'NÃO ESPECIFICADO'}</h5>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-white">{parseMinutos(p.duracao || p.total_min)}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
