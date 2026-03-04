
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
    X,
    Clock
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Cell,
    Legend,
    ComposedChart,
    Line
} from 'recharts';

const EmptyChartState = () => (
    <div className="h-full flex flex-col items-center justify-center text-slate-300">
        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-[11px] font-black uppercase tracking-widest text-center">Aguardando Lançamentos<br />Operacionais</p>
    </div>
);

const RelatoriosDowntimeHoras: React.FC = () => {
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
          <title>ANALÍTICA DE DOWNTIME (HORAS) - NEXUS PCP</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
            @media print {
              @page { size: A4 portrait; margin: 1cm; }
              body { zoom: 0.85; -webkit-print-color-adjust: exact; }
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
        let totalDowntimeMin = 0;
        let totalStopsCount = 0;
        let totalProduced = 0;
        let totalNominal = 0;
        const byEquipmentMin: Record<string, number> = {};
        const byEquipmentCount: Record<string, number> = {};
        const byTypeMin: Record<string, number> = {};
        const detailedFailures: any[] = [];

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
                    totalDowntimeMin += dur;
                    totalStopsCount += 1;
                }

                const mObj = maquinas.find(m => m.id === p.maquina_id);
                const equipName = p.maquina || (mObj ? mObj.nome : (p.equipamento || 'GERAL'));

                if (type !== 'PARADA PROGRAMADA') {
                    byEquipmentMin[equipName] = (byEquipmentMin[equipName] || 0) + dur;
                    byEquipmentCount[equipName] = (byEquipmentCount[equipName] || 0) + 1;
                    byTypeMin[type] = (byTypeMin[type] || 0) + dur;
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
                    duracaoMin: dur,
                    duracaoHoras: (dur / 60).toFixed(2),
                    volumePerdido: Math.round(dur * capPerMin)
                });
            });
        });

        const totalDowntimeHoras = totalDowntimeMin / 60;

        // Gráfico 1: Horas por Tipo (Barra Vertical)
        const typeBarData = Object.entries(byTypeMin)
            .map(([name, value]) => ({
                name,
                horas: Number((value / 60).toFixed(2)),
                minutos: value
            }))
            .sort((a, b) => b.horas - a.horas);

        // Gráfico 2: Horas por Equipamento (Barra Horizontal / Pareto)
        const equipBarData = Object.entries(byEquipmentMin)
            .map(([name, value]) => ({
                name,
                horas: Number((value / 60).toFixed(2)),
                minutos: value
            }))
            .sort((a, b) => b.horas - a.horas)
            .slice(0, 10);

        const mttrHoras = totalStopsCount > 0 ? (totalDowntimeMin / totalStopsCount) / 60 : 0;

        // Detecção de Top 3 Equipamentos Críticos (Por Frequência - Ignorando Programadas)
        const topEquipments = Object.entries(byEquipmentCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }));

        return {
            totalDowntimeHoras: totalDowntimeHoras || 0,
            totalStopsCount: totalStopsCount || 0,
            volumeLost: Math.round(totalProduced - totalNominal) || 0,
            totalProduced: totalProduced || 0,
            mttrHoras: mttrHoras || 0,
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

            {/* Header Premium Nexus */}
            <div className="flex flex-col xl:flex-row items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl print:hidden">
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="p-3 bg-[#facc15] rounded-xl text-black shadow-lg shadow-[#facc15]/20">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-tight">Downtime Analytics (Horas)</h2>
                        <p className="text-[#facc15] text-[10px] font-black uppercase tracking-widest leading-none mt-1 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" /> Visão Gerencial de Disponibilidade Industrial
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5 focus-within:border-[#facc15]/50 transition-all shadow-sm">
                            <Calendar className="w-5 h-5 text-slate-500" />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Início</span>
                                <input
                                    type="date"
                                    value={dataInicio}
                                    onChange={e => setDataInicio(e.target.value)}
                                    className="bg-transparent text-[11px] font-black uppercase outline-none text-white cursor-pointer hover:text-[#facc15]"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5 focus-within:border-[#facc15]/50 transition-all shadow-sm">
                            <Calendar className="w-5 h-5 text-slate-500" />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Fim</span>
                                <input
                                    type="date"
                                    value={dataFim}
                                    onChange={e => setDataFim(e.target.value)}
                                    className="bg-transparent text-[11px] font-black uppercase outline-none text-white cursor-pointer hover:text-[#facc15]"
                                />
                            </div>
                        </div>
                    </div>

                    <select
                        value={turno}
                        onChange={e => setTurno(e.target.value)}
                        className="bg-white/5 border border-white/10 p-2.5 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer text-white"
                    >
                        <option value="todos" className="bg-slate-900">Todos os Turnos</option>
                        <option value="1º Turno" className="bg-slate-900">1º Turno</option>
                        <option value="2º Turno" className="bg-slate-900">2º Turno</option>
                    </select>

                    <select
                        value={linhaId}
                        onChange={e => setLinhaId(e.target.value)}
                        className="bg-white/5 border border-white/10 p-2.5 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer text-white"
                    >
                        <option value="todos" className="bg-slate-900">Grade Completa</option>
                        {linhas.map(l => <option key={l.id} value={l.id} className="bg-slate-900">{l.nome}</option>)}
                    </select>

                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="px-6 py-3 bg-[#facc15] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-[#facc15]/10 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        {loading ? 'Sincronizando...' : 'Consolidar'}
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-6 py-3 bg-white/5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10 shadow-xl"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimir A4
                    </button>
                </div>
            </div>

            {/* Relatório A4 Core */}
            <div ref={reportRef} className="bg-white p-6 space-y-10 rounded-3xl text-slate-900 border border-slate-200">

                <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center font-black text-white text-3xl">H</div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Industrial Analytics - Nexus</h1>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Eficiência de Disponibilidade em Base Horária</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">RELATÓRIO DE IMPACTO PRODUTIVO (HORAS)</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                            Período: {formatarDataBR(dataInicio) === formatarDataBR(dataFim) ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
                        </p>
                    </div>
                </header>

                {/* KPIs Consolidados em Horas */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><Timer className="w-8 h-8 text-slate-400" /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Inatividade Total</p>
                        <h4 className="text-2xl font-black text-slate-900 leading-none">{analytics.totalDowntimeHoras.toFixed(2)} <span className="text-xs font-bold text-slate-500">horas</span></h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-2 italic">Duração Bruta Acumulada</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                        <div className="absolute top-0 right-0 p-2"><AlertCircle className="w-8 h-8 text-red-100" /></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Top 3 Máquinas Críticas</p>
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

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><Activity className="w-8 h-8 text-slate-400" /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">MTTR (Médio)</p>
                        <h4 className="text-2xl font-black text-slate-900 leading-none">{analytics.mttrHoras.toFixed(2)} <span className="text-xs font-bold text-slate-500">h/parada</span></h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-2 italic">Média de Recuperação</p>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-20"><Box className="w-8 h-8 text-blue-600" /></div>
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Volume Produzido</p>
                        <h4 className="text-2xl font-black text-blue-900 leading-none">{analytics.totalProduced.toLocaleString('pt-BR')} <span className="text-xs font-bold opacity-60">un</span></h4>
                        <p className="text-[8px] text-blue-400 font-bold uppercase mt-2 italic">Produção Efetiva</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden group font-bold">
                        <div className="absolute top-0 right-0 p-2 opacity-10"><Package className="w-8 h-8 text-slate-400" /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto Produtivo</p>
                        <h4 className="text-2xl font-black text-slate-900 leading-none">{Math.abs(analytics.volumeLost).toLocaleString('pt-BR')} <span className="text-xs font-bold opacity-60">un</span></h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-2 italic">Perda Volumétrica Est.</p>
                    </div>

                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-20"><TrendingUp className="w-8 h-8 text-emerald-600" /></div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Soma Nominal</p>
                        <h4 className="text-2xl font-black text-emerald-900 leading-none">{analytics.somaNominal.toLocaleString('pt-BR')} <span className="text-xs font-bold opacity-60">un</span></h4>
                        <p className="text-[8px] text-emerald-400 font-bold uppercase mt-2 italic">Capacidade Teórica</p>
                    </div>
                </section>

                {/* Gráficos em Horas (Barras) */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="border border-slate-200 rounded-3xl p-8 bg-white h-[450px] flex flex-col">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-cyan-600" /> Impacto por Tipo de Parada (H)
                        </h3>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.typeBarData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                                        label={{ value: 'Horas', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 800 }}
                                    />
                                    <RechartsTooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', color: '#1e293b' }}
                                    />
                                    <Bar dataKey="horas" radius={[6, 6, 0, 0]} fill="#0891b2">
                                        {analytics.typeBarData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#0891b2' : '#0e7490'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-3xl p-8 bg-white h-[450px] flex flex-col">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-600" /> Pareto de Equipamentos Críticos (H)
                        </h3>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={analytics.equipBarData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 50, left: 20, bottom: 5 }}
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
                                    <Bar dataKey="horas" radius={[0, 6, 6, 0]} fill="#2563eb" barSize={20}>
                                        {analytics.equipBarData.map((entry, index) => (
                                            <Cell key={`cell-e-${index}`} fill={index < 3 ? '#2563eb' : '#3b82f6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>

                {/* Registro Detalhado */}
                <section className="space-y-4 pt-6">
                    <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-slate-400" /> III. Auditoria de Eventos de Parada
                    </h3>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white">
                                    <th className="p-3 text-[8px] font-black uppercase tracking-widest">Data</th>
                                    <th className="p-3 text-[8px] font-black uppercase tracking-widest">Máquina</th>
                                    <th className="p-3 text-[8px] font-black uppercase tracking-widest">Motivo</th>
                                    <th className="p-3 text-[8px] font-black uppercase tracking-widest text-right">Duração (Min)</th>
                                    <th className="p-3 text-[8px] font-black uppercase tracking-widest text-right">Duração (Horas)</th>
                                    <th className="p-3 text-[8px] font-black uppercase tracking-widest text-right">Perda Real</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[9px]">
                                {analytics.detailedFailures.map((fail, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-bold text-slate-500">{formatarDataBR(fail.data)}</td>
                                        <td className="p-3 font-black text-slate-900 uppercase">{fail.equipamento}</td>
                                        <td className="p-3 font-bold text-slate-700 uppercase">{fail.motivo}</td>
                                        <td className="p-3 text-right text-slate-400 font-bold">{fail.duracaoMin}m</td>
                                        <td className={`p-3 text-right font-black ${Number(fail.duracaoHoras) > 0.5 ? 'text-red-600' : 'text-slate-900'}`}>
                                            {fail.duracaoHoras}h
                                        </td>
                                        <td className="p-3 text-right font-bold text-blue-700">{fail.volumePerdido.toLocaleString('pt-BR')} un</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <footer className="pt-10 border-t-2 border-slate-900 flex justify-between items-end">
                    <div className="flex items-center gap-4">
                        <ShieldCheck className="w-8 h-8 text-slate-400" />
                        <div>
                            <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest leading-none">Nexus Analytics v3.0</p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Data Integrity Certified</p>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Análise Industrial Estruturada</p>
                </footer>
            </div>
        </div>
    );
};

export default RelatoriosDowntimeHoras;
