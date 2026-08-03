
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
    ShieldCheck,
    BarChart2,
    AlertTriangle,
    Wrench,
    Package,
    Clock,
    Settings
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

const EmptyChartState = () => (
    <div className="h-full flex flex-col items-center justify-center text-slate-300">
        <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-[11px] font-black uppercase tracking-widest text-center">Nenhuma Parada<br />Registrada no Período</p>
    </div>
);

const RelatorioDowntimePorMaquina: React.FC = () => {
    const getHoje = () => new Date().toISOString().split('T')[0];
    const [dataInicio, setDataInicio] = useState(getHoje());
    const [dataFim, setDataFim] = useState(getHoje());
    const [linhaId, setLinhaId] = useState<string>('todos');
    const [turno, setTurno] = useState<string>('todos');
    const [maquinaId, setMaquinaId] = useState<string>('todos');

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
                supabase.from('maquinas').select('*').order('nome')
            ]);

            if (regsRes.error) throw regsRes.error;

            if (linesRes.data) setLinhas(linesRes.data);
            if (machRes.data) setMaquinas(machRes.data);
            if (regsRes.data) setRegistros(regsRes.data);

        } catch (err: any) {
            console.error("Relatório por Máquina Sync Error:", err);
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
          <title>RELATÓRIO DE PARADAS POR MÁQUINA - NEXUS PCP</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
            @media print {
              @page { size: A4 portrait; margin: 1cm; }
              body { zoom: 0.85; -webkit-print-color-adjust: exact; }
              .print-hide { display: none !important; }
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

    const maquinaSelecionada = maquinas.find(m => m.id === maquinaId);

    const matchesMaquina = (p: any): boolean => {
        if (maquinaId === 'todos') return true;
        if (p.maquina_id && p.maquina_id === maquinaId) return true;
        if (maquinaSelecionada) {
            const alvo = maquinaSelecionada.nome.trim().toLowerCase();
            const porNome = String(p.maquina || '').trim().toLowerCase();
            const porEquipamento = String(p.equipamento || '').trim().toLowerCase();
            return porNome === alvo || porEquipamento === alvo;
        }
        return false;
    };

    const analytics = useMemo(() => {
        let totalParadas = 0;
        let totalDowntimeMin = 0;
        let volumePerdidoEst = 0;
        const byMotivoCount: Record<string, number> = {};
        const byMotivoMin: Record<string, number> = {};
        const byTipoCount: Record<string, number> = {};
        const byTipoMin: Record<string, number> = {};
        const byLinhaCount: Record<string, number> = {};
        const byLinhaMin: Record<string, number> = {};
        const detailedParadas: any[] = [];

        registros.forEach(reg => {
            const paradasRaw = reg.paradas;
            const paradas = Array.isArray(paradasRaw) ? paradasRaw : [];
            const nominalCap = Number(reg.capacidade_producao) || Number(reg.produtos?.capacidade_nominal) || 7200;
            const capPerMin = nominalCap / 480;
            const linhaNome = reg.linhas?.nome || 'LINHA DESCONHECIDA';

            paradas.forEach((p: any) => {
                if (!matchesMaquina(p)) return;

                const dur = parseMinutos(p.duracao || p.tempo || p.total_min || 0);
                const mObj = maquinas.find(m => m.id === p.maquina_id);
                const equipName = p.maquina || (mObj ? mObj.nome : (p.equipamento || 'GERAL'));
                const motivo = (p.motivo || 'GERAL').toUpperCase();
                const tipo = (p.tipo || 'SEM TIPO').toUpperCase();

                totalParadas += 1;
                totalDowntimeMin += dur;
                volumePerdidoEst += dur * capPerMin;

                byMotivoCount[motivo] = (byMotivoCount[motivo] || 0) + 1;
                byMotivoMin[motivo] = (byMotivoMin[motivo] || 0) + dur;
                byTipoCount[tipo] = (byTipoCount[tipo] || 0) + 1;
                byTipoMin[tipo] = (byTipoMin[tipo] || 0) + dur;
                byLinhaCount[linhaNome] = (byLinhaCount[linhaNome] || 0) + 1;
                byLinhaMin[linhaNome] = (byLinhaMin[linhaNome] || 0) + dur;

                detailedParadas.push({
                    data: reg.data_registro,
                    linha: linhaNome,
                    turno: reg.turno || 'N/A',
                    produto: reg.produto_volume || (reg.produtos?.nome || 'N/A'),
                    equipamento: equipName,
                    tipo,
                    motivo,
                    duracaoMin: dur,
                    volumePerdido: Math.round(dur * capPerMin)
                });
            });
        });

        const totalDowntimeHoras = totalDowntimeMin / 60;
        const tempoMedio = totalParadas > 0 ? totalDowntimeMin / totalParadas : 0;

        const motivoBarData = Object.entries(byMotivoCount)
            .map(([name, count]) => ({
                name,
                ocorrencias: count,
                horas: Number((byMotivoMin[name] / 60).toFixed(2)),
                minutos: byMotivoMin[name]
            }))
            .sort((a, b) => b.ocorrencias - a.ocorrencias);

        const tipoBarData = Object.entries(byTipoCount)
            .map(([name, count]) => ({
                name,
                ocorrencias: count,
                horas: Number((byTipoMin[name] / 60).toFixed(2)),
                minutos: byTipoMin[name]
            }))
            .sort((a, b) => b.ocorrencias - a.ocorrencias);

        const linhaBarData = Object.entries(byLinhaCount)
            .map(([name, count]) => ({
                name,
                ocorrencias: count,
                horas: Number(((byLinhaMin[name] || 0) / 60).toFixed(2)),
                minutos: byLinhaMin[name] || 0
            }))
            .sort((a, b) => b.ocorrencias - a.ocorrencias);

        const top3Motivos = Object.entries(byMotivoCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }));

        const top3Tipos = Object.entries(byTipoCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }));

        return {
            totalParadas,
            totalDowntimeHoras,
            totalDowntimeMin,
            tempoMedio,
            volumeLost: Math.round(volumePerdidoEst),
            motivoBarData,
            tipoBarData,
            linhaBarData,
            top3Motivos,
            top3Tipos,
            detailedParadas: detailedParadas.sort((a, b) => {
                const dataDiff = new Date(b.data).getTime() - new Date(a.data).getTime();
                if (dataDiff !== 0) return dataDiff;
                const linhaDiff = a.linha.localeCompare(b.linha);
                if (linhaDiff !== 0) return linhaDiff;
                return b.duracaoMin - a.duracaoMin;
            })
        };
    }, [registros, maquinas, maquinaId]);

    const formatarDataBR = (dateStr: string) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-100 print:text-black">

            {/* Header */}
            <div className="flex flex-col xl:flex-row items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl print-hide">
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="p-3 bg-amber-500 rounded-xl text-black shadow-lg shadow-amber-500/20">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-tight">Relatório de Paradas por Máquina</h2>
                        <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest leading-none mt-1 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Acompanhamento por Equipamento
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5 focus-within:border-amber-500/50 transition-all shadow-sm">
                            <Calendar className="w-5 h-5 text-slate-500" />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Início</span>
                                <input
                                    type="date"
                                    value={dataInicio}
                                    onChange={e => setDataInicio(e.target.value)}
                                    className="bg-transparent text-[11px] font-black uppercase outline-none text-white cursor-pointer hover:text-amber-400"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5 focus-within:border-amber-500/50 transition-all shadow-sm">
                            <Calendar className="w-5 h-5 text-slate-500" />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Fim</span>
                                <input
                                    type="date"
                                    value={dataFim}
                                    onChange={e => setDataFim(e.target.value)}
                                    className="bg-transparent text-[11px] font-black uppercase outline-none text-white cursor-pointer hover:text-amber-400"
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

                    <select
                        value={maquinaId}
                        onChange={e => setMaquinaId(e.target.value)}
                        className="bg-white/5 border border-amber-500/30 p-2.5 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer text-white"
                    >
                        <option value="todos" className="bg-slate-900">Todas as Máquinas</option>
                        {maquinas.map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.nome}</option>)}
                    </select>

                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="px-6 py-3 bg-amber-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
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

                {/* Cabeçalho */}
                <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center font-black text-white text-3xl">M</div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Relatório de Paradas por Máquina</h1>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Controle de Paradas por Equipamento - Nexus</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">APURAÇÃO DE PARADAS</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                            Período: {formatarDataBR(dataInicio) === formatarDataBR(dataFim) ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
                        </p>
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-1">
                            Máquina: {maquinaSelecionada ? maquinaSelecionada.nome : 'Todas as Máquinas'}
                        </p>
                    </div>
                </header>

                {/* KPIs */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><Settings className="w-8 h-8 text-amber-600" /></div>
                        <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Total de Paradas</p>
                        <h4 className="text-2xl font-black text-amber-900 leading-none">{analytics.totalParadas}</h4>
                        <p className="text-[8px] text-amber-400 font-bold uppercase mt-2 italic">Ocorrências no Período</p>
                    </div>

                    <div className="bg-red-50 p-6 rounded-2xl border border-red-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><Timer className="w-8 h-8 text-red-500" /></div>
                        <p className="text-[10px] font-black text-red-500 uppercase mb-1">Tempo Total Parado</p>
                        <h4 className="text-2xl font-black text-red-900 leading-none">{analytics.totalDowntimeHoras.toFixed(2)} <span className="text-xs font-bold text-red-400">horas</span></h4>
                        <p className="text-[8px] text-red-400 font-bold uppercase mt-2 italic">{analytics.totalDowntimeMin} minutos acumulados</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform"><Activity className="w-8 h-8 text-slate-400" /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Tempo Médio</p>
                        <h4 className="text-2xl font-black text-slate-900 leading-none">{analytics.tempoMedio.toFixed(0)} <span className="text-xs font-bold text-slate-500">min</span></h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-2 italic">Média por Parada</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                        <div className="absolute top-0 right-0 p-2"><AlertCircle className="w-8 h-8 text-red-100" /></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Top 3 Motivos</p>
                            <div className="space-y-2">
                                {analytics.top3Motivos.length > 0 ? (
                                    analytics.top3Motivos.map((mot, idx) => (
                                        <div key={idx} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                                    {idx + 1}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase truncate max-w-[100px] ${idx === 0 ? 'text-red-700' : 'text-slate-600'}`}>
                                                    {mot.name}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-black text-slate-400">{mot.count}x</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xl font-black text-slate-300">--</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                        <div className="absolute top-0 right-0 p-2"><Settings className="w-8 h-8 text-slate-100" /></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Top 3 Tipos</p>
                            <div className="space-y-2">
                                {analytics.top3Tipos.length > 0 ? (
                                    analytics.top3Tipos.map((tipo, idx) => (
                                        <div key={idx} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                                    {idx + 1}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase truncate max-w-[100px] ${idx === 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                                                    {tipo.name}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-black text-slate-400">{tipo.count}x</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xl font-black text-slate-300">--</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden group font-bold">
                        <div className="absolute top-0 right-0 p-2 opacity-10"><Package className="w-8 h-8 text-slate-400" /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto Produtivo</p>
                        <h4 className="text-2xl font-black text-slate-900 leading-none">{Math.abs(analytics.volumeLost).toLocaleString('pt-BR')} <span className="text-xs font-bold opacity-60">un</span></h4>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-2 italic">Volume Perdido Est.</p>
                    </div>
                </section>

                {/* Seção I - Gráficos */}
                <div className="flex items-center gap-4 mb-2 mt-12 pb-4">
                    <div className="h-8 w-1.5 bg-amber-500 rounded-full" />
                    <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
                        I. ANÁLISE DE PARADAS POR CAUSA RAIZ
                    </h3>
                </div>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Gráfico: Ocorrências por Motivo */}
                    <div className="border border-slate-200 rounded-3xl p-8 bg-white h-[450px] flex flex-col">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-amber-600" /> Ocorrências por Motivo
                        </h3>
                        <div className="flex-1 w-full">
                            {analytics.motivoBarData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.motivoBarData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 8, fontWeight: 800, fill: '#64748b' }}
                                            angle={-35}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                        />
                                        <RechartsTooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', color: '#1e293b' }}
                                            formatter={(value: number, name: string) => [name === 'ocorrencias' ? `${value}x` : `${value}h`, name === 'ocorrencias' ? 'Ocorrências' : 'Horas']}
                                        />
                                        <Bar dataKey="ocorrencias" radius={[6, 6, 0, 0]} fill="#d97706">
                                            {analytics.motivoBarData.map((_, index) => (
                                                <Cell key={`cell-m-${index}`} fill={index === 0 ? '#d97706' : '#f59e0b'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChartState />
                            )}
                        </div>
                    </div>

                    {/* Gráfico: Ocorrências por Tipo de Parada */}
                    <div className="border border-slate-200 rounded-3xl p-8 bg-white h-[450px] flex flex-col">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" /> Ocorrências por Tipo de Parada
                        </h3>
                        <div className="flex-1 w-full">
                            {analytics.tipoBarData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.tipoBarData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 8, fontWeight: 800, fill: '#64748b' }}
                                            angle={-35}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                        />
                                        <RechartsTooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', color: '#1e293b' }}
                                            formatter={(value: number, name: string) => [name === 'ocorrencias' ? `${value}x` : `${value}h`, name === 'ocorrencias' ? 'Ocorrências' : 'Horas']}
                                        />
                                        <Bar dataKey="ocorrencias" radius={[6, 6, 0, 0]} fill="#ef4444">
                                            {analytics.tipoBarData.map((_, index) => (
                                                <Cell key={`cell-t-${index}`} fill={index === 0 ? '#ef4444' : '#f87171'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <EmptyChartState />
                            )}
                        </div>
                    </div>
                </section>

                {/* Gráfico: Paradas por Linha */}
                <div className="border border-slate-200 rounded-3xl p-8 bg-white h-[400px] flex flex-col mt-8">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-600" /> Paradas por Linha de Produção
                    </h3>
                    <div className="flex-1 w-full">
                        {analytics.linhaBarData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.linhaBarData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                                        formatter={(value: number, name: string) => [name === 'horas' ? `${value}h` : `${value}x`, name === 'horas' ? 'Horas Paradas' : 'Ocorrências']}
                                    />
                                    <Bar dataKey="ocorrencias" radius={[6, 6, 0, 0]} fill="#2563eb">
                                        {analytics.linhaBarData.map((_, index) => (
                                            <Cell key={`cell-l-${index}`} fill={index === 0 ? '#2563eb' : '#60a5fa'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyChartState />
                        )}
                    </div>
                </div>

                {/* Seção II - Tabela Detalhada */}
                <section className="space-y-4 pt-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-8 w-1.5 bg-slate-900 rounded-full" />
                        <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
                            II. HISTÓRICO DETALHADO DE PARADAS
                        </h3>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="bg-slate-100 border-b-2 border-slate-900">
                                        <th className="px-3 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Data</th>
                                        <th className="px-3 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-center">Turno</th>
                                        <th className="px-3 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Linha</th>
                                        <th className="px-3 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Equipamento</th>
                                        <th className="px-3 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Tipo</th>
                                        <th className="px-3 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest">Motivo</th>
                                        <th className="px-3 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-right">Duração</th>
                                        <th className="px-3 py-4 text-[8px] font-black text-slate-900 uppercase tracking-widest text-right">Vol. Perdido</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[9px] bg-white">
                                    {analytics.detailedParadas.map((item, idx) => (
                                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${item.duracaoMin > 60 ? 'bg-red-50/50' : ''}`}>
                                            <td className="px-3 py-2.5 font-bold text-slate-600 whitespace-nowrap">{formatarDataBR(item.data)}</td>
                                            <td className="px-3 py-2.5 text-center text-slate-900 font-black">{item.turno}</td>
                                            <td className="px-3 py-2.5 text-blue-700 font-black whitespace-nowrap">{item.linha}</td>
                                            <td className="px-3 py-2.5 font-black text-slate-900 uppercase whitespace-nowrap">{item.equipamento}</td>
                                            <td className="px-3 py-2.5 text-red-700 font-black uppercase whitespace-nowrap">{item.tipo}</td>
                                            <td className="px-3 py-2.5 text-slate-700 font-bold uppercase">{item.motivo}</td>
                                            <td className={`px-3 py-2.5 text-right font-black whitespace-nowrap ${item.duracaoMin > 60 ? 'text-red-600' : 'text-slate-900'}`}>
                                                {item.duracaoMin}min
                                                {item.duracaoMin > 60 && <AlertTriangle className="w-2.5 h-2.5 inline ml-0.5 align-middle" />}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-emerald-700 font-bold whitespace-nowrap">
                                                {item.volumePerdido.toLocaleString('pt-BR')} un
                                            </td>
                                        </tr>
                                    ))}
                                    {analytics.detailedParadas.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-5 py-12 text-center text-slate-300 uppercase font-bold tracking-widest italic">
                                                Nenhuma parada registrada no período e máquina selecionados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Rodapé */}
                <footer className="pt-10 border-t-2 border-slate-900 flex justify-between items-end">
                    <div className="flex items-center gap-4">
                        <ShieldCheck className="w-8 h-8 text-slate-400" />
                        <div>
                            <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest leading-none">Nexus PCP v1.0</p>
                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Data Integrity Certified</p>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Controle de Paradas Industrial</p>
                </footer>
            </div>
        </div>
    );
};

export default RelatorioDowntimePorMaquina;
