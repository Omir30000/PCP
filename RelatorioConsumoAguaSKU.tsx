import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Linha } from './types/database';
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
  Droplets,
  Calculator,
  Zap,
  Target,
  BarChart3,
  Waves,
  Boxes
} from 'lucide-react';

const RelatorioConsumoAguaSKU: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [filtroTurno, setFiltroTurno] = useState<'GLOBAL' | '1º Turno' | '2º Turno'>('GLOBAL');

  const reportRef = useRef<HTMLDivElement>(null);
  const produtosMapRef = useRef<Record<string, any>>({});

  const extrairNumeroLinha = (valor: string): string | null => {
    const m = String(valor || '').match(/linha\s*0*(\d+)/i);
    return m ? m[1] : null;
  };

  const parseVolumeToLiters = (volumeStr: string | null): number => {
    if (!volumeStr) return 0;
    const cleanStr = volumeStr.toLowerCase().replace(/\s/g, '');
    const numericPart = parseFloat(cleanStr.match(/[\d.]+/)?.[0] || '0');
    if (cleanStr.includes('ml')) return numericPart / 1000;
    return numericPart;
  };

  const fetchRelatorioData = async () => {
    setLoading(true);
    try {
      const [linesData, produtosData, registrosData] = await Promise.all([
        supabase.from('linhas').select('*').order('nome'),
        supabase.from('produtos').select('*'),
        supabase.from('registros_producao').select('*')
          .gte('data_registro', dataInicio)
          .lte('data_registro', dataFim)
          .order('data_registro', { ascending: true })
      ]);

      if (linesData.data) setLinhas(linesData.data.filter(l => /^linha\s/i.test(l.nome)));
      if (produtosData.data) {
        setProdutos(produtosData.data);
        const map: Record<string, any> = {};
        produtosData.data.forEach((p: any) => {
          map[p.id] = p;
          map[p.nome] = p;
        });
        produtosMapRef.current = map;
      }
      if (registrosData.error) throw registrosData.error;
      setRegistros(registrosData.data || []);
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
          <title>CONSUMO HÍDRICO POR SKU - NEXUS PCP</title>
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
              .bg-cyan-600 { background-color: #0891b2 !important; color: white !important; -webkit-print-color-adjust: exact; }
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

  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const analytics = useMemo(() => {
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

    // Agrupamento por SKU (produto)
    const skusMap: Record<string, {
      id: string,
      nome: string,
      volume: string,
      litrosUnidade: number,
      unidades: number,
      litros: number,
      horas: number,
      linhasMap: Record<string, { nome: string, unidades: number, litros: number, horas: number }>
    }> = {};

    registrosFiltradosTurno.forEach(r => {
      const prod = produtosMapRef.current[r.produto_id] || produtosMapRef.current[r.produto_volume];
      if (!prod) return;

      const skuId = prod.id;
      const volumeLitro = parseVolumeToLiters(prod.volume);
      if (!skusMap[skuId]) {
        skusMap[skuId] = {
          id: prod.id,
          nome: prod.nome,
          volume: prod.volume || '-',
          litrosUnidade: volumeLitro,
          unidades: 0,
          litros: 0,
          horas: 0,
          linhasMap: {}
        };
      }
      const sku = skusMap[skuId];
      const qtd = Number(r.quantidade_produzida) || 0;
      const carga = Number(r.carga_horaria) || 0;
      const litros = qtd * volumeLitro;

      sku.unidades += qtd;
      sku.litros += litros;
      sku.horas += carga;

      const numLinha = extrairNumeroLinha(r.linha_producao);
      const chaveLinha = numLinha ? `Linha ${numLinha}` : (String(r.linha_producao) || 'GERAL');
      if (!sku.linhasMap[chaveLinha]) {
        sku.linhasMap[chaveLinha] = { nome: chaveLinha, unidades: 0, litros: 0, horas: 0 };
      }
      sku.linhasMap[chaveLinha].unidades += qtd;
      sku.linhasMap[chaveLinha].litros += litros;
      sku.linhasMap[chaveLinha].horas += carga;
    });

    const skusSummary = Object.values(skusMap)
      .sort((a, b) => b.litros - a.litros)
      .map(sku => {
        const linhasSummary = Object.values(sku.linhasMap).sort((a, b) => b.litros - a.litros);
        const linhasAtivas = linhasSummary.length > 0;

        const serieHistorica = diasNoPeriodo.map(dia => {
          const litrosDia = registrosFiltradosTurno.reduce((acc, r) => {
            const prod = produtosMapRef.current[r.produto_id] || produtosMapRef.current[r.produto_volume];
            if (!prod || prod.id !== sku.id || r.data_registro !== dia) return acc;
            return acc + ((Number(r.quantidade_produzida) || 0) * parseVolumeToLiters(prod.volume));
          }, 0);
          return {
            data: dia.split('-').reverse().join('/'),
            litros: litrosDia
          };
        }).filter(d => d.litros > 0);

        return {
          id: sku.id,
          nome: sku.nome,
          volume: sku.volume,
          litrosUnidade: sku.litrosUnidade,
          unidades: sku.unidades,
          litros: sku.litros,
          m3: sku.litros / 1000,
          horas: sku.horas,
          litrosPorHora: sku.horas > 0 ? sku.litros / sku.horas : 0,
          status: linhasAtivas ? 'active' as const : 'inactive' as const,
          linhasSummary,
          serieHistorica
        };
      });

    const skusComProducao = skusSummary.filter(s => s.status === 'active');

    const totalUnidades = skusComProducao.reduce((acc, s) => acc + s.unidades, 0);
    const totalLitros = skusComProducao.reduce((acc, s) => acc + s.litros, 0);

    const factoryTotals = {
      totalUnits: totalUnidades,
      totalLitros,
      totalM3: totalLitros / 1000,
      totalSkus: skusComProducao.length
    };

    return { skusSummary, factoryTotals, diffDays };
  }, [registros, dataInicio, dataFim, filtroTurno, linhas]);

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-900 print:text-black">

      {/* Controles do Relatório Premium */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl print:hidden">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="p-3 bg-cyan-600 rounded-xl text-white shadow-lg shadow-cyan-500/20">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-tight">Consumo Hídrico por SKU</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1">Volume de Líquido Envasado Consolidado por Produto</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 backdrop-blur-sm">
            {(['GLOBAL', '1º Turno', '2º Turno'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTurno(t)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filtroTurno === t ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border-2 border-white/5 focus-within:border-cyan-500 transition-all shadow-sm">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Início / Fim</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-cyan-400 transition-colors"
                  title="Data Inicial"
                />
                <span className="text-slate-500 font-bold">-</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-cyan-400 transition-colors"
                  title="Data Final"
                />
              </div>
            </div>
          </div>

          <button
            onClick={fetchRelatorioData}
            disabled={loading}
            className="px-6 py-3 bg-cyan-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-cyan-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Sincronizando...' : 'Sincronizar'}
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

      <div ref={reportRef} className="bg-white p-0 space-y-8 print:p-0">

        {/* Cabeçalho Institucional */}
        <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 break-inside-avoid">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-cyan-600 rounded-lg flex items-center justify-center font-black text-white text-3xl">
              <Boxes className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Smart Production Hub</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Consumo Hídrico & Volume Envasado por SKU</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="border border-slate-200 rounded-lg px-4 py-2 text-right bg-slate-50">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Data de Emissão</p>
              <p className="text-xs font-black text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="border border-cyan-600 rounded-lg px-6 py-2 text-right bg-cyan-600 text-white">
              <p className="text-[8px] font-black text-slate-900/70 uppercase tracking-widest">Período / Turno</p>
              <p className="text-sm font-black uppercase leading-none mt-1">
                {dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
                {filtroTurno !== 'GLOBAL' && <span className="ml-2 text-[10px] font-bold uppercase opacity-60">({filtroTurno})</span>}
              </p>
            </div>
          </div>
        </header>

        {/* TOTALIZAÇÃO GLOBAL DE FÁBRICA - ALICERCE */}
        <section className="space-y-6 break-inside-avoid">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-cyan-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              III. TOTALIZAÇÃO GLOBAL DE FÁBRICA (ALICERCE OPERACIONAL)
            </h3>
          </div>

          <div className="grid grid-cols-12 gap-6 w-full">
            <div className="col-span-12 lg:col-span-8 bg-slate-900 text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Volume Total Envasado</p>
                  <h4 className="text-7xl font-black tracking-tighter leading-none mb-2">
                    {analytics.factoryTotals.totalM3.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </h4>
                  <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                    <Droplets className="w-3.5 h-3.5" /> m³ de Líquido Envasado em {analytics.factoryTotals.totalSkus} SKUs
                  </p>
                </div>
                <div className="h-24 w-px bg-white/10 hidden md:block" />
                <div className="text-center md:text-right">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">SKUs em Operação</p>
                  <h4 className="text-6xl font-black text-emerald-400 tracking-tighter leading-none mb-2">
                    {analytics.factoryTotals.totalSkus}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produtos com Registros</p>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 grid grid-cols-1 gap-6">
              <div className="bg-white border-2 border-slate-100 p-8 rounded-[40px] shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Litros Envasados</p>
                  <h5 className="text-3xl font-black text-slate-900">
                    {analytics.factoryTotals.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </h5>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">LITROS CONSOLIDADO</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <Droplets className="w-8 h-8 text-cyan-600" />
                </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[40px] flex items-center justify-between border-2 border-transparent">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Média Diária</p>
                  <h5 className="text-3xl font-black text-cyan-600">
                    {Math.round(analytics.factoryTotals.totalLitros / analytics.diffDays).toLocaleString('pt-BR')}
                  </h5>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">LITROS / DIA</p>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                  <BarChart3 className="w-8 h-8 text-cyan-400" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* VOLUME ENVASADO POR SKU */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-cyan-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              I. VOLUME ENVASADO POR SKU (PRODUTO)
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {analytics.skusSummary.map(sku => (
              <div
                key={sku.id}
                className={`p-8 border-2 rounded-[40px] flex flex-col lg:flex-row gap-10 break-inside-avoid shadow-sm transition-all ${sku.status === 'active' ? 'border-slate-100 bg-white' : 'border-slate-50 bg-slate-50/50 opacity-60 grayscale'
                  }`}
              >
                <div className="lg:w-1/3 space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{sku.nome}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 italic">
                        {sku.status === 'active' ? 'SKU em Produção no Período' : 'Sem Registros no Período'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-50 text-cyan-600">
                      <Boxes className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-6 rounded-3xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Volume Unitário</p>
                      <p className="text-sm font-black text-slate-900">{sku.volume}</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Litros / Hora</p>
                      <p className="text-2xl font-black text-emerald-500">
                        {sku.litrosPorHora.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-3xl text-white">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Unidades Produzidas</p>
                    <p className="text-3xl font-black leading-none">
                      {sku.unidades.toLocaleString()} <span className="text-xs text-cyan-400 font-bold">UN</span>
                    </p>
                  </div>

                  <div className="bg-cyan-600 p-6 rounded-3xl text-white shadow-lg shadow-cyan-600/20">
                    <p className="text-[8px] font-black text-slate-900/70 uppercase tracking-widest mb-1">Líquido Envasado</p>
                    <p className="text-3xl font-black leading-none">
                      {sku.m3.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span className="text-xs text-slate-900 font-bold">m³</span>
                    </p>
                    <p className="text-[9px] font-bold text-slate-800 uppercase tracking-widest mt-1">
                      {sku.litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} LITROS
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" /> {sku.litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</span>
                      <span className="text-slate-400 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> {sku.unidades.toLocaleString()} UN</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-600" style={{ width: `${Math.min(100, 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="lg:w-2/3 space-y-6">
                  <div className="h-[220px] bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 text-center">
                      <TrendingUp className="w-3 h-3 inline mr-2 text-cyan-500" /> Volume Envasado por Dia (Litros)
                    </p>
                    <ResponsiveContainer width="100%" height="80%">
                      <AreaChart data={sku.serieHistorica} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`colorLitrosSKU-${sku.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="data"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }}
                          interval={'preserveStartEnd'}
                        />
                        <YAxis hide={true} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '9px', fontWeight: 900, color: '#fff' }}
                          itemStyle={{ color: '#06b6d4' }}
                          formatter={(value: any) => [`${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`, 'Volume']}
                        />
                        <Area
                          type="monotone"
                          dataKey="litros"
                          stroke="#06b6d4"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill={`url(#colorLitrosSKU-${sku.id})`}
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {sku.status === 'active' && sku.linhasSummary.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-2 text-slate-900">
                          <Package className="w-3.5 h-3.5 text-cyan-600" /> Detalhamento por Linha
                        </div>
                        <div className="flex gap-4 pr-2">
                          <span className="w-14 text-right">UN</span>
                          <span className="w-10 text-right">H</span>
                          <span className="w-16 text-right">UN/H</span>
                          <span className="w-20 text-right">LITROS</span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {sku.linhasSummary.map((l, idx) => (
                          <div key={idx} className="px-6 py-3 flex justify-between items-center hover:bg-cyan-50/30 transition-colors">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-[11px] font-black text-slate-800 uppercase truncate" title={l.nome}>
                                {l.nome}
                              </p>
                            </div>
                            <div className="flex gap-4 items-center">
                              <span className="text-[11px] font-black text-slate-900 w-14 text-right">
                                {l.unidades.toLocaleString()}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 w-10 text-right">
                                {l.horas.toFixed(1)}h
                              </span>
                              <span className="text-[11px] font-black text-emerald-600 w-16 text-right">
                                {l.horas > 0 ? Math.round(l.unidades / l.horas).toLocaleString() : '0'}
                              </span>
                              <span className="text-[11px] font-black text-cyan-600 w-20 text-right">
                                {l.litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                              </span>
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
          <div className="flex justify-between items-end mb-20">
            <div className="flex items-center gap-5">
              <ShieldCheck className="w-10 h-10 text-slate-400" />
              <div>
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Consolidação Hídrica por SKU Nexus PCP</p>
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

export default RelatorioConsumoAguaSKU;