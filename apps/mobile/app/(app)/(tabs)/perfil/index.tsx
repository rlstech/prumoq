import { useQuery } from '@powersync/react-native';
import { Building2, Key, Mail, Phone, User } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSizes, Radius, Spacing } from '../../../../lib/constants';
import { db } from '../../../../lib/powersync';
import { supabase } from '../../../../lib/supabase';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UsuarioRow { id: string; nome: string; cargo: string; perfil: string; empresa_id: string }
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
  const [userId, setUserId]     = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const { data: usuarioRows } = useQuery<UsuarioRow>(
    `SELECT id, nome, cargo, perfil, empresa_id FROM usuarios LIMIT 1`
  );
  const usuario = usuarioRows[0];

  const { data: obrasRows } = useQuery<ObraRow>(
    `SELECT o.id, o.nome, o.municipio, o.uf FROM obras o WHERE o.ativo = 1 ORDER BY o.nome`
  );

  const { data: totalVerifRows } = useQuery<CountRow>(
    userId
      ? `SELECT COUNT(*) AS count FROM verificacoes WHERE inspetor_id = '${userId}'`
      : `SELECT 0 AS count`
  );
  const { data: conformeRows } = useQuery<CountRow>(
    userId
      ? `SELECT COUNT(*) AS count FROM verificacoes WHERE inspetor_id = '${userId}' AND status = 'conforme'`
      : `SELECT 0 AS count`
  );
  const { data: ncsRows } = useQuery<CountRow>(
    userId
      ? `SELECT COUNT(*) AS count FROM nao_conformidades n JOIN verificacoes v ON v.id = n.verificacao_id WHERE v.inspetor_id = '${userId}' AND n.status = 'aberta'`
      : `SELECT 0 AS count`
  );

  const stats = useMemo(() => ({
    obras:      obrasRows.length,
    total:      totalVerifRows[0]?.count ?? 0,
    conformes:  conformeRows[0]?.count ?? 0,
    ncsAbertas: ncsRows[0]?.count ?? 0,
  }), [obrasRows, totalVerifRows, conformeRows, ncsRows]);

  async function handleLogout() {
    try { await db.disconnectAndClear(); } catch { /* ignore */ }
    await supabase.auth.signOut();
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
    <SafeAreaView style={s.safe}>
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{usuario ? initials(usuario.nome) : 'IN'}</Text>
        </View>
        <Text style={s.heroName}>{usuario?.nome ?? 'Carregando...'}</Text>
        {heroRole ? <Text style={s.heroRole}>{heroRole}</Text> : null}
      </View>

      <ScrollView
        style={s.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.bodyContent}
      >
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

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={s.logoutText}>Sair do sistema</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.brand },

  // Hero
  hero: {
    backgroundColor: Colors.brand,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: 30,
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.brand, fontSize: 22, fontWeight: '500' },
  heroName:   { color: '#fff', fontSize: FontSizes.lg, fontWeight: '500' },
  heroRole:   { color: 'rgba(255,255,255,0.8)', fontSize: FontSizes.sm },

  // Body
  body:        { flex: 1, backgroundColor: Colors.bg },
  bodyContent: { padding: Spacing.lg, paddingBottom: 40 },

  // Section label
  sectionLabel: {
    fontSize: FontSizes.tiny - 1,
    fontWeight: '500',
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

  // Logout
  logoutBtn: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.lg,
    padding: 13,
    alignItems: 'center',
  },
  logoutText: { color: Colors.nok, fontSize: FontSizes.base, fontWeight: '500' },
});
