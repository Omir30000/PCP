
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
  ChevronRight,
  ShieldCheck,
  BarChart2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Box,
  BrainCircuit,
  Sparkles,
  Zap,
  Target
} from 'lucide-react';

const RelatorioAnaliticaDowntimeAI: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [linhaId, setLinhaId] = useState<string>('todos');
  const [turno, setTurno] = useState<string>('todos');

  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  
  // Estados para IA
  const [insights, setInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

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
        supabase.from('maquinas').select('*')
      ]);

      if (regsRes.error) throw regsRes.error;

      if (linesRes.data) setLinhas(linesRes.data);
      if (machRes.data) setMaquinas(machRes.data);
      if (regsRes.data) setRegistros(regsRes.data);
      
      setInsights(''); // Limpa insights ao buscar novos dados

    } catch (err: any) {
      console.error("Nexus Tech Report Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const analytics = useMemo(() => {
    let totalDowntime = 0;
    let totalStopsCount = 0;
    let totalProduced = 0;
    let totalNominal = 0;
    const byType: Record<string, number> = {};
    const detailedFailures: any[] = [];
    const equipCount: Record<string, number> = {};

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
          totalDowntime += dur;
          totalStopsCount += 1;
          byType[type] = (byType[type] || 0) + dur;
          
          const mObj = maquinas.find(m => m.id === p.maquina_id);
          const equipName = p.maquina || (mObj ? mObj.nome : (p.equipamento || 'GERAL'));
          const fullEquipName = `${equipName} (${reg.linhas?.nome || 'N/A'})`;
          equipCount[fullEquipName] = (equipCount[fullEquipName] || 0) + 1;
        }

        const mObj = maquinas.find(m => m.id === p.maquina_id);
        const equipName = p.maquina || (mObj ? mObj.nome : (p.equipamento || 'GERAL'));

        detailedFailures.push({
          data: reg.data_registro,
          linha: reg.linhas?.nome || 'N/A',
          turno: reg.turno || 'N/A',
          equipamento: equipName,
          tipo: type,
          motivo: p.motivo || 'GERAL',
          duracao: dur,
          volumePerdido: Math.round(dur * capPerMin)
        });
      });
    });

    const typeTableData = Object.entries(byType)
      .map(([name, value]) => ({
        name,
        minutos: value,
        percent: totalDowntime > 0 ? (value / totalDowntime) * 100 : 0
      }))
      .sort((a, b) => b.minutos - a.minutos);

    const top3Types = typeTableData.slice(0, 3).map(t => t.name);

    const top3Details = top3Types.map(typeName => {
      const typeFailures = detailedFailures.filter(f => f.tipo === typeName);
      
      const aggregated: Record<string, any> = {};
      typeFailures.forEach(f => {
        const key = `${f.equipamento}-${f.motivo}`;
        if (!aggregated[key]) {
          aggregated[key] = { ...f };
        } else {
          aggregated[key].duracao += f.duracao;
        }
      });

      const failures = Object.values(aggregated).sort((a, b) => b.duracao - a.duracao);
      return { type: typeName, failures };
    });

    const topEquipments = Object.entries(equipCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return {
      totalDowntime,
      totalStopsCount,
      mttr: totalStopsCount > 0 ? totalDowntime / totalStopsCount : 0,
      totalProduced,
      totalNominal,
      volumeLost: Math.round(totalProduced - totalNominal),
      typeTableData,
      top3Details,
      topEquipments
    };
  }, [registros, maquinas]);

  const generateAIInsights = async () => {
    if (analytics.totalStopsCount === 0) {
      alert("Não há dados de paradas para analisar no período selecionado.");
      return;
    }

    setIsGeneratingInsights(true);
    setInsights('');

    const MISTRAL_API_KEY = "VUM0jYdoE3DFV4txchjU70t0QiCir6sx";
    
    // Preparar dados específicos de downtime para a IA
    const resumoDowntime = {
      periodo: `${formatarDataBR(dataInicio)} até ${formatarDataBR(dataFim)}`,
      tempoTotalInatividade: `${analytics.totalDowntime} minutos`,
      totalOcorrencias: analytics.totalStopsCount,
      mttr: `${analytics.mttr.toFixed(1)} minutos (tempo médio de reparo)`,
      perdaEstimada: `${Math.abs(analytics.volumeLost)} unidades`,
      topEquipamentos: analytics.topEquipments,
      principaisCausas: analytics.typeTableData.slice(0, 3)
    };

    const prompt = `Você é um consultor de manutenção industrial "pé no chão", especialista em confiabilidade e TPM (Manutenção Produtiva Total).
Analise os seguintes dados de paradas de máquina (Downtime) e forneça 3 a 4 insights curtos, diretos e com um toque de humor em português.

REGRAS DE LINGUAGEM:
1. Use linguagem de "chão de fábrica" (direta, sem frescura).
2. Se usar termos técnicos em inglês (ex: MTTR, MTBF, Downtime, Bottleneck), coloque a tradução ou explicação simples entre parênteses.
3. Pode usar gírias leves de produção (ex: "dar um trato", "máquina abrindo o bico", "fogo no parquinho").
4. Foque em: causas raiz das paradas, impacto na produção e sugestões para a manutenção preventiva.

DADOS DE DOWNTIME:
${JSON.stringify(resumoDowntime, null, 2)}

Formate sua resposta em tópicos claros (bullets), usando Markdown para negrito em pontos chave. Seja motivador e focado em manter as máquinas rodando!`;

    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: "open-mistral-7b",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error("Erro na API da Mistral");
      const data = await response.json();
      setInsights(data.choices[0].message.content);
    } catch (err: any) {
      console.error("Erro ao gerar insights:", err);
      setInsights(`Ops! O motor de IA deu uma engasgada. Verifique a conexão e tente de novo!`);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const formatarDataBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDuration = (min: number) => {
    if (min < 60) return `${min}m`;
    return `${(min / 60).toFixed(1)}h`;
  };

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
          <title>ANALÍTICA DE DOWNTIME - NEXUS AI</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
            @media print {
              @page { size: A4 portrait; margin: 0.5cm; }
              body { zoom: 0.8; }
              .print:hidden { display: none !important; }
              .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
              .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
              .bg-red-600 { background-color: #dc2626 !important; color: white !important; -webkit-print-color-adjust: exact; }
              .bg-indigo-600 { background-color: #4f46e5 !important; color: white !important; -webkit-print-color-adjust: exact; }
              .text-white { color: white !important; }
              .bg-blue-50 { background-color: #eff6ff !important; -webkit-print-color-adjust: exact; }
              .bg-emerald-50 { background-color: #ecfdf5 !important; -webkit-print-color-adjust: exact; }
              .bg-indigo-50 { background-color: #eef2ff !important; -webkit-print-color-adjust: exact; }
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

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-700 pb-12 font-sans text-slate-200">
      
      {/* HEADER SECTION (Inspirado no modelo escuro da imagem) */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-[#0a0a0a] p-8 rounded-[32px] border border-white/5 shadow-2xl print:hidden">
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-500/20">
            <Timer className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
              Analítica de <span className="text-red-500">Downtime</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 opacity-80">Sincronização de Inatividade JSONB</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-3 bg-white/5 px-4 py-3 rounded-2xl border border-white/10 focus-within:border-red-500 transition-all">
            <Calendar className="w-4 h-4 text-red-500" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Início / Fim</span>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={dataInicio} 
                  onChange={e => setDataInicio(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-white outline-none uppercase"
                />
                <span className="text-slate-600">-</span>
                <input 
                  type="date" 
                  value={dataFim} 
                  onChange={e => setDataFim(e.target.value)}
                  className="bg-transparent text-[11px] font-bold text-white outline-none uppercase"
                />
              </div>
            </div>
          </div>

          <select 
            value={turno} 
            onChange={e => setTurno(e.target.value)}
            className="bg-white/5 px-4 py-3 h-[52px] rounded-2xl border border-white/10 text-[11px] font-black text-white uppercase outline-none cursor-pointer hover:bg-white/10 transition-all"
          >
            <option value="todos" className="bg-[#0a0a0a]">Todos os Turnos</option>
            <option value="1º Turno" className="bg-[#0a0a0a]">1º Turno</option>
            <option value="2º Turno" className="bg-[#0a0a0a]">2º Turno</option>
          </select>

          <button 
            onClick={fetchData}
            disabled={loading}
            className="px-8 h-[52px] bg-red-600 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-[11px] uppercase tracking-widest hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Consolidar
          </button>

          <button 
            onClick={generateAIInsights}
            disabled={isGeneratingInsights || analytics.totalStopsCount === 0}
            className="w-[52px] h-[52px] bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            title="Gerar Insights com IA"
          >
            {isGeneratingInsights ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          </button>

          <button 
            onClick={handlePrint}
            className="w-[52px] h-[52px] bg-white/5 text-white rounded-2xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all"
            title="Imprimir Relatório"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Container do Relatório para Impressão */}
      <div ref={reportRef} className="space-y-8 bg-transparent">
        
        {/* Cabeçalho do Relatório (Branco, como na imagem) */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 text-slate-900">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center font-black text-white text-3xl">P</div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Smart Production Hub</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Monitoramento de Inatividade e Confiabilidade Industrial</p>
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-xs font-black uppercase tracking-widest mb-1">Relatório Técnico de Downtime</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Período: {dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`}
            </p>
          </div>
        </div>

        {/* Insights da IA */}
        {(insights || isGeneratingInsights) && (
          <div className="bg-indigo-50/50 border-2 border-indigo-100 rounded-[32px] p-8 shadow-sm print:bg-indigo-50/20 break-inside-avoid">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-indigo-900 uppercase tracking-tighter">Análise Preditiva de Falhas</h3>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none mt-1">Consultoria de Manutenção Nexus AI</p>
              </div>
            </div>
            
            {isGeneratingInsights ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4 print:hidden">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce"></div>
                </div>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">Sincronizando com o motor Mistral...</p>
              </div>
            ) : (
              <div className="prose prose-indigo max-w-none">
                 {insights.split('\n').filter(l => l.trim().length > 0).map((line, i) => (
                   <p key={i} className="text-slate-700 font-medium leading-relaxed text-sm mb-2">
                     {line.startsWith('-') || line.match(/^\d\./) ? (
                       <span className="flex items-start gap-3">
                         <ChevronRight className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                         <span dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-900 font-black">$1</strong>').replace(/^- /, '') }} />
                       </span>
                     ) : (
                       <span dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-900 font-black">$1</strong>') }} />
                     )}
                   </p>
                 ))}
              </div>
            )}
          </div>
        )}

        {/* KPI CARDS (Estilo da Foto) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          
          <div className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm relative overflow-hidden group break-inside-avoid">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Inatividade Total</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{formatDuration(analytics.totalDowntime)}</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-none">Duração Bruta Acumulada</p>
            <Timer className="absolute -bottom-2 -right-2 w-16 h-16 text-slate-50 group-hover:text-red-50 transition-colors" />
          </div>

          <div className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm relative overflow-hidden group break-inside-avoid">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Top 3 Equipamentos Críticos</p>
            <div className="space-y-2">
              {analytics.topEquipments.map((equip, idx) => (
                <div key={idx} className="flex items-center justify-between group/item">
                  <div className="flex items-center gap-2">
                    <span className={\`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black \${idx === 0 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'}\`}>
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-bold text-slate-700 truncate max-w-[120px] uppercase">{equip.name}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase leading-none">{equip.count}x</span>
                </div>
              ))}
            </div>
            <AlertCircle className="absolute -bottom-2 -right-2 w-16 h-16 text-slate-50 group-hover:text-red-50 transition-colors" />
          </div>

          <div className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm relative overflow-hidden group break-inside-avoid">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">MTTR (Média)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{analytics.mttr.toFixed(1)}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">min</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-none">Recuperação Média de Falha</p>
            <Activity className="absolute -bottom-2 -right-2 w-16 h-16 text-slate-50 group-hover:text-red-50 transition-colors" />
          </div>

          <div className="bg-blue-50 border border-blue-100 p-6 rounded-[32px] shadow-sm relative overflow-hidden group break-inside-avoid">
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">Volume Produzido</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-600">{analytics.totalProduced.toLocaleString('pt-BR')}</span>
              <span className="text-[11px] font-bold text-blue-400 uppercase">un</span>
            </div>
            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-2 leading-none italic">Produção Efetiva no Período</p>
            <Box className="absolute -bottom-2 -right-2 w-16 h-16 text-blue-100 group-hover:text-blue-200 transition-colors" />
          </div>

          <div className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm relative overflow-hidden group break-inside-avoid">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Impacto Produtivo</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{analytics.volumeLost.toLocaleString('pt-BR')}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">un</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-none italic">Estimativa de Perda Volumétrica</p>
            <Target className="absolute -bottom-2 -right-2 w-16 h-16 text-slate-50 group-hover:text-red-50 transition-colors" />
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[32px] shadow-sm relative overflow-hidden group break-inside-avoid">
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">Soma Nominal</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600">{analytics.totalNominal.toLocaleString('pt-BR')}</span>
              <span className="text-[11px] font-bold text-emerald-400 uppercase">un</span>
            </div>
            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-2 leading-none italic">Capacidade Teórica Acumulada</p>
            <TrendingUp className="absolute -bottom-2 -right-2 w-16 h-16 text-emerald-100 group-hover:text-emerald-200 transition-colors" />
          </div>
        </div>

        {/* ANÁLISE POR CATEGORIA */}
        <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm break-inside-avoid">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-600 rounded-2xl text-white">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Impacto por Tipo de Parada</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Consolidação de Inatividade JSONB</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria de Parada</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Tempo Acumulado</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Representatividade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.typeTableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={\`w-2 h-10 rounded-full \${idx === 0 ? 'bg-red-600' : 'bg-slate-200'}\`} />
                        <span className="text-[13px] font-black text-slate-900 uppercase tracking-tighter">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-base font-black text-slate-900">{formatDuration(row.minutos)}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-black text-red-600">{row.percent.toFixed(1)}%</span>
                        <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600 rounded-full" style={{ width: \`\${row.percent}%\` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DETALHAMENTO TÉCNICO */}
        <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm break-inside-avoid">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-900 rounded-2xl text-white">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Detalhamento das Principais Ocorrências</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Análise de Motivos e Tempos de Recuperação</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Linha / Equipamento</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Motivo Técnico</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.top3Details[0]?.failures.slice(0, 10).map((fail, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{fail.linha}</span>
                        <span className="text-sm font-black text-slate-900 uppercase tracking-tighter">{fail.equipamento}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <ArrowRight className="w-3 h-3 text-red-500" />
                        <span className="text-[11px] font-bold text-slate-600 uppercase">{fail.motivo}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-base font-black text-red-600">{formatDuration(fail.duracao)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RODAPÉ DO RELATÓRIO */}
        <div className="pt-12 border-t-2 border-slate-900 flex justify-between items-end break-inside-avoid print:pb-12">
          <div className="flex items-center gap-6">
            <ShieldCheck className="w-12 h-12 text-slate-300" />
            <div>
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Nexus Intelligence AI Core</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Validação de Confiabilidade Industrial • {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <div className="flex gap-16">
            <div className="text-center">
              <div className="w-48 border-t border-slate-900 mb-2" />
              <p className="text-[10px] font-black uppercase">Responsável Técnico</p>
            </div>
            <div className="text-center">
              <div className="w-48 border-t border-slate-900 mb-2" />
              <p className="text-[10px] font-black uppercase">Gerência Industrial</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default RelatorioAnaliticaDowntimeAI;
