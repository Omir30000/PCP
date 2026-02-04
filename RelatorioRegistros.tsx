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
    CheckCircle2
} from 'lucide-react';
import { RegistroProducao, Linha, Produto } from './types/database';

// Estendendo o tipo para incluir as propriedades resolvidas manualmente
type RegistroExpandido = RegistroProducao & {
    nome_linha?: string;
    nome_produto?: string;
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

    // Estado do Modal de Edição
    const [editingRecord, setEditingRecord] = useState<RegistroExpandido | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadAuxiliaryData();
    }, []);

    // Busca dados de apoio (Linhas e Produtos) para fazer o "Join" no frontend
    const loadAuxiliaryData = async () => {
        try {
            const [linesRes, productsRes] = await Promise.all([
                supabase.from('linhas').select('*').order('nome'),
                supabase.from('produtos').select('*').order('nome')
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

            fetchData();
        } catch (err) {
            console.error("Erro ao carregar dados auxiliares:", err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Setup da query SEM joins complexos
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
                // Enriquecer os dados manualmente usando os mapas
                const enrichedData: RegistroExpandido[] = data.map((reg: RegistroProducao) => ({
                    ...reg,
                    nome_linha: linhasMap[reg.linha_producao] || reg.linha_producao || '-',
                    nome_produto: produtosMap[reg.produto_volume] || reg.produto_volume || '-'
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

    const handleEditClick = (record: RegistroExpandido) => {
        setEditingRecord({ ...record });
    };

    const handleCloseModal = () => {
        setEditingRecord(null);
        setIsSaving(false);
    };

    const handleSaveRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRecord) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('registros_producao')
                .update({
                    data_registro: editingRecord.data_registro,
                    turno: editingRecord.turno,
                    linha_producao: editingRecord.linha_producao,
                    produto_volume: editingRecord.produto_volume,
                    lote: editingRecord.lote,
                    quantidade_produzida: editingRecord.quantidade_produzida,
                    quantidade_perda: editingRecord.quantidade_perda,
                    carga_horaria: editingRecord.carga_horaria
                })
                .eq('id', editingRecord.id);

            if (error) throw error;

            // Atualiza a lista localmente
            setRegistros(prev => prev.map(r => r.id === editingRecord.id ? {
                ...editingRecord,
                nome_linha: linhasMap[editingRecord.linha_producao] || editingRecord.linha_producao || '-',
                nome_produto: produtosMap[editingRecord.produto_volume] || editingRecord.produto_volume || '-'
            } : r));

            handleCloseModal();
            alert('Registro atualizado com sucesso!');
        } catch (err: any) {
            console.error('Erro ao atualizar registro:', err);
            alert(`Falha ao atualizar: ${err.message}`);
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
                                <th className="p-4 text-[10px] font-black text-red-400 uppercase tracking-widest text-right whitespace-nowrap">Perdas</th>
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
                                    const total = (reg.quantidade_produzida || 0) + (reg.quantidade_perda || 0);
                                    const eficiencia = total > 0 ? ((reg.quantidade_produzida || 0) / total) * 100 : 0;

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
                                            <td className="p-4 text-sm font-black text-red-400 text-right whitespace-nowrap group-hover:text-red-300">
                                                {reg.quantidade_perda?.toLocaleString()}
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
                        <form onSubmit={handleSaveRecord} className="p-6 md:p-8 space-y-6">

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
                                        <option value="1º Turno">1º TURNO</option>
                                        <option value="2º Turno">2º TURNO</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linha</label>
                                    <select
                                        value={editingRecord.linha_producao}
                                        onChange={e => setEditingRecord({ ...editingRecord, linha_producao: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all uppercase font-bold"
                                    >
                                        <option value="">Selecione...</option>
                                        {linhasOpcoes.map(l => (
                                            <option key={l.id} value={l.id}>{l.nome}</option>
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
                                        <option value="">Selecione...</option>
                                        {produtosOpcoes.map(p => (
                                            <option key={p.id} value={p.id}>{p.nome}</option>
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

                            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Produzido (UN)</label>
                                    <input
                                        type="number"
                                        value={editingRecord.quantidade_produzida}
                                        onChange={e => setEditingRecord({ ...editingRecord, quantidade_produzida: Number(e.target.value) })}
                                        className="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-4 text-xl font-black text-blue-400 focus:border-blue-500 outline-none transition-all text-center"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-red-400 uppercase tracking-widest">Perdas (UN)</label>
                                    <input
                                        type="number"
                                        value={editingRecord.quantidade_perda}
                                        onChange={e => setEditingRecord({ ...editingRecord, quantidade_perda: Number(e.target.value) })}
                                        className="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-4 text-xl font-black text-red-400 focus:border-red-500 outline-none transition-all text-center"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-between gap-4 pt-6 border-t border-white/5">
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

                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default RelatorioRegistros;
