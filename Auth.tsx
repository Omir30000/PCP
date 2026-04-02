import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { Mail, Lock, User, Shield, Loader2, KeyRound, Sparkles } from 'lucide-react';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Fluxo de Login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });
        if (signInError) throw signInError;
      } else {
        // Fluxo de Cadastro
        if (!nome.trim()) {
          throw new Error('O nome é obrigatório para cadastro.');
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: {
              nome: nome,
              nivel_acesso: 'mecanico'
            }
          }
        });

        if (signUpError) throw signUpError;

        if (signUpData.user) {
          // O perfil agora é criado automaticamente via Database Trigger
          // Mas podemos dar um feedback positivo para o usuário
          setError('Cadastro realizado com sucesso! Você já pode entrar.');
          setIsLogin(true); // Muda para tela de login após cadastro
        }
      }
    } catch (err: any) {
      console.error('Auth erro:', err);
      setError(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#facc15]/30">
      
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#facc15]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 p-2 sm:p-0">
        
        {/* Logo/Brand */}
        <div className="flex flex-col items-center mb-8 sm:mb-10 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#facc15] rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-[0_0_30px_rgba(250,204,21,0.2)]">
            <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-black" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">Nexus <span className="text-[#facc15]">PCP</span></h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-medium tracking-widest uppercase flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-[#facc15]" /> Acesso Restrito
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#141414]/80 backdrop-blur-xl rounded-[32px] p-6 sm:p-8 border border-white/5 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500 group-focus-within:text-[#facc15] transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required={!isLogin}
                    className="w-full bg-[#0a0a0a] border border-white/10 text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/50 transition-all font-medium placeholder:text-slate-600"
                    placeholder="João Silva"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-[#facc15] transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/50 transition-all font-medium placeholder:text-slate-600"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-[#facc15] transition-colors" />
                </div>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#facc15]/50 focus:ring-1 focus:ring-[#facc15]/50 transition-all font-medium placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-start gap-2">
                <div className="mt-0.5 shrink-0">⚠️</div>
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#facc15] hover:bg-[#eab308] text-black font-black uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:shadow-[0_0_30px_rgba(250,204,21,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  {isLogin ? 'Entrar no Sistema' : 'Criar Conta'}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setNome('');
              }}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              {isLogin ? (
                <>Não tem uma conta? <span className="text-[#facc15]">Registre-se</span></>
              ) : (
                <>Já possui conta? <span className="text-[#facc15]">Faça Login</span></>
              )}
            </button>
          </div>

        </div>
        
        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-8">
          Nexus Security © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Auth;
