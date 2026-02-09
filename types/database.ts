
/**
 * Interface representando uma parada de máquina individual dentro de um registro de produção.
 */
export type Parada = {
  id?: string;
  tipo?: string; // Planejada, Não Planejada, Logística, etc.
  maquina_id?: string;
  motivo: string;
  duracao: string | number; // "120min" ou número
  hora_inicio?: string;
  hora_fim?: string;
}

/**
 * Interface para escalas de produção (Planejamento)
 */
export type EscalaProducaoRecord = {
  id: string;
  item_pedido_id: string;
  linha_id: string;
  data_programada: string;
  turno: string;
  status: 'Agendado' | 'Em Produção' | 'Concluído';
  created_at: string;
}

/**
 * Definição completa do schema do banco de dados para o sistema de PCP.
 */
export type Database = {
  public: {
    Tables: {
      linhas: {
        Row: {
          id: string;
          nome: string;
          descricao: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          descricao?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          descricao?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      produtos: {
        Row: {
          id: string;
          nome: string;
          volume: string | null;
          tipo: string | null;
          capacidade_nominal: number | null;
          unidades_por_fardo: number | null;
          fardos_por_palete: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          volume?: string | null;
          tipo?: string | null;
          capacidade_nominal?: number | null;
          unidades_por_fardo?: number | null;
          fardos_por_palete?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          volume?: string | null;
          tipo?: string | null;
          capacidade_nominal?: number | null;
          unidades_por_fardo?: number | null;
          fardos_por_palete?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      maquinas: {
        Row: {
          id: string;
          nome: string;
          linha_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          linha_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          linha_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maquinas_linha_id_fkey";
            columns: ["linha_id"];
            isOneToOne: false;
            referencedRelation: "linhas";
            referencedColumns: ["id"];
          }
        ];
      };
      registros_producao: {
        Row: {
          id: string;
          data_registro: string;
          turno: string;
          linha_producao: string;
          produto_volume: string;
          lote: string | null;
          quantidade_produzida: number;
          paradas: Parada[] | null;
          carga_horaria: number | null;
          capacidade_producao: number | null;
          eficiencia_calculada: number | null;
          linha_id: string | null;
          produto_id: string | null;
          operador_id: string | null;
          observacoes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          data_registro: string;
          turno: string;
          linha_producao: string;
          produto_volume: string;
          lote?: string | null;
          quantidade_produzida: number;
          paradas?: Parada[] | null;
          carga_horaria?: number | null;
          capacidade_producao?: number | null;
          eficiencia_calculada?: number | null;
          linha_id?: string | null;
          produto_id?: string | null;
          operador_id?: string | null;
          observacoes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          data_registro?: string;
          turno?: string;
          linha_producao?: string;
          produto_volume?: string;
          lote?: string | null;
          quantidade_produzida?: number;
          paradas?: Parada[] | null;
          carga_horaria?: number | null;
          capacidade_producao?: number | null;
          eficiencia_calculada?: number | null;
          linha_id?: string | null;
          produto_id?: string | null;
          operador_id?: string | null;
          observacoes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registros_producao_linha_producao_fkey";
            columns: ["linha_producao"];
            isOneToOne: false;
            referencedRelation: "linhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registros_producao_produto_volume_fkey";
            columns: ["produto_volume"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          }
        ];
      };
      pedidos: {
        Row: {
          id: string;
          cliente_nome: string;
          data_pedido: string;
          data_entrega: string | null;
          status: string;
          observacoes: string | null;
        };
        Insert: {
          id?: string;
          cliente_nome: string;
          data_pedido?: string;
          data_entrega: string;
          status?: string;
          observacoes?: string | null;
        };
        Update: {
          id?: string;
          cliente_nome?: string;
          data_pedido?: string;
          data_entrega?: string;
          status?: string;
          observacoes?: string | null;
        };
        Relationships: [];
      };
      itens_pedido: {
        Row: {
          id: string;
          pedido_id: string;
          produto_id: string;
          quantidade: number;
        };
        Insert: {
          id?: string;
          pedido_id: string;
          produto_id: string;
          quantidade: number;
        };
        Update: {
          id?: string;
          pedido_id?: string;
          produto_id?: string;
          quantidade?: number;
        };
        Relationships: [
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey";
            columns: ["pedido_id"];
            isOneToOne: false;
            referencedRelation: "pedidos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "itens_pedido_produto_id_fkey";
            columns: ["produto_id"];
            isOneToOne: false;
            referencedRelation: "produtos";
            referencedColumns: ["id"];
          }
        ];
      };
      escalas_producao: {
        Row: EscalaProducaoRecord;
        Insert: Omit<EscalaProducaoRecord, 'id' | 'created_at'>;
        Update: Partial<Omit<EscalaProducaoRecord, 'id' | 'created_at'>>;
        Relationships: [
          {
            foreignKeyName: "escalas_producao_item_pedido_id_fkey";
            columns: ["item_pedido_id"];
            isOneToOne: false;
            referencedRelation: "itens_pedido";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "escalas_producao_linha_id_fkey";
            columns: ["linha_id"];
            isOneToOne: false;
            referencedRelation: "linhas";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Linha = Database['public']['Tables']['linhas']['Row'];
export type Produto = Database['public']['Tables']['produtos']['Row'];
export type Maquina = Database['public']['Tables']['maquinas']['Row'];
export type RegistroProducao = Database['public']['Tables']['registros_producao']['Row'];
export type Pedido = Database['public']['Tables']['pedidos']['Row'];
export type ItemPedido = Database['public']['Tables']['itens_pedido']['Row'];
export type EscalaProducao = Database['public']['Tables']['escalas_producao']['Row'];
