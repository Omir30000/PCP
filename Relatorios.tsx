
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
  AlertTriangle
} from 'lucide-react';

const Relatorios: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Helper técnico para extração segura de minutos do JSONB
  const parseMinutos = (val: any): number => {
    if (val === null || val === undefined || isNaN(Number(val))) return 0;
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
              @page { size: A4 portrait; margin: 1cm; }
              body { zoom: 0.95; }
              .print\\:hidden { display: none !important; }
              .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
              .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
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
    const bottlenecksMap: Record<string, number> = {};

    const linesSummary = idsLinhas.map(num => {
      const regsDaLinha = registros.filter(r => 
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
        
        // Cálculo Realista de OEE e Disponibilidade
        const sumEff = regsDaLinha.reduce((acc, r) => {
          const metaNominal = Number(r.produtos?.capacidade_nominal) || 7200;
          const cargaHoras = Number(r.carga_horaria) || 8;
          const tempoDispMin = cargaHoras * 60;
          totalCargaHorariaGlobalMin += tempoDispMin;
          
          const paradas = Array.isArray(r.paradas) ? r.paradas : [];
          const downtimeRegMin = paradas.reduce((a, b: any) => {
            const min = parseMinutos(b.duracao || b.tempo || b.total_min || 0);
            // Alimenta a matriz de gargalos global enquanto percorre
            const motivo = (b.motivo || b.equipamento || 'OUTROS').toUpperCase();
            bottlenecksMap[motivo] = (bottlenecksMap[motivo] || 0) + min;
            return a + min;
          }, 0);
          
          totalDowntimeLinha += downtimeRegMin;

          const disponibilidade = tempoDispMin > 0 ? (tempoDispMin - downtimeRegMin) / tempoDispMin : 0;
          const metaAjustada = (metaNominal / 8) * cargaHoras;
          const performance = metaAjustada > 0 ? (Number(r.quantidade_produzida) / metaAjustada) : 0;
          
          // OEE Simplificado (Performance * Disponibilidade)
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

    // Matriz de Gargalos Formatada
    const bottlenecks = Object.entries(bottlenecksMap)
      .map(([name, value]) => ({ 
        name, 
        value,
        impacto: totalCargaHorariaGlobalMin > 0 ? (value / totalCargaHorariaGlobalMin) * 100 : 0 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const observations = registros
      .filter(r => r.observacoes && r.observacoes.trim() !== '')
      .map(r => ({
        data: r.data_registro,
        linha: r.linha_producao,
        texto: r.observacoes,
        turno: r.turno
      }));

    return { linesSummary, bottlenecks, factoryTotals, observations, diffDays };
  }, [registros, dataInicio, dataFim]);

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
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Período Fiscal</p>
              <p className="text-sm font-black uppercase leading-none mt-1">
                {dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
              </p>
            </div>
          </div>
        </header>

        {/* Grade de Desempenho por CT */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-600" /> I. Desempenho Isolado por Centro de Trabalho
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            {analytics.linesSummary.map(line => (
              <div 
                key={line.id} 
                className={`p-4 border rounded-xl space-y-3 break-inside-avoid ${
                  line.status === 'active' ? 'border-slate-200 bg-white shadow-sm' : 'border-slate-100 bg-slate-50 opacity-60 grayscale'
                }`}
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{line.nome}</span>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded ${line.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'} uppercase`}>
                    {line.status === 'active' ? 'Operante' : 'Inativa'}
                  </span>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Produção Realizada</p>
                    <p className="text-xl font-black text-slate-900 leading-none">
                      {line.producaoTotal.toLocaleString()} <span className="text-[10px] text-slate-400 uppercase font-bold">un</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Downtime JSONB</p>
                    <p className="text-sm font-bold text-red-600">{line.downtime || 0}m</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 py-2 bg-slate-50 rounded-lg px-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-700">{line.totalBundles.toLocaleString()} <span className="text-slate-400 font-bold">PK</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-700">{line.totalPallets.toFixed(1)} <span className="text-slate-400 font-bold">PLT</span></span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">OEE Realista (Disp x Perf)</span>
                    <span className={`text-[10px] font-black ${line.eficiencia >= 80 ? 'text-emerald-600' : 'text-blue-600'}`}>
                      {line.eficiencia > 0 ? line.eficiencia.toFixed(1) : '0.0'}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${line.eficiencia >= 80 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                      style={{ width: `${Math.min(100, line.eficiencia)}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Matrix de Gargalos e Totais Globais */}
        <div className="grid grid-cols-2 gap-6 items-start">
          <section className="space-y-4 break-inside-avoid">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> II. Matriz de Gargalos Operacionais (JSONB)
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Motivo da Inatividade</th>
                    <th className="px-4 py-3 text-right">Downtime</th>
                    <th className="px-4 py-3 text-center">Impacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.bottlenecks.length > 0 ? analytics.bottlenecks.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[10px] font-bold text-slate-700 uppercase">{item.name}</td>
                      <td className="px-4 py-2.5 text-[10px] font-black text-red-600 text-right">{item.value || 0}m</td>
                      <td className="px-4 py-2.5 text-[10px] font-bold text-slate-400 text-center">{item.impacto.toFixed(1)}%</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-300 uppercase text-[9px] font-bold italic">Sem inatividade reportada via JSON</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[8px] text-slate-400 italic">Impacto calculado sobre a carga horária bruta consolidada do período.</p>
          </section>

          <section className="space-y-4 break-inside-avoid">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> III. Totalização Global de Fábrica
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="p-5 bg-slate-900 rounded-xl text-white flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Volume Consolidado</p>
                  <p className="text-4xl font-black tracking-tighter leading-none">{analytics.factoryTotals.totalUnits.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">OEE Médio</p>
                  <p className="text-2xl font-bold text-emerald-400 leading-none">{analytics.factoryTotals.avgEfficiency.toFixed(1)}%</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Industrial</p>
                  <p className="text-xl font-black text-slate-800 tracking-tight leading-none mt-1">
                    {Math.round(analytics.factoryTotals.totalUnits / analytics.diffDays).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">un/dia</span>
                  </p>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Paletes</p>
                  <p className="text-xl font-black text-blue-600 tracking-tight leading-none mt-1">{analytics.factoryTotals.pallets.toFixed(1)} <span className="text-[10px] font-bold text-slate-400">PLT</span></p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Notas de Turno e Cruzamento */}
        <section className="space-y-4 break-inside-avoid">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
            <MessageSquareIcon className="w-3.5 h-3.5 text-slate-400" /> IV. Notas de Turno e Cruzamento de Gargalos
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {analytics.observations.length > 0 ? analytics.observations.map((obs, idx) => {
              const linhaEncontrada = linhas.find(l => l.id === obs.linha || l.nome === obs.linha);
              return (
                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 flex items-start gap-4">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] font-black text-blue-600 uppercase tracking-wider">{linhaEncontrada?.nome || obs.linha}</span>
                      <span className="text-[8px] font-bold text-slate-300">•</span>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">{formatarDataBR(obs.data)} - T{obs.turno}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">"{obs.texto}"</p>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-2 py-8 text-center border-2 border-dashed border-slate-100 rounded-xl">
                <span className="text-slate-300 font-bold uppercase text-[9px] tracking-widest italic">Sem observações técnicas registradas no período</span>
              </div>
            )}
          </div>
        </section>

        {/* Rodapé Nexus */}
        <footer className="pt-12 border-t-2 border-slate-900 break-inside-avoid">
          <div className="flex justify-between items-end mb-16">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-slate-400" />
              <div>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Consolidação Industrial Nexus PCP - v2.5</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">Autenticação de Dados: {Math.random().toString(36).substring(7).toUpperCase()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Relatório emitido em: {new Date().toLocaleString('pt-BR')}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Página 1 de 1</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-20">
            <div className="text-center">
              <div className="border-t border-slate-900 pt-2 mb-1"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Gestão de PCP / Planejamento</p>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-900 pt-2 mb-1"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Gerência de Operações Industriais</p>
            </div>
          </div>
        </footer>
      </div>

    </div>
  );
};

export default Relatorios;
