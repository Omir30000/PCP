import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { User, Mail, Phone, Briefcase, Clock, Shield, Save, Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface PerfilProps {
  userProfile: any;
  onProfileUpdate: (newProfile: any) => void;
}

const Perfil: React.FC<PerfilProps> = ({ userProfile, onProfileUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form states
  const [nome, setNome] = useState(userProfile?.nome || '');
  const [telefone, setTelefone] = useState(userProfile?.telefone || '');
  const [cargo, setCargo] = useState(userProfile?.cargo || '');
  const [turno, setTurno] = useState(userProfile?.turno || 1);
  const [especialidade, setEspecialidade] = useState(userProfile?.especialidade || '');
  const [fotoUrl, setFotoUrl] = useState(userProfile?.foto_url || '');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // Limite de 1MB para Base64 não pesar muito
        setMessage({ type: 'error', text: 'A imagem deve ter menos de 1MB.' });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from('perfis')
        .update({
          nome,
          telefone,
          cargo,
          turno: Number(turno),
          especialidade,
          foto_url: fotoUrl
        })
        .eq('id', userProfile.id)
        .select()
        .single();

      if (error) throw error;

      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      onProfileUpdate(data);
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      setMessage({ type: 'error', text: err.message || 'Falha ao atualizar perfil.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/10 shadow-2xl flex flex-col md:flex-row items-center gap-6 sm:gap-8 text-center md:text-left">
        <div className="relative group">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[20px] sm:rounded-[24px] bg-slate-800 border-2 border-[#facc15]/30 overflow-hidden shadow-2xl flex items-center justify-center">
            {fotoUrl ? (
              <img src={fotoUrl} alt="Perfil" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 sm:w-16 sm:h-16 text-slate-600" />
            )}
          </div>
          <label className="absolute -bottom-2 -right-2 bg-[#facc15] p-2 rounded-xl cursor-pointer shadow-lg hover:scale-110 transition-transform text-black group-hover:rotate-6">
            <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
          </label>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-tighter truncate">{nome || 'Usuário Nexus'}</h2>
          <p className="text-[#facc15] font-black text-[9px] sm:text-xs uppercase tracking-[0.3em] mt-1">{userProfile?.nivel_acesso || 'Membro'}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-3 sm:gap-4 mt-4 text-slate-400 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
            <span className="bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 flex items-center gap-2 max-w-[180px] truncate">
              <Mail className="w-3 h-3 shrink-0" /> {userProfile?.email}
            </span>
            <span className="bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 flex items-center gap-2">
              <Shield className="w-3 h-3 shrink-0" /> {userProfile?.id.substring(0, 8)}...
            </span>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-[#141414] border border-white/5 rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden p-6 sm:p-8 md:p-12">
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            
            {/* Nome */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Nome Completo</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500 group-focus-within:text-[#facc15] transition-colors" />
                </div>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/50 transition-all font-bold placeholder:text-slate-700"
                  placeholder="Nome do usuário"
                  required
                />
              </div>
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Telefone / WhatsApp</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-500 group-focus-within:text-[#facc15] transition-colors" />
                </div>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/50 transition-all font-bold placeholder:text-slate-700"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Cargo */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Cargo / Função</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Briefcase className="h-5 w-5 text-slate-500 group-focus-within:text-[#facc15] transition-colors" />
                </div>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/50 transition-all font-bold placeholder:text-slate-700"
                  placeholder="Ex: Operador I, Técnico..."
                />
              </div>
            </div>

            {/* Turno */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Turno de Trabalho</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Clock className="h-5 w-5 text-slate-500 group-focus-within:text-[#facc15] transition-colors" />
                </div>
                <select
                  value={turno}
                  onChange={(e) => setTurno(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 text-white rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/50 transition-all font-bold appearance-none cursor-pointer"
                >
                  <option value={1}>1º Turno (Manhã)</option>
                  <option value={2}>2º Turno (Tarde)</option>
                  <option value={3}>3º Turno (Noite)</option>
                </select>
              </div>
            </div>

            {/* Especialidade */}
            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Especialidade Técnica</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {['mecanica', 'eletrica', 'civil', 'utilidades', 'geral'].map((esp) => (
                  <button
                    key={esp}
                    type="button"
                    onClick={() => setEspecialidade(esp)}
                    className={`py-3.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border
                      ${especialidade === esp 
                        ? 'bg-[#facc15] text-black border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.3)]' 
                        : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/20'}`}
                  >
                    {esp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-300
              ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-xs font-black uppercase tracking-widest">{message.text}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#facc15] hover:bg-[#eab308] text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(250,204,21,0.2)] hover:shadow-[0_0_40px_rgba(250,204,21,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-sm"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Save className="w-6 h-6" />
                Salvar Alterações
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Perfil;
