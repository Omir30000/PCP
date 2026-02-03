
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Produto } from './types/database';
import { 
  Package, 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Save, 
  Loader2, 
  Search,
  Box,
  Droplets,
  Layers,
  Target,
  AlertCircle,
  ChevronRight,
  Settings,
  Waves,
  Zap,
  CupSoda,
  Milk,
  ArrowUpRight,
  Activity
} from 'lucide-react';

const TIPO_CONFIG: Record<string, { bg: string, text: string, shadow: string, icon: React.ReactNode }> = {
  'Natural': { 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-600', 
    shadow: 'shadow-emerald-500/20',
    icon: <Waves className="w-5 h-5" />
  },
  'Gás': { 
    bg: 'bg-orange-500/10', 
    text: 'text-orange-600', 
    shadow: 'shadow-orange-500/20',
    icon: <Zap className="w-5 h-5" />
  },
  'Copo': { 
    bg: 'bg-blue-500/10', 
    text: 'text-blue-600', 
    shadow: 'shadow-blue-500/20',
    icon: <CupSoda className="w-5 h-5" />
  },
  'Lata': { 
    bg: 'bg-purple-500/10', 
    text: 'text-purple-600', 
    shadow: 'shadow-purple-500/20',
    icon: <Box className="w-5 h-5" />
  },
  'Galao': { 
    bg: 'bg-rose-500/10', 
    text: 'text-rose-600', 
    shadow: 'shadow-rose-500/20',
    icon: <Milk className="w-5 h-5" />
  },
  'Padrão': { 
    bg: 'bg-slate-500/10', 
    text: 'text-slate-600', 
    shadow: 'shadow-slate-500/20',
    icon: <Package className="w-5 h-5" />
  }
};

const Produtos: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Produto>>({
    nome: '',
    volume: '',
    tipo: 'Natural',
    unidades_por_fardo: 0,
    fardos_por_palete: 0,
    capacidade_nominal: 0
  });

  const fetchProdutos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');
      if (error) throw error;
      setProdutos(data || []);
    } catch (err) {
      console.error("Erro ao buscar produtos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  const openModal = (produto?: Produto) => {
    if (produto) {
      setFormData(produto);
    } else {
      setFormData({
        nome: '',
        volume: '',
        tipo: 'Natural',
        unidades_por_fardo: 12,
        fardos_por_palete: 84,
        capacidade_nominal: 7200
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let val: string | number = value;
    if (['unidades_por_fardo', 'fardos_por_palete', 'capacidade_nominal'].includes(name)) {
      val = Math.max(0, Number(value));
    }
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('produtos').upsert(formData as any);
      if (error) throw error;
      closeModal();
      fetchProdutos();
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este ativo do catálogo?")) return;
    try {
      const { error } = await supabase.from('produtos').delete().eq('id', id);
      if (error) throw error;
      fetchProdutos();
    } catch (err) {
      alert("Erro ao excluir: verifique registros vinculados.");
    }
  };

  const filteredProdutos = produtos.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.tipo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 w-full max-w-[98%] mx-auto font-sans">
      
      {/* Header Glassmorphism & Smart Search */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white/70 backdrop-blur-xl p-8 rounded-[40px] border border-white/20 shadow-2xl shadow-slate-200/50 w-full relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/30 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-slate-900 p-4 rounded-[28px] shadow-2xl shadow-slate-400/20 shrink-0">
            <Package className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">Catálogo de SKUs</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Ativos Industriais Homologados
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 w-full lg:w-auto relative z-10 items-stretch sm:items-center">
          <div className="relative group bg-white/40 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm focus-within:shadow-md transition-all">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500" />
            <input 
              type="text" 
              placeholder="Localizar ativo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-14 pr-6 py-3 bg-transparent rounded-2xl outline-none text-xs font-black w-full sm:w-64 lg:w-80 uppercase tracking-widest placeholder:text-slate-300"
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-full flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-slate-200 hover:shadow-blue-200/50 hover:scale-[1.05] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Cadastrar SKU
          </button>
        </div>
      </div>

      {/* Grid de Cards (Vitrine Industrial) */}
      <div className="space-y-4 w-full">
        {loading ? (
          <div className="py-48 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-12 h-12 animate-spin mb-6 text-blue-500" />
            <span className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">Sincronizando Catálogo...</span>
          </div>
        ) : filteredProdutos.length > 0 ? (
          filteredProdutos.map((p) => {
            const config = TIPO_CONFIG[p.tipo || 'Padrão'] || TIPO_CONFIG['Padrão'];
            return (
              <div 
                key={p.id} 
                className="group bg-white/80 backdrop-blur-md p-6 md:p-8 rounded-[36px] border border-white transition-all duration-500 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_25px_60px_rgba(37,99,235,0.08)] hover:border-blue-100/50 flex flex-col xl:flex-row items-center gap-8 md:gap-12 relative overflow-hidden"
              >
                {/* Background Decorativo */}
                <div className={`absolute -right-20 -bottom-20 w-64 h-64 ${config.bg} rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                {/* Bloco de Identificação */}
                <div className="flex items-center gap-6 w-full xl:w-1/3 shrink-0">
                  <div className={`w-20 h-20 rounded-[28px] ${config.bg} ${config.text} flex items-center justify-center shadow-lg ${config.shadow} shrink-0 group-hover:scale-110 transition-transform duration-500`}>
                    {React.isValidElement(config.icon) ? (
                      React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-10 h-10' })
                    ) : (
                      <Package className="w-10 h-10" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter leading-tight truncate">
                      {p.nome}
                    </h3>
                    <div className="flex items-center gap-2">
                       <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${config.bg} ${config.text}`}>
                          {p.tipo || 'COMUM'}
                       </span>
                    </div>
                  </div>
                </div>

                {/* Bloco de Métricas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12 w-full xl:flex-1 items-center px-4">
                  
                  {/* Litragem */}
                  <div className="flex items-center gap-4 group/item">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-400 group-hover/item:bg-blue-600 group-hover/item:text-white transition-all">
                      <Droplets className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Litragem</span>
                      <span className="text-base font-black text-slate-700 tracking-tight">{p.volume || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Logística de Pack */}
                  <div className="flex items-center gap-4 group/item">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:bg-slate-900 group-hover/item:text-white transition-all">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Pack / Palete</span>
                      <span className="text-base font-black text-slate-700 tracking-tight">
                        {p.unidades_por_fardo}u • {p.fardos_por_palete}p
                      </span>
                    </div>
                  </div>

                  {/* Meta Nominal */}
                  <div className="flex items-center gap-5 group/item">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover/item:bg-emerald-500 group-hover/item:text-white transition-all shadow-sm">
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Meta Nominal (8h)</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-emerald-600 tracking-tighter">
                          {p.capacidade_nominal?.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">un</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Bloco de Ações */}
                <div className="flex items-center gap-3 w-full xl:w-auto xl:opacity-0 group-hover:opacity-100 transition-all duration-300 justify-end">
                  <button 
                    onClick={() => openModal(p)} 
                    className="p-4 bg-white hover:bg-blue-600 hover:text-white text-slate-400 rounded-2xl border border-slate-100 shadow-sm transition-all active:scale-95"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)} 
                    className="p-4 bg-white hover:bg-red-500 hover:text-white text-slate-400 rounded-2xl border border-slate-100 shadow-sm transition-all active:scale-95"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="xl:hidden w-10 h-10 flex items-center justify-center">
                    <ChevronRight className="w-6 h-6 text-slate-200" />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-40 text-center bg-white/50 backdrop-blur-sm rounded-[40px] border border-dashed border-slate-200">
             <Box className="w-16 h-16 text-slate-100 mx-auto mb-6" />
             <p className="text-slate-300 font-black uppercase tracking-[0.3em] text-sm">Catálogo de SKUs Vazio</p>
          </div>
        )}
      </div>

      {/* Modal Glassmorphism Overhaul */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500" onClick={closeModal} />
          
          <div className="bg-white/90 backdrop-blur-2xl rounded-[56px] shadow-[0_50px_100px_rgba(0,0,0,0.15)] w-full max-w-2xl relative z-10 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[92vh] border border-white/50">
            <header className="px-10 py-10 border-b border-slate-100/50 flex items-center justify-between bg-slate-50/20">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-slate-900 rounded-[28px] text-white shadow-2xl shadow-slate-900/30">
                  <Settings className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                    {formData.id ? 'Ajuste de Ativo' : 'Cadastro Mestre'}
                  </h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Especificações Técnicas SKU
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="p-4 text-slate-300 hover:text-slate-600 hover:bg-white rounded-full transition-all">
                <X className="w-10 h-10" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="p-10 md:p-12 space-y-10 overflow-y-auto no-scrollbar">
              <div className="space-y-10">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">Nome Comercial do Produto</label>
                  <input 
                    type="text" 
                    name="nome" 
                    value={formData.nome} 
                    onChange={handleInputChange} 
                    className="w-full p-6 bg-white border border-slate-100 rounded-[32px] outline-none focus:ring-8 focus:ring-blue-100 transition-all font-black text-slate-700 text-lg shadow-sm" 
                    placeholder="Ex: Água Mineral 510ml Natural" 
                    required 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">Volume / Litragem</label>
                    <div className="relative">
                       <Droplets className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                       <input type="text" name="volume" value={formData.volume || ''} onChange={handleInputChange} className="w-full pl-14 pr-6 py-5 bg-white border border-slate-100 rounded-[28px] outline-none font-black text-slate-700 shadow-sm" placeholder="510ml" required />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] ml-3">Categoria Operacional</label>
                    <select name="tipo" value={formData.tipo || 'Natural'} onChange={handleInputChange} className="w-full p-5 bg-white border border-slate-100 rounded-[28px] outline-none font-black text-slate-700 shadow-sm cursor-pointer appearance-none">
                      <option value="Natural">Natural</option>
                      <option value="Gás">Com Gás</option>
                      <option value="Copo">Copos</option>
                      <option value="Lata">Latas</option>
                      <option value="Galao">Galao (20L/10L)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 bg-slate-50/50 p-8 rounded-[40px] border border-slate-100">
                  <div className="space-y-3 text-center sm:text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Unidades p/ Pack</label>
                    <input type="number" name="unidades_por_fardo" value={formData.unidades_por_fardo} onChange={handleInputChange} className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-center font-black text-slate-700 text-xl" required />
                  </div>
                  <div className="space-y-3 text-center sm:text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Packs p/ Palete</label>
                    <input type="number" name="fardos_por_palete" value={formData.fardos_por_palete} onChange={handleInputChange} className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-center font-black text-slate-700 text-xl" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-3">
                    <label className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.4em]">Meta Nominal (Turno 8h)</label>
                    <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
                  </div>
                  <input 
                    type="number" 
                    name="capacidade_nominal" 
                    value={formData.capacidade_nominal} 
                    onChange={handleInputChange} 
                    className="w-full p-8 bg-emerald-500/5 border-4 border-emerald-500/10 rounded-[40px] text-center font-black text-emerald-700 text-5xl tracking-tighter shadow-2xl shadow-emerald-100/50 outline-none focus:ring-[16px] focus:ring-emerald-100 transition-all" 
                    required 
                  />
                  <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest">Base de cálculo para indicador de eficiência OEE</p>
                </div>
              </div>

              <footer className="pt-8 flex gap-6">
                <button type="button" onClick={closeModal} className="flex-1 px-8 py-5 rounded-[28px] border border-slate-200 font-black uppercase text-[11px] tracking-[0.3em] text-slate-400 hover:bg-slate-50 transition-all">Sair</button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="flex-[2] bg-slate-900 text-white px-8 py-5 rounded-[28px] flex items-center justify-center gap-4 font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl shadow-slate-400/30 hover:bg-blue-600 transition-all active:scale-95"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {saving ? 'Gravando...' : 'Salvar Especificações'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Produtos;
