import { X } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing } from '../lib/constants';

const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '';

function resolveUri(key: string): string {
  if (key.startsWith('blob:') || key.startsWith('data:') || key.startsWith('http')) return key;
  if (key.startsWith('pending:')) return key.slice('pending:'.length);
  return `${R2_PUBLIC_URL}/${key}`;
}

function isPending(key: string): boolean {
  // blob: or data: = not yet uploaded to R2
  return key.startsWith('blob:') || key.startsWith('data:');
}

interface Props {
  photos: string[];
  max?: number;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onPress?: (index: number) => void;
  addLabel?: string;
}

export function PhotoGrid({ photos, max, onAdd, onRemove, onPress, addLabel = 'Adicionar foto' }: Props) {
  const displayPhotos = max !== undefined ? photos.slice(0, max) : photos;
  const canAdd = onAdd && (max === undefined || photos.length < max);

  return (
    <View style={styles.grid}>
      {displayPhotos.map((key, index) => (
        <View key={key + index} style={styles.cell}>
          <Pressable onPress={() => onPress?.(index)}>
            <Image source={{ uri: resolveUri(key) }} style={styles.thumb} resizeMode="cover" />
          </Pressable>
          {onRemove && (
            <Pressable style={styles.remove} onPress={() => onRemove(index)} hitSlop={8}>
              <X size={10} color={Colors.surface} strokeWidth={3} />
            </Pressable>
          )}
          {isPending(key) && <View style={styles.pendingDot} />}
        </View>
      ))}
      {canAdd && (
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={onAdd}
        >
          <Text style={styles.addPlus}>+</Text>
          <Text style={styles.addLabel}>{addLabel}</Text>
        </Pressable>
      )}
      {max !== undefined && photos.length > max && (
        <View style={[styles.cell, styles.overflow]}>
          <Text style={styles.overflowText}>+{photos.length - max}</Text>
        </View>
      )}
    </View>
  );
}

const THUMB = 80;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  cell: { width: THUMB, height: THUMB, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  thumb: { width: THUMB, height: THUMB },
  remove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.full, width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingDot: {
    position: 'absolute', bottom: 4, left: 4,
    width: 8, height: 8, borderRadius: Radius.full,
    backgroundColor: Colors.warn, borderWidth: 1, borderColor: Colors.surface,
  },
  addButton: {
    width: THUMB, height: THUMB, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.borderNormal, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface2, gap: 2,
  },
  pressed: { opacity: 0.7 },
  addPlus: { fontSize: 20, color: Colors.textTertiary, lineHeight: 22 },
  addLabel: { fontSize: 9, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: 4 },
  overflow: { backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center' },
  overflowText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
});
