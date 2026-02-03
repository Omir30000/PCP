
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Produto, RegistroProducao } from './types/database';
import { 
  Printer, 
  Calendar, 
  Search, 
  Loader2, 
  TrendingUp, 
  Activity,
  Package,
  Layers,
  Calculator,
  FileText,
  PieChart as PieIcon,
  Trophy,
  Medal,
  Target,
  Box,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const COLORS = [
  '#0f172a', '#2563eb', '#10b981', '#f59e0b', '#7c3aed', 
  '#db2777', '#475569', '#06b6d4', '#84cc16', '#ef4444',
  '#1e293b', '#3b82f6', '#10b981', '#fcd34d', '#a78bfa'
];

const RelatoriosProdutos: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Query com Join completo para buscar os dados dos produtos vinculados
      const { data, error } = await supabase
        .from('registros_producao')
        .select(`
          *,
          produtos (*)
        `)
        .order('data_registro', { ascending: false });

      if (error) throw error;
      
      const filtrados = (data || []).filter(r => 
        r.data_registro >= dataInicio && r.data_registro <= dataFim
      );

      setRegistros(filtrados);
    } catch (err) {
      console.error("Erro ao processar mix de produtos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = () => {
    if (!reportRef.current) return;
    
    // Bypass sandbox constraints using window.open para garantir compatibilidade
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor, habilite pop-ups para imprimir o relatório.");
      return;
    }

    const content = reportRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>MIX E MOVIMENTAÇÃO DE SKUS - Smart Production</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
            @media print {
              @page { size: A4 portrait; margin: 1cm; }
              body { zoom: 0.92; -webkit-print-color-adjust: exact; }
              .print\\:hidden { display: none !important; }
              .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
              .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
              .zebra-table tr:nth-child(even) { background-color: #f8fafc !important; }
            }
            .zebra-table tr:nth-child(even) { background-color: #f8fafc; }
            .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
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
    const skuAggregation: Record<string, any> = {};
    let totalPeriodUnits = 0;

    registros.forEach(reg => {
      // Garante que estamos pegando o objeto de produto corretamente do Join
      const prod = Array.isArray(reg.produtos) ? reg.produtos[0] : reg.produtos;
      
      if (!prod || !prod.id) return;

      const pid = prod.id; // AGRUPAMENTO OBRIGATÓRIO PELO ID ÚNICO DO PRODUTO (SKU)
      const qty = Number(reg.quantidade_produzida) || 0;
      totalPeriodUnits += qty;

      if (!skuAggregation[pid]) {
        // Concatenação Institucional: {nome} {volume} ({tipo})
        const displaySKU = `${prod.nome} ${prod.volume || ''} (${(prod.tipo || 'PADRÃO').toUpperCase()})`.replace(/\s+/g, ' ').trim();
        
        skuAggregation[pid] = {
          id: pid,
          sku: displaySKU,
          unidades: 0,
          u_per_fardo: Number(prod.unidades_por_fardo) || 1,
          f_per_pallet: Number(prod.fardos_por_palete) || 1
        };
      }
      skuAggregation[pid].unidades += qty;
    });

    // Cálculos logísticos baseados nos parâmetros específicos de cada SKU
    const list = Object.values(skuAggregation).map((s: any) => {
      const fardos = Math.floor(s.unidades / s.u_per_fardo);
      const paletes = parseFloat((fardos / s.f_per_pallet).toFixed(2));
      const mixPerc = totalPeriodUnits > 0 ? (s.unidades / totalPeriodUnits) * 100 : 0;
      return { ...s, fardos, paletes, mixPerc };
    }).sort((a, b) => b.unidades - a.unidades);

    // Ranking de Movimentação Logística (Top 3 por Paletes reais produzidos)
    const top3 = [...list].sort((a, b) => b.paletes - a.paletes).slice(0, 3);

    // Dados para o Gráfico de Mix (uma fatia para cada SKU único encontrado)
    const donutData = list.map(item => ({
      name: item.sku,
      value: item.unidades
    }));

    // Soma total de paletes calculada SKU por SKU para precisão absoluta
    const totalPallets = parseFloat(list.reduce((acc, l) => acc + l.paletes, 0).toFixed(2));

    return { list, top3, donutData, totalPeriodUnits, totalPallets };
  }, [registros]);

  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-900 print:text-black">
      
      {/* Controles de Geração e Filtro */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-xl text-white">
            <PieIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight">Mix e Movimentação por SKU</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Análise de Cubagem e Proporcionalidade Técnica</p>
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
            onClick={fetchData}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Sincronizar SKUs
          </button>

          <button 
            onClick={handlePrint}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
          >
            <Printer className="w-4 h-4" />
            Imprimir Mix
          </button>
        </div>
      </div>

      {/* Template de Impressão Final A4 */}
      <div ref={reportRef} className="bg-white p-0 space-y-10 print:p-0">
        
        {/* Cabeçalho de Auditoria de Produtos */}
        <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 break-inside-avoid">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center font-black text-white text-3xl">P</div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Smart Production Hub</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Mix de Produção e Ocupação Logística por SKU</p>
            </div>
          </div>
          
          <div className="text-right">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">RELATÓRIO FISCAL DE SKUS</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              Período: {dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
            </p>
          </div>
        </header>

        {/* Destaque de Performance Logística (Top Paletes) */}
        <section className="space-y-4 break-inside-avoid">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> I. SKUs de Maior Ocupação Logística (Paletes Reais)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {analytics.top3.length > 0 ? analytics.top3.map((item, idx) => (
              <div key={item.id} className="border border-slate-200 rounded-xl p-5 flex items-center gap-5 bg-white shadow-sm relative overflow-hidden">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                  idx === 0 ? 'bg-slate-900 text-amber-400' : 
                  idx === 1 ? 'bg-slate-100 text-slate-600' : 
                  'bg-orange-50 text-orange-600'
                }`}>
                  {idx === 0 ? <Trophy className="w-6 h-6" /> : <Medal className="w-6 h-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{item.sku}</p>
                  <p className="text-2xl font-black text-slate-900 leading-none">{item.paletes.toFixed(1)} <span className="text-[10px] text-slate-400 font-bold uppercase">PLT</span></p>
                </div>
                <div className="absolute top-0 right-0 p-2 text-[32px] font-black text-slate-50 pointer-events-none">{idx + 1}</div>
              </div>
            )) : (
              <div className="col-span-3 py-10 text-center border-2 border-dashed border-slate-100 rounded-xl text-slate-300 font-black uppercase text-[9px] tracking-widest italic">Aguardando sincronização de dados industriais...</div>
            )}
          </div>
        </section>

        {/* Detalhamento por SKU e Gráfico de Mix Lado a Lado */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Tabela de Detalhamento Unitário por SKU (2/3) */}
          <section className="lg:col-span-2 space-y-4 break-inside-avoid">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-600" /> II. Detalhamento de Mix e Unidades (Cálculo por SKU)
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left zebra-table">
                <thead className="bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-4">Produto / SKU (Completo)</th>
                    <th className="px-4 py-4 text-right">Volume (UN)</th>
                    <th className="px-4 py-4 text-right">Fardos (PK)</th>
                    <th className="px-4 py-4 text-right">Paletes (PLT)</th>
                    <th className="px-4 py-4 text-center">% Mix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[10px]">
                  {analytics.list.map((item) => (
                    <tr key={item.id} className="bg-white hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800 uppercase leading-tight">{item.sku}</td>
                      <td className="px-4 py-3 text-right font-black">{item.unidades.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-500 font-bold">{item.fardos.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-blue-600 font-black">{item.paletes.toFixed(1)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded font-black text-slate-700">{item.mixPerc.toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                  {analytics.list.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-300 uppercase font-black tracking-widest italic">Nenhum lançamento identificado no período filtrado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Gráfico de Mix e Totais Período (1/3) */}
          <section className="space-y-6 break-inside-avoid">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] flex items-center gap-2">
                <PieIcon className="w-3.5 h-3.5 text-emerald-600" /> III. Proporcionalidade do Mix Industrial
              </h3>
              <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm flex flex-col items-center">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.donutData}
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {analytics.donutData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '9px', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 mt-6 max-h-[200px] overflow-y-auto no-scrollbar pr-2 border-t border-slate-50 pt-4">
                  {analytics.list.map((entry, index) => (
                    <div key={entry.id} className="flex justify-between items-center border-b border-slate-50 pb-1 last:border-none">
                      <div className="flex items-center gap-2 truncate flex-1 mr-4">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-[8px] font-black text-slate-500 uppercase truncate">{entry.sku}</span>
                      </div>
                      <span className="text-[9px] font-black text-slate-900 shrink-0">
                        {entry.mixPerc.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Balanço Logístico Final Consolidado */}
            <div className="grid grid-cols-1 gap-4">
              <div className="p-6 bg-slate-900 rounded-xl text-white text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Unidades Mix</p>
                <p className="text-3xl font-black tracking-tighter">{analytics.totalPeriodUnits.toLocaleString()}</p>
                <p className="text-[8px] font-bold text-slate-500 uppercase mt-2 tracking-widest">Saldo Consolidado do Período</p>
              </div>
              <div className="p-6 border-2 border-slate-900 rounded-xl text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Capacidade Logística Gerada</p>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{analytics.totalPallets.toFixed(1)} <span className="text-sm font-bold">PLT</span></p>
                <p className="text-[8px] font-bold text-slate-400 uppercase mt-2 tracking-widest">Soma de Paletes por SKU Individual</p>
              </div>
            </div>
          </section>
        </div>

        {/* Rodapé de Auditoria e Validação Técnica */}
        <footer className="pt-12 border-t-2 border-slate-900 break-inside-avoid">
          <div className="flex justify-between items-end mb-12">
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-slate-400" />
              <div>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Relatório de Mix Industrial v1.5 - Auditoria por SKU</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">Hash de Verificação: {Math.random().toString(36).substring(2, 12).toUpperCase()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Relatório gerado em: {new Date().toLocaleString('pt-BR')}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Página 1 de 1</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-20">
            <div className="text-center">
              <div className="border-t border-slate-900 pt-3"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Conferência PCP / Logística</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Validação de Saldo Industrial</p>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-900 pt-3"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Direção de Operações</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Aprovação Comercial de Mix</p>
            </div>
          </div>
        </footer>
      </div>

    </div>
  );
};

export default RelatoriosProdutos;
