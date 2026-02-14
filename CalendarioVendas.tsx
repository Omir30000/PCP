
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { Produto, Pedido, ItemPedido } from './types/database';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Package,
  ShoppingCart,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Box,
  LayoutGrid
} from 'lucide-react';

const CalendarioVendas: React.FC = () => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [todosRegistrosProducao, setTodosRegistrosProducao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<any | null>(null);

  const [dataReferencia, setDataReferencia] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    // Ajustar para Segunda-feira da semana atual
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff, 12, 0, 0);
    return monday;
  });

  const getDiasSemana = useMemo(() => {
    const dias = [];
    const nomes = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(dataReferencia);
      d.setDate(dataReferencia.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const formatada = `${nomes[i]} ${d.getDate()}/${d.getMonth() + 1}`;
      dias.push({ label: formatada, nomeDia: nomes[i], dataCurta: `${d.getDate()}/${d.getMonth() + 1}`, iso });
    }
    return dias;
  }, [dataReferencia]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dataInicio = getDiasSemana[0].iso;
      const dataFim = getDiasSemana[6].iso;

      const [prodRes, pedRes, regRes] = await Promise.all([
        supabase.from('produtos').select('*').order('nome'),
        supabase.from('pedidos')
          .select('*, itens_pedido(*, produtos(*))')
          .gte('data_entrega', dataInicio)
          .lte('data_entrega', dataFim)
          .order('data_entrega', { ascending: true }),
        supabase.from('registros_producao').select('*')
      ]);

      if (prodRes.data) setProdutos(prodRes.data);
      if (pedRes.data) setPedidos(pedRes.data);
      if (regRes.data) setTodosRegistrosProducao(regRes.data);

    } catch (err) {
      console.error("Erro ao carregar dados do calendário:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataReferencia]);

  // Lógica de Estoque (Reutilizada de Vendas.tsx para consistência)
  const inventoryMetrics = useMemo(() => {
    const metrics: Record<string, { currentStock: number, pendingDemand: number }> = {};

    produtos.forEach(prod => {
      const totalProduced = todosRegistrosProducao
        .filter(r =>
          String(r.produto_volume) === String(prod.id) ||
          String(r.produto_volume) === String(prod.nome) ||
          (r.produto_id && String(r.produto_id) === String(prod.id))
        )
        .reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);

      // Aqui precisaria idealmente de todos os pedidos finalizados históricos para o saldo real
      // Mas para o calendário vamos focar na prontidão do pedido específico
      metrics[prod.id] = { currentStock: totalProduced, pendingDemand: 0 };
    });

    return metrics;
  }, [produtos, todosRegistrosProducao]);

  const getEstoqueAtual = (produtoId: string) => {
    return inventoryMetrics[produtoId]?.currentStock || 0;
  };

  const getStatusPedido = (pedido: any) => {
    const itens = pedido.itens_pedido || [];
    if (itens.length === 0) return 'OK';

    const todosProntos = itens.every((item: any) =>
      getEstoqueAtual(item.produto_id) >= item.quantidade
    );

    return todosProntos ? 'Pronto' : 'Pendente';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-[#facc15]">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-black text-[10px] uppercase tracking-[0.3em]">Sincronizando Calendário...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#141414] p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-[#facc15] p-4 rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.2)]">
            <Calendar className="text-black w-7 h-7" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Agenda de Entregas</h2>
            <p className="text-[#facc15] text-[10px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" /> Ciclo de Vendas Semanal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => { const d = new Date(dataReferencia); d.setDate(d.getDate() - 7); setDataReferencia(d); }}
              className="p-3 hover:text-[#facc15] hover:bg-white/5 rounded-xl transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-6 py-2 text-center min-w-[200px]">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white block">
                {getDiasSemana[0].dataCurta} — {getDiasSemana[6].dataCurta}
              </span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mt-1">
                Fevereiro 2026
              </span>
            </div>
            <button
              onClick={() => { const d = new Date(dataReferencia); d.setDate(d.getDate() + 7); setDataReferencia(d); }}
              className="p-3 hover:text-[#facc15] hover:bg-white/5 rounded-xl transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {getDiasSemana.map((dia) => {
          const pedidosDoDia = pedidos.filter(p => p.data_entrega === dia.iso);
          const isHoje = dia.iso === new Date().toISOString().split('T')[0];

          return (
            <div
              key={dia.iso}
              className={`flex flex-col min-h-[500px] rounded-[24px] border transition-all duration-300 ${isHoje ? 'bg-[#facc15]/5 border-[#facc15]/20' : 'bg-[#0d0d0d] border-white/5'
                }`}
            >
              {/* Header do Dia */}
              <div className={`p-4 border-b text-center ${isHoje ? 'border-[#facc15]/10' : 'border-white/5'}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isHoje ? 'text-[#facc15]' : 'text-slate-500'}`}>
                  {dia.nomeDia}
                </span>
                <div className={`text-xl font-black mt-1 ${isHoje ? 'text-white' : 'text-slate-300'}`}>
                  {dia.dataCurta.split('/')[0]}
                </div>
              </div>

              {/* Lista de Pedidos */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto no-scrollbar pb-10">
                {pedidosDoDia.map((ped) => {
                  const status = getStatusPedido(ped);
                  const isPronto = status === 'Pronto';
                  const totalItens = ped.itens_pedido?.reduce((a: number, b: any) => a + (Number(b.quantidade) || 0), 0) || 0;

                  return (
                    <div
                      key={ped.id}
                      onClick={() => setSelectedPedido(ped)}
                      className={`p-4 rounded-2xl border bg-[#141414] hover:scale-[1.02] transition-all cursor-pointer group relative overflow-hidden ${isPronto ? 'border-emerald-500/20' : 'border-white/5 shadow-lg'
                        }`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[8px] font-mono text-slate-600 font-bold tracking-widest">
                            #{ped.id.slice(0, 4).toUpperCase()}
                          </span>
                          {isPronto ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                          )}
                        </div>
                        <h4 className="text-[10px] font-black text-white uppercase truncate leading-tight group-hover:text-[#facc15] transition-colors">
                          {ped.cliente_nome}
                        </h4>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.03]">
                          <div className="flex items-center gap-1.5">
                            <Box className="w-3 h-3 text-slate-500" />
                            <span className="text-[9px] font-black text-slate-400">
                              {totalItens.toLocaleString()} <span className="text-[7px]">UN</span>
                            </span>
                          </div>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${isPronto ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                            }`}>
                            {status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {pedidosDoDia.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 py-10">
                    <ShoppingCart className="w-8 h-8 text-slate-500 mb-2" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 text-center">
                      Sem Entregas
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Detalhes do Pedido */}
      {selectedPedido && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedPedido(null)} />
          <div className="bg-[#141414] rounded-[40px] shadow-2xl w-full max-w-4xl relative z-10 border border-white/10 overflow-hidden animate-in zoom-in-95">
            <header className="px-10 py-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-[#facc15] rounded-2xl">
                  <Package className="w-8 h-8 text-black" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                    {selectedPedido.cliente_nome}
                  </h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                    Pedido REF: {selectedPedido.id.slice(0, 8).toUpperCase()} — Entrega: {new Date(selectedPedido.data_entrega).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedPedido(null)} className="p-4 text-slate-500 hover:text-white transition-colors">
                <LayoutGrid className="w-10 h-10" />
              </button>
            </header>

            <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <h6 className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                  <Box className="w-4 h-4 text-[#facc15]" /> Verificação de Intens e Saldo Industrial
                </h6>
                <div className="border border-white/5 rounded-[32px] overflow-hidden bg-black/40">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-[9px] text-slate-500 font-black uppercase tracking-widest border-b border-white/5">
                      <tr>
                        <th className="px-8 py-5">Ativo SKU</th>
                        <th className="px-8 py-5 text-center">Requisitado</th>
                        <th className="px-8 py-5 text-center">Saldo em Estoque</th>
                        <th className="px-8 py-5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[11px] text-slate-400">
                      {selectedPedido.itens_pedido?.map((item: any, idx: number) => {
                        const produzido = getEstoqueAtual(item.produto_id);
                        const pronto = produzido >= item.quantidade;
                        return (
                          <tr key={idx} className={pronto ? 'bg-emerald-500/5' : 'bg-transparent'}>
                            <td className="px-8 py-5 font-black text-white uppercase">{item.produtos?.nome || 'SKU'}</td>
                            <td className="px-8 py-5 text-center font-bold">{item.quantidade.toLocaleString('pt-BR')}</td>
                            <td className="px-8 py-5 text-center font-black text-[#facc15] text-lg">{produzido.toLocaleString('pt-BR')}</td>
                            <td className="px-8 py-5 text-right">
                              {pronto ? (
                                <span className="text-emerald-500 font-black uppercase text-[10px] flex items-center justify-end gap-2">DISPONÍVEL <CheckCircle2 className="w-4 h-4" /></span>
                              ) : (
                                <span className="text-amber-500 font-black uppercase text-[10px] flex items-center justify-end gap-2">AGUARDANDO <AlertTriangle className="w-4 h-4" /></span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <footer className="px-10 py-10 bg-black/60 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setSelectedPedido(null)}
                className="px-10 py-5 bg-white/5 border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
              >
                Fechar Detalhes
              </button>
            </footer>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default CalendarioVendas;
