export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ambientes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          localizacao: string | null
          nome: string
          obra_id: string
          observacoes: string | null
          tipo: Database["public"]["Enums"]["tipo_ambiente"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          localizacao?: string | null
          nome: string
          obra_id: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ambiente"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          localizacao?: string | null
          nome?: string
          obra_id?: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["tipo_ambiente"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambientes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambientes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "v_obras_com_fvs"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cep: string | null
          cnpj: string
          contato: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          ie: string | null
          municipio: string | null
          nome: string
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cep?: string | null
          cnpj: string
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          ie?: string | null
          municipio?: string | null
          nome: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cep?: string | null
          cnpj?: string
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          ie?: string | null
          municipio?: string | null
          nome?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      equipes: {
        Row: {
          ativo: boolean
          cnpj_terceiro: string | null
          created_at: string
          empresa_id: string
          especialidade: string | null
          id: string
          nome: string
          responsavel: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_equipe"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj_terceiro?: string | null
          created_at?: string
          empresa_id: string
          especialidade?: string | null
          id?: string
          nome: string
          responsavel?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_equipe"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj_terceiro?: string | null
          created_at?: string
          empresa_id?: string
          especialidade?: string | null
          id?: string
          nome?: string
          responsavel?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_equipe"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_conclusoes: {
        Row: {
          assinada_em: string | null
          assinatura_url: string | null
          created_at: string
          fvs_planejada_id: string
          id: string
          inspetor_id: string
          motivo_antes_100: string | null
          numero_conclusao: number
          observacao_final: string | null
          percentual_final: number
          resultado: string
          tipo_motivo: string | null
        }
        Insert: {
          assinada_em?: string | null
          assinatura_url?: string | null
          created_at?: string
          fvs_planejada_id: string
          id?: string
          inspetor_id: string
          motivo_antes_100?: string | null
          numero_conclusao?: number
          observacao_final?: string | null
          percentual_final: number
          resultado: string
          tipo_motivo?: string | null
        }
        Update: {
          assinada_em?: string | null
          assinatura_url?: string | null
          created_at?: string
          fvs_planejada_id?: string
          id?: string
          inspetor_id?: string
          motivo_antes_100?: string | null
          numero_conclusao?: number
          observacao_final?: string | null
          percentual_final?: number
          resultado?: string
          tipo_motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fvs_conclusoes_fvs_planejada_id_fkey"
            columns: ["fvs_planejada_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_conclusoes_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_padrao: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["categoria_fvs"]
          codigo: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          norma_ref: string | null
          revisao_atual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_fvs"]
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          norma_ref?: string | null
          revisao_atual?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_fvs"]
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          norma_ref?: string | null
          revisao_atual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fvs_padrao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_padrao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_padrao_itens: {
        Row: {
          created_at: string
          fvs_padrao_id: string
          id: string
          metodo_verif: string | null
          ordem: number
          revisao: number
          titulo: string
          tolerancia: string | null
        }
        Insert: {
          created_at?: string
          fvs_padrao_id: string
          id?: string
          metodo_verif?: string | null
          ordem?: number
          revisao: number
          titulo: string
          tolerancia?: string | null
        }
        Update: {
          created_at?: string
          fvs_padrao_id?: string
          id?: string
          metodo_verif?: string | null
          ordem?: number
          revisao?: number
          titulo?: string
          tolerancia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fvs_padrao_itens_fvs_padrao_id_fkey"
            columns: ["fvs_padrao_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_padrao_revisoes: {
        Row: {
          created_at: string
          descricao_alt: string
          fvs_padrao_id: string
          id: string
          numero_revisao: number
          revisado_por: string | null
        }
        Insert: {
          created_at?: string
          descricao_alt: string
          fvs_padrao_id: string
          id?: string
          numero_revisao: number
          revisado_por?: string | null
        }
        Update: {
          created_at?: string
          descricao_alt?: string
          fvs_padrao_id?: string
          id?: string
          numero_revisao?: number
          revisado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fvs_padrao_revisoes_fvs_padrao_id_fkey"
            columns: ["fvs_padrao_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_padrao_revisoes_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_planejadas: {
        Row: {
          ambiente_id: string
          concluida_em: string | null
          created_at: string
          fvs_padrao_id: string
          id: string
          percentual_exec: number
          revisao_associada: number
          status: Database["public"]["Enums"]["status_fvs"]
          subservico: string | null
          total_conclusoes: number
          total_reaberturas: number
          ultima_conclusao_em: string | null
          ultima_reabertura_em: string | null
          updated_at: string
        }
        Insert: {
          ambiente_id: string
          concluida_em?: string | null
          created_at?: string
          fvs_padrao_id: string
          id?: string
          percentual_exec?: number
          revisao_associada: number
          status?: Database["public"]["Enums"]["status_fvs"]
          subservico?: string | null
          total_conclusoes?: number
          total_reaberturas?: number
          ultima_conclusao_em?: string | null
          ultima_reabertura_em?: string | null
          updated_at?: string
        }
        Update: {
          ambiente_id?: string
          concluida_em?: string | null
          created_at?: string
          fvs_padrao_id?: string
          id?: string
          percentual_exec?: number
          revisao_associada?: number
          status?: Database["public"]["Enums"]["status_fvs"]
          subservico?: string | null
          total_conclusoes?: number
          total_reaberturas?: number
          ultima_conclusao_em?: string | null
          ultima_reabertura_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fvs_planejadas_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_planejadas_fvs_padrao_id_fkey"
            columns: ["fvs_padrao_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_reaberturas: {
        Row: {
          autorizado_por: string
          created_at: string
          fvs_planejada_id: string
          id: string
          justificativa: string
          motivo_tipo: string
          numero_reabertura: number
          solicitado_por: string
        }
        Insert: {
          autorizado_por: string
          created_at?: string
          fvs_planejada_id: string
          id?: string
          justificativa: string
          motivo_tipo: string
          numero_reabertura?: number
          solicitado_por: string
        }
        Update: {
          autorizado_por?: string
          created_at?: string
          fvs_planejada_id?: string
          id?: string
          justificativa?: string
          motivo_tipo?: string
          numero_reabertura?: number
          solicitado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "fvs_reaberturas_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_reaberturas_fvs_planejada_id_fkey"
            columns: ["fvs_planejada_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_reaberturas_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      nao_conformidades: {
        Row: {
          created_at: string
          data_nova_verif: string
          descricao: string
          foto_reinspecao_url: string | null
          id: string
          nc_anterior_id: string | null
          numero_ocorrencia: number
          observacao_resolucao: string | null
          prioridade: string
          resolvida_em: string | null
          resolvida_na_verif_id: string | null
          responsavel_id: string | null
          solucao_proposta: string
          status: Database["public"]["Enums"]["status_nc"]
          updated_at: string
          verificacao_id: string
          verificacao_item_id: string
          verificacao_reinsp_id: string | null
        }
        Insert: {
          created_at?: string
          data_nova_verif: string
          descricao: string
          foto_reinspecao_url?: string | null
          id?: string
          nc_anterior_id?: string | null
          numero_ocorrencia?: number
          observacao_resolucao?: string | null
          prioridade?: string
          resolvida_em?: string | null
          resolvida_na_verif_id?: string | null
          responsavel_id?: string | null
          solucao_proposta: string
          status?: Database["public"]["Enums"]["status_nc"]
          updated_at?: string
          verificacao_id: string
          verificacao_item_id: string
          verificacao_reinsp_id?: string | null
        }
        Update: {
          created_at?: string
          data_nova_verif?: string
          descricao?: string
          foto_reinspecao_url?: string | null
          id?: string
          nc_anterior_id?: string | null
          numero_ocorrencia?: number
          observacao_resolucao?: string | null
          prioridade?: string
          resolvida_em?: string | null
          resolvida_na_verif_id?: string | null
          responsavel_id?: string | null
          solucao_proposta?: string
          status?: Database["public"]["Enums"]["status_nc"]
          updated_at?: string
          verificacao_id?: string
          verificacao_item_id?: string
          verificacao_reinsp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nao_conformidades_nc_origem_id_fkey"
            columns: ["nc_anterior_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_resolvida_na_verif_id_fkey"
            columns: ["resolvida_na_verif_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_verificacao_id_fkey"
            columns: ["verificacao_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_verificacao_item_id_fkey"
            columns: ["verificacao_item_id"]
            isOneToOne: false
            referencedRelation: "verificacao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_verificacao_reinsp_id_fkey"
            columns: ["verificacao_reinsp_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_fotos: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          nc_id: string
          nome_arquivo: string | null
          ordem: number
          r2_key: string
          r2_thumb_key: string | null
          tamanho_bytes: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nc_id: string
          nome_arquivo?: string | null
          ordem?: number
          r2_key: string
          r2_thumb_key?: string | null
          tamanho_bytes?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nc_id?: string
          nome_arquivo?: string | null
          ordem?: number
          r2_key?: string
          r2_thumb_key?: string | null
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_fotos_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_reinspecoes: {
        Row: {
          created_at: string
          foto_url: string | null
          id: string
          inspetor_id: string
          nc_id: string
          nova_nc_id: string | null
          observacao: string | null
          resultado: string
          verificacao_id: string
        }
        Insert: {
          created_at?: string
          foto_url?: string | null
          id?: string
          inspetor_id: string
          nc_id: string
          nova_nc_id?: string | null
          observacao?: string | null
          resultado: string
          verificacao_id: string
        }
        Update: {
          created_at?: string
          foto_url?: string | null
          id?: string
          inspetor_id?: string
          nc_id?: string
          nova_nc_id?: string | null
          observacao?: string | null
          resultado?: string
          verificacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nc_reinspecoes_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_reinspecoes_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_reinspecoes_nova_nc_id_fkey"
            columns: ["nova_nc_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_reinspecoes_verificacao_id_fkey"
            columns: ["verificacao_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_equipes: {
        Row: {
          created_at: string
          equipe_id: string
          id: string
          obra_id: string
        }
        Insert: {
          created_at?: string
          equipe_id: string
          id?: string
          obra_id: string
        }
        Update: {
          created_at?: string
          equipe_id?: string
          id?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_equipes_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_equipes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_equipes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "v_obras_com_fvs"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          obra_id: string
          papel: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          obra_id: string
          papel?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          obra_id?: string
          papel?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_usuarios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_usuarios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "v_obras_com_fvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          area_total_m2: number | null
          ativo: boolean
          cep: string | null
          crea_cau: string
          created_at: string
          data_inicio_prev: string | null
          data_inicio_real: string | null
          data_termino_prev: string | null
          data_termino_real: string | null
          empresa_id: string
          endereco: string | null
          eng_responsavel: string
          id: string
          municipio: string | null
          nome: string
          num_alvara: string | null
          num_art: string | null
          num_pavimentos: number | null
          observacoes: string | null
          status: Database["public"]["Enums"]["status_obra"]
          tipo: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          area_total_m2?: number | null
          ativo?: boolean
          cep?: string | null
          crea_cau: string
          created_at?: string
          data_inicio_prev?: string | null
          data_inicio_real?: string | null
          data_termino_prev?: string | null
          data_termino_real?: string | null
          empresa_id: string
          endereco?: string | null
          eng_responsavel: string
          id?: string
          municipio?: string | null
          nome: string
          num_alvara?: string | null
          num_art?: string | null
          num_pavimentos?: number | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_obra"]
          tipo?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          area_total_m2?: number | null
          ativo?: boolean
          cep?: string | null
          crea_cau?: string
          created_at?: string
          data_inicio_prev?: string | null
          data_inicio_real?: string | null
          data_termino_prev?: string | null
          data_termino_real?: string | null
          empresa_id?: string
          endereco?: string | null
          eng_responsavel?: string
          id?: string
          municipio?: string | null
          nome?: string
          num_alvara?: string | null
          num_art?: string | null
          num_pavimentos?: number | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_obra"]
          tipo?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cargo: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["perfil_usuario"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          empresa_id?: string | null
          id: string
          nome: string
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacao_fotos: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string | null
          ordem: number
          r2_key: string
          r2_thumb_key: string | null
          tamanho_bytes: number | null
          verificacao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string | null
          ordem?: number
          r2_key: string
          r2_thumb_key?: string | null
          tamanho_bytes?: number | null
          verificacao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string | null
          ordem?: number
          r2_key?: string
          r2_thumb_key?: string | null
          tamanho_bytes?: number | null
          verificacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verificacao_fotos_verificacao_id_fkey"
            columns: ["verificacao_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacao_itens: {
        Row: {
          created_at: string
          fvs_padrao_item_id: string
          id: string
          metodo_verif: string | null
          ordem: number
          resultado: Database["public"]["Enums"]["resultado_item"]
          titulo: string
          tolerancia: string | null
          verificacao_id: string
        }
        Insert: {
          created_at?: string
          fvs_padrao_item_id: string
          id?: string
          metodo_verif?: string | null
          ordem: number
          resultado?: Database["public"]["Enums"]["resultado_item"]
          titulo: string
          tolerancia?: string | null
          verificacao_id: string
        }
        Update: {
          created_at?: string
          fvs_padrao_item_id?: string
          id?: string
          metodo_verif?: string | null
          ordem?: number
          resultado?: Database["public"]["Enums"]["resultado_item"]
          titulo?: string
          tolerancia?: string | null
          verificacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verificacao_itens_fvs_padrao_item_id_fkey"
            columns: ["fvs_padrao_item_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacao_itens_fvs_padrao_item_id_fkey"
            columns: ["fvs_padrao_item_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao_itens_current"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacao_itens_verificacao_id_fkey"
            columns: ["verificacao_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacoes: {
        Row: {
          assinada_em: string | null
          assinatura_url: string | null
          created_at: string
          created_offline: boolean
          data_verif: string
          equipe_id: string | null
          fvs_planejada_id: string
          id: string
          inspetor_id: string
          numero_verif: number
          observacoes: string | null
          percentual_exec: number
          status: Database["public"]["Enums"]["status_fvs"]
          sync_id: string | null
          updated_at: string
        }
        Insert: {
          assinada_em?: string | null
          assinatura_url?: string | null
          created_at?: string
          created_offline?: boolean
          data_verif: string
          equipe_id?: string | null
          fvs_planejada_id: string
          id?: string
          inspetor_id: string
          numero_verif: number
          observacoes?: string | null
          percentual_exec?: number
          status?: Database["public"]["Enums"]["status_fvs"]
          sync_id?: string | null
          updated_at?: string
        }
        Update: {
          assinada_em?: string | null
          assinatura_url?: string | null
          created_at?: string
          created_offline?: boolean
          data_verif?: string
          equipe_id?: string | null
          fvs_planejada_id?: string
          id?: string
          inspetor_id?: string
          numero_verif?: number
          observacoes?: string | null
          percentual_exec?: number
          status?: Database["public"]["Enums"]["status_fvs"]
          sync_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verificacoes_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacoes_fvs_planejada_id_fkey"
            columns: ["fvs_planejada_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacoes_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fvs_padrao_itens_current: {
        Row: {
          created_at: string | null
          fvs_padrao_id: string | null
          id: string | null
          metodo_verif: string | null
          ordem: number | null
          revisao: number | null
          titulo: string | null
          tolerancia: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fvs_padrao_itens_fvs_padrao_id_fkey"
            columns: ["fvs_padrao_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id"]
          },
        ]
      }
      v_obras_com_fvs: {
        Row: {
          empresa_nome: string | null
          endereco: string | null
          engenheiro_crea: string | null
          engenheiro_nome: string | null
          fvs_concluidas: number | null
          id: string | null
          municipio: string | null
          ncs_abertas: number | null
          nome: string | null
          progresso_percentual: number | null
          status: Database["public"]["Enums"]["status_obra"] | null
          total_ambientes: number | null
          total_fvs: number | null
          uf: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_ambientes_obra: {
        Args: { p_obra_id: string }
        Returns: {
          fvs_concluidas: number
          id: string
          localizacao: string
          ncs_abertas: number
          nome: string
          progresso_percentual: number
          tipo: string
          total_fvs: number
        }[]
      }
      get_empresa_id: { Args: never; Returns: string }
      get_fotos_fvs: {
        Args: { p_fvs_id: string }
        Returns: {
          id: string
          ordem: number
          r2_key: string
          verificacao_id: string
        }[]
      }
      get_fvs_ambiente: {
        Args: { p_ambiente_id: string }
        Returns: {
          id: string
          status: string
          subservico: string
          total_verificacoes: number
          ultima_verif: string
        }[]
      }
      get_fvs_detalhe: {
        Args: { p_fvs_id: string }
        Returns: {
          ambiente_nome: string
          id: string
          obra_nome: string
          status: string
          subservico: string
        }[]
      }
      get_itens_checklist: {
        Args: { p_fvs_id: string }
        Returns: {
          id: string
          metodo_verif: string
          ordem: number
          titulo: string
          tolerancia: string
        }[]
      }
      get_ncs_abertas_inspetor: {
        Args: { p_inspetor_id: string }
        Returns: {
          count: number
        }[]
      }
      get_ncs_full: {
        Args: never
        Returns: {
          ambiente_id: string
          ambiente_nome: string
          data_nova_verif: string
          descricao: string
          fvs_planejada_id: string
          id: string
          item_titulo: string
          obra_id: string
          obra_nome: string
          prazo_correcao: string
          prioridade: string
          responsavel_nome: string
          status: string
        }[]
      }
      get_ncs_fvs: {
        Args: { p_fvs_id: string }
        Returns: {
          data_nova_verif: string
          descricao: string
          id: string
          item_titulo: string
          responsavel_nome: string
          solucao_proposta: string
          status: string
          verificacao_id: string
        }[]
      }
      get_ncs_urgentes: {
        Args: never
        Returns: {
          ambiente_nome: string
          data_nova_verif: string
          descricao: string
          equipe_nome: string
          id: string
          item_titulo: string
          obra_nome: string
          prioridade: string
          status: string
          subservico: string
        }[]
      }
      get_obra_kpi: {
        Args: { p_obra_id: string }
        Returns: {
          fvs_concluidas: number
          ncs_abertas: number
          progresso_percentual: number
          total_ambientes: number
          total_fvs: number
        }[]
      }
      get_obras_acesso: { Args: never; Returns: string[] }
      get_obras_com_fvs: {
        Args: never
        Returns: {
          empresa_nome: string
          endereco: string
          engenheiro_crea: string
          engenheiro_nome: string
          fvs_concluidas: number
          id: string
          municipio: string
          ncs_abertas: number
          nome: string
          progresso_percentual: number
          status: string
          total_ambientes: number
          total_fvs: number
          uf: string
        }[]
      }
      get_obras_progresso_dashboard: {
        Args: never
        Returns: {
          empresa_nome: string
          fvs_concluidas: number
          id: string
          municipio: string
          ncs_abertas: number
          nome: string
          progresso_percentual: number
          status: string
          total_ambientes: number
          total_fvs: number
          uf: string
        }[]
      }
      get_perfil: {
        Args: never
        Returns: Database["public"]["Enums"]["perfil_usuario"]
      }
      get_usuarios_com_obras: {
        Args: never
        Returns: {
          ativo: boolean
          cargo: string
          email: string
          id: string
          nome: string
          obras_acesso: Json
          perfil: string
          ultimo_acesso: string
        }[]
      }
      get_verificacoes_fvs: {
        Args: { p_fvs_id: string }
        Returns: {
          assinatura_url: string
          created_at: string
          created_offline: boolean
          data_verif: string
          id: string
          inspetor_nome: string
          numero_verif: number
          observacoes: string
          percentual_exec: number
          status: string
        }[]
      }
      get_verificacoes_recentes: {
        Args: never
        Returns: {
          ambiente_id: string
          ambiente_nome: string
          data_verif: string
          fvs_nome: string
          fvs_planejada_id: string
          id: string
          obra_id: string
          obra_nome: string
          status: string
        }[]
      }
      next_numero_verif: {
        Args: { p_fvs_planejada_id: string }
        Returns: number
      }
      set_fvs_lifecycle_status: {
        Args: {
          p_field: string
          p_fvs_id: string
          p_now: string
          p_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      categoria_fvs:
        | "estrutura"
        | "vedacao"
        | "revestimento"
        | "instalacoes"
        | "cobertura"
        | "acabamento"
        | "fundacao"
        | "terraplanagem"
        | "outro"
      perfil_usuario: "admin" | "gestor" | "inspetor"
      resultado_item: "conforme" | "nao_conforme" | "na"
      status_fvs:
        | "pendente"
        | "em_andamento"
        | "conforme"
        | "nao_conforme"
        | "concluida"
        | "em_revisao"
        | "concluida_ressalva"
      status_nc:
        | "aberta"
        | "em_correcao"
        | "resolvida"
        | "cancelada"
        | "encerrada_sem_resolucao"
      status_obra: "nao_iniciada" | "em_andamento" | "paralisada" | "concluida"
      tipo_ambiente: "interno" | "externo"
      tipo_equipe: "proprio" | "terceirizado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      categoria_fvs: [
        "estrutura",
        "vedacao",
        "revestimento",
        "instalacoes",
        "cobertura",
        "acabamento",
        "fundacao",
        "terraplanagem",
        "outro",
      ],
      perfil_usuario: ["admin", "gestor", "inspetor"],
      resultado_item: ["conforme", "nao_conforme", "na"],
      status_fvs: [
        "pendente",
        "em_andamento",
        "conforme",
        "nao_conforme",
        "concluida",
        "em_revisao",
        "concluida_ressalva",
      ],
      status_nc: [
        "aberta",
        "em_correcao",
        "resolvida",
        "cancelada",
        "encerrada_sem_resolucao",
      ],
      status_obra: ["nao_iniciada", "em_andamento", "paralisada", "concluida"],
      tipo_ambiente: ["interno", "externo"],
      tipo_equipe: ["proprio", "terceirizado"],
    },
  },
} as const
