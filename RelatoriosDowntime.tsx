
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Linha, Maquina, RegistroProducao, Produto } from './types/database';
import {
  Printer,
  Calendar,
  Search,
  Loader2,
  Activity,
  Timer,
  Settings,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
  Factory,
  BarChart2,
  AlertTriangle,
  History,
  Box,
  Package,
  X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const EmptyChartState = () => (
  <div className="h-full flex flex-col items-center justify-center text-slate-300">
    <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
    <p className="text-[11px] font-black uppercase tracking-widest text-center">Aguardando Lançamentos<br />Operacionais</p>
  </div>
);

const RelatoriosDowntime: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [linhaId, setLinhaId] = useState<string>('todos');
  const [turno, setTurno] = useState<string>('todos');

  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Helper robusto para extração de minutos de campos variados (JSONB)
  const parseMinutos = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const match = String(val).match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Sincronização mestre com filtros no servidor para maior precisão
      let query = supabase
        .from('registros_producao')
        .select('*, produtos(*), linhas(*)')
        .gte('data_registro', dataInicio)
        .lte('data_registro', dataFim)
        .order('data_registro', { ascending: false });

      if (turno !== 'todos') {
        query = query.eq('turno', turno);
      }

      if (linhaId !== 'todos') {
        query = query.eq('linha_id', linhaId);
      }

      const [regsRes, linesRes, machRes] = await Promise.all([
        query,
        supabase.from('linhas').select('*').order('nome'),
        supabase.from('maquinas').select('*')
      ]);

      if (regsRes.error) throw regsRes.error;

      if (linesRes.data) setLinhas(linesRes.data);
      if (machRes.data) setMaquinas(machRes.data);
      if (regsRes.data) setRegistros(regsRes.data);

    } catch (err: any) {
      console.error("Nexus Downtime Sync Error:", err);
      alert("Erro ao sincronizar dados: " + (err.message || "Erro de conexão"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = () => {
    if (!reportRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = reportRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>ANALÍTICA DE DOWNTIME - NEXUS PCP</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
            @media print {
              @page { size: A4 portrait; margin: 1cm; }
              body { zoom: 0.95; -webkit-print-color-adjust: exact; }
              .bg-red-500 { background-color: #ef4444 !important; color: white !important; }
              .print-force-page-1 { height: auto; min-height: 270mm; position: relative; }
              .print-break-before { page-break-before: always; break-before: page; }
            }
          </style>
      </head>
      <body>
          <div class="p-8">${content}</div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 800); };
          </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const analytics = useMemo(() => {
    let totalDowntime = 0;
    let totalStopsCount = 0;
    let volumeLost = 0;
    let totalProduced = 0;
    const byEquipment: Record<string, number> = {};
    const byEquipmentCount: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const detailedFailures: any[] = [];
    let totalNominal = 0;

    registros.forEach(reg => {
      // Extração segura do JSONB de paradas
      const paradasRaw = reg.paradas;
      const paradas = Array.isArray(paradasRaw) ? paradasRaw : [];
      totalProduced += Number(reg.quantidade_produzida) || 0;

      // Prioriza EXATAMENTE o valor da tabela de produtos conforme solicitado pelo usuário
      const nominalCap = Number(reg.produtos?.capacidade_nominal) || Number(reg.capacidade_producao) || 7200;
      totalNominal += nominalCap;

      // Cálculo de eficiência: Nominal sempre baseada em 8 horas (480 min) para ser exato
      // Fórmula: (Capacidade Master do Produto / 480) * Minutos de Parada
      const capPerMin = nominalCap / 480;

      const unidadesPorFardo = Number(reg.produtos?.unidades_por_fardo) || 0;

      paradas.forEach((p: any) => {
        // Suporte a múltiplos nomes de campos no JSON (duracao, tempo, total_min)
        const dur = parseMinutos(p.duracao || p.tempo || p.total_min || 0);
        const type = (p.tipo || 'NÃO PLANEJADA').toUpperCase();

        if (dur <= 0) return;

        // Se for PARADA PROGRAMADA, não somamos na inatividade total, mas a Nominal permanece BRUTA conforme solicitado
        if (type !== 'PARADA PROGRAMADA') {
          totalDowntime += dur;
          totalStopsCount += 1;
        }

        // Histórico técnico para gráficos e tabela (mantém tudo)
        const mObj = maquinas.find(m => m.id === p.maquina_id);
        const equipName = p.maquina || (mObj ? mObj.nome : (p.equipamento || 'GERAL'));

        // Apenas alimenta os gráficos se NÃO for parada programada
        if (type !== 'PARADA PROGRAMADA') {
          byEquipment[equipName] = (byEquipment[equipName] || 0) + dur;
          byEquipmentCount[equipName] = (byEquipmentCount[equipName] || 0) + 1;
          byType[type] = (byType[type] || 0) + dur;
        }

        detailedFailures.push({
          data: reg.data_registro,
          linha: reg.linhas?.nome || 'LINHA DESCONHECIDA',
          turno: reg.turno || 'N/A',
          produto: reg.produto_volume || (reg.produtos?.nome || 'N/A'),
          nominal: nominalCap,
          equipamento: equipName,
          tipo: type,
          motivo: p.motivo || 'GERAL',
          duracao: dur,
          obs: reg.observacoes,
          volumePerdido: Math.round(dur * capPerMin),
          unidadesPorFardo: unidadesPorFardo
        });
      });
    });

    // Gráfico 1: Minutos por Tipo (Barra Vertical)
    const typeBarData = Object.entries(byType)
      .map(([name, value]) => ({
        name,
        minutos: value
      }))
      .sort((a, b) => b.minutos - a.minutos);

    // Gráfico 2: Minutos por Equipamento (Barra Horizontal / Pareto)
    const equipBarData = Object.entries(byEquipment)
      .map(([name, value]) => ({
        name,
        minutos: value
      }))
      .sort((a, b) => b.minutos - a.minutos)
      .slice(0, 10);

    // Indicadores de Manutenção
    const mttr = totalStopsCount > 0 ? totalDowntime / totalStopsCount : 0;

    // Detecção de Top 3 Equipamentos Críticos (Por Frequência - Ignorando Programadas)
    // Recalcular byEquipmentCount apenas para não programadas se necessário, ou filtrar no final
    const filteredByEquipmentCount: Record<string, number> = {};
    detailedFailures.forEach(f => {
      if (f.tipo !== 'PARADA PROGRAMADA') {
        filteredByEquipmentCount[f.equipamento] = (filteredByEquipmentCount[f.equipamento] || 0) + 1;
      }
    });

    const topEquipments = Object.entries(filteredByEquipmentCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return {
      totalDowntime: totalDowntime || 0,
      totalStopsCount: totalStopsCount || 0,
      volumeLost: Math.round(totalProduced - totalNominal) || 0,
      totalProduced: totalProduced || 0,
      mttr: mttr || 0,
      typeBarData,
      equipBarData,
      topEquipments,
      somaNominal: Math.round(totalNominal) || 0,
      detailedFailures: detailedFailures.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    };
  }, [registros, maquinas]);

  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-100 print:text-black">

      {/* Controles Nexus */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl print:hidden">
        <div className="flex items-center gap-4 w-full xl:w-auto">
          <div className="p-3 bg-red-600 rounded-xl text-white shadow-lg shadow-red-500/20">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-tight">Analítica de Downtime</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1">Sincronização de Inatividade JSONB</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border-2 border-white/5 focus-within:border-red-500 transition-all shadow-sm">
              <Calendar className="w-5 h-5 text-red-400" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Início</span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="bg-transparent text-[11px] font-black uppercase outline-none text-white cursor-pointer hover:text-red-400 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border-2 border-white/5 focus-within:border-red-500 transition-all shadow-sm">
              <Calendar className="w-5 h-5 text-red-400" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fim</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="bg-transparent text-[11px] font-black uppercase outline-none text-white cursor-pointer hover:text-red-400 transition-colors"
                />
              </div>
            </div>
          </div>

          <select
            value={turno}
            onChange={e => setTurno(e.target.value)}
            className="bg-white/10 border border-white/10 p-2 rounded-xl text-xs font-bold uppercase outline-none cursor-pointer text-white"
          >
            <option value="todos" className="bg-slate-900">Todos os Turnos</option>
            <option value="1º Turno" className="bg-slate-900">1º Turno</option>
            <option value="2º Turno" className="bg-slate-900">2º Turno</option>
          </select>

          <select
            value={linhaId}
            onChange={e => setLinhaId(e.target.value)}
            className="bg-white/10 border border-white/10 p-2 rounded-xl text-xs font-bold uppercase outline-none cursor-pointer text-white"
          >
            <option value="todos" className="bg-slate-900">Grade Completa</option>
            {linhas.map(l => <option key={l.id} value={l.id} className="bg-slate-900">{l.nome}</option>)}
          </select>

          <button
            onClick={fetchData}
            className="px-6 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Consolidar
          </button>

          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 border border-white/10 shadow-xl"
          >
            <Printer className="w-4 h-4" />
            Imprimir A4
          </button>
        </div>
      </div>

      {/* Relatório A4 Core */}
      <div ref={reportRef} className="bg-white p-0 space-y-10 print:p-0">

        {/* Cabeçalho de Auditoria */}
        <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 break-inside-avoid">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center font-black text-white text-3xl">P</div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Smart Production Hub</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Monitoramento de Inatividade e Confiabilidade Industrial</p>
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">RELATÓRIO TÉCNICO DE DOWNTIME</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              Período: {dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
            </p>
          </div>
        </header>

        {/* KPIs Consolidados */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 break-inside-avoid">
          <div className="border border-slate-200 rounded-2xl p-6 bg-white relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><Timer className="w-8 h-8 text-slate-400" /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inatividade Total</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none">{analytics.totalDowntime} <span className="text-xs font-bold text-slate-500">minutos</span></h4>
            <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Duração Bruta Acumulada</p>
          </div>
          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
            <div className="absolute top-0 right-0 p-2"><AlertCircle className="w-8 h-8 text-red-100" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Top 3 Equipamentos Críticos</p>
              <div className="space-y-2">
                {analytics.topEquipments.length > 0 ? (
                  analytics.topEquipments.map((equip, idx) => (
                    <div key={idx} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                          {idx + 1}
                        </span>
                        <span className={`text-[11px] font-bold uppercase truncate max-w-[120px] ${idx === 0 ? 'text-red-700' : 'text-slate-600'
                          }`}>
                          {equip.name}
                        </span>
                      </div>
                      <span className="text-[9px] font-black text-slate-400 group-hover:text-slate-600 transition-colors">
                        {equip.count} paradas
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xl font-black text-slate-300">--</p>
                )}
              </div>
            </div>
          </div>
          <div className="border border-slate-200 rounded-2xl p-6 bg-white relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-2 opacity-10"><Activity className="w-8 h-8 text-slate-400" /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">MTTR (Média)</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none">{analytics.mttr.toFixed(1)} <span className="text-xs font-bold text-slate-500">min</span></h4>
            <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Recuperação Média de Falha</p>
          </div>
          <div className="border border-blue-100 rounded-2xl p-6 bg-blue-50 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-2 opacity-20"><Box className="w-8 h-8 text-blue-600" /></div>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Volume Produzido</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-blue-700 tracking-tighter">{(analytics.totalProduced).toLocaleString('pt-BR')} <span className="text-[10px] font-bold opacity-60">un</span></p>
            </div>
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mt-1 italic">Produção Efetiva no Período</p>
          </div>

          <div className="border border-slate-200 rounded-2xl p-6 bg-white relative overflow-hidden shadow-sm font-bold">
            <div className="absolute top-0 right-0 p-2 opacity-10"><Package className="w-8 h-8 text-slate-400" /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Produtivo</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{(analytics.volumeLost).toLocaleString('pt-BR')} <span className="text-[10px] font-bold opacity-60">un</span></p>
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 italic text-center w-full">Estimativa de Perda Volumétrica</p>
          </div>

          <div className="border border-emerald-100 rounded-2xl p-6 bg-emerald-50 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-2 opacity-20"><TrendingUp className="w-8 h-8 text-emerald-600" /></div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Soma Nominal</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-emerald-700 tracking-tighter">{(analytics.somaNominal).toLocaleString('pt-BR')} <span className="text-[10px] font-bold opacity-60">un</span></p>
            </div>
            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-1 italic text-center w-full">Capacidade Teórica Acumulada</p>
          </div>
        </section>

        {/* II. Análise Visual e Comparativa */}
        <section className="space-y-4 break-inside-avoid px-2">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <TrendingUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <h3 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.3em] flex items-center gap-2">
              II. Análise de Causa Raiz e Impacto por Máquina
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gráfico 1: Minutos por Tipo */}
            <div className="border border-slate-200 rounded-3xl p-8 bg-white h-[450px] flex flex-col shadow-sm">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-600" /> Impacto por Tipo de Parada (M)
              </h3>
              <div className="flex-1 w-full">
                {analytics.typeBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.typeBarData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <RechartsTooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', color: '#1e293b' }}
                      />
                      <Bar dataKey="minutos" radius={[6, 6, 0, 0]} fill="#0891b2">
                        {analytics.typeBarData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#0891b2' : '#0e7490'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>
            </div>

            {/* Gráfico 2: Minutos por Equipamento */}
            <div className="border border-slate-200 rounded-3xl p-8 bg-white h-[450px] flex flex-col shadow-sm">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" /> Pareto de Equipamentos Críticos (M)
              </h3>
              <div className="flex-1 w-full">
                {analytics.equipBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.equipBarData}
                      layout="vertical"
                      margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                        width={100}
                      />
                      <RechartsTooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }}
                      />
                      <Bar dataKey="minutos" radius={[0, 6, 6, 0]} fill="#2563eb" barSize={20}>
                        {analytics.equipBarData.map((entry, index) => (
                          <Cell key={`cell-e-${index}`} fill={index < 3 ? '#2563eb' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Tabela de Detalhamento Cronológico */}
        <section className="space-y-4 print-break-before pt-6">
          <h3 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.3em] flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> III. Registro Histórico de Eventos de Inatividade
          </h3>
          <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-900">
                    <th className="px-2 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Data</th>
                    <th className="px-2 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-center">Turno</th>
                    <th className="px-2 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Linha</th>
                    <th className="px-2 py-3 text-[8px] font-black text-slate-900 uppercase tracking-widest">Produto</th>
                    <th className="px-2 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-center">Nominal</th>
                    <th className="px-2 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Máquina</th>
                    <th className="px-2 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Motivo</th>
                    <th className="px-2 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-right">Dur.</th>
                    <th className="px-2 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-right">Perda Est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[9px] bg-white">
                  {analytics.detailedFailures.map((fail, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${fail.duracao > 30 ? 'bg-red-50/50' : ''}`}>
                      <td className="px-2 py-2 font-bold text-slate-600 whitespace-nowrap">{formatarDataBR(fail.data)}</td>
                      <td className="px-2 py-2 text-center text-slate-900 font-black">{fail.turno}</td>
                      <td className="px-2 py-2 text-blue-700 font-black whitespace-nowrap">{fail.linha}</td>
                      <td className="px-2 py-2 font-bold text-slate-900 truncate max-w-[100px]">{fail.produto}</td>
                      <td className="px-2 py-2 text-center text-slate-500 font-bold">{fail.nominal.toLocaleString('pt-BR')}</td>
                      <td className="px-2 py-2 font-black text-slate-900 uppercase whitespace-nowrap">{fail.equipamento}</td>
                      <td className="px-3 py-2 text-slate-700 leading-tight">
                        <p className="font-bold uppercase text-[8px]">{fail.motivo}</p>
                        {fail.obs && <p className="text-[7px] text-slate-400 italic truncate max-w-[150px]">Obs: {fail.obs}</p>}
                      </td>
                      <td className={`px-3 py-2 text-right font-black ${fail.duracao > 30 ? 'text-red-600' : 'text-slate-900'} whitespace-nowrap`}>
                        {fail.duracao}m
                        {fail.duracao > 30 && <AlertTriangle className="w-2.5 h-2.5 inline ml-0.5 align-middle" />}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700 font-bold whitespace-nowrap">
                        <div className="flex flex-col items-end leading-none">
                          <span>{fail.volumePerdido.toLocaleString('pt-BR')} un</span>
                          {fail.unidadesPorFardo > 0 && (
                            <span className="text-[7px] opacity-60">
                              ≈ {Math.round(fail.volumePerdido / fail.unidadesPorFardo)} fd
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {analytics.detailedFailures.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-slate-300 dark:text-slate-700 uppercase font-bold tracking-widest italic">
                        Sem inatividade reportada no período selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Rodapé Nexus */}
        <footer className="pt-12 border-t-2 border-slate-900 dark:border-white/20 break-inside-avoid">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 mb-16">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              <div>
                <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Documento Técnico Nexus PCP - v2.1</p>
                <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Autenticação de Dados Industrial: {Math.random().toString(36).substring(7).toUpperCase()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Emitido em: {new Date().toLocaleString('pt-BR')}</p>
              <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1 tracking-widest">Validação de Disponibilidade Operacional</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-20">
            <div className="text-center">
              <div className="border-t border-slate-900 dark:border-white/20 pt-3"></div>
              <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Engenharia de Manutenção / PCP</p>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-900 dark:border-white/20 pt-3"></div>
              <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Coordenação de Operações Industriais</p>
            </div>
          </div>
        </footer>
      </div>

    </div>
  );
};

export default RelatoriosDowntime;
