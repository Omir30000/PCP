
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Produto, Linha } from './types/database';
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
  Activity,
  CheckCircle2
} from 'lucide-react';

const TIPO_CONFIG: Record<string, { bg: string, text: string, shadow: string, icon: React.ReactNode }> = {
  'Natural': {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    shadow: 'shadow-emerald-500/20',
    icon: <Waves className="w-5 h-5" />
  },
  'Gás': {
    bg: 'bg-orange-500/10',
    text: 'text-orange-500',
    shadow: 'shadow-orange-500/20',
    icon: <Zap className="w-5 h-5" />
  },
  'Copo': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    shadow: 'shadow-blue-500/20',
    icon: <CupSoda className="w-5 h-5" />
  },
  'Lata': {
    bg: 'bg-purple-500/10',
    text: 'text-purple-500',
    shadow: 'shadow-purple-500/20',
    icon: <Box className="w-5 h-5" />
  },
  'Galao': {
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    shadow: 'shadow-rose-500/20',
    icon: <Milk className="w-5 h-5" />
  },
  'Padrão': {
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
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
  const [linhas, setLinhas] = useState<Linha[]>([]);

  const [formData, setFormData] = useState<Partial<Produto>>({
    nome: '',
    volume: '',
    tipo: 'Natural',
    unidades_por_fardo: 0,
    fardos_por_palete: 0,
    capacidade_nominal: 0,
    linhas_ids: []
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

  const fetchInitialData = async () => {
    fetchProdutos();
    try {
      const { data, error } = await supabase.from('linhas').select('*').order('nome');
      if (error) throw error;
      setLinhas(data || []);
    } catch (err) {
      console.error("Erro ao buscar linhas:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
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
        capacidade_nominal: 7200,
        linhas_ids: []
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

  const toggleLinhaId = (id: string) => {
    const current = formData.linhas_ids || [];
    const updated = current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id];
    setFormData(prev => ({ ...prev, linhas_ids: updated }));
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-slate-900/90 backdrop-blur-md p-8 rounded-2xl border border-white/10 shadow-2xl w-full relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-[#facc15] p-4 rounded-xl shadow-2xl shadow-[#facc15]/20 shrink-0">
            <Package className="w-8 h-8 text-black" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none">Catálogo de SKUs</h2>
            <p className="text-[#facc15] text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#facc15] animate-pulse" /> Ativos Industriais Homologados
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-5 w-full lg:w-auto relative z-10 items-stretch sm:items-center">
          <div className="relative group bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-sm focus-within:border-[#facc15]/50 transition-all">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#facc15]" />
            <input
              type="text"
              placeholder="Localizar ativo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-14 pr-6 py-3 bg-transparent rounded-xl outline-none text-xs font-black w-full sm:w-64 lg:w-80 uppercase tracking-widest text-white placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="bg-[#facc15] text-black px-8 py-3 rounded-xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-[#facc15]/10 hover:scale-[1.05] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Cadastrar SKU
          </button>
        </div>
      </div>

      {/* Grid de Cards (Vitrine Industrial) */}
      <div className="space-y-4 w-full">
        {loading ? (
          <div className="py-48 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-12 h-12 animate-spin mb-6 text-[#facc15]" />
            <span className="text-[11px] font-black uppercase tracking-[0.4em] opacity-40">Sincronizando Catálogo...</span>
          </div>
        ) : filteredProdutos.length > 0 ? (
          filteredProdutos.map((p) => {
            const config = TIPO_CONFIG[p.tipo || 'Padrão'] || TIPO_CONFIG['Padrão'];
            return (
              <div
                key={p.id}
                className="group bg-slate-900/40 backdrop-blur-md p-6 md:p-8 rounded-2xl border border-white/5 transition-all duration-500 shadow-xl hover:shadow-[#facc15]/5 hover:border-[#facc15]/20 flex flex-col xl:flex-row items-center gap-8 md:gap-12 relative overflow-hidden"
              >
                {/* Background Decorativo */}
                <div className={`absolute -right-20 -bottom-20 w-64 h-64 ${config.bg} rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                {/* Bloco de Identificação */}
                <div className="flex items-center gap-6 w-full xl:w-1/3 shrink-0">
                  <div className={`w-20 h-20 rounded-xl ${config.bg} ${config.text} flex items-center justify-center shadow-lg ${config.shadow} shrink-0 group-hover:scale-110 transition-transform duration-500`}>
                    {React.isValidElement(config.icon) ? (
                      React.cloneElement(config.icon as React.ReactElement<any>, { className: 'w-10 h-10' })
                    ) : (
                      <Package className="w-10 h-10" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    <h3 className="text-xl md:text-2xl font-black text-white tracking-tighter leading-tight truncate">
                      {p.nome}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${config.bg} ${config.text}`}>
                        {p.tipo || 'COMUM'}
                      </span>
                      {p.linhas_ids && p.linhas_ids.length > 0 && (
                        <div className="flex items-center gap-1">
                          {p.linhas_ids.map(lId => {
                            const linha = linhas.find(l => l.id === lId);
                            if (!linha) return null;
                            return (
                              <span key={lId} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[8px] font-bold text-slate-400">
                                {linha.nome}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bloco de Métricas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12 w-full xl:flex-1 items-center px-4">

                  {/* Litragem */}
                  <div className="flex items-center gap-4 group/item">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-400 group-hover/item:bg-blue-600 group-hover/item:text-white transition-all">
                      <Droplets className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Litragem</span>
                      <span className="text-base font-black text-white tracking-tight">{p.volume || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Logística de Pack */}
                  <div className="flex items-center gap-4 group/item">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 group-hover/item:bg-white group-hover/item:text-black transition-all">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Pack / Palete</span>
                      <span className="text-base font-black text-white tracking-tight">
                        {p.unidades_por_fardo}u • {p.fardos_por_palete}p
                      </span>
                    </div>
                  </div>

                  {/* Meta Nominal */}
                  <div className="flex items-center gap-5 group/item">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover/item:bg-emerald-500 group-hover/item:text-white transition-all shadow-sm">
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">Meta Nominal (8h)</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-emerald-500 tracking-tighter">
                          {p.capacidade_nominal?.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">un</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Bloco de Ações */}
                <div className="flex items-center gap-3 w-full xl:w-auto xl:opacity-0 group-hover:opacity-100 transition-all duration-300 justify-end">
                  <button
                    onClick={() => openModal(p)}
                    className="p-4 bg-white/5 hover:bg-blue-600 hover:text-white text-slate-500 rounded-xl border border-white/5 shadow-sm transition-all active:scale-95"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-4 bg-white/5 hover:bg-red-500 hover:text-white text-slate-500 rounded-xl border border-white/5 shadow-sm transition-all active:scale-95"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="xl:hidden w-10 h-10 flex items-center justify-center">
                    <ChevronRight className="w-6 h-6 text-slate-700" />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-40 text-center bg-slate-900/40 backdrop-blur-md rounded-2xl border border-dashed border-white/10">
            <Box className="w-16 h-16 text-slate-800 mx-auto mb-6" />
            <p className="text-slate-600 font-black uppercase tracking-[0.3em] text-sm">Catálogo de SKUs Vazio</p>
          </div>
        )}
      </div>

      {/* Modal Glassmorphism Overhaul */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-500" onClick={closeModal} />

          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[92vh] border border-white/10">
            <header className="px-10 py-10 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-6">
                <div className="p-4 bg-[#facc15] rounded-xl text-black shadow-2xl shadow-[#facc15]/30">
                  <Settings className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                    {formData.id ? 'Ajuste de Ativo' : 'Cadastro Mestre'}
                  </h3>
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#facc15]" /> Especificações Técnicas SKU
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="p-4 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
                <X className="w-10 h-10" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="p-10 md:p-12 space-y-10 overflow-y-auto no-scrollbar">
              <div className="space-y-10">
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-3">Nome Comercial do Produto</label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    className="w-full p-6 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-[#facc15]/50 transition-all font-black text-white text-lg shadow-sm"
                    placeholder="Ex: Água Mineral 510ml Natural"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-3">Volume / Litragem</label>
                    <div className="relative">
                      <Droplets className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                      <input type="text" name="volume" value={formData.volume || ''} onChange={handleInputChange} className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-xl outline-none font-black text-white shadow-sm" placeholder="510ml" required />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-3">Categoria Operacional</label>
                    <select name="tipo" value={formData.tipo || 'Natural'} onChange={handleInputChange} className="w-full p-5 bg-white/5 border border-white/10 rounded-xl outline-none font-black text-white shadow-sm cursor-pointer appearance-none">
                      <option value="Natural" className="bg-slate-900">Natural</option>
                      <option value="Gás" className="bg-slate-900">Com Gás</option>
                      <option value="Copo" className="bg-slate-900">Copos</option>
                      <option value="Lata" className="bg-slate-900">Latas</option>
                      <option value="Galao" className="bg-slate-900">Galao (20L/10L)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 bg-black/20 p-8 rounded-2xl border border-white/5">
                  <div className="space-y-3 text-center sm:text-left">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Unidades p/ Pack</label>
                    <input type="number" name="unidades_por_fardo" value={formData.unidades_por_fardo} onChange={handleInputChange} className="w-full p-5 bg-white/5 border border-white/10 rounded-xl text-center font-black text-white text-xl" required />
                  </div>
                  <div className="space-y-3 text-center sm:text-left">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Packs p/ Palete</label>
                    <input type="number" name="fardos_por_palete" value={formData.fardos_por_palete} onChange={handleInputChange} className="w-full p-5 bg-white/5 border border-white/10 rounded-xl text-center font-black text-white text-xl" required />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-3">
                    <label className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.4em]">Meta Nominal (Turno 8h)</label>
                    <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
                  </div>
                  <input
                    type="number"
                    name="capacidade_nominal"
                    value={formData.capacidade_nominal}
                    onChange={handleInputChange}
                    className="w-full p-8 bg-emerald-500/5 border-4 border-emerald-500/10 rounded-2xl text-center font-black text-emerald-500 text-5xl tracking-tighter shadow-2xl shadow-emerald-500/5 outline-none focus:border-emerald-500 transition-all"
                    required
                  />
                  <p className="text-[9px] text-center font-bold text-slate-600 uppercase tracking-widest">Base de cálculo para indicador de eficiência OEE</p>
                </div>

                {/* Associação de Linhas */}
                <div className="space-y-6 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between ml-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Instalações / Linhas Autorizadas</label>
                    <Layers className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {linhas.map(linha => {
                      const isSelected = formData.linhas_ids?.includes(linha.id);
                      return (
                        <label
                          key={linha.id}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group/linha ${
                            isSelected 
                              ? 'bg-[#facc15]/10 border-[#facc15]/30 text-[#facc15]' 
                              : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={isSelected}
                              onChange={() => toggleLinhaId(linha.id)}
                            />
                            <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-[#facc15] border-[#facc15] text-black shadow-lg shadow-[#facc15]/20' 
                                : 'border-white/10 bg-black/20 group-hover/linha:border-white/30'
                            }`}>
                              {isSelected && <CheckCircle2 className="w-4 h-4" />}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isSelected ? 'text-white' : ''}`}>
                              {linha.nome}
                            </span>
                          </div>
                          {isSelected && <Plus className="w-3 h-3 animate-pulse" />}
                        </label>
                      );
                    })}
                  </div>
                  {(!formData.linhas_ids || formData.linhas_ids.length === 0) && (
                    <div className="flex items-center gap-3 px-6 py-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">Aviso: Este produto não aparecerá em nenhuma linha até ser associado.</p>
                    </div>
                  )}
                </div>
              </div>

              <footer className="pt-8 flex gap-6">
                <button type="button" onClick={closeModal} className="flex-1 px-8 py-5 rounded-xl border border-white/10 font-black uppercase text-[11px] tracking-[0.3em] text-slate-500 hover:text-white hover:bg-white/5 transition-all">Sair</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] bg-[#facc15] text-black px-8 py-5 rounded-xl flex items-center justify-center gap-4 font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl shadow-[#facc15]/10 hover:scale-[1.02] transition-all active:scale-95"
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
