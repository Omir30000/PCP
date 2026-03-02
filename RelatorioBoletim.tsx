
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Produto, Linha, RegistroProducao } from './types/database';
import {
  Printer,
  Calendar,
  Search,
  Loader2,
  TrendingUp,
  AlertCircle,
  Activity,
  ShieldCheck,
  Package,
  Layers,
  Factory,
  MessageSquare as MessageSquareIcon,
  Calculator,
  UserCheck,
  FileText,
  AlertTriangle,
  Clock,
  ChevronRight,
  Zap,
  Target,
  BarChart3
} from 'lucide-react';

const RelatorioBoletim: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [filtroTurno, setFiltroTurno] = useState<'GLOBAL' | '1º Turno' | '2º Turno'>('GLOBAL');

  const reportRef = useRef<HTMLDivElement>(null);

  const parseMinutos = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const match = String(val).match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  };

  const fetchRelatorioData = async () => {
    setLoading(true);
    try {
      const { data: linesData } = await supabase.from('linhas').select('*').order('nome');
      if (linesData) setLinhas(linesData);

      const { data, error } = await supabase
        .from('registros_producao')
        .select('*, produtos(*)')
        .order('data_registro', { ascending: false });

      if (error) throw error;

      const filtrados = (data || []).filter(r =>
        r.data_registro >= dataInicio && r.data_registro <= dataFim
      );

      setRegistros(filtrados);
    } catch (err) {
      console.error("Erro na consolidação do relatório:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelatorioData();
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
          <title>BOLETIM DIÁRIO - NEXUS PCP</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
            @media print {
              @page { size: A4 portrait; margin: 0.5cm; }
              body { zoom: 0.95; }
              .print\\:hidden { display: none !important; }
              .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
              .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
              .bg-blue-600 { background-color: #2563eb !important; color: white !important; -webkit-print-color-adjust: exact; }
              .text-white { color: white !important; }
            }
          </style>
      </head>
      <body>
          <div class="p-4">${content}</div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 600); };</script>
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

  const analytics = useMemo(() => {
    const idsLinhas = ['1', '2', '3', '4', '5'];
    const d1 = new Date(dataInicio);
    const d2 = new Date(dataFim);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let totalCargaHorariaGlobalMin = 0;

    const registrosFiltradosTurno = filtroTurno === 'GLOBAL'
      ? registros
      : registros.filter(r => r.turno === filtroTurno);

    const linesSummary = idsLinhas.map(num => {
      const regsDaLinha = registrosFiltradosTurno.filter(r =>
        String(r.linha_producao).includes(num) ||
        String(r.linha_producao).toUpperCase().includes(`LINHA ${num}`) ||
        String(r.linha_producao).toUpperCase().includes(`LINHA 0${num}`)
      );

      let totalQty = 0;
      let totalDowntimeLinha = 0;
      let totalEfficiencyLinha = 0;
      let status: 'active' | 'inactive' = 'inactive';

      if (regsDaLinha.length > 0) {
        status = 'active';
        totalQty = regsDaLinha.reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);

        const sumEff = regsDaLinha.reduce((acc, r) => {
          const metaNominal = Number(r.produtos?.capacidade_nominal) || 7200;
          const cargaHoras = Number(r.carga_horaria) || 8;
          const tempoDispMin = cargaHoras * 60;
          totalCargaHorariaGlobalMin += tempoDispMin;

          const paradas = Array.isArray(r.paradas) ? r.paradas : [];
          const downtimeRegMin = paradas.reduce((a, b: any) => {
            const min = parseMinutos(b.duracao || b.tempo || b.total_min || 0);
            return a + min;
          }, 0);

          totalDowntimeLinha += downtimeRegMin;

          const disponibilidade = tempoDispMin > 0 ? (tempoDispMin - downtimeRegMin) / tempoDispMin : 0;
          const metaAjustada = (metaNominal / 8) * cargaHoras;
          const performance = metaAjustada > 0 ? (Number(r.quantidade_produzida) / metaAjustada) : 0;

          return acc + (performance * disponibilidade * 100);
        }, 0);

        totalEfficiencyLinha = sumEff / regsDaLinha.length;
      }

      const latestProd = regsDaLinha[0]?.produtos;
      const unitsPerBundle = Number(latestProd?.unidades_por_fardo) || 12;
      const bundlesPerPallet = Number(latestProd?.fardos_por_palete) || 100;
      const totalBundles = Math.floor(totalQty / unitsPerBundle);

      return {
        id: num,
        nome: `Linha ${num}`,
        status,
        producaoTotal: totalQty,
        totalBundles,
        totalPallets: parseFloat((totalBundles / bundlesPerPallet).toFixed(1)),
        eficiencia: totalEfficiencyLinha || 0,
        downtime: totalDowntimeLinha || 0
      };
    });

    const factoryTotals = {
      totalUnits: linesSummary.reduce((acc, l) => acc + l.producaoTotal, 0),
      bundles: linesSummary.reduce((acc, l) => acc + l.totalBundles, 0),
      pallets: parseFloat(linesSummary.reduce((acc, l) => acc + l.totalPallets, 0).toFixed(1)),
      avgEfficiency: linesSummary.filter(l => l.status === 'active').length > 0
        ? linesSummary.filter(l => l.status === 'active').reduce((acc, l) => acc + l.eficiencia, 0) / linesSummary.filter(l => l.status === 'active').length
        : 0
    };

    return { linesSummary, factoryTotals, diffDays };
  }, [registros, dataInicio, dataFim, filtroTurno]);

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-900 print:text-black">

      {/* Controles do Relatório */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 rounded-xl text-white">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Gerador de Boletim</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Consolidação Industrial em A4</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['GLOBAL', '1º Turno', '2º Turno'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTurno(t)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filtroTurno === t ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {t}
              </button>
            ))}
          </div>

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

          <button
            onClick={fetchRelatorioData}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Sincronizar
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

      <div ref={reportRef} className="bg-white p-0 space-y-8 print:p-0">

        {/* Cabeçalho Institucional */}
        <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 break-inside-avoid">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center font-black text-white text-3xl">P</div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Smart Production Hub</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Boletim Diário de Operações Industriais</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="border border-slate-200 rounded-lg px-4 py-2 text-right bg-slate-50">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data de Emissão</p>
              <p className="text-xs font-black text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="border border-slate-900 rounded-lg px-6 py-2 text-right bg-slate-900 text-white">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Período / Turno</p>
              <p className="text-sm font-black uppercase leading-none mt-1">
                {dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
                {filtroTurno !== 'GLOBAL' && <span className="ml-2 text-[10px] font-bold uppercase opacity-60">({filtroTurno})</span>}
              </p>
            </div>
          </div>
        </header>

        {/* TOTALIZAÇÃO GLOBAL DE FÁBRICA - ALICERCE (ALTO IMPACTO) */}
        <section className="space-y-6 break-inside-avoid">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-blue-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              III. TOTALIZAÇÃO GLOBAL DE FÁBRICA (ALICERCE OPERACIONAL)
            </h3>
          </div>

          <div className="grid grid-cols-12 gap-6 w-full">
            {/* KPI Principal: Volume Consolidado */}
            <div className="col-span-12 lg:col-span-8 bg-slate-900 text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Volume Consolidado Total</p>
                  <h4 className="text-7xl font-black tracking-tighter leading-none mb-2">
                    {analytics.factoryTotals.totalUnits.toLocaleString()}
                  </h4>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                    <Package className="w-3.5 h-3.5" /> Total de Unidades Produzidas no Período
                  </p>
                </div>
                <div className="h-24 w-px bg-white/10 hidden md:block" />
                <div className="text-center md:text-right">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">OEE Médio de Planta</p>
                  <h4 className="text-6xl font-black text-emerald-400 tracking-tighter leading-none mb-2">
                    {analytics.factoryTotals.avgEfficiency.toFixed(1)}%
                  </h4>
                  <div className="w-48 h-3 bg-white/5 rounded-full overflow-hidden mt-4 inline-block">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${analytics.factoryTotals.avgEfficiency}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* KPIs Secundários: Logística e Diária */}
            <div className="col-span-12 lg:col-span-4 grid grid-cols-1 gap-6">
              <div className="bg-white border-2 border-slate-100 p-8 rounded-[40px] shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Média Diária</p>
                  <h5 className="text-3xl font-black text-slate-900">
                    {Math.round(analytics.factoryTotals.totalUnits / analytics.diffDays).toLocaleString()}
                  </h5>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">UN / DIA</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[40px] flex items-center justify-between border-2 border-transparent hover:border-blue-100 transition-all">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Fração Logística</p>
                  <h5 className="text-3xl font-black text-blue-600">
                    {analytics.factoryTotals.pallets.toFixed(1)}
                  </h5>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">PALETES (PLT)</p>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                  <Layers className="w-8 h-8 text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Grade de Desempenho por CT */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-600" /> I. DESEMPENHO ISOLADO POR CENTRO DE TRABALHO
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {analytics.linesSummary.map(line => (
              <div
                key={line.id}
                className={`p-5 border rounded-[24px] space-y-4 break-inside-avoid ${line.status === 'active' ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-60 grayscale'
                  }`}
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{line.nome}</span>
                  <span className={`text-[8px] font-black px-3 py-1 rounded-full ${line.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'} uppercase tracking-widest`}>
                    {line.status === 'active' ? 'Operante' : 'Inativa'}
                  </span>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Carga Produzida</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">
                      {line.producaoTotal.toLocaleString()} <span className="text-[12px] text-slate-400 uppercase font-black">un</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 rounded-xl text-center">
                    <p className="text-[10px] font-black text-emerald-600">{line.eficiencia.toFixed(1)}% <span className="text-[8px] text-slate-400 uppercase ml-1">OEE</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 py-3 bg-slate-50 rounded-2xl px-4">
                  <div className="flex items-center gap-3">
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-black text-slate-900">{line.totalBundles.toLocaleString()} <span className="text-slate-400 font-bold ml-1">PK</span></span>
                  </div>
                  <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-black text-slate-900">{line.totalPallets.toFixed(1)} <span className="text-slate-400 font-bold ml-1">PLT</span></span>
                  </div>
                </div>

                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${line.eficiencia >= 80 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                    style={{ width: `${Math.min(100, line.eficiencia)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rodapé Nexus */}
        <footer className="pt-12 border-t-2 border-slate-900 break-inside-avoid">
          <div className="flex justify-between items-end mb-16">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-slate-400" />
              <div>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Consolidação Industrial Nexus PCP</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">Autenticação Certificada: {Math.random().toString(36).substring(7).toUpperCase()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Emitido via Terminal Nexus em: {new Date().toLocaleString('pt-BR')}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 opacity-50">Documento Classificado - Uso Interno</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-20">
            <div className="text-center">
              <div className="border-t border-slate-900 pt-3 mb-1"></div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Gestão de PCP</p>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-900 pt-3 mb-1"></div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Diretoria de Operações</p>
            </div>
          </div>
        </footer>
      </div>

    </div>
  );
};

export default RelatorioBoletim;
