
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { RegistroProducao, Produto } from './types/database';
import { 
  Loader2, 
  RefreshCw, 
  Package, 
  Layers, 
  Truck, 
  Timer, 
  Zap, 
  Gauge, 
  AlertCircle,
  TrendingUp,
  Settings,
  Activity,
  Box,
  Calendar,
  Clock as ClockIcon,
  Scale,
  X,
  ChevronRight,
  Info,
  ArrowUpRight,
  Layout
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const CATEGORIAS_CONFIG: Record<string, { color: string, bg: string, border: string }> = {
  'ROTULADORA': { color: 'text-red-500', bg: 'bg-red-50/50', border: 'border-red-100' },
  'SOPRO': { color: 'text-orange-500', bg: 'bg-orange-50/50', border: 'border-orange-100' },
  'ENCHEDORA': { color: 'text-blue-500', bg: 'bg-blue-50/50', border: 'border-blue-100' },
  'SETUP': { color: 'text-purple-500', bg: 'bg-purple-50/50', border: 'border-purple-100' },
  'MANUTENÇÃO': { color: 'text-rose-500', bg: 'bg-rose-50/50', border: 'border-rose-100' },
  'EMPACOTADORA': { color: 'text-amber-500', bg: 'bg-amber-50/50', border: 'border-amber-100' },
  'OUTROS': { color: 'text-slate-500', bg: 'bg-slate-50/50', border: 'border-slate-100' }
};

const Performance: React.FC = () => {
  const [registros, setRegistros] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getHoje = () => new Date().toISOString().split('T')[0];
  const [filtroData, setFiltroData] = useState<string>(getHoje());
  const [filtroTurno, setFiltroTurno] = useState<'todos' | '1' | '2'>('todos');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [regsRes, prodsRes] = await Promise.all([
        supabase.from('registros_producao').select('*, produtos(*)').order('data_registro', { ascending: false }),
        supabase.from('produtos').select('*')
      ]);
      setRegistros(regsRes.data || []);
      setProdutos(prodsRes.data || []);
    } catch (err) {
      console.error("Erro no dashboard executivo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const parseVolumeToLiters = (volumeStr: string | null): number => {
    if (!volumeStr) return 0;
    const cleanStr = volumeStr.toLowerCase().replace(/\s/g, '');
    const numericPart = parseFloat(cleanStr.match(/[\d.]+/)?.[0] || '0');
    if (cleanStr.includes('ml')) return numericPart / 1000;
    return numericPart;
  };

  const filtradosAtuais = useMemo(() => {
    return registros.filter(r => {
      const matchData = r.data_registro === filtroData;
      const matchTurno = filtroTurno === 'todos' || String(r.turno) === filtroTurno;
      return matchData && matchTurno;
    });
  }, [registros, filtroData, filtroTurno]);

  const analytics = useMemo(() => {
    const lineCards = ['1', '2', '3', '4', '5'].map(num => {
      const regsDaLinha = filtradosAtuais.filter(r => String(r.linha_producao).includes(num));
      let totalUnits = 0, totalBundles = 0, totalPallets = 0, totalDowntime = 0, totalCapacityNominal = 0, totalHoras = 0, totalWeightKg = 0;
      let hasMetaInfo = false;

      regsDaLinha.forEach(reg => {
        const prod = reg.produtos; 
        const quantidade = Number(reg.quantidade_produzida) || 0;
        const metaNominal = Number(prod?.capacidade_nominal) || 0;
        const horas = Number(reg.carga_horaria) || 8;

        if (metaNominal > 0) {
          hasMetaInfo = true;
          const metaAjustada = (metaNominal / 8) * (horas || 8);
          totalCapacityNominal += metaAjustada;
        }

        totalUnits += quantidade;
        const unitsPerBundle = Number(prod?.unidades_por_fardo) || 12;
        const bundlesPerPallet = Number(prod?.fardos_por_palete) || 84;
        totalBundles += quantidade / unitsPerBundle;
        totalPallets += (quantidade / unitsPerBundle) / bundlesPerPallet;
        totalHoras += horas;
        totalWeightKg += (quantidade * parseVolumeToLiters(prod?.volume));
        
        const paradas = Array.isArray(reg.paradas) ? reg.paradas : [];
        totalDowntime += paradas.reduce((a: number, b: any) => a + (Number(b.duracao || b.total_min) || 0), 0);
      });

      const availability = totalHoras > 0 ? Math.max(0, Math.min(100, ((totalHoras * 60 - totalDowntime) / (totalHoras * 60)) * 100)) : 0;
      const performanceVal = (hasMetaInfo && totalCapacityNominal > 0) ? (totalUnits / totalCapacityNominal) * 100 : 0;
      
      // Sparkline visual placeholder
      const sparklineData = Array.from({ length: 10 }, (_, i) => ({ val: Math.floor(Math.random() * 20) + 10 }));

      return {
        id: num, 
        nome: `Linha ${num}`, 
        totalUnits, 
        totalBundles: Math.floor(totalBundles),
        totalPallets: totalPallets.toFixed(1), 
        totalWeightTon: (totalWeightKg / 1000).toFixed(2),
        availability, 
        performance: performanceVal,
        hasMeta: hasMetaInfo,
        downtime: totalDowntime,
        sparklineData
      };
    });

    const downtimeMap: Record<string, number> = {};
    filtradosAtuais.forEach(r => {
      (Array.isArray(r.paradas) ? r.paradas : []).forEach((p: any) => {
        const eq = String(p.equipamento || p.maquina_id || 'OUTROS').toUpperCase();
        const cat = Object.keys(CATEGORIAS_CONFIG).find(k => eq.includes(k)) || 'OUTROS';
        downtimeMap[cat] = (downtimeMap[cat] || 0) + (Number(p.duracao || p.total_min) || 0);
      });
    });

    const kanbanDowntime = Object.entries(downtimeMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const activeLines = lineCards.filter(l => l.totalUnits > 0);
    const globalPerformance = activeLines.length > 0 
      ? activeLines.filter(l => l.hasMeta).reduce((acc, l) => acc + l.performance, 0) / Math.max(1, activeLines.filter(l => l.hasMeta).length) 
      : 0;
    const totalTonnage = lineCards.reduce((acc, l) => acc + parseFloat(l.totalWeightTon), 0);

    return { lineCards, kanbanDowntime, globalPerformance, totalTonnage };
  }, [filtradosAtuais, produtos]);

  const detailedOccurrences = useMemo(() => {
    if (!selectedCategory) return [];
    const occurrences: any[] = [];
    filtradosAtuais.forEach(reg => {
      const paradas = Array.isArray(reg.paradas) ? reg.paradas : [];
      paradas.forEach((p: any) => {
        const eq = String(p.equipamento || p.maquina_id || 'OUTROS').toUpperCase();
        const cat = Object.keys(CATEGORIAS_CONFIG).find(k => eq.includes(k)) || 'OUTROS';
        if (cat === selectedCategory) {
          occurrences.push({
            ...p,
            linha: reg.linha_producao,
            turno: reg.turno,
            data: reg.data_registro,
            lote: reg.lote,
            created_at: reg.created_at
          });
        }
      });
    });
    return occurrences.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedCategory, filtradosAtuais]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Analisando Ciclos de Produção...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 pb-20 w-full overflow-x-hidden max-w-[98%] mx-auto font-sans">
      
      {/* Header Glassmorphism & Filtros Cápsula */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-[40px] border border-white/20 shadow-2xl shadow-slate-200/50 w-full overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/20 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="shrink-0 flex items-center gap-5 relative z-10">
          <div className="bg-slate-900 p-4 rounded-[24px] shadow-2xl shadow-slate-400/20 shrink-0">
            <Activity className="w-7 h-7 text-blue-400 shrink-0" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">Performance Analítica</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Sala de Controle Executiva
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto relative z-10">
          <div className="flex items-center gap-2 bg-slate-200/50 p-1.5 rounded-[24px] backdrop-blur-md border border-white/20 shrink-0">
            <div className="relative group shrink-0">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="pl-11 pr-4 py-2 bg-white/80 border-none rounded-2xl text-[10px] md:text-xs font-black outline-none focus:ring-2 focus:ring-blue-100 transition-all shrink-0 uppercase"
              />
            </div>
            
            <div className="flex bg-slate-200/50 p-1 rounded-2xl shrink-0">
              {(['todos', '1', '2'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFiltroTurno(t)}
                  className={`px-5 py-2 text-[10px] font-black rounded-xl transition-all shrink-0 ${
                    filtroTurno === t ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'todos' ? 'AMBOS' : t + '° TURNO'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-6 bg-white/40 p-3 px-6 rounded-[24px] border border-white/30 w-full sm:w-auto ml-auto">
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OEE Médio</span>
              <span className={`text-xl font-black ${analytics.globalPerformance >= 80 ? 'text-emerald-500' : analytics.globalPerformance >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                {analytics.globalPerformance > 0 ? analytics.globalPerformance.toFixed(1) + '%' : '--'}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-200 shrink-0" />
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expedição</span>
              <span className="text-xl font-black text-blue-600 tracking-tighter">{analytics.totalTonnage.toFixed(1)} <span className="text-xs">Ton</span></span>
            </div>
            <button onClick={fetchData} className="p-2.5 bg-white hover:bg-slate-100 rounded-xl transition-all border border-slate-100 shadow-sm shrink-0">
              <RefreshCw className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Linhas - Estilo Smart Hub */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 w-full items-stretch">
        {analytics.lineCards.map((line) => (
          <div key={line.id} className="group relative overflow-hidden bg-white/80 backdrop-blur-md rounded-[32px] p-7 border border-white transition-all duration-500 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.12)]">
            
            {/* Sparkline de fluxo estável */}
            <div className="absolute inset-x-0 bottom-0 h-24 opacity-10 pointer-events-none group-hover:opacity-30 transition-opacity">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={line.sparklineData}>
                    <Area 
                      type="monotone" 
                      dataKey="val" 
                      stroke="#10b981" 
                      fill="#d1fae5" 
                      strokeWidth={3}
                    />
                  </AreaChart>
               </ResponsiveContainer>
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{line.nome}</span>
                <div className={`w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]`} />
              </div>
              
              <div className="space-y-1 mb-8">
                <div className="flex items-baseline gap-1">
                  <h4 className="text-3xl font-black text-slate-800 tracking-tighter leading-none">
                    {Number(line.totalUnits).toLocaleString()}
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">un</span>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" /> Fluxo Estável
                </p>
              </div>

              <div className="mt-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="w-3.5 h-3.5 text-rose-300" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Inatividade</span>
                  </div>
                  <span className={`text-xs font-black ${line.downtime > 60 ? 'text-red-500' : 'text-slate-600'}`}>{line.downtime}m</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-blue-300" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Logística</span>
                  </div>
                  <span className="text-xs font-black text-slate-600">{line.totalPallets} plt</span>
                </div>

                {/* Progress Bar Elegante no rodapé do card */}
                <div className="pt-4 border-t border-slate-100/50">
                   <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Meta OEE</span>
                      <span className="text-[10px] font-black text-slate-800">{line.performance.toFixed(1)}%</span>
                   </div>
                   <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 rounded-full ${line.performance >= 80 ? 'bg-emerald-500' : line.performance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                        style={{ width: `${Math.min(100, line.performance)}%` }} 
                      />
                   </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ranking de Inatividade - Badges Flutuantes */}
      <div className="bg-white/80 backdrop-blur-md p-10 rounded-[40px] shadow-sm border border-white/50 w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-red-100/10 rounded-full -ml-16 -mt-16 blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-4 shrink-0">
            <Timer className="w-7 h-7 text-red-500 shrink-0" />
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-none">Ocorrências por Equipamento</h3>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic shrink-0">Ranking de Downtime Diário</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-6 md:gap-8 w-full relative z-10">
          {analytics.kanbanDowntime.map((item) => {
            const config = CATEGORIAS_CONFIG[item.name] || CATEGORIAS_CONFIG['OUTROS'];
            return (
              <div 
                key={item.name} 
                onClick={() => setSelectedCategory(item.name)}
                className={`p-6 md:p-8 bg-white rounded-[32px] border border-slate-50 flex flex-col items-center justify-center text-center transition-all hover:-translate-y-2 cursor-pointer group active:scale-95 shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:border-blue-100`}
              >
                <div className={`w-14 h-14 rounded-2xl ${config.bg} mb-4 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform ${config.color} shrink-0 mx-auto`}>
                   <Settings className="w-7 h-7" />
                </div>
                <h4 className={`text-[10px] font-black uppercase mb-1 truncate w-full tracking-tighter ${config.color}`}>{item.name}</h4>
                <p className="text-3xl font-black text-slate-800 tracking-tighter leading-none">
                  {item.value}<span className="text-[10px] ml-1 font-bold text-slate-400 uppercase">min</span>
                </p>
                <div className="mt-3 text-[8px] font-black text-blue-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Ver Detalhes</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monitoramento Logístico - Glass Effect */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
        <div className="lg:col-span-2 bg-slate-900 rounded-[40px] p-10 md:p-14 text-white relative overflow-hidden shadow-2xl w-full">
           <Layers className="absolute -right-16 -top-16 w-80 h-80 text-white/5" />
           <div className="relative z-10 h-full flex flex-col justify-center">
             <div className="flex items-center gap-4 mb-14">
                <div className="p-3 bg-blue-500/20 rounded-2xl shrink-0"><Truck className="w-7 h-7 text-blue-400 shrink-0" /></div>
                <h3 className="text-2xl font-black uppercase tracking-tighter leading-none">Performance Logística & Pesagem</h3>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-16 w-full">
                <div className="space-y-3">
                   <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Peso Expedido</p>
                   <div className="flex items-baseline gap-3">
                      <span className="text-5xl md:text-7xl font-black tracking-tighter text-emerald-400">
                        {analytics.totalTonnage.toFixed(2)}
                      </span>
                      <span className="text-[12px] font-black text-slate-500 uppercase">Ton</span>
                   </div>
                </div>
                <div className="space-y-3">
                   <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Fardos Totais</p>
                   <div className="flex items-baseline gap-3">
                      <span className="text-5xl md:text-7xl font-black tracking-tighter text-blue-400">
                        {analytics.lineCards.reduce((acc, l) => acc + l.totalBundles, 0).toLocaleString()}
                      </span>
                      <span className="text-[12px] font-black text-slate-500 uppercase">Pk</span>
                   </div>
                </div>
                <div className="space-y-3">
                   <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Paletes Totais</p>
                   <div className="flex items-baseline gap-3">
                      <span className="text-5xl md:text-7xl font-black tracking-tighter text-blue-200">
                        {Math.floor(analytics.lineCards.reduce((acc, l) => acc + Number(l.totalPallets), 0))}
                      </span>
                      <span className="text-[12px] font-black text-slate-500 uppercase">Plt</span>
                   </div>
                </div>
             </div>
           </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-[40px] p-10 md:p-14 shadow-xl border border-white/50 flex flex-col justify-center w-full">
           <div className="text-center space-y-8">
              <div className="inline-flex p-6 bg-blue-50/50 rounded-[32px] shrink-0 mx-auto border border-blue-100"><Scale className="w-12 h-12 text-blue-600 shrink-0" /></div>
              <div>
                <h4 className="text-base font-black text-slate-800 uppercase tracking-tighter">Acúmulo de Expedição</h4>
                <p className="text-[11px] font-black text-slate-400 uppercase leading-relaxed max-w-[200px] mx-auto mt-3">
                  Conversão baseada nos SKUs produzidos.
                </p>
              </div>
              
              <div className="space-y-4 w-full text-center">
                 <div className="text-6xl md:text-7xl font-black text-blue-600 tracking-tighter leading-none">{analytics.totalTonnage.toFixed(2)}</div>
                 <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] block">Toneladas / Hoje</span>
              </div>
           </div>
        </div>
      </div>

      {/* Modal Glassmorphism de Logs */}
      {selectedCategory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setSelectedCategory(null)} />
          
          <div className="bg-white/90 backdrop-blur-2xl rounded-[48px] shadow-2xl w-full max-w-3xl relative z-10 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[85vh] border border-white/50">
            <header className="px-10 py-10 border-b border-slate-100/50 flex items-center justify-between bg-slate-50/20 shrink-0">
              <div className="flex items-center gap-5 shrink-0">
                <div className={`p-4 rounded-2xl shadow-xl ${CATEGORIAS_CONFIG[selectedCategory]?.bg} ${CATEGORIAS_CONFIG[selectedCategory]?.color} shrink-0`}>
                  <Info className="w-8 h-8 shrink-0" />
                </div>
                <div className="shrink-0">
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">
                    Logs: {selectedCategory}
                  </h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2 shrink-0">Histórico de Eventos Críticos</p>
                </div>
              </div>
              <button onClick={() => setSelectedCategory(null)} className="p-3 text-slate-300 hover:text-slate-600 rounded-full hover:bg-white transition-all shrink-0">
                <X className="w-10 h-10 shrink-0" />
              </button>
            </header>

            <div className="p-10 overflow-y-auto no-scrollbar bg-slate-50/10">
              <div className="space-y-4">
                {detailedOccurrences.length === 0 ? (
                  <div className="py-24 text-center text-slate-300 font-black uppercase tracking-widest text-sm">Nenhuma ocorrência registrada</div>
                ) : (
                  detailedOccurrences.map((occ, idx) => (
                    <div key={idx} className="bg-white p-7 rounded-[28px] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 group hover:border-blue-200 transition-colors">
                      <div className="flex items-start gap-5 flex-1">
                        <div className="p-5 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                          <ClockIcon className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full">Linha {String(occ.linha).slice(-1)}</span>
                             <span className="text-[10px] font-black text-slate-300">•</span>
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Turno {occ.turno}</span>
                          </div>
                          <p className="text-base font-black text-slate-700 leading-tight">{occ.motivo || 'Motivo Operacional'}</p>
                          <div className="text-[11px] text-slate-400 font-mono font-bold flex items-center gap-3">
                            <span className="flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> Lote: {occ.lote || 'N/A'}</span>
                            <span>•</span>
                            <span>{new Date(occ.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 bg-slate-900 text-white px-8 py-4 rounded-3xl text-center min-w-[120px] shadow-2xl shadow-slate-200">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Duração</span>
                        <span className="text-3xl font-black tracking-tighter">{occ.duracao || occ.total_min}<span className="text-sm ml-1 text-slate-500">m</span></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <footer className="px-12 py-8 border-t border-slate-100/50 bg-white shrink-0">
               <button 
                onClick={() => setSelectedCategory(null)}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-[24px] transition-all uppercase text-[11px] tracking-[0.4em] shadow-2xl shadow-slate-300/50 active:scale-95"
               >
                 Fechar Análise
               </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Performance;
