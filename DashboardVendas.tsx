import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import {
  Package,
  TrendingUp,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Users,
  ShoppingCart,
  AlertCircle,
  ListChecks,
  Factory
} from 'lucide-react';

const DashboardVendas: React.FC = () => {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [estoques, setEstoques] = useState<any[]>([]);
  const [programacao, setProgramacao] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaOffset, setSemanaOffset] = useState(0);

  const getSemana = (offset: number) => {
    const now = new Date();
    now.setDate(now.getDate() + offset * 7);
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    const fmtBR = (d: Date) => d.toLocaleDateString('pt-BR');
    return {
      inicio: fmt(monday),
      fim: fmt(sunday),
      label: `${fmtBR(monday)} — ${fmtBR(sunday)}`
    };
  };

  const semana = getSemana(semanaOffset);

  useEffect(() => {
    fetchData();
  }, [semanaOffset]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { inicio, fim } = getSemana(semanaOffset);

      const [prodRes, estRes, progRes, pedRes, itRes] = await Promise.all([
        supabase.from('produtos').select('*').order('nome'),
        supabase.from('ajustes_estoque').select('*'),
        supabase.from('programacao_semanal' as any).select('*').gte('dia_semana', inicio).lte('dia_semana', fim),
        supabase.from('pedidos').select('*').order('data_pedido', { ascending: false }),
        supabase.from('itens_pedido').select('*'),
      ]);

      setProdutos(prodRes.data || []);
      setEstoques(estRes.data || []);
      setProgramacao(progRes.data || []);
      setPedidos(pedRes.data || []);
      setItens(itRes.data || []);

      if (prodRes.error) console.warn('produtos:', prodRes.error);
      if (estRes.error) console.warn('ajustes_estoque:', estRes.error);
      if (progRes.error) console.warn('programacao_semanal:', progRes.error);
      if (pedRes.error) console.warn('pedidos:', pedRes.error);
      if (itRes.error) console.warn('itens_pedido:', itRes.error);
    } catch (err) {
      console.error('Erro inesperado:', err);
    } finally {
      setLoading(false);
    }
  };

  const estoqueMap = new Map(estoques.map(e => [e.produto_id, e.quantidade_real]));

  const produtosComEstoque = produtos.map(p => ({
    ...p,
    estoque: estoqueMap.get(p.id) ?? 0,
  }));

  const producaoSemanaMap: Record<string, { produto_id: string; nome: string; total: number }> = {};
  programacao.forEach((prog: any) => {
    const pid = prog.produto_id;
    if (!pid) return;
    if (!producaoSemanaMap[pid]) {
      const prod = produtos.find(p => p.id === pid);
      producaoSemanaMap[pid] = { produto_id: pid, nome: prod?.nome || 'Desconhecido', total: 0 };
    }
    producaoSemanaMap[pid].total += Number(prog.quantidade_planejada) || 0;
  });
  const producaoSemanaList = Object.values(producaoSemanaMap).sort((a, b) => b.total - a.total);

  const clienteMap: Record<string, { cliente: string; totalPedidos: number; pendentes: number }> = {};
  pedidos.forEach(p => {
    const nome = p.cliente_nome || 'SEM NOME';
    if (!clienteMap[nome]) {
      clienteMap[nome] = { cliente: nome, totalPedidos: 0, pendentes: 0 };
    }
    clienteMap[nome].totalPedidos++;
    if (p.status === 'Pendente') clienteMap[nome].pendentes++;
  });
  const clientesList = Object.values(clienteMap).sort((a, b) => b.totalPedidos - a.totalPedidos);

  const pedidosPendentes = pedidos.filter(p => p.status === 'Pendente');
  const totalPedidosSemana = pedidos.length;
  const totalClientes = clientesList.length;
  const totalEstoque = produtosComEstoque.reduce((acc, p) => acc + p.estoque, 0);

  const maisVendidos = itens.reduce((acc: any[], item) => {
    const existing = acc.find(i => i.produto_id === item.produto_id);
    if (existing) {
      existing.qtd += Number(item.quantidade) || 0;
    } else {
      const prod = produtos.find(p => p.id === item.produto_id);
      acc.push({
        produto_id: item.produto_id,
        nome: prod?.nome || 'Desconhecido',
        qtd: Number(item.quantidade) || 0,
      });
    }
    return acc;
  }, []).sort((a: any, b: any) => b.qtd - a.qtd).slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#facc15] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">

      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="bg-[#facc15] p-3 sm:p-4 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.3)] text-black">
              <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tighter leading-none">Vendas</h2>
              <p className="text-slate-400 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" /> {totalPedidosSemana} Pedidos · {totalClientes} Clientes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setSemanaOffset(semanaOffset - 1)} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{semana.label}</p>
            </div>
            <button onClick={() => setSemanaOffset(semanaOffset + 1)} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mini KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-blue-500/10 rounded-xl"><Package className="w-4 h-4 text-blue-400" /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estoque Total</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white">{totalEstoque.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#facc15]/10 rounded-xl"><Factory className="w-4 h-4 text-[#facc15]" /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Produzir na Semana</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white">{producaoSemanaList.length}</p>
        </div>
        <div className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#10b981]/10 rounded-xl"><ShoppingCart className="w-4 h-4 text-[#10b981]" /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pedidos</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white">{totalPedidosSemana}</p>
        </div>
        <div className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#f43f5e]/10 rounded-xl"><AlertCircle className="w-4 h-4 text-[#f43f5e]" /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pendentes</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white">{pedidosPendentes.length}</p>
        </div>
      </div>

      {/* Estoque + Programação + Mais Vendidos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Estoque */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-blue-500/10 rounded-xl"><Package className="w-4 h-4 text-blue-400" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Estoque de Produtos</h3>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
            {produtosComEstoque.length === 0 ? (
              <p className="text-slate-500 text-[10px] font-bold uppercase text-center py-8">Nenhum produto cadastrado</p>
            ) : (
              produtosComEstoque.map(prod => (
                <div key={prod.id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-white uppercase truncate">{prod.nome}</p>
                    <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">{prod.tipo || 'Sem tipo'}</p>
                  </div>
                  <span className={`text-[10px] font-black ml-3 ${prod.estoque > 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                    {prod.estoque.toLocaleString()} un
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Programação Semanal */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#facc15]/10 rounded-xl"><Calendar className="w-4 h-4 text-[#facc15]" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Produção da Semana</h3>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
            {producaoSemanaList.length === 0 ? (
              <p className="text-slate-500 text-[10px] font-bold uppercase text-center py-8">Nenhuma produção programada</p>
            ) : (
              producaoSemanaList.map(item => (
                <div key={item.produto_id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-white uppercase truncate">{item.nome}</p>
                  </div>
                  <span className="text-[10px] font-black text-[#facc15] ml-3">{item.total.toLocaleString()} un</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mais Vendidos */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#10b981]/10 rounded-xl"><TrendingUp className="w-4 h-4 text-[#10b981]" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Mais Vendidos</h3>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
            {maisVendidos.length === 0 ? (
              <p className="text-slate-500 text-[10px] font-bold uppercase text-center py-8">Nenhum produto vendido</p>
            ) : (
              maisVendidos.map((prod, i) => (
                <div key={prod.produto_id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="text-[#facc15] text-[10px] font-black">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white uppercase truncate">{prod.nome}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-[#10b981] ml-3">{prod.qtd} un</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Clientes + Pedidos Pendentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Clientes */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#10b981]/10 rounded-xl"><Users className="w-4 h-4 text-[#10b981]" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Clientes</h3>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
            {clientesList.length === 0 ? (
              <p className="text-slate-500 text-[10px] font-bold uppercase text-center py-8">Nenhum cliente</p>
            ) : (
              clientesList.map(cli => (
                <div key={cli.cliente} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-white uppercase truncate">{cli.cliente}</p>
                  </div>
                  <div className="flex items-center gap-4 ml-3">
                    <span className="text-[10px] font-black text-white">{cli.totalPedidos} pedidos</span>
                    {cli.pendentes > 0 && (
                      <span className="text-[9px] font-black text-[#facc15] bg-[#facc15]/10 px-2 py-0.5 rounded">{cli.pendentes} pendentes</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pedidos Pendentes */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#f43f5e]/10 rounded-xl"><ListChecks className="w-4 h-4 text-[#f43f5e]" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Pedidos Pendentes</h3>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
            {pedidosPendentes.length === 0 ? (
              <p className="text-slate-500 text-[10px] font-bold uppercase text-center py-8">Nenhum pedido pendente</p>
            ) : (
              pedidosPendentes.map(ped => (
                <div key={ped.id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-white uppercase truncate">{ped.cliente_nome}</p>
                    <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">
                      {ped.data_entrega ? new Date(ped.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data de entrega'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-[9px] font-black text-[#facc15] bg-[#facc15]/10 px-2 py-0.5 rounded">Pendente</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardVendas;
