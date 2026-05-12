
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Produto, Linha, RegistroProducao } from './types/database';
import {
  AreaChart,
  Area,
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
  Activity,
  ShieldCheck,
  Package,
  Layers,
  Calculator,
  ChevronRight,
  Zap,
  Target,
  BarChart3,
  FlaskConical,
  BrainCircuit,
  Sun,
  Moon
} from 'lucide-react';

const RelatorioBoletimExpansao: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [filtroTurno, setFiltroTurno] = useState<'GLOBAL' | '1º Turno' | '2º Turno'>('GLOBAL');

  // Estados para IA
  const [isGenerating, setIsGenerating] = useState(false);
  const [insightsTurno1, setInsightsTurno1] = useState<string>('');
  const [insightsTurno2, setInsightsTurno2] = useState<string>('');

  const reportRef = useRef<HTMLDivElement>(null);

  const fetchRelatorioData = async () => {
    setLoading(true);
    try {
      const { data: linesData } = await supabase.from('linhas').select('*').order('nome');
      if (linesData) setLinhas(linesData);

      const { data, error } = await supabase
        .from('registros_producao')
        .select('*, produtos(*)')
        .gte('data_registro', dataInicio)
        .lte('data_registro', dataFim)
        .order('data_registro', { ascending: true });

      if (error) throw error;
      setRegistros(data || []);
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
          <title>BOLETIM EXPANSÃO - NEXUS PCP</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
            @media print {
              @page { size: A4 portrait; margin: 0.5cm; }
              body { zoom: 0.90; }
              .print\\:hidden { display: none !important; }
              .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
              .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
              .bg-purple-600 { background-color: #9333ea !important; color: white !important; -webkit-print-color-adjust: exact; }
              .text-white { color: white !important; }
              .recharts-area { -webkit-print-color-adjust: exact; }
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

  const generateAIAnalysis = async () => {
    if (registros.length === 0) {
      alert("Sincronize os dados primeiro!");
      return;
    }

    setIsGenerating(true);
    const MISTRAL_API_KEY = "VUM0jYdoE3DFV4txchjU70t0QiCir6sx";

    const getTurnoData = (turno: string) => {
      const regs = registros.filter(r => r.turno === turno);
      const prod = regs.reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);
      const cap = regs.reduce((acc, r) => acc + (Number(r.produtos?.capacidade_nominal) || 0), 0);
      const horas = regs.reduce((acc, r) => acc + (Number(r.carga_horaria) || 0), 0);
      return { turno, prod, cap, horas, ef: cap > 0 ? (prod / cap * 100).toFixed(1) : '0' };
    };

    const dataT1 = getTurnoData('1º Turno');
    const dataT2 = getTurnoData('2º Turno');

    const basePrompt = (data: any) => `
      Você é um Consultor Master de Produção Industrial e Especialista em RH Industrial.
      Analise os dados do ${data.turno}:
      - Produção: ${data.prod} unidades
      - Eficiência (OEE): ${data.ef}%
      - Carga Horária: ${data.horas}h
      
      Forneça um diagnóstico curto (3-4 bullets) focado em:
      1. Melhoria de Processo (Produção).
      2. Fator Humano (RH/Motivação/Fadiga).
      3. Uma ideia disruptiva para esse turno.
      Seja direto, profissional e inspirador.
    `;

    try {
      const callMistral = async (prompt: string) => {
        const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
          body: JSON.stringify({
            model: "open-mistral-7b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
          })
        });
        const d = await res.json();
        return d.choices[0].message.content;
      };

      const [ins1, ins2] = await Promise.all([
        callMistral(basePrompt(dataT1)),
        callMistral(basePrompt(dataT2))
      ]);

      setInsightsTurno1(ins1);
      setInsightsTurno2(ins2);
    } catch (err) {
      console.error("Erro IA:", err);
    } finally {
      setIsGenerating(false);
    }
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

    const diasNoPeriodo: string[] = [];
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(d1);
      d.setDate(d1.getDate() + i);
      diasNoPeriodo.push(d.toISOString().split('T')[0]);
    }

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
      let totalCapNominalLinha = 0;
      let totalCargaHorariaLinha = 0;
      let status: 'active' | 'inactive' = 'inactive';
      
      const skusMap: Record<string, { 
        nome: string, 
        unidades: number, 
        pacotes: number, 
        paletes: number,
        horas: number,
        unidadesPorFardo: number,
        fardosPorPalete: number
      }> = {};

      const serieHistorica = diasNoPeriodo.map(dia => {
        const regsDoDia = regsDaLinha.filter(r => r.data_registro === dia);
        const qtdDia = regsDoDia.reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);
        return {
          data: dia.split('-').reverse().join('/'),
          quantidade: qtdDia
        };
      }).filter(d => d.quantidade > 0);

      if (regsDaLinha.length > 0) {
        status = 'active';
        totalQty = regsDaLinha.reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);
        totalCapNominalLinha = regsDaLinha.reduce((acc, r) => {
          const cap = Number(r.capacidade_producao) || 0;
          return acc + cap;
        }, 0);
        totalCargaHorariaLinha = regsDaLinha.reduce((acc, r) => acc + (Number(r.carga_horaria) || 0), 0);

        regsDaLinha.forEach(r => {
          const prod = r.produtos;
          if (!prod) return;
          
          const skuId = prod.id;
          if (!skusMap[skuId]) {
            skusMap[skuId] = {
              nome: prod.nome,
              unidades: 0,
              pacotes: 0,
              paletes: 0,
              horas: 0,
              unidadesPorFardo: Number(prod.unidades_por_fardo) || 12,
              fardosPorPalete: Number(prod.fardos_por_palete) || 100
            };
          }
          
          const qtd = Number(r.quantidade_produzida) || 0;
          const carga = Number(r.carga_horaria) || 0;
          skusMap[skuId].unidades += qtd;
          skusMap[skuId].horas += carga;
        });

        Object.values(skusMap).forEach(sku => {
          sku.pacotes = Math.floor(sku.unidades / sku.unidadesPorFardo);
          sku.paletes = sku.pacotes / sku.fardosPorPalete;
        });
      }

      const skusSummary = Object.values(skusMap).sort((a, b) => b.unidades - a.unidades);
      const totalBundles = skusSummary.reduce((acc, s) => acc + s.pacotes, 0);
      const totalPallets = skusSummary.reduce((acc, s) => acc + s.paletes, 0);
      const eficiencia = totalCapNominalLinha > 0 ? (totalQty / totalCapNominalLinha) * 100 : 0;

      return {
        id: num,
        nome: `Linha ${num}`,
        status,
        producaoTotal: totalQty,
        totalBundles,
        totalPallets: parseFloat(totalPallets.toFixed(1)),
        eficiencia,
        capNominal: totalCapNominalLinha,
        cargaHoraria: totalCargaHorariaLinha,
        serieHistorica,
        skusSummary
      };
    });

    const totalProduzidoGeral = linesSummary.reduce((acc, l) => acc + l.producaoTotal, 0);
    const totalCapNominalGeral = linesSummary.reduce((acc, l) => acc + l.capNominal, 0);
    const avgEfficiency = totalCapNominalGeral > 0 ? (totalProduzidoGeral / totalCapNominalGeral) * 100 : 0;

    const factoryTotals = {
      totalUnits: totalProduzidoGeral,
      bundles: linesSummary.reduce((acc, l) => acc + l.totalBundles, 0),
      pallets: parseFloat(linesSummary.reduce((acc, l) => acc + l.totalPallets, 0).toFixed(1)),
      avgEfficiency
    };

    return { linesSummary, factoryTotals, diffDays };
  }, [registros, dataInicio, dataFim, filtroTurno]);

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-900 print:text-black">

      {/* Controles do Relatório Premium */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-purple-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl print:hidden">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="p-3 bg-purple-600 rounded-xl text-white shadow-lg shadow-purple-500/20">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-none">Boletim Expansão</h2>
            <p className="text-[10px] font-semibold text-purple-200 uppercase tracking-widest leading-none mt-1 italic">Ambiente de Desenvolvimento de Novas Métricas</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 backdrop-blur-sm">
            {(['GLOBAL', '1º Turno', '2º Turno'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTurno(t)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filtroTurno === t ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border-2 border-white/5 focus-within:border-purple-500 transition-all shadow-sm">
            <Calendar className="w-5 h-5 text-purple-400" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Início / Fim</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-purple-400 transition-colors"
                />
                <span className="text-slate-500 font-bold">-</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-purple-400 transition-colors"
                />
              </div>
            </div>
          </div>

          <button
            onClick={fetchRelatorioData}
            disabled={loading}
            className="px-6 py-3 bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Sincronizar
          </button>

          <button
            onClick={generateAIAnalysis}
            disabled={isGenerating || registros.length === 0}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            Análise Master (IA)
          </button>

          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 border border-white/10 shadow-xl"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white p-0 space-y-8 print:p-0">
        <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 break-inside-avoid">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-600 rounded-lg flex items-center justify-center font-black text-white text-3xl">E</div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Boletim Expansão - Nexus</h1>
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-[0.2em] mt-1">Ambiente de Testes e Evolução Industrial</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="border border-slate-200 rounded-lg px-4 py-2 text-right bg-slate-50">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data Emissão</p>
              <p className="text-xs font-black text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="border border-slate-900 rounded-lg px-6 py-2 text-right bg-slate-900 text-white">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Período / Turno</p>
              <p className="text-sm font-black uppercase leading-none mt-1">
                {dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
              </p>
            </div>
          </div>
        </header>

        {/* O resto do conteúdo é idêntico ao original, mas agora em um arquivo separado para testes */}
        {/* ... manter o corpo igual para garantir a cópia idêntica ... */}
        
        {/* TOTALIZAÇÃO GLOBAL */}
        <section className="space-y-6 break-inside-avoid">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-purple-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              III. TOTALIZAÇÃO GLOBAL DE FÁBRICA
            </h3>
          </div>

          <div className="grid grid-cols-12 gap-6 w-full">
            <div className="col-span-12 lg:col-span-8 bg-slate-900 text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Volume Consolidado Total</p>
                  <h4 className="text-7xl font-black tracking-tighter leading-none mb-2">
                    {analytics.factoryTotals.totalUnits.toLocaleString()}
                  </h4>
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                    <Package className="w-3.5 h-3.5" /> Total de Unidades Produzidas
                  </p>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Eficiência de Planta</p>
                  <h4 className="text-6xl font-black text-emerald-400 tracking-tighter leading-none mb-2">
                    {analytics.factoryTotals.avgEfficiency.toFixed(1)}%
                  </h4>
                  <div className="w-48 h-3 bg-white/5 rounded-full overflow-hidden mt-4 inline-block">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${analytics.factoryTotals.avgEfficiency}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 grid grid-cols-1 gap-6">
              <div className="bg-white border-2 border-slate-100 p-8 rounded-[40px] shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Média Diária</p>
                  <h5 className="text-3xl font-black text-slate-900">
                    {Math.round(analytics.factoryTotals.totalUnits / analytics.diffDays).toLocaleString()}
                  </h5>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              <div className="bg-slate-50 p-8 rounded-[40px] flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Expedição (PLT)</p>
                  <h5 className="text-3xl font-black text-purple-600">
                    {analytics.factoryTotals.pallets.toFixed(1)}
                  </h5>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                  <Layers className="w-8 h-8 text-purple-400" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ANÁLISE DE IA POR TURNO - EXPANSÃO */}
        {(insightsTurno1 || insightsTurno2 || isGenerating) && (
          <section className="space-y-6 pt-10 break-inside-avoid">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-8 w-1.5 bg-indigo-600 rounded-full" />
              <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
                IV. DIAGNÓSTICO MASTER: PRODUÇÃO & RECURSOS HUMANOS
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Card Turno 1 */}
              <div className="bg-indigo-50/50 border-2 border-indigo-100 p-8 rounded-[40px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Sun className="w-12 h-12 text-indigo-600" /></div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black">1º</div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">Análise Matinal</h4>
                    <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Foco em Processos e Energia</p>
                  </div>
                </div>
                {isGenerating && !insightsTurno1 ? (
                  <div className="py-10 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    <p className="text-[10px] font-black text-slate-400 uppercase animate-pulse">Consultando Especialista...</p>
                  </div>
                ) : (
                  <div className="prose prose-slate max-w-none">
                    <div className="text-[11px] font-bold text-slate-700 leading-relaxed whitespace-pre-line space-y-4">
                      {insightsTurno1}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Turno 2 */}
              <div className="bg-slate-900 border-2 border-slate-800 p-8 rounded-[40px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Moon className="w-12 h-12 text-indigo-400" /></div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-indigo-400 rounded-2xl flex items-center justify-center text-slate-900 font-black">2º</div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter leading-none">Análise Vespertina</h4>
                    <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest mt-1">Foco em RH e Sustentabilidade</p>
                  </div>
                </div>
                {isGenerating && !insightsTurno2 ? (
                  <div className="py-10 flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    <p className="text-[10px] font-black text-slate-600 uppercase animate-pulse">Consultando Especialista...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    <div className="text-[11px] font-bold text-slate-300 leading-relaxed whitespace-pre-line space-y-4">
                      {insightsTurno2}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* PERFORMANCE POR CT */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-purple-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              I. EVOLUÇÃO E PERFORMANCE POR CT
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {analytics.linesSummary.map(line => (
              <div
                key={line.id}
                className={`p-8 border-2 rounded-[40px] flex flex-col lg:flex-row gap-10 break-inside-avoid shadow-sm ${line.status === 'active' ? 'border-slate-100 bg-white' : 'border-slate-50 bg-slate-50/50 opacity-60 grayscale'}`}
              >
                <div className="lg:w-1/3 space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{line.nome}</h4>
                    </div>
                    <div className={`p-3 rounded-xl ${line.eficiencia >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-6 rounded-3xl text-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Carga Horária</p>
                      <p className="text-sm font-black text-slate-900">{(line.cargaHoraria || 0).toFixed(1)}h</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl text-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Eficiência</p>
                      <p className={`text-2xl font-black ${line.eficiencia >= 80 ? 'text-emerald-500' : 'text-purple-600'}`}>
                        {line.eficiencia.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-3xl text-white">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Produção Realizada</p>
                    <p className="text-3xl font-black leading-none">
                      {line.producaoTotal.toLocaleString()} <span className="text-xs text-purple-400 font-bold">UN</span>
                    </p>
                  </div>
                </div>

                <div className="lg:w-2/3 space-y-6">
                  <div className="h-[220px] bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 text-center">Tendência Evolutiva</p>
                    <ResponsiveContainer width="100%" height="80%">
                      <AreaChart data={line.serieHistorica} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`colorQty-${line.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                        <YAxis hide={true} />
                        <Area type="monotone" dataKey="quantidade" stroke="#9333ea" strokeWidth={3} fillOpacity={1} fill={`url(#colorQty-${line.id})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {line.status === 'active' && line.skusSummary.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-2 text-slate-900">
                          <Package className="w-3.5 h-3.5 text-purple-600" /> Detalhamento SKU
                        </div>
                        <div className="flex gap-4 pr-2">
                          <span className="w-14 text-right">UN</span>
                          <span className="w-10 text-right">H</span>
                          <span className="w-16 text-right">UN/H</span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {line.skusSummary.map((sku, idx) => (
                          <div key={idx} className="px-6 py-3 flex justify-between items-center">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-[11px] font-black text-slate-800 uppercase truncate">{sku.nome}</p>
                            </div>
                            <div className="flex gap-4 items-center">
                              <span className="text-[11px] font-black text-slate-900 w-14 text-right">{sku.unidades.toLocaleString()}</span>
                              <span className="text-[11px] font-bold text-slate-500 w-10 text-right">{sku.horas.toFixed(1)}h</span>
                              <span className="text-[11px] font-black text-emerald-600 w-16 text-right">{sku.horas > 0 ? Math.round(sku.unidades / sku.horas).toLocaleString() : '0'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="pt-12 border-t-2 border-slate-900 break-inside-avoid">
          <div className="flex justify-between items-end mb-10">
            <div className="flex items-center gap-5">
              <ShieldCheck className="w-10 h-10 text-slate-400" />
              <div>
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Nexus PCP - Versão Expansão</p>
                <p className="text-[8px] font-bold text-purple-400 uppercase tracking-[0.3em]">Ambiente Isolado para Testes</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic">Nexus Intelligence Terminal</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default RelatorioBoletimExpansao;
