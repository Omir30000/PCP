
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { Produto, Pedido, ItemPedido } from './types/database';
import {
  ShoppingCart,
  Plus,
  Search,
  Trash2,
  X,
  Loader2,
  Eye,
  Package,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Box,
  Timer,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Pencil,
  Database,
  ArrowDownRight,
  Check as CheckIcon,
  Factory,
  BarChartHorizontal,
  Calendar,
  User,
  Trash
} from 'lucide-react';

const Vendas: React.FC = () => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [todosRegistrosProducao, setTodosRegistrosProducao] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<any | null>(null);

  const [editingStock, setEditingStock] = useState<any | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);

  // Estados para Novo Pedido
  const [novoCliente, setNovoCliente] = useState('');
  const [novaDataEntrega, setNovaDataEntrega] = useState('');
  const [itensNovoPedido, setItensNovoPedido] = useState<{ produto_id: string, quantidade: number, nome?: string }[]>([]);
  const [tempProdutoId, setTempProdutoId] = useState('');
  const [tempQuantidade, setTempQuantidade] = useState<number>(0);

  // Estados para Edição
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null);

  // 🚀 SINCRO TOTAL: Busca absoluta de toda a base registros_producao (SEM QUALQUER FILTRO DE DATA)
  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, pedRes, regRes] = await Promise.all([
        supabase.from('produtos').select('*').order('nome'),
        supabase.from('pedidos').select('*, itens_pedido(*, produtos(*))').order('data_entrega', { ascending: true }),
        supabase.from('registros_producao').select('*')
      ]);

      if (prodRes.data) setProdutos(prodRes.data);
      if (pedRes.data) setPedidos(pedRes.data);

      if (regRes.data) {
        console.log('NEXUS DEBUG - REGISTROS RECUPERADOS:', regRes.data.length);
        setTodosRegistrosProducao(regRes.data);
      }

    } catch (err) {
      console.error("Nexus Vendas Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('nexus-inventory-absolute-v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registros_producao' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 🧠 INTELIGÊNCIA DE INVENTÁRIO NEXUS: SOMA HISTÓRICA TOTAL
  const inventoryMetrics = useMemo(() => {
    const metrics: Record<string, { currentStock: number, pendingDemand: number, forecast: number }> = {};

    produtos.forEach(prod => {
      const totalProduced = todosRegistrosProducao
        .filter(r =>
          String(r.produto_volume) === String(prod.id) ||
          String(r.produto_volume) === String(prod.nome) ||
          (r.produto_id && String(r.produto_id) === String(prod.id))
        )
        .reduce((acc, r) => acc + (Number(r.quantidade_produzida) || 0), 0);

      // 📦 BAIXA LÓGICA: Considera Finalizados ou Entregues como já saídos do estoque
      const totalShipped = pedidos
        .filter(p => p.status === 'Finalizado' || p.status === 'Entregue')
        .reduce((acc, p) => {
          const item = p.itens_pedido?.find((i: any) => String(i.produto_id) === String(prod.id));
          return acc + (item ? Number(item.quantidade) : 0);
        }, 0);

      const pendingDemand = pedidos
        .filter(p => p.status !== 'Finalizado' && p.status !== 'Entregue' && p.status !== 'Cancelado')
        .reduce((acc, p) => {
          const item = p.itens_pedido?.find((i: any) => String(i.produto_id) === String(prod.id));
          return acc + (item ? Number(item.quantidade) : 0);
        }, 0);

      const currentStock = totalProduced - totalShipped;
      const forecast = currentStock - pendingDemand;

      metrics[prod.id] = { currentStock, pendingDemand, forecast };
    });

    return metrics;
  }, [produtos, todosRegistrosProducao, pedidos]);

  const getProducaoParaPedido = (produtoId: string) => {
    const m = inventoryMetrics[produtoId];
    return m ? m.currentStock : 0;
  };

  const handleDeletePedido = async (id: string) => {
    if (!confirm("⚠️ AVISO CRÍTICO: Deseja realmente excluir este pedido? Esta ação é irreversível e removerá todos os itens vinculados.")) return;

    try {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert("✅ Pedido removido com sucesso.");
      fetchData();
    } catch (err) {
      console.error("Erro ao deletar pedido:", err);
      alert("Falha ao remover pedido.");
    }
  };

  const prepararEdicao = (ped: any) => {
    setNovoCliente(ped.cliente_nome);
    setNovaDataEntrega(ped.data_entrega);
    setItensNovoPedido(ped.itens_pedido.map((item: any) => ({
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      nome: item.produtos?.nome
    })));
    setEditingPedidoId(ped.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  // 🚜 LÓGICA DE BAIXA DE ESTOQUE (BAIXA LÓGICA)
  const handleFinalizarPedido = async (id: string) => {
    if (!selectedPedido) return;

    const todosProntos = selectedPedido.itens_pedido?.every((item: any) =>
      getProducaoParaPedido(item.produto_id) >= item.quantidade
    );

    if (!todosProntos) {
      alert("❌ IMPOSSÍVEL FINALIZAR: Saldo insuficiente em um ou mais SKUs para atender a carga.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ status: 'Finalizado' })
        .eq('id', id);

      if (error) throw error;

      alert("✅ ESTOQUE ATUALIZADO: O pedido foi finalizado e o saldo real dos SKUs foi baixado logicamente.");
      setSelectedPedido(null);
      await fetchData(); // Recarrega tudo para garantir sincronia visual
    } catch (err) {
      console.error("Nexus Finalize Error:", err);
      alert("Falha crítica ao finalizar pedido. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // Funções para Gerenciar Itens do Novo Pedido
  const adicionarItemAoPedido = () => {
    if (!tempProdutoId || tempQuantidade <= 0) return;
    const prod = produtos.find(p => p.id === tempProdutoId);
    if (!prod) return;

    setItensNovoPedido([...itensNovoPedido, {
      produto_id: tempProdutoId,
      quantidade: tempQuantidade,
      nome: prod.nome
    }]);
    setTempProdutoId('');
    setTempQuantidade(0);
  };

  const removerItemDoPedido = (index: number) => {
    setItensNovoPedido(itensNovoPedido.filter((_, i) => i !== index));
  };

  const salvarNovoPedido = async () => {
    if (!novoCliente || !novaDataEntrega || itensNovoPedido.length === 0) {
      alert("Preencha todos os campos e adicione pelo menos um item.");
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && editingPedidoId) {
        // 1. Atualizar Cabeçalho
        const { error: updateError } = await supabase
          .from('pedidos')
          .update({
            cliente_nome: novoCliente,
            data_entrega: novaDataEntrega
          })
          .eq('id', editingPedidoId);

        if (updateError) throw updateError;

        // 2. Sincronizar Itens: Remover antigos e inserir novos (abordagem simples e eficaz)
        const { error: deleteError } = await supabase
          .from('itens_pedido')
          .delete()
          .eq('pedido_id', editingPedidoId);

        if (deleteError) throw deleteError;

        const itensPayload = itensNovoPedido.map(item => ({
          pedido_id: editingPedidoId,
          produto_id: item.produto_id,
          quantidade: item.quantidade
        }));

        const { error: insertError } = await supabase
          .from('itens_pedido')
          .insert(itensPayload);

        if (insertError) throw insertError;

      } else {
        // 1. Inserir Cabeçalho do Pedido
        const { data: pedidoData, error: pedidoError } = await supabase
          .from('pedidos')
          .insert({
            cliente_nome: novoCliente,
            data_entrega: novaDataEntrega,
            status: 'Pendente',
            data_pedido: new Date().toISOString()
          })
          .select()
          .single();

        if (pedidoError) throw pedidoError;

        // 2. Inserir Itens do Pedido
        const itensPayload = itensNovoPedido.map(item => ({
          pedido_id: pedidoData.id,
          produto_id: item.produto_id,
          quantidade: item.quantidade
        }));

        const { error: itensError } = await supabase
          .from('itens_pedido')
          .insert(itensPayload);

        if (itensError) throw itensError;
      }

      // Sucesso
      setIsModalOpen(false);
      setNovoCliente('');
      setNovaDataEntrega('');
      setItensNovoPedido([]);
      setIsEditMode(false);
      setEditingPedidoId(null);
      fetchData(); // Sincronização automática
    } catch (err) {
      console.error("Erro ao salvar pedido:", err);
      alert("Falha ao registrar pedido industrial.");
    } finally {
      setSaving(false);
    }
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p =>
      p.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [pedidos, searchTerm]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* Nexus Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#141414] p-8 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-[#facc15] p-4 rounded-2xl shadow-[0_0_20px_rgba(250,204,21,0.2)]">
            <ShoppingCart className="text-black w-7 h-7" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Carteira de Demandas</h2>
            <p className="text-[#facc15] text-[10px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" /> Sincronização Inteligente NEXUS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="relative bg-white/5 rounded-2xl border border-white/5 focus-within:border-[#facc15]/50 transition-all">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Localizar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-3 bg-transparent rounded-2xl outline-none text-xs font-black text-white w-64 uppercase tracking-widest"
            />
          </div>
          <button
            onClick={() => {
              setIsEditMode(false);
              setEditingPedidoId(null);
              setNovoCliente('');
              setNovaDataEntrega('');
              setItensNovoPedido([]);
              setIsModalOpen(true);
            }}
            className="px-8 py-3 bg-[#facc15] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            Novo Pedido
          </button>
        </div>
      </div>

      {/* ⚠️ NEXUS STOCK // SALDO REAL */}
      <section className="bg-black/40 border border-white/5 rounded-[32px] p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-4 h-4 text-[#facc15]" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Nexus Stock // Saldo Acumulado Histórico</h3>
        </div>

        <div className="nexus-horizontal-scroll">
          {produtos.map(prod => {
            const m = inventoryMetrics[prod.id] || { currentStock: 0, pendingDemand: 0, forecast: 0 };
            const isWarning = m.forecast < 0;
            const isCritical = m.currentStock < m.pendingDemand;

            return (
              <div
                key={prod.id}
                className={`nexus-stock-card bg-[#0d0d0d] border ${isWarning ? 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'border-white/5'} rounded-2xl p-5 flex flex-col justify-between group hover:border-[#facc15]/20 transition-all relative overflow-hidden`}
              >
                {isWarning && <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 animate-pulse" />}
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-black uppercase tracking-widest truncate max-w-[170px] ${isWarning ? 'text-rose-400' : 'text-slate-500'}`}>
                    {prod.nome}
                  </span>
                  <button
                    onClick={() => { setEditingStock(prod); setAdjustmentValue(m.currentStock); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-[#facc15] transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-baseline gap-1 my-4">
                  <span className={`text-2xl font-black tracking-tighter ${isCritical ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                    {m.currentStock.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[8px] font-bold text-slate-600 uppercase">UN DISP.</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.03] pt-4 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Fila Demandas</span>
                    <span className="text-[10px] font-black text-blue-400">{m.pendingDemand.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Saldo Pós-Fila</span>
                    <span className={`text-[10px] font-black ${m.forecast < 0 ? 'text-rose-500 font-black' : 'text-emerald-500'}`}>
                      {m.forecast >= 0 ? '+' : ''}{m.forecast.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Grid de Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredPedidos.map((ped) => {
          const totalRequisitado = ped.itens_pedido?.reduce((a: number, b: any) => a + (Number(b.quantidade) || 0), 0) || 0;
          const totalDisponivel = ped.itens_pedido?.reduce((acc: number, item: any) => {
            return acc + getProducaoParaPedido(item.produto_id);
          }, 0) || 0;

          const progresso = totalRequisitado > 0 ? Math.min(100, (totalDisponivel / totalRequisitado) * 100) : 0;
          const estaPronto = progresso >= 100;

          return (
            <div key={ped.id} className="bg-[#141414] rounded-[32px] p-8 border border-white/5 group hover:border-[#facc15]/30 transition-all duration-500 relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[9px] font-mono text-slate-600 font-bold mb-1 block tracking-widest">REF: {ped.id.slice(0, 8).toUpperCase()}</span>
                  <h5 className="text-xl font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{ped.cliente_nome}</h5>
                </div>
                <div className="flex gap-2">
                  <div className={`px-4 py-1.5 rounded-lg text-[9px] font-black border uppercase tracking-widest ${ped.status === 'Finalizado' ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20' : 'bg-[#facc15]/10 text-[#facc15] border-[#facc15]/20'}`}>
                    {ped.status}
                  </div>
                  <button
                    onClick={() => handleDeletePedido(ped.id)}
                    className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => prepararEdicao(ped)}
                    className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="mb-8 space-y-3">
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                  <span className={estaPronto ? 'text-[#22c55e] flex items-center gap-1' : 'text-slate-500'}>
                    {estaPronto ? <><CheckCircle className="w-3 h-3" /> Carga Validada</> : 'Processamento Industrial'}
                  </span>
                  <span className="text-white">{progresso.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full transition-all duration-1000 ${estaPronto ? 'bg-[#22c55e] shadow-[0_0_10px_#22c55e]' : 'bg-[#facc15] shadow-[0_0_10px_#facc15]'}`}
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Previsão Entrega</span>
                  <div className="text-white font-black text-xs">{new Date(ped.data_entrega).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Total Requisitado</span>
                  <div className="text-[#facc15] font-black text-xs">{totalRequisitado.toLocaleString('pt-BR')} <span className="text-[8px] text-slate-500">UN</span></div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPedido(ped)}
                className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-[#facc15] transition-all group-hover:shadow-[0_0_30px_rgba(250,204,21,0.2)]"
              >
                Detalhes & Saldo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 🌑 MODAL: NOVO PEDIDO (DESIGN NEXUS) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => !saving && setIsModalOpen(false)} />
          <div className="bg-[#141414] rounded-[40px] shadow-2xl w-full max-w-2xl relative z-10 border border-[#facc15]/20 overflow-hidden animate-in zoom-in-95">
            <header className="px-10 py-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-[#facc15] rounded-2xl shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                  <ShoppingCart className="w-8 h-8 text-black" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                    {isEditMode ? 'Editar Pedido' : 'Novo Pedido'}
                  </h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" />
                    {isEditMode ? `Pedido REF: ${editingPedidoId?.slice(0, 8).toUpperCase()}` : 'Entrada de Demanda Industrial'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-10 h-10" /></button>
            </header>

            <div className="p-10 space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar">
              {/* Contexto do Pedido */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <User className="w-3 h-3" /> Cliente Final
                  </label>
                  <input
                    type="text"
                    placeholder="NOME DO CLIENTE..."
                    value={novoCliente}
                    onChange={(e) => setNovoCliente(e.target.value)}
                    className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-white outline-none focus:border-[#facc15]/50 transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Prazo de Entrega
                  </label>
                  <input
                    type="date"
                    value={novaDataEntrega}
                    onChange={(e) => setNovaDataEntrega(e.target.value)}
                    className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-xs font-black text-white outline-none focus:border-[#facc15]/50 transition-all uppercase"
                  />
                </div>
              </div>

              {/* Seção de Adição de Itens */}
              <div className="bg-black/40 border border-white/5 rounded-[32px] p-8 space-y-6">
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                  <Package className="w-4 h-4 text-[#facc15]" /> Grade de SKUs Requisitados
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <div className="sm:col-span-3">
                    <select
                      value={tempProdutoId}
                      onChange={(e) => setTempProdutoId(e.target.value)}
                      style={{ backgroundColor: '#1a1a1a', color: 'white' }}
                      className="w-full p-4 border border-white/10 rounded-xl text-[10px] font-black outline-none focus:border-[#facc15]/50 transition-all"
                    >
                      <option value="" style={{ backgroundColor: '#1a1a1a', color: 'white' }}>SELECIONE O PRODUTO...</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id} style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <input
                      type="number"
                      placeholder="QTD"
                      value={tempQuantidade || ''}
                      onChange={(e) => setTempQuantidade(Number(e.target.value))}
                      className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white outline-none text-center focus:border-[#facc15]/50 transition-all"
                    />
                  </div>
                  <button
                    onClick={adicionarItemAoPedido}
                    className="bg-[#facc15] text-black rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Lista de Itens Temporários */}
                <div className="space-y-2 mt-6">
                  {itensNovoPedido.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl group">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-500">{idx + 1}</div>
                        <span className="text-[10px] font-black text-white uppercase">{item.nome}</span>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-[11px] font-black text-[#facc15]">{item.quantidade.toLocaleString('pt-BR')} <span className="text-[8px] text-slate-500">UN</span></span>
                        <button onClick={() => removerItemDoPedido(idx)} className="text-slate-700 hover:text-rose-500 transition-colors">
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {itensNovoPedido.length === 0 && (
                    <div className="py-10 text-center border border-dashed border-white/10 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Aguardando composição da carga...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <footer className="px-10 py-10 bg-black/60 border-t border-white/5 flex gap-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-5 border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarNovoPedido}
                disabled={saving || itensNovoPedido.length === 0}
                className="flex-[2] py-5 bg-[#facc15] text-black rounded-3xl text-[10px] font-black uppercase tracking-[0.4em] transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_40px_rgba(250,204,21,0.2)] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                {saving ? 'Gravando...' : 'Finalizar Pedido'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Inteligente de Saldo (Visualização de Detalhes) */}
      {selectedPedido && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedPedido(null)} />
          <div className="bg-[#141414] rounded-[40px] shadow-2xl w-full max-w-4xl relative z-10 border border-white/10 overflow-hidden animate-in zoom-in-95">
            <header className="px-10 py-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-[#facc15] rounded-2xl"><Package className="w-8 h-8 text-black" /></div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{selectedPedido.cliente_nome}</h3>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Validação de Saldo Industrial Consolidado</p>
                </div>
              </div>
              <button onClick={() => setSelectedPedido(null)} className="p-4 text-slate-500 hover:text-white transition-colors"><X className="w-10 h-10" /></button>
            </header>

            <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <h6 className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                  <Box className="w-4 h-4 text-[#facc15]" /> Cruzamento de Saldo por SKU
                </h6>
                <div className="border border-white/5 rounded-[32px] overflow-hidden bg-black/40">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 text-[9px] text-slate-500 font-black uppercase tracking-widest border-b border-white/5">
                      <tr>
                        <th className="px-8 py-5">Ativo SKU</th>
                        <th className="px-8 py-5 text-center">Requisitado (Pedido)</th>
                        <th className="px-8 py-5 text-center">Produzido (Acumulado)</th>
                        <th className="px-8 py-5 text-right">Prontidão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[11px] text-slate-400">
                      {selectedPedido.itens_pedido?.map((item: any, idx: number) => {
                        const produzido = getProducaoParaPedido(item.produto_id);
                        const pronto = produzido >= item.quantidade;
                        return (
                          <tr key={idx} className={pronto ? 'bg-[#22c55e]/5' : 'bg-transparent'}>
                            <td className="px-8 py-5 font-black text-white uppercase">{item.produtos?.nome || 'SKU'}</td>
                            <td className="px-8 py-5 text-center font-bold">{item.quantidade.toLocaleString('pt-BR')}</td>
                            <td className="px-8 py-5 text-center font-black text-[#facc15] text-lg">{produzido.toLocaleString('pt-BR')}</td>
                            <td className="px-8 py-5 text-right">
                              {pronto ? (
                                <span className="text-[#22c55e] font-black uppercase text-[10px] flex items-center justify-end gap-2">OK <CheckCircle className="w-4 h-4" /></span>
                              ) : (
                                <span className="text-slate-600 font-black uppercase text-[10px] flex items-center justify-end gap-2">FALTANDO <AlertTriangle className="w-4 h-4" /></span>
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

            <footer className="px-10 py-10 bg-black/60 border-t border-white/5 flex gap-6">
              <button onClick={() => setSelectedPedido(null)} className="flex-1 py-5 border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Fechar Painel</button>
              {(() => {
                const todosProntos = selectedPedido.itens_pedido?.every((item: any) => getProducaoParaPedido(item.produto_id) >= item.quantidade);
                return (
                  <button
                    onClick={() => handleFinalizarPedido(selectedPedido.id)}
                    disabled={saving || selectedPedido.status === 'Finalizado' || !todosProntos}
                    className={`flex-[2] py-5 rounded-3xl text-[10px] font-black uppercase tracking-[0.4em] transition-all ${todosProntos && selectedPedido.status !== 'Finalizado'
                      ? 'bg-[#22c55e] text-black shadow-[0_0_40px_rgba(34,197,94,0.3)] hover:scale-[1.02]'
                      : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                      }`}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (todosProntos ? 'Finalizar Pedido' : 'Saldo Insuficiente')}
                  </button>
                );
              })()}
            </footer>
          </div>
        </div>
      )}

      {/* Modal de Ajuste Rápido (Somente Visualização do Saldo Real Nexus) */}
      {editingStock && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => !saving && setEditingStock(null)} />
          <div className="bg-[#0d0d0d] rounded-[40px] shadow-2xl w-full max-w-md relative z-10 border border-[#facc15]/20 flex flex-col p-10 animate-in zoom-in-95">
            <header className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#facc15] rounded-2xl">
                  <Database className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Inventário Nexus</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{editingStock.nome}</p>
                </div>
              </div>
              <button onClick={() => setEditingStock(null)} className="text-slate-600 hover:text-white transition-colors">
                <X className="w-8 h-8" />
              </button>
            </header>

            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Acumulado Real</label>
                <div className="py-8 bg-white/5 rounded-3xl border border-white/10">
                  <span className="text-5xl font-black text-white">{adjustmentValue.toLocaleString('pt-BR')}</span>
                  <p className="text-[9px] font-bold text-slate-500 uppercase mt-2 tracking-widest">Unidades Disponíveis</p>
                </div>
              </div>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest leading-relaxed px-4">
                Sincronizado via Chão de Fábrica. O saldo reflete a soma histórica absoluta da produção subtraída apenas de pedidos finalizados.
              </p>
            </div>

            <footer className="mt-10 flex gap-4">
              <button
                onClick={() => setEditingStock(null)}
                className="w-full py-4 bg-[#facc15] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
              >
                <CheckIcon className="w-4 h-4" /> Validado Nexus
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 🚀 CSS INJETADO: Força o Scroll Horizontal e Dimensões Fixas */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .nexus-horizontal-scroll {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          width: 100% !important;
          gap: 16px !important;
          padding: 15px 0 25px 0 !important;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
        }
        
        .nexus-stock-card {
          min-width: 250px !important;
          flex-shrink: 0 !important;
          scroll-snap-align: start;
        }
        
        .nexus-horizontal-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .nexus-horizontal-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .nexus-horizontal-scroll::-webkit-scrollbar-thumb {
          background: rgba(250, 204, 21, 0.3);
          border-radius: 10px;
        }

        /* Correção específica para o seletor de produtos */
        select option {
          background-color: #1a1a1a;
          color: white;
        }
      `}} />
    </div>
  );
};

export default Vendas;
