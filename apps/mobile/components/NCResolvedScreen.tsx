import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from './AppHeader';
import { Colors, FontSizes, Radius, Spacing } from '../lib/constants';

interface Props {
  visible: boolean;
  itemTitle: string;
  abertoEm: string | null;
  resolvidoEm: string;
  responsavelNome: string | null;
  fotoUri: string | null;
  onConcluir: () => void;
}

function daysBetween(d1: string | null, d2: string): string {
  if (!d1) return '—';
  const t1 = new Date(d1.slice(0, 10)).getTime();
  const t2 = new Date(d2.slice(0, 10)).getTime();
  const diff = Math.max(0, Math.round((t2 - t1) / 86400000));
  return `${diff} dia${diff !== 1 ? 's' : ''}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export function NCResolvedScreen({
  visible, itemTitle, abertoEm, resolvidoEm,
  responsavelNome, fotoUri, onConcluir,
}: Props) {
  if (!visible) return null;

  const rows: [string, string][] = [
    ['Item', itemTitle],
    ['NC aberta em', fmtDate(abertoEm)],
    ['Resolvida em', fmtDate(resolvidoEm)],
    ['Tempo total', daysBetween(abertoEm, resolvidoEm)],
    ['Responsável', responsavelNome ?? '—'],
  ];

  return (
    <View style={st.overlay}>
      <SafeAreaView style={st.safe}>
        <AppHeader title="RE-INSPEÇÃO" subtitle="Resultado da re-inspeção" showBack={false} />
        <ScrollView contentContainerStyle={st.content}>
          <View style={st.hero}>
            <View style={st.heroCircle}>
              <Text style={st.heroIcon}>✓</Text>
            </View>
            <Text style={st.heroTitle}>NC Resolvida!</Text>
            <Text style={st.heroSubtitle}>Item aprovado na re-inspeção</Text>
          </View>

          <Text style={st.secTitle}>RESUMO</Text>
          <View style={st.table}>
            {rows.map(([k, v], i) => (
              <View key={k} style={[st.tableRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={st.tableKey}>{k}</Text>
                <Text style={st.tableVal}>{v}</Text>
              </View>
            ))}
          </View>

          {fotoUri ? (
            <>
              <Text style={[st.secTitle, { marginTop: Spacing.lg }]}>FOTO DA RESOLUÇÃO</Text>
              <Image source={{ uri: fotoUri }} style={st.photo} resizeMode="cover" />
            </>
          ) : null}
        </ScrollView>

        <View style={st.footer}>
          <Pressable style={st.btnPdf}>
            <Text style={st.btnPdfText}>⇒ Exportar PDF</Text>
          </Pressable>
          <Pressable style={st.btnConcluir} onPress={onConcluir}>
            <Text style={st.btnConcluirText}>Concluir ✓</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: Colors.bg },
  safe:    { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 20 },

  hero:        { alignItems: 'center', paddingVertical: Spacing.xl },
  heroCircle:  { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.okBg, borderWidth: 2, borderColor: Colors.ok, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  heroIcon:    { fontSize: 28, color: Colors.ok, fontWeight: '700' },
  heroTitle:   { fontSize: FontSizes.xl, fontWeight: '700', color: Colors.ok },
  heroSubtitle: { fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },

  secTitle: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 0.5, marginBottom: Spacing.sm },

  table:    { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderNormal, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  tableKey: { flex: 1, fontSize: FontSizes.sm, color: Colors.textSecondary },
  tableVal: { flex: 1.5, fontSize: FontSizes.sm, color: Colors.text, fontWeight: '500', textAlign: 'right' },

  photo: { width: '100%', height: 200, borderRadius: Radius.md },

  footer:        { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, paddingBottom: Spacing.xl, borderTopWidth: 0.5, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  btnPdf:        { flex: 1, paddingVertical: 13, borderRadius: Radius.md, backgroundColor: Colors.surface2, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.borderNormal },
  btnPdfText:    { fontSize: FontSizes.sm, color: Colors.text },
  btnConcluir:   { flex: 1.5, paddingVertical: 13, borderRadius: Radius.md, backgroundColor: Colors.ok, alignItems: 'center' },
  btnConcluirText: { fontSize: FontSizes.base, color: '#fff', fontWeight: '600' },
});
