import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  Users,
  Package,
  TrendingUp,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  ListChecks,
  BarChart3
} from 'lucide-react';

const COLORS = ['#facc15', '#10b981', '#3b82f6', '#f43f5e', '#a78bfa'];

const DashboardVendas: React.FC = () => {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
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

      const [pedidosRes, itensRes, produtosRes] = await Promise.all([
        supabase.from('pedidos').select('*').gte('data_pedido', inicio).lte('data_pedido', fim).order('data_pedido', { ascending: false }),
        supabase.from('itens_pedido').select('*'),
        supabase.from('produtos').select('*').order('nome'),
      ]);

      if (pedidosRes.error) throw pedidosRes.error;
      if (itensRes.error) throw itensRes.error;
      if (produtosRes.error) throw produtosRes.error;

      setPedidos(pedidosRes.data || []);
      setItens(itensRes.data || []);
      setProdutos(produtosRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar dashboard vendas:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPedidos = pedidos.length;
  const pendentes = pedidos.filter(p => p.status === 'Pendente').length;
  const finalizados = pedidos.filter(p => p.status === 'Finalizado').length;
  const entregues = pedidos.filter(p => p.status === 'Entregue').length;
  const totalClientes = new Set(pedidos.map(p => p.cliente_nome)).size;

  const statusData = [
    { name: 'Pendentes', value: pendentes, color: '#facc15' },
    { name: 'Finalizados', value: finalizados, color: '#10b981' },
    { name: 'Entregues', value: entregues, color: '#3b82f6' },
    { name: 'Cancelados', value: pedidos.filter(p => p.status === 'Cancelado').length, color: '#f43f5e' },
  ].filter(d => d.value > 0);

  const diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const chartData = diasSemana.map((dia, i) => {
    const data = new Date(semana.inicio + 'T00:00:00');
    data.setDate(data.getDate() + i);
    const dataStr = data.toISOString().split('T')[0];
    return {
      dia,
      Pedidos: pedidos.filter(p => p.data_pedido === dataStr).length,
      Entregas: pedidos.filter(p => p.data_entrega === dataStr).length,
    };
  });

  const topProdutos = itens.reduce((acc: any[], item) => {
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
  }, []).sort((a: any, b: any) => b.qtd - a.qtd).slice(0, 5);

  const recentes = pedidos.slice(0, 10);

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
              <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tighter leading-none">Dashboard Vendas</h2>
              <p className="text-slate-400 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" /> {totalPedidos} Pedidos · {totalClientes} Clientes
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#facc15]/10 rounded-xl"><ShoppingCart className="w-4 h-4 text-[#facc15]" /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Pedidos</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white">{totalPedidos}</p>
        </div>
        <div className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#facc15]/10 rounded-xl"><Clock className="w-4 h-4 text-[#facc15]" /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pendentes</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white">{pendentes}</p>
        </div>
        <div className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#10b981]/10 rounded-xl"><CheckCircle2 className="w-4 h-4 text-[#10b981]" /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Finalizados</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white">{finalizados}</p>
        </div>
        <div className="bg-slate-900/90 backdrop-blur-md p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-white/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-[#3b82f6]/10 rounded-xl"><Users className="w-4 h-4 text-[#3b82f6]" /></div>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Clientes</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white">{totalClientes}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Bar Chart */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#facc15]/10 rounded-xl"><BarChart3 className="w-4 h-4 text-[#facc15]" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Pedidos por Dia</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="dia" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#facc15', fontWeight: 'bold' }}
                />
                <Bar dataKey="Pedidos" fill="#facc15" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Entregas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#facc15]" /><span className="text-[9px] font-bold text-slate-400 uppercase">Pedidos</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#10b981]" /><span className="text-[9px] font-bold text-slate-400 uppercase">Entregas</span></div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#facc15]/10 rounded-xl"><ListChecks className="w-4 h-4 text-[#facc15]" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Status dos Pedidos</h3>
          </div>
          <div className="h-64 flex items-center justify-center">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={4}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: '#facc15', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-[10px] font-bold uppercase">Nenhum pedido encontrado</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/5">
            {statusData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                <span className="text-[9px] font-bold text-slate-400 uppercase">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Products */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#facc15]/10 rounded-xl"><Package className="w-4 h-4 text-[#facc15]" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Produtos Mais Vendidos</h3>
          </div>
          <div className="space-y-3">
            {topProdutos.map((prod, i) => (
              <div key={prod.produto_id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-[#facc15] text-[10px] font-black">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-xs font-bold text-white uppercase">{prod.nome}</p>
                  </div>
                </div>
                <span className="text-[#facc15] text-[10px] font-black">{prod.qtd} un</span>
              </div>
            ))}
            {topProdutos.length === 0 && (
              <p className="text-slate-500 text-[10px] font-bold uppercase text-center py-8">Nenhum produto vendido</p>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#facc15]/10 rounded-xl"><ShoppingCart className="w-4 h-4 text-[#facc15]" /></div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Últimos Pedidos</h3>
          </div>
          <div className="space-y-2 max-h-[320px] overflow-y-auto no-scrollbar">
            {recentes.map(ped => (
              <div key={ped.id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-white uppercase truncate">{ped.cliente_nome}</p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">{ped.data_entrega ? new Date(ped.data_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'}</p>
                </div>
                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded border ml-3 ${
                  ped.status === 'Finalizado' ? 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10' :
                  ped.status === 'Entregue' ? 'text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/10' :
                  ped.status === 'Cancelado' ? 'text-[#f43f5e] border-[#f43f5e]/30 bg-[#f43f5e]/10' :
                  'text-[#facc15] border-[#facc15]/30 bg-[#facc15]/10'
                }`}>{ped.status}</span>
              </div>
            ))}
            {recentes.length === 0 && (
              <p className="text-slate-500 text-[10px] font-bold uppercase text-center py-8">Nenhum pedido ainda</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardVendas;
