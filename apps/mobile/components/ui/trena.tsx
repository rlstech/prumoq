import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { ProgressBar } from '../ProgressBar';
import { Colors, ComponentSize, FontFamily, FontSizes, Palette, Radius, Spacing, Typography } from '../../lib/constants';
import { ChevronRight, Search, X, type IconComponent } from '../../lib/icons';

/** Tons semânticos dos componentes Trena Suave. */
export type TrenaTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info' | 'accent';

const toneColors: Record<TrenaTone, { fg: string; bg: string }> = {
  neutral: { fg: Colors.textSecondary, bg: Colors.bg },
  brand: { fg: Colors.text, bg: Colors.bg },
  success: { fg: Colors.ok, bg: Colors.okBg },
  danger: { fg: Colors.nok, bg: Colors.nokBg },
  warning: { fg: Colors.warn, bg: Colors.warnBg },
  info: { fg: Colors.info, bg: Colors.infoBg },
  accent: { fg: Palette.onAccent, bg: Palette.accent },
};

export function toneOf(tone: TrenaTone) {
  return toneColors[tone];
}

/** Ladrilho redondo de ícone, no tom suave do estado. */
export function IconTile({
  Icon,
  tone = 'neutral',
  size = 44,
  iconSize,
  style,
}: {
  Icon: IconComponent;
  tone?: TrenaTone;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { fg, bg } = toneColors[tone];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size >= 56 ? Radius.lg : Radius.sm, backgroundColor: bg },
        style,
      ]}
    >
      <Icon size={iconSize ?? Math.round(size * 0.48)} color={tone === 'brand' ? Colors.text : fg} strokeWidth={1.9} />
    </View>
  );
}

/** Pílula de informação (status, prazo, contagem). */
export function Pill({
  label,
  tone = 'neutral',
  Icon,
  dot = false,
  mono = false,
  onSurface = false,
}: {
  label: string;
  tone?: TrenaTone;
  Icon?: IconComponent;
  dot?: boolean;
  mono?: boolean;
  /** Em cima de cartão branco o neutro usa o concreto; sobre o concreto, o branco. */
  onSurface?: boolean;
}) {
  const { fg, bg } = toneColors[tone];
  const background = tone === 'neutral' && !onSurface ? Colors.surface : bg;
  return (
    <View style={[styles.pill, { backgroundColor: background }]} accessible accessibilityRole="text" accessibilityLabel={label}>
      {dot ? <View style={[styles.pillDot, { backgroundColor: fg }]} /> : null}
      {Icon ? <Icon size={13} color={fg} strokeWidth={2.2} /> : null}
      <Text style={[styles.pillText, mono && styles.pillTextMono, { color: tone === 'neutral' ? Colors.text : fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Cartão grafite com o avanço em fita de trena (Obras, Obra, Ambiente).
 * O número fica em amarelo sobre o grafite; a escala 0–100 embaixo.
 */
export function TapeHero({
  label,
  value,
  footer,
  children,
}: {
  label: string;
  value: number;
  footer?: string;
  children?: ReactNode;
}) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.hero} accessible accessibilityRole="summary" accessibilityLabel={`${label}: ${Math.round(bounded)} por cento`}>
      <View style={styles.heroTop}>
        <Text style={styles.heroLabel}>{label}</Text>
        <Text style={styles.heroValue}>{Math.round(bounded)}%</Text>
      </View>
      <ProgressBar
        value={bounded}
        height={16}
        color={Palette.accent}
        trackColor={Palette.onBrandLine}
        tickColor="rgba(28, 31, 34, 0.45)"
      />
      <View style={styles.heroScale}>
        {[0, 25, 50, 75, 100].map(mark => (
          <Text key={mark} style={styles.heroScaleText}>{mark}</Text>
        ))}
      </View>
      {children ? <View style={styles.heroExtra}>{children}</View> : null}
      {footer ? <Text style={styles.heroFooter} numberOfLines={2}>{footer}</Text> : null}
    </View>
  );
}

/** Pílula sobre o grafite do TapeHero. */
export function HeroPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'danger' | 'success' }) {
  const color = tone === 'danger' ? '#FF8A80' : tone === 'success' ? Palette.successOnBrand : Palette.white;
  return (
    <View style={styles.heroPill}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.heroPillText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/**
 * Cartão branco tocável de uma lista com avanço: obra, ambiente, serviço.
 * Título + pílula de status, barra fina e linha de meta.
 */
export function ProgressCard({
  title,
  subtitle,
  status,
  progress,
  progressTone = 'brand',
  meta,
  metaTone,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  status?: { label: string; tone: TrenaTone };
  progress?: number;
  progressTone?: 'brand' | 'success' | 'danger';
  meta?: string;
  metaTone?: TrenaTone;
  trailing?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const fill = progressTone === 'success' ? Colors.ok : progressTone === 'danger' ? Colors.nok : Colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTitleBox}>
          <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {status ? <Pill label={status.label} tone={status.tone} onSurface /> : null}
      </View>
      {progress !== undefined ? (
        <View style={styles.cardProgress}>
          <View style={styles.cardProgressBar}>
            <View style={styles.thinTrack}>
              <View style={[styles.thinFill, { width: `${Math.max(0, Math.min(100, progress))}%` as `${number}%`, backgroundColor: fill }]} />
            </View>
          </View>
          <Text style={styles.cardPercent}>{Math.round(progress)}%</Text>
        </View>
      ) : null}
      {meta || trailing ? (
        <View style={styles.cardMetaRow}>
          {meta ? (
            <Text
              style={[styles.cardMeta, metaTone && metaTone !== 'neutral' ? { color: toneColors[metaTone].fg, fontFamily: FontFamily.semibold } : null]}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : <View />}
          <View style={styles.cardTrailing}>
            {trailing ? <Text style={styles.cardTrailingText}>{trailing}</Text> : null}
            <ChevronRight size={16} color={Colors.textSecondary} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Chips horizontais de filtro; o ativo fica grafite. */
export function FilterChips<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
  style,
}: {
  value: T;
  options: readonly FilterChipOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={[styles.chips, style]}
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.count !== undefined ? `${option.label}, ${option.count}` : option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && !selected && styles.chipPressed]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            {option.count !== undefined ? (
              <Text style={[styles.chipCount, selected && styles.chipCountSelected]}>{option.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Busca em pílula branca. */
export function SearchPill({
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, focused && styles.searchFocused, style]}>
      <Search size={19} color={Colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        accessibilityLabel={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.searchInput}
        returnKeyType="search"
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => onChangeText('')} hitSlop={8} style={styles.searchClear}>
          <X size={16} color={Colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Título de seção fora do cartão, com contagem e ação opcional. */
export function SectionHead({
  title,
  count,
  actionLabel,
  onAction,
}: {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} numberOfLines={1} accessibilityRole="header">
        {title}
        {count !== undefined ? <Text style={styles.sectionCount}>{`  ${count}`}</Text> : null}
      </Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Rótulo pequeno de grupo dentro de uma lista. */
export function GroupLabel({ label, count, description }: { label: string; count?: number; description?: string }) {
  return (
    <View style={styles.groupLabel}>
      <Text style={styles.groupLabelText}>
        {label}
        {count !== undefined ? <Text style={styles.groupLabelCount}>{`  ${count}`}</Text> : null}
      </Text>
      {description ? <Text style={styles.groupLabelDescription}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  pill: {
    minHeight: 28,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  pillDot: { width: 6, height: 6, borderRadius: Radius.full },
  pillText: { fontFamily: FontFamily.bold, fontSize: FontSizes.tiny },
  pillTextMono: { fontFamily: FontFamily.monoBold },

  hero: {
    backgroundColor: Palette.brand,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: 14,
  },
  heroTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.md },
  heroLabel: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, color: Palette.onBrandMuted, flex: 1 },
  heroValue: { fontFamily: FontFamily.monoBold, fontSize: 30, lineHeight: 34, color: Palette.accent },
  heroScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  heroScaleText: { fontFamily: FontFamily.mono, fontSize: FontSizes.tiny, color: Palette.onBrandMuted },
  heroExtra: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  heroFooter: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Palette.onBrandMuted },
  heroPill: {
    minHeight: 30,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Palette.onBrandLine,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroPillText: { fontFamily: FontFamily.bold, fontSize: FontSizes.tiny },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    paddingLeft: 18,
    gap: 10,
  },
  cardPressed: { backgroundColor: Colors.surface2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  cardTitleBox: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { fontFamily: FontFamily.bold, fontSize: FontSizes.md, lineHeight: 21, color: Colors.text },
  cardSubtitle: { fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  cardProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardProgressBar: { flex: 1 },
  thinTrack: { height: 8, borderRadius: Radius.full, backgroundColor: Colors.bg, overflow: 'hidden' },
  thinFill: { height: 8, borderRadius: Radius.full },
  cardPercent: { fontFamily: FontFamily.monoBold, fontSize: FontSizes.tiny, color: Colors.text, minWidth: 36, textAlign: 'right' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  cardMeta: { flex: 1, minWidth: 0, fontFamily: FontFamily.regular, fontSize: FontSizes.xs, color: Colors.textSecondary },
  cardTrailing: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTrailingText: { fontFamily: FontFamily.medium, fontSize: FontSizes.tiny, color: Colors.textSecondary },

  chips: { gap: Spacing.sm, paddingRight: Spacing.xl },
  chip: {
    minHeight: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  chipSelected: { backgroundColor: Colors.brand },
  chipPressed: { backgroundColor: Colors.surface2 },
  chipText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.sm, color: Colors.text },
  chipTextSelected: { color: Palette.white, fontFamily: FontFamily.bold },
  chipCount: { fontFamily: FontFamily.monoBold, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  chipCountSelected: { color: Palette.accent },

  search: {
    minHeight: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 18,
    paddingRight: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchFocused: { borderColor: Colors.focus },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.base,
    color: Colors.text,
  },
  searchClear: { width: ComponentSize.touch, height: ComponentSize.touch, alignItems: 'center', justifyContent: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xs, gap: Spacing.md },
  sectionTitle: { ...Typography.heading, color: Colors.text, flex: 1, minWidth: 0 },
  sectionCount: { fontFamily: FontFamily.monoBold, fontSize: FontSizes.sm, color: Colors.textSecondary },
  sectionAction: { minHeight: 32, justifyContent: 'center' },
  sectionActionText: { fontFamily: FontFamily.semibold, fontSize: FontSizes.xs, color: Colors.textSecondary },

  groupLabel: { paddingHorizontal: Spacing.xs, gap: 2 },
  groupLabelText: { fontFamily: FontFamily.bold, fontSize: FontSizes.xs, color: Colors.textSecondary },
  groupLabelCount: { fontFamily: FontFamily.monoBold, color: Colors.textTertiary },
  groupLabelDescription: { fontFamily: FontFamily.regular, fontSize: FontSizes.tiny, color: Colors.textTertiary },
});
