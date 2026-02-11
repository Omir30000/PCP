import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import {
    FileText,
    Search,
    Filter,
    Calendar,
    Loader2,
    X,
    Save,
    Trash2,
    AlertTriangle,
    Clock,
    Plus,
    AlertOctagon
} from 'lucide-react';
import { RegistroProducao, Linha, Produto } from './types/database';

// Tipagem estendida para Paradas com horários
interface ParadaCompleta {
    id?: string; // ID temporário para lista
    hora_inicio?: string; // HH:mm
    hora_fim?: string; // HH:mm
    tipo?: string; // Planejada, Não Planejada, etc.
    maquina?: string; // Nome da máquina
    duracao: string | number; // número ou "10min"
    motivo: string;
    maquina_id?: string;
}

// Estendendo o tipo para incluir as propriedades resolvidas manualmente e paradas tipadas
type RegistroExpandido = RegistroProducao & {
    nome_linha?: string;
    nome_produto?: string;
    paradas_detalhadas?: ParadaCompleta[];
};

const RelatorioRegistros: React.FC = () => {
    const [registros, setRegistros] = useState<RegistroExpandido[]>([]);
    const [loading, setLoading] = useState(false);

    // Datas padrão: Hoje
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

    const [linhaFiltro, setLinhaFiltro] = useState('');

    // Maps para lookup (ID ou Nome -> Objeto)
    const [linhasMap, setLinhasMap] = useState<Record<string, string>>({});
    const [produtosMap, setProdutosMap] = useState<Record<string, string>>({});
    const [linhasOpcoes, setLinhasOpcoes] = useState<Linha[]>([]);
    const [produtosOpcoes, setProdutosOpcoes] = useState<Produto[]>([]);
    const [maquinasOpcoes, setMaquinasOpcoes] = useState<any[]>([]);

    // Estado do Modal de Edição
    const [editingRecord, setEditingRecord] = useState<RegistroExpandido | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Estado para Nova Parada no Modal
    const [novaParada, setNovaParada] = useState<ParadaCompleta>({ tipo: '', hora_inicio: '', hora_fim: '', duracao: 0, motivo: '', maquina_id: '' });
    const [editingParadaIndex, setEditingParadaIndex] = useState<number | null>(null);

    useEffect(() => {
        loadAuxiliaryData();
    }, []);

    // Busca dados de apoio (Linhas e Produtos) para fazer o "Join" no frontend
    const loadAuxiliaryData = async () => {
        try {
            const [linesRes, productsRes, machinesRes] = await Promise.all([
                supabase.from('linhas').select('*').order('nome'),
                supabase.from('produtos').select('*').order('nome'),
                supabase.from('maquinas').select('*')
            ]);

            if (linesRes.data) {
                setLinhasOpcoes(linesRes.data);
                const lMap: Record<string, string> = {};
                linesRes.data.forEach(l => {
                    lMap[l.id] = l.nome;
                    lMap[l.nome] = l.nome;
                });
                setLinhasMap(lMap);
            }

            if (productsRes.data) {
                setProdutosOpcoes(productsRes.data);
                const pMap: Record<string, string> = {};
                productsRes.data.forEach(p => {
                    pMap[p.id] = p.nome;
                    pMap[p.nome] = p.nome;
                });
                setProdutosMap(pMap);
            }

            if (machinesRes.data) {
                setMaquinasOpcoes(machinesRes.data);
            }

            fetchData();
        } catch (err) {
            console.error("Erro ao carregar dados auxiliares:", err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('registros_producao')
                .select('*')
                .gte('data_registro', dataInicio)
                .lte('data_registro', dataFim)
                .order('data_registro', { ascending: false })
                .order('created_at', { ascending: false });

            if (linhaFiltro) {
                query = query.eq('linha_producao', linhaFiltro);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                const enrichedData: RegistroExpandido[] = data.map((reg: RegistroProducao) => ({
                    ...reg,
                    nome_linha: linhasMap[reg.linha_producao] || reg.linha_producao || '-',
                    nome_produto: produtosMap[reg.produto_volume] || reg.produto_volume || '-',
                    paradas_detalhadas: (reg.paradas as any) || []
                }));

                setRegistros(enrichedData);
            } else {
                setRegistros([]);
            }

        } catch (error: any) {
            console.error('Erro ao buscar registros:', error);
            alert(`Erro ao buscar dados: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData();
    };

    // Helper para encontrar ID correto (Resolve bug de select vazio)
    const findValueForSelect = (value: string | undefined, options: { id: string, nome: string }[]) => {
        if (!value) return "";
        // Tenta achar pelo ID
        const byId = options.find(o => o.id === value);
        if (byId) return byId.id;
        // Tenta achar pelo Nome
        const byName = options.find(o => o.nome === value);
        if (byName) return byName.id;

        return ""; // Se não achar, retorna vazio ou poderia retornar o próprio value se fosse 'text'
    };

    const handleEditClick = (record: RegistroExpandido) => {
        // Prepara paradas
        const paradasIniciais = Array.isArray(record.paradas) ? record.paradas.map((p: any) => ({
            ...p,
            // Normaliza nomes de campos se necessário
            hora_inicio: p.hora_inicio || p.inicio || '',
            hora_fim: p.hora_fim || p.fim || '',
            id: p.id || Math.random().toString(36).substr(2, 9)
        })) : [];

        setEditingRecord({
            ...record,
            // Ajusta referencias para os selects funcionarem
            linha_producao: findValueForSelect(record.linha_producao, linhasOpcoes) || record.linha_producao,
            produto_volume: findValueForSelect(record.produto_volume, produtosOpcoes) || record.produto_volume,
            paradas_detalhadas: (paradasIniciais as unknown) as ParadaCompleta[]
        });
        setNovaParada({ tipo: '', hora_inicio: '', hora_fim: '', duracao: 0, motivo: '', maquina_id: '' });
    };

    const handleCloseModal = () => {
        setEditingRecord(null);
        setIsSaving(false);
        setNovaParada({ tipo: '', hora_inicio: '', hora_fim: '', duracao: 0, motivo: '', maquina_id: '' });
        setEditingParadaIndex(null);
    };

    // --- Lógica de Paradas ---
    const parseMinutos = (val: any): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        const match = String(val).match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    };

    const calculateDuration = (inicio: string, fim: string) => {
        if (!inicio || !fim) return 0;
        const [h1, m1] = inicio.split(':').map(Number);
        const [h2, m2] = fim.split(':').map(Number);
        const minutos1 = h1 * 60 + m1;
        const minutos2 = h2 * 60 + m2;

        let diff = minutos2 - minutos1;
        if (diff < 0) diff += 24 * 60; // Passou da meia-noite (simplificado)
        return diff;
    };

    const calculateFim = (inicio: string, duracaoMinutos: number) => {
        if (!inicio) return '';
        const [h1, m1] = inicio.split(':').map(Number);
        let totalMin = h1 * 60 + m1 + duracaoMinutos;

        const h2 = Math.floor(totalMin / 60) % 24;
        const m2 = totalMin % 60;

        return `${h2.toString().padStart(2, '0')}:${m2.toString().padStart(2, '0')}`;
    };

    const handleSaveParada = () => {
        if (!novaParada.tipo || !novaParada.hora_inicio || !novaParada.hora_fim || !novaParada.motivo) {
            alert("Preencha Tipo, Início, Fim e Motivo");
            return;
        }

        if (!editingRecord) return;

        const duracao = calculateDuration(novaParada.hora_inicio, novaParada.hora_fim);
        const paradaToSave = { ...novaParada, duracao };

        let novasParadas = [...(editingRecord.paradas_detalhadas || [])];

        if (editingParadaIndex !== null) {
            // Edição
            novasParadas[editingParadaIndex] = { ...paradaToSave, id: novasParadas[editingParadaIndex].id || Math.random().toString(36).substr(2, 9) };
        } else {
            // Adição
            novasParadas.push({ ...paradaToSave, id: Math.random().toString(36).substr(2, 9) });
        }

        setEditingRecord({ ...editingRecord, paradas_detalhadas: novasParadas });
        setNovaParada({ tipo: '', hora_inicio: '', hora_fim: '', duracao: 0, motivo: '', maquina_id: '' });
        setEditingParadaIndex(null);
    };

    const handleEditParada = (index: number) => {
        if (!editingRecord || !editingRecord.paradas_detalhadas) return;

        const parada = editingRecord.paradas_detalhadas[index];
        setNovaParada({
            tipo: parada.tipo || '',
            hora_inicio: parada.hora_inicio || '',
            hora_fim: parada.hora_fim || '',
            duracao: parada.duracao || 0,
            motivo: parada.motivo || '',
            // Tenta maquina_id primeiro, se não houver usa maquina (que pode ser o nome/id salvo)
            maquina_id: parada.maquina_id || parada.maquina || ''
        });
        setEditingParadaIndex(index);
    };

    const handleRemoveParada = (index: number) => {
        if (!editingRecord) return;
        const novasParadas = [...(editingRecord.paradas_detalhadas || [])];
        novasParadas.splice(index, 1);
        setEditingRecord({ ...editingRecord, paradas_detalhadas: novasParadas });

        // Se estava editando o item removido, cancela edição
        if (editingParadaIndex === index) {
            setNovaParada({ tipo: '', hora_inicio: '', hora_fim: '', duracao: 0, motivo: '', maquina_id: '' });
            setEditingParadaIndex(null);
        }
    };

    const getHorariosFormatados = (parada: ParadaCompleta) => {
        if (parada.hora_inicio && parada.hora_fim) {
            return `${parada.hora_inicio} - ${parada.hora_fim}`;
        }
        if (parada.hora_inicio && parada.duracao) {
            const fimCalculado = calculateFim(parada.hora_inicio, parseMinutos(parada.duracao));
            return `${parada.hora_inicio} - ${fimCalculado}`;
        }
        return '--:--';
    };

    // -------------------------

    const handleSaveRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('🔵 handleSaveRecord INICIADO');

        if (!editingRecord) {
            console.log('❌ Nenhum registro em edição');
            return;
        }

        console.log('📝 Registro em edição:', editingRecord.id);
        setIsSaving(true);

        try {
            // Helper para validar UUID
            const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

            const selectedLinha = linhasOpcoes.find(l => l.id === editingRecord.linha_producao);
            const selectedProduto = produtosOpcoes.find(p => p.id === editingRecord.produto_volume);

            console.log('🔍 Linha selecionada:', selectedLinha);
            console.log('🔍 Produto selecionado:', selectedProduto);
            const payload = {
                data_registro: editingRecord.data_registro,
                turno: editingRecord.turno,
                linha_producao: selectedLinha?.nome || editingRecord.linha_producao,
                linha_id: selectedLinha?.id || editingRecord.linha_id,
                produto_volume: selectedProduto?.nome || editingRecord.produto_volume,
                produto_id: selectedProduto?.id || editingRecord.produto_id,
                lote: editingRecord.lote || null,
                quantidade_produzida: Number(editingRecord.quantidade_produzida) || 0,
                carga_horaria: Number(editingRecord.carga_horaria) || 8,
                observacoes: editingRecord.observacoes || null,
                capacidade_producao: Number(selectedProduto?.capacidade_nominal || editingRecord.capacidade_producao) || null,
                paradas: (editingRecord.paradas_detalhadas || []).map(p => {
                    // Remove o ID temporário antes de salvar no banco de dados (JSONB)
                    const { id, ...rest } = p;
                    return {
                        ...rest,
                        tipo: p.tipo || "Não Planejada",
                        maquina: p.maquina_id || p.maquina || "GERAL",
                        motivo: p.motivo || "NÃO INFORMADO",
                        duracao: typeof p.duracao === 'number' ? `${p.duracao}min` : (p.duracao || "0min"),
                        hora_inicio: p.hora_inicio || null,
                        hora_fim: p.hora_fim || null
                    };
                })
            };

            // Calcula eficiência para persistência (coluna eficiencia_calculada numeric)
            const eficiencia = (payload.capacidade_producao && payload.capacidade_producao > 0)
                ? (payload.quantidade_produzida / payload.capacidade_producao) * 100
                : 0;

            (payload as any).eficiencia_calculada = Number(eficiencia.toFixed(2));

            console.log('📦 Payload preparado:', payload);
            console.log('🚀 Enviando para Supabase...');

            const { data, error } = await supabase
                .from('registros_producao')
                .update(payload)
                .eq('id', editingRecord.id)
                .select();

            console.log('📥 Resposta do Supabase - Data:', data);
            console.log('📥 Resposta do Supabase - Error:', JSON.stringify(error, null, 2));

            if (error) throw error;

            if (!data || data.length === 0) {
                console.warn("⚠️ Update realizado, mas nenhum dado retornado (possível RLS). Usando payload local.");
            }

            const updatedRow = (data && data.length > 0) ? data[0] : { ...editingRecord, ...payload, id: editingRecord.id };

            setRegistros(prev => prev.map(r => r.id === editingRecord.id ? {
                ...updatedRow,
                // Recalcula nomes para exibição na tabela se necessário
                nome_linha: linhasMap[updatedRow.linha_id || updatedRow.linha_producao] || updatedRow.linha_producao || r.nome_linha || '-',
                nome_produto: produtosMap[updatedRow.produto_id || updatedRow.produto_volume] || updatedRow.produto_volume || r.nome_produto || '-',
                paradas_detalhadas: (updatedRow.paradas as any) || payload.paradas || []
            } : r));

            handleCloseModal();
            alert('Registro salvo com sucesso!');
        } catch (err: any) {
            console.error('❌ Erro ao atualizar registro:', JSON.stringify(err, null, 2));
            const msg = err.message || JSON.stringify(err);
            alert(`Falha ao salvar: ${msg}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRecord = async () => {
        if (!editingRecord) return;
        if (!window.confirm('Tem certeza que deseja EXCLUIR este registro? Esta ação não pode ser desfeita.')) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('registros_producao')
                .delete()
                .eq('id', editingRecord.id);

            if (error) throw error;

            setRegistros(prev => prev.filter(r => r.id !== editingRecord.id));
            handleCloseModal();
            alert('Registro excluído com sucesso!');
        } catch (err: any) {
            console.error('Erro ao excluir registro:', err);
            alert(`Falha ao excluir: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 backdrop-blur-sm p-6 rounded-3xl border border-white/5">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <FileText className="text-blue-500" />
                        Relatório de Produção
                    </h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                        Histórico detalhado de apontamentos
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <form onSubmit={handleSearch} className="bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-blue-500" /> Data Início
                    </label>
                    <input
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="w-3 h-3 text-blue-500" /> Data Fim
                    </label>
                    <input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Filter className="w-3 h-3 text-blue-500" /> Linha (Opcional)
                    </label>
                    <select
                        value={linhaFiltro}
                        onChange={(e) => setLinhaFiltro(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                    >
                        <option value="">Todas as Linhas</option>
                        {linhasOpcoes.map(l => (
                            <option key={l.id} value={l.id}>{l.nome}</option>
                        ))}
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-[46px]"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Filtrar
                </button>
            </form>

            {/* Tabela */}
            <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-white/10">
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Data</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Turno</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Linha</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Produto</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Lote</th>
                                <th className="p-4 text-[10px] font-black text-blue-400 uppercase tracking-widest text-right whitespace-nowrap">Produzido</th>
                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Eficiência</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {registros.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                                        {loading ? 'Carregando registros...' : 'Nenhum registro encontrado para o período.'}
                                    </td>
                                </tr>
                            ) : (
                                registros.map((reg) => {
                                    const eficiencia = reg.capacidade_producao && reg.capacidade_producao > 0
                                        ? ((reg.quantidade_produzida || 0) / reg.capacidade_producao) * 100
                                        : 0;

                                    return (
                                        <tr
                                            key={reg.id}
                                            onClick={() => handleEditClick(reg)}
                                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                                            title="Clique para editar"
                                        >
                                            <td className="p-4 text-xs font-bold text-slate-300 whitespace-nowrap group-hover:text-white">
                                                {reg.data_registro ? new Date(reg.data_registro).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-300 whitespace-nowrap uppercase">
                                                {reg.turno}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-white whitespace-nowrap uppercase">
                                                {reg.nome_linha}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-300 whitespace-nowrap uppercase">
                                                {reg.nome_produto}
                                            </td>
                                            <td className="p-4 text-xs font-mono font-bold text-slate-400 whitespace-nowrap uppercase">
                                                {reg.lote || '-'}
                                            </td>
                                            <td className="p-4 text-sm font-black text-blue-400 text-right whitespace-nowrap group-hover:text-blue-300">
                                                {reg.quantidade_produzida?.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-right whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-[10px] ${eficiencia >= 90 ? 'bg-emerald-500/20 text-emerald-400' :
                                                    eficiencia >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {eficiencia.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE EDIÇÃO */}
            {editingRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#1a1a1a] z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-wider">Editar Registro</h2>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{editingRecord.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveRecord} className="flex flex-col max-h-full">
                            <div className="p-6 md:p-8 space-y-8 overflow-y-auto">

                                {/* Seção Principal */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</label>
                                        <input
                                            type="date"
                                            required
                                            value={editingRecord.data_registro}
                                            onChange={e => setEditingRecord({ ...editingRecord, data_registro: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Turno</label>
                                        <select
                                            value={editingRecord.turno}
                                            onChange={e => setEditingRecord({ ...editingRecord, turno: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                                        >
                                            <option value="1º Turno" className="text-slate-900">1º TURNO</option>
                                            <option value="2º Turno" className="text-slate-900">2º TURNO</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linha</label>
                                        <select
                                            value={editingRecord.linha_producao}
                                            onChange={e => setEditingRecord({ ...editingRecord, linha_producao: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                                        >
                                            <option value="" className="text-slate-900">Selecione...</option>
                                            {linhasOpcoes.map(l => (
                                                <option key={l.id} value={l.id} className="text-slate-900">{l.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</label>
                                        <select
                                            value={editingRecord.produto_volume}
                                            onChange={e => setEditingRecord({ ...editingRecord, produto_volume: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                                        >
                                            <option value="" className="text-slate-900">Selecione...</option>
                                            {produtosOpcoes.map(p => (
                                                <option key={p.id} value={p.id} className="text-slate-900">{p.nome}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lote</label>
                                        <input
                                            type="text"
                                            value={editingRecord.lote || ''}
                                            onChange={e => setEditingRecord({ ...editingRecord, lote: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold font-mono"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carga Horária (h)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={editingRecord.carga_horaria || 0}
                                            onChange={e => setEditingRecord({ ...editingRecord, carga_horaria: Number(e.target.value) })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                                        />
                                    </div>
                                </div>

                                {/* Seção Produção e Perdas */}
                                <div className="grid grid-cols-1 gap-6 pt-4 border-t border-white/5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Produzido (UN)</label>
                                        <input
                                            type="number"
                                            value={editingRecord.quantidade_produzida}
                                            onChange={e => setEditingRecord({ ...editingRecord, quantidade_produzida: Number(e.target.value) })}
                                            className="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-4 text-xl font-black text-blue-400 focus:border-blue-500 outline-none transition-all text-center"
                                        />
                                    </div>
                                </div>

                                {/* Seção de Paradas (Downtime) */}
                                <div className="space-y-6 pt-4 border-t border-white/5">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                            <AlertOctagon className="w-4 h-4 text-amber-500" />
                                            Paradas / Downtime
                                        </h3>
                                    </div>

                                    {/* Formulário de Nova Parada */}
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Máquina</label>
                                                <select
                                                    value={novaParada.maquina_id}
                                                    onChange={e => setNovaParada(p => ({ ...p, maquina_id: e.target.value }))}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white uppercase font-bold outline-none"
                                                >
                                                    <option value="" className="text-slate-900">Geral</option>
                                                    {[
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
                                                        'INJETOR DE ESSENCIA'
                                                    ].map(m => (
                                                        <option key={m} value={m} className="text-slate-900">{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                                                <select
                                                    value={novaParada.tipo}
                                                    onChange={e => setNovaParada(p => ({ ...p, tipo: e.target.value }))}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white uppercase font-bold outline-none"
                                                >
                                                    <option value="" className="text-slate-900">Selecione...</option>
                                                    {[
                                                        'FALHA DE ENERGIA',
                                                        'FALTA DE COLABORADOR',
                                                        'FALTA DE MATERIA PRIMA',
                                                        'LIMPEZA DE MÁQUINA',
                                                        'MANUTENÇÃO',
                                                        'PALESTRA/REUNIÃO',
                                                        'SETUP (Preparação de máquina)',
                                                        'PARADA PROGRAMADA',
                                                        'OUTROS',
                                                        'ASSISTENCIA TÉCNICA'
                                                    ].map(t => (
                                                        <option key={t} value={t} className="text-slate-900">{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Início</label>
                                                <input
                                                    type="time"
                                                    value={novaParada.hora_inicio}
                                                    onChange={e => setNovaParada(p => ({ ...p, hora_inicio: e.target.value }))}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white uppercase font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fim</label>
                                                <input
                                                    type="time"
                                                    value={novaParada.hora_fim}
                                                    onChange={e => setNovaParada(p => ({ ...p, hora_fim: e.target.value }))}
                                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white uppercase font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Duração</label>
                                                <div className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                                    <Clock className="w-3 h-3" />
                                                    {calculateDuration(novaParada.hora_inicio || '', novaParada.hora_fim || '')} min
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                placeholder="MOTIVO DA PARADA..."
                                                value={novaParada.motivo}
                                                onChange={e => setNovaParada(p => ({ ...p, motivo: e.target.value }))}
                                                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 uppercase font-bold"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSaveParada}
                                                className={`px-4 py-2 font-black uppercase text-[10px] tracking-wider rounded-lg flex items-center gap-2 ${editingParadaIndex !== null
                                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                                                    : 'bg-amber-500 hover:bg-amber-400 text-black'
                                                    }`}
                                            >
                                                {editingParadaIndex !== null ? (
                                                    <><Save className="w-3 h-3" /> Confirmar Edição</>
                                                ) : (
                                                    <><Plus className="w-3 h-3" /> Adicionar</>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista de Paradas */}
                                    <div className="space-y-2">
                                        {editingRecord.paradas_detalhadas && editingRecord.paradas_detalhadas.length > 0 ? (
                                            editingRecord.paradas_detalhadas.map((parada, idx) => (
                                                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border hover:bg-white/10 group transition-all ${editingParadaIndex === idx ? 'bg-white/10 border-blue-500/50' : 'bg-white/5 border-white/5'
                                                    }`}>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-amber-500 font-mono font-bold text-xs">{getHorariosFormatados(parada)}</span>
                                                        <div className="flex flex-col">
                                                            <span className="text-white font-bold text-xs uppercase">{parada.motivo}</span>
                                                            {(parada.maquina || parada.maquina_id) && (
                                                                <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">
                                                                    Máquina: {parada.maquina || maquinasOpcoes.find(m => m.id === parada.maquina_id)?.nome || 'Não Identificada'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{parada.duracao} min</span>

                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditParada(idx)}
                                                                className="text-slate-600 hover:text-blue-500 transition-colors"
                                                                title="Editar Parada"
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveParada(idx)}
                                                                className="text-slate-600 hover:text-red-500 transition-colors"
                                                                title="Remover Parada"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest py-4 bg-white/5 rounded-lg border-2 border-dashed border-white/5">
                                                Nenhuma parada registrada
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Seção de Observações */}
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <FileText className="w-3 h-3 text-blue-500" /> Observações / Ocorrências
                                    </label>
                                    <textarea
                                        value={editingRecord.observacoes || ''}
                                        onChange={e => setEditingRecord({ ...editingRecord, observacoes: e.target.value })}
                                        placeholder="Registre aqui observações relevantes..."
                                        className="w-full p-4 bg-black/20 border border-white/10 rounded-xl text-xs font-bold text-slate-300 transition-all outline-none min-h-[100px] focus:border-blue-500"
                                    />
                                </div>

                                {/* Modal Footer */}
                                <div className="flex items-center justify-between gap-4 pt-6 mt-6 border-t border-white/5 sticky bottom-0 bg-[#1a1a1a] z-50">
                                    <button
                                        type="button"
                                        onClick={handleDeleteRecord}
                                        disabled={isSaving}
                                        className="px-6 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold uppercase tracking-widest text-xs hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Excluir
                                    </button>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleCloseModal}
                                            disabled={isSaving}
                                            className="px-6 py-3 rounded-xl bg-white/5 text-slate-400 font-bold uppercase tracking-widest text-xs hover:bg-white/10 hover:text-white transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold uppercase tracking-widest text-xs hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Salvar Alterações
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </form>
                    </div>
                </div>
            )}

        </div >
    );
};

export default RelatorioRegistros;
