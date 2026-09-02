import { useQuery } from '@powersync/react-native';
import { useRouter } from 'expo-router';
import { Building2, Key, Mail, PenLine, Phone, RefreshCw, User } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '../../../../components/AppHeader';
import { IconBox } from '../../../../components/IconBox';
import { SignatureField } from '../../../../components/SignatureField';
import { Breakpoints, Colors, ComponentSize, FontFamily, FontSizes, Radius, Spacing, Typography } from '../../../../lib/constants';
import { db } from '../../../../lib/powersync';
import { supabase } from '../../../../lib/supabase';
import { draftStore } from '../../../../lib/verification/draftStore';
import { signatureStore } from '../../../../lib/signature-store';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UsuarioRow { id: string; nome: string; cargo: string; perfil: string; cliente_id: string; assinatura_padrao_url: string | null; assinatura_padrao_atualizada_em: string | null }
interface ObraRow    { id: string; nome: string; municipio: string; uf: string }
interface CountRow   { count: number }

function StatCard({
  value, label, bg, color,
}: { value: number; label: string; bg: string; color: string }) {
  return (
    <View style={[sc.card, { backgroundColor: bg }]}>
      <Text style={[sc.val, { color }]}>{value}</Text>
      <Text style={[sc.lbl, { color: color === Colors.text ? Colors.textSecondary : color }]}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: { flex: 1, borderRadius: Radius.lg, padding: 13 },
  val:  { fontSize: 26, fontWeight: '500' },
  lbl:  { fontSize: FontSizes.tiny - 1, marginTop: 2 },
});

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
  const insets = useSafeAreaInsets();
  const [userId, setUserId]     = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [signing, setSigning] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
      setAuthResolved(true);
    }).catch(err => {
      console.warn('[Perfil] getSession failed', err);
      setAuthResolved(true);
    });
  }, []);

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
  const profileUnavailable = authResolved && (!userId || !!usuarioError);

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
    if (userId) {
      try { await draftStore.deleteForUser(userId); } catch { /* logout must continue */ }
      try { await signatureStore.clear(userId); } catch { /* logout must continue */ }
    }
    try { await db.disconnectAndClear(); } catch { /* ignore */ }
    await supabase.auth.signOut();
  }

  async function handleSignature(path: string) {
    if (!userId) return;
    try {
      setSavingSignature(true);
      setSignatureError(null);
      const localPath = await signatureStore.save(userId, path);
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

  const heroRole = [
    usuario?.cargo,
    PERFIL_LABEL[usuario?.perfil ?? ''],
  ].filter(Boolean).join(' · ');

  const infoRows = [
    { icon: User,     label: 'Nome completo',   value: usuario?.nome },
    { icon: Building2,label: 'Empresa',          value: undefined as string | undefined },  // empresa not synced
    { icon: Mail,     label: 'E-mail',            value: userEmail ?? undefined },
    { icon: Phone,    label: 'Celular',           value: undefined as string | undefined },  // not synced
    { icon: Key,      label: 'Perfil de acesso',  value: usuario ? (PERFIL_ACCESS[usuario.perfil] ?? usuario.perfil) : undefined },
  ].filter(r => !!r.value);

  return (
    <SafeAreaView edges={['top']} style={s.safe}>
      {/* Hero */}
      <AppHeader>
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{usuario ? initials(usuario.nome) : 'IN'}</Text>
          </View>
          <Text style={s.heroName}>
            {profileUnavailable ? 'Perfil indisponível' : (usuario?.nome ?? 'Carregando...')}
          </Text>
          {heroRole ? <Text style={s.heroRole}>{heroRole}</Text> : null}
        </View>
      </AppHeader>

      <ScrollView
        style={s.body}
        showsVerticalScrollIndicator={false}
        // Reserva a altura da barra de abas flutuante mais o inset do gesto,
        // senao o ultimo bloco fica embaixo dela sem como rolar.
        contentContainerStyle={[
          s.bodyContent,
          { paddingBottom: ComponentSize.tabBar + Spacing.sm + Spacing.xxl + insets.bottom },
        ]}
      >
        {profileUnavailable ? (
          <View style={s.errorCard}>
            <Text style={s.errorText}>
              Não foi possível carregar os dados do usuário autenticado. Entre novamente no sistema.
            </Text>
          </View>
        ) : null}

        {/* Dados do usuário */}
        <Text style={s.sectionLabel}>DADOS DO USUÁRIO</Text>
        <View style={s.dataCard}>
          {infoRows.map((row, idx) => {
            const Icon = row.icon;
            return (
              <View
                key={row.label}
                style={[s.pfRow, idx === infoRows.length - 1 && s.pfRowLast]}
              >
                <View style={s.pfIcon}>
                  <Icon size={16} color={Colors.textSecondary} />
                </View>
                <View style={s.pfInfo}>
                  <Text style={s.pfLbl}>{row.label}</Text>
                  <Text style={s.pfVal}>{row.value}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={s.divider} />
        <Text style={s.sectionLabel}>ASSINATURA PADRÃO</Text>
        <View style={s.signatureCard}>
          <View style={s.pfIcon}><PenLine size={16} color={Colors.brand} /></View>
          <View style={s.pfInfo}>
            <Text style={s.pfLbl}>Assinatura digital</Text>
            <Text style={s.pfVal}>{usuario?.assinatura_padrao_url ? 'Configurada para novas assinaturas' : 'Ainda não cadastrada'}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={!userId || savingSignature}
            onPress={() => setSigning(true)}
            style={s.signatureAction}
          >
            <Text style={s.signatureActionText}>{usuario?.assinatura_padrao_url ? 'Alterar' : 'Cadastrar'}</Text>
          </TouchableOpacity>
        </View>
        {signatureError ? <Text style={s.signatureError}>{signatureError}</Text> : null}

        {/* Divider */}
        <View style={s.divider} />

        {/* Minhas estatísticas */}
        <Text style={s.sectionLabel}>MINHAS ESTATÍSTICAS</Text>
        <View style={s.statsGrid}>
          <StatCard value={stats.obras}      label="Obras ativas"  bg={Colors.progressBg} color={Colors.progress} />
          <StatCard value={stats.total}      label="Total verif."  bg={Colors.surface2}   color={Colors.text} />
        </View>
        <View style={[s.statsGrid, { marginTop: 9 }]}>
          <StatCard value={stats.conformes}  label="Conformes"     bg={Colors.okBg}       color={Colors.ok} />
          <StatCard value={stats.ncsAbertas} label="NC abertas"    bg={Colors.nokBg}      color={Colors.nok} />
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Obras com acesso */}
        {obrasRows.length > 0 && (
          <>
            <Text style={s.sectionLabel}>OBRAS COM ACESSO</Text>
            {obrasRows.map(o => {
              const location = [o.municipio, o.uf].filter(Boolean).join(', ');
              return (
                <View key={o.id} style={s.obraCard}>
                  <View style={s.obraCardRow}>
                    <Text style={s.obraNome} numberOfLines={1}>{o.nome}</Text>
                    <View style={s.ativoBadge}>
                      <Text style={s.ativoText}>Ativo</Text>
                    </View>
                  </View>
                  {location ? <Text style={s.obraLocation}>{location}</Text> : null}
                </View>
              );
            })}
            <View style={s.divider} />
          </>
        )}

        <TouchableOpacity
          style={s.passwordBtn}
          onPress={() => router.push('/(app)/(tabs)/perfil/sincronizacao')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityHint="Fila de envio e registros recusados pelo servidor"
        >
          <IconBox icon={RefreshCw} size={18} color={Colors.brand} />
          <Text style={s.passwordText}>Sincronização</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.passwordBtn}
          onPress={() => router.push('/(app)/alterar-senha')}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <IconBox icon={Key} size={18} color={Colors.brand} />
          <Text style={s.passwordText}>Alterar senha</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={s.logoutText}>Sair do sistema</Text>
        </TouchableOpacity>
      </ScrollView>
      <SignatureField visible={signing} onSign={handleSignature} onCancel={() => setSigning(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  // Hero
  hero: { alignItems: 'flex-start', paddingBottom: Spacing.sm, gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandLight,
    borderWidth: 1,
    borderColor: Colors.brandSignature,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  avatarText: { color: Colors.brand, fontSize: 22, fontFamily: FontFamily.bold },
  heroName:   { color: Colors.text, fontSize: FontSizes.xl, fontFamily: FontFamily.bold },
  heroRole:   { color: Colors.textSecondary, fontSize: FontSizes.sm, fontFamily: FontFamily.regular },

  // Body
  body:        { flex: 1, backgroundColor: Colors.bg },
  bodyContent: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    padding: Spacing.lg,
  },
  errorCard: {
    backgroundColor: Colors.nokBg,
    borderWidth: 1,
    borderColor: Colors.nok,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.nok,
    fontSize: FontSizes.sm,
    fontFamily: FontFamily.medium,
    lineHeight: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: FontSizes.tiny - 1,
    fontFamily: FontFamily.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Data card (dados do usuário)
  dataCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 0,
  },
  signatureCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  signatureAction: { borderWidth: 1, borderColor: Colors.brand, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  signatureActionText: { ...Typography.label, color: Colors.brand },
  signatureError: { ...Typography.caption, color: Colors.nok, marginTop: Spacing.xs },
  pfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  pfRowLast: { borderBottomWidth: 0 },
  pfIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pfInfo: { flex: 1 },
  pfLbl:  { fontSize: FontSizes.tiny - 1, color: Colors.textSecondary },
  pfVal:  { fontSize: FontSizes.sm, fontWeight: '500', color: Colors.text, marginTop: 2 },

  // Divider
  divider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginVertical: 13,
  },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: 9 },

  // Obra cards
  obraCard: {
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: 9,
  },
  obraCardRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  obraNome:     { fontSize: FontSizes.base, fontWeight: '500', color: Colors.text, flex: 1, marginRight: 8 },
  obraLocation: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 2 },
  ativoBadge:   { backgroundColor: Colors.progressBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  ativoText:    { fontSize: FontSizes.tiny - 1, fontWeight: '500', color: Colors.progress },

  // Account actions
  passwordBtn: {
    minHeight: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    borderRadius: Radius.lg,
    padding: 13,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordText: { ...Typography.label, color: Colors.brand },
  logoutBtn: {
    minHeight: 48,
    backgroundColor: Colors.nokBg,
    borderWidth: 1,
    borderColor: Colors.nok,
    borderRadius: Radius.lg,
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { ...Typography.label, color: Colors.nok },
});
