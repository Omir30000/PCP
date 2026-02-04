import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import {
    FileText,
    Search,
    Download,
    Filter,
    Calendar,
    ChevronDown,
    ChevronUp,
    Loader2,
    AlertTriangle
} from 'lucide-react';
import { RegistroProducao, Linha, Produto } from './types/database';

// Estendendo o tipo para incluir os joins se necessário, 
// mas o supabase js client geralmente retorna um objeto mesclado ou aninhado
// dependendo da query. Vamos tipar de forma flexível inicialmente.
type RegistroComJoin = RegistroProducao & {
    linhas: { nome: string } | null;
    produtos: { nome: string } | null;
};

const RelatorioRegistros: React.FC = () => {
    const [registros, setRegistros] = useState<RegistroComJoin[]>([]);
    const [loading, setLoading] = useState(false);
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);

    // Filtros adicionais (opcional, mas bom ter estrutura)
    const [linhaFiltro, setLinhaFiltro] = useState('');
    const [linhasOpcoes, setLinhasOpcoes] = useState<Linha[]>([]);

    useEffect(() => {
        // Carregar opções de filtros se necessário
        const loadFilters = async () => {
            const { data } = await supabase.from('linhas').select('*').order('nome');
            if (data) setLinhasOpcoes(data);
        };
        loadFilters();
        // Carregar dados iniciais
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('registros_producao')
                .select(`
          *,
          linhas:linha_producao(nome),
          produtos:produto_volume(nome)
        `)
                .gte('data_registro', dataInicio)
                .lte('data_registro', dataFim)
                .order('data_registro', { ascending: false })
                .order('created_at', { ascending: false });

            if (linhaFiltro) {
                query = query.eq('linha_producao', linhaFiltro);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Cast forçado pois o tipo retornado pelo select com join é complexo
            if (data) setRegistros(data as any);

        } catch (error) {
            console.error('Erro ao buscar registros:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchData();
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
                                    // Cálculo de eficiência simples (Exemplo: Produzido / (Produzido + Perda))
                                    // Ajuste conforme regra de negócio correta
                                    const total = (reg.quantidade_produzida || 0) + (reg.quantidade_perda || 0);
                                    const eficiencia = total > 0 ? ((reg.quantidade_produzida || 0) / total) * 100 : 0;

                                    return (
                                        <tr key={reg.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-xs font-bold text-slate-300 whitespace-nowrap">
                                                {new Date(reg.data_registro).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-300 whitespace-nowrap uppercase">
                                                {reg.turno}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-white whitespace-nowrap uppercase">
                                                {reg.linhas?.nome || '-'}
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-300 whitespace-nowrap uppercase">
                                                {reg.produtos?.nome || '-'}
                                            </td>
                                            <td className="p-4 text-xs font-mono font-bold text-slate-400 whitespace-nowrap uppercase">
                                                {reg.lote || '-'}
                                            </td>
                                            <td className="p-4 text-sm font-black text-blue-400 text-right whitespace-nowrap">
                                                {reg.quantidade_produzida?.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-sm font-black text-red-400 text-right whitespace-nowrap">
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

        </div>
    );
};

export default RelatorioRegistros;
