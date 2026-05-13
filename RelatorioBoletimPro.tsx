import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Produto, Linha, RegistroProducao } from './types/database';
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
  Zap,
  BrainCircuit,
  X,
  MessageSquare,
  Users,
  Target
} from 'lucide-react';

const RelatorioBoletimPro: React.FC = () => {
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [filtroTurno, setFiltroTurno] = useState<'GLOBAL' | '1º Turno' | '2º Turno'>('GLOBAL');

  const [loadingAI, setLoadingAI] = useState<Record<string, boolean>>({});
  const [lineAnalyses, setLineAnalyses] = useState<Record<string, string>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [messageToEdit, setMessageToEdit] = useState('');
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

  const analyzeProductionMotivational = async (line: any) => {
    setLoadingAI(prev => ({ ...prev, [line.id]: true }));
    const MISTRAL_API_KEY = "VUM0jYdoE3DFV4txchjU70t0QiCir6sx";
    const periodoTexto = dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)}`;
    const skusTexto = line.skusSummary.map((s: any) => `- ${s.nome}: ${s.unidades.toLocaleString()} un (${s.horas.toFixed(1)}h)`).join('\n');

    const prompt = `
      Você é um Gerente de Produção Industrial mentor e motivador.
      Analise o desempenho da ${line.nome.toUpperCase()} no período de ${periodoTexto}:
      - Eficiência Atual: ${line.eficiencia.toFixed(1)}%.
      - Produção Total: ${line.producaoTotal.toLocaleString()} UN.
      - SKUs Produzidos:\n${skusTexto}

      DIRETRIZES DA MENSAGEM:
      1. Comece com uma saudação positiva ao Líder de Turno.
      2. TOM MOTIVACIONAL: 
         - Se Eficiência > 85%: Parabenize pelo excelente desempenho e peça para manter o ritmo.
         - Se Eficiência entre 70% e 85%: Diga que o objetivo está muito próximo e incentive a buscar os últimos detalhes para bater a meta.
         - Se Eficiência < 70%: Seja encorajador, identifique que o desafio foi grande, mas que você confia na equipe para recuperar no próximo período.
      3. INSIGHT TÉCNICO: Dê uma dica rápida baseada nos SKUs (ex: foco na troca de setup ou velocidade constante).
      4. META PRÓXIMO PERÍODO: Sugira uma meta clara (ex: "Vamos buscar elevar essa eficiência em mais 5% amanha").
      
      IMPORTANTE: Seja direto, humano e inspirador. Máximo 300 caracteres. Use emojis moderadamente.
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
      console.error("Erro na análise motivacional:", err);
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

  const handleOpenShareModal = () => {
    const periodoTexto = dataInicio === dataFim ? formatarDataBR(dataInicio) : `${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)}`;
    let msg = `*🚀 FEEDBACK DE PRODUÇÃO - NEXUS PCP*\n_Período: ${periodoTexto}_\n`;
    Object.entries(lineAnalyses).forEach(([lineId, analysis]) => {
      const lineName = analytics.linesSummary.find(l => l.id === lineId)?.nome || `Linha ${lineId}`;
      msg += `\n*📍 ${lineName.toUpperCase()}*\n${analysis}\n`;
    });
    msg += `\n_Gerado por Nexus Intelligence_`;
    setMessageToEdit(msg);
    setIsShareModalOpen(true);
  };

  const sendWhatsApp = async () => {
    if (!selectedContact) {
      alert("Selecione um contato!");
      return;
    }
    const contato = contatos.find(c => c.id === selectedContact);
    if (!contato) return;
    setIsSending(true);
    try {
      const API_URL = "https://evolution-evolution-api.lwv8jw.easypanel.host"; 
      const API_KEY = "B2B08F854A50-40DD-B222-C91ECAA63FF7";
      const INSTANCE_NAME = "nexusalmox";
      let number = contato.telefone.replace(/\D/g, '');
      if (number.startsWith('0')) number = number.substring(1);
      if (!number.startsWith('55') && (number.length === 10 || number.length === 11)) {
        number = '55' + number;
      }
      const response = await fetch(`${API_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY.trim() },
        body: JSON.stringify({ number: number, text: messageToEdit })
      });
      if (response.ok) {
        alert("Mensagem enviada com sucesso!");
        setIsShareModalOpen(false);
      } else {
        alert("Erro ao enviar mensagem via API.");
      }
    } catch (err) {
      alert("Erro de conexão com a API de WhatsApp.");
    } finally {
      setIsSending(false);
    }
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
          <title>BOLETIM PRO - NEXUS PCP</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; background: white !important; color: #1e293b; padding: 0; margin: 0; }
            @media print {
              @page { size: A4 portrait; margin: 0.5cm; }
              body { zoom: 0.85; }
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
    const idsLinhas = ['1', '2', '3', '4', '5'];
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
      let status: 'active' | 'inactive' = 'inactive';
      const skusMap: Record<string, { nome: string, unidades: number, pacotes: number, paletes: number, horas: number, unidadesPorFardo: number, fardosPorPalete: number }> = {};
      if (regsDaLinha.length > 0) {
        status = 'active';
        totalQty = regsDaLinha.reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);
        totalCapNominalLinha = regsDaLinha.reduce((acc, r) => acc + (Number(r.capacidade_producao) || 0), 0);
        regsDaLinha.forEach(r => {
          const prod = r.produtos;
          if (!prod) return;
          const skuId = prod.id;
          if (!skusMap[skuId]) {
            skusMap[skuId] = { nome: prod.nome, unidades: 0, pacotes: 0, paletes: 0, horas: 0, unidadesPorFardo: Number(prod.unidades_por_fardo) || 12, fardosPorPalete: Number(prod.fardos_por_palete) || 100 };
          }
          skusMap[skuId].unidades += (Number(r.quantidade_produzida) || 0);
          skusMap[skuId].horas += (Number(r.carga_horaria) || 0);
        });
        Object.values(skusMap).forEach(sku => {
          sku.pacotes = Math.floor(sku.unidades / sku.unidadesPorFardo);
          sku.paletes = sku.pacotes / sku.fardosPorPalete;
        });
      }
      const skusSummary = Object.values(skusMap).sort((a, b) => b.unidades - a.unidades);
      const eficiencia = totalCapNominalLinha > 0 ? (totalQty / totalCapNominalLinha) * 100 : 0;
      return { id: num, nome: `Linha ${num}`, status, producaoTotal: totalQty, totalBundles: skusSummary.reduce((acc, s) => acc + s.pacotes, 0), totalPallets: parseFloat(skusSummary.reduce((acc, s) => acc + s.paletes, 0).toFixed(1)), eficiencia, capNominal: totalCapNominalLinha, skusSummary };
    });

    const totalProduzidoGeral = linesSummary.reduce((acc, l) => acc + l.producaoTotal, 0);
    const totalCapNominalGeral = linesSummary.reduce((acc, l) => acc + l.capNominal, 0);
    return { linesSummary, factoryTotals: { totalUnits: totalProduzidoGeral, bundles: linesSummary.reduce((acc, l) => acc + l.totalBundles, 0), pallets: parseFloat(linesSummary.reduce((acc, l) => acc + l.totalPallets, 0).toFixed(1)), avgEfficiency: totalCapNominalGeral > 0 ? (totalProduzidoGeral / totalCapNominalGeral) * 100 : 0 } };
  }, [registros, filtroTurno]);

  return (
    <div className="w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-sans text-slate-900 print:text-black">

      {/* Controles do Relatório Premium */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl print:hidden">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white leading-tight">Boletim Pro IA</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1">Análise Estratégica Sem Gráficos</p>
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
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Período Selecionado</span>
              <div className="flex items-center gap-2">
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-blue-400 transition-colors" />
                <span className="text-slate-500 font-bold">-</span>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-[11px] font-black outline-none uppercase text-white cursor-pointer hover:text-blue-400 transition-colors" />
              </div>
            </div>
          </div>

          <button onClick={fetchRelatorioData} disabled={loading} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Sincronizando...' : 'Sincronizar'}
          </button>

          {Object.keys(lineAnalyses).length > 0 && (
            <button onClick={handleOpenShareModal} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              <MessageSquare className="w-4 h-4" />
              Enviar p/ Líderes
            </button>
          )}

          <button onClick={handlePrint} className="px-6 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2 border border-white/10">
            <Printer className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white p-0 space-y-12 print:p-0">
        <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 break-inside-avoid">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center font-black text-white text-3xl">P</div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Smart Production Hub</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Análise Pro de Performance Industrial</p>
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
                {filtroTurno !== 'GLOBAL' && <span className="ml-2 text-[10px] font-bold opacity-60">({filtroTurno})</span>}
              </p>
            </div>
          </div>
        </header>

        <section className="space-y-12">
          {analytics.linesSummary.map(line => (
            <div key={line.id} className="grid grid-cols-1 lg:grid-cols-2 gap-12 pb-12 border-b-2 border-slate-100 last:border-0 break-inside-avoid">
              
              {/* LADO ESQUERDO: INFORMAÇÕES DA LINHA */}
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">{line.nome}</h2>
                    <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-2 ${line.status === 'active' ? 'text-emerald-500' : 'text-slate-400 opacity-50'}`}>
                      {line.status === 'active' ? '● Linha em Operação' : '○ Sem Registros no Período'}
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl ${line.eficiencia >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <Activity className="w-8 h-8" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Meta Capacidade</p>
                    <p className="text-xl font-black text-slate-900 leading-none">{line.capNominal.toLocaleString()} <span className="text-[10px] text-slate-400">UN</span></p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Eficiência Real</p>
                    <p className={`text-2xl font-black ${line.eficiencia >= 80 ? 'text-emerald-500' : 'text-blue-600'} leading-none`}>
                      {line.eficiencia.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-slate-900 p-6 rounded-3xl shadow-xl shadow-slate-900/10">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Produção Total</p>
                    <p className="text-2xl font-black text-white leading-none">{line.producaoTotal.toLocaleString()}</p>
                  </div>
                </div>

                {line.status === 'active' && line.skusSummary.length > 0 && (
                  <div className="bg-white border-2 border-slate-50 rounded-[32px] overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="flex items-center gap-2 text-slate-900"><Package className="w-3.5 h-3.5 text-blue-600" /> Detalhamento de SKUs</div>
                      <div className="flex gap-4 pr-2">
                        <span className="w-14 text-right">UNIDADES</span>
                        <span className="w-12 text-right">UN/H</span>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {line.skusSummary.map((sku, idx) => (
                        <div key={idx} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50/30 transition-colors">
                          <span className="text-[11px] font-black text-slate-800 uppercase truncate max-w-[200px]">{sku.nome}</span>
                          <div className="flex gap-4 items-center">
                            <span className="text-[11px] font-black text-slate-900 w-14 text-right">{sku.unidades.toLocaleString()}</span>
                            <span className="text-[11px] font-black text-emerald-600 w-12 text-right">{sku.horas > 0 ? Math.round(sku.unidades / sku.horas).toLocaleString() : '0'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* LADO DIREITO: IA E MENSAGEM */}
              <div className="flex flex-col h-full space-y-6">
                <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-[40px] border-4 border-dashed border-slate-100 p-10 group relative transition-all hover:bg-slate-50 hover:border-indigo-200">
                  
                  {!lineAnalyses[line.id] ? (
                    <div className="text-center space-y-6">
                      <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-slate-200 group-hover:scale-110 transition-transform">
                        <BrainCircuit className="w-10 h-10 text-indigo-600" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Pronto para Analisar</h4>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">Clique abaixo para gerar o feedback motivacional da IA</p>
                      </div>
                      <button
                        onClick={() => analyzeProductionMotivational(line)}
                        disabled={loadingAI[line.id] || line.status !== 'active'}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-30 flex items-center gap-3 mx-auto"
                      >
                        {loadingAI[line.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {loadingAI[line.id] ? 'Processando Inteligência...' : 'Gerar Análise Motivacional'}
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col animate-in fade-in zoom-in duration-500">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-600 rounded-lg text-white"><BrainCircuit className="w-4 h-4" /></div>
                          <span className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.2em]">Diagnóstico de Liderança</span>
                        </div>
                        <button onClick={() => setLineAnalyses(prev => { const n = { ...prev }; delete n[line.id]; return n; })} className="p-2 text-slate-300 hover:text-slate-900"><X className="w-5 h-5" /></button>
                      </div>
                      <div className="flex-1 bg-white border-2 border-indigo-100 p-8 rounded-[32px] shadow-sm relative">
                        <div className="absolute -top-3 -left-3 p-2 bg-indigo-600 rounded-full shadow-lg"><Zap className="w-3 h-3 text-white" /></div>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed italic whitespace-pre-line overflow-y-auto max-h-[300px]">"{lineAnalyses[line.id]}"</p>
                      </div>
                      <div className="mt-6 flex justify-end">
                        <button onClick={() => analyzeProductionMotivational(line)} disabled={loadingAI[line.id]} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-2">
                          {loadingAI[line.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />} Refazer Análise
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ))}
        </section>

        <footer className="pt-12 border-t-2 border-slate-900 break-inside-avoid">
          <div className="flex justify-between items-end mb-12">
            <div className="flex items-center gap-5">
              <ShieldCheck className="w-10 h-10 text-slate-400" />
              <div>
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none mb-1">Nexus Intelligent Hub</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em]">Autenticação via PCP Terminal v4.0 (Pro)</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic">Análise de Performance Pro</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </footer>
      </div>

      {/* Modal WhatsApp */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)} />
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl relative z-10 overflow-hidden border border-slate-200">
            <header className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg"><MessageSquare className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Disparar p/ Líderes</h3>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Sincronização via Evolution API</p>
                </div>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900"><X className="w-8 h-8" /></button>
            </header>
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Users className="w-4 h-4" /> Líder Destinatário</label>
                <select value={selectedContact} onChange={(e) => setSelectedContact(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl text-sm font-black text-slate-900 outline-none focus:border-indigo-600 transition-all appearance-none cursor-pointer">
                  <option value="">Selecione o contato...</option>
                  {contatos.map(c => <option key={c.id} value={c.id}>{c.nome} - {c.telefone}</option>)}
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Zap className="w-4 h-4" /> Mensagem Consolidada</label>
                <textarea value={messageToEdit} onChange={(e) => setMessageToEdit(e.target.value)} className="w-full h-64 bg-slate-50 border-2 border-slate-100 p-6 rounded-3xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-600 transition-all resize-none font-mono" />
              </div>
            </div>
            <footer className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button onClick={() => setIsShareModalOpen(false)} className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors">Cancelar</button>
              <button onClick={sendWhatsApp} disabled={isSending || !selectedContact} className="px-10 py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2">
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                {isSending ? 'Enviando...' : 'Enviar Agora'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatorioBoletimPro;
