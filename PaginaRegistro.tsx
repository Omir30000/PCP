
import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  User,
  Box,
  ZapOff,
  X,
  TrendingUp,
  MessageSquare
} from 'lucide-react';

const EVO_CONFIG = {
  baseURL: 'https://evo.servidorpremium.duckdns.org',
  apiKey: '27FF670803F3-4BD9-B0DB-66CA428410C8',
  instance: 'lima',
  destination: '553599586919'
};

const MOTIVOS_COMUNS: Record<string, string[]> = {
  'FALHA DE ENERGIA': ['PICO DE TENSÃO', 'QUEDA GERAL', 'ACIONAMENTO DE GERADOR'],
  'FALTA DE COLABORADOR': ['AUSÊNCIA TÉCNICA', 'TROCA DE TURNO', 'FALTA DE OPERADOR'],
  'FALTA DE MATERIA PRIMA': ['FALTA DE VASILHAME', 'FALTA DE TAMPA', 'FALTA DE RÓTULO', 'FALTA DE FILME', 'FALTA DE CAIXA', 'FALTA DE GÁS'],
  'LIMPEZA DE MÁQUINA': ['LIMPEZA DE TANQUE', 'SANITIZAÇÃO', 'TROCA DE COR', 'LIMPEZA DE FIM DE TURNO', 'LIMPEZA DE AEREO'],
  'MANUTENÇÃO': ['QUEBRA MECÂNICA', 'FALHA ELÉTRICA', 'TROCA DE SENSOR', 'AJUSTE DE CORRENTE', 'LUBRIFICAÇÃO', 'TROCA DE PEÇA', 'REPARO NA ESTEIRA', 'MANUTENÇÃO PREVENTIVA', 'LIMPEZA DE CANHÃO', 'ALINHAMENTO DE DATA'],
  'PALESTRA/REUNIÃO': ['TREINAMENTO', 'REUNIÃO DE TURNO', 'DIÁLOGO DE SEGURANÇA'],
  'SETUP (Preparação de máquina)': ['TROCA DE FORMATO', 'AJUSTE DE GUIA', 'AQUECIMENTO', 'TROCA DE PRODUTO', 'INÍCIO DE PRODUÇÃO', 'REGULAGEM TERMICA'],
  'PARADA PROGRAMADA': ['INTERVALO REFEIÇÃO', 'INVENTÁRIO', 'DESCANSO'],
  'OPERACIONAL': ['INÍCIO DE TURNO', 'FALTA DE OPERADOR', 'TROCA DE RÓTULO', 'AJUSTE DE PROCESSO', 'REFUGO EXCESSIVO', 'LIMPEZA SETORIAL', 'TROCA DE BOBINA', 'LIMPEZA DE COLA'],
  'ASSISTENCIA TÉCNICA': ['ACESSO REMOTO', 'VISITA TÉCNICA EXTERNA', 'SUPORTE TÉCNICO FABRICANTE']
};

const LISTA_EQUIPAMENTOS = [
  'GERAL',
  'ENCHEDORA',
  'DATADORA',
  'ROTULADORA',
  'EMPACOTADORA',
  'ESTEIRAS',
  'PAVAN',
  'UNIPLAS',
  'MULTIPET',
  'AEREO',
  'HALMMER',
  'CALDEIRA',
  'DESPALETIZADOR',
  'INTERVALO',
  'INJETOR DE ESSENCIA',
  'INJETOR DE NITROGENIO',
  'CABONATADOR',
  'MANUTENÇÃO'
];

// Mapeamento de Produtos por Linha (Nomes exatos do Banco)
const LINHA_PRODUTO_MAP: Record<string, string[]> = {
  'Linha 1': ['Galão 6 Litros', 'Galão 10 litros'],
  'Linha 2': ['Natural 1500ml', 'Gás 1500ml', 'Natural 310ml', 'Gás 310 ml', 'Natural 510ml', 'Gás 510ml'],
  'Linha 3': ['Natural 1500ml', 'Natural 310ml', 'Natural 510ml'],
  'Linha 4': ['Copo 200ml', 'Copo 305ml'],
  'Linha 5': ['Lata 355ml Natural', 'Lata 355ml Gás']
};

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
    hora_inicio_turno: '07:00',
    hora_fim_turno: '15:48',
    linha_producao: '',
    produto_volume: '',
    lote: '',
    carga_horaria: 8,
    quantidade_produced: 0,
    observacoes: ''
  });

  const [enviarWhatsApp, setEnviarWhatsApp] = useState(true);

  const [paradas, setParadas] = useState<Parada[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempParada, setTempParada] = useState<Parada>({
    tipo: '',
    maquina_id: '',
    motivo: '',
    duracao: 0,
    hora_inicio: '',
    hora_fim: ''
  });

  const horaFimRef = useRef<HTMLInputElement>(null);
  const motivoRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);



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

  // Sincroniza o campo lote com a data do registro (formato DDMMYYYY)
  useEffect(() => {
    if (formData.data_registro) {
      const [year, month, day] = formData.data_registro.split('-');
      // Mantém o padrão DDMMYYYY sem separadores
      const formattedDate = `${day}${month}${year}`;
      setFormData(prev => ({ ...prev, lote: formattedDate }));
    }
  }, [formData.data_registro]);

  // Cálculo Automático da Carga Horária Líquida (Desconto de 1h de intervalo)
  useEffect(() => {
    if (formData.hora_inicio_turno && formData.hora_fim_turno) {
      const duracaoBruta = calculateDuration(formData.hora_inicio_turno, formData.hora_fim_turno);
      // Subtrai 60 minutos do intervalo, mas garante que não fique negativo
      const duracaoLiquida = Math.max(0, duracaoBruta - 60);
      const duracaoHoras = Number((duracaoLiquida / 60).toFixed(2));
      setFormData(prev => ({ ...prev, carga_horaria: duracaoHoras }));
    }
  }, [formData.hora_inicio_turno, formData.hora_fim_turno]);

  // Sincroniza Horários Padrão por Turno
  useEffect(() => {
    if (formData.turno === '1º Turno') {
      setFormData(prev => ({ ...prev, hora_inicio_turno: '06:00', hora_fim_turno: '16:00' }));
    } else if (formData.turno === '2º Turno') {
      setFormData(prev => ({ ...prev, hora_inicio_turno: '15:30', hora_fim_turno: '00:30' }));
    }
  }, [formData.turno]);

  // Reseta produto ao mudar linha
  useEffect(() => {
    setFormData(prev => ({ ...prev, produto_volume: '' }));
  }, [formData.linha_producao]);

  const handleAddParada = () => {
    if (!formData.linha_producao) return;
    setTempParada({ tipo: '', maquina_id: '', motivo: '', duracao: 0, hora_inicio: '', hora_fim: '' });
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
    if (!tempParada.tipo || !tempParada.motivo || tempParada.duracao <= 0) {
      alert("Por favor, preencha todos os campos da parada corretamente (Tipo, Motivo e Horários).");
      return;
    }
    setParadas([...paradas, { ...tempParada, id: Math.random().toString(36).substr(2, 9) }]);
    setIsModalOpen(false);
  };



  const handleRemoveParada = (index: number) => {
    setParadas(paradas.filter((_, i) => i !== index));
  };

  const updateParada = (index: number, field: keyof Parada, value: any) => {
    const newParadas = [...paradas];
    const updatedParada = { ...newParadas[index], [field]: value };

    if (field === 'hora_inicio' || field === 'hora_fim') {
      updatedParada.duracao = calculateDuration(
        updatedParada.hora_inicio || '',
        updatedParada.hora_fim || ''
      );
    }

    newParadas[index] = updatedParada;
    setParadas(newParadas);
  };

  const enviarMensagemWhatsApp = async (dados: any, totalParado: number) => {
    try {
      const mensagem = `*RESUMO DE PRODUÇÃO*
📅 *Data:* ${new Date(dados.data_registro).toLocaleDateString('pt-BR')}
🌅 *Turno:* ${dados.turno}
📦 *Linha:* ${dados.linha_producao}
📦 *Produto:* ${dados.produto_volume}
📊 *Quantidade:* ${dados.quantidade_produzida}
⏱️ *Tempo Total Parado:* ${totalParado}min
📝 *Observações:* ${dados.observacoes || 'Nenhuma'}`;

      await fetch(`${EVO_CONFIG.baseURL}/message/sendText/${EVO_CONFIG.instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVO_CONFIG.apiKey
        },
        body: JSON.stringify({
          number: EVO_CONFIG.destination,
          text: mensagem,
          linkPreview: false
        })
      });
    } catch (err) {
      console.error("Erro ao enviar WhatsApp:", err);
    }
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
      // Lookups
      const linhaSelecionada = linhas.find(l => l.id === formData.linha_producao);
      const produtoSelecionado = produtos.find(p => p.id === formData.produto_volume);

      const payload: Database['public']['Tables']['registros_producao']['Insert'] = {
        data_registro: formData.data_registro,
        turno: formData.turno,
        linha_producao: linhaSelecionada?.nome || formData.linha_producao, // Salva o NOME (ex: Linha 1)
        linha_id: formData.linha_producao, // Salva o UUID
        produto_volume: produtoSelecionado?.nome || formData.produto_volume, // Salva o NOME (ex: Gás 510ml)
        produto_id: formData.produto_volume, // Salva o UUID
        lote: formData.lote || null,
        carga_horaria: Number(formData.carga_horaria),
        quantidade_produzida: Number(formData.quantidade_produced),
        capacidade_producao: produtoSelecionado?.capacidade_nominal || null,
        observacoes: formData.observacoes || null,
        paradas: paradas.map(p => ({
          tipo: p.tipo || 'Não Planejada',
          maquina: p.maquina_id || 'GERAL',
          motivo: p.motivo || 'NÃO INFORMADO',
          duracao: typeof p.duracao === 'number' ? `${p.duracao}min` : (p.duracao || '0min'),
          hora_inicio: p.hora_inicio || null,
          hora_fim: p.hora_fim || null
        })) as any
      };

      const { error } = await supabase.from('registros_producao').insert(payload);
      if (error) throw error;

      if (enviarWhatsApp) {
        const totalParado = paradas.reduce((acc, p) => acc + (p.duracao || 0), 0);
        await enviarMensagemWhatsApp(payload, totalParado);
      }

      setMessage({ type: 'success', text: 'Registro industrial publicado com sucesso!' });
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const [year, month, day] = formData.data_registro.split('-');
      const defaultLote = `${day}${month}${year}`;

      setFormData(prev => ({
        ...prev,
        quantidade_produced: 0,
        lote: defaultLote,
        carga_horaria: 8,
        observacoes: ''
      }));
      setParadas([]);

      // Retorna o foco para o campo de data após o reset
      setTimeout(() => {
        dataInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      console.error("Erro completo do Supabase:", err);
      const detail = err.details || err.hint || err.message || "Erro desconhecido";
      setMessage({ type: 'error', text: `Falha na publicação: ${detail} (Código: ${err.code || 'N/A'})` });
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
    <div className="max-w-[98%] mx-auto space-y-8 w-full animate-in fade-in duration-700 pb-20 font-sans text-slate-900 dark:text-slate-100">

      <header className="flex flex-col xl:flex-row items-center justify-between gap-6 bg-slate-900/90 backdrop-blur-md p-6 lg:p-8 rounded-2xl border border-white/10 shadow-2xl w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#facc15]/10 rounded-full -ml-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-6 relative z-10 w-full xl:w-auto">
          <div className="bg-[#facc15] p-4 rounded-xl shadow-lg shadow-[#facc15]/20 shrink-0 text-black">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl md:text-3xl font-black text-white tracking-tighter leading-none uppercase">Apontamento Industrial</h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
              <Layers className="w-3 h-3 text-[#facc15]" /> Nexus Production Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 relative z-10 w-full xl:w-auto overflow-x-auto no-scrollbar pb-2 xl:pb-0">
          <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-xl border border-white/10 shadow-sm min-w-fit">
            <User className="w-4 h-4 text-[#facc15]" />
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</span>
              <span className="text-xs font-black text-white uppercase">OPERADOR NEXUS</span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 shadow-sm min-w-fit">
            <MessageSquare className={`w-4 h-4 ${enviarWhatsApp ? 'text-emerald-400' : 'text-slate-500'}`} />
            <div className="flex flex-col leading-none">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Enviar WhatsApp?</span>
              <select
                value={enviarWhatsApp ? 'sim' : 'nao'}
                onChange={e => setEnviarWhatsApp(e.target.value === 'sim')}
                className="bg-transparent text-[11px] font-black text-white outline-none uppercase cursor-pointer"
              >
                <option value="sim" className="bg-slate-900">Sim</option>
                <option value="nao" className="bg-slate-900">Não</option>
              </select>
            </div>
          </div>
        </div>

        {message && (
          <div className={`px-6 py-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-right duration-500 relative z-10 ${message.type === 'success' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-500/20' : 'bg-red-600 text-white shadow-xl shadow-red-500/20'
            }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="font-black text-[10px] uppercase tracking-widest">{message.text}</span>
          </div>
        )}
      </header>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            e.preventDefault();
          }
        }}
        className="space-y-8 w-full"
      >
        {/* I. Contexto da Operação */}
        <section className="bg-slate-900/40 backdrop-blur-md p-8 lg:p-12 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-all duration-700" />

          <div className="relative z-10 space-y-12">
            <div className="flex items-center gap-4 border-l-4 border-[#facc15] pl-6">
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-[0.2em]">Contexto da Operação</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-8 gap-6 lg:gap-4 w-full">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-[#facc15]" /> Data
                </label>
                <input
                  type="date"
                  ref={dataInputRef}
                  value={formData.data_registro}
                  onChange={e => setFormData({ ...formData, data_registro: e.target.value })}
                  className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-black uppercase text-white transition-all outline-none focus:border-[#facc15]"
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Layers className="w-3 h-3 text-[#facc15]" /> Turno
                </label>
                <select
                  value={formData.turno}
                  onChange={e => setFormData({ ...formData, turno: e.target.value })}
                  className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-black uppercase text-white transition-all outline-none focus:border-[#facc15]"
                >
                  <option value="1º Turno" className="bg-slate-900">1º TURNO</option>
                  <option value="2º Turno" className="bg-slate-900">2º TURNO</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-[#facc15]" /> Início
                </label>
                <input
                  type="time"
                  value={formData.hora_inicio_turno}
                  onChange={e => setFormData({ ...formData, hora_inicio_turno: e.target.value })}
                  className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-black uppercase text-white transition-all outline-none focus:border-[#facc15]"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-[#facc15]" /> Término
                </label>
                <input
                  type="time"
                  value={formData.hora_fim_turno}
                  onChange={e => setFormData({ ...formData, hora_fim_turno: e.target.value })}
                  className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-black uppercase text-white transition-all outline-none focus:border-[#facc15]"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Clock className="w-3 h-3 text-[#facc15]" /> Carga (h)
                </label>
                <input
                  type="number"
                  value={formData.carga_horaria}
                  readOnly
                  className="w-full bg-white/5 border-2 border-white/5 p-4 rounded-xl text-[11px] font-black uppercase text-slate-500 outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Layers className="w-3 h-3 text-[#facc15]" /> Lote
                </label>
                <input
                  type="text"
                  placeholder="REF LOTE"
                  value={formData.lote}
                  onChange={e => setFormData({ ...formData, lote: e.target.value })}
                  className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-black uppercase text-white transition-all outline-none focus:border-[#facc15]"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Activity className="w-3 h-3 text-[#facc15]" /> Linha
                </label>
                <select
                  value={formData.linha_producao}
                  onChange={e => setFormData({ ...formData, linha_producao: e.target.value })}
                  className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-black uppercase text-white transition-all outline-none focus:border-[#facc15]"
                  required
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  {linhas.map(l => (<option key={l.id} value={l.id} className="bg-slate-900">{l.nome}</option>))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Box className="w-3 h-3 text-[#facc15]" /> SKU / Produto
                </label>
                <select
                  value={formData.produto_volume}
                  onChange={e => setFormData({ ...formData, produto_volume: e.target.value })}
                  className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-black uppercase text-white transition-all outline-none focus:border-[#facc15]"
                  required
                >
                  <option value="" className="bg-slate-900">Selecione...</option>
                  {produtos
                    .filter(p => {
                      if (!formData.linha_producao) return true;
                      const linhaNome = linhas.find(l => l.id === formData.linha_producao)?.nome || '';
                      const allowedProducts = LINHA_PRODUTO_MAP[linhaNome] || [];
                      return allowedProducts.includes(p.nome);
                    })
                    .map(p => (<option key={p.id} value={p.id} className="bg-slate-900">{p.nome}</option>))}
                </select>
              </div>
            </div>
          </div>
        </section>
        {/* II. Fluxo de Volumes */}
        <section className="bg-slate-900/40 backdrop-blur-md p-8 lg:p-12 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full -mr-48 -mt-48 blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-all duration-700" />
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4 border-l-4 border-blue-500 pl-6">
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-[0.2em]">Volume Produzido</h2>
            </div>
            <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Digite a quantidade produzida:
              </label>
              <input
                type="number"
                value={formData.quantidade_produced === 0 ? '' : formData.quantidade_produced}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({ ...formData, quantidade_produced: val === '' ? 0 : Number(val) });
                }}
                className="w-full bg-black/20 border-2 border-white/5 p-6 rounded-xl text-6xl font-black text-blue-400 outline-none focus:border-blue-500 transition-all text-center"
                placeholder="0"
                required
              />
            </div>
          </div>
        </section>

        {/* III. Registro de Inatividade */}
        <section className="bg-slate-900/40 backdrop-blur-md p-8 lg:p-12 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group">
          <div className="relative z-10 space-y-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-l-4 border-red-500 pl-6">
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-[0.2em]">Registro de Inatividade</h2>
              <button
                type="button"
                onClick={handleAddParada}
                className="bg-[#facc15] text-black px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#facc15]/10"
              >
                + Adicionar Parada
              </button>
            </div>

            <div className="space-y-6">
              {paradas.length === 0 ? (
                <div className="bg-white/5 border-2 border-dashed border-white/5 rounded-2xl p-20 text-center group hover:border-[#facc15]/30 transition-colors">
                  <ZapOff className="w-16 h-16 text-slate-800 mx-auto mb-6 group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Nenhuma parada registrada para este turno</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {paradas.map((parada, index) => (
                    <div
                      key={index}
                      className="bg-white/5 p-4 lg:p-6 rounded-xl border border-white/5 shadow-sm flex flex-col xl:flex-row items-center gap-6 relative group hover:border-red-500/30 transition-all"
                    >
                      <div className="w-full lg:w-40">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Equipamento</label>
                        <select
                          value={parada.maquina_id}
                          onChange={e => updateParada(index, 'maquina_id', e.target.value)}
                          className="w-full bg-white/10 border-2 border-white/5 p-3 rounded-xl text-[11px] font-bold uppercase outline-none focus:border-red-500 text-white"
                        >
                          <option value="" className="bg-slate-900">Selecione</option>
                          {LISTA_EQUIPAMENTOS.map(m => (
                            <option key={m} value={m} className="bg-slate-900">{m}</option>
                          ))}
                          {maquinasDaLinha.length > 0 && <option disabled className="text-slate-500">--- Máquinas da Linha ---</option>}
                          {maquinasDaLinha.map(m => (
                            <option key={m.id} value={m.id} className="bg-slate-900">{m.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full lg:flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Motivo Detalhado</label>
                        <input
                          type="text"
                          value={parada.motivo}
                          onChange={e => updateParada(index, 'motivo', e.target.value)}
                          className="w-full bg-white/10 border-2 border-white/5 p-3 rounded-xl text-[11px] font-bold uppercase text-white focus:border-red-500 outline-none"
                          placeholder="EX: FALHA NO SENSOR"
                        />
                      </div>

                      <div className="w-full lg:w-40">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo</label>
                        <select
                          value={parada.tipo}
                          onChange={e => updateParada(index, 'tipo', e.target.value)}
                          className="w-full bg-white/10 border-2 border-white/5 p-3 rounded-xl text-[11px] font-bold uppercase outline-none focus:border-red-500 text-white"
                        >
                          <option value="" className="bg-slate-900">Selecione...</option>
                          {Object.keys(MOTIVOS_COMUNS).map(t => (
                            <option key={t} value={t} className="bg-slate-900">{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 w-full lg:w-64">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Início</label>
                          <input
                            type="time"
                            value={parada.hora_inicio}
                            onChange={e => updateParada(index, 'hora_inicio', e.target.value)}
                            className="w-full bg-white/10 border-2 border-white/5 p-3 rounded-xl text-[11px] font-bold text-white outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Fim</label>
                          <input
                            type="time"
                            value={parada.hora_fim}
                            onChange={e => updateParada(index, 'hora_fim', e.target.value)}
                            className="w-full bg-white/10 border-2 border-white/5 p-3 rounded-xl text-[11px] font-bold text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="w-full lg:w-24">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 text-center">Duração</label>
                        <div className="bg-red-500/10 p-3 rounded-xl text-center">
                          <span className="text-base font-black text-red-500">{parada.duracao}m</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveParada(index)}
                        className="p-3 text-slate-600 hover:text-red-500 transition-all shrink-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* IV. Observações / Ocorrências */}
        <section className="bg-slate-900/40 backdrop-blur-md p-8 lg:p-12 rounded-2xl border border-white/5 shadow-xl relative">
          <div className="flex items-center gap-4 mb-8 border-l-4 border-slate-500 pl-6">
            <h2 className="text-sm font-black text-slate-200 uppercase tracking-[0.2em]">Observações / Ocorrências</h2>
          </div>
          <textarea
            value={formData.observacoes}
            onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
            placeholder="Registre aqui observações relevantes, ocorrências ou detalhes adicionais do turno..."
            className="w-full p-6 bg-white/5 border-2 border-white/5 focus:border-[#facc15] focus:bg-white/10 rounded-xl text-xs font-bold text-slate-300 transition-all outline-none min-h-[150px] shadow-inner"
          />
        </section>

        <footer className="pt-10 pb-20">
          <button
            type="submit"
            disabled={saving}
            className="w-full relative group overflow-hidden bg-[#facc15] text-black font-black py-8 md:py-10 rounded-2xl shadow-2xl hover:scale-[1.01] transition-all flex items-center justify-center gap-6 disabled:opacity-50"
          >
            <div className="relative z-10 flex items-center gap-6">
              {saving ? <Loader2 className="animate-spin w-10 h-10 text-black" /> : <Save className="w-10 h-10 text-black" />}
              <span className="text-sm md:text-lg tracking-[0.5em] uppercase font-black">
                {saving ? 'Publicando...' : 'Gravar Apontamento Industrial'}
              </span>
            </div>
            <div className="absolute inset-0 bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 opacity-20" />
          </button>
        </footer>
      </form>

      {/* Modal de Registro de Paradas */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10">
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                  <Timer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Detalhamento de Parada</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronização de Motivo e Sugestões</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-3 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 md:p-10 space-y-8 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Parada</label>
                  <select
                    value={tempParada.tipo}
                    onChange={e => setTempParada({ ...tempParada, tipo: e.target.value })}
                    className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-bold uppercase outline-none focus:border-red-500 transition-all text-white"
                  >
                    <option value="" className="bg-slate-900">Selecione...</option>
                    {Object.keys(MOTIVOS_COMUNS).map(t => (
                      <option key={t} value={t} className="bg-slate-900">{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Equipamento</label>
                  <select
                    value={tempParada.maquina_id}
                    onChange={e => setTempParada({ ...tempParada, maquina_id: e.target.value })}
                    className="w-full bg-white/10 border-2 border-white/5 p-4 rounded-xl text-[11px] font-bold uppercase outline-none focus:border-red-500 transition-all text-white"
                  >
                    <option value="" className="bg-slate-900">Selecione</option>
                    {LISTA_EQUIPAMENTOS.map(m => (
                      <option key={m} value={m} className="bg-slate-900">{m}</option>
                    ))}
                    {maquinasDaLinha.length > 0 && <option disabled className="text-slate-500">--- Máquinas da Linha ---</option>}
                    {maquinasDaLinha.map(m => (
                      <option key={m.id} value={m.nome} className="bg-slate-900">{m.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-red-500" /> Início
                  </label>
                  <input
                    type="time"
                    value={tempParada.hora_inicio}
                    onChange={e => updateTempParadaTime('hora_inicio', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && horaFimRef.current?.focus()}
                    className="w-full p-4 bg-white/10 border-2 border-white/5 rounded-xl text-[11px] font-black text-white outline-none focus:border-red-500 transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Clock className="w-3 h-3 text-red-500" /> Término
                  </label>
                  <input
                    type="time"
                    ref={horaFimRef}
                    value={tempParada.hora_fim}
                    onChange={e => updateTempParadaTime('hora_fim', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && motivoRef.current?.focus()}
                    className="w-full p-4 bg-white/10 border-2 border-white/5 rounded-xl text-[11px] font-black text-white outline-none focus:border-red-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duração Calculada (Minutos)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={tempParada.duracao}
                    readOnly
                    className="w-full bg-red-500/10 border-2 border-transparent p-6 text-4xl font-black text-center text-red-500 rounded-xl outline-none"
                  />
                  <Timer className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-red-500/30" />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                  <span>Detalhes do Motivo</span>
                  <span className="text-[8px] font-bold text-red-500 animate-pulse">PADRONIZAÇÃO NEXUS</span>
                </label>

                <input
                  type="text"
                  ref={motivoRef}
                  value={tempParada.motivo}
                  onChange={e => setTempParada({ ...tempParada, motivo: e.target.value.toUpperCase() })}
                  onKeyDown={e => e.key === 'Enter' && handleSaveParada()}
                  className="w-full bg-white/10 border-2 border-white/5 p-5 text-sm font-bold placeholder-slate-600 text-white rounded-xl outline-none focus:border-red-500 transition-all"
                  placeholder="EX: FALHA NA BOMBA DE SUCÇÃO"
                />

                <div className="space-y-3 pt-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-red-500" /> Sugestões Inteligentes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tempParada.tipo && MOTIVOS_COMUNS[tempParada.tipo as keyof typeof MOTIVOS_COMUNS]?.map(motivo => (
                      <button
                        key={motivo}
                        type="button"
                        onClick={() => setTempParada({ ...tempParada, motivo: motivo.toUpperCase() })}
                        className="px-4 py-2 bg-white/5 border-2 border-white/5 rounded-full text-[10px] font-bold text-slate-400 hover:border-red-500 hover:text-red-500 transition-all active:scale-95"
                      >
                        {motivo.toUpperCase()}
                      </button>
                    ))}
                    {!tempParada.tipo && (
                      <p className="text-[9px] text-slate-700 italic">Selecione o tipo para ver sugestões...</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-8 py-4 border-2 border-white/10 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveParada}
                  className="flex-1 px-8 py-4 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-500/20"
                >
                  <CheckCircle2 className="w-4 h-4 ml-1" /> Confirmar Parada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaginaRegistro;
