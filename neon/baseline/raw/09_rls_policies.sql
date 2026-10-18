ALTER TABLE public.ambientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_plataforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_empreiteiro_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_empreiteiro_reaberturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes_empreiteiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avancos_aprovados_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_conclusoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_medicao_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_medicao_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_padrao_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_padrao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_padrao_revisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_planejadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fvs_reaberturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicao_item_liberacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicao_servico_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicoes_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelo_avaliacao_empreiteiro_criterios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelo_avaliacao_empreiteiro_revisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelo_etapas_medicao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_avaliacao_empreiteiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_etapas_medicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nao_conformidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nc_financeiro_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nc_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nc_reinspecoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verificacao_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verificacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculos_execucao_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY ambientes_manage ON public.ambientes AS PERMISSIVE FOR ALL TO authenticated USING ((has_obra_access(obra_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_obra_access(obra_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY ambientes_tenant ON public.ambientes AS PERMISSIVE FOR SELECT TO authenticated USING (has_obra_access(obra_id));
CREATE POLICY auditoria_operacional_read ON public.auditoria_operacional AS PERMISSIVE FOR SELECT TO public USING (((obra_id IS NULL) OR has_obra_access(obra_id)));
CREATE POLICY auditoria_platform_select ON public.auditoria_plataforma AS PERMISSIVE FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY itens_avaliacao_empreiteiro_select ON public.avaliacao_empreiteiro_itens AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM avaliacoes_empreiteiro a
  WHERE ((a.id = avaliacao_empreiteiro_itens.avaliacao_id) AND has_obra_access(a.obra_id)))));
CREATE POLICY itens_avaliacao_empreiteiro_write ON public.avaliacao_empreiteiro_itens AS PERMISSIVE FOR ALL TO public USING (avaliacao_empreiteiro_pode_editar(avaliacao_id)) WITH CHECK (avaliacao_empreiteiro_pode_editar(avaliacao_id));
CREATE POLICY avaliacao_empreiteiro_reaberturas_select ON public.avaliacao_empreiteiro_reaberturas AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM avaliacoes_empreiteiro a
  WHERE ((a.id = avaliacao_empreiteiro_reaberturas.avaliacao_id) AND has_obra_access(a.obra_id)))));
CREATE POLICY avaliacoes_empreiteiro_insert ON public.avaliacoes_empreiteiro AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_obra_access(obra_id) AND (avaliador_id = auth.uid()) AND (status = 'rascunho'::status_avaliacao_empreiteiro) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario, 'inspetor'::perfil_usuario]))));
CREATE POLICY avaliacoes_empreiteiro_select ON public.avaliacoes_empreiteiro AS PERMISSIVE FOR SELECT TO public USING (has_obra_access(obra_id));
CREATE POLICY avaliacoes_empreiteiro_update ON public.avaliacoes_empreiteiro AS PERMISSIVE FOR UPDATE TO public USING ((avaliacao_empreiteiro_pode_editar(id) OR avaliacao_empreiteiro_pode_reabrir(id))) WITH CHECK ((has_obra_access(obra_id) AND ((avaliador_id = auth.uid()) OR (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))));
CREATE POLICY avancos_aprovados_read ON public.avancos_aprovados_servico AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM vinculos_execucao_servico v
  WHERE ((v.id = avancos_aprovados_servico.vinculacao_id) AND has_fvs_access(v.fvs_planejada_id)))));
CREATE POLICY avancos_write ON public.avancos_aprovados_servico AS PERMISSIVE FOR INSERT TO public WITH CHECK (((get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario, 'inspetor'::perfil_usuario])) AND (EXISTS ( SELECT 1
   FROM vinculos_execucao_servico v
  WHERE ((v.id = avancos_aprovados_servico.vinculacao_id) AND has_fvs_access(v.fvs_planejada_id))))));
CREATE POLICY clientes_platform_select ON public.clientes AS PERMISSIVE FOR SELECT TO authenticated USING ((is_platform_admin() OR (id = get_cliente_id())));
CREATE POLICY clientes_platform_update ON public.clientes AS PERMISSIVE FOR UPDATE TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY empresas_tenant_insert ON public.empresas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario)));
CREATE POLICY empresas_tenant_select ON public.empresas AS PERMISSIVE FOR SELECT TO authenticated USING (has_cliente_access(cliente_id));
CREATE POLICY empresas_tenant_update ON public.empresas AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario)));
CREATE POLICY equipe_empresas_tenant ON public.equipe_empresas AS PERMISSIVE FOR ALL TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY equipes_tenant_select ON public.equipes AS PERMISSIVE FOR SELECT TO authenticated USING (has_cliente_access(cliente_id));
CREATE POLICY equipes_tenant_write ON public.equipes AS PERMISSIVE FOR ALL TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY fvs_conclusoes_insert ON public.fvs_conclusoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_fvs_access(fvs_planejada_id) AND (inspetor_id = auth.uid())));
CREATE POLICY fvs_conclusoes_tenant ON public.fvs_conclusoes AS PERMISSIVE FOR SELECT TO authenticated USING (has_fvs_access(fvs_planejada_id));
CREATE POLICY configuracoes_medicao_manage ON public.fvs_medicao_configuracoes AS PERMISSIVE FOR ALL TO public USING ((has_fvs_access(fvs_planejada_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_fvs_access(fvs_planejada_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY configuracoes_medicao_read ON public.fvs_medicao_configuracoes AS PERMISSIVE FOR SELECT TO public USING (has_fvs_access(fvs_planejada_id));
CREATE POLICY etapas_medicao_manage ON public.fvs_medicao_etapas AS PERMISSIVE FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM fvs_medicao_configuracoes c
  WHERE ((c.id = fvs_medicao_etapas.configuracao_id) AND has_fvs_access(c.fvs_planejada_id)))) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])));
CREATE POLICY etapas_medicao_read ON public.fvs_medicao_etapas AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM fvs_medicao_configuracoes c
  WHERE ((c.id = fvs_medicao_etapas.configuracao_id) AND has_fvs_access(c.fvs_planejada_id)))));
CREATE POLICY fvs_padrao_tenant_select ON public.fvs_padrao AS PERMISSIVE FOR SELECT TO authenticated USING (has_cliente_access(cliente_id));
CREATE POLICY fvs_padrao_tenant_write ON public.fvs_padrao AS PERMISSIVE FOR ALL TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY fvs_padrao_empresas_tenant ON public.fvs_padrao_empresas AS PERMISSIVE FOR ALL TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY fvs_itens_tenant_select ON public.fvs_padrao_itens AS PERMISSIVE FOR SELECT TO authenticated USING (has_cliente_access(cliente_id));
CREATE POLICY fvs_itens_tenant_write ON public.fvs_padrao_itens AS PERMISSIVE FOR ALL TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY fvs_revisoes_tenant_select ON public.fvs_padrao_revisoes AS PERMISSIVE FOR SELECT TO authenticated USING (has_cliente_access(cliente_id));
CREATE POLICY fvs_revisoes_tenant_write ON public.fvs_padrao_revisoes AS PERMISSIVE FOR ALL TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY fvs_planejadas_manage ON public.fvs_planejadas AS PERMISSIVE FOR ALL TO authenticated USING ((has_fvs_access(id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_ambiente_access(ambiente_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY fvs_planejadas_tenant ON public.fvs_planejadas AS PERMISSIVE FOR SELECT TO authenticated USING (has_fvs_access(id));
CREATE POLICY fvs_reaberturas_insert ON public.fvs_reaberturas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_fvs_access(fvs_planejada_id) AND (solicitado_por = auth.uid())));
CREATE POLICY fvs_reaberturas_tenant ON public.fvs_reaberturas AS PERMISSIVE FOR SELECT TO authenticated USING (has_fvs_access(fvs_planejada_id));
CREATE POLICY liberacoes_medicao_read ON public.medicao_item_liberacoes AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (medicao_servico_itens i
     JOIN medicoes_servico m ON ((m.id = i.medicao_id)))
  WHERE ((i.id = medicao_item_liberacoes.medicao_item_id) AND has_obra_access(m.obra_id)))));
CREATE POLICY liberacoes_medicao_write ON public.medicao_item_liberacoes AS PERMISSIVE FOR INSERT TO public WITH CHECK (((get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])) AND (EXISTS ( SELECT 1
   FROM ((medicao_servico_itens i
     JOIN medicoes_servico h ON ((h.id = i.medicao_id)))
     JOIN avancos_aprovados_servico a ON ((a.id = medicao_item_liberacoes.avanco_id)))
  WHERE ((i.id = medicao_item_liberacoes.medicao_item_id) AND (a.vinculacao_id = i.vinculacao_id) AND has_obra_access(h.obra_id))))));
CREATE POLICY itens_medicao_read ON public.medicao_servico_itens AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM medicoes_servico m
  WHERE ((m.id = medicao_servico_itens.medicao_id) AND has_obra_access(m.obra_id)))));
CREATE POLICY itens_medicao_write ON public.medicao_servico_itens AS PERMISSIVE FOR INSERT TO public WITH CHECK (((get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])) AND (EXISTS ( SELECT 1
   FROM (medicoes_servico h
     JOIN vinculos_execucao_servico v ON ((v.id = medicao_servico_itens.vinculacao_id)))
  WHERE ((h.id = medicao_servico_itens.medicao_id) AND (h.equipe_id = v.equipe_id) AND has_obra_access(h.obra_id) AND (fvs_medicao_obra(v.fvs_planejada_id) = h.obra_id))))));
CREATE POLICY medicoes_read ON public.medicoes_servico AS PERMISSIVE FOR SELECT TO public USING (has_obra_access(obra_id));
CREATE POLICY medicoes_write ON public.medicoes_servico AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_obra_access(obra_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY criterios_avaliacao_empreiteiro_select ON public.modelo_avaliacao_empreiteiro_criterios AS PERMISSIVE FOR SELECT TO public USING (has_cliente_access(cliente_id));
CREATE POLICY revisoes_avaliacao_empreiteiro_select ON public.modelo_avaliacao_empreiteiro_revisoes AS PERMISSIVE FOR SELECT TO public USING (has_cliente_access(cliente_id));
CREATE POLICY modelo_itens_medicao_admin_write ON public.modelo_etapas_medicao_itens AS PERMISSIVE FOR ALL TO public USING ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario)));
CREATE POLICY modelo_itens_read ON public.modelo_etapas_medicao_itens AS PERMISSIVE FOR SELECT TO public USING (has_cliente_access(cliente_id));
CREATE POLICY modelos_avaliacao_empreiteiro_select ON public.modelos_avaliacao_empreiteiro AS PERMISSIVE FOR SELECT TO public USING (has_cliente_access(cliente_id));
CREATE POLICY modelos_etapas_read ON public.modelos_etapas_medicao AS PERMISSIVE FOR SELECT TO public USING (has_cliente_access(cliente_id));
CREATE POLICY modelos_medicao_admin_write ON public.modelos_etapas_medicao AS PERMISSIVE FOR ALL TO public USING ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario)));
CREATE POLICY nc_insert ON public.nao_conformidades AS PERMISSIVE FOR INSERT TO public WITH CHECK (can_edit_verificacao(verificacao_id));
CREATE POLICY nc_select ON public.nao_conformidades AS PERMISSIVE FOR SELECT TO public USING (has_verificacao_access(verificacao_id));
CREATE POLICY nc_financeiro_historico_read ON public.nc_financeiro_historico AS PERMISSIVE FOR SELECT TO public USING (has_nc_access(nc_id));
CREATE POLICY nc_fotos_insert ON public.nc_fotos AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1
   FROM nao_conformidades nc
  WHERE ((nc.id = nc_fotos.nc_id) AND can_edit_verificacao(nc.verificacao_id)))));
CREATE POLICY nc_fotos_select ON public.nc_fotos AS PERMISSIVE FOR SELECT TO public USING (has_nc_access(nc_id));
CREATE POLICY nc_reinspecoes_insert ON public.nc_reinspecoes AS PERMISSIVE FOR INSERT TO public WITH CHECK (((inspetor_id = auth.uid()) AND can_edit_verificacao(verificacao_id) AND (EXISTS ( SELECT 1
   FROM ((nao_conformidades nc
     JOIN verificacoes origem ON ((origem.id = nc.verificacao_id)))
     JOIN verificacoes reinspecao ON ((reinspecao.id = nc.verificacao_id)))
  WHERE ((nc.id = nc_reinspecoes.nc_id) AND (origem.fvs_planejada_id = reinspecao.fvs_planejada_id))))));
CREATE POLICY nc_reinspecoes_select ON public.nc_reinspecoes AS PERMISSIVE FOR SELECT TO public USING (has_nc_access(nc_id));
CREATE POLICY obra_equipes_manage ON public.obra_equipes AS PERMISSIVE FOR ALL TO authenticated USING ((has_obra_access(obra_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_obra_access(obra_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY obra_equipes_tenant ON public.obra_equipes AS PERMISSIVE FOR SELECT TO authenticated USING (has_obra_access(obra_id));
CREATE POLICY obra_usuarios_manage ON public.obra_usuarios AS PERMISSIVE FOR ALL TO authenticated USING ((has_obra_access(obra_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])))) WITH CHECK ((has_obra_access(obra_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY obra_usuarios_tenant ON public.obra_usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (has_obra_access(obra_id));
CREATE POLICY obras_admin_insert ON public.obras AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario)));
CREATE POLICY obras_admin_update ON public.obras AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario))) WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario)));
CREATE POLICY obras_tenant_select ON public.obras AS PERMISSIVE FOR SELECT TO authenticated USING (has_obra_access(id));
CREATE POLICY usuarios_assinatura_padrao_propria ON public.usuarios AS PERMISSIVE FOR UPDATE TO public USING ((id = auth.uid())) WITH CHECK (((id = auth.uid()) AND (cliente_id = get_cliente_id())));
CREATE POLICY usuarios_tenant_insert ON public.usuarios AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario) AND (perfil <> 'superadmin'::perfil_usuario)));
CREATE POLICY usuarios_tenant_select ON public.usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (((id = auth.uid()) OR ((cliente_id IS NOT NULL) AND has_cliente_access(cliente_id))));
CREATE POLICY usuarios_tenant_update ON public.usuarios AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_cliente_access(cliente_id) AND (get_perfil() = 'admin'::perfil_usuario))) WITH CHECK ((has_cliente_access(cliente_id) AND (perfil <> 'superadmin'::perfil_usuario)));
CREATE POLICY verificacao_fotos_insert ON public.verificacao_fotos AS PERMISSIVE FOR INSERT TO public WITH CHECK (can_edit_verificacao(verificacao_id));
CREATE POLICY verificacao_fotos_select ON public.verificacao_fotos AS PERMISSIVE FOR SELECT TO public USING (has_verificacao_access(verificacao_id));
CREATE POLICY verificacao_itens_insert ON public.verificacao_itens AS PERMISSIVE FOR INSERT TO public WITH CHECK (can_edit_verificacao(verificacao_id));
CREATE POLICY verificacao_itens_select ON public.verificacao_itens AS PERMISSIVE FOR SELECT TO public USING (has_verificacao_access(verificacao_id));
CREATE POLICY verificacao_itens_update ON public.verificacao_itens AS PERMISSIVE FOR UPDATE TO public USING (can_edit_verificacao(verificacao_id)) WITH CHECK (can_edit_verificacao(verificacao_id));
CREATE POLICY verificacoes_insert ON public.verificacoes AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_fvs_access(fvs_planejada_id) AND (inspetor_id = auth.uid())));
CREATE POLICY verificacoes_select ON public.verificacoes AS PERMISSIVE FOR SELECT TO public USING (has_verificacao_access(id));
CREATE POLICY verificacoes_update ON public.verificacoes AS PERMISSIVE FOR UPDATE TO public USING (can_edit_verificacao(id)) WITH CHECK ((has_fvs_access(fvs_planejada_id) AND ((inspetor_id = auth.uid()) OR ((get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario])) AND (EXISTS ( SELECT 1
   FROM usuarios u
  WHERE ((u.id = verificacoes.inspetor_id) AND (u.cliente_id = get_cliente_id()) AND u.ativo)))))));
CREATE POLICY vinculos_execucao_manage ON public.vinculos_execucao_servico AS PERMISSIVE FOR INSERT TO public WITH CHECK ((has_fvs_access(fvs_planejada_id) AND (get_perfil() = ANY (ARRAY['admin'::perfil_usuario, 'gestor'::perfil_usuario]))));
CREATE POLICY vinculos_execucao_read ON public.vinculos_execucao_servico AS PERMISSIVE FOR SELECT TO public USING (has_fvs_access(fvs_planejada_id));
