-- Views must evaluate base-table RLS as the authenticated caller. PostgreSQL
-- views otherwise execute with the view owner's privileges.

ALTER VIEW v_obras_com_fvs SET (security_invoker = true);
ALTER VIEW fvs_padrao_itens_current SET (security_invoker = true);
