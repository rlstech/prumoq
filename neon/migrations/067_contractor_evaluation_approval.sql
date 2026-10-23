-- Enum values must be committed before a later migration uses them in an
-- UPDATE, index predicate, trigger or policy (PostgreSQL enum safety rule).
ALTER TYPE public.status_avaliacao_empreiteiro ADD VALUE IF NOT EXISTS 'aprovada';
