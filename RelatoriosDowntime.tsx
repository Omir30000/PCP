
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
  ChevronRight,
  ShieldCheck,
  Factory,
  BarChart2,
  AlertTriangle,
  History,
  Box,
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
      // Sincronização mestre: Registros com Joins de Produtos e Linhas
      const [regsRes, linesRes, machRes] = await Promise.all([
        supabase.from('registros_producao').select('*, produtos(*), linhas(*)').order('data_registro', { ascending: false }),
        supabase.from('linhas').select('*').order('nome'),
        supabase.from('maquinas').select('*')
      ]);

      if (linesRes.data) setLinhas(linesRes.data);
      if (machRes.data) setMaquinas(machRes.data);

      const filtrados = (regsRes.data || []).filter(r => {
        const dMatch = r.data_registro >= dataInicio && r.data_registro <= dataFim;
        const lMatch = linhaId === 'todos' || r.linha_producao === linhaId;
        return dMatch && lMatch;
      });

      setRegistros(filtrados);
    } catch (err) {
      console.error("Nexus Downtime Sync Error:", err);
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
              .print\\:hidden { display: none !important; }
              .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
              .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
              .bg-red-500 { background-color: #ef4444 !important; color: white !important; }
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
    const byEquipment: Record<string, number> = {};
    const byEquipmentCount: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const detailedFailures: any[] = [];

    registros.forEach(reg => {
      // Extração segura do JSONB de paradas
      const paradasRaw = reg.paradas;
      const paradas = Array.isArray(paradasRaw) ? paradasRaw : [];

      // Prioriza a capacidade registrada no registro de produção, fallback para o produto
      const nominalCap = Number(reg.capacidade_producao) || Number(reg.produtos?.capacidade_nominal) || 7200;

      // Cálculo de eficiência: nominalCap é baseada em 8 horas (480 minutos)
      const capPerMin = nominalCap / 480;

      paradas.forEach((p: any) => {
        // Suporte a múltiplos nomes de campos no JSON (duracao, tempo, total_min)
        const dur = parseMinutos(p.duracao || p.tempo || p.total_min || 0);

        if (dur <= 0) return;

        totalDowntime += dur;
        totalStopsCount += 1;

        // Impacto produtivo calculado por minuto de indisponibilidade
        const lostInThisStop = dur * capPerMin;
        volumeLost += lostInThisStop;

        // Identificação técnica do equipamento
        const mObj = maquinas.find(m => m.id === p.maquina_id);
        const equipName = p.maquina || (mObj ? mObj.nome : (p.equipamento || 'GERAL'));

        byEquipment[equipName] = (byEquipment[equipName] || 0) + dur;
        byEquipmentCount[equipName] = (byEquipmentCount[equipName] || 0) + 1;

        const type = (p.tipo || 'NÃO PLANEJADA').toUpperCase();
        byType[type] = (byType[type] || 0) + dur;

        detailedFailures.push({
          data: reg.data_registro,
          linha: reg.linhas?.nome || 'LINHA DESCONHECIDA',
          equipamento: equipName,
          tipo: type,
          motivo: p.motivo || 'GERAL',
          duracao: dur,
          obs: reg.observacoes,
          volumePerdido: Math.round(lostInThisStop)
        });
      });
    });

    // Construção do Pareto de Tipos de Parada -> Agora para Pizza
    const totalDowntimeValue = Object.values(byType).reduce((a, b) => a + b, 0);
    const typePieData = Object.entries(byType)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalDowntimeValue > 0 ? ((value / totalDowntimeValue) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.value - a.value);

    // Identificar o tipo mais crítico para o segundo gráfico
    const mostCriticalType = typePieData[0]?.name || null;

    // Filtrar máquinas que contribuíram para o tipo mais crítico
    const machineByCriticalType: Record<string, number> = {};
    if (mostCriticalType) {
      detailedFailures.forEach(fail => {
        if (fail.tipo === mostCriticalType) {
          machineByCriticalType[fail.equipamento] = (machineByCriticalType[fail.equipamento] || 0) + fail.duracao;
        }
      });
    }

    const machinePieData = Object.entries(machineByCriticalType)
      .map(([name, value]) => ({
        name,
        value,
        percentage: byType[mostCriticalType] > 0 ? ((value / byType[mostCriticalType]) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.value - a.value);

    // Indicadores de Manutenção
    const mttr = totalStopsCount > 0 ? totalDowntime / totalStopsCount : 0;

    // Detecção de Top 3 Equipamentos Críticos (Por Frequência)
    const topEquipments = Object.entries(byEquipmentCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return {
      totalDowntime: totalDowntime || 0,
      totalStopsCount: totalStopsCount || 0,
      volumeLost: Math.round(volumeLost) || 0,
      mttr: mttr || 0,
      typePieData,
      machinePieData,
      mostCriticalType,
      topEquipments,
      detailedFailures: detailedFailures.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    };
  }, [registros, maquinas]);

  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-900 print:text-black">

      {/* Controles Nexus */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-600 rounded-xl text-white shadow-lg shadow-red-200">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Analítica de Downtime</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Sincronização de Inatividade JSONB</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <Calendar className="ml-2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="bg-transparent px-2 py-1.5 text-xs font-bold outline-none uppercase"
            />
            <span className="text-slate-300">|</span>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="bg-transparent px-2 py-1.5 text-xs font-bold outline-none uppercase"
            />
          </div>

          <select
            value={linhaId}
            onChange={e => setLinhaId(e.target.value)}
            className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-bold uppercase outline-none cursor-pointer"
          >
            <option value="todos">Grade Completa</option>
            {linhas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>

          <button
            onClick={fetchData}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Consolidar
          </button>

          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
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
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 break-inside-avoid">
          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2"><Timer className="w-8 h-8 text-slate-200/50" /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inatividade Total</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none">{analytics.totalDowntime} <span className="text-xs">min</span></h4>
            <p className="text-[9px] text-slate-400 mt-2">Duração Bruta Acumulada</p>
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
          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2"><Activity className="w-8 h-8 text-slate-200/50" /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">MTTR (Média)</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none">{analytics.mttr.toFixed(1)} <span className="text-xs">min</span></h4>
            <p className="text-[9px] text-slate-400 mt-2">Recuperação Média de Falha</p>
          </div>
          <div className="border border-slate-200 rounded-2xl p-6 bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2"><TrendingDown className="w-8 h-8 text-white/10" /></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Impacto Produtivo</p>
            <h4 className="text-2xl font-black text-emerald-400 leading-none">{analytics.volumeLost.toLocaleString()} <span className="text-xs">un</span></h4>
            <p className="text-[9px] text-slate-500 mt-2">Estimativa de Perda Volumétrica</p>
          </div>
        </section>

        {/* Gráficos de Pizza Interligados */}
        <section className="space-y-4 break-inside-avoid">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-blue-600" /> II. Análise de Causa Raiz e Impacto por Máquina
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gráfico 1: Tipos de Parada */}
            <div className="border border-slate-200 rounded-2xl p-6 h-[400px] bg-white shadow-sm flex flex-col">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Distribuição por Tipo de Parada (%)</p>
              {analytics.typePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.typePieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      labelLine={true}
                    >
                      {analytics.typePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index === 1 ? '#0f172a' : '#334155'} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }}
                      formatter={(value: any, name: string, props: any) => [`${value} min (${props.payload.percentage}%)`, name]}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>

            {/* Gráfico 2: Máquinas do Tipo Crítico */}
            <div className="border border-slate-200 rounded-2xl p-6 h-[400px] bg-white shadow-sm flex flex-col">
              <div className="mb-4">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Impacto por Máquina</p>
                <p className="text-[10px] font-black text-red-600 uppercase truncate">
                  Filtro: {analytics.mostCriticalType || 'N/A'}
                </p>
              </div>
              {analytics.machinePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.machinePieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      labelLine={true}
                    >
                      {analytics.machinePieData.map((entry, index) => (
                        <Cell key={`cell-m-${index}`} fill={['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'][index % 5]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }}
                      formatter={(value: any, name: string, props: any) => [`${value} min (${props.payload.percentage}%)`, name]}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>
          </div>
        </section>

        {/* Tabela de Detalhamento Cronológico */}
        <section className="space-y-4 break-inside-avoid">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-slate-400" /> III. Registro Histórico de Eventos de Inatividade
          </h3>
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-4">Data Registro</th>
                  <th className="px-5 py-4">Centro de Trabalho</th>
                  <th className="px-5 py-4">Tipo de Parada</th>
                  <th className="px-5 py-4">Máquina</th>
                  <th className="px-5 py-4">Motivo</th>
                  <th className="px-5 py-4 text-right">Duração</th>
                  <th className="px-5 py-4 text-right">Perda Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px]">
                {analytics.detailedFailures.map((fail, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50 ${fail.duracao > 30 ? 'bg-red-50/30' : 'bg-white'}`}>
                    <td className="px-5 py-3 font-bold text-slate-500">{formatarDataBR(fail.data)}</td>
                    <td className="px-5 py-3 text-blue-600 font-black">{fail.linha}</td>
                    <td className="px-5 py-3 font-bold text-slate-700 uppercase text-[9px]">{fail.tipo}</td>
                    <td className="px-5 py-3 font-bold text-slate-800 uppercase">{fail.equipamento}</td>
                    <td className="px-5 py-3 text-slate-600">
                      <p className="font-bold">{fail.motivo}</p>
                      {fail.obs && <p className="text-[8px] text-slate-400 italic truncate max-w-[200px]">Obs: {fail.obs}</p>}
                    </td>
                    <td className={`px-5 py-3 text-right font-black ${fail.duracao > 30 ? 'text-red-600' : 'text-slate-800'}`}>
                      {fail.duracao}m
                      {fail.duracao > 30 && <AlertTriangle className="w-3 h-3 inline ml-1 align-middle" />}
                    </td>
                    <td className="px-5 py-3 text-right text-emerald-600 font-bold">{fail.volumePerdido.toLocaleString()} un</td>
                  </tr>
                ))}
                {analytics.detailedFailures.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-300 uppercase font-bold tracking-widest italic">Sem inatividade reportada no período selecionado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rodapé Nexus */}
        <footer className="pt-12 border-t-2 border-slate-900 break-inside-avoid">
          <div className="flex justify-between items-end mb-16">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-slate-400" />
              <div>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Documento Técnico Nexus PCP - v2.1</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">Autenticação de Dados Industrial: {Math.random().toString(36).substring(7).toUpperCase()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Emitido em: {new Date().toLocaleString('pt-BR')}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Validação de Disponibilidade Operacional</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-20">
            <div className="text-center">
              <div className="border-t border-slate-900 pt-3"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Engenharia de Manutenção / PCP</p>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-900 pt-3"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Coordenação de Operações Industriais</p>
            </div>
          </div>
        </footer>
      </div>

    </div>
  );
};

export default RelatoriosDowntime;
