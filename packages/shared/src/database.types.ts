/**
 * Hand-authored from schema.sql for Phase 1 scaffolding.
 * Replace with CLI-generated output once Supabase project is live:
 *   npx supabase gen types typescript --project-id <id> \
 *     > packages/shared/src/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id:         string;
          nome:       string;
          cnpj:       string;
          ie:         string | null;
          endereco:   string | null;
          municipio:  string | null;
          uf:         string | null;
          cep:        string | null;
          contato:    string | null;
          email:      string | null;
          telefone:   string | null;
          ativo:      boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['empresas']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['empresas']['Insert']>;
      };

      usuarios: {
        Row: {
          id:         string;
          empresa_id: string;
          nome:       string;
          cargo:      string | null;
          telefone:   string | null;
          perfil:     Database['public']['Enums']['perfil_usuario'];
          ativo:      boolean;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['usuarios']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['usuarios']['Insert']>;
      };

      obras: {
        Row: {
          id:                string;
          empresa_id:        string;
          nome:              string;
          tipo:              string | null;
          endereco:          string | null;
          municipio:         string | null;
          uf:                string | null;
          cep:               string | null;
          area_total_m2:     number | null;
          num_pavimentos:    number | null;
          eng_responsavel:   string | null;
          crea_cau:          string | null;
          num_art:           string | null;
          num_alvara:        string | null;
          status:            Database['public']['Enums']['status_obra'];
          data_inicio_prev:  string | null;
          data_inicio_real:  string | null;
          data_termino_prev: string | null;
          data_termino_real: string | null;
          observacoes:       string | null;
          ativo:             boolean;
          created_at:        string;
          updated_at:        string;
        };
        Insert: Omit<Database['public']['Tables']['obras']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string;
          created_at?: string;
          updated_at?: string;
          status?:     Database['public']['Enums']['status_obra'];
        };
        Update: Partial<Database['public']['Tables']['obras']['Insert']>;
      };

      obra_usuarios: {
        Row: {
          id:         string;
          obra_id:    string;
          usuario_id: string;
          papel:      string | null;
          ativo:      boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['obra_usuarios']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['obra_usuarios']['Insert']>;
      };

      equipes: {
        Row: {
          id:              string;
          empresa_id:      string;
          nome:            string;
          tipo:            Database['public']['Enums']['tipo_equipe'];
          responsavel:     string | null;
          telefone:        string | null;
          cnpj_terceiro:   string | null;
          especialidade:   string | null;
          ativo:           boolean;
          created_at:      string;
          updated_at:      string;
        };
        Insert: Omit<Database['public']['Tables']['equipes']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['equipes']['Insert']>;
      };

      fvs_padrao: {
        Row: {
          id:            string;
          empresa_id:    string;
          nome:          string;
          codigo:        string | null;
          descricao:     string | null;
          categoria:     Database['public']['Enums']['categoria_fvs'];
          norma_ref:     string | null;
          revisao_atual: number;
          ativo:         boolean;
          created_by:    string;
          created_at:    string;
          updated_at:    string;
        };
        Insert: Omit<Database['public']['Tables']['fvs_padrao']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:           string;
          revisao_atual?: number;
          created_at?:   string;
          updated_at?:   string;
        };
        Update: Partial<Database['public']['Tables']['fvs_padrao']['Insert']>;
      };

      fvs_padrao_revisoes: {
        Row: {
          id:             string;
          fvs_padrao_id:  string;
          numero_revisao: number;
          descricao_alt:  string | null;
          revisado_por:   string;
          created_at:     string;
        };
        Insert: Omit<Database['public']['Tables']['fvs_padrao_revisoes']['Row'], 'id' | 'created_at'> & {
          id?:         string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fvs_padrao_revisoes']['Insert']>;
      };

      fvs_padrao_itens: {
        Row: {
          id:            string;
          fvs_padrao_id: string;
          revisao:       number;
          ordem:         number;
          titulo:        string;
          metodo_verif:  string | null;
          tolerancia:    string | null;
          created_at:    string;
        };
        Insert: Omit<Database['public']['Tables']['fvs_padrao_itens']['Row'], 'id' | 'created_at'> & {
          id?:         string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fvs_padrao_itens']['Insert']>;
      };

      ambientes: {
        Row: {
          id:          string;
          obra_id:     string;
          nome:        string;
          tipo:        Database['public']['Enums']['tipo_ambiente'];
          localizacao: string | null;
          observacoes: string | null;
          ativo:       boolean;
          created_at:  string;
          updated_at:  string;
        };
        Insert: Omit<Database['public']['Tables']['ambientes']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ambientes']['Insert']>;
      };

      fvs_planejadas: {
        Row: {
          id:                string;
          ambiente_id:       string;
          fvs_padrao_id:     string;
          revisao_associada: number;
          subservico:        string | null;
          status:            Database['public']['Enums']['status_fvs'];
          concluida_em:      string | null;
          created_at:        string;
          updated_at:        string;
        };
        Insert: Omit<Database['public']['Tables']['fvs_planejadas']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string;
          status?:     Database['public']['Enums']['status_fvs'];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['fvs_planejadas']['Insert']>;
      };

      verificacoes: {
        Row: {
          id:               string;
          fvs_planejada_id: string;
          numero_verif:     number;
          inspetor_id:      string;
          equipe_id:        string | null;
          data_verif:       string;
          percentual_exec:  number;
          status:           Database['public']['Enums']['status_fvs'];
          observacoes:      string | null;
          assinatura_url:   string | null;
          assinada_em:      string | null;
          sync_id:          string;
          created_offline:  boolean;
          created_at:       string;
          updated_at:       string;
        };
        Insert: Omit<Database['public']['Tables']['verificacoes']['Row'], 'id' | 'numero_verif' | 'created_at' | 'updated_at'> & {
          id?:             string;
          numero_verif?:   number;
          percentual_exec?: number;
          created_offline?: boolean;
          created_at?:     string;
          updated_at?:     string;
        };
        Update: Partial<Database['public']['Tables']['verificacoes']['Insert']>;
      };

      verificacao_itens: {
        Row: {
          id:                 string;
          verificacao_id:     string;
          fvs_padrao_item_id: string;
          ordem:              number;
          titulo:             string;
          metodo_verif:       string | null;
          tolerancia:         string | null;
          resultado:          Database['public']['Enums']['resultado_item'] | null;
          created_at:         string;
        };
        Insert: Omit<Database['public']['Tables']['verificacao_itens']['Row'], 'id' | 'created_at'> & {
          id?:         string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['verificacao_itens']['Insert']>;
      };

      verificacao_fotos: {
        Row: {
          id:             string;
          verificacao_id: string;
          r2_key:         string;
          r2_thumb_key:   string | null;
          nome_arquivo:   string | null;
          tamanho_bytes:  number | null;
          mime_type:      string | null;
          ordem:          number;
          created_at:     string;
        };
        Insert: Omit<Database['public']['Tables']['verificacao_fotos']['Row'], 'id' | 'created_at'> & {
          id?:         string;
          ordem?:      number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['verificacao_fotos']['Insert']>;
      };

      nao_conformidades: {
        Row: {
          id:                    string;
          verificacao_id:        string;
          verificacao_item_id:   string;
          descricao:             string;
          solucao_proposta:      string;
          responsavel_id:        string | null;
          data_nova_verif:       string;
          prioridade:            'alta' | 'media' | 'baixa';
          status:                Database['public']['Enums']['status_nc'];
          resolvida_na_verif_id: string | null;
          resolvida_em:          string | null;
          observacao_resolucao:  string | null;
          created_at:            string;
          updated_at:            string;
        };
        Insert: Omit<Database['public']['Tables']['nao_conformidades']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?:         string;
          prioridade?: 'alta' | 'media' | 'baixa';
          status?:     Database['public']['Enums']['status_nc'];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['nao_conformidades']['Insert']>;
      };

      nc_fotos: {
        Row: {
          id:           string;
          nc_id:        string;
          r2_key:       string;
          r2_thumb_key: string | null;
          nome_arquivo: string | null;
          tamanho_bytes:number | null;
          mime_type:    string | null;
          ordem:        number;
          created_at:   string;
        };
        Insert: Omit<Database['public']['Tables']['nc_fotos']['Row'], 'id' | 'created_at'> & {
          id?:         string;
          ordem?:      number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['nc_fotos']['Insert']>;
      };
    };

    Enums: {
      perfil_usuario: 'admin' | 'gestor' | 'inspetor';
      tipo_ambiente:  'interno' | 'externo';
      status_obra:    'nao_iniciada' | 'em_andamento' | 'paralisada' | 'concluida';
      status_fvs:     'pendente' | 'em_andamento' | 'conforme' | 'nao_conforme';
      resultado_item: 'conforme' | 'nao_conforme' | 'na';
      status_nc:      'aberta' | 'em_correcao' | 'resolvida' | 'cancelada';
      tipo_equipe:    'proprio' | 'terceirizado';
      categoria_fvs:
        | 'estrutura' | 'vedacao' | 'revestimento' | 'instalacoes'
        | 'cobertura' | 'acabamento' | 'fundacao' | 'terraplanagem' | 'outro';
    };

    Functions: {
      get_perfil:     { Args: Record<never, never>; Returns: Database['public']['Enums']['perfil_usuario'] };
      get_empresa_id: { Args: Record<never, never>; Returns: string };
      get_obras_acesso: { Args: Record<never, never>; Returns: string[] };
      next_numero_verif: {
        Args:    { p_fvs_planejada_id: string };
        Returns: number;
      };
    };
  };
}
