import { X } from 'lucide-react-native';
import { FlatList, Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Colors } from '../lib/constants';
import { usePrivateMediaUris } from '../hooks/usePrivateMediaUris';

interface Props {
  photos: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function PhotoViewer({ photos, initialIndex = 0, visible, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const resolveUri = usePrivateMediaUris(photos);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <X size={24} color={Colors.surface} />
        </Pressable>
        <FlatList
          data={photos}
          keyExtractor={(item, i) => item + i}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          renderItem={({ item }) => (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image
                source={{ uri: resolveUri(item) }}
                style={{ width, height }}
                resizeMode="contain"
              />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
});
