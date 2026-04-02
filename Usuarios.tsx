import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { 
  Users, 
  Search, 
  Filter, 
  Edit3, 
  Shield, 
  UserMinus, 
  UserCheck, 
  MoreHorizontal, 
  X, 
  Check, 
  Loader2, 
  Mail, 
  Phone,
  Settings2,
  ChevronDown,
  Activity,
  User as UserIcon
} from 'lucide-react';

const Usuarios: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: any) => {
    try {
      const { error } = await supabase
        .from('perfis')
        .update({ ativo: !user.ativo })
        .eq('id', user.id);
      
      if (error) throw error;
      fetchUsers();
    } catch (err) {
      console.error('Erro ao mudar status:', err);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setSaveLoading(true);
    try {
      const { error } = await supabase
        .from('perfis')
        .update({
          nome: editingUser.nome,
          cargo: editingUser.cargo,
          nivel_acesso: editingUser.nivel_acesso,
          especialidade: editingUser.especialidade,
          turno: Number(editingUser.turno),
          telefone: editingUser.telefone
        })
        .eq('id', editingUser.id);

      if (error) throw error;
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.nivel_acesso === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      
      {/* Header Nexus Premium */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10 shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="bg-[#facc15] p-3 sm:p-4 rounded-xl shadow-[0_0_20px_rgba(250,204,21,0.3)] text-black">
            <Users className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tighter leading-none">Gestão de Equipe</h2>
            <p className="text-slate-400 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" /> {users.length} Colaboradores
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative group bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl w-full sm:w-64 focus-within:border-[#facc15]/50 transition-all">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="PESQUISAR..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-white font-black text-[9px] sm:text-[10px] uppercase tracking-widest pl-12 pr-4 py-3 sm:py-4 w-full outline-none"
            />
          </div>
          
          <div className="flex w-full sm:w-auto bg-white/5 p-1 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
            {['all', 'admin', 'lider', 'mecanico'].map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterRole === role ? 'bg-[#facc15] text-black shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'text-slate-500 hover:text-white'}`}
              >
                {role === 'all' ? 'TODOS' : role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-[#facc15] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredUsers.map((user) => (
            <div 
              key={user.id} 
              className={`bg-[#141414] border p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] transition-all duration-500 shadow-xl relative overflow-hidden group
                ${!user.ativo ? 'opacity-60 grayscale' : 'border-white/5 hover:border-[#facc15]/20 hover:shadow-[0_0_40px_rgba(250,204,21,0.05)]'}
              `}
            >
              {/* Role Badge */}
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex flex-col items-end gap-2">
                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded bg-black/40 border tracking-widest
                  ${user.nivel_acesso === 'admin' ? 'text-rose-400 border-rose-500/20' : 
                    user.nivel_acesso === 'lider' ? 'text-blue-400 border-blue-500/20' : 'text-[#facc15] border-[#facc15]/20'}
                `}>
                  {user.nivel_acesso}
                </span>
                {!user.ativo && (
                  <span className="text-[8px] font-black uppercase px-2 py-1 rounded bg-red-500/20 text-red-500 border border-red-500/20 tracking-widest">
                    INATIVO
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 sm:gap-5 mb-5 sm:mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-800 border-2 border-white/5 overflow-hidden flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  {user.foto_url ? (
                    <img src={user.foto_url} alt={user.nome} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-6 h-6 sm:w-8 sm:h-8 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter truncate">{user.nome}</h4>
                  <p className="text-[#facc15] text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] mt-1 truncate">{user.cargo || 'CARGO NÃO DEFINIDO'}</p>
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  <Mail className="w-3.5 h-3.5 text-[#facc15]" />
                  <span className="truncate">{user.email || 'SEM E-MAIL'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  <Phone className="w-3.5 h-3.5 text-[#facc15]" />
                  <span>{user.telefone || '--'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  <Activity className="w-3.5 h-3.5 text-[#facc15]" />
                  <span>Esp: {user.especialidade || 'GERAL'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-8">
                <button 
                  onClick={() => setEditingUser(user)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/5"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Editar
                </button>
                <button 
                  onClick={() => handleToggleStatus(user)}
                  className={`p-3 rounded-xl transition-all border
                    ${user.ativo 
                      ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' 
                      : 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20'}
                  `}
                  title={user.ativo ? 'Desativar Usuário' : 'Ativar Usuário'}
                >
                  {user.ativo ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setEditingUser(null)} />
          <div className="bg-[#1a1a1a] rounded-t-[32px] sm:rounded-[40px] shadow-2xl w-full max-w-xl relative z-10 border border-white/10 overflow-hidden mt-auto sm:mt-0">
            <header className="px-6 py-8 sm:px-10 sm:py-10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="bg-[#facc15] p-2.5 sm:p-3 rounded-xl text-black">
                  <Settings2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter">Editar Perfil</h3>
                  <p className="text-slate-500 text-[8px] sm:text-[10px] font-black uppercase mt-1">Sincronizando Nexus PCP</p>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 text-slate-500 hover:text-white"><X className="w-8 h-8" /></button>
            </header>

            <form onSubmit={handleUpdateUser} className="p-6 sm:p-10 space-y-4 sm:space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input 
                    type="text" 
                    value={editingUser.nome}
                    onChange={e => setEditingUser({...editingUser, nome: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-white text-xs font-bold focus:border-[#facc15]/50 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo</label>
                  <input 
                    type="text" 
                    value={editingUser.cargo || ''}
                    onChange={e => setEditingUser({...editingUser, cargo: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-white text-xs font-bold focus:border-[#facc15]/50 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Acesso</label>
                  <select 
                    value={editingUser.nivel_acesso}
                    onChange={e => setEditingUser({...editingUser, nivel_acesso: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-white text-xs font-bold focus:border-[#facc15]/50 outline-none transition-all"
                  >
                    <option value="mecanico">MECÂNICO</option>
                    <option value="lider">LÍDER</option>
                    <option value="admin">ADMIN</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Especialidade</label>
                  <select 
                    value={editingUser.especialidade || ''}
                    onChange={e => setEditingUser({...editingUser, especialidade: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-white text-xs font-bold focus:border-[#facc15]/50 outline-none transition-all"
                  >
                    <option value="geral">GERAL</option>
                    <option value="mecanica">MECÂNICA</option>
                    <option value="eletrica">ELÉTRICA</option>
                    <option value="civil">CIVIL</option>
                    <option value="utilidades">UTILIDADES</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Turno</label>
                  <select 
                    value={editingUser.turno || 1}
                    onChange={e => setEditingUser({...editingUser, turno: e.target.value})}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-white text-xs font-bold focus:border-[#facc15]/50 outline-none transition-all"
                  >
                    <option value={1}>1º TURNO</option>
                    <option value={2}>2º TURNO</option>
                    <option value={3}>3º TURNO</option>
                  </select>
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full bg-[#facc15] hover:bg-[#eab308] text-black font-black uppercase tracking-[0.2em] py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-[11px]"
                >
                  {saveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Salvar Alterações</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;
