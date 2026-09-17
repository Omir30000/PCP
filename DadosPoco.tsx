import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Printer,
  Calendar,
  Search,
  Loader2,
  TrendingUp,
  ShieldCheck,
  Droplets,
  Thermometer,
  Waves,
  Activity,
  Zap,
  BarChart3,
  Database,
  ArrowDown,
  ArrowUp,
  Droplet
} from 'lucide-react';

interface RegistroPoco {
  id: number;
  data_registro: string;
  hora_registro: string;
  condutividade_us_cm: number | null;
  nivel_dinamico_m: number | null;
  nivel_estatico_m: number | null;
  ph: number | null;
  temperatura_c: number | null;
  vazao_instantanea: number | null;
  volume_acumulado: number | null;
}

const DadosPoco: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const getPrimeiroDiaMes = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };
  const [dataInicio, setDataInicio] = useState(getPrimeiroDiaMes);
  const [dataFim, setDataFim] = useState(getHoje());
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<RegistroPoco[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);

  const fetchDadosPoco = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dados_poco')
        .select('*')
        .gte('data_registro', dataInicio)
        .lte('data_registro', dataFim)
        .order('data_registro', { ascending: true })
        .order('hora_registro', { ascending: true });

      if (error) throw error;
      setRegistros(data || []);
    } catch (err: any) {
      console.error("Erro ao buscar dados do poço:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDadosPoco();
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
        <title>DADOS DO POÇO - NEXUS PCP</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
          @media print {
            @page { size: A4 landscape; margin: 0.4cm; }
            body { zoom: 0.85; }
            .print\\:hidden { display: none !important; }
            .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
            .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
            .text-white { color: white !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="p-4">${content}</div>
        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 800); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatarHora = (hora: string) => {
    if (!hora) return '';
    return hora.substring(0, 5);
  };

  const formatarNumero = (v: number | null, casas: number = 1) => {
    if (v === null || v === undefined) return '-';
    return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  };

  const analytics = useMemo(() => {
    if (registros.length === 0) {
      return {
        totalRegistros: 0,
        mediaCondutividade: 0,
        mediaNivelDinamico: 0,
        mediaNivelEstatico: 0,
        mediaPh: 0,
        mediaTemperatura: 0,
        mediaVazao: 0,
        volumeInicial: 0,
        volumeFinal: 0,
        volumeExtracao: 0,
        minCondutividade: 0,
        maxCondutividade: 0,
        minPh: 0,
        maxPh: 0,
        minTemperatura: 0,
        maxTemperatura: 0,
        minVazao: 0,
        maxVazao: 0,
        graficoCondutividade: [],
        graficoNivel: [],
        graficoPhTemp: [],
        graficoVazaoVolume: [],
        diasNoPeriodo: 0,
        tableData: []
      };
    }

    const nums = (field: string) => registros.map(r => (r as any)[field]).filter(v => v !== null && v !== undefined) as number[];
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0;
    const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : 0;
    const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;

    const conds = nums('condutividade_us_cm');
    const nivDin = nums('nivel_dinamico_m');
    const nivEst = nums('nivel_estatico_m');
    const phs = nums('ph');
    const temps = nums('temperatura_c');
    const vazoes = nums('vazao_instantanea');

    const volInicial = registros[0]?.volume_acumulado || 0;
    const volFinal = registros[registros.length - 1]?.volume_acumulado || 0;

    // Gráficos agrupados por dia (média diária)
    const porDia: Record<string, RegistroPoco[]> = {};
    registros.forEach(r => {
      if (!porDia[r.data_registro]) porDia[r.data_registro] = [];
      porDia[r.data_registro].push(r);
    });

    const avgField = (arr: RegistroPoco[], field: string) => {
      const vals = arr.map(r => (r as any)[field]).filter(v => v !== null) as number[];
      return vals.length > 0 ? +(sum(vals) / vals.length).toFixed(2) : null;
    };

    const graficoCondutividade = Object.entries(porDia).map(([dia, regs]) => ({
      data: dia.split('-').reverse().join('/'),
      condutividade: avgField(regs, 'condutividade_us_cm')
    })).filter(d => d.condutividade !== null);

    const graficoNivel = Object.entries(porDia).map(([dia, regs]) => ({
      data: dia.split('-').reverse().join('/'),
      dinamico: avgField(regs, 'nivel_dinamico_m'),
      estatico: avgField(regs, 'nivel_estatico_m')
    })).filter(d => d.dinamico !== null || d.estatico !== null);

    const graficoPhTemp = Object.entries(porDia).map(([dia, regs]) => ({
      data: dia.split('-').reverse().join('/'),
      ph: avgField(regs, 'ph'),
      temperatura: avgField(regs, 'temperatura_c')
    })).filter(d => d.ph !== null || d.temperatura !== null);

    const graficoVazaoVolume = Object.entries(porDia).map(([dia, regs]) => ({
      data: dia.split('-').reverse().join('/'),
      vazao: avgField(regs, 'vazao_instantanea'),
      volume: registros.find(r => r.data_registro === dia)?.volume_acumulado || null
    })).filter(d => d.vazao !== null || d.volume !== null);

    const diasNoPeriodo = Object.keys(porDia).length;

    // Dados para tabela (último registro de cada dia)
    const tableData = Object.entries(porDia).map(([dia, regs]) => ({
      data: dia,
      dataBR: formatarDataBR(dia),
      totalRegistros: regs.length,
      condutividadeMedia: avgField(regs, 'condutividade_us_cm'),
      nivelDinamicoMedio: avgField(regs, 'nivel_dinamico_m'),
      nivelEstaticoMedio: avgField(regs, 'nivel_estatico_m'),
      phMedio: avgField(regs, 'ph'),
      temperaturaMedia: avgField(regs, 'temperatura_c'),
      vazaoMedia: avgField(regs, 'vazao_instantanea'),
      volumeInicio: regs[0]?.volume_acumulado || null,
      volumeFim: regs[regs.length - 1]?.volume_acumulado || null,
      extracaoDia: (regs[regs.length - 1]?.volume_acumulado || 0) - (regs[0]?.volume_acumulado || 0)
    })).sort((a, b) => b.data.localeCompare(a.data));

    return {
      totalRegistros: registros.length,
      mediaCondutividade: avg(conds),
      mediaNivelDinamico: avg(nivDin),
      mediaNivelEstatico: avg(nivEst),
      mediaPh: avg(phs),
      mediaTemperatura: avg(temps),
      mediaVazao: avg(vazoes),
      volumeInicial: volInicial,
      volumeFinal: volFinal,
      volumeExtracao: volFinal - volInicial,
      minCondutividade: min(conds),
      maxCondutividade: max(conds),
      minPh: min(phs),
      maxPh: max(phs),
      minTemperatura: min(temps),
      maxTemperatura: max(temps),
      minVazao: min(vazoes),
      maxVazao: max(vazoes),
      graficoCondutividade,
      graficoNivel,
      graficoPhTemp,
      graficoVazaoVolume,
      diasNoPeriodo,
      tableData
    };
  }, [registros]);

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-900 print:text-black">

      {/* Controles do Relatório */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl print:hidden">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-lg shadow-emerald-500/20">
            <Droplet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-tight">Monitoramento do Poço</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1">Dados Hidrológicos do Poço Artesiano</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border-2 border-white/5 focus-within:border-emerald-500 transition-all shadow-sm">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Início / Fim</span>
              <div className="flex items-center gap-2">
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                  className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-emerald-400 transition-colors" />
                <span className="text-slate-500 font-bold">-</span>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-emerald-400 transition-colors" />
              </div>
            </div>
          </div>

          <button onClick={fetchDadosPoco} disabled={loading}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Sincronizando...' : 'Sincronizar'}
          </button>

          <button onClick={handlePrint}
            className="px-6 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 border border-white/10 shadow-xl">
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white p-0 space-y-8 print:p-0">

        {/* Cabeçalho Institucional */}
        <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 break-inside-avoid">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600 rounded-lg flex items-center justify-center font-black text-white text-3xl">
              <Droplet className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Smart Production Hub</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Monitoramento Hidrológico — Poço Artesiano</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="border border-slate-200 rounded-lg px-4 py-2 text-right bg-slate-50">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Emissão</p>
              <p className="text-xs font-black text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="border border-emerald-600 rounded-lg px-6 py-2 text-right bg-emerald-600 text-white">
              <p className="text-[8px] font-black text-white/70 uppercase tracking-widest">Período</p>
              <p className="text-sm font-black uppercase leading-none mt-1">
                {formatarDataBR(dataInicio)} — {formatarDataBR(dataFim)}
              </p>
              <p className="text-[9px] font-bold text-white/60 mt-0.5">{analytics.diasNoPeriodo} DIAS · {analytics.totalRegistros} AMOSTRAS</p>
            </div>
          </div>
        </header>

        {/* KPIs GLOBAIS */}
        <section className="space-y-4 break-inside-avoid">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-emerald-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              INDICADORES GLOBAIS DO POÇO
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-white p-6 rounded-[28px] shadow-xl relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Volume Extraído</p>
              <h4 className="text-3xl font-black leading-none">{formatarNumero(analytics.volumeExtracao, 1)}</h4>
              <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1">m³ no período</p>
            </div>
            <div className="bg-white border-2 border-slate-100 p-6 rounded-[28px] shadow-sm">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Condutividade Média</p>
              <h4 className="text-3xl font-black text-slate-900 leading-none">{formatarNumero(analytics.mediaCondutividade, 1)}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">µS/cm · {formatarNumero(analytics.minCondutividade, 0)}-{formatarNumero(analytics.maxCondutividade, 0)}</p>
            </div>
            <div className="bg-white border-2 border-slate-100 p-6 rounded-[28px] shadow-sm">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">pH Médio</p>
              <h4 className="text-3xl font-black text-slate-900 leading-none">{formatarNumero(analytics.mediaPh, 1)}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Faixa: {formatarNumero(analytics.minPh, 1)} — {formatarNumero(analytics.maxPh, 1)}</p>
            </div>
            <div className="bg-white border-2 border-slate-100 p-6 rounded-[28px] shadow-sm">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Temperatura Média</p>
              <h4 className="text-3xl font-black text-slate-900 leading-none">{formatarNumero(analytics.mediaTemperatura, 1)}°C</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Faixa: {formatarNumero(analytics.minTemperatura, 1)} — {formatarNumero(analytics.maxTemperatura, 1)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border-2 border-transparent p-5 rounded-[28px]">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nível Dinâmico Médio</p>
              <h5 className="text-2xl font-black text-slate-900">{formatarNumero(analytics.mediaNivelDinamico, 1)} <span className="text-xs font-bold text-slate-400">m</span></h5>
            </div>
            <div className="bg-slate-50 border-2 border-transparent p-5 rounded-[28px]">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nível Estático Médio</p>
              <h5 className="text-2xl font-black text-slate-900">{formatarNumero(analytics.mediaNivelEstatico, 1)} <span className="text-xs font-bold text-slate-400">m</span></h5>
            </div>
            <div className="bg-slate-50 border-2 border-transparent p-5 rounded-[28px]">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Vazão Média</p>
              <h5 className="text-2xl font-black text-slate-900">{formatarNumero(analytics.mediaVazao, 1)} <span className="text-xs font-bold text-slate-400">m³/h</span></h5>
            </div>
            <div className="bg-slate-50 border-2 border-transparent p-5 rounded-[28px]">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume Acumulado Final</p>
              <h5 className="text-2xl font-black text-emerald-600">{formatarNumero(analytics.volumeFinal, 1)} <span className="text-xs font-bold text-slate-400">m³</span></h5>
            </div>
          </div>
        </section>

        {/* GRÁFICOS */}
        <section className="space-y-8 break-inside-avoid">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-emerald-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              SÉRIES TEMPORAIS (MÉDIA DIÁRIA)
            </h3>
          </div>

          {/* Gráfico Condutividade */}
          <div className="bg-white border-2 border-slate-100 rounded-[32px] p-6 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-500" /> Condutividade (µS/cm)
            </p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.graficoCondutividade} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCond" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} interval={'preserveStartEnd'} />
                  <YAxis hide={true} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '9px', fontWeight: 900, color: '#fff' }} itemStyle={{ color: '#f59e0b' }} />
                  <Area type="monotone" dataKey="condutividade" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorCond)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico Nível */}
            <div className="bg-white border-2 border-slate-100 rounded-[32px] p-6 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                <Waves className="w-3 h-3 text-blue-500" /> Níveis (m)
              </p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.graficoNivel} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} interval={'preserveStartEnd'} />
                    <YAxis hide={true} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '9px', fontWeight: 900, color: '#fff' }} />
                    <Line type="monotone" dataKey="dinamico" stroke="#3b82f6" strokeWidth={2} dot={false} name="Dinâmico" />
                    <Line type="monotone" dataKey="estatico" stroke="#06b6d4" strokeWidth={2} dot={false} name="Estático" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2 text-[8px] font-black uppercase tracking-widest">
                <span className="text-blue-500 flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 rounded-full inline-block" /> Dinâmico</span>
                <span className="text-cyan-500 flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-500 rounded-full inline-block" /> Estático</span>
              </div>
            </div>

            {/* Gráfico pH e Temperatura */}
            <div className="bg-white border-2 border-slate-100 rounded-[32px] p-6 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                <Thermometer className="w-3 h-3 text-red-500" /> pH e Temperatura
              </p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.graficoPhTemp} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} interval={'preserveStartEnd'} />
                    <YAxis hide={true} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '9px', fontWeight: 900, color: '#fff' }} />
                    <Line type="monotone" dataKey="ph" stroke="#8b5cf6" strokeWidth={2} dot={false} name="pH" />
                    <Line type="monotone" dataKey="temperatura" stroke="#ef4444" strokeWidth={2} dot={false} name="Temp °C" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2 text-[8px] font-black uppercase tracking-widest">
                <span className="text-violet-500 flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-500 rounded-full inline-block" /> pH</span>
                <span className="text-red-500 flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 rounded-full inline-block" /> Temperatura</span>
              </div>
            </div>
          </div>

          {/* Gráfico Volume Acumulado */}
          <div className="bg-white border-2 border-slate-100 rounded-[32px] p-6 shadow-sm">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
              <Droplets className="w-3 h-3 text-emerald-500" /> Volume Acumulado e Vazão
            </p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.graficoVazaoVolume} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} interval={'preserveStartEnd'} />
                  <YAxis hide={true} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '9px', fontWeight: 900, color: '#fff' }} />
                  <Area type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorVol)" name="Volume (m³)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* TABELA RESUMIDA POR DIA */}
        <section className="space-y-4 break-inside-avoid">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-emerald-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              RESUMO DIÁRIO ({analytics.tableData.length} DIAS)
            </h3>
          </div>

          <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[9px] uppercase tracking-widest">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-4 py-3 text-left font-black">Data</th>
                    <th className="px-3 py-3 text-right font-black">µS/cm</th>
                    <th className="px-3 py-3 text-right font-black">Niv. Din. (m)</th>
                    <th className="px-3 py-3 text-right font-black">Niv. Est. (m)</th>
                    <th className="px-3 py-3 text-right font-black">pH</th>
                    <th className="px-3 py-3 text-right font-black">Temp °C</th>
                    <th className="px-3 py-3 text-right font-black">Vazão</th>
                    <th className="px-3 py-3 text-right font-black">Vol. Extraído (m³)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.tableData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-2.5 font-black text-slate-900">{row.dataBR}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatarNumero(row.condutividadeMedia, 1)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatarNumero(row.nivelDinamicoMedio, 1)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatarNumero(row.nivelEstaticoMedio, 1)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-violet-600">{formatarNumero(row.phMedio, 1)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-red-500">{formatarNumero(row.temperaturaMedia, 1)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">{formatarNumero(row.vazaoMedia, 1)}</td>
                      <td className="px-3 py-2.5 text-right font-black text-emerald-600">{formatarNumero(row.extracaoDia, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-12 border-t-2 border-slate-900 break-inside-avoid">
          <div className="flex justify-between items-end mb-20">
            <div className="flex items-center gap-5">
              <ShieldCheck className="w-10 h-10 text-slate-400" />
              <div>
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Monitoramento Poço Artesiano Nexus PCP</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">Autenticação Sincronizada Dashboard v2.6</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic">Nexus Intelligence Terminal</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-32">
            <div className="text-center">
              <div className="border-t border-slate-900 pt-3"></div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Gestão de PCP</p>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-900 pt-3"></div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Gerência Industrial</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DadosPoco;