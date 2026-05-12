
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
  BrainCircuit,
  X,
  MessageSquare,
  Users
} from 'lucide-react';

const RelatorioBoletimPro: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [filtroTurno, setFiltroTurno] = useState<'GLOBAL' | '1º Turno' | '2º Turno'>('GLOBAL');

  // Estados para IA por Linha
  const [loadingAI, setLoadingAI] = useState<Record<string, boolean>>({});
  const [lineAnalyses, setLineAnalyses] = useState<Record<string, string>>({});

  // Estados para Compartilhamento
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [contatos, setContatos] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [isSending, setIsSending] = useState(false);

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
          <title>BOLETIM DIÁRIO - NEXUS PCP</title>
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
              .bg-blue-600 { background-color: #2563eb !important; color: white !important; -webkit-print-color-adjust: exact; }
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

  const analyzeLineProduction = async (line: any) => {
    setLoadingAI(prev => ({ ...prev, [line.id]: true }));
    const MISTRAL_API_KEY = "VUM0jYdoE3DFV4txchjU70t0QiCir6sx";

    const skusText = line.skusSummary.map((s: any) => `${s.nome} (${s.unidades} un)`).join(', ');

    const prompt = `
      Você é um Especialista em Engenharia de Produção.
      Analise tecnicamente a ${line.nome.toUpperCase()}:
      - Produção Realizada: ${line.producaoTotal} unidades.
      - Eficiência Produtiva: ${line.eficiencia.toFixed(1)}%.
      - Horas Trabalhadas: ${line.cargaHoraria.toFixed(1)}h.
      - SKUs em Processo: ${skusText}.

      Seja extremamente breve (máximo 200 caracteres).
      Use linguagem séria e profissional de chão de fábrica.
      Dê o diagnóstico e as 3 metas de forma direta.
      PROIBIDO termos em inglês ou qualquer tipo de humor.
    `;

    try {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify({
          model: "open-mistral-7b",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });
      const data = await res.json();
      setLineAnalyses(prev => ({ ...prev, [line.id]: data.choices[0].message.content }));
    } catch (err) {
      console.error("Erro na análise da linha:", err);
    } finally {
      setLoadingAI(prev => ({ ...prev, [line.id]: false }));
    }
  };

  const fetchContatos = async () => {
    const { data } = await supabase.from('contatos').select('*').order('nome');
    if (data) setContatos(data);
  };

  useEffect(() => {
    if (isShareModalOpen) fetchContatos();
  }, [isShareModalOpen]);

  const sendEvolutionAPI = async () => {
    if (!selectedContact) {
      alert("Selecione um contato!");
      return;
    }

    const contato = contatos.find(c => c.id === selectedContact);
    if (!contato) return;

    setIsSending(true);

    // Formatação da Mensagem Consolidada
    let mensagem = `*📋 DIAGNÓSTICO OPERACIONAL - NEXUS PCP*\n`;
    mensagem += `_Data: ${new Date().toLocaleDateString('pt-BR')}_\n\n`;

    Object.entries(lineAnalyses).forEach(([lineId, analysis]) => {
      const lineName = analytics.linesSummary.find(l => l.id === lineId)?.nome || `Linha ${lineId}`;
      mensagem += `*📍 ${lineName.toUpperCase()}*\n${analysis}\n\n`;
    });

    mensagem += `\n_Enviado via Nexus Intelligence_`;

    try {
      // CONFIGURAÇÃO DA EVOLUTION API (Credenciais Reais)
      const API_URL = "https://evolution-evolution-api.lwv8jw.easypanel.host"; 
      const API_KEY = "B2B08F854A50-40DD-B222-C91ECAA63FF7";
      const INSTANCE_NAME = "nexusalmox";

      // Limpeza agressiva do número
      let number = contato.telefone.replace(/\D/g, '');
      // Se começar com 0, remove
      if (number.startsWith('0')) number = number.substring(1);
      // Se não tiver 55 no começo e tiver 10 ou 11 dígitos, adiciona 55
      if (!number.startsWith('55') && (number.length === 10 || number.length === 11)) {
        number = '55' + number;
      }

      console.log("Tentando enviar para:", number);

      const response = await fetch(`${API_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_KEY
        },
        body: JSON.stringify({
          number: number,
          options: { delay: 1200, presence: "composing", linkPreview: false },
          textMessage: { text: mensagem }
        })
      });

      if (response.ok) {
        alert("Mensagem enviada com sucesso!");
        setIsShareModalOpen(false);
      } else {
        const errorData = await response.json().catch(() => ({ message: "Erro desconhecido na API" }));
        console.error("Erro da API:", errorData);
        alert(`A API recusou: ${errorData.message || "Erro de validação"}`);
      }
    } catch (err: any) {
      console.error("Erro de Rede/CORS:", err);
      alert(`Erro de Conexão: O navegador bloqueou a requisição ou o servidor está fora. (CORS?)`);
    } finally {
      setIsSending(false);
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
      
      // Detalhamento por SKU
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

        // Processar cada registro para o detalhamento por SKU
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

        // Calcular PK e PLT para cada SKU
        Object.values(skusMap).forEach(sku => {
          sku.pacotes = Math.floor(sku.unidades / sku.unidadesPorFardo);
          sku.paletes = sku.pacotes / sku.fardosPorPalete;
        });
      }

      const skusSummary = Object.values(skusMap).sort((a, b) => b.unidades - a.unidades);
      const totalBundles = skusSummary.reduce((acc, s) => acc + s.pacotes, 0);
      const totalPallets = skusSummary.reduce((acc, s) => acc + s.paletes, 0);

      // SINCRO COM DASHBOARD: Eficiência = Produzido / Capacidade Nominal
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


    // SINCRO COM DASHBOARD: OEE Médio Planta = Soma(Produzido) / Soma(Capacidade Nominal)
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
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl print:hidden">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-tight">Gerador de Boletim</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1">Consolidação Industrial em A4</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 backdrop-blur-sm">
            {(['GLOBAL', '1º Turno', '2º Turno'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTurno(t)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filtroTurno === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border-2 border-white/5 focus-within:border-blue-500 transition-all shadow-sm">
            <Calendar className="w-5 h-5 text-blue-400" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Início / Fim</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-blue-400 transition-colors"
                  title="Data Inicial"
                />
                <span className="text-slate-500 font-bold">-</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-blue-400 transition-colors"
                  title="Data Final"
                />
              </div>
            </div>
          </div>

          <button
            onClick={fetchRelatorioData}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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

          {Object.keys(lineAnalyses).length > 0 && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <MessageSquare className="w-4 h-4" />
              Enviar p/ Líderes
            </button>
          )}
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

        {/* TOTALIZAÇÃO GLOBAL DE FÁBRICA - ALICERCE */}
        <section className="space-y-6 break-inside-avoid">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-blue-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              III. TOTALIZAÇÃO GLOBAL DE FÁBRICA (ALICERCE OPERACIONAL)
            </h3>
          </div>

          <div className="grid grid-cols-12 gap-6 w-full">
            <div className="col-span-12 lg:col-span-8 bg-slate-900 text-white p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Volume Consolidado Total</p>
                  <h4 className="text-7xl font-black tracking-tighter leading-none mb-2">
                    {analytics.factoryTotals.totalUnits.toLocaleString()}
                  </h4>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                    <Package className="w-3.5 h-3.5" /> Total de Unidades Produzidas
                  </p>
                </div>
                <div className="h-24 w-px bg-white/10 hidden md:block" />
                <div className="text-center md:text-right">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Eficiência de Planta (Sincro)</p>
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
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">UN / DIA</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-slate-50 p-8 rounded-[40px] flex items-center justify-between border-2 border-transparent">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Expedição (PLT)</p>
                  <h5 className="text-3xl font-black text-blue-600">
                    {analytics.factoryTotals.pallets.toFixed(1)}
                  </h5>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">PALETES CONSOLIDADO</p>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                  <Layers className="w-8 h-8 text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DESEMPENHO E EVOLUÇÃO POR CT */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-1.5 bg-blue-600 rounded-full" />
            <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em]">
              I. EVOLUÇÃO E PERFORMANCE POR CENTRO DE TRABALHO
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {analytics.linesSummary.map(line => (
              <div
                key={line.id}
                className={`p-8 border-2 rounded-[40px] flex flex-col lg:flex-row gap-10 break-inside-avoid shadow-sm transition-all ${line.status === 'active' ? 'border-slate-100 bg-white' : 'border-slate-50 bg-slate-50/50 opacity-60 grayscale'
                  }`}
              >
                <div className="lg:w-1/3 space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                    <div>
                      <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{line.nome}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 italic">
                        {line.status === 'active' ? 'Linha em Operação' : 'Sem Registros no Período'}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${line.eficiencia >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Botão de IA da Linha */}
                  {line.status === 'active' && (
                    <button
                      onClick={() => analyzeLineProduction(line)}
                      disabled={loadingAI[line.id]}
                      className="w-full py-3 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-indigo-600/20"
                    >
                      {loadingAI[line.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                      {loadingAI[line.id] ? 'Analisando...' : 'Pedir Ajuda ao Gerente IA'}
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-6 rounded-3xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Carga / Meta</p>
                      <p className="text-sm font-black text-slate-900">{(line.cargaHoraria || 0).toFixed(2)}h / {line.capNominal.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Eficiência (Sincro)</p>
                      <p className={`text-2xl font-black ${line.eficiencia >= 80 ? 'text-emerald-500' : 'text-blue-600'}`}>
                        {line.eficiencia.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-3xl text-white">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Produção Realizada Total</p>
                    <p className="text-3xl font-black leading-none">
                      {line.producaoTotal.toLocaleString()} <span className="text-xs text-blue-400 font-bold">UN</span>
                    </p>
                  </div>


                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> {line.totalBundles.toLocaleString()} PK</span>
                      <span className="text-slate-400 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> {line.totalPallets.toFixed(1)} PLT</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${line.eficiencia >= 80 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${Math.min(100, line.eficiencia)}%` }}
                      />
                    </div>
                  </div>

                  {/* Área de Resultado da IA - Papo Reto */}
                  {lineAnalyses[line.id] && (
                    <div className="mt-4 p-5 bg-indigo-50 border-l-4 border-indigo-600 rounded-2xl animate-in slide-in-from-top duration-500 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[9px] font-black text-indigo-900 uppercase tracking-widest">Diagnóstico Operacional</span>
                        <button 
                          onClick={() => setLineAnalyses(prev => {
                            const newObj = { ...prev };
                            delete newObj[line.id];
                            return newObj;
                          })}
                          className="ml-auto text-indigo-300 hover:text-indigo-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[11px] font-bold text-slate-700 leading-relaxed whitespace-pre-line">
                        {lineAnalyses[line.id]}
                      </p>
                    </div>
                  )}
                </div>

                <div className="lg:w-2/3 space-y-6">
                  <div className="h-[220px] bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 text-center">
                      <TrendingUp className="w-3 h-3 inline mr-2 text-blue-500" /> Tendência de Evolução Produtiva (Dia a Dia)
                    </p>
                    <ResponsiveContainer width="100%" height="80%">
                      <AreaChart data={line.serieHistorica} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`colorQty-${line.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                          itemStyle={{ color: '#3b82f6' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="quantidade"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill={`url(#colorQty-${line.id})`}
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {line.status === 'active' && line.skusSummary.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-2 text-slate-900">
                          <Package className="w-3.5 h-3.5 text-blue-600" /> Detalhamento por SKU
                        </div>
                        <div className="flex gap-4 pr-2">
                          <span className="w-14 text-right">UN</span>
                          <span className="w-10 text-right">H</span>
                          <span className="w-16 text-right">UN/H</span>
                          <span className="w-10 text-right">PK</span>
                          <span className="w-10 text-right">PLT</span>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {line.skusSummary.map((sku, idx) => (
                          <div key={idx} className="px-6 py-3 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                            <div className="flex-1 min-w-0 mr-4">
                              <p className="text-[11px] font-black text-slate-800 uppercase truncate" title={sku.nome}>
                                {sku.nome}
                              </p>
                            </div>
                            <div className="flex gap-4 items-center">
                              <span className="text-[11px] font-black text-slate-900 w-14 text-right">
                                {sku.unidades.toLocaleString()}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 w-10 text-right">
                                {sku.horas.toFixed(1)}h
                              </span>
                              <span className="text-[11px] font-black text-emerald-600 w-16 text-right">
                                {sku.horas > 0 ? Math.round(sku.unidades / sku.horas).toLocaleString() : '0'}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 w-10 text-right">
                                {sku.pacotes.toLocaleString()}
                              </span>
                              <span className="text-[11px] font-bold text-blue-600 w-10 text-right">
                                {sku.paletes.toFixed(1)}
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
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Consolidação Industrial Nexus PCP</p>
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

      {/* Modal de Compartilhamento Evolution API */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsShareModalOpen(false)} />
          <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-2xl rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-8 border-b border-white/5 flex items-center justify-between bg-emerald-600/10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-600 rounded-xl text-white">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Enviar Diagnósticos</h3>
                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-1">Consolidação e Disparo via WhatsApp</p>
                </div>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                <X className="w-8 h-8" />
              </button>
            </header>

            <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
              {/* Preview da Mensagem */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Preview do Texto Consolidado</label>
                <div className="bg-black/40 border border-white/5 p-6 rounded-3xl max-h-48 overflow-y-auto no-scrollbar">
                  <p className="text-[10px] font-bold text-slate-300 leading-relaxed whitespace-pre-line">
                    *📋 DIAGNÓSTICO OPERACIONAL*\n
                    {Object.entries(lineAnalyses).map(([lineId, analysis]) => {
                      const lineName = analytics.linesSummary.find(l => l.id === lineId)?.nome || `Linha ${lineId}`;
                      return `\n*📍 ${lineName.toUpperCase()}*\n${analysis}\n`;
                    })}
                  </p>
                </div>
              </div>

              {/* Seleção de Contato */}
              <div className="space-y-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecionar Destinatário da Agenda</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                  <select 
                    value={selectedContact}
                    onChange={e => setSelectedContact(e.target.value)}
                    className="w-full bg-black/60 border-2 border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[11px] font-black text-white outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                  >
                    <option value="">SELECIONE UM CONTATO...</option>
                    {contatos.map(c => (
                      <option key={c.id} value={c.id} className="bg-slate-900">
                        {c.nome.toUpperCase()} {c.apelido ? `(${c.apelido})` : ''} - {c.categoria}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="py-4 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={sendEvolutionAPI}
                  disabled={isSending || !selectedContact}
                  className="py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  {isSending ? 'Enviando...' : 'Disparar WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatorioBoletimPro;
