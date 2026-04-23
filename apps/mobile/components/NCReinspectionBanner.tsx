import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../lib/constants';

interface Props {
  itemTitle: string;
  ncId: string;
}

export function NCReinspectionBanner({ itemTitle }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔄</Text>
      <View style={styles.body}>
        <Text style={styles.title}>Re-inspeção de NC aberta</Text>
        <Text style={styles.subtitle}>{itemTitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.progressBg,
    borderWidth: 0.5,
    borderColor: Colors.progress,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 9,
    marginBottom: 9,
  },
  icon: {
    fontSize: 18,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.progress,
  },
  subtitle: {
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
