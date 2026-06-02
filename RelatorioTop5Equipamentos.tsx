
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Linha } from './types/database';
import {
  Calendar,
  Loader2,
  Gauge,
  TrendingUp,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useToast } from './lib/toast';

const parseMinutos = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

interface EquipamentoStats {
  nome: string;
  totalMinutos: number;
  ocorrencias: number;
}

const Speedometro: React.FC<{ nome: string; minutos: number; maxMinutos: number }> = ({ nome, minutos, maxMinutos }) => {
  const raio = 70;
  const espessura = 12;
  const centro = raio + espessura;
  const tamanho = centro * 2;
  const anguloMax = 180;
  const proporcao = maxMinutos > 0 ? Math.min(minutos / maxMinutos, 1) : 0;
  const angulo = proporcao * anguloMax;

  const polarToCartesian = (cx: number, cy: number, r: number, angDeg: number) => {
    const rad = ((angDeg - 180) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const descricaoArco = (inicio: number, fim: number, r: number) => {
    const p1 = polarToCartesian(centro, centro, r, inicio);
    const p2 = polarToCartesian(centro, centro, r, fim);
    const large = fim - inicio > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  };

  const cor = proporcao > 0.7 ? '#ef4444' : proporcao > 0.4 ? '#facc15' : '#22c55e';

  const horas = Math.floor(minutos / 60);
  const minsRestantes = Math.round(minutos % 60);

  return (
    <div className="flex flex-col items-center">
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
        <path d={descricaoArco(0, anguloMax, raio)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={espessura} strokeLinecap="round" />
        <path d={descricaoArco(0, angulo, raio)} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round" style={{ transition: 'all 0.8s ease-out' }} />
        <line
          x1={centro} y1={centro}
          x2={polarToCartesian(centro, centro, raio - espessura, angulo).x}
          y2={polarToCartesian(centro, centro, raio - espessura, angulo).y}
          stroke={cor} strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: 'all 0.8s ease-out' }}
        />
        <circle cx={centro} cy={centro} r="4" fill={cor} />
        <text x={centro} y={centro + 28} textAnchor="middle" fill="white" fontSize="16" fontWeight="900" fontFamily="monospace">
          {horas}h{minsRestantes}m
        </text>
        <text x={centro} y={centro + 44} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="700" fontFamily="monospace" letterSpacing="2">
          DOWNTIME
        </text>
      </svg>
      <span className="text-[10px] font-black text-white uppercase tracking-widest text-center mt-1 truncate max-w-[120px]">{nome}</span>
    </div>
  );
};

const RelatorioTop5Equipamentos: React.FC = () => {
  const { toast } = useToast();
  const getHoje = () => new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getHoje());
  const [linhaId, setLinhaId] = useState<string>('todos');
  const [turno, setTurno] = useState<string>('todos');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(false);
  const [equipamentos, setEquipamentos] = useState<EquipamentoStats[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [regsRes, linhasRes] = await Promise.all([
        supabase
          .from('registros_producao')
          .select('*')
          .gte('data_registro', dataInicio)
          .lte('data_registro', dataFim),
        supabase.from('linhas').select('*').order('nome')
      ]);

      if (linhasRes.data) setLinhas(linhasRes.data);
      if (regsRes.error) throw regsRes.error;

      const registros = (regsRes.data || []).filter(r => {
        if (turno !== 'todos' && r.turno !== turno) return false;
        if (linhaId !== 'todos' && r.linha_id !== linhaId) return false;
        return true;
      });

      const mapa = new Map<string, { totalMin: number; ocorr: number }>();

      registros.forEach(r => {
        const paradas = Array.isArray(r.paradas) ? r.paradas : [];
        paradas.forEach((p: any) => {
          const nome = p.maquina || p.maquina_id || p.equipamento || 'GERAL';
          const dur = parseMinutos(p.duracao || p.tempo || p.total_min || 0);
          if (dur <= 0) return;
          const existing = mapa.get(nome);
          if (existing) {
            existing.totalMin += dur;
            existing.ocorr += 1;
          } else {
            mapa.set(nome, { totalMin: dur, ocorr: 1 });
          }
        });
      });

      const sorted = Array.from(mapa.entries())
        .map(([nome, stats]) => ({ nome, totalMinutos: stats.totalMin, ocorrencias: stats.ocorr }))
        .sort((a, b) => b.totalMinutos - a.totalMinutos)
        .slice(0, 5);

      setEquipamentos(sorted);
    } catch (err: any) {
      toast('Erro ao carregar dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const maxMinutos = equipamentos.length > 0 ? equipamentos[0].totalMinutos : 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 w-full max-w-[98%] mx-auto font-sans">
      <div className="bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-red-500 p-3 rounded-xl shadow-lg shadow-red-500/20">
              <Gauge className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Top 5 Equipamentos Críticos</h2>
              <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Acelerômetro de Downtime
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/5">
              <Calendar className="w-4 h-4 text-red-400" />
              <div className="flex items-center gap-1">
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="bg-transparent text-[10px] font-bold outline-none text-white w-24 cursor-pointer" />
                <span className="text-slate-500 text-[10px]">-</span>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-[10px] font-bold outline-none text-white w-24 cursor-pointer" />
              </div>
            </div>

            <select value={turno} onChange={e => setTurno(e.target.value)} className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase outline-none cursor-pointer text-white">
              <option value="todos" className="bg-slate-900">Todos Turnos</option>
              <option value="1º Turno" className="bg-slate-900">1º Turno</option>
              <option value="2º Turno" className="bg-slate-900">2º Turno</option>
            </select>

            <select value={linhaId} onChange={e => setLinhaId(e.target.value)} className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase outline-none cursor-pointer text-white">
              <option value="todos" className="bg-slate-900">Todas Linhas</option>
              {linhas.map(l => <option key={l.id} value={l.id} className="bg-slate-900">{l.nome}</option>)}
            </select>

            <button onClick={fetchData} disabled={loading} className="bg-red-500 text-white px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center gap-2">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              Analisar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center text-slate-500">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-red-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Processando...</span>
        </div>
      ) : equipamentos.length === 0 ? (
        <div className="py-32 text-center bg-slate-900/40 backdrop-blur-md rounded-2xl border border-dashed border-white/10">
          <Gauge className="w-12 h-12 text-slate-800 mx-auto mb-4" />
          <p className="text-slate-600 font-black uppercase tracking-widest text-xs">Nenhum downtime no período</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {equipamentos.map((eq, idx) => (
            <div key={eq.nome} className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-4 flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-[10px] font-black text-red-400">{idx + 1}</span>
              </div>
              <Speedometro nome={eq.nome} minutos={eq.totalMinutos} maxMinutos={maxMinutos} />
              <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {eq.ocorrencias}x</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {equipamentos.length > 0 && (
        <div className="bg-slate-900/30 backdrop-blur-md rounded-2xl border border-white/5 p-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-red-400" /> Detalhamento por Equipamento
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="text-slate-500 font-black uppercase tracking-widest border-b border-white/5">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Equipamento</th>
                  <th className="pb-2 pr-4 text-right">Downtime Total</th>
                  <th className="pb-2 pr-4 text-right">Ocorrências</th>
                  <th className="pb-2 text-right">Média/Ocorrência</th>
                </tr>
              </thead>
              <tbody>
                {equipamentos.map((eq, idx) => (
                  <tr key={eq.nome} className="border-b border-white/5 text-slate-300 font-bold">
                    <td className="py-2 pr-4 text-red-400">{idx + 1}</td>
                    <td className="py-2 pr-4 uppercase">{eq.nome}</td>
                    <td className="py-2 pr-4 text-right text-white">
                      {Math.floor(eq.totalMinutos / 60)}h {Math.round(eq.totalMinutos % 60)}m
                    </td>
                    <td className="py-2 pr-4 text-right">{eq.ocorrencias}x</td>
                    <td className="py-2 text-right text-slate-400">
                      {Math.round(eq.totalMinutos / eq.ocorrencias)}min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatorioTop5Equipamentos;
