import { Check, CheckCircle2, FileDown } from '../lib/icons';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from './AppHeader';
import { Colors, FontSizes, Radius, Spacing, FontFamily } from '../lib/constants';

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
      <SafeAreaView edges={['top']} style={st.safe}>
        <AppHeader title="Reinspeção" subtitle="Resultado da reinspeção" showBack={false} />
        <ScrollView contentContainerStyle={st.content}>
          <View style={st.hero}>
            <View style={st.heroCircle}>
              <CheckCircle2 size={31} color={Colors.ok} />
            </View>
            <Text style={st.heroTitle}>NC Resolvida!</Text>
            <Text style={st.heroSubtitle}>Item aprovado na re-inspeção</Text>
          </View>

          <Text style={st.secTitle}>Resumo</Text>
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
              <Text style={[st.secTitle, { marginTop: Spacing.lg }]}>Foto da resolução</Text>
              <Image source={{ uri: fotoUri }} style={st.photo} resizeMode="cover" />
            </>
          ) : null}
        </ScrollView>

        <View style={st.footer}>
          <Pressable
            accessibilityRole="button"
            style={st.btnPdf}
            onPress={() => Alert.alert('Em breve', 'A exportação de PDF será disponibilizada em uma próxima etapa.')}
          >
            <FileDown size={17} color={Colors.text} />
            <Text style={st.btnPdfText}>Exportar PDF</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={st.btnConcluir} onPress={onConcluir}>
            <Check size={18} color={Colors.surface} />
            <Text style={st.btnConcluirText}>Concluir</Text>
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
  heroCircle:  { width: 80, height: 80, borderRadius: Radius.full, backgroundColor: Colors.okBg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  heroTitle:   { fontFamily: FontFamily.display, fontSize: 26, letterSpacing: -0.5, color: Colors.ok },
  heroSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },

  secTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.md, color: Colors.text, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },

  table:    { backgroundColor: Colors.surface, borderRadius: Radius.xl, overflow: 'hidden', padding: 6 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.bg },
  tableKey: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSizes.sm, color: Colors.textSecondary },
  tableVal: { flex: 1.5, fontSize: FontSizes.sm, color: Colors.text, fontFamily: FontFamily.medium, textAlign: 'right' },

  photo: { width: '100%', height: 220, borderRadius: Radius.xl },

  footer:        { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: Spacing.xl, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, backgroundColor: Colors.surface },
  btnPdf:        { flex: 1, minHeight: 52, paddingVertical: 13, borderRadius: Radius.full, backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnPdfText:    { fontFamily: FontFamily.semibold, fontSize: FontSizes.sm, color: Colors.text },
  btnConcluir:   { flex: 1.5, minHeight: 56, paddingVertical: 13, borderRadius: Radius.full, backgroundColor: Colors.ok, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnConcluirText: { fontFamily: FontFamily.bold, fontSize: FontSizes.md, color: Colors.surface },
});
