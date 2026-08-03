-- Categorias identificadas a partir da biblioteca de FVS de referência.
-- Mantêm fronteiras distintas das categorias existentes para evitar
-- classificações duplicadas ou sobrepostas.

ALTER TYPE categoria_fvs ADD VALUE IF NOT EXISTS 'servicos_preliminares';
ALTER TYPE categoria_fvs ADD VALUE IF NOT EXISTS 'impermeabilizacao';
ALTER TYPE categoria_fvs ADD VALUE IF NOT EXISTS 'esquadrias_vidros';
ALTER TYPE categoria_fvs ADD VALUE IF NOT EXISTS 'urbanizacao_pavimentacao';
ALTER TYPE categoria_fvs ADD VALUE IF NOT EXISTS 'comunicacao_visual';
