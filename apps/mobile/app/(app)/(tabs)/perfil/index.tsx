import { useQuery } from '@powersync/react-native';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { KPICard } from '../../../../components/KPICard';
import { Colors, FontSizes, Radius, Spacing } from '../../../../lib/constants';
import { db } from '../../../../lib/powersync';
import { supabase } from '../../../../lib/supabase';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UsuarioRow { id: string; nome: string; cargo: string; perfil: string; empresa_id: string }
interface EmpresaRow { id: string; nome: string }
interface CountRow { count: number }
interface ObraRow { id: string; nome: string }

export default function PerfilScreen() {
  const [userId, setUserId] = useState<string | null>(null);
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

  const { data: empresaRows } = useQuery<EmpresaRow>(
    usuario?.empresa_id
      ? `SELECT id, nome FROM empresas WHERE id = '${usuario.empresa_id}'`
      : `SELECT id, nome FROM empresas WHERE 1=0`
  );
  const empresa = empresaRows[0];

  const { data: obrasRows } = useQuery<ObraRow>(
    `SELECT o.id, o.nome FROM obras o WHERE o.ativo = 1 ORDER BY o.nome`
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
    try {
      await db.disconnectAndClear();
    } catch (e) {
      console.error('[Perfil] PowerSync disconnect error:', e);
    }
    await supabase.auth.signOut();
  }

  const perfilLabel: Record<string, string> = {
    admin: 'Administrador',
    gestor: 'Gestor',
    inspetor: 'Inspetor de Campo',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {usuario ? initials(usuario.nome) : 'IN'}
          </Text>
        </View>
        <Text style={styles.name}>{usuario?.nome ?? 'Carregando...'}</Text>
        <Text style={styles.role}>{usuario ? (perfilLabel[usuario.perfil] ?? usuario.cargo) : ''}</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Info rows */}
        <View style={styles.infoCard}>
          {[
            { label: 'Nome', value: usuario?.nome },
            { label: 'Empresa', value: empresa?.nome },
            { label: 'E-mail', value: userEmail },
            { label: 'Cargo', value: usuario?.cargo },
            { label: 'Perfil', value: usuario ? (perfilLabel[usuario.perfil] ?? usuario.perfil) : undefined },
          ].map(row => (
            row.value ? (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ) : null
          ))}
        </View>

        {/* Statistics */}
        <Text style={styles.sectionTitle}>ESTATÍSTICAS</Text>
        <View style={styles.kpiGrid}>
          <KPICard label="Obras ativas" value={stats.obras} color={Colors.progress} />
          <KPICard label="Verificações" value={stats.total} color={Colors.ok} />
        </View>
        <View style={styles.kpiGrid}>
          <KPICard label="Conformes" value={stats.conformes} color={Colors.ok} />
          <KPICard label="NCs abertas" value={stats.ncsAbertas} color={Colors.nok} />
        </View>

        {/* Authorized projects */}
        {obrasRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>OBRAS AUTORIZADAS</Text>
            <View style={styles.obrasList}>
              {obrasRows.map(o => (
                <View key={o.id} style={styles.obraRow}>
                  <Text style={styles.obraNome}>{o.nome}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.brand },
  hero: {
    backgroundColor: Colors.brand,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl + 4,
    alignItems: 'center',
    gap: Spacing.sm,
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
  avatarText: { color: Colors.brand, fontSize: FontSizes.xxl, fontWeight: '600' },
  name: { color: '#fff', fontSize: FontSizes.xl, fontWeight: '500' },
  role: { color: 'rgba(255,255,255,0.8)', fontSize: FontSizes.base },
  body: { flex: 1, backgroundColor: Colors.bg },
  bodyContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: FontSizes.base, color: Colors.textSecondary },
  infoValue: { fontSize: FontSizes.base, color: Colors.text, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  kpiGrid: { flexDirection: 'row', gap: Spacing.sm },
  obrasList: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  obraRow: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  obraNome: { fontSize: FontSizes.base, color: Colors.text },
  logoutBtn: {
    backgroundColor: Colors.nokBg,
    borderRadius: Radius.md,
    padding: 13,
    alignItems: 'center',
  },
  logoutText: { color: Colors.nok, fontSize: FontSizes.md, fontWeight: '500' },
});
