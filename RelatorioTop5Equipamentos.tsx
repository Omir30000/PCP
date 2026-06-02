
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

interface ParadaDetalhe {
  motivo: string;
  duracao: number;
  data: string;
  turno: string;
  linha: string;
}

interface EquipamentoStats {
  nome: string;
  totalMinutos: number;
  ocorrencias: number;
  paradas: ParadaDetalhe[];
}

const Speedometro: React.FC<{ nome: string; minutos: number; maxMinutos: number; rank: number }> = ({ nome, minutos, maxMinutos, rank }) => {
  const raio = 52;
  const espessura = 10;
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
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
        <span className="text-sm font-black text-red-400">{rank}</span>
      </div>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="shrink-0">
        <path d={descricaoArco(0, anguloMax, raio)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={espessura} strokeLinecap="round" />
        <path d={descricaoArco(0, angulo, raio)} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round" style={{ transition: 'all 0.8s ease-out' }} />
        <line x1={centro} y1={centro} x2={polarToCartesian(centro, centro, raio - espessura, angulo).x} y2={polarToCartesian(centro, centro, raio - espessura, angulo).y} stroke={cor} strokeWidth="2" strokeLinecap="round" style={{ transition: 'all 0.8s ease-out' }} />
        <circle cx={centro} cy={centro} r="3" fill={cor} />
        <text x={centro} y={centro + 22} textAnchor="middle" fill="white" fontSize="13" fontWeight="900" fontFamily="monospace">{horas}h{minsRestantes}m</text>
        <text x={centro} y={centro + 34} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="700" fontFamily="monospace" letterSpacing="2">DOWNTIME</text>
      </svg>
      <div className="min-w-0">
        <span className="text-sm font-black text-white uppercase tracking-tight block truncate">{nome}</span>
        <span className="text-[9px] text-slate-500 font-bold">{minutos}min em {Math.ceil(minutos / 60)}h</span>
      </div>
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
  const [modalEquip, setModalEquip] = useState<EquipamentoStats | null>(null);

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

      const mapa = new Map<string, { totalMin: number; ocorr: number; paradas: ParadaDetalhe[] }>();

      registros.forEach(r => {
        const paradas = Array.isArray(r.paradas) ? r.paradas : [];
        paradas.forEach((p: any) => {
          const nome = p.maquina || p.maquina_id || p.equipamento || 'GERAL';
          if (nome.toUpperCase() === 'INTERVALO') return;
          const dur = parseMinutos(p.duracao || p.tempo || p.total_min || 0);
          if (dur <= 0) return;
          const existing = mapa.get(nome);
          const detalhe: ParadaDetalhe = {
            motivo: p.motivo || 'N/I',
            duracao: dur,
            data: r.data_registro || '-',
            turno: r.turno || '-',
            linha: r.linha_producao || '-'
          };
          if (existing) {
            existing.totalMin += dur;
            existing.ocorr += 1;
            existing.paradas.push(detalhe);
          } else {
            mapa.set(nome, { totalMin: dur, ocorr: 1, paradas: [detalhe] });
          }
        });
      });

      const sorted = Array.from(mapa.entries())
        .map(([nome, stats]) => ({ nome, totalMinutos: stats.totalMin, ocorrencias: stats.ocorr, paradas: stats.paradas }))
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
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="xl:w-96 space-y-3">
            {equipamentos.map((eq, idx) => (
              <div key={eq.nome} className="bg-slate-900/40 backdrop-blur-md rounded-xl border border-white/5 p-3 hover:border-red-500/20 transition-all">
                <Speedometro nome={eq.nome} minutos={eq.totalMinutos} maxMinutos={maxMinutos} rank={idx + 1} />
              </div>
            ))}
          </div>

          <div className="flex-1 bg-slate-900/30 backdrop-blur-md rounded-2xl border border-white/5 p-4 overflow-hidden">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Clock className="w-3 h-3 text-red-400" /> Paradas por Equipamento
            </h4>
            <div className="overflow-y-auto max-h-[600px] space-y-3 pr-1">
              {equipamentos.map(eq => (
                <div key={eq.nome} className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-white uppercase tracking-tight">{eq.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-red-400">{Math.floor(eq.totalMinutos / 60)}h {Math.round(eq.totalMinutos % 60)}m ({eq.ocorrencias}x)</span>
                      {eq.paradas.length > 10 && (
                        <button onClick={() => setModalEquip(eq)} className="text-[8px] font-black text-slate-500 uppercase tracking-widest bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-all cursor-pointer">
                          ver todas
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {eq.paradas.slice(0, 10).map((p, i) => (
                      <div key={i} onClick={() => setModalEquip(eq)} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-1.5 text-[9px] cursor-pointer hover:bg-red-500/10 transition-all">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-slate-500 font-mono w-16 shrink-0">{p.data}</span>
                          <span className="text-slate-400 uppercase font-bold truncate">{p.motivo}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-slate-500">{p.turno}</span>
                          <span className="font-black text-white w-14 text-right">{p.duracao}min</span>
                        </div>
                      </div>
                    ))}
                    {eq.paradas.length > 10 && (
                      <button onClick={() => setModalEquip(eq)} className="w-full text-[8px] text-slate-600 text-center pt-1 hover:text-red-400 transition-colors cursor-pointer font-bold uppercase tracking-widest">
                        +{eq.paradas.length - 10} ocorrências — ver todas
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalEquip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalEquip(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-tight">{modalEquip.nome}</h2>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">{modalEquip.paradas.length} paradas · {Math.floor(modalEquip.totalMinutos / 60)}h {Math.round(modalEquip.totalMinutos % 60)}m total</p>
              </div>
              <button onClick={() => setModalEquip(null)} className="text-slate-500 hover:text-white transition-colors cursor-pointer p-1">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-1.5 flex-1">
              {modalEquip.paradas.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 text-xs hover:bg-red-500/5 transition-all">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-slate-500 font-mono w-20 shrink-0">{p.data}</span>
                    <span className="text-slate-300 uppercase font-bold truncate">{p.motivo}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-3">
                    <span className="text-slate-600 text-[10px] font-bold uppercase w-16 text-right">{p.turno}</span>
                    <span className="text-slate-500 font-mono w-12 text-right">{p.linha}</span>
                    <span className="font-black text-white w-16 text-right">{p.duracao}min</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatorioTop5Equipamentos;
