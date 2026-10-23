import { useQuery } from '@powersync/react';
import { useRouter } from 'expo-router';
import { Building2, ChevronRight, Key, Mail, PenLine, Phone, RefreshCw, User, type IconComponent } from '../../../../lib/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../../../components/AppHeader';
import { IconTile, SectionHead, type TrenaTone } from '../../../../components/ui';
import { SignatureField } from '../../../../components/SignatureField';
import { Breakpoints, Colors, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../../../lib/constants';
import { db } from '../../../../lib/powersync';
import { useConta, useSessao } from '../../../../lib/auth/sessao';
import { adoptPendingMedia } from '../../../../lib/pending-media';
import { confirmDialog } from '../../../../lib/platform-alert';
import { ensureDefaultSignature } from '../../../../lib/signature-defaults';
import { signatureStore } from '../../../../lib/signature-store';
import { versaoDoApp } from '../../../../lib/versao';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UsuarioRow { id: string; nome: string; cargo: string; perfil: string; cliente_id: string; assinatura_padrao_url: string | null; assinatura_padrao_atualizada_em: string | null }
interface ObraRow    { id: string; nome: string; municipio: string; uf: string }
interface CountRow   { count: number }

const PERFIL_LABEL: Record<string, string> = {
  admin:    'Administrador',
  gestor:   'Gestor',
  inspetor: 'Inspetor',
};
const PERFIL_ACCESS: Record<string, string> = {
  admin:    'Administrador · Acesso total',
  gestor:   'Gestor · Acesso gerencial',
  inspetor: 'Inspetor · Acesso de campo',
};

export default function PerfilScreen() {
  const router = useRouter();
  const conta = useConta();
  const { sair } = useSessao();
  const userId = conta?.usuarioId ?? null;
  const userEmail = conta?.email ?? null;
  const [signing, setSigning] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [signatureUri, setSignatureUri] = useState<string | null>(null);

  const {
    data: usuarioRows,
    error: usuarioError,
  } = useQuery<UsuarioRow>(
    userId
      ? `SELECT id, nome, cargo, perfil, cliente_id, assinatura_padrao_url, assinatura_padrao_atualizada_em FROM usuarios WHERE id = ? LIMIT 1`
      : `SELECT 1 WHERE 0`,
    userId ? [userId] : [],
  );
  const usuario = usuarioRows[0];
  const signatureKey = usuario?.assinatura_padrao_url ?? null;
  const signatureUpdatedAt = usuario?.assinatura_padrao_atualizada_em ?? null;

  // Prévia da assinatura atual (cópia local; baixa do servidor se o aparelho ainda não tiver).
  useEffect(() => {
    if (!userId || !signatureKey) { setSignatureUri(null); return; }
    let active = true;
    void ensureDefaultSignature(userId, signatureKey).then(uri => { if (active) setSignatureUri(uri); });
    return () => { active = false; };
  }, [userId, signatureKey, signatureUpdatedAt]);
  const profileUnavailable = !userId || !!usuarioError;

  const { data: obrasRows } = useQuery<ObraRow>(
    `SELECT o.id, o.nome, o.municipio, o.uf FROM obras o WHERE o.ativo = 1 ORDER BY o.nome`
  );

  const { data: totalVerifRows } = useQuery<CountRow>(
    `SELECT COUNT(*) AS count FROM verificacoes WHERE inspetor_id = ?`,
    [userId ?? '']
  );
  const { data: conformeRows } = useQuery<CountRow>(
    `SELECT COUNT(*) AS count FROM verificacoes WHERE inspetor_id = ? AND status = 'conforme'`,
    [userId ?? '']
  );
  const { data: ncsRows } = useQuery<CountRow>(
    `SELECT COUNT(*) AS count FROM nao_conformidades n JOIN verificacoes v ON v.id = n.verificacao_id WHERE v.inspetor_id = ? AND n.status IN ('aberta','em_correcao')`,
    [userId ?? '']
  );

  const stats = useMemo(() => ({
    obras:      obrasRows.length,
    total:      totalVerifRows[0]?.count ?? 0,
    conformes:  conformeRows[0]?.count ?? 0,
    ncsAbertas: ncsRows[0]?.count ?? 0,
  }), [obrasRows, totalVerifRows, conformeRows, ncsRows]);

  async function handleLogout() {
    // A sessão apaga rascunhos, assinatura local e o banco do aparelho. Gravações ainda não enviadas
    // só são descartadas com confirmação explícita.
    const resultado = await sair();
    if (resultado.ok) return;
    const n = resultado.pendentes;
    confirmDialog({
      title: 'Alterações não enviadas',
      message: n === 1
        ? 'Há 1 alteração neste aparelho que ainda não foi enviada ao servidor. Se sair agora, ela será perdida. '
          + 'Conecte-se à internet e aguarde a sincronização antes de sair.'
        : `Há ${n} alterações neste aparelho que ainda não foram enviadas ao servidor. Se sair agora, elas serão `
          + 'perdidas. Conecte-se à internet e aguarde a sincronização antes de sair.',
      confirmText: 'Sair e descartar',
      destructive: true,
      onConfirm: () => { void sair({ descartarPendentes: true }); },
    });
  }

  async function handleSignature(path: string) {
    if (!userId) return;
    try {
      setSavingSignature(true);
      setSignatureError(null);
      const localPath = await adoptPendingMedia(await signatureStore.save(userId, path));
      await db.execute(
        'UPDATE usuarios SET assinatura_padrao_url = ?, assinatura_padrao_atualizada_em = ? WHERE id = ?',
        [`pending:${localPath}`, new Date().toISOString(), userId],
      );
      setSigning(false);
    } catch (error) {
      setSignatureError(error instanceof Error ? error.message : 'Não foi possível salvar a assinatura padrão.');
    } finally {
      setSavingSignature(false);
    }
  }

  const infoRows = [
    { icon: User,     label: 'Nome completo',   value: usuario?.nome },
    { icon: Building2,label: 'Empresa',          value: undefined as string | undefined },  // empresa not synced
    { icon: Mail,     label: 'E-mail',            value: userEmail ?? undefined },
    { icon: Phone,    label: 'Celular',           value: undefined as string | undefined },  // not synced
    { icon: Key,      label: 'Perfil de acesso',  value: usuario ? (PERFIL_ACCESS[usuario.perfil] ?? usuario.perfil) : undefined },
  ].filter(r => !!r.value);

  const heroRole = [
    usuario?.cargo,
    PERFIL_LABEL[usuario?.perfil ?? ''],
  ].filter(Boolean).join(' · ');
  const hasSignature = !!usuario?.assinatura_padrao_url;

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      <AppHeader title="Perfil" />

      <ScrollView
        style={s.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.bodyContent}
      >
        {profileUnavailable ? (
          <View style={s.errorCard}>
            <Text style={s.errorText}>
              Não foi possível carregar os dados do usuário autenticado. Entre novamente no sistema.
            </Text>
          </View>
        ) : null}

        <View style={s.heroCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{usuario ? initials(usuario.nome) : 'IN'}</Text>
          </View>
          <Text style={s.heroName} numberOfLines={2}>
            {profileUnavailable ? 'Perfil indisponível' : (usuario?.nome ?? 'Carregando…')}
          </Text>
          {heroRole ? <Text style={s.heroRole}>{heroRole}</Text> : null}
          <View style={s.stats}>
            <Stat value={stats.obras} label="Obras" />
            <Stat value={stats.total} label="Verificações" />
            <Stat value={stats.conformes} label="Conformes" color={Colors.ok} />
            <Stat value={stats.ncsAbertas} label="NCs abertas" color={stats.ncsAbertas > 0 ? Colors.nok : undefined} />
          </View>
        </View>

        <SectionHead title="Conta" />
        <View style={s.list}>
          {infoRows.map(row => (
            <Row key={row.label} Icon={row.icon} label={row.label} value={row.value ?? ''} />
          ))}
          <Row
            Icon={PenLine}
            label="Assinatura padrão" strongLabel
            value={hasSignature
              ? (signatureUpdatedAt ? `Atualizada em ${formatDate(signatureUpdatedAt)}` : 'Configurada para novas assinaturas')
              : 'Ainda não cadastrada'}
            tone={hasSignature ? 'success' : 'warning'}
            action={hasSignature ? 'Alterar' : 'Cadastrar'}
            disabled={!userId || savingSignature}
            onPress={() => { setSignatureError(null); setSigning(true); }}
          />
          <Row
            Icon={RefreshCw}
            label="Sincronização" strongLabel
            value="Fila de envio e registros recusados"
            onPress={() => router.push('/(app)/(tabs)/perfil/sincronizacao')}
          />
          <Row
            Icon={Key}
            label="Alterar senha" strongLabel
            value="Troca a senha e encerra os outros aparelhos"
            onPress={() => router.push('/(app)/alterar-senha')}
            last
          />
        </View>
        {hasSignature ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar assinatura padrão"
            onPress={() => { setSignatureError(null); setSigning(true); }}
            style={({ pressed }) => [s.signatureCard, pressed && s.pressed]}
          >
            {signatureUri ? (
              <Image source={{ uri: signatureUri }} style={s.signatureImage} resizeMode="contain" accessibilityLabel="Sua assinatura padrão" />
            ) : (
              <Text style={s.signatureHint}>Conecte-se à internet para ver a assinatura cadastrada.</Text>
            )}
            <Text style={s.signatureHint}>
              {signatureKey?.startsWith('pending:')
                ? 'Salva neste aparelho. Será enviada na próxima sincronização.'
                : 'Aplicada automaticamente nas verificações, conclusões e avaliações.'}
            </Text>
          </Pressable>
        ) : null}

        {obrasRows.length > 0 ? (
          <>
            <SectionHead title="Obras com acesso" count={obrasRows.length} />
            <View style={s.list}>
              {obrasRows.map((o, index) => (
                <Row
                  key={o.id}
                  Icon={Building2}
                  label={o.nome}
                  value={[o.municipio, o.uf].filter(Boolean).join(', ') || 'Local não informado'}
                  strongLabel
                  last={index === obrasRows.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={handleLogout}
          style={({ pressed }) => [s.logoutBtn, pressed && s.pressed]}
        >
          <Text style={s.logoutText}>Sair do sistema</Text>
        </Pressable>

        <Text style={s.versao} selectable>Versão {versaoDoApp()}</Text>
      </ScrollView>
      <SignatureField
        visible={signing}
        title={hasSignature ? 'Alterar assinatura padrão' : 'Cadastrar assinatura padrão'}
        description="Usada nas verificações, conclusões e avaliações."
        currentUri={signatureUri}
        saving={savingSignature}
        error={signatureError}
        onSign={handleSignature}
        onCancel={() => { setSignatureError(null); setSigning(false); }}
      />
    </SafeAreaView>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Linha de lista do Perfil: ladrilho de ícone, rótulo, valor e ação opcional. */
function Row({
  Icon,
  label,
  value,
  tone = 'neutral',
  action,
  onPress,
  disabled = false,
  strongLabel = false,
  last = false,
}: {
  Icon: IconComponent;
  label: string;
  value: string;
  tone?: TrenaTone;
  action?: string;
  onPress?: () => void;
  disabled?: boolean;
  strongLabel?: boolean;
  last?: boolean;
}) {
  const content = (
    <>
      <IconTile Icon={Icon} tone={tone} size={40} />
      <View style={s.rowBody}>
        <Text style={strongLabel ? s.rowLabelStrong : s.rowLabel} numberOfLines={1}>{label}</Text>
        <Text style={strongLabel ? s.rowValueSoft : s.rowValue} numberOfLines={2}>{value}</Text>
      </View>
      {action ? (
        <View style={s.rowAction}>
          <Text style={s.rowActionText}>{action}</Text>
        </View>
      ) : onPress ? (
        <ChevronRight size={18} color={Colors.textSecondary} />
      ) : null}
    </>
  );
  return (
    <View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}. ${value}${action ? `. ${action}` : ''}`}
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [s.row, pressed && s.rowPressed, disabled && s.rowDisabled]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={s.row} accessible accessibilityLabel={`${label}: ${value}`}>{content}</View>
      )}
      {!last ? <View style={s.rowDivider} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  body: { flex: 1, backgroundColor: Colors.bg },
  bodyContent: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  errorCard: { backgroundColor: Colors.nokBg, borderRadius: Radius.lg, padding: Spacing.lg },
  errorText: { color: Colors.nok, fontSize: FontSizes.sm, fontFamily: FontFamily.medium, lineHeight: 20 },

  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: { color: Colors.brandSignature, fontSize: 32, fontFamily: FontFamily.display, letterSpacing: -0.5 },
  heroName: { ...Typography.title, fontSize: 24, lineHeight: 29, color: Colors.text, textAlign: 'center' },
  heroRole: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontFamily: FontFamily.regular, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg, alignSelf: 'stretch' },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.bg },
  statValue: { fontFamily: FontFamily.monoBold, fontSize: 22, lineHeight: 26, color: Colors.text },
  statLabel: { fontFamily: FontFamily.semibold, fontSize: 11, color: Colors.textSecondary },

  list: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 6, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, minHeight: 64 },
  rowPressed: { backgroundColor: Colors.surface2 },
  rowDisabled: { opacity: 0.55 },
  rowDivider: { height: 1, backgroundColor: Colors.bg, marginLeft: 66, marginRight: Spacing.lg },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  rowValue: { fontFamily: FontFamily.semibold, fontSize: FontSizes.base, color: Colors.text },
  rowLabelStrong: { fontFamily: FontFamily.semibold, fontSize: FontSizes.base, color: Colors.text },
  rowValueSoft: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  rowAction: { minHeight: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.surface2, justifyContent: 'center' },
  rowActionText: { fontFamily: FontFamily.bold, fontSize: FontSizes.xs, color: Colors.text },
  signatureCard: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.xl, backgroundColor: Colors.surface, alignItems: 'center' },
  signatureImage: { width: '100%', height: 88 },
  signatureHint: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },

  logoutBtn: {
    minHeight: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.nokBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  logoutText: { fontFamily: FontFamily.bold, fontSize: FontSizes.md, color: Colors.nok },
  pressed: { opacity: 0.75 },
  versao: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md },
});
