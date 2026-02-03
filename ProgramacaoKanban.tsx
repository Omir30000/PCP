
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { Produto, Linha } from './types/database';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Search, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  GripVertical, 
  Box, 
  Calendar,
  Zap,
  Trash2,
  Clock,
  Plus,
  X,
  Factory,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';

const TURNOS = [
  { id: '1', nome: 'T1', fullName: 'Turno 1 - Manhã', color: 'text-[#facc15]', border: 'border-[#d4af37]', labelBg: 'bg-[#facc15]' },
  { id: '2', nome: 'T2', fullName: 'Turno 2 - Noite', color: 'text-blue-400', border: 'border-blue-500/50', labelBg: 'bg-blue-500' }
];

const ProgramacaoKanban: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [planejamento, setPlanejamento] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [skuSearchTerm, setSkuSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Estados para o Modal de Drop
  const [isDropModalOpen, setIsDropModalOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{
    type: 'NEW' | 'MOVE';
    produto_id?: string;
    item_id?: string;
    dia: string;
  } | null>(null);
  const [selectedLinha, setSelectedLinha] = useState('');
  const [selectedTurno, setSelectedTurno] = useState('1');
  const [savingDrop, setSavingDrop] = useState(false);
  
  const [dataReferencia, setDataReferencia] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff, 12, 0, 0);
    return monday;
  });

  const getDiasSemana = useMemo(() => {
    const dias = [];
    const nomes = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(dataReferencia);
      d.setDate(dataReferencia.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const formatada = `${nomes[i]} ${d.getDate()}/${d.getMonth() + 1}`;
      dias.push({ label: formatada, iso });
    }
    return dias;
  }, [dataReferencia]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dataInicio = getDiasSemana[0].iso;
      const dataFim = getDiasSemana[6].iso;
      
      const [prodRes, linRes, progRes] = await Promise.all([
        supabase.from('produtos').select('*').order('nome'),
        supabase.from('linhas').select('*').order('nome'),
        supabase.from('programacao_semanal' as any).select('*').gte('dia_semana', dataInicio).lte('dia_semana', dataFim)
      ]);

      if (prodRes.data) setProdutos(prodRes.data);
      if (linRes.data) {
        setLinhas(linRes.data);
        if (linRes.data.length > 0) setSelectedLinha(linRes.data[0].id);
      }
      if (progRes.data) setPlanejamento(progRes.data);
    } catch (err) {
      console.error("Nexus Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataReferencia]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- LOGICA DE DRAG AND DROP ---

  const onDragStartSKU = (e: React.DragEvent, produto: Produto) => {
    e.dataTransfer.setData('type', 'NEW_SKU');
    e.dataTransfer.setData('produto_id', produto.id);
  };

  const onDragStartExisting = (e: React.DragEvent, item: any) => {
    e.dataTransfer.setData('type', 'MOVE_ITEM');
    e.dataTransfer.setData('item_id', item.id);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, dia: string) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');

    if (type === 'NEW_SKU') {
      const produto_id = e.dataTransfer.getData('produto_id');
      setPendingDrop({ type: 'NEW', produto_id, dia });
      setIsDropModalOpen(true);
    } else if (type === 'MOVE_ITEM') {
      const item_id = e.dataTransfer.getData('item_id');
      setPendingDrop({ type: 'MOVE', item_id, dia });
      setIsDropModalOpen(true);
    }
  };

  const confirmDrop = async () => {
    if (!pendingDrop || !selectedLinha) return;
    setSavingDrop(true);

    try {
      if (pendingDrop.type === 'NEW') {
        const prod = produtos.find(p => p.id === pendingDrop.produto_id);
        const { data, error } = await supabase.from('programacao_semanal' as any).insert({
          produto_id: pendingDrop.produto_id,
          linha_id: selectedLinha,
          dia_semana: pendingDrop.dia,
          turno: selectedTurno,
          quantidade_planejada: prod?.capacidade_nominal || 0,
          status: 'Pendente'
        }).select();

        if (error) throw error;
        setPlanejamento(prev => [...prev, ...data]);
        showToast('SKU Agendado com Sucesso');
      } else {
        const { error } = await supabase.from('programacao_semanal' as any)
          .update({ 
            dia_semana: pendingDrop.dia, 
            linha_id: selectedLinha, 
            turno: selectedTurno 
          })
          .eq('id', pendingDrop.item_id);

        if (error) throw error;
        setPlanejamento(prev => prev.map(item => 
          item.id === pendingDrop.item_id 
            ? { ...item, dia_semana: pendingDrop.dia, linha_id: selectedLinha, turno: selectedTurno } 
            : item
        ));
        showToast('Programação Atualizada');
      }
      setIsDropModalOpen(false);
      setPendingDrop(null);
    } catch (err) {
      showToast('Erro ao processar agendamento', 'error');
    } finally {
      setSavingDrop(false);
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('programacao_semanal' as any).delete().eq('id', id);
    if (!error) {
      setPlanejamento(prev => prev.filter(p => p.id !== id));
      showToast('Item removido da grade');
    }
  };

  const exportarPDF = () => {
    // Configura jsPDF em modo paisagem
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = 297;
    
    // 1. Cabeçalho 'Smart PCP' (Estilo Industrial Navy)
    doc.setFillColor(15, 23, 42); // Navy escuro
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Título Principal (Branco Monospace)
    doc.setFont('courier', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('SMART PCP // GRADE DE PRODUÇÃO', 14, 15);
    
    // Subtítulo Ciclo Semanal
    doc.setFontSize(9);
    doc.setFont('courier', 'normal');
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(`CICLO SEMANAL: ${getDiasSemana[0].label} A ${getDiasSemana[6].label}`, 14, 25);
    
    // Status Badge (Verde) no canto direito
    const statusText = 'STATUS: PROGRAMAÇÃO VALIDADA';
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');
    const textWidth = doc.getTextWidth(statusText);
    const badgePadding = 4;
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.roundedRect(pageWidth - textWidth - 14 - (badgePadding * 2), 12, textWidth + (badgePadding * 2), 8, 2, 2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.text(statusText, pageWidth - textWidth - 14 - badgePadding, 17.5);

    // 2. Preparação da Estrutura da Grade (Matrix de Produção)
    // Coleta produtos únicos programados na semana
    const produtosIdsNaSemana = Array.from(new Set(planejamento.map(p => p.produto_id)));
    const produtosNaSemana = produtos.filter(p => produtosIdsNaSemana.includes(p.id));

    // Cabeçalho da Tabela
    const tableHeader = [['PRODUTO / SKU', ...getDiasSemana.map(d => d.label)]];
    
    // Corpo da Tabela
    const tableBody = produtosNaSemana.map(prod => {
      const row = [prod.nome.toUpperCase()];
      
      // Para cada dia da semana, busca os slots programados
      getDiasSemana.forEach(dia => {
        const itensDia = planejamento.filter(p => p.produto_id === prod.id && p.dia_semana === dia.iso);
        
        if (itensDia.length > 0) {
          // Concatena informações de linha e turno (ex: L3-T1)
          const infoSlots = itensDia.map(item => {
            const l = linhas.find(lin => lin.id === item.linha_id);
            const lineName = l ? (l.nome.toLowerCase().includes('linha') ? `L${l.nome.match(/\d+/)?.[0] || l.nome.slice(-1)}` : l.nome.slice(0, 3).toUpperCase()) : 'L?';
            return `${lineName}-T${item.turno}`;
          }).join(' / ');
          row.push(infoSlots);
        } else {
          row.push('---');
        }
      });
      
      return row;
    });

    // Renderização da Tabela Matrix
    autoTable(doc, {
      startY: 45,
      head: tableHeader,
      body: tableBody,
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 41, 59], 
        textColor: [255, 255, 255], 
        font: 'courier', 
        fontSize: 8, 
        halign: 'center',
        lineWidth: 0.1,
        lineColor: [50, 50, 50]
      },
      bodyStyles: { 
        font: 'courier', 
        fontSize: 7, 
        textColor: [50, 50, 50],
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 }
      },
      styles: {
        lineWidth: 0.1,
        lineColor: [220, 220, 220]
      }
    });
    
    // 3. Rodapé Técnico
    const finalY = (doc as any).lastAutoTable.finalY || 180;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont('courier', 'normal');
    const timestamp = new Date().toLocaleString('pt-BR');
    doc.text(`SMART PCP FLOW // EMITIDO EM ${timestamp} // PÁGINA 1 DE 1`, 14, finalY + 15);
    
    doc.save(`SmartPCP_Matrix_${getDiasSemana[0].iso}.pdf`);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-[#050505] text-slate-300 font-sans overflow-hidden p-2">
      
      {/* Toast Feedback */}
      {toast && (
        <div className={`fixed top-10 right-10 z-[300] px-8 py-4 rounded-[20px] flex items-center gap-4 animate-in slide-in-from-right shadow-[0_30px_60px_rgba(0,0,0,0.6)] border ${
          toast.type === 'success' ? 'bg-[#22c55e] border-white/20 text-black' : 'bg-rose-600 border-white/20 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5 font-black" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">{toast.message}</span>
        </div>
      )}

      {/* Nexus Top Header */}
      <div className="flex items-center justify-between mb-4 px-4 h-16 shrink-0">
        <div className="flex items-center gap-4 bg-[#111] p-1.5 rounded-2xl border border-white/5 shadow-lg">
          <button 
            onClick={() => { const d = new Date(dataReferencia); d.setDate(d.getDate() - 7); setDataReferencia(d); }}
            className="p-2 hover:text-[#facc15] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2 text-white bg-black/40 rounded-xl">
            SEMANA {getDiasSemana[0].label} - {getDiasSemana[6].label.split(' ')[1]}
          </span>
          <button 
            onClick={() => { const d = new Date(dataReferencia); d.setDate(d.getDate() + 7); setDataReferencia(d); }}
            className="p-2 hover:text-[#facc15] transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={exportarPDF}
            className="flex items-center gap-3 bg-[#1e293b] hover:bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 group"
          >
            <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" /> EXPORTAR PDF
          </button>

          <div className="flex items-center gap-2 px-6 py-3 bg-[#111] border border-emerald-500/20 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Sincronizado via Nexus Core</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden px-2">
        
        {/* Catálogo Mix de Ativos (Lateral Esquerda) */}
        <aside className="w-64 shrink-0 bg-[#0d0d0d] rounded-[32px] border border-white/5 flex flex-col overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-white/5 bg-[#0a0a0a]">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within:text-[#facc15]" />
              <input 
                type="text" 
                placeholder="LOCALIZAR SKU..."
                value={skuSearchTerm}
                onChange={e => setSkuSearchTerm(e.target.value)}
                className="w-full bg-black/60 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-[9px] font-black uppercase tracking-widest outline-none focus:border-[#facc15]/30 transition-all text-white placeholder:text-slate-700"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2.5">
            {produtos.filter(p => p.nome.toLowerCase().includes(skuSearchTerm.toLowerCase())).map(prod => (
              <div 
                key={prod.id} 
                draggable
                onDragStart={e => onDragStartSKU(e, prod)}
                className="bg-[#0f0f0f] border border-white/5 p-4 rounded-xl hover:border-[#d4af37]/40 transition-all cursor-grab active:scale-95 group relative shadow-lg"
              >
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <h4 className="text-[9px] font-black text-slate-300 uppercase mb-2 tracking-tighter leading-tight pr-6">{prod.nome}</h4>
                <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-600 uppercase">
                  <Zap className="w-3 h-3 text-[#d4af37]" /> CAP: {prod.capacidade_nominal?.toLocaleString()} UN
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Grade de Programação Semanal (Kanban de 7 Dias) */}
        <div className="flex-1 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 h-full min-w-[1200px]">
            {getDiasSemana.map(dia => (
              <div 
                key={dia.iso} 
                onDragOver={onDragOver}
                onDrop={e => onDrop(e, dia.iso)}
                className="flex-1 flex flex-col gap-3 bg-black/20 rounded-[28px] p-1 group/col"
              >
                {/* Cabeçalho do Dia (Narrow Black) */}
                <div className="bg-[#0d0d0d] p-3 rounded-2xl border border-white/5 text-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] group-hover/col:border-[#d4af37]/30 transition-all">
                  <h3 className="text-[10px] font-black text-[#d4af37] uppercase tracking-[0.2em] leading-none mb-1">
                    {dia.label.split(' ')[0]}
                  </h3>
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest leading-none">
                    {dia.label.split(' ')[1]}
                  </span>
                </div>

                {/* Cards de Programação */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 p-1 pb-10">
                  {planejamento.filter(p => p.dia_semana === dia.iso).map(item => {
                    const prod = produtos.find(pr => pr.id === item.produto_id);
                    const linha = linhas.find(l => l.id === item.linha_id);
                    const shift = TURNOS.find(t => t.id === String(item.turno)) || TURNOS[0];
                    
                    return (
                      <div 
                        key={item.id}
                        draggable
                        onDragStart={e => onDragStartExisting(e, item)}
                        className={`bg-[#0d0d0d] border ${shift.border} p-3.5 rounded-2xl shadow-2xl group/card hover:scale-[1.02] transition-all cursor-grab active:cursor-grabbing relative overflow-hidden`}
                      >
                        {/* Efeito Visual Nexus */}
                        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                        
                        {/* Top Badge: Turno & Linha */}
                        <div className="flex justify-between items-center mb-3 relative z-10">
                          <div className={`px-2 py-0.5 rounded-md ${shift.labelBg} text-black text-[7px] font-black uppercase tracking-widest shadow-sm`}>
                            {shift.nome}
                          </div>
                          <div className="text-[7px] font-black text-slate-500 uppercase tracking-widest bg-white/[0.02] px-2 py-0.5 rounded-md border border-white/5">
                            {linha?.nome || 'LINHA'}
                          </div>
                          <button 
                            onClick={() => handleRemove(item.id)}
                            className="absolute -right-1 -top-1 p-1 opacity-0 group-hover/card:opacity-100 text-slate-700 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-3 w-3" />
                          </button>
                        </div>

                        {/* SKU Center Display */}
                        <h5 className="text-[9px] font-black text-white uppercase leading-tight mb-3 tracking-tighter text-center border-y border-white/[0.03] py-2">
                          {prod?.nome || 'SKU INDEFINIDO'}
                        </h5>

                        {/* Footer Meta */}
                        <div className="flex items-center justify-between text-[7px] font-black text-slate-500 uppercase relative z-10">
                          <div className="flex items-center gap-1">
                            <Box className="w-2.5 h-2.5 text-[#d4af37]" />
                            <span>{item.quantidade_planejada?.toLocaleString()} UN</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>8H</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Slot Vazio p/ Drop */}
                  <div className="h-16 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center opacity-10 group-hover/col:opacity-30 transition-opacity">
                     <Plus className="w-6 h-6 text-slate-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL DE CONFIGURAÇÃO DE DROP (Linha/Turno) */}
      {isDropModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-500" onClick={() => !savingDrop && setIsDropModalOpen(false)} />
          
          <div className="bg-[#0d0d0d] rounded-[40px] shadow-[0_50px_100px_rgba(0,0,0,0.5)] w-full max-w-lg relative z-10 animate-in zoom-in-95 duration-500 overflow-hidden border border-[#d4af37]/20 flex flex-col p-10">
            <header className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#d4af37] rounded-2xl shadow-lg">
                  <Box className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Planejamento Manual</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Configurar Alocação Industrial</p>
                </div>
              </div>
              <button onClick={() => setIsDropModalOpen(false)} className="text-slate-600 hover:text-white transition-colors">
                <X className="w-8 h-8" />
              </button>
            </header>

            <div className="space-y-8">
               {/* Seleção de Linha */}
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Factory className="w-3.5 h-3.5" /> Estação de Trabalho
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {linhas.map(lin => (
                      <button
                        key={lin.id}
                        onClick={() => setSelectedLinha(lin.id)}
                        className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          selectedLinha === lin.id 
                            ? 'bg-[#d4af37] text-black border-transparent shadow-xl shadow-[#d4af37]/10' 
                            : 'bg-black/40 text-slate-500 border-white/5 hover:border-white/20'
                        }`}
                      >
                        {lin.nome}
                      </button>
                    ))}
                  </div>
               </div>

               {/* Seleção de Turno */}
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Período Operacional
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {TURNOS.map(shift => (
                      <button
                        key={shift.id}
                        onClick={() => setSelectedTurno(shift.id)}
                        className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          selectedTurno === shift.id 
                            ? 'bg-blue-600 text-white border-transparent shadow-xl shadow-blue-600/20' 
                            : 'bg-black/40 text-slate-500 border-white/5 hover:border-white/20'
                        }`}
                      >
                        {shift.fullName}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            <footer className="mt-12 flex gap-4">
               <button 
                onClick={() => setIsDropModalOpen(false)}
                className="flex-1 py-5 rounded-[24px] border border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
               >
                 Cancelar
               </button>
               <button 
                onClick={confirmDrop}
                disabled={savingDrop || !selectedLinha}
                className="flex-[2] py-5 bg-[#d4af37] text-black rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
               >
                 {savingDrop ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                 {savingDrop ? 'Gravando...' : 'Confirmar Programação'}
               </button>
            </footer>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        body { background-color: #050505 !important; }
      `}} />
    </div>
  );
};

export default ProgramacaoKanban;
