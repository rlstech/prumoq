import { Plus, X } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '../lib/constants';

const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '';

function resolveUri(key: string): string {
  if (key.startsWith('pending:')) {
    return key.slice('pending:'.length);
  }
  return `${R2_PUBLIC_URL}/${key}`;
}

interface Props {
  photos: string[];       // r2_key values or 'pending:[local_path]'
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
          <Pressable accessibilityRole="button" accessibilityLabel={`Abrir foto ${index + 1}`} onPress={() => onPress?.(index)}>
            <Image source={{ uri: resolveUri(key) }} style={styles.thumb} resizeMode="cover" />
          </Pressable>
          {onRemove && (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remover foto ${index + 1}`} style={styles.remove} onPress={() => onRemove(index)} hitSlop={8}>
              <X size={13} color={Colors.surface} strokeWidth={2.6} />
            </Pressable>
          )}
          {key.startsWith('pending:') && <View style={styles.pendingDot} />}
        </View>
      ))}
      {canAdd && (
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <Plus size={20} color={Colors.textSecondary} />
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  cell: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Radius.full,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDot: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.warn,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  addButton: {
    width: THUMB,
    height: THUMB,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.borderNormal,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface2,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  addLabel: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  overflow: {
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
