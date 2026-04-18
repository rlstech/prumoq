import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../lib/constants';

const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL ?? '';

function resolveUri(key: string): string {
  if (key.startsWith('pending:')) return key.slice('pending:'.length);
  if (key.startsWith('data:') || key.startsWith('http')) return key;
  return `${R2_PUBLIC_URL}/${key}`;
}

interface Props {
  photos: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function PhotoViewer({ photos, initialIndex = 0, visible, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);

  // Sync index when initialIndex or visibility changes
  const currentIndex = visible ? index : initialIndex;

  function handleOpen() {
    setIndex(initialIndex);
  }

  function prev() {
    setIndex(i => (i > 0 ? i - 1 : photos.length - 1));
  }

  function next() {
    setIndex(i => (i < photos.length - 1 ? i + 1 : 0));
  }

  const photo = photos[currentIndex];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      {/* Backdrop — click to close */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation on content so clicks inside don't close */}
        <Pressable style={styles.content} onPress={e => e.stopPropagation()}>

          {/* Top bar */}
          <View style={styles.topBar}>
            {photos.length > 1 && (
              <Text style={styles.counter}>{currentIndex + 1} / {photos.length}</Text>
            )}
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <X size={22} color="#fff" />
            </Pressable>
          </View>

          {/* Image */}
          {photo ? (
            <Image
              source={{ uri: resolveUri(photo) }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : null}

          {/* Prev / Next */}
          {photos.length > 1 && (
            <>
              <Pressable style={[styles.navBtn, styles.navLeft]} onPress={prev}>
                <ChevronLeft size={28} color="#fff" />
              </Pressable>
              <Pressable style={[styles.navBtn, styles.navRight]} onPress={next}>
                <ChevronRight size={28} color="#fff" />
              </Pressable>
            </>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: 20,
  },
  counter: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 6,
  },
  image: {
    width: '100%',
    height: '80%',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 8,
    zIndex: 10,
  },
  navLeft: { left: 16 },
  navRight: { right: 16 },
});
