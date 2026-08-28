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
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "ambientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambientes_obra_cliente_fkey"
            columns: ["obra_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id", "cliente_id"]
          },
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
          {
            foreignKeyName: "ambientes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_indicadores_medicoes"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      auditoria_operacional: {
        Row: {
          acao: string
          cliente_id: string
          created_at: string
          dados: Json
          entidade: string
          entidade_id: string
          id: string
          obra_id: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          cliente_id: string
          created_at?: string
          dados?: Json
          entidade: string
          entidade_id: string
          id?: string
          obra_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          cliente_id?: string
          created_at?: string
          dados?: Json
          entidade?: string
          entidade_id?: string
          id?: string
          obra_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_operacional_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_operacional_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_operacional_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "v_obras_com_fvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_operacional_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_indicadores_medicoes"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "auditoria_operacional_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_plataforma: {
        Row: {
          acao: string
          ator_id: string | null
          cliente_id: string | null
          created_at: string
          detalhes: Json
          id: string
        }
        Insert: {
          acao: string
          ator_id?: string | null
          cliente_id?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
        }
        Update: {
          acao?: string
          ator_id?: string | null
          cliente_id?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_plataforma_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_empreiteiro_itens: {
        Row: {
          avaliacao_id: string
          cliente_id: string
          comentario_nao_atende: string | null
          created_at: string
          criterio_origem_id: string | null
          id: string
          ordem: number
          peso: number
          resultado:
            | Database["public"]["Enums"]["resultado_criterio_avaliacao"]
            | null
          titulo: string
        }
        Insert: {
          avaliacao_id: string
          cliente_id: string
          comentario_nao_atende?: string | null
          created_at?: string
          criterio_origem_id?: string | null
          id?: string
          ordem: number
          peso: number
          resultado?:
            | Database["public"]["Enums"]["resultado_criterio_avaliacao"]
            | null
          titulo: string
        }
        Update: {
          avaliacao_id?: string
          cliente_id?: string
          comentario_nao_atende?: string | null
          created_at?: string
          criterio_origem_id?: string | null
          id?: string
          ordem?: number
          peso?: number
          resultado?:
            | Database["public"]["Enums"]["resultado_criterio_avaliacao"]
            | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_empreiteiro_itens_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes_empreiteiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_empreiteiro_itens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_empreiteiro_itens_criterio_origem_id_fkey"
            columns: ["criterio_origem_id"]
            isOneToOne: false
            referencedRelation: "modelo_avaliacao_empreiteiro_criterios"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_empreiteiro_reaberturas: {
        Row: {
          avaliacao_id: string
          avaliador_anterior_id: string
          cliente_id: string
          created_at: string
          id: string
          motivo: string
          numero_reabertura: number
          reaberto_por: string
        }
        Insert: {
          avaliacao_id: string
          avaliador_anterior_id: string
          cliente_id: string
          created_at?: string
          id?: string
          motivo: string
          numero_reabertura: number
          reaberto_por: string
        }
        Update: {
          avaliacao_id?: string
          avaliador_anterior_id?: string
          cliente_id?: string
          created_at?: string
          id?: string
          motivo?: string
          numero_reabertura?: number
          reaberto_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_empreiteiro_reaberturas_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes_empreiteiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_empreiteiro_reaberturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_empreiteiro_reaberturas_avaliador_anterior_id_fkey"
            columns: ["avaliador_anterior_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_empreiteiro_reaberturas_reaberto_por_fkey"
            columns: ["reaberto_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_empreiteiro: {
        Row: {
          aprovada_em: string | null
          aprovada_por: string | null
          assinada_em: string | null
          assinatura_url: string | null
          avaliador_id: string
          cliente_id: string
          concluida_em: string | null
          created_at: string
          created_offline: boolean
          data_avaliacao: string
          equipe_id: string
          id: string
          invalidada_em: string | null
          invalidada_por: string | null
          medicao_id: string | null
          modelo_revisao_id: string
          motivo_invalidacao: string | null
          ultimo_motivo_reabertura: string | null
          notificacoes_ocorridas: string | null
          obra_id: string
          percentual: number
          pontos_obtidos: number
          pontos_possiveis: number
          providencias_tomadas: string | null
          status: Database["public"]["Enums"]["status_avaliacao_empreiteiro"]
          updated_at: string
        }
        Insert: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          assinada_em?: string | null
          assinatura_url?: string | null
          avaliador_id: string
          cliente_id: string
          concluida_em?: string | null
          created_at?: string
          created_offline?: boolean
          data_avaliacao?: string
          equipe_id: string
          id?: string
          invalidada_em?: string | null
          invalidada_por?: string | null
          medicao_id?: string | null
          modelo_revisao_id: string
          motivo_invalidacao?: string | null
          ultimo_motivo_reabertura?: string | null
          notificacoes_ocorridas?: string | null
          obra_id: string
          percentual?: number
          pontos_obtidos?: number
          pontos_possiveis?: number
          providencias_tomadas?: string | null
          status?: Database["public"]["Enums"]["status_avaliacao_empreiteiro"]
          updated_at?: string
        }
        Update: {
          aprovada_em?: string | null
          aprovada_por?: string | null
          assinada_em?: string | null
          assinatura_url?: string | null
          avaliador_id?: string
          cliente_id?: string
          concluida_em?: string | null
          created_at?: string
          created_offline?: boolean
          data_avaliacao?: string
          equipe_id?: string
          id?: string
          invalidada_em?: string | null
          invalidada_por?: string | null
          medicao_id?: string | null
          modelo_revisao_id?: string
          motivo_invalidacao?: string | null
          ultimo_motivo_reabertura?: string | null
          notificacoes_ocorridas?: string | null
          obra_id?: string
          percentual?: number
          pontos_obtidos?: number
          pontos_possiveis?: number
          providencias_tomadas?: string | null
          status?: Database["public"]["Enums"]["status_avaliacao_empreiteiro"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_empreiteiro_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_invalidada_por_fkey"
            columns: ["invalidada_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_modelo_revisao_id_fkey"
            columns: ["modelo_revisao_id"]
            isOneToOne: false
            referencedRelation: "modelo_avaliacao_empreiteiro_revisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "v_obras_com_fvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_empreiteiro_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_indicadores_medicoes"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      avancos_aprovados_servico: {
        Row: {
          aprovado_anterior: number
          aprovado_atual: number
          aprovado_por: string
          cliente_id: string
          created_at: string
          created_offline: boolean
          data_aprovacao: string
          etapa_id: string | null
          executado_anterior: number
          executado_atual: number
          id: string
          unidade: string
          verificacao_id: string
          vinculacao_id: string
        }
        Insert: {
          aprovado_anterior: number
          aprovado_atual: number
          aprovado_por: string
          cliente_id: string
          created_at?: string
          created_offline?: boolean
          data_aprovacao?: string
          etapa_id?: string | null
          executado_anterior: number
          executado_atual: number
          id?: string
          unidade: string
          verificacao_id: string
          vinculacao_id: string
        }
        Update: {
          aprovado_anterior?: number
          aprovado_atual?: number
          aprovado_por?: string
          cliente_id?: string
          created_at?: string
          created_offline?: boolean
          data_aprovacao?: string
          etapa_id?: string | null
          executado_anterior?: number
          executado_atual?: number
          id?: string
          unidade?: string
          verificacao_id?: string
          vinculacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avancos_aprovados_servico_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avancos_aprovados_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avancos_aprovados_servico_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "fvs_medicao_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avancos_aprovados_servico_verificacao_id_fkey"
            columns: ["verificacao_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avancos_aprovados_servico_vinculacao_id_fkey"
            columns: ["vinculacao_id"]
            isOneToOne: false
            referencedRelation: "vinculos_execucao_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avancos_aprovados_servico_vinculacao_id_fkey"
            columns: ["vinculacao_id"]
            isOneToOne: false
            referencedRelation: "vw_saldos_medicao_servico"
            referencedColumns: ["vinculacao_id"]
          },
        ]
      }
      clientes: {
        Row: {
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          id: string
          limite_empresas: number | null
          limite_obras: number | null
          limite_usuarios: number | null
          nome: string
          slug: string
          status: Database["public"]["Enums"]["status_cliente"]
          updated_at: string
        }
        Insert: {
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          id?: string
          limite_empresas?: number | null
          limite_obras?: number | null
          limite_usuarios?: number | null
          nome: string
          slug: string
          status?: Database["public"]["Enums"]["status_cliente"]
          updated_at?: string
        }
        Update: {
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          id?: string
          limite_empresas?: number | null
          limite_obras?: number | null
          limite_usuarios?: number | null
          nome?: string
          slug?: string
          status?: Database["public"]["Enums"]["status_cliente"]
          updated_at?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          ativo: boolean
          cep: string | null
          cliente_id: string
          cnpj: string
          contato: string | null
          controle_financeiro_nc_habilitado: boolean
          controle_medicoes_habilitado: boolean
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
          cliente_id: string
          cnpj: string
          contato?: string | null
          controle_financeiro_nc_habilitado?: boolean
          controle_medicoes_habilitado?: boolean
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
          cliente_id?: string
          cnpj?: string
          contato?: string | null
          controle_financeiro_nc_habilitado?: boolean
          controle_medicoes_habilitado?: boolean
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
        Relationships: [
          {
            foreignKeyName: "empresas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_empresas: {
        Row: {
          cliente_id: string
          created_at: string
          empresa_id: string
          equipe_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empresa_id: string
          equipe_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empresa_id?: string
          equipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_empresas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_empresas_empresa_cliente_fkey"
            columns: ["empresa_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "equipe_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_empresas_equipe_cliente_fkey"
            columns: ["equipe_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "equipe_empresas_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          ativo: boolean
          cliente_id: string
          cnpj_terceiro: string | null
          created_at: string
          escopo: Database["public"]["Enums"]["escopo_cadastro"]
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
          cliente_id: string
          cnpj_terceiro?: string | null
          created_at?: string
          escopo?: Database["public"]["Enums"]["escopo_cadastro"]
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
          cliente_id?: string
          cnpj_terceiro?: string | null
          created_at?: string
          escopo?: Database["public"]["Enums"]["escopo_cadastro"]
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
            foreignKeyName: "equipes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_conclusoes: {
        Row: {
          assinada_em: string | null
          assinatura_url: string | null
          cliente_id: string
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
          verificacao_id: string | null
        }
        Insert: {
          assinada_em?: string | null
          assinatura_url?: string | null
          cliente_id: string
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
          verificacao_id?: string | null
        }
        Update: {
          assinada_em?: string | null
          assinatura_url?: string | null
          cliente_id?: string
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
          verificacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fvs_conclusoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "fvs_conclusoes_planejada_cliente_fkey"
            columns: ["fvs_planejada_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "fvs_conclusoes_verificacao_id_fkey"
            columns: ["verificacao_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_medicao_configuracoes: {
        Row: {
          cliente_id: string
          created_at: string
          criado_por: string
          fvs_planejada_id: string
          id: string
          metodo: Database["public"]["Enums"]["metodo_medicao_servico"]
          modelo_origem_id: string | null
          permite_medicoes_parciais: boolean
          preco_unitario: number | null
          quantidade_total: number
          unidade: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          criado_por: string
          fvs_planejada_id: string
          id?: string
          metodo: Database["public"]["Enums"]["metodo_medicao_servico"]
          modelo_origem_id?: string | null
          permite_medicoes_parciais?: boolean
          preco_unitario?: number | null
          quantidade_total: number
          unidade: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          criado_por?: string
          fvs_planejada_id?: string
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_medicao_servico"]
          modelo_origem_id?: string | null
          permite_medicoes_parciais?: boolean
          preco_unitario?: number | null
          quantidade_total?: number
          unidade?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fvs_medicao_configuracoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_medicao_configuracoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_medicao_configuracoes_fvs_planejada_id_fkey"
            columns: ["fvs_planejada_id"]
            isOneToOne: true
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_medicao_configuracoes_modelo_origem_id_fkey"
            columns: ["modelo_origem_id"]
            isOneToOne: false
            referencedRelation: "modelos_etapas_medicao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_medicao_configuracoes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_medicao_etapas: {
        Row: {
          ativo: boolean
          cliente_id: string
          configuracao_id: string
          created_at: string
          equipe_responsavel_id: string | null
          id: string
          nome: string
          ordem: number
          percentual_interno: number | null
          permite_avanco_parcial: boolean
          peso_percentual: number
          status: Database["public"]["Enums"]["status_etapa_medicao"]
          updated_at: string
          updated_by: string | null
          verificacao_evidencia_id: string | null
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          configuracao_id: string
          created_at?: string
          equipe_responsavel_id?: string | null
          id?: string
          nome: string
          ordem: number
          percentual_interno?: number | null
          permite_avanco_parcial?: boolean
          peso_percentual: number
          status?: Database["public"]["Enums"]["status_etapa_medicao"]
          updated_at?: string
          updated_by?: string | null
          verificacao_evidencia_id?: string | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          configuracao_id?: string
          created_at?: string
          equipe_responsavel_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          percentual_interno?: number | null
          permite_avanco_parcial?: boolean
          peso_percentual?: number
          status?: Database["public"]["Enums"]["status_etapa_medicao"]
          updated_at?: string
          updated_by?: string | null
          verificacao_evidencia_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fvs_medicao_etapas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_medicao_etapas_configuracao_id_fkey"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "fvs_medicao_configuracoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_medicao_etapas_equipe_responsavel_id_fkey"
            columns: ["equipe_responsavel_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_medicao_etapas_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_medicao_etapas_verificacao_evidencia_id_fkey"
            columns: ["verificacao_evidencia_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_padrao: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["categoria_fvs"]
          cliente_id: string
          codigo: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          escopo: Database["public"]["Enums"]["escopo_cadastro"]
          id: string
          nome: string
          norma_ref: string | null
          revisao_atual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_fvs"]
          cliente_id: string
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          escopo?: Database["public"]["Enums"]["escopo_cadastro"]
          id?: string
          nome: string
          norma_ref?: string | null
          revisao_atual?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_fvs"]
          cliente_id?: string
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          escopo?: Database["public"]["Enums"]["escopo_cadastro"]
          id?: string
          nome?: string
          norma_ref?: string | null
          revisao_atual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fvs_padrao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_padrao_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_padrao_empresas: {
        Row: {
          cliente_id: string
          created_at: string
          empresa_id: string
          fvs_padrao_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empresa_id: string
          fvs_padrao_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empresa_id?: string
          fvs_padrao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fvs_empresas_empresa_cliente_fkey"
            columns: ["empresa_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "fvs_empresas_padrao_cliente_fkey"
            columns: ["fvs_padrao_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "fvs_padrao_empresas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_padrao_empresas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_padrao_empresas_fvs_padrao_id_fkey"
            columns: ["fvs_padrao_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id"]
          },
        ]
      }
      fvs_padrao_itens: {
        Row: {
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "fvs_itens_padrao_cliente_fkey"
            columns: ["fvs_padrao_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "fvs_padrao_itens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
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
          cliente_id: string
          created_at: string
          descricao_alt: string
          fvs_padrao_id: string
          id: string
          numero_revisao: number
          revisado_por: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          descricao_alt: string
          fvs_padrao_id: string
          id?: string
          numero_revisao: number
          revisado_por?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          descricao_alt?: string
          fvs_padrao_id?: string
          id?: string
          numero_revisao?: number
          revisado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fvs_padrao_revisoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "fvs_revisoes_padrao_cliente_fkey"
            columns: ["fvs_padrao_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id", "cliente_id"]
          },
        ]
      }
      fvs_planejadas: {
        Row: {
          ambiente_id: string
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "fvs_planejadas_ambiente_cliente_fkey"
            columns: ["ambiente_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "fvs_planejadas_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_planejadas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_planejadas_fvs_padrao_id_fkey"
            columns: ["fvs_padrao_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fvs_planejadas_padrao_cliente_fkey"
            columns: ["fvs_padrao_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao"
            referencedColumns: ["id", "cliente_id"]
          },
        ]
      }
      fvs_reaberturas: {
        Row: {
          autorizado_por: string
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "fvs_reaberturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
            foreignKeyName: "fvs_reaberturas_planejada_cliente_fkey"
            columns: ["fvs_planejada_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id", "cliente_id"]
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
      medicao_item_liberacoes: {
        Row: {
          ativa: boolean
          avanco_id: string
          cliente_id: string
          created_at: string
          id: string
          medicao_item_id: string
          quantidade_utilizada: number
        }
        Insert: {
          ativa?: boolean
          avanco_id: string
          cliente_id: string
          created_at?: string
          id?: string
          medicao_item_id: string
          quantidade_utilizada: number
        }
        Update: {
          ativa?: boolean
          avanco_id?: string
          cliente_id?: string
          created_at?: string
          id?: string
          medicao_item_id?: string
          quantidade_utilizada?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicao_item_liberacoes_avanco_id_fkey"
            columns: ["avanco_id"]
            isOneToOne: false
            referencedRelation: "avancos_aprovados_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_item_liberacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_item_liberacoes_medicao_item_id_fkey"
            columns: ["medicao_item_id"]
            isOneToOne: false
            referencedRelation: "medicao_servico_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      medicao_servico_itens: {
        Row: {
          cliente_id: string
          created_at: string
          etapa_id: string | null
          id: string
          medicao_id: string
          nc_id: string | null
          preco_unitario: number | null
          quantidade_anterior: number
          quantidade_atual: number
          quantidade_bloqueada: number
          quantidade_periodo: number
          tipo: Database["public"]["Enums"]["tipo_item_medicao"]
          unidade: string
          valor_calculado: number
          verificacao_id: string | null
          vinculacao_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          etapa_id?: string | null
          id?: string
          medicao_id: string
          nc_id?: string | null
          preco_unitario?: number | null
          quantidade_anterior?: number
          quantidade_atual?: number
          quantidade_bloqueada?: number
          quantidade_periodo?: number
          tipo?: Database["public"]["Enums"]["tipo_item_medicao"]
          unidade: string
          valor_calculado?: number
          verificacao_id?: string | null
          vinculacao_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          etapa_id?: string | null
          id?: string
          medicao_id?: string
          nc_id?: string | null
          preco_unitario?: number | null
          quantidade_anterior?: number
          quantidade_atual?: number
          quantidade_bloqueada?: number
          quantidade_periodo?: number
          tipo?: Database["public"]["Enums"]["tipo_item_medicao"]
          unidade?: string
          valor_calculado?: number
          verificacao_id?: string | null
          vinculacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicao_servico_itens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_servico_itens_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "fvs_medicao_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_servico_itens_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_servico_itens_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_servico_itens_verificacao_id_fkey"
            columns: ["verificacao_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_servico_itens_vinculacao_id_fkey"
            columns: ["vinculacao_id"]
            isOneToOne: false
            referencedRelation: "vinculos_execucao_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_servico_itens_vinculacao_id_fkey"
            columns: ["vinculacao_id"]
            isOneToOne: false
            referencedRelation: "vw_saldos_medicao_servico"
            referencedColumns: ["vinculacao_id"]
          },
        ]
      }
      medicoes_servico: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          cliente_id: string
          created_at: string
          criado_por: string
          data_medicao: string
          equipe_id: string
          id: string
          motivo_cancelamento: string | null
          obra_id: string
          observacao: string | null
          periodo_fim: string
          periodo_inicio: string
          referencia: string
          status: Database["public"]["Enums"]["status_medicao_servico"]
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id: string
          created_at?: string
          criado_por: string
          data_medicao?: string
          equipe_id: string
          id?: string
          motivo_cancelamento?: string | null
          obra_id: string
          observacao?: string | null
          periodo_fim: string
          periodo_inicio: string
          referencia: string
          status?: Database["public"]["Enums"]["status_medicao_servico"]
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_id?: string
          created_at?: string
          criado_por?: string
          data_medicao?: string
          equipe_id?: string
          id?: string
          motivo_cancelamento?: string | null
          obra_id?: string
          observacao?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          referencia?: string
          status?: Database["public"]["Enums"]["status_medicao_servico"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_servico_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_servico_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_servico_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_servico_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_servico_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_servico_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "v_obras_com_fvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_servico_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_indicadores_medicoes"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      modelo_avaliacao_empreiteiro_criterios: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          ordem: number
          peso: number
          revisao_id: string
          titulo: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          ordem: number
          peso: number
          revisao_id: string
          titulo: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          ordem?: number
          peso?: number
          revisao_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelo_avaliacao_empreiteiro_criterios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_avaliacao_empreiteiro_criterios_revisao_id_fkey"
            columns: ["revisao_id"]
            isOneToOne: false
            referencedRelation: "modelo_avaliacao_empreiteiro_revisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      modelo_avaliacao_empreiteiro_revisoes: {
        Row: {
          cliente_id: string
          created_at: string
          descricao_alteracoes: string
          id: string
          modelo_id: string
          numero_revisao: number
          publicado_por: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          descricao_alteracoes: string
          id?: string
          modelo_id: string
          numero_revisao: number
          publicado_por: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          descricao_alteracoes?: string
          id?: string
          modelo_id?: string
          numero_revisao?: number
          publicado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelo_avaliacao_empreiteiro_revisoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_avaliacao_empreiteiro_revisoes_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_avaliacao_empreiteiro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_avaliacao_empreiteiro_revisoes_publicado_por_fkey"
            columns: ["publicado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      modelo_etapas_medicao_itens: {
        Row: {
          ativo: boolean
          cliente_id: string
          id: string
          modelo_id: string
          nome: string
          ordem: number
          permite_avanco_parcial: boolean
          peso_percentual: number
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          id?: string
          modelo_id: string
          nome: string
          ordem: number
          permite_avanco_parcial?: boolean
          peso_percentual: number
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          id?: string
          modelo_id?: string
          nome?: string
          ordem?: number
          permite_avanco_parcial?: boolean
          peso_percentual?: number
        }
        Relationships: [
          {
            foreignKeyName: "modelo_etapas_medicao_itens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_etapas_medicao_itens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_etapas_medicao"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_avaliacao_empreiteiro: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          revisao_atual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          revisao_atual?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          revisao_atual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_avaliacao_empreiteiro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_avaliacao_empreiteiro_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_avaliacao_empreiteiro_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_etapas_medicao: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          criado_por: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_etapas_medicao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_etapas_medicao_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_etapas_medicao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      nao_conformidades: {
        Row: {
          bloqueio_medicao:
            | Database["public"]["Enums"]["bloqueio_medicao_nc"]
            | null
          categoria_financeira:
            | Database["public"]["Enums"]["categoria_impacto_financeiro_nc"]
            | null
          cliente_id: string
          created_at: string
          data_nova_verif: string
          descricao: string
          documento_financeiro_r2_key: string | null
          financeiro_requerido: boolean
          foto_reinspecao_url: string | null
          id: string
          justificativa_sem_impacto: string | null
          nc_anterior_id: string | null
          numero_ocorrencia: number
          observacao_financeira: string | null
          observacao_resolucao: string | null
          percentual_bloqueado: number | null
          prazo_avaliacao: string | null
          prioridade: string
          quantidade_bloqueada: number | null
          resolvida_em: string | null
          resolvida_na_verif_id: string | null
          responsavel_avaliacao_id: string | null
          responsavel_financeiro:
            | Database["public"]["Enums"]["responsavel_financeiro_nc"]
            | null
          responsavel_id: string | null
          situacao_financeira:
            | Database["public"]["Enums"]["situacao_impacto_financeiro_nc"]
            | null
          solucao_proposta: string
          status: Database["public"]["Enums"]["status_nc"]
          updated_at: string
          valor_bloqueado: number | null
          valor_confirmado: number | null
          valor_estimado: number | null
          verificacao_id: string
          verificacao_item_id: string
          verificacao_reinsp_id: string | null
        }
        Insert: {
          bloqueio_medicao?:
            | Database["public"]["Enums"]["bloqueio_medicao_nc"]
            | null
          categoria_financeira?:
            | Database["public"]["Enums"]["categoria_impacto_financeiro_nc"]
            | null
          cliente_id: string
          created_at?: string
          data_nova_verif: string
          descricao: string
          documento_financeiro_r2_key?: string | null
          financeiro_requerido?: boolean
          foto_reinspecao_url?: string | null
          id?: string
          justificativa_sem_impacto?: string | null
          nc_anterior_id?: string | null
          numero_ocorrencia?: number
          observacao_financeira?: string | null
          observacao_resolucao?: string | null
          percentual_bloqueado?: number | null
          prazo_avaliacao?: string | null
          prioridade?: string
          quantidade_bloqueada?: number | null
          resolvida_em?: string | null
          resolvida_na_verif_id?: string | null
          responsavel_avaliacao_id?: string | null
          responsavel_financeiro?:
            | Database["public"]["Enums"]["responsavel_financeiro_nc"]
            | null
          responsavel_id?: string | null
          situacao_financeira?:
            | Database["public"]["Enums"]["situacao_impacto_financeiro_nc"]
            | null
          solucao_proposta: string
          status?: Database["public"]["Enums"]["status_nc"]
          updated_at?: string
          valor_bloqueado?: number | null
          valor_confirmado?: number | null
          valor_estimado?: number | null
          verificacao_id: string
          verificacao_item_id: string
          verificacao_reinsp_id?: string | null
        }
        Update: {
          bloqueio_medicao?:
            | Database["public"]["Enums"]["bloqueio_medicao_nc"]
            | null
          categoria_financeira?:
            | Database["public"]["Enums"]["categoria_impacto_financeiro_nc"]
            | null
          cliente_id?: string
          created_at?: string
          data_nova_verif?: string
          descricao?: string
          documento_financeiro_r2_key?: string | null
          financeiro_requerido?: boolean
          foto_reinspecao_url?: string | null
          id?: string
          justificativa_sem_impacto?: string | null
          nc_anterior_id?: string | null
          numero_ocorrencia?: number
          observacao_financeira?: string | null
          observacao_resolucao?: string | null
          percentual_bloqueado?: number | null
          prazo_avaliacao?: string | null
          prioridade?: string
          quantidade_bloqueada?: number | null
          resolvida_em?: string | null
          resolvida_na_verif_id?: string | null
          responsavel_avaliacao_id?: string | null
          responsavel_financeiro?:
            | Database["public"]["Enums"]["responsavel_financeiro_nc"]
            | null
          responsavel_id?: string | null
          situacao_financeira?:
            | Database["public"]["Enums"]["situacao_impacto_financeiro_nc"]
            | null
          solucao_proposta?: string
          status?: Database["public"]["Enums"]["status_nc"]
          updated_at?: string
          valor_bloqueado?: number | null
          valor_confirmado?: number | null
          valor_estimado?: number | null
          verificacao_id?: string
          verificacao_item_id?: string
          verificacao_reinsp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nao_conformidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "nao_conformidades_responsavel_avaliacao_id_fkey"
            columns: ["responsavel_avaliacao_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
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
          {
            foreignKeyName: "nc_item_cliente_fkey"
            columns: ["verificacao_item_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "verificacao_itens"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "nc_verificacao_cliente_fkey"
            columns: ["verificacao_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id", "cliente_id"]
          },
        ]
      }
      nc_financeiro_historico: {
        Row: {
          alterado_por: string | null
          bloqueio: Database["public"]["Enums"]["bloqueio_medicao_nc"] | null
          cliente_id: string
          created_at: string
          dados: Json
          id: string
          nc_id: string
          situacao:
            | Database["public"]["Enums"]["situacao_impacto_financeiro_nc"]
            | null
        }
        Insert: {
          alterado_por?: string | null
          bloqueio?: Database["public"]["Enums"]["bloqueio_medicao_nc"] | null
          cliente_id: string
          created_at?: string
          dados: Json
          id?: string
          nc_id: string
          situacao?:
            | Database["public"]["Enums"]["situacao_impacto_financeiro_nc"]
            | null
        }
        Update: {
          alterado_por?: string | null
          bloqueio?: Database["public"]["Enums"]["bloqueio_medicao_nc"] | null
          cliente_id?: string
          created_at?: string
          dados?: Json
          id?: string
          nc_id?: string
          situacao?:
            | Database["public"]["Enums"]["situacao_impacto_financeiro_nc"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "nc_financeiro_historico_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_financeiro_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_financeiro_historico_nc_id_fkey"
            columns: ["nc_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id"]
          },
        ]
      }
      nc_fotos: {
        Row: {
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "nc_fotos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_fotos_nc_cliente_fkey"
            columns: ["nc_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id", "cliente_id"]
          },
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
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "nc_reinspecoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_reinspecoes_inspetor_id_fkey"
            columns: ["inspetor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nc_reinspecoes_nc_cliente_fkey"
            columns: ["nc_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["id", "cliente_id"]
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
            foreignKeyName: "nc_reinspecoes_verificacao_cliente_fkey"
            columns: ["verificacao_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id", "cliente_id"]
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
          cliente_id: string
          created_at: string
          equipe_id: string
          id: string
          obra_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          equipe_id: string
          id?: string
          obra_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          equipe_id?: string
          id?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_equipes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_equipes_equipe_cliente_fkey"
            columns: ["equipe_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "obra_equipes_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_equipes_obra_cliente_fkey"
            columns: ["obra_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id", "cliente_id"]
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
          {
            foreignKeyName: "obra_equipes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_indicadores_medicoes"
            referencedColumns: ["obra_id"]
          },
        ]
      }
      obra_usuarios: {
        Row: {
          ativo: boolean
          cliente_id: string
          created_at: string
          id: string
          obra_id: string
          papel: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          created_at?: string
          id?: string
          obra_id: string
          papel?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          created_at?: string
          id?: string
          obra_id?: string
          papel?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_usuarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_usuarios_obra_cliente_fkey"
            columns: ["obra_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id", "cliente_id"]
          },
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
            foreignKeyName: "obra_usuarios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "vw_indicadores_medicoes"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "obra_usuarios_usuario_cliente_fkey"
            columns: ["usuario_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id", "cliente_id"]
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
          cliente_id: string
          controle_financeiro_nc_efetivo: boolean
          controle_financeiro_nc_override: boolean | null
          controle_medicoes_efetivo: boolean
          controle_medicoes_override: boolean | null
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
          cliente_id: string
          controle_financeiro_nc_efetivo?: boolean
          controle_financeiro_nc_override?: boolean | null
          controle_medicoes_efetivo?: boolean
          controle_medicoes_override?: boolean | null
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
          cliente_id?: string
          controle_financeiro_nc_efetivo?: boolean
          controle_financeiro_nc_override?: boolean | null
          controle_medicoes_efetivo?: boolean
          controle_medicoes_override?: boolean | null
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
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_empresa_cliente_fkey"
            columns: ["empresa_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id", "cliente_id"]
          },
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
          assinatura_padrao_atualizada_em: string | null
          assinatura_padrao_url: string | null
          avatar_url: string | null
          cargo: string | null
          cliente_id: string | null
          created_at: string
          id: string
          nome: string
          onboarding_concluido_em: string | null
          perfil: Database["public"]["Enums"]["perfil_usuario"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          assinatura_padrao_atualizada_em?: string | null
          assinatura_padrao_url?: string | null
          avatar_url?: string | null
          cargo?: string | null
          cliente_id?: string | null
          created_at?: string
          id: string
          nome: string
          onboarding_concluido_em?: string | null
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          assinatura_padrao_atualizada_em?: string | null
          assinatura_padrao_url?: string | null
          avatar_url?: string | null
          cargo?: string | null
          cliente_id?: string | null
          created_at?: string
          id?: string
          nome?: string
          onboarding_concluido_em?: string | null
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacao_fotos: {
        Row: {
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "verificacao_fotos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacao_fotos_verificacao_cliente_fkey"
            columns: ["verificacao_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id", "cliente_id"]
          },
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
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "verificacao_itens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "verificacao_itens_padrao_cliente_fkey"
            columns: ["fvs_padrao_item_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "fvs_padrao_itens"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "verificacao_itens_verificacao_cliente_fkey"
            columns: ["verificacao_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "verificacoes"
            referencedColumns: ["id", "cliente_id"]
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
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "verificacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacoes_equipe_cliente_fkey"
            columns: ["equipe_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "verificacoes_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacoes_fvs_cliente_fkey"
            columns: ["fvs_planejada_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "verificacoes_fvs_planejada_id_fkey"
            columns: ["fvs_planejada_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verificacoes_inspetor_cliente_fkey"
            columns: ["inspetor_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id", "cliente_id"]
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
      vinculos_execucao_servico: {
        Row: {
          aprovado_congelado: number
          cliente_id: string
          created_at: string
          criado_por: string
          data_inicio: string
          data_termino: string | null
          encerrado_por: string | null
          equipe_id: string
          escopo_atribuido: number
          etapa_id: string | null
          fvs_planejada_id: string
          id: string
          medido_congelado: number
          motivo_encerramento: string | null
          status: Database["public"]["Enums"]["status_vinculo_execucao"]
          updated_at: string
        }
        Insert: {
          aprovado_congelado?: number
          cliente_id: string
          created_at?: string
          criado_por: string
          data_inicio: string
          data_termino?: string | null
          encerrado_por?: string | null
          equipe_id: string
          escopo_atribuido: number
          etapa_id?: string | null
          fvs_planejada_id: string
          id?: string
          medido_congelado?: number
          motivo_encerramento?: string | null
          status?: Database["public"]["Enums"]["status_vinculo_execucao"]
          updated_at?: string
        }
        Update: {
          aprovado_congelado?: number
          cliente_id?: string
          created_at?: string
          criado_por?: string
          data_inicio?: string
          data_termino?: string | null
          encerrado_por?: string | null
          equipe_id?: string
          escopo_atribuido?: number
          etapa_id?: string | null
          fvs_planejada_id?: string
          id?: string
          medido_congelado?: number
          motivo_encerramento?: string | null
          status?: Database["public"]["Enums"]["status_vinculo_execucao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_execucao_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_execucao_servico_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_execucao_servico_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_execucao_servico_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_execucao_servico_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "fvs_medicao_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_execucao_servico_fvs_planejada_id_fkey"
            columns: ["fvs_planejada_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
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
      vw_indicadores_medicoes: {
        Row: {
          custo_confirmado_retrabalho: number | null
          custo_estimado_retrabalho: number | null
          obra_id: string | null
          quantidade_bloqueada: number | null
          quantidade_disponivel: number | null
          quantidade_medida: number | null
          valor_bloqueado: number | null
          valor_disponivel: number | null
          valor_medido: number | null
        }
        Relationships: []
      }
      vw_saldos_medicao_servico: {
        Row: {
          aprovado: number | null
          bloqueado: number | null
          cliente_id: string | null
          disponivel: number | null
          equipe_id: string | null
          escopo_atribuido: number | null
          etapa_id: string | null
          fvs_planejada_id: string | null
          medido: number | null
          obra_id: string | null
          preco_unitario: number | null
          unidade: string | null
          valor_bloqueado: number | null
          valor_disponivel: number | null
          valor_medido: number | null
          vinculacao_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_execucao_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_execucao_servico_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_execucao_servico_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "fvs_medicao_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_execucao_servico_fvs_planejada_id_fkey"
            columns: ["fvs_planejada_id"]
            isOneToOne: false
            referencedRelation: "fvs_planejadas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aprovar_avaliacao_empreiteiro: {
        Args: { p_avaliacao_id: string }
        Returns: undefined
      }
      aprovar_medicao_servico: {
        Args: { p_medicao_id: string }
        Returns: undefined
      }
      atualizar_impacto_financeiro_nc: {
        Args: {
          p_bloqueio: Database["public"]["Enums"]["bloqueio_medicao_nc"]
          // NOTE: the live DB reports these as NOT NULL as of the last `supabase gen
          // types` run, but apps/mobile/services/nc-finance.service.ts (pre-existing,
          // unrelated to this change) legitimately calls this RPC with several of
          // these as null — a real drift between the deployed function and its
          // migration history that predates this change and is out of scope here.
          // Kept nullable so that pre-existing, working code keeps typechecking;
          // narrow this back once the drift is investigated and resolved.
          p_categoria: Database["public"]["Enums"]["categoria_impacto_financeiro_nc"] | null
          p_documento: string | null
          p_justificativa: string | null
          p_nc_id: string
          p_observacao: string | null
          p_prazo: string | null
          p_responsavel_avaliacao: string | null
          p_responsavel_financeiro: Database["public"]["Enums"]["responsavel_financeiro_nc"] | null
          p_situacao: Database["public"]["Enums"]["situacao_impacto_financeiro_nc"]
          p_valor_bloqueado: number | null
          p_valor_confirmado: number | null
          p_valor_estimado: number | null
        }
        Returns: undefined
      }
      avaliacao_empreiteiro_pode_editar: {
        Args: { p_avaliacao_id: string }
        Returns: boolean
      }
      can_edit_verificacao: {
        Args: { p_verificacao_id: string }
        Returns: boolean
      }
      cancelar_medicao_servico: {
        Args: { p_medicao_id: string; p_motivo: string }
        Returns: undefined
      }
      concluir_onboarding: { Args: never; Returns: string }
      criar_modelos_medicao_empresa: {
        Args: { p_cliente: string; p_empresa: string; p_usuario?: string }
        Returns: undefined
      }
      descartar_medicao_rascunho: {
        Args: { p_medicao_id: string }
        Returns: undefined
      }
      fvs_medicao_obra: { Args: { p_fvs: string }; Returns: string }
      get_accessible_media_keys: {
        Args: { p_keys: string[] }
        Returns: string[]
      }
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
      get_cliente_id: { Args: never; Returns: string }
      get_clientes_resumo: {
        Args: never
        Returns: {
          admin_convite_enviado_em: string
          admin_onboarding_concluido_em: string
          admin_onboarding_status: string
          contato_email: string
          contato_nome: string
          contato_telefone: string
          created_at: string
          empresas_ativas: number
          id: string
          limite_empresas: number
          limite_obras: number
          limite_usuarios: number
          nome: string
          obras_ativas: number
          slug: string
          status: Database["public"]["Enums"]["status_cliente"]
          usuarios_ativos: number
        }[]
      }
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
          ncs_abertas: number
          status: string
          subservico: string
          total_verificacoes: number
          ultima_verif: string
        }[]
      }
      get_fvs_attachments: {
        Args: { p_fvs_id: string }
        Returns: {
          id: string
          kind: string
          label: string
          ordem: number
          r2_key: string
          verificacao_id: string
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
      get_fvs_header: {
        Args: { p_fvs_id: string }
        Returns: {
          ambiente_localizacao: string
          ambiente_nome: string
          ambiente_tipo: string
          empresa_nome: string
          fvs_concluida_em: string
          fvs_revisao: string
          fvs_status: string
          fvs_subservico: string
          obra_crea_cau: string
          obra_endereco: string
          obra_eng_responsavel: string
          obra_municipio: string
          obra_nome: string
          obra_uf: string
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
      has_ambiente_access: { Args: { p_ambiente_id: string }; Returns: boolean }
      has_cliente_access: { Args: { p_cliente_id: string }; Returns: boolean }
      has_fvs_access: { Args: { p_fvs_id: string }; Returns: boolean }
      has_nc_access: { Args: { p_nc_id: string }; Returns: boolean }
      has_obra_access: { Args: { p_obra_id: string }; Returns: boolean }
      has_verificacao_access: {
        Args: { p_verificacao_id: string }
        Returns: boolean
      }
      invalidar_avaliacao_empreiteiro: {
        Args: { p_avaliacao_id: string; p_motivo: string }
        Returns: undefined
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_media_key: {
        Args: { p_cliente_id: string; p_key: string }
        Returns: boolean
      }
      measurement_actor_can_manage: {
        Args: { p_obra_id: string }
        Returns: boolean
      }
      nc_obra: { Args: { p_nc: string }; Returns: string }
      next_numero_verif: {
        Args: { p_fvs_planejada_id: string }
        Returns: number
      }
      publicar_modelo_avaliacao_empreiteiro: {
        Args: {
          p_ativo: boolean
          p_criterios: Json
          // Nullable to match pre-existing, working call sites — see the note on
          // atualizar_impacto_financeiro_nc below for why these need to stay
          // nullable even though the live DB currently reports them as NOT NULL.
          p_descricao: string | null
          p_descricao_alteracoes: string
          p_empresa_id: string | null
          p_modelo_id: string | null
          p_nome: string
        }
        Returns: string
      }
      reabrir_avaliacao_empreiteiro: {
        Args: { p_avaliacao_id: string; p_motivo: string }
        Returns: undefined
      }
      registrar_avanco_aprovado: {
        Args: {
          p_aprovado_atual: number
          p_created_offline?: boolean
          p_executado_atual: number
          p_id: string
          p_verificacao_id: string
          p_vinculo_id: string
        }
        Returns: string
      }
      saldo_vinculo_execucao: {
        Args: { p_vinculo: string }
        Returns: {
          aprovado: number
          bloqueado: number
          disponivel: number
          medido: number
        }[]
      }
      salvar_configuracao_medicao_fvs: {
        Args: {
          p_data_inicio: string
          p_equipe_inicial_id: string
          p_etapas: Json
          p_fvs_id: string
          p_metodo: Database["public"]["Enums"]["metodo_medicao_servico"]
          p_modelo_id: string | null
          p_permite_parciais: boolean
          p_preco_unitario: number | null
          p_quantidade_total: number
          p_unidade: string
        }
        Returns: string
      }
      salvar_medicao_rascunho: {
        Args: {
          p_data_medicao: string
          p_equipe_id: string
          p_itens: Json
          p_medicao_id: string | null
          p_obra_id: string
          p_observacao: string | null
          p_periodo_fim: string
          p_periodo_inicio: string
          p_referencia: string
        }
        Returns: string
      }
      salvar_modelo_etapas_medicao: {
        Args: {
          p_ativo: boolean
          p_empresa_id: string
          p_etapas: Json
          p_modelo_id: string | null
          p_nome: string
        }
        Returns: string
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
      set_obra_feature_overrides: {
        Args: {
          p_financeiro_override: boolean
          p_medicoes_override: boolean
          p_obra_id: string
        }
        Returns: undefined
      }
      sync_obra_status_from_fvs: {
        Args: { p_obra_id: string }
        Returns: undefined
      }
      trocar_empreiteiro_servico: {
        Args: {
          p_data: string
          p_motivo: string
          p_nova_equipe_id: string
          p_vinculo_id: string
        }
        Returns: string
      }
      uuid_generate_v4: { Args: never; Returns: string }
    }
    Enums: {
      bloqueio_medicao_nc: "nao" | "total" | "parcial"
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
        | "servicos_preliminares"
        | "impermeabilizacao"
        | "esquadrias_vidros"
        | "urbanizacao_pavimentacao"
        | "comunicacao_visual"
      categoria_impacto_financeiro_nc:
        | "mao_obra_retrabalho"
        | "perda_material"
        | "equipamento_mobilizacao"
        | "atraso"
        | "glosa_retencao"
        | "desconto_empreiteiro"
        | "outro"
      escopo_cadastro: "global" | "restrito"
      metodo_medicao_servico:
        | "quantidade"
        | "unidade_concluida"
        | "etapas_ponderadas"
      perfil_usuario: "superadmin" | "admin" | "gestor" | "inspetor"
      responsavel_financeiro_nc:
        | "construtora"
        | "empreiteiro"
        | "fornecedor"
        | "projetista"
        | "em_analise"
      resultado_criterio_avaliacao: "atende" | "nao_atende"
      resultado_item: "conforme" | "nao_conforme" | "na"
      situacao_impacto_financeiro_nc:
        | "sem_impacto"
        | "em_avaliacao"
        | "estimado"
        | "confirmado"
      status_avaliacao_empreiteiro:
        | "rascunho"
        | "concluida"
        | "invalidada"
        | "aguardando_aprovacao"
        | "aprovada"
      status_cliente: "ativo" | "suspenso"
      status_etapa_medicao:
        | "nao_iniciada"
        | "em_execucao"
        | "concluida"
        | "aprovada"
        | "bloqueada_nc"
      status_fvs:
        | "pendente"
        | "em_andamento"
        | "conforme"
        | "nao_conforme"
        | "concluida"
        | "em_revisao"
        | "concluida_ressalva"
      status_medicao_servico: "rascunho" | "aprovada" | "cancelada"
      status_nc:
        | "aberta"
        | "em_correcao"
        | "resolvida"
        | "cancelada"
        | "encerrada_sem_resolucao"
      status_obra: "nao_iniciada" | "em_andamento" | "paralisada" | "concluida"
      status_vinculo_execucao: "ativo" | "concluido" | "substituido"
      tipo_ambiente: "interno" | "externo"
      tipo_equipe: "proprio" | "terceirizado"
      tipo_item_medicao: "avanco" | "retrabalho"
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
      bloqueio_medicao_nc: ["nao", "total", "parcial"],
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
        "servicos_preliminares",
        "impermeabilizacao",
        "esquadrias_vidros",
        "urbanizacao_pavimentacao",
        "comunicacao_visual",
      ],
      categoria_impacto_financeiro_nc: [
        "mao_obra_retrabalho",
        "perda_material",
        "equipamento_mobilizacao",
        "atraso",
        "glosa_retencao",
        "desconto_empreiteiro",
        "outro",
      ],
      escopo_cadastro: ["global", "restrito"],
      metodo_medicao_servico: [
        "quantidade",
        "unidade_concluida",
        "etapas_ponderadas",
      ],
      perfil_usuario: ["superadmin", "admin", "gestor", "inspetor"],
      responsavel_financeiro_nc: [
        "construtora",
        "empreiteiro",
        "fornecedor",
        "projetista",
        "em_analise",
      ],
      resultado_criterio_avaliacao: ["atende", "nao_atende"],
      resultado_item: ["conforme", "nao_conforme", "na"],
      situacao_impacto_financeiro_nc: [
        "sem_impacto",
        "em_avaliacao",
        "estimado",
        "confirmado",
      ],
      status_avaliacao_empreiteiro: [
        "rascunho",
        "concluida",
        "invalidada",
        "aguardando_aprovacao",
        "aprovada",
      ],
      status_cliente: ["ativo", "suspenso"],
      status_etapa_medicao: [
        "nao_iniciada",
        "em_execucao",
        "concluida",
        "aprovada",
        "bloqueada_nc",
      ],
      status_fvs: [
        "pendente",
        "em_andamento",
        "conforme",
        "nao_conforme",
        "concluida",
        "em_revisao",
        "concluida_ressalva",
      ],
      status_medicao_servico: ["rascunho", "aprovada", "cancelada"],
      status_nc: [
        "aberta",
        "em_correcao",
        "resolvida",
        "cancelada",
        "encerrada_sem_resolucao",
      ],
      status_obra: ["nao_iniciada", "em_andamento", "paralisada", "concluida"],
      status_vinculo_execucao: ["ativo", "concluido", "substituido"],
      tipo_ambiente: ["interno", "externo"],
      tipo_equipe: ["proprio", "terceirizado"],
      tipo_item_medicao: ["avanco", "retrabalho"],
    },
  },
} as const
