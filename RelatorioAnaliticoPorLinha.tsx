
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Linha, Maquina, RegistroProducao } from './types/database';
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
    BarChart2,
    AlertTriangle,
    History,
    LayoutGrid,
    Filter,
    ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const RelatorioAnaliticoPorLinha: React.FC = () => {
    const getHoje = () => new Date().toISOString().split('T')[0];
    const [dataInicio, setDataInicio] = useState(getHoje());
    const [dataFim, setDataFim] = useState(getHoje());
    const [linhaId, setLinhaId] = useState<string>('');
    const [turno, setTurno] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [registros, setRegistros] = useState<any[]>([]);
    const [linhas, setLinhas] = useState<Linha[]>([]);
    const [maquinas, setMaquinas] = useState<Maquina[]>([]);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function init() {
            const { data } = await supabase.from('linhas').select('*').order('nome');
            if (data) {
                setLinhas(data);
                if (data.length > 0 && !linhaId) setLinhaId(data[0].id);
            }
            const { data: machs } = await supabase.from('maquinas').select('*');
            if (machs) setMaquinas(machs);
        }
        init();
    }, []);

    const parseMinutos = (val: any): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        const match = String(val).match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    };

    const fetchData = async () => {
        if (!linhaId) return;
        setLoading(true);
        try {
            let query = supabase
                .from('registros_producao')
                .select('*, produtos(*), linhas(*)')
                .eq('linha_id', linhaId)
                .gte('data_registro', dataInicio)
                .lte('data_registro', dataFim);

            if (turno) {
                query = query.eq('turno', turno);
            }

            const { data, error } = await query.order('data_registro', { ascending: false });

            if (error) throw error;
            setRegistros(data || []);
        } catch (err) {
            console.error("Gargalo Report Sync Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const analytics = useMemo(() => {
        let totalDowntime = 0;
        let totalStopsCount = 0;
        const byEquipment: Record<string, number> = {};
        const byType: Record<string, number> = {};
        const detailedFailures: any[] = [];

        registros.forEach(reg => {
            const paradas = Array.isArray(reg.paradas) ? reg.paradas : [];

            paradas.forEach((p: any) => {
                const dur = parseMinutos(p.duracao || p.tempo || p.total_min || 0);
                const type = (p.tipo || 'NÃO PLANEJADA').toUpperCase();

                if (dur <= 0) return;

                // Regra de Negócio: Paradas programadas não computam nos gargalos/indicadores técnicos
                if (type !== 'PARADA PROGRAMADA') {
                    totalDowntime += dur;
                    totalStopsCount += 1;

                    const equipName = p.maquina || p.maquina_id || p.equipamento || 'GERAL';
                    byEquipment[equipName] = (byEquipment[equipName] || 0) + dur;
                    byType[type] = (byType[type] || 0) + dur;
                }

                detailedFailures.push({
                    data: reg.data_registro,
                    equipamento: p.maquina || p.maquina_id || p.equipamento || 'GERAL',
                    motivo: p.motivo || 'GERAL',
                    tipo: p.tipo || 'Não Planejada',
                    duracao: dur,
                    obs: reg.observacoes
                });
            });
        });

        // 1. Gráfico de Pizza: Distribuição por Equipamento
        const equipmentPieData = Object.entries(byEquipment)
            .map(([name, value]) => ({
                name,
                value,
                percentage: totalDowntime > 0 ? ((value / totalDowntime) * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.value - a.value);

        const mostCriticalEquipment = equipmentPieData[0]?.name || null;

        // 2. Gráfico de Pizza: Motivos do Equipamento mais crítico
        const reasonByCriticalEquipment: Record<string, number> = {};
        if (mostCriticalEquipment) {
            detailedFailures.forEach(fail => {
                if (fail.equipamento === mostCriticalEquipment && fail.tipo.toUpperCase() !== 'PARADA PROGRAMADA') {
                    const m = fail.motivo.toUpperCase();
                    reasonByCriticalEquipment[m] = (reasonByCriticalEquipment[m] || 0) + fail.duracao;
                }
            });
        }

        const totalDowntimeCritical = byEquipment[mostCriticalEquipment || ''] || 0;
        const reasonPieData = Object.entries(reasonByCriticalEquipment)
            .map(([name, value]) => ({
                name,
                value,
                percentage: totalDowntimeCritical > 0 ? ((value / totalDowntimeCritical) * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.value - a.value);

        const mttr = totalStopsCount > 0 ? totalDowntime / totalStopsCount : 0;

        return {
            totalDowntime,
            totalStopsCount,
            mttr,
            equipmentPieData,
            reasonPieData,
            mostCriticalEquipment,
            detailedFailures: detailedFailures.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
        };
    }, [registros]);

    const COLORS = ['#ef4444', '#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];

    const handlePrint = () => {
        if (!reportRef.current) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const content = reportRef.current.innerHTML;
        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Relatório de Gargalos - ${linhas.find(l => l.id === linhaId)?.nome}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white; }
            @media print { .print\\:hidden { display: none; } }
          </style>
      </head>
      <body class="p-10">
          ${content}
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 800); };</script>
      </body>
      </html>
    `);
        printWindow.document.close();
    };

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">

            {/* Controles de Filtro */}
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[32px] border border-white/20 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 print:hidden">
                <div className="flex items-center gap-6">
                    <div className="bg-red-500 p-4 rounded-3xl shadow-lg shadow-red-200">
                        <TrendingDown className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Análise de Gargalos</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Diagnóstico de Performance por Linha</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-3xl border border-slate-100">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-colors">
                        <Activity className="w-4 h-4 text-blue-500" />
                        <select
                            value={linhaId}
                            onChange={e => setLinhaId(e.target.value)}
                            className="bg-transparent text-xs font-black uppercase outline-none cursor-pointer text-slate-900"
                        >
                            <option value="" className="text-slate-900 bg-white">Selecionar Linha...</option>
                            {linhas.map(l => <option key={l.id} value={l.id} className="text-slate-900 bg-white">{l.nome}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-colors">
                        <LayoutGrid className="w-4 h-4 text-purple-500" />
                        <select
                            value={turno}
                            onChange={e => setTurno(e.target.value)}
                            className="bg-transparent text-xs font-black uppercase outline-none cursor-pointer text-slate-900"
                        >
                            <option value="">Todos os Turnos</option>
                            <option value="1º Turno">1º Turno</option>
                            <option value="2º Turno">2º Turno</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-2xl shadow-inner border border-slate-200 hover:border-blue-400 transition-all group">
                        <Calendar className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                        <input
                            type="date"
                            value={dataInicio}
                            onChange={e => setDataInicio(e.target.value)}
                            className="bg-transparent text-xs font-black uppercase outline-none text-slate-900 cursor-pointer"
                        />
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <input
                            type="date"
                            value={dataFim}
                            onChange={e => setDataFim(e.target.value)}
                            className="bg-transparent text-xs font-black uppercase outline-none text-slate-900 cursor-pointer"
                        />
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={loading || !linhaId}
                        className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-20"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Gerar Diagnóstico
                    </button>
                </div>
            </div>

            {!registros.length && !loading ? (
                <div className="py-40 flex flex-col items-center justify-center bg-white/50 border-4 border-dashed border-slate-100 rounded-[48px]">
                    <Filter className="w-20 h-20 text-slate-100 mb-6" />
                    <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-xs text-center px-10">
                        Selecione uma linha e período para iniciar a análise de gargalos
                    </p>
                </div>
            ) : (
                <div ref={reportRef} className="space-y-8 animate-in slide-in-from-bottom duration-700">

                    {/* Dashboard de Elite */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-slate-900 p-8 rounded-[40px] text-white relative overflow-hidden group shadow-2xl">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Timer className="w-16 h-16" /></div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Total Downtime</p>
                            <h2 className="text-5xl font-black tracking-tighter mb-1">{analytics.totalDowntime} <span className="text-sm">min</span></h2>
                            <div className="w-12 h-1 bg-blue-500 rounded-full mt-4" />
                        </div>

                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 text-red-100 group-hover:scale-110 transition-transform"><AlertCircle className="w-16 h-16" /></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ponto Crítico (Gargalo)</p>
                            <h2 className="text-3xl font-black text-red-600 tracking-tighter uppercase truncate pr-16">{analytics.mostCriticalEquipment || '--'}</h2>
                            <p className="text-[10px] font-bold text-slate-300 mt-2 uppercase">Maior acumulador de parada</p>
                        </div>

                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 text-blue-100 group-hover:scale-110 transition-transform"><Activity className="w-16 h-16" /></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">MTTR (Reparo Médio)</p>
                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-1">{analytics.mttr.toFixed(1)} <span className="text-sm">min</span></h2>
                            <div className="w-12 h-1 bg-slate-100 rounded-full mt-4" />
                        </div>

                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 text-emerald-100 group-hover:scale-110 transition-transform"><LayoutGrid className="w-16 h-16" /></div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ocorrência Totais</p>
                            <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-1">{analytics.totalStopsCount}</h2>
                            <p className="text-[10px] font-bold text-slate-300 mt-2 uppercase">Registros no período</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Pizza Maquinas */}
                        <section className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-2xl space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-red-50 rounded-2xl text-red-500"><Settings className="w-6 h-6" /></div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Gargalo por Equipamento (%)</h3>
                                </div>
                            </div>

                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.equipmentPieData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={120}
                                            paddingAngle={5}
                                            label={({ name, percentage }) => `${name}: ${percentage}%`}
                                        >
                                            {analytics.equipmentPieData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                                            formatter={(value: any, name: string, props: any) => [`${value} min (${props.payload.percentage}%)`, name]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        {/* Pizza Detalhes do Gargalo */}
                        <section className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-2xl space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-500"><BarChart2 className="w-6 h-6" /></div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Motivos: {analytics.mostCriticalEquipment}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Detalhamento do maior gargalo</p>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.reasonPieData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={120}
                                            paddingAngle={5}
                                            label={({ name, percentage }) => `${name}: ${percentage}%`}
                                        >
                                            {analytics.reasonPieData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                                            formatter={(value: any, name: string, props: any) => [`${value} min (${props.payload.percentage}%)`, name]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    </div>

                    {/* Histórico Detalhado */}
                    <section className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-2xl">
                        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-100">
                            <div className="p-3 bg-slate-900 rounded-2xl text-white"><History className="w-6 h-6" /></div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Log Analítico de Paradas</h3>
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full">
                                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Data</th>
                                        <th className="px-6 py-4 text-left">Tipo</th>
                                        <th className="px-6 py-4 text-left">Equipamento</th>
                                        <th className="px-6 py-4 text-left">Motivo</th>
                                        <th className="px-6 py-4 text-right">Duração</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {analytics.detailedFailures.map((fail, idx) => (
                                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-5 text-xs font-bold text-slate-400">{new Date(fail.data).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-6 py-5 whitespace-nowrap">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${fail.tipo.includes('Planejada') ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                                                    }`}>
                                                    {fail.tipo}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-xs font-black text-slate-800 uppercase">{fail.equipamento}</p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-xs font-bold text-slate-600 uppercase mb-1">{fail.motivo}</p>
                                                {fail.obs && <p className="text-[10px] text-slate-400 italic font-medium truncate max-w-sm">{fail.obs}</p>}
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {fail.duracao > 30 && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                                                    <span className={`text-sm font-black ${fail.duracao > 30 ? 'text-red-600' : 'text-slate-900'}`}>{fail.duracao} min</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <div className="flex justify-center pt-8">
                        <button
                            onClick={handlePrint}
                            className="px-12 py-5 bg-slate-900 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-2xl flex items-center gap-4 group"
                        >
                            <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            Emitir Relatório A4
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RelatorioAnaliticoPorLinha;
