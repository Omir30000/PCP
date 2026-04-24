
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Linha, Maquina } from './types/database';
import {
  Printer,
  Calendar,
  Search,
  Loader2,
  Activity,
  Timer,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
  BarChart2,
  AlertTriangle,
  History,
  Box,
  Package,
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';

const RelatorioDowntimeTecnico: React.FC = () => {
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

  const parseMinutos = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const match = String(val).match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
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
      console.error("Nexus Tech Report Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const analytics = useMemo(() => {
    let totalDowntime = 0;
    let totalStopsCount = 0;
    let totalProduced = 0;
    let totalNominal = 0;
    const byType: Record<string, number> = {};
    const detailedFailures: any[] = [];
    const equipCount: Record<string, number> = {};

    registros.forEach(reg => {
      const paradasRaw = reg.paradas;
      const paradas = Array.isArray(paradasRaw) ? paradasRaw : [];
      totalProduced += Number(reg.quantidade_produzida) || 0;

      const nominalCap = Number(reg.produtos?.capacidade_nominal) || Number(reg.capacidade_producao) || 7200;
      totalNominal += nominalCap;

      const capPerMin = nominalCap / 480;

      paradas.forEach((p: any) => {
        const dur = parseMinutos(p.duracao || p.tempo || p.total_min || 0);
        const type = (p.tipo || 'NÃO PLANEJADA').toUpperCase();

        if (dur <= 0) return;

        if (type !== 'PARADA PROGRAMADA') {
          totalDowntime += dur;
          totalStopsCount += 1;
          byType[type] = (byType[type] || 0) + dur;
          
          const mObj = maquinas.find(m => m.id === p.maquina_id);
          const equipName = p.maquina || (mObj ? mObj.nome : (p.equipamento || 'GERAL'));
          const fullEquipName = `${equipName} (${reg.linhas?.nome || 'N/A'})`;
          equipCount[fullEquipName] = (equipCount[fullEquipName] || 0) + 1;
        }

        const mObj = maquinas.find(m => m.id === p.maquina_id);
        const equipName = p.maquina || (mObj ? mObj.nome : (p.equipamento || 'GERAL'));

        detailedFailures.push({
          data: reg.data_registro,
          linha: reg.linhas?.nome || 'N/A',
          turno: reg.turno || 'N/A',
          equipamento: equipName,
          tipo: type,
          motivo: p.motivo || 'GERAL',
          duracao: dur,
          volumePerdido: Math.round(dur * capPerMin)
        });
      });
    });

    const typeTableData = Object.entries(byType)
      .map(([name, value]) => ({
        name,
        minutos: value,
        percent: totalDowntime > 0 ? (value / totalDowntime) * 100 : 0
      }))
      .sort((a, b) => b.minutos - a.minutos);

    const top3Types = typeTableData.slice(0, 3).map(t => t.name);

    const top3Details = top3Types.map(typeName => {
      const typeFailures = detailedFailures.filter(f => f.tipo === typeName);
      
      const aggregated: Record<string, any> = {};
      typeFailures.forEach(f => {
        const key = `${f.equipamento}-${f.motivo}`;
        if (!aggregated[key]) {
          aggregated[key] = { ...f };
        } else {
          aggregated[key].duracao += f.duracao;
          aggregated[key].volumeLost += f.volumeLost;
        }
      });

      const failures = Object.values(aggregated).sort((a, b) => b.duracao - a.duracao);
      return { type: typeName, failures };
    });

    const topEquipments = Object.entries(equipCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return {
      totalDowntime,
      totalStopsCount,
      mttr: totalStopsCount > 0 ? totalDowntime / totalStopsCount : 0,
      totalProduced,
      totalNominal,
      volumeLost: Math.round(totalProduced - totalNominal),
      typeTableData,
      top3Details,
      topEquipments
    };
  }, [registros, maquinas]);

  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700 pb-20 font-sans text-slate-200">
      
      {/* HEADER SECTION (Like the photo) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[#0d0d0d] p-6 rounded-2xl border border-white/5 shadow-2xl print:bg-white print:text-black print:border-slate-900">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-[#facc15] rounded-xl flex items-center justify-center font-black text-black text-4xl shadow-[0_0_30px_rgba(250,204,21,0.2)]">
            P
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-none flex items-center gap-3">
              Smart Production Hub
              <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-400 font-bold tracking-widest">v2.5</span>
            </h1>
            <p className="text-[10px] font-black text-[#facc15] uppercase tracking-[0.4em] mt-2 opacity-80">Monitoramento de Inatividade e Confiabilidade Industrial</p>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-lg font-black text-white uppercase tracking-widest mb-1">RELATÓRIO TÉCNICO DE DOWNTIME</h2>
          <div className="flex items-center justify-end gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            <Calendar className="w-3.5 h-3.5 text-[#facc15]" />
            Período: {dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
          </div>
        </div>
      </div>

      {/* FILTERS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 bg-[#0d0d0d]/50 backdrop-blur-xl p-4 rounded-2xl border border-white/5 print:hidden">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Início</span>
          <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/10 focus-within:border-[#facc15] transition-all">
            <Calendar className="w-4 h-4 text-[#facc15]" />
            <input 
              type="date" 
              value={dataInicio} 
              onChange={e => setDataInicio(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none w-full"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Fim</span>
          <div className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/10 focus-within:border-[#facc15] transition-all">
            <Calendar className="w-4 h-4 text-[#facc15]" />
            <input 
              type="date" 
              value={dataFim} 
              onChange={e => setDataFim(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none w-full"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Linha de Produção</span>
          <select 
            value={linhaId} 
            onChange={e => setLinhaId(e.target.value)}
            className="bg-white/5 p-3 rounded-xl border border-white/10 text-xs font-bold text-white outline-none cursor-pointer hover:bg-white/10 transition-colors"
          >
            <option value="todos" className="bg-[#0d0d0d]">Todas as Linhas</option>
            {linhas.map(l => <option key={l.id} value={l.id} className="bg-[#0d0d0d]">{l.nome}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Turno</span>
          <select 
            value={turno} 
            onChange={e => setTurno(e.target.value)}
            className="bg-white/5 p-3 rounded-xl border border-white/10 text-xs font-bold text-white outline-none cursor-pointer hover:bg-white/10 transition-colors"
          >
            <option value="todos" className="bg-[#0d0d0d]">Todos os Turnos</option>
            <option value="1º Turno" className="bg-[#0d0d0d]">1º Turno</option>
            <option value="2º Turno" className="bg-[#0d0d0d]">2º Turno</option>
            <option value="3º Turno" className="bg-[#0d0d0d]">3º Turno</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button 
            onClick={fetchData}
            className="flex-1 bg-[#facc15] text-black h-[46px] rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#facc15]/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Sincronizar
          </button>
          <button 
            onClick={handlePrint}
            className="w-[46px] h-[46px] bg-white/5 text-white rounded-xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI CARDS (Exactly like photo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* INATIVIDADE TOTAL */}
        <div className="bg-[#0d0d0d] border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-white/5 group-hover:text-[#facc15]/10 transition-colors">
            <Timer className="w-10 h-10" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Inatividade Total</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{analytics.totalDowntime}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">minutos</span>
          </div>
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-2">Duração Bruta Acumulada</p>
        </div>

        {/* TOP 3 EQUIPAMENTOS */}
        <div className="bg-[#0d0d0d] border border-white/5 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Top 3 Equipamentos Críticos</p>
              <AlertCircle className="w-4 h-4 text-red-500/50" />
            </div>
            <div className="space-y-2">
              {analytics.topEquipments.map((equip, idx) => (
                <div key={idx} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${idx === 0 ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-bold text-slate-300 truncate max-w-[100px] uppercase">{equip.name}</span>
                  </div>
                  <span className="text-[8px] font-black text-slate-600 uppercase">{equip.count} paradas</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MTTR */}
        <div className="bg-[#0d0d0d] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 text-white/5">
            <Activity className="w-10 h-10" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">MTTR (Média)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{analytics.mttr.toFixed(1)}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">min</span>
          </div>
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-2">Recuperação Média de Falha</p>
        </div>

        {/* VOLUME PRODUZIDO */}
        <div className="bg-blue-950/20 border border-blue-500/20 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 text-blue-500/10">
            <Box className="w-10 h-10" />
          </div>
          <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Volume Produzido</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-400">{analytics.totalProduced.toLocaleString('pt-BR')}</span>
            <span className="text-[10px] font-bold text-blue-600 uppercase">un</span>
          </div>
          <p className="text-[8px] font-bold text-blue-600/50 uppercase tracking-widest mt-2 italic">Produção Efetiva no Período</p>
        </div>

        {/* IMPACTO PRODUTIVO */}
        <div className="bg-[#0d0d0d] border border-white/5 p-5 rounded-2xl relative overflow-hidden">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Impacto Produtivo</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{analytics.volumeLost.toLocaleString('pt-BR')}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">un</span>
          </div>
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-2 italic text-center w-full">Estimativa de Perda Volumétrica</p>
        </div>

        {/* SOMA NOMINAL */}
        <div className="bg-emerald-950/20 border border-emerald-500/20 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-4 right-4 text-emerald-500/10">
            <TrendingUp className="w-10 h-10" />
          </div>
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-3">Soma Nominal</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400">{analytics.totalNominal.toLocaleString('pt-BR')}</span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase">un</span>
          </div>
          <p className="text-[8px] font-bold text-emerald-600/50 uppercase tracking-widest mt-2 italic text-center w-full">Capacidade Teórica Acumulada</p>
        </div>
      </div>

      {/* ANALYSIS SECTION (The "spreadsheet" style cards) */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-lg border border-white/10">
            <FileText className="w-4 h-4 text-[#facc15]" />
          </div>
          <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">II. Análise Técnica e Impacto por Máquina</h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Card 1: Impacto por Tipo de Parada (Planilha) */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <BarChart2 className="w-5 h-5 text-cyan-500" />
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Impacto por Tipo de Parada</h4>
              </div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">Visualização de Planilha</span>
            </div>
            
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoria de Parada</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Tempo Acumulado</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Representatividade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {analytics.typeTableData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-8 rounded-full ${idx === 0 ? 'bg-cyan-500' : 'bg-slate-700'}`} />
                          <span className="text-[11px] font-black text-white uppercase tracking-tight">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-black text-white">{row.minutos}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase ml-1">min</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-black text-cyan-500">{row.percent.toFixed(1)}%</span>
                          <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${row.percent}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {analytics.typeTableData.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center text-slate-600 uppercase font-black text-[10px] tracking-widest italic">
                        Sem dados para exibição no período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Detalhamento do Tipo Crítico */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h4 className="text-xs font-black text-white uppercase tracking-widest">
                  Detalhamento: {analytics.top3Details[0]?.type || 'Análise Crítica'}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                 <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Impacto Máximo</span>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#0d0d0d] z-10">
                  <tr className="bg-white/5">
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Máquina / Equipamento</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Motivo Técnico</th>
                    <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {analytics.top3Details[0]?.failures.map((fail, idx) => (
                    <tr key={idx} className="hover:bg-red-500/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-white uppercase tracking-tight">{fail.equipamento}</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{fail.linha}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <ArrowRight className="w-3 h-3 text-red-500 opacity-50" />
                           <span className="text-[10px] font-bold text-slate-300 uppercase">{fail.motivo}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-red-500">{fail.duracao}m</span>
                          <span className="text-[8px] font-bold text-slate-600 uppercase">-{fail.volumeLost} un</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(analytics.top3Details[0]?.failures.length || 0) === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center text-slate-600 uppercase font-black text-[10px] tracking-widest italic">
                        Sem ocorrências registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* TOP 2 & 3 SUB-ANALYSIS */}
        <div className="grid grid-cols-1 gap-6">
           {analytics.top3Details.slice(1).map((detail, idx) => (
             <div key={idx} className="bg-[#0d0d0d] border border-white/5 rounded-3xl overflow-hidden shadow-xl opacity-90 hover:opacity-100 transition-opacity">
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                   <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                         {idx + 2}º Principal: {detail.type}
                      </h4>
                   </div>
                   <span className="text-[9px] font-black text-slate-600 uppercase">{detail.failures.length} Eventos</span>
                </div>
                <div className="p-4 space-y-3">
                   {detail.failures.map((f, fidx) => (
                      <div key={fidx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white uppercase">{f.equipamento}</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase truncate max-w-[150px]">{f.motivo}</span>
                         </div>
                         <div className="text-right">
                            <span className="text-xs font-black text-white">{f.duracao}m</span>
                         </div>
                      </div>
                   ))}
                   {detail.failures.length === 0 && (
                      <p className="text-center py-10 text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Sem dados adicionais</p>
                   )}
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* FOOTER (Technical Validation) */}
      <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 print:text-black">
        <div className="flex items-center gap-4">
          <ShieldCheck className="w-10 h-10 text-slate-700" />
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-widest">Nexus PCP Industrial Analytics</p>
            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">
               Código de Autenticação: {Math.random().toString(36).substring(2, 10).toUpperCase()}
            </p>
          </div>
        </div>
        
        <div className="text-center md:text-right">
          <p className="text-[10px] font-black text-[#facc15] uppercase tracking-widest">Relatório Gerado via Nexus Cloud</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-widest">
             {new Date().toLocaleString('pt-BR')} • Engenharia de Processos
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .bg-[#0d0d0d], .bg-[#0a0a0a], .bg-white/5, .bg-white/10 { background: white !important; border-color: #e2e8f0 !important; }
          .text-white, .text-slate-200, .text-slate-300 { color: black !important; }
          .text-slate-500, .text-slate-600 { color: #64748b !important; }
          .border-white/5, .border-white/10 { border-color: #cbd5e1 !important; }
          .shadow-2xl, .shadow-xl, .shadow-lg { shadow: none !important; }
          .rounded-2xl, .rounded-3xl { border-radius: 8px !important; }
          table { border: 1px solid #e2e8f0 !important; }
          th { background: #f8fafc !important; color: black !important; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
        }
      `}} />

    </div>
  );
};

export default RelatorioDowntimeTecnico;
