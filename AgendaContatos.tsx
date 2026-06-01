
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { 
  Phone, 
  User, 
  Mail, 
  Tag, 
  Search, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  Loader2, 
  MessageSquare,
  Building2,
  Users,
  Star,
  FileText
} from 'lucide-react';
import { useToast } from './lib/toast';

interface Contato {
  id: string;
  nome: string;
  apelido: string | null;
  telefone: string;
  email: string | null;
  categoria: string;
  observacoes: string | null;
  foto_url: string | null;
}

const CATEGORIAS = ['Geral', 'Manutenção', 'Fornecedor', 'Operador', 'Diretoria', 'PCP', 'Logística'];

const AgendaContatos: React.FC = () => {
  const { toast } = useToast();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  
  // Estados para o Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContato, setEditingContato] = useState<Contato | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    apelido: '',
    telefone: '',
    email: '',
    categoria: 'Geral',
    observacoes: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchContatos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contatos')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      setContatos(data || []);
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContatos();
  }, []);

  const handleOpenModal = (contato?: Contato) => {
    if (contato) {
      setEditingContato(contato);
      setFormData({
        nome: contato.nome,
        apelido: contato.apelido || '',
        telefone: contato.telefone,
        email: contato.email || '',
        categoria: contato.categoria,
        observacoes: contato.observacoes || ''
      });
    } else {
      setEditingContato(null);
      setFormData({
        nome: '',
        apelido: '',
        telefone: '',
        email: '',
        categoria: 'Geral',
        observacoes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingContato) {
        const { error } = await supabase
          .from('contatos')
          .update(formData)
          .eq('id', editingContato.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contatos')
          .insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchContatos();
    } catch (err) {
      console.error('Erro ao salvar contato:', err);
      toast('Erro ao salvar contato', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;
    try {
      const { error } = await supabase
        .from('contatos')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchContatos();
    } catch (err) {
      console.error('Erro ao excluir contato:', err);
      toast('Erro ao excluir contato', 'error');
    }
  };

  const contatosFiltrados = useMemo(() => {
    return contatos.filter(c => {
      const matchBusca = 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.apelido?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        c.telefone.includes(searchTerm);
      
      const matchCategoria = filtroCategoria === 'Todas' || c.categoria === filtroCategoria;
      
      return matchBusca && matchCategoria;
    });
  }, [contatos, searchTerm, filtroCategoria]);

  const openWhatsApp = (telefone: string) => {
    const cleanNumber = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanNumber}`, '_blank');
  };

  if (loading && contatos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-[#facc15] mb-4" />
        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Carregando Agenda Nexus...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header e Busca */}
      <div className="bg-slate-900/90 backdrop-blur-md p-8 rounded-[32px] border border-white/10 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-[#facc15] rounded-2xl text-black shadow-lg shadow-[#facc15]/20">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Agenda Nexus</h1>
              <p className="text-[10px] font-black text-[#facc15] uppercase tracking-[0.3em] mt-2">Central de Comunicação Industrial</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="BUSCAR NOME, APELIDO OU TEL..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border-2 border-white/5 rounded-xl py-3 pl-12 pr-4 text-[11px] font-black text-white placeholder:text-slate-600 focus:border-[#facc15]/50 outline-none transition-all"
              />
            </div>

            <select 
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="bg-white/5 border-2 border-white/5 p-3 rounded-xl text-[10px] font-black uppercase text-white outline-none cursor-pointer hover:border-white/10 transition-all"
            >
              <option value="Todas" className="bg-slate-900">Todas Categorias</option>
              {CATEGORIAS.map(cat => (
                <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
              ))}
            </select>

            <button 
              onClick={() => handleOpenModal()}
              className="w-full sm:w-auto px-6 py-3 bg-[#facc15] text-black rounded-xl text-[11px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#facc15]/20"
            >
              <Plus className="w-4 h-4" /> Novo Contato
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Contatos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {contatosFiltrados.map(contato => (
          <div key={contato.id} className="group bg-[#141414] border border-white/5 p-6 rounded-[32px] hover:border-[#facc15]/30 transition-all duration-500 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-2">
                <button 
                  onClick={() => handleOpenModal(contato)}
                  className="p-2 bg-white/5 text-slate-400 hover:text-[#facc15] rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(contato.id)}
                  className="p-2 bg-white/5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl font-black text-[#facc15] border border-white/5 shrink-0 group-hover:scale-110 transition-transform">
                {contato.nome.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white uppercase truncate tracking-tight">{contato.nome}</h3>
                {contato.apelido && (
                  <p className="text-[10px] font-black text-[#facc15] uppercase tracking-widest mt-0.5 italic opacity-80">"{contato.apelido}"</p>
                )}
                <div className="mt-3 inline-flex px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  {contato.categoria}
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-4 group/item">
                <div className="p-2 bg-white/5 rounded-lg text-slate-500 group-hover/item:text-[#facc15] transition-colors">
                  <Phone className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-black text-slate-300 tracking-[0.1em]">{contato.telefone}</span>
              </div>

              {contato.email && (
                <div className="flex items-center gap-4 group/item">
                  <div className="p-2 bg-white/5 rounded-lg text-slate-500 group-hover/item:text-[#facc15] transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-black text-slate-300 truncate lowercase">{contato.email}</span>
                </div>
              )}

              {contato.observacoes && (
                <div className="flex items-start gap-4 pt-2">
                  <div className="p-2 bg-white/5 rounded-lg text-slate-500">
                    <FileText className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed italic line-clamp-2">
                    {contato.observacoes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
              <button 
                onClick={() => openWhatsApp(contato.telefone)}
                className="flex items-center justify-center gap-2 py-3 bg-[#22c55e]/10 text-[#22c55e] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#22c55e]/20 transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
              </button>
              <a 
                href={`tel:${contato.telefone}`}
                className="flex items-center justify-center gap-2 py-3 bg-white/5 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-center"
              >
                <Phone className="w-3.5 h-3.5" /> Chamar
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {contatosFiltrados.length === 0 && !loading && (
        <div className="py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-700">
            <Users className="w-10 h-10" />
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-400 uppercase tracking-tighter">Nenhum contato encontrado</h4>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">Tente ajustar sua busca ou categoria</p>
          </div>
        </div>
      )}

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-xl rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-8 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#facc15] rounded-xl text-black">
                  {editingContato ? <Edit2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                    {editingContato ? 'Editar Contato' : 'Novo Cadastro'}
                  </h3>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Preencha os dados abaixo</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                <X className="w-8 h-8" />
              </button>
            </header>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      required
                      type="text"
                      value={formData.nome}
                      onChange={e => setFormData({...formData, nome: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-[11px] font-black text-white outline-none focus:border-[#facc15]/50"
                      placeholder="EX: JOÃO DA SILVA"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Apelido (Opcional)</label>
                  <div className="relative">
                    <Star className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      type="text"
                      value={formData.apelido}
                      onChange={e => setFormData({...formData, apelido: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-[11px] font-black text-white outline-none focus:border-[#facc15]/50"
                      placeholder="EX: JOÃO MANUTENÇÃO"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      required
                      type="text"
                      value={formData.telefone}
                      onChange={e => setFormData({...formData, telefone: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-[11px] font-black text-white outline-none focus:border-[#facc15]/50"
                      placeholder="EX: 47999998888"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                    <select 
                      value={formData.categoria}
                      onChange={e => setFormData({...formData, categoria: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-[11px] font-black text-white outline-none focus:border-[#facc15]/50 appearance-none cursor-pointer"
                    >
                      {CATEGORIAS.map(cat => (
                        <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-[11px] font-black text-white outline-none focus:border-[#facc15]/50"
                    placeholder="EX: JOAO@EMPRESA.COM"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações</label>
                <textarea 
                  rows={3}
                  value={formData.observacoes}
                  onChange={e => setFormData({...formData, observacoes: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[11px] font-black text-white outline-none focus:border-[#facc15]/50 resize-none"
                  placeholder="ANOTAÇÕES SOBRE O CONTATO..."
                />
              </div>

              <div className="pt-4 grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-4 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  disabled={isSaving}
                  type="submit"
                  className="py-4 bg-[#facc15] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#facc15]/20 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingContato ? 'Atualizar' : 'Salvar Contato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
};

export default AgendaContatos;
