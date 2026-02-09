
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Linha, Produto, Maquina, Parada, Database } from './types/database';
import {
  ClipboardCheck,
  Settings,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Clock,
  Droplets,
  Loader2,
  Calendar,
  Layers,
  Timer,
  Activity,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

const PaginaRegistro: React.FC = () => {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [maquinasDaLinha, setMaquinasDaLinha] = useState<Maquina[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    data_registro: new Date().toISOString().split('T')[0],
    turno: '1º Turno',
    linha_producao: '',
    produto_volume: '',
    lote: '',
    carga_horaria: 8, // Default industrial padrão de 8 horas
    quantidade_produced: 0,
    quantidade_perda: 0
  });

  const [paradas, setParadas] = useState<Parada[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempParada, setTempParada] = useState<Parada & { hora_inicio?: string, hora_fim?: string }>({
    maquina_id: '',
    motivo: '',
    duracao: 0,
    hora_inicio: '',
    hora_fim: ''
  });



  useEffect(() => {
    async function loadInitialData() {
      try {
        const [linesRes, productsRes] = await Promise.all([
          supabase.from('linhas').select('*').order('nome'),
          supabase.from('produtos').select('*').order('nome')
        ]);

        if (linesRes.data) setLinhas(linesRes.data);
        if (productsRes.data) setProdutos(productsRes.data);
      } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    async function loadMachines() {
      if (!formData.linha_producao) {
        setMaquinasDaLinha([]);
        return;
      }
      const { data, error } = await supabase
        .from('maquinas')
        .select('*')
        .eq('linha_id', formData.linha_producao);

      if (error) console.error('Erro ao buscar máquinas:', error);
      if (data) setMaquinasDaLinha(data);
    }
    loadMachines();
    setParadas([]);
  }, [formData.linha_producao]);

  const handleAddParada = () => {
    if (!formData.linha_producao) return;
    setTempParada({ maquina_id: '', motivo: '', duracao: 0, hora_inicio: '', hora_fim: '' });
    setIsModalOpen(true);
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);

    let totalMinutesStart = h1 * 60 + m1;
    let totalMinutesEnd = h2 * 60 + m2;

    if (totalMinutesEnd < totalMinutesStart) {
      // Caso a parada atravesse a meia-noite
      totalMinutesEnd += 24 * 60;
    }

    return totalMinutesEnd - totalMinutesStart;
  };

  const updateTempParadaTime = (field: 'hora_inicio' | 'hora_fim', value: string) => {
    setTempParada(prev => {
      const updated = { ...prev, [field]: value };
      const duration = calculateDuration(
        field === 'hora_inicio' ? value : (prev.hora_inicio || ''),
        field === 'hora_fim' ? value : (prev.hora_fim || '')
      );
      return { ...updated, duracao: duration };
    });
  };

  const handleSaveParada = () => {
    if (!tempParada.maquina_id || !tempParada.motivo || tempParada.duracao <= 0) {
      alert("Por favor, preencha todos os campos da parada corretamente.");
      return;
    }
    // Removemos os campos extras de UI antes de salvar se necessário, 
    // mas o tipo Parada permite campos extras no banco se for JSONB
    const { hora_inicio, hora_fim, ...paradaToSave } = tempParada;
    setParadas([...paradas, paradaToSave]);
    setIsModalOpen(false);
  };



  const handleRemoveParada = (index: number) => {
    setParadas(paradas.filter((_, i) => i !== index));
  };

  const updateParada = (index: number, field: keyof Parada, value: any) => {
    const newParadas = [...paradas];
    newParadas[index] = { ...newParadas[index], [field]: value };
    setParadas(newParadas);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.linha_producao || !formData.produto_volume) {
      setMessage({ type: 'error', text: 'Linha e Produto são obrigatórios.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload: Database['public']['Tables']['registros_producao']['Insert'] = {
        data_registro: formData.data_registro,
        turno: formData.turno,
        linha_producao: formData.linha_producao,
        produto_volume: formData.produto_volume,
        lote: formData.lote || null,
        carga_horaria: Number(formData.carga_horaria),
        quantidade_produzida: Number(formData.quantidade_produced),
        quantidade_perda: Number(formData.quantidade_perda),
        paradas: paradas.length > 0 ? paradas : null
      };

      const { error } = await supabase.from('registros_producao').insert(payload);
      if (error) throw error;

      setMessage({ type: 'success', text: 'Registro industrial publicado com sucesso!' });
      window.scrollTo({ top: 0, behavior: 'smooth' });

      setFormData(prev => ({
        ...prev,
        quantidade_produced: 0,
        quantidade_perda: 0,
        lote: '',
        carga_horaria: 8
      }));
      setParadas([]);
    } catch (err: any) {
      setMessage({ type: 'error', text: `Falha na publicação: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-blue-500">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="font-bold text-[10px] uppercase tracking-[0.3em] opacity-50">Iniciando Terminal de Controle...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[98%] mx-auto space-y-8 w-full animate-in fade-in duration-700 pb-20 font-sans">

      <header className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/70 backdrop-blur-xl p-8 rounded-[32px] border border-white/20 shadow-2xl w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-100/20 rounded-full -ml-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-slate-900 p-4 rounded-[24px] shadow-2xl shadow-slate-400/20 shrink-0">
            <ClipboardCheck className="text-blue-400 w-8 h-8 shrink-0" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter leading-none uppercase">Apontamento Industrial</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Registro de Turno v2.5
            </p>
          </div>
        </div>

        {message && (
          <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-right duration-500 relative z-10 ${message.type === 'success' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200' : 'bg-red-500 text-white shadow-xl shadow-red-200'
            }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="font-black text-[10px] uppercase tracking-widest">{message.text}</span>
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-8 w-full">

        <section className="bg-white/80 backdrop-blur-md p-8 md:p-10 rounded-[40px] shadow-xl border border-white/50 w-full relative">
          <div className="flex items-center gap-4 mb-10 border-b border-slate-100/50 pb-6">
            <div className="p-3 bg-slate-900 rounded-2xl"><Settings className="w-5 h-5 text-blue-400" /></div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Contexto da Operação</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8 w-full">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Data
              </label>
              <input
                type="date"
                value={formData.data_registro}
                onChange={e => setFormData({ ...formData, data_registro: e.target.value })}
                className="w-full p-4 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xs font-black uppercase text-slate-900 transition-all outline-none"
                required
              />

            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Turno</label>
              <select
                value={formData.turno}
                onChange={e => setFormData({ ...formData, turno: e.target.value })}
                className="w-full p-4 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xs font-black uppercase text-slate-900 transition-all outline-none cursor-pointer"
              >
                <option value="1º Turno">1º TURNO</option>
                <option value="2º Turno">2º TURNO</option>
              </select>

            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Clock className="w-3 h-3 text-blue-500" /> Carga Horária (h)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.carga_horaria}
                onChange={e => setFormData({ ...formData, carga_horaria: parseFloat(e.target.value) || 0 })}
                className="w-full p-4 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xs font-black uppercase text-slate-900 transition-all outline-none"
                required
              />

            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lote</label>
              <input
                type="text"
                placeholder="REF LOTE"
                value={formData.lote}
                onChange={e => setFormData({ ...formData, lote: e.target.value })}
                className="w-full p-4 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xs font-mono font-black uppercase text-slate-900 transition-all outline-none"
              />

            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Activity className="w-3 h-3 text-blue-500" /> Linha
              </label>
              <select
                value={formData.linha_producao}
                onChange={e => setFormData({ ...formData, linha_producao: e.target.value })}
                className="w-full p-4 bg-blue-600 text-white border-2 border-blue-600 rounded-2xl text-xs font-black uppercase transition-all outline-none"
                required
              >
                <option value="">Selecione...</option>
                {linhas.map(l => (<option key={l.id} value={l.id}>{l.nome}</option>))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Layers className="w-3 h-3 text-emerald-500" /> SKU
              </label>
              <select
                value={formData.produto_volume}
                onChange={e => setFormData({ ...formData, produto_volume: e.target.value })}
                className="w-full p-4 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xs font-black uppercase text-slate-900 transition-all outline-none"
                required
              >
                <option value="">Selecione...</option>
                {produtos.map(p => (<option key={p.id} value={p.id} className="text-slate-900">{p.nome}</option>))}
              </select>

            </div>
          </div>
        </section>

        <section className="bg-white/80 backdrop-blur-md p-8 md:p-10 rounded-[40px] shadow-xl border border-white/50 w-full">
          <div className="flex items-center gap-4 mb-10 border-b border-slate-100/50 pb-6">
            <div className="p-3 bg-blue-50 rounded-2xl"><Droplets className="w-5 h-5 text-blue-600" /></div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Fluxo de Volumes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em] ml-2">Produção Total (UN)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={formData.quantidade_produced}
                  onChange={e => setFormData({ ...formData, quantidade_produced: parseInt(e.target.value) || 0 })}
                  className="w-full p-10 text-6xl md:text-8xl font-black border-4 border-transparent bg-blue-50/50 text-blue-700 rounded-[48px] text-center focus:border-blue-500 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-black text-red-500 uppercase tracking-[0.3em] ml-2">Refugo / Perdas (UN)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={formData.quantidade_perda}
                  onChange={e => setFormData({ ...formData, quantidade_perda: parseInt(e.target.value) || 0 })}
                  className="w-full p-10 text-6xl md:text-8xl font-black border-4 border-transparent bg-red-50/50 text-red-700 rounded-[48px] text-center focus:border-red-500 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white/80 backdrop-blur-md p-8 md:p-10 rounded-[40px] shadow-xl border border-white/50 w-full">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-10 border-b border-slate-100/50 pb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-50 rounded-2xl"><Timer className="w-5 h-5 text-red-500" /></div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Registro de Paradas</h2>
            </div>
            <button
              type="button"
              onClick={handleAddParada}
              disabled={!formData.linha_producao}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-20 hover:scale-[1.05] transition-all flex items-center gap-3"
            >
              <Plus className="w-4 h-4" /> Adicionar Parada
            </button>
          </div>

          <div className="space-y-6">
            {paradas.length === 0 ? (
              <div className="py-20 text-center border-4 border-dashed border-slate-50 rounded-[48px]">
                <p className="text-slate-300 font-black uppercase tracking-[0.3em] text-[10px]">Sem registros de inatividade neste turno</p>
              </div>
            ) : (
              <div className="space-y-6">
                {paradas.map((parada, index) => (
                  <div
                    key={index}
                    className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center gap-8 relative group hover:border-red-200 transition-all"
                  >
                    <div className="w-full lg:w-1/4">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Máquina</label>
                      <select
                        value={parada.maquina_id}
                        onChange={e => updateParada(index, 'maquina_id', e.target.value)}
                        className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-900 outline-none transition-all"
                        required
                      >
                        <option value="">Selecione Opção...</option>
                        {[
                          'ROTULADORA', 'ENCHEDORA', 'SOPRO', 'DATADORA',
                          'EMPACOTADORA', 'REUNIAO', 'PARADA PROGRAMADA',
                          'OUTROS', 'FALTA DE ENERGIA', 'SETUP'
                        ].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full lg:flex-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Motivo</label>
                      <input
                        type="text"
                        value={parada.motivo}
                        onChange={e => updateParada(index, 'motivo', e.target.value)}
                        className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-800 outline-none shadow-inner"
                        placeholder="Ex: Falha no sensor"
                        required
                      />
                    </div>


                    <div className="w-full lg:w-32">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 text-center">Minutos</label>
                      <input
                        type="number"
                        min="1"
                        value={parada.duracao}
                        onChange={e => updateParada(index, 'duracao', parseInt(e.target.value) || 0)}
                        className="w-full p-4 bg-red-50 text-red-600 border-none rounded-2xl text-lg font-black text-center outline-none shadow-sm"
                        required
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveParada(index)}
                      className="p-4 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="pt-10 pb-20">
          <button
            type="submit"
            disabled={saving}
            className="w-full relative group overflow-hidden bg-slate-900 text-white font-black py-8 md:py-10 rounded-[40px] shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-6 disabled:opacity-50"
          >
            <div className="relative z-10 flex items-center gap-6">
              {saving ? <Loader2 className="animate-spin w-10 h-10 text-blue-400" /> : <Save className="w-10 h-10 text-blue-400" />}
              <span className="text-sm md:text-lg tracking-[0.5em] uppercase font-black">
                {saving ? 'Publicando...' : 'Gravar Apontamento Industrial'}
              </span>
            </div>
          </button>
        </footer>
      </form>

      {/* Modal de Registro de Paradas */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-10 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-50 rounded-2xl">
                  <Timer className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Registrar Nova Parada</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Insira os detalhes técnicos do downtime</p>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Máquina / Motivo Geral</label>
                <select
                  value={tempParada.maquina_id}
                  onChange={e => setTempParada({ ...tempParada, maquina_id: e.target.value })}
                  className="w-full p-5 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xs font-black uppercase text-slate-900 transition-all outline-none"
                  required
                >
                  <option value="">Selecione uma opção...</option>
                  {[
                    'ROTULADORA', 'ENCHEDORA', 'SOPRO', 'DATADORA',
                    'EMPACOTADORA', 'REUNIAO', 'PARADA PROGRAMADA',
                    'OUTROS', 'FALTA DE ENERGIA', 'SETUP'
                  ].map(m => (
                    <option key={m} value={m} className="text-slate-900">{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detalhes do Motivo</label>
                <input
                  type="text"
                  placeholder="Ex: Quebra do comando elétrico"
                  value={tempParada.motivo}
                  onChange={e => setTempParada({ ...tempParada, motivo: e.target.value })}
                  className="w-full p-5 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xs font-black uppercase text-slate-900 transition-all outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Hora Inicial
                  </label>
                  <input
                    type="time"
                    value={tempParada.hora_inicio}
                    onChange={e => updateTempParadaTime('hora_inicio', e.target.value)}
                    className="w-full p-5 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xl font-black text-slate-900 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Hora Final
                  </label>
                  <input
                    type="time"
                    value={tempParada.hora_fim}
                    onChange={e => updateTempParadaTime('hora_fim', e.target.value)}
                    className="w-full p-5 bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl text-xl font-black text-slate-900 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tempo Total Calculado (Minutos)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={tempParada.duracao}
                    readOnly
                    className="w-full p-5 bg-red-50 border-2 border-transparent rounded-2xl text-2xl font-black text-red-600 outline-none text-center cursor-not-allowed"
                  />
                  <Timer className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-red-300" />
                </div>
              </div>
            </div>


            <div className="p-8 md:p-10 bg-slate-50 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-8 py-5 border-2 border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-600 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveParada}
                className="flex-1 px-8 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-200 transition-all flex items-center justify-center gap-3"
              >
                <Plus className="w-4 h-4" /> Confirmar Parada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaginaRegistro;

