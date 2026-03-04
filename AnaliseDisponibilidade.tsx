
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { Produto } from './types/database';
import {
  Scale,
  RefreshCw,
  Package,
  ShoppingCart,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  ArrowRight,
  Info,
  Waves,
  Zap,
  Box,
  LayoutGrid
} from 'lucide-react';

const CATEGORIAS = ['Todos', 'Natural', 'Gás', 'Copo', 'Galao'];

const AnaliseDisponibilidade: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [programado, setProgramado] = useState<any[]>([]);
  const [todosRegistrosProducao, setTodosRegistrosProducao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, pedRes, progRes, regRes] = await Promise.all([
        supabase.from('produtos').select('*').order('nome'),
        supabase.from('pedidos').select('*, itens_pedido(*)'),
        supabase.from('programacao_semanal' as any).select('*'),
        supabase.from('registros_producao').select('*')
      ]);

      if (prodRes.data) setProdutos(prodRes.data);
      if (pedRes.data) setPedidos(pedRes.data);
      if (progRes.data) setProgramado(progRes.data);
      if (regRes.data) setTodosRegistrosProducao(regRes.data);
    } catch (err) {
      console.error("Erro na sincronização analítica:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const balanco = useMemo(() => {
    return produtos.map(prod => {
      // 📦 ESTOQUE REAL (Produzido - Despachado)
      const totalProduced = todosRegistrosProducao
        .filter(r =>
          String(r.produto_volume) === String(prod.id) ||
          String(r.produto_volume) === String(prod.nome) ||
          (r.produto_id && String(r.produto_id) === String(prod.id))
        )
        .reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);

      const totalShipped = pedidos
        .filter(p => p.status === 'Finalizado' || p.status === 'Entregue')
        .reduce((acc, p) => {
          const item = p.itens_pedido?.find((i: any) => String(i.produto_id) === String(prod.id));
          return acc + (item ? Number(item.quantidade) : 0);
        }, 0);

      const currentStock = totalProduced - totalShipped;

      // 🛒 PEDIDOS PENDENTES (Fila de Demanda)
      const qtdPedidos = pedidos
        .filter(p => p.status !== 'Finalizado' && p.status !== 'Entregue' && p.status !== 'Cancelado')
        .reduce((acc, ped) => {
          const item = ped.itens_pedido?.find((i: any) => String(i.produto_id) === String(prod.id));
          return acc + (item ? Number(item.quantidade) : 0);
        }, 0);

      // 🗓️ PROGRAMAÇÃO SEMANAL
      const qtdProgramada = programado
        .filter(p => p.produto_id === prod.id)
        .reduce((acc, p) => acc + (Number(p.quantidade_planejada) || 0), 0);

      const saldoFinal = (currentStock + qtdProgramada) - qtdPedidos;

      let status: 'critico' | 'excesso' | 'equilibrado' = 'equilibrado';
      if (saldoFinal < 0) status = 'critico';
      else if (qtdPedidos > 0 && saldoFinal > (qtdPedidos * 3)) status = 'excesso';

      return {
        ...prod,
        estoque: currentStock,
        demanda: qtdPedidos,
        programado: qtdProgramada,
        saldoFinal,
        status
      };
    }).filter(p => filtroCategoria === 'Todos' || p.tipo === filtroCategoria);
  }, [produtos, pedidos, programado, todosRegistrosProducao, filtroCategoria]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-blue-500">
        <RefreshCw className="w-12 h-12 animate-spin mb-4" />
        <p className="font-black text-[10px] uppercase tracking-[0.3em]">Cruzando Dados de Cadeia de Suprimentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 w-full max-w-[98%] mx-auto font-sans">

      {/* Header Analítico */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-900/90 backdrop-blur-md p-8 rounded-2xl border border-white/10 shadow-2xl w-full relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-blue-600 p-4 rounded-xl shadow-lg shadow-blue-500/20 shrink-0 text-white">
            <Scale className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none">Balanço de Disponibilidade</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Inteligência de Backlog e Inventário
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto relative z-10">
          <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 backdrop-blur-sm">
            {CATEGORIAS.map(cat => (
              <button
                key={cat}
                onClick={() => setFiltroCategoria(cat)}
                className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${filtroCategoria === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            className="bg-slate-800 border border-white/10 hover:bg-slate-700 text-white px-8 py-3 rounded-xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 shadow-xl"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar Dados
          </button>
        </div>
      </div>

      {/* Resumo de Saúde da Carteira */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-white shadow-sm flex items-center gap-6">
          <div className="p-4 bg-red-50 text-red-500 rounded-2xl"><AlertTriangle className="w-6 h-6" /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens em Ruptura</p>
            <h4 className="text-3xl font-black text-slate-800">{balanco.filter(b => b.status === 'critico').length}</h4>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-white shadow-sm flex items-center gap-6">
          <div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl"><CheckCircle2 className="w-6 h-6" /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens Otimizados</p>
            <h4 className="text-3xl font-black text-slate-800">{balanco.filter(b => b.status === 'equilibrado').length}</h4>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-white shadow-sm flex items-center gap-6">
          <div className="p-4 bg-amber-50 text-amber-500 rounded-2xl"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Excesso de Estoque</p>
            <h4 className="text-3xl font-black text-slate-800">{balanco.filter(b => b.status === 'excesso').length}</h4>
          </div>
        </div>
      </div>

      {/* Tabela Mestra */}
      <div className="bg-white rounded-[40px] shadow-sm border border-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Produto / SKU</th>
                <th className="px-10 py-6 text-center">📦 Estoque Atual</th>
                <th className="px-10 py-6 text-center">🛒 Pedidos (Fila)</th>
                <th className="px-10 py-6 text-center">🗓️ Programado</th>
                <th className="px-10 py-6 text-right">⚖️ Saldo Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {balanco.map((p) => (
                <tr
                  key={p.id}
                  className={`transition-all ${p.status === 'critico' ? 'bg-red-50/40' :
                    p.status === 'excesso' ? 'bg-amber-50/40' :
                      'hover:bg-slate-50'
                    }`}
                >
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl bg-white shadow-sm border border-slate-100 ${p.status === 'critico' ? 'text-red-500' : 'text-blue-500'}`}>
                        <Box className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 uppercase truncate max-w-[250px]">{p.nome}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.tipo} • {p.volume}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center font-black text-slate-600 text-sm">{p.estoque.toLocaleString()}</td>
                  <td className="px-10 py-6 text-center font-black text-blue-600 text-sm">{p.demanda.toLocaleString()}</td>
                  <td className="px-10 py-6 text-center font-black text-emerald-600 text-sm">{p.programado.toLocaleString()}</td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-lg font-black tracking-tighter ${p.status === 'critico' ? 'text-red-600' :
                        p.status === 'excesso' ? 'text-amber-600' :
                          'text-emerald-600'
                        }`}>
                        {p.saldoFinal.toLocaleString()}
                      </span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${p.status === 'critico' ? 'bg-red-600 text-white animate-pulse' :
                        p.status === 'excesso' ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                        {p.status === 'critico' ? 'Ruptura' : p.status === 'excesso' ? 'Excesso' : 'Equilibrado'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {balanco.length === 0 && (
            <div className="py-32 text-center text-slate-300 uppercase font-black tracking-widest italic">
              Nenhum dado disponível para os filtros selecionados
            </div>
          )}
        </div>
      </div>

      <div className="p-8 bg-blue-50 rounded-[32px] border border-blue-100 flex items-start gap-6">
        <Info className="w-8 h-8 text-blue-400 shrink-0" />
        <div>
          <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight mb-2">Entendendo o Cálculo de Saldo</h4>
          <p className="text-xs text-blue-700 leading-relaxed max-w-4xl">
            O <strong>Saldo Final</strong> representa a posição projetada do seu estoque ao fim do ciclo atual.
            É calculado como: <code>(Estoque Físico + Programação de Produção) - Carteira de Pedidos</code>.
            Saldos negativos indicam que você prometeu mais do que sua produção + estoque podem suportar.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnaliseDisponibilidade;
