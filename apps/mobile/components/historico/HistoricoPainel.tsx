import { useQuery, useStatus } from '@powersync/react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconBox } from '../IconBox';
import { EmptyState, FilterChips, GroupLabel } from '../ui';
import { useConta } from '../../lib/auth/sessao';
import { getTodayIso } from '../../lib/calendar';
import { Colors, FontFamily, FontSizes, Radius, Spacing } from '../../lib/constants';
import { Check, ChevronRight, CloudUpload, History, X, type IconComponent } from '../../lib/icons';
import { db } from '../../lib/powersync';

/** Janela do histórico: o que o inspetor costuma querer rever. */
export const DIAS = 30;
const LIMITE = 150;

type Filtro = 'todas' | 'conformes' | 'com_nc' | 'a_enviar';

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'conformes', label: 'Conformes' },
  { value: 'com_nc', label: 'Com NC' },
  { value: 'a_enviar', label: 'A enviar' },
];

interface HistoricoRow {
  id: string;
  status: string;
  data_verif: string;
  created_at: string | null;
  numero_verif: number | null;
  created_offline: number | null;
  inspetor_id: string | null;
  inspetor_nome: string | null;
  fvs_nome: string | null;
  fvs_id: string;
  ambiente_nome: string;
  ambiente_id: string;
  obra_nome: string;
  obra_id: string;
  itens_avaliados: number;
  itens_conformes: number;
  ncs: number;
}

type Tipo = 'ok' | 'nc';

const TIPO: Record<Tipo, { Icon: IconComponent; color: string; bg: string }> = {
  ok: { Icon: Check, color: Colors.ok, bg: Colors.okBg },
  nc: { Icon: X, color: Colors.nok, bg: Colors.nokBg },
};

const WEEKDAY = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function diasAtras(dias: number): string {
  const date = new Date();
  date.setDate(date.getDate() - dias);
  return getTodayIso(date);
}

function rotuloDia(iso: string): string {
  const day = iso.slice(0, 10);
  if (day === getTodayIso()) return 'Hoje';
  if (day === diasAtras(1)) return 'Ontem';
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return `${WEEKDAY[date.getDay()]}, ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
}

function hora(iso: string | null): string {
  if (!iso || iso.length <= 10) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Ids das verificações que ainda estão na fila de envio do PowerSync. A fila
 * (ps_crud) não dispara as consultas reativas, então é lida de novo ao abrir a
 * tela e sempre que o estado de envio muda.
 */
function useVerificacoesNaFila(): Set<string> {
  const status = useStatus();
  const uploading = status.dataFlowStatus?.uploading ?? false;
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  const carregar = useCallback(async () => {
    try {
      const rows = await db.getAll<{ data: string }>('SELECT data FROM ps_crud');
      const next = new Set<string>();
      for (const row of rows) {
        try {
          const op = JSON.parse(row.data) as { type?: string; id?: string; data?: { verificacao_id?: string } };
          if (op.type === 'verificacoes' && op.id) next.add(op.id);
          else if (op.data?.verificacao_id) next.add(op.data.verificacao_id);
        } catch {
          // Linha da fila em formato inesperado: só não marca nada.
        }
      }
      setIds(next);
    } catch {
      setIds(new Set());
    }
  }, []);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));
  useEffect(() => { void carregar(); }, [carregar, uploading]);

  return ids;
}

/**
 * Histórico de verificações (filtros + grupos por dia). Usado na tela
 * Histórico e na aba Histórico da obra (`obraId`).
 */
export function HistoricoPainel({ obraId, dias = DIAS }: { obraId?: string; dias?: number }) {
  const router = useRouter();
  const conta = useConta();
  const userId = conta?.usuarioId ?? null;
  const perfil = conta?.perfil ?? null;
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const naFila = useVerificacoesNaFila();

  const ready = !!userId && !!perfil;
  const { data: rows, isLoading } = useQuery<HistoricoRow>(
    ready
      ? `SELECT v.id, v.status, v.data_verif, v.created_at, v.numero_verif, v.created_offline,
                v.inspetor_id, u.nome AS inspetor_nome,
                fp.subservico AS fvs_nome, fp.id AS fvs_id,
                a.nome AS ambiente_nome, a.id AS ambiente_id,
                o.nome AS obra_nome, o.id AS obra_id,
                (SELECT COUNT(*) FROM verificacao_itens vi
                  WHERE vi.verificacao_id = v.id AND vi.resultado IN ('conforme', 'nao_conforme')) AS itens_avaliados,
                (SELECT COUNT(*) FROM verificacao_itens vi
                  WHERE vi.verificacao_id = v.id AND vi.resultado = 'conforme') AS itens_conformes,
                (SELECT COUNT(*) FROM nao_conformidades n WHERE n.verificacao_id = v.id) AS ncs
         FROM verificacoes v
         JOIN fvs_planejadas fp ON fp.id = v.fvs_planejada_id
         JOIN ambientes a ON a.id = fp.ambiente_id
         JOIN obras o ON o.id = a.obra_id
         LEFT JOIN usuarios u ON u.id = v.inspetor_id
         WHERE date(v.data_verif) >= ?
           AND (? = '' OR o.id = ?)
           AND (? = 'admin' OR EXISTS (SELECT 1 FROM obra_usuarios ou WHERE ou.obra_id = o.id AND ou.usuario_id = ?))
         ORDER BY v.data_verif DESC, v.created_at DESC
         LIMIT ${LIMITE}`
      : 'SELECT 1 WHERE 0',
    ready ? [diasAtras(dias), obraId ?? '', obraId ?? '', perfil, userId] : [],
  );

  const itens = useMemo(() => rows.map(row => ({
    row,
    tipo: (row.ncs > 0 ? 'nc' : 'ok') as Tipo,
    pendente: naFila.has(row.id),
  })), [rows, naFila]);

  const contagem = useMemo(() => ({
    todas: itens.length,
    conformes: itens.filter(item => item.row.ncs === 0).length,
    com_nc: itens.filter(item => item.row.ncs > 0).length,
    a_enviar: itens.filter(item => item.pendente).length,
  }), [itens]);

  const visiveis = useMemo(() => itens.filter(({ row, pendente }) => {
    if (filtro === 'conformes') return row.ncs === 0;
    if (filtro === 'com_nc') return row.ncs > 0;
    if (filtro === 'a_enviar') return pendente;
    return true;
  }), [itens, filtro]);

  const grupos = useMemo(() => {
    const map = new Map<string, typeof visiveis>();
    for (const item of visiveis) {
      const key = item.row.data_verif.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].map(([dia, lista]) => ({ dia, label: rotuloDia(dia), lista }));
  }, [visiveis]);

  const abrir = (row: HistoricoRow) => router.push(
    `/obras/${row.obra_id}/ambiente/${row.ambiente_id}/fvs/${row.fvs_id}/verificacao/${row.id}` as never,
  );

  return (
    <View style={styles.painel}>
      <FilterChips
        value={filtro}
        onChange={setFiltro}
        options={FILTROS.map(option => ({ ...option, count: contagem[option.value] }))}
        accessibilityLabel="Filtrar verificações"
      />

      {grupos.length === 0 ? (
        isLoading && rows.length === 0 ? null : (
          <EmptyState
            Icon={History}
            title={filtro === 'todas' ? 'Nenhuma verificação ainda' : 'Nada neste filtro'}
            description={
              filtro === 'todas'
                ? `As verificações dos últimos ${dias} dias aparecem aqui.`
                : 'Troque o filtro para ver as outras verificações.'
            }
          />
        )
      ) : (
        grupos.map(grupo => (
          <View key={grupo.dia} style={styles.group}>
            <GroupLabel label={grupo.label} />
            <View style={styles.card}>
              {grupo.lista.map(({ row, tipo, pendente }, index) => (
                <View key={row.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <HistoricoLinha
                    row={row}
                    tipo={tipo}
                    pendente={pendente}
                    proprio={row.inspetor_id === userId}
                    mostrarObra={!obraId}
                    onPress={() => abrir(row)}
                  />
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function HistoricoLinha({
  row,
  tipo,
  pendente,
  proprio,
  mostrarObra,
  onPress,
}: {
  row: HistoricoRow;
  tipo: Tipo;
  pendente: boolean;
  proprio: boolean;
  mostrarObra: boolean;
  onPress: () => void;
}) {
  const { Icon, color, bg } = TIPO[tipo];
  const resultado = row.ncs > 0
    ? `${row.ncs} ${row.ncs === 1 ? 'NC' : 'NCs'}`
    : row.itens_avaliados > 0
      ? `${row.itens_conformes}/${row.itens_avaliados}`
      : 'Conforme';
  const nome = row.fvs_nome || 'Verificação';
  const quando = hora(row.created_at);
  const autor = !proprio && row.inspetor_nome ? ` · ${row.inspetor_nome.split(' ')[0]}` : '';
  const offline = row.created_offline === 1 ? ' · offline' : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nome}, ${row.ambiente_nome}, ${row.obra_nome}. ${resultado}${quando ? `, às ${quando}` : ''}${pendente ? '. Aguardando envio' : ''}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.tile, { backgroundColor: bg }]}>
        <Icon size={22} color={color} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {nome}{row.numero_verif && row.numero_verif > 1 ? ` · ${row.numero_verif}ª` : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {row.ambiente_nome}{mostrarObra ? ` · ${row.obra_nome}` : ''}{autor}{offline}
        </Text>
        {pendente ? (
          <View style={styles.pending}>
            <CloudUpload size={13} color={Colors.info} strokeWidth={2} />
            <Text style={styles.pendingText}>Aguardando envio</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {quando ? <Text style={styles.time}>{quando}</Text> : null}
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <Text style={[styles.badgeText, { color }]}>{resultado}</Text>
        </View>
      </View>
      <IconBox icon={ChevronRight} size={16} color={Colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  painel: { gap: Spacing.xl },
  group: { gap: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 6,
  },
  divider: { height: 1, backgroundColor: Colors.bg, marginLeft: 70, marginRight: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  rowPressed: { backgroundColor: Colors.surface2 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: FontFamily.semibold, fontSize: FontSizes.base, lineHeight: 20, color: Colors.text },
  meta: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  trailing: { alignItems: 'flex-end', gap: 4 },
  time: { fontFamily: FontFamily.monoBold, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  badge: {
    minHeight: 22,
    paddingHorizontal: 9,
    borderRadius: Radius.full,
    justifyContent: 'center',
  },
  badgeText: { fontFamily: FontFamily.bold, fontSize: FontSizes.tiny },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pendingText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, color: Colors.info },
});
