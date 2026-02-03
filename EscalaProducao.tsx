
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { Produto, Pedido, ItemPedido, Linha, EscalaProducao as EscalaRecord } from './types/database';
import { GoogleGenAI } from "@google/genai";
import {
  CalendarDays,
  ChevronRight,
  Package,
  Timer,
  Factory,
  Loader2,
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Box,
  User,
  Zap,
  Layout,
  Clock,
  X,
  Sparkles,
  Wand2,
  Check,
  Info
} from 'lucide-react';

const EscalaProducao: React.FC = () => {
  const [backlog, setBacklog] = useState<any[]>([]);
  const [escalas, setEscalas] = useState<any[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAssigning, setIsAssigning] = useState<any | null>(null);

  // Estados para IA
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    diagnostico: string;
    programacao: Array<{ item_id: string, linha_id: string, turno: string, data: string }>;
    lead_time: string;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pedidosRes, linhasRes, escalasRes] = await Promise.all([
        supabase.from('pedidos').select('*, itens_pedido(*, produtos(*))').eq('status', 'Pendente'),
        supabase.from('linhas').select('*').order('nome'),
        supabase.from('escalas_producao').select('*, item_pedido:itens_pedido(*, produtos(*), pedido:pedidos(*))')
      ]);

      if (linhasRes.data) setLinhas(linhasRes.data);
      if (escalasRes.data) setEscalas(escalasRes.data);

      const itemsBacklog: any[] = [];
      pedidosRes.data?.forEach(ped => {
        ped.itens_pedido?.forEach((item: any) => {
          const jaEscalado = escalasRes.data?.some(esc => esc.item_pedido_id === item.id);
          if (!jaEscalado) {
            itemsBacklog.push({
              ...item,
              pedido: ped
            });
          }
        });
      });
      setBacklog(itemsBacklog);

    } catch (err) {
      console.error("Erro ao carregar escala:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEscalar = async (item: any, linhaId: string, turno: string, dateOverride?: string) => {
    try {
      const { error } = await supabase.from('escalas_producao').insert({
        item_pedido_id: item.id,
        linha_id: linhaId,
        data_programada: dateOverride || selectedDate,
        turno: turno,
        status: 'Agendado'
      });
      if (error) throw error;
      setIsAssigning(null);
      await fetchData();
    } catch (err: any) {
      console.error("Erro ao escalar:", err.message);
    }
  };

  const otimizarComIA = async () => {
    if (backlog.length === 0) {
      alert("Não há pedidos no backlog para otimizar.");
      return;
    }

    setIsOptimizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

      // Preparar dados para a IA
      const contexto = {
        backlog: backlog.map(b => ({
          id: b.id,
          produto: b.produtos?.nome,
          quantidade: b.quantidade,
          entrega: b.pedido?.data_entrega
        })),
        linhas: linhas.map(l => ({
          id: l.id,
          nome: l.nome,
          capacidades: backlog.reduce((acc, b) => {
            acc[b.produtos?.nome] = b.produtos?.capacidade_nominal || 7200;
            return acc;
          }, {} as Record<string, number>)
        })),
        data_inicio: selectedDate
      };

      const prompt = `Você é um Engenheiro de PCP Sênior. Analise o seguinte cenário de produção de água mineral:
      
      ${JSON.stringify(contexto)}

      Instruções Obrigatórias:
      1. Priorize pedidos com data de entrega mais próxima.
      2. Agrupe produtos idênticos na mesma linha para evitar trocas de setup.
      3. Se houver ociosidade na semana, sugira produção para ESTOQUE.
      4. Calcule o Lead Time final (ex: "Fábrica ocupada até Terça às 14h").

      Responda ESTRITAMENTE em formato JSON com as chaves:
      - "diagnostico": Um texto em português explicando a lógica usada.
      - "programacao": Um array de objetos { "item_id": string, "linha_id": string, "turno": "1" | "2", "data": "YYYY-MM-DD" }
      - "lead_time": Texto informando o prazo final de ocupação.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const suggestion = JSON.parse(response.text);
      setAiSuggestion(suggestion);
    } catch (err) {
      console.error("Erro na otimização:", err);
      alert("Falha na inteligência artificial. Tente novamente.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const aplicarSugestaoIA = async () => {
    if (!aiSuggestion) return;
    setLoading(true);
    try {
      // Fix: Explicitly cast 'status' to the specific union type required by the database schema to satisfy TypeScript's insert method constraints.
      const inserts = aiSuggestion.programacao.map(p => ({
        item_pedido_id: p.item_id,
        linha_id: p.linha_id,
        data_programada: p.data,
        turno: p.turno,
        status: 'Agendado' as 'Agendado' | 'Em Produção' | 'Concluído'
      }));

      const { error } = await supabase.from('escalas_producao').insert(inserts);
      if (error) throw error;

      alert("Escala otimizada aplicada com sucesso!");
      setAiSuggestion(null);
      await fetchData();
    } catch (err: any) {
      alert("Erro ao aplicar sugestão: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverEscala = async (id: string) => {
    if (!confirm("Remover este item do planejamento diário?")) return;
    try {
      const { error } = await supabase.from('escalas_producao').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert("Erro ao remover: " + err.message);
    }
  };

  const calcularTempo = (quantidade: number, capNominal: number) => {
    if (!capNominal) return 0;
    const capPorHora = capNominal / 8;
    return (quantidade / capPorHora);
  };

  const escalasPorLinha = useMemo(() => {
    const map: Record<string, any[]> = {};
    linhas.forEach(l => {
      map[l.id] = escalas.filter(esc => esc.linha_id === l.id && esc.data_programada === selectedDate);
    });
    return map;
  }, [escalas, linhas, selectedDate]);

  const getUrgencyColor = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const delivery = new Date(dateStr);
    const diff = delivery.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "border-rose-500 bg-rose-50";
    if (days <= 2) return "border-amber-500 bg-amber-50";
    return "border-slate-200 bg-white";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-blue-500">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold text-[10px] uppercase tracking-[0.3em]">Sincronizando Inteligência...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[85vh] animate-in fade-in duration-700">

      {/* Coluna Esquerda: Backlog */}
      <aside className="w-full lg:w-96 flex flex-col gap-6 shrink-0">
        <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <Package className="w-6 h-6 text-blue-400" /> Backlog
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Demanda Pendente</p>
            </div>
            <button
              onClick={otimizarComIA}
              disabled={isOptimizing}
              className="bg-white/10 hover:bg-blue-600 p-3 rounded-2xl border border-white/20 transition-all group/ia"
              title="Otimizar com IA"
            >
              {isOptimizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-blue-300 group-hover/ia:text-white" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar max-h-[70vh]">
          {backlog.map(item => (
            <div
              key={item.id}
              className={`p-5 border-l-4 rounded-2xl shadow-sm transition-all hover:scale-[1.02] cursor-pointer group ${getUrgencyColor(item.pedido.data_entrega)}`}
              onClick={() => setIsAssigning(item)}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[9px] font-black text-slate-400 uppercase">Pedido #{item.pedido.id.slice(0, 6).toUpperCase()}</span>
                <span className="text-[9px] font-black text-slate-800 uppercase bg-white/50 px-2 py-0.5 rounded-full">{new Date(item.pedido.data_entrega).toLocaleDateString('pt-BR')}</span>
              </div>
              <h4 className="text-sm font-black text-slate-800 uppercase truncate mb-1">{item.produtos?.nome}</h4>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-black text-slate-700">{item.quantidade.toLocaleString()} <span className="text-[9px] text-slate-400 uppercase">un</span></span>
                </div>
                <button className="p-2 bg-slate-900 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {backlog.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-300">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest">Fila Zerada</p>
            </div>
          )}
        </div>
      </aside>

      {/* Área Central */}
      <section className="flex-1 flex flex-col gap-8">

        {/* Modal de Sugestão de IA */}
        {aiSuggestion && (
          <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-8 rounded-[40px] shadow-2xl border border-blue-400/30 animate-in slide-in-from-top-4 duration-500 relative overflow-hidden">
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />

            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-2xl backdrop-blur-md">
                  <Sparkles className="w-6 h-6 text-blue-300" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter italic">Diagnóstico do Planejador IA</h3>
              </div>
              <button onClick={() => setAiSuggestion(null)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-6 h-6 text-white/50" />
              </button>
            </div>

            <p className="text-sm font-medium leading-relaxed text-blue-100/90 mb-8 border-l-2 border-blue-400/50 pl-6 relative z-10">
              {aiSuggestion.diagnostico}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white/5 p-6 rounded-3xl border border-white/10 relative z-10">
              <div className="flex items-center gap-4">
                <Clock className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest leading-none">Status de Ocupação</p>
                  <p className="text-lg font-black mt-1">{aiSuggestion.lead_time}</p>
                </div>
              </div>
              <button
                onClick={aplicarSugestaoIA}
                className="w-full sm:w-auto px-8 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                <Check className="w-4 h-4" /> Aplicar Sugestão
              </button>
            </div>
          </div>
        )}

        <div className="bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-2xl"><CalendarDays className="w-6 h-6 text-blue-600" /></div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xl font-black text-slate-800 outline-none uppercase tracking-tighter"
            />
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2">
              <Zap className="w-4 h-4" /> Liberar Chão de Fábrica
            </button>
          </div>
        </div>

        {/* Kanban de Linhas */}
        <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar h-full">
          {linhas.map(linha => {
            const itensLinha = escalasPorLinha[linha.id] || [];
            const totalHoras = itensLinha.reduce((acc, esc) => {
              const tempo = calcularTempo(esc.item_pedido?.quantidade, esc.item_pedido?.produtos?.capacidade_nominal);
              return acc + tempo;
            }, 0);

            return (
              <div key={linha.id} className="w-80 shrink-0 flex flex-col gap-6">
                <header className={`p-6 rounded-[32px] border transition-all ${totalHoras > 20 ? 'bg-rose-50 border-rose-200' : 'bg-white border-white shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{linha.nome}</span>
                    <Factory className={`w-5 h-5 ${totalHoras > 20 ? 'text-rose-500' : 'text-slate-300'}`} />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-black text-slate-800 tracking-tighter leading-none">{totalHoras.toFixed(1)} <span className="text-xs">h</span></p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Carga Dia</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${totalHoras > 24 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                        {((totalHoras / 24) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </header>

                <div className="flex-1 space-y-4">
                  {itensLinha.map(esc => {
                    const tempo = calcularTempo(esc.item_pedido?.quantidade, esc.item_pedido?.produtos?.capacidade_nominal);
                    return (
                      <div key={esc.id} className="bg-white p-5 rounded-3xl border border-white shadow-sm group hover:border-blue-200 transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${esc.turno === '1' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>T{esc.turno}</span>
                          <button onClick={() => handleRemoverEscala(esc.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h5 className="text-xs font-black text-slate-800 uppercase leading-tight mb-3">{esc.item_pedido?.produtos?.nome}</h5>
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-3">
                          <div className="flex items-center gap-2">
                            <Box className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-black text-slate-700">{esc.item_pedido?.quantidade.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 justify-end text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs font-black text-slate-700">{tempo.toFixed(1)}h</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal Programação Manual */}
      {isAssigning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsAssigning(null)} />
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg relative z-10 animate-in zoom-in-95 duration-500 overflow-hidden border border-white/20">
            <header className="px-8 py-8 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Programar SKU</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">{isAssigning.produtos?.nome}</p>
              </div>
              <button onClick={() => setIsAssigning(null)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-8 h-8" />
              </button>
            </header>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Qtd</span>
                  <span className="text-lg font-black text-slate-800">{isAssigning.quantidade.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Capacidade</span>
                  <span className="text-lg font-black text-blue-600">{isAssigning.produtos?.capacidade_nominal?.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Linha Destino</label>
                <div className="grid grid-cols-1 gap-2">
                  {linhas.map(linha => (
                    <div key={linha.id} className="flex gap-2">
                      <button onClick={() => handleEscalar(isAssigning, linha.id, '1')} className="flex-1 py-4 bg-slate-50 hover:bg-amber-500 hover:text-white rounded-2xl text-[10px] font-black uppercase transition-all border border-slate-100">T1</button>
                      <button onClick={() => handleEscalar(isAssigning, linha.id, '2')} className="flex-1 py-4 bg-slate-50 hover:bg-indigo-500 hover:text-white rounded-2xl text-[10px] font-black uppercase transition-all border border-slate-100">T2</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <footer className="p-8 border-t border-slate-100">
              <button onClick={() => setIsAssigning(null)} className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase">Cancelar</button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
};

export default EscalaProducao;
