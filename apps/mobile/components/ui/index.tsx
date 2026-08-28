import { AlertCircle, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ListFilter, LockKeyhole, LucideIcon, MinusCircle, RefreshCw, Search, WifiOff, X, XCircle } from 'lucide-react-native';
import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal as NativeModal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import {
  Breakpoints,
  Colors,
  ComponentSize,
  Elevation,
  FontFamily,
  FontSizes,
  Radius,
  Spacing,
  Typography,
} from '../../lib/constants';
import {
  formatDate,
  formatDateAccessibility,
  formatMonth,
  getMonthDays,
  getTodayIso,
  isDateWithinRange,
  isIsoDate,
  monthFromIso,
  shiftMonth,
  WEEKDAY_LABELS,
} from '../../lib/calendar';

export function Screen({
  children,
  scroll = false,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenContent, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, styles.screenContent, contentStyle]}>{children}</View>;
}

export function Container({
  children,
  style,
  narrow = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  narrow?: boolean;
}) {
  return (
    <View style={[styles.container, narrow && styles.containerNarrow, style]}>
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'soft' | 'accent' | 'danger' | 'success';
}) {
  return <View style={[styles.card, cardTone[tone], style]}>{children}</View>;
}

export type DatumTone = BadgeTone | 'accent';

export function DatumCard({
  children,
  tone = 'accent',
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  tone?: DatumTone;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const content = (
    <>
      <View style={[styles.datumLine, { backgroundColor: datumPalette[tone] }]} />
      <View style={styles.datumContent}>{children}</View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.datumCard, style]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.datumCard,
        style,
        focused && styles.focusVisible,
        pressed && styles.datumCardPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function ListSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.listSurface, style]}>{children}</View>;
}

export function OperationalRow({
  children,
  leading,
  trailing,
  tone = 'neutral',
  last = false,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  tone?: DatumTone;
  last?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.operationalRow,
        style,
        focused && styles.focusVisible,
        pressed && styles.operationalRowPressed,
      ]}
    >
      <View style={[styles.operationalDatum, { backgroundColor: datumPalette[tone] }]} />
      {leading ? <View style={styles.operationalLeading}>{leading}</View> : null}
      <View style={styles.operationalBody}>{children}</View>
      {trailing ? <View style={styles.operationalTrailing}>{trailing}</View> : null}
      {!last ? <View style={styles.operationalSeparator} /> : null}
    </Pressable>
  );
}

/**
 * Dense label/value row shared by summary and detail screens. Lives inside a
 * ListSurface or a Card. Replaces the ad-hoc ReviewRow/SummaryItem/ContextRow
 * pairs that used to be redeclared per screen.
 */
export function DataRow({
  label,
  value,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  align = 'row',
  emphasis = 'default',
  tone,
  last = false,
  style,
}: {
  label: string;
  value?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** 'row' = label left / value right (dense, 44px) · 'stack' = overline label above value */
  align?: 'row' | 'stack';
  /** 'strong' = semibold value · 'mono' = IBM Plex Mono value */
  emphasis?: 'default' | 'strong' | 'mono';
  tone?: BadgeTone;
  /** Suppresses the bottom hairline — set on the last row of a group. */
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const stacked = align === 'stack';
  const isPrimitiveValue = typeof value === 'string' || typeof value === 'number';

  const inner = (
    <>
      {leading ? <View style={styles.dataRowLeading}>{leading}</View> : null}
      <View style={[styles.dataRowBody, stacked && styles.dataRowBodyStack]}>
        <Text style={stacked ? styles.dataRowLabelStack : styles.dataRowLabelRow} numberOfLines={1}>
          {label}
        </Text>
        {value === undefined ? null : isPrimitiveValue ? (
          <Text
            numberOfLines={stacked ? 2 : 1}
            style={[
              stacked ? styles.dataRowValueStack : styles.dataRowValueRow,
              emphasis === 'strong' && styles.dataRowValueStrong,
              emphasis === 'mono' && styles.dataRowValueMono,
              tone ? { color: metricPalette[tone] } : null,
            ]}
          >
            {value}
          </Text>
        ) : (
          <View style={stacked ? styles.dataRowValueNodeStack : styles.dataRowValueNodeRow}>{value}</View>
        )}
      </View>
      {trailing ? <View style={styles.dataRowTrailing}>{trailing}</View> : null}
    </>
  );

  const rowStyle: StyleProp<ViewStyle> = [
    styles.dataRow,
    stacked && styles.dataRowStack,
    !last && styles.dataRowBordered,
    style,
  ];

  if (!onPress) {
    return <View style={rowStyle}>{inner}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        rowStyle,
        focused && styles.focusVisible,
        pressed && styles.dataRowPressed,
      ]}
    >
      {inner}
    </Pressable>
  );
}

export function MetricBlock({
  label,
  value,
  suffix,
  tone = 'neutral',
  style,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.metricBlock, style]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color: metricPalette[tone] }]}>{value}</Text>
        {suffix ? <Text style={[styles.metricSuffix, { color: metricPalette[tone] }]}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  Icon,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityHint,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  Icon?: LucideIcon;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const palette = buttonPalette[variant];
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        style,
        focused && styles.focusVisible,
        pressed && { backgroundColor: palette.pressed },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <>
          {Icon ? <Icon size={18} color={palette.text} strokeWidth={2.2} /> : null}
          <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  label,
  onPress,
  Icon,
  selected = false,
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  Icon: LucideIcon;
  selected?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.iconButton,
        selected && styles.iconButtonSelected,
        disabled && styles.disabled,
        style,
        focused && styles.focusVisible,
        pressed && styles.iconButtonPressed,
      ]}
    >
      <Icon size={20} color={selected ? Colors.brand : Colors.textSecondary} />
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  multiline,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        style={[
          styles.input,
          multiline && styles.textArea,
          error && styles.inputError,
          focused && !error && styles.inputFocused,
          style,
        ]}
        onFocus={event => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={Colors.textTertiary}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Date field with matching behaviour on native and web: a native TextInput
 * with a masked placeholder, and a real `<input type="date">` on the PWA so
 * the browser's native date picker is available. Never rejects a partial
 * value — required-ness is validated elsewhere (lib/verification/validation).
 */
export function InlineDateField({
  label,
  value,
  onChange,
  error,
  hint,
  min,
  max,
  disabled = false,
  accessibilityLabel,
  testID,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => monthFromIso(value));
  const today = getTodayIso();

  useEffect(() => {
    if (calendarVisible) setDisplayMonth(monthFromIso(value));
  }, [calendarVisible, value]);

  const selectDate = (nextValue: string) => {
    onChange(nextValue);
    setCalendarVisible(false);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint="Abre o calendário para selecionar uma data"
        accessibilityState={{ disabled }}
        testID={testID}
        disabled={disabled}
        onPress={() => setCalendarVisible(true)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          styles.dateTrigger,
          error && styles.inputError,
          focused && !error && styles.inputFocused,
          pressed && styles.dateTriggerPressed,
          disabled && styles.dateTriggerDisabled,
        ]}
      >
        <Text style={[styles.dateTriggerText, !isIsoDate(value) && styles.dateTriggerPlaceholder]}>
          {formatDate(value)}
        </Text>
        <CalendarDays size={18} color={disabled ? Colors.textTertiary : Colors.brand} strokeWidth={2} />
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <ModalSheet visible={calendarVisible} onClose={() => setCalendarVisible(false)} title={label}>
        <View style={styles.calendar}>
          <View style={styles.calendarMonthHeader}>
            <IconButton
              label="Mês anterior"
              onPress={() => setDisplayMonth(current => shiftMonth(current, -1))}
              Icon={ChevronLeft}
            />
            <Text accessibilityRole="header" style={styles.calendarMonthTitle}>{formatMonth(displayMonth)}</Text>
            <IconButton
              label="Próximo mês"
              onPress={() => setDisplayMonth(current => shiftMonth(current, 1))}
              Icon={ChevronRight}
            />
          </View>
          <View style={styles.calendarWeek}>
            {WEEKDAY_LABELS.map((weekday, index) => <Text key={`${weekday}-${index}`} style={styles.calendarWeekday}>{weekday}</Text>)}
          </View>
          <View style={styles.calendarGrid}>
            {getMonthDays(displayMonth).map((cell, index) => {
              if (!cell) return <View key={`empty-${index}`} style={styles.calendarDay} />;
              const selected = cell.iso === value;
              const isToday = cell.iso === today;
              const available = isDateWithinRange(cell.iso, min, max);
              return (
                <Pressable
                  key={cell.iso}
                  accessibilityRole="button"
                  accessibilityLabel={formatDateAccessibility(cell.iso)}
                  accessibilityState={{ selected, disabled: !available }}
                  disabled={!available}
                  onPress={() => selectDate(cell.iso)}
                  style={({ pressed }) => [
                    styles.calendarDay,
                    isToday && !selected && styles.calendarDayToday,
                    selected && styles.calendarDaySelected,
                    pressed && available && styles.calendarDayPressed,
                    !available && styles.calendarDayDisabled,
                  ]}
                >
                  <Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected, !available && styles.calendarDayTextDisabled]}>{cell.day}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.calendarActions}>
            <Button
              label="Hoje"
              variant="secondary"
              onPress={() => selectDate(today)}
              disabled={!isDateWithinRange(today, min, max)}
              style={styles.calendarAction}
            />
            <Button label="Limpar" variant="ghost" onPress={() => selectDate('')} style={styles.calendarAction} />
          </View>
        </View>
      </ModalSheet>
    </View>
  );
}

export interface SelectOption {
  id: string;
  label: string;
  /** Secondary line under the option — revision number, team type, etc. */
  meta?: string;
}

/**
 * Single-choice field for lists that can grow past a handful of entries.
 * The trigger states the current choice on one 64px line; the options open in
 * a `ModalSheet` with a search box and their own scroll, so a tenant with
 * eighty obras never turns the form into an endless column of radio buttons.
 *
 * `locked` is for a value fixed by upstream data (a medição that already names
 * the obra): the row still reads the value, but as a confirmation rather than
 * a control.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  Icon = ListFilter,
  placeholder = 'Selecionar',
  hint,
  emptyText = 'Nenhuma opção disponível.',
  searchThreshold = 6,
  locked = false,
  lockedLabel = 'Fixo',
  disabled = false,
  error,
  modalTitle,
  modalDescription,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (id: string) => void;
  Icon?: LucideIcon;
  placeholder?: string;
  hint?: string;
  emptyText?: string;
  /** Show the search box once the list is at least this long. */
  searchThreshold?: number;
  locked?: boolean;
  lockedLabel?: string;
  disabled?: boolean;
  error?: string;
  modalTitle?: string;
  modalDescription?: string;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find(option => option.id === value);
  const inert = locked || disabled || options.length === 0;
  const normalizedSearch = normalizeText(search);
  const filtered = normalizedSearch
    ? options.filter(option => normalizeText(`${option.label} ${option.meta ?? ''}`).includes(normalizedSearch))
    : options;

  const openPicker = () => {
    setSearch('');
    setOpen(true);
  };

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (selected ? `${label}: ${selected.label}` : `Selecionar ${label.toLowerCase()}`)}
        accessibilityHint={inert ? undefined : `Abre a lista de opções de ${label.toLowerCase()}`}
        accessibilityState={{ disabled: inert, expanded: open }}
        disabled={inert}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.selectTrigger,
          selected && !locked && styles.selectTriggerSelected,
          locked && styles.selectTriggerLocked,
          error && styles.selectTriggerError,
          pressed && !inert && styles.selectTriggerPressed,
        ]}
      >
        <View style={[styles.selectDatum, locked && styles.selectDatumLocked]} />
        <View style={styles.selectIcon}>
          <Icon size={19} color={locked ? Colors.textSecondary : selected ? Colors.brand : Colors.textSecondary} strokeWidth={2} />
        </View>
        <View style={styles.selectBody}>
          <Text numberOfLines={1} style={[styles.selectValue, !selected && styles.selectPlaceholder]}>
            {selected?.label ?? (options.length ? placeholder : emptyText)}
          </Text>
          {selected?.meta || hint ? (
            <Text numberOfLines={1} style={styles.selectMeta}>{selected?.meta ?? hint}</Text>
          ) : null}
        </View>
        {locked ? (
          <Badge tone="neutral" size="sm" label={lockedLabel} Icon={LockKeyhole} />
        ) : (
          <>
            {selected ? <Check size={19} color={Colors.ok} strokeWidth={2.4} /> : null}
            {options.length ? <ChevronDown size={18} color={Colors.textSecondary} /> : null}
          </>
        )}
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}

      <ModalSheet visible={open} onClose={() => setOpen(false)} title={modalTitle ?? label}>
        <View style={styles.selectSheet}>
          <Text style={styles.selectSheetDescription}>
            {modalDescription ?? `${options.length} ${options.length === 1 ? 'opção disponível' : 'opções disponíveis'}.`}
          </Text>
          {options.length >= searchThreshold ? (
            <View style={styles.selectSearch}>
              <Search size={18} color={Colors.textSecondary} />
              <TextInput
                accessibilityLabel={`Buscar ${label.toLowerCase()}`}
                value={search}
                onChangeText={setSearch}
                placeholder={`Buscar ${label.toLowerCase()}`}
                placeholderTextColor={Colors.textTertiary}
                style={styles.selectSearchInput}
              />
              {search ? <IconButton label="Limpar busca" Icon={X} onPress={() => setSearch('')} /> : null}
            </View>
          ) : null}
          <ScrollView style={styles.selectList} contentContainerStyle={styles.selectListContent} keyboardShouldPersistTaps="handled">
            {filtered.map(option => {
              const isSelected = option.id === value;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => choose(option.id)}
                  style={({ pressed }) => [
                    styles.selectOption,
                    isSelected && styles.selectOptionSelected,
                    pressed && !isSelected && styles.selectOptionPressed,
                  ]}
                >
                  <View style={styles.selectOptionBody}>
                    <Text numberOfLines={2} style={styles.selectOptionLabel}>{option.label}</Text>
                    {option.meta ? <Text numberOfLines={1} style={styles.selectOptionMeta}>{option.meta}</Text> : null}
                  </View>
                  {isSelected
                    ? <Check size={19} color={Colors.ok} strokeWidth={2.4} />
                    : <ChevronRight size={18} color={Colors.textTertiary} />}
                </Pressable>
              );
            })}
            {!filtered.length ? (
              <View style={styles.selectEmpty}>
                <Text style={styles.selectEmptyTitle}>Nenhum resultado</Text>
                <Text style={styles.selectEmptyText}>
                  {options.length ? 'Ajuste a busca para ver outras opções.' : emptyText}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </ModalSheet>
    </View>
  );
}

/** Accent-insensitive comparison key for search boxes. */
function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Single evidence photo slot (reinspection photo, NC photo). Receives an
 * already-resolved URI — callers stay responsible for private-media
 * resolution (usePrivateMediaUris) and stripping the 'pending:' prefix, so
 * media handling does not shift when screens adopt this primitive.
 */
export function PhotoSlot({
  uri,
  onPress,
  onRemove,
  label,
  height = 140,
  required = false,
  error,
  pending = false,
  accessibilityLabel,
}: {
  uri?: string | null;
  onPress: () => void;
  onRemove?: () => void;
  label: string;
  height?: number;
  required?: boolean;
  error?: string;
  pending?: boolean;
  accessibilityLabel: string;
}) {
  if (uri) {
    return (
      <View style={[styles.photoSlotFilled, { height }]}>
        <Image source={{ uri }} style={styles.photoSlotImage} resizeMode="cover" />
        {pending ? <View style={styles.photoSlotPendingDot} /> : null}
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remover foto"
            onPress={onRemove}
            hitSlop={8}
            style={styles.photoSlotRemove}
          >
            <X size={14} color={Colors.surface} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.photoSlotEmpty,
        { height },
        error && styles.photoSlotError,
        pressed && styles.photoSlotEmptyPressed,
      ]}
    >
      <Camera size={22} color={error ? Colors.nok : Colors.brand} strokeWidth={2.2} />
      <Text style={[styles.photoSlotLabel, error && styles.photoSlotLabelError]}>
        {label}{required ? ' *' : ''}
      </Text>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </Pressable>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: { value: T; label: string; Icon?: LucideIcon }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={styles.segmented}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map(option => {
        const selected = option.value === value;
        const Icon = option.Icon;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.segmentPressed,
            ]}
          >
            {Icon ? <Icon size={16} color={selected ? Colors.brand : Colors.textSecondary} /> : null}
            <Text numberOfLines={1} style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type ChoiceToggleTone = 'success' | 'danger' | 'neutral' | 'brand';

export interface ChoiceToggleOption<T extends string> {
  value: T;
  label: string;
  tone: ChoiceToggleTone;
  accessibilityLabel?: string;
  /** Circle glyph: outline while unchosen, solid-filled once chosen. */
  Icon?: LucideIcon;
}

/**
 * Joined 2–3 position answer control. One control with N positions rather than
 * N separate buttons, and every position takes an equal share of the width so
 * no answer is harder to hit than another — the previous 1.55 / 1.15 / 64px
 * split left N/A with less than half the target area of Conforme.
 *
 * The chosen position carries three signals at once: the soft tint, a 1.5px
 * semantic ring, and a solid-filled glyph where the others are outlines. The
 * fill is what survives direct sunlight and still reads in greyscale; the tint
 * alone is roughly a 4% luminance step and vanishes on site. Icon over label
 * buys the height for a 56px target without a second row of controls.
 *
 * `locked` is disabled visually and for a11y, but still announced as radios so
 * screen readers say why it can't be changed.
 *
 * `ResultToggle` (FVS checklist) and the contractor evaluation's Atende/Não
 * atende control are both thin configurations of this component.
 */
export function ChoiceToggle<T extends string>({
  value,
  options,
  onChange,
  locked = false,
  error,
  accessibilityLabel,
  style,
}: {
  value?: T;
  options: readonly ChoiceToggleOption<T>[];
  onChange: (value: T) => void;
  locked?: boolean;
  error?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const answered = !!value;
  return (
    <View style={style}>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      <View
        style={[styles.resultToggle, locked && styles.resultToggleLocked, error && styles.resultToggleError]}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        pointerEvents={locked ? 'none' : 'auto'}
      >
        {options.map((option, index) => {
          const selected = value === option.value;
          const palette = choiceTogglePalette[option.tone];
          const Icon = option.Icon;
          const tint = selected
            ? palette.text
            : answered
              ? Colors.textTertiary
              : Colors.textSecondary;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              accessibilityState={{ checked: selected, disabled: locked }}
              disabled={locked}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.resultToggleOption,
                index > 0 && !selected && styles.resultToggleDivider,
                selected && { backgroundColor: palette.background },
                pressed && !selected && styles.resultToggleOptionPressed,
              ]}
            >
              {Icon ? (
                <Icon
                  size={22}
                  color={selected ? Colors.surface : tint}
                  fill={selected ? palette.text : 'transparent'}
                  strokeWidth={selected ? 2.4 : 2}
                />
              ) : null}
              <Text numberOfLines={1} style={[styles.resultToggleText, { color: tint }]}>
                {option.label}
              </Text>
              {selected ? (
                <View
                  pointerEvents="none"
                  style={[styles.resultToggleRing, { borderColor: palette.border }]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export type ResultToggleValue = 'conforme' | 'nao_conforme' | 'na';

const resultToggleOptions: readonly ChoiceToggleOption<ResultToggleValue>[] = [
  // Equal thirds. N/A used to be a 64px mono token with no glyph — the smallest
  // target and the only one without a non-textual cue, which is the worst
  // combination for a gloved hand.
  { value: 'conforme', label: 'Conforme', tone: 'success', Icon: CheckCircle2 },
  { value: 'nao_conforme', label: 'Não conforme', tone: 'danger', Icon: XCircle },
  { value: 'na', label: 'Não se aplica', tone: 'neutral', accessibilityLabel: 'Não aplicável', Icon: MinusCircle },
];

/** Tri-state checklist result control (conforme/não conforme/N/A). */
export function ResultToggle({
  value,
  onChange,
  locked = false,
  error,
  accessibilityLabel,
  style,
}: {
  value?: ResultToggleValue;
  onChange: (value: ResultToggleValue) => void;
  locked?: boolean;
  error?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ChoiceToggle
      value={value}
      options={resultToggleOptions}
      onChange={onChange}
      locked={locked}
      error={error}
      accessibilityLabel={accessibilityLabel}
      style={style}
    />
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  Icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  Icon?: LucideIcon;
}) {
  const content = (
    <>
      {Icon ? <Icon size={14} color={selected ? Colors.brand : Colors.textSecondary} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={[styles.chip, selected && styles.chipSelected]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.72 },
      ]}
    >
      {content}
    </Pressable>
  );
}

export function Stepper<T extends string>({
  steps,
  current,
}: {
  steps: readonly { key: T; label: string }[];
  current: T;
}) {
  const currentIndex = Math.max(0, steps.findIndex(step => step.key === current));
  return (
    <View
      style={styles.stepper}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: steps.length, now: currentIndex + 1 }}
    >
      {steps.map((step, index) => {
        const active = index === currentIndex;
        const done = index < currentIndex;
        return (
          <View key={step.key} style={styles.stepItem}>
            <View style={[styles.stepDot, (active || done) && styles.stepDotActive]}>
              {done ? (
                <Check size={14} color={Colors.surface} strokeWidth={2.6} />
              ) : (
                <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.stepLabel, active && styles.stepLabelActive]}
            >
              {step.label}
            </Text>
            {index < steps.length - 1 ? (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function BottomActionBar({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  primaryLoading,
  primaryDisabled,
  helper,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  helper?: string;
}) {
  return (
    <View style={styles.actionBar}>
      <View style={styles.actionBarInner}>
        {helper ? <Text style={styles.actionHelper}>{helper}</Text> : null}
        <View style={styles.actionButtons}>
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} onPress={onSecondary} variant="secondary" />
          ) : null}
          <View style={styles.actionPrimary}>
            <Button
              label={primaryLabel}
              onPress={onPrimary}
              loading={primaryLoading}
              disabled={primaryDisabled}
              fullWidth
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  description,
  Icon,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  Icon: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon size={24} color={Colors.textSecondary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <AlertCircle size={18} color={Colors.nok} strokeWidth={2.3} />
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View accessibilityLabel="Carregando" style={[styles.skeleton, style]} />;
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/**
 * Small semantic status primitive. It always renders an icon when supplied,
 * keeping status meaning available to colour-blind users and screen readers.
 */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';

export function Badge({
  label,
  tone = 'neutral',
  Icon,
  size = 'md',
  accessibilityLabel,
}: {
  label: string;
  tone?: BadgeTone;
  Icon?: LucideIcon;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
}) {
  const palette = badgePalette[tone];
  const small = size === 'sm';
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.badge, { backgroundColor: palette.background, borderColor: palette.border }, small && styles.badgeSm]}
    >
      {Icon ? <Icon size={small ? 13 : 14} color={palette.text} strokeWidth={2.3} /> : null}
      <Text style={[styles.badgeText, { color: palette.text }, small && styles.badgeTextSm]}>{label}</Text>
    </View>
  );
}

/** A compact progress indicator shared by dashboard cards and the checklist. */
export function Progress({
  value,
  label,
  tone = 'brand',
  height = 6,
  showValue = false,
}: {
  value: number;
  label?: string;
  tone?: BadgeTone;
  height?: number;
  showValue?: boolean;
}) {
  const bounded = Math.min(100, Math.max(0, value));
  const color = progressPalette[tone];
  return (
    <View style={styles.progressRow} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: bounded }}>
      {label ? <Text style={styles.progressLabel}>{label}</Text> : null}
      <View style={[styles.progressTrack, { height }]}>
        <View style={[styles.progressFill, { width: `${bounded}%` as `${number}%`, height, backgroundColor: color }]} />
      </View>
      {showValue ? <Text style={styles.progressValue}>{Math.round(bounded)}%</Text> : null}
    </View>
  );
}

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error';

/** Connection state with icon, text and colour (never colour-only). */
export function SyncIndicator({
  state,
  label,
  compact = false,
}: {
  state: SyncState;
  label?: string;
  compact?: boolean;
}) {
  const config = syncConfig[state];
  const Icon = config.Icon;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ?? config.label}
      style={[styles.sync, compact && styles.syncCompact, { backgroundColor: config.background }]}
    >
      <Icon size={compact ? 14 : 16} color={config.color} strokeWidth={2.2} />
      {!compact ? <Text style={[styles.syncText, { color: config.color }]}>{label ?? config.label}</Text> : null}
    </View>
  );
}

/** Native modal/sheet shell. Platform-specific presentation details stay in
 * one component while the content remains shared by the PWA and native apps. */
export function ModalSheet({
  visible,
  onClose,
  title,
  children,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <NativeModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={styles.modalHeader}>
            {title ? <Text style={styles.modalTitle}>{title}</Text> : <View />}
            <IconButton label="Fechar" onPress={onClose} Icon={X} />
          </View>
          <View style={styles.modalContent}>{children}</View>
          {actions ? <View style={styles.modalActions}>{actions}</View> : null}
        </View>
      </View>
    </NativeModal>
  );
}

export type ToastTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

export function Toast({
  message,
  tone = 'neutral',
  visible = true,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  tone?: ToastTone;
  visible?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  if (!visible) return null;
  const config = toastPalette[tone];
  const Icon = config.Icon;
  return (
    <View accessible accessibilityRole="alert" style={[styles.toast, { backgroundColor: config.background, borderColor: config.border }]}>
      <Icon size={18} color={config.color} strokeWidth={2.2} />
      <Text style={[styles.toastText, { color: config.color }]}>{message}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="ghost" style={styles.toastAction} /> : null}
      {onDismiss ? <IconButton label="Fechar aviso" onPress={onDismiss} Icon={X} /> : null}
    </View>
  );
}

const badgePalette: Record<BadgeTone, { background: string; border: string; text: string }> = {
  neutral: { background: Colors.surface2, border: Colors.border, text: Colors.textSecondary },
  brand: { background: Colors.brandLight, border: Colors.brandSignature, text: Colors.brand },
  success: { background: Colors.okBg, border: Colors.ok, text: Colors.ok },
  danger: { background: Colors.nokBg, border: Colors.nok, text: Colors.nok },
  warning: { background: Colors.warnBg, border: Colors.warn, text: Colors.warn },
  info: { background: Colors.infoBg, border: Colors.info, text: Colors.info },
};

const choiceTogglePalette: Record<ChoiceToggleTone, { background: string; border: string; text: string }> = {
  success: { background: Colors.okBg, border: Colors.ok, text: Colors.ok },
  danger: { background: Colors.nokBg, border: Colors.nok, text: Colors.nok },
  neutral: { background: Colors.naBg, border: Colors.na, text: Colors.na },
  brand: { background: Colors.brandLight, border: Colors.brandSignature, text: Colors.brand },
};

const progressPalette: Record<BadgeTone, string> = {
  neutral: Colors.na,
  brand: Colors.brand,
  success: Colors.ok,
  danger: Colors.nok,
  warning: Colors.warn,
  info: Colors.info,
};

const syncConfig: Record<SyncState, { color: string; background: string; label: string; Icon: LucideIcon }> = {
  synced: { color: Colors.ok, background: Colors.okBg, label: 'Sincronizado', Icon: CheckCircle2 },
  syncing: { color: Colors.info, background: Colors.infoBg, label: 'Sincronizando…', Icon: RefreshCw },
  offline: { color: Colors.warn, background: Colors.warnBg, label: 'Offline — salvo neste dispositivo', Icon: WifiOff },
  error: { color: Colors.nok, background: Colors.nokBg, label: 'Falha na sincronização', Icon: AlertCircle },
};

// Keep the labels in source ASCII so the same bundle renders correctly on all
// terminals/build agents regardless of their default code page.
Object.assign(syncConfig, {
  syncing: { color: Colors.info, background: Colors.infoBg, label: 'Sincronizando\u2026', Icon: RefreshCw },
  offline: { color: Colors.warn, background: Colors.warnBg, label: 'Offline \u2014 salvo neste dispositivo', Icon: WifiOff },
  error: { color: Colors.nok, background: Colors.nokBg, label: 'Falha na sincroniza\u00e7\u00e3o', Icon: AlertCircle },
});

const toastPalette: Record<ToastTone, { color: string; background: string; border: string; Icon: LucideIcon }> = {
  neutral: { color: Colors.text, background: Colors.surface, border: Colors.border, Icon: AlertCircle },
  success: { color: Colors.ok, background: Colors.okBg, border: Colors.ok, Icon: CheckCircle2 },
  danger: { color: Colors.nok, background: Colors.nokBg, border: Colors.nok, Icon: AlertCircle },
  warning: { color: Colors.warn, background: Colors.warnBg, border: Colors.warn, Icon: AlertCircle },
  info: { color: Colors.info, background: Colors.infoBg, border: Colors.info, Icon: AlertCircle },
};

const cardTone: Record<string, ViewStyle> = {
  default: {},
  soft: { backgroundColor: Colors.surface2 },
  accent: { backgroundColor: Colors.brandLight, borderColor: Colors.brandSignature },
  danger: { backgroundColor: Colors.nokBg, borderColor: Colors.nok },
  success: { backgroundColor: Colors.okBg, borderColor: Colors.ok },
};

const datumPalette: Record<DatumTone, string> = {
  accent: Colors.brandSignature,
  neutral: Colors.borderNormal,
  brand: Colors.brand,
  success: Colors.ok,
  danger: Colors.nok,
  warning: Colors.warn,
  info: Colors.info,
};

const metricPalette: Record<BadgeTone, string> = {
  neutral: Colors.text,
  brand: Colors.brand,
  success: Colors.ok,
  danger: Colors.nok,
  warning: Colors.warn,
  info: Colors.info,
};

const buttonPalette: Record<ButtonVariant, { background: string; pressed: string; border: string; text: string }> = {
  primary: { background: Colors.brand, pressed: Colors.brandDark, border: Colors.brand, text: '#FFFFFF' },
  secondary: { background: Colors.surface, pressed: Colors.surface2, border: Colors.borderNormal, text: Colors.text },
  ghost: { background: 'transparent', pressed: Colors.surface2, border: 'transparent', text: Colors.textSecondary },
  danger: { background: Colors.nok, pressed: Colors.text, border: Colors.nok, text: Colors.surface },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  screenContent: { width: '100%', alignSelf: 'center' },
  container: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
  },
  containerNarrow: { maxWidth: Breakpoints.maxForm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Elevation.card,
  },
  datumCard: {
    minHeight: ComponentSize.touch,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  datumCardPressed: {
    backgroundColor: Colors.surface2,
    borderColor: Colors.borderNormal,
  },
  datumLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  datumContent: {
    flex: 1,
    padding: Spacing.lg,
    paddingLeft: Spacing.lg + 3,
  },
  listSurface: {
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  operationalRow: {
    minHeight: 84,
    position: 'relative',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.lg + 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
  },
  operationalRowPressed: { backgroundColor: Colors.surface2 },
  operationalDatum: {
    position: 'absolute',
    top: Spacing.md,
    bottom: Spacing.md,
    left: 0,
    width: 3,
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
  },
  operationalLeading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  operationalBody: {
    flex: 1,
    minWidth: 0,
  },
  operationalTrailing: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  operationalSeparator: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 0,
    left: Spacing.lg + 3,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  metricBlock: {
    minWidth: 88,
    gap: 3,
  },
  metricLabel: {
    ...Typography.overline,
    color: Colors.textTertiary,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValue: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: FontSizes.xxl,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  metricSuffix: {
    fontFamily: FontFamily.mono,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },
  button: {
    minHeight: ComponentSize.button,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  focusVisible: {
    borderColor: Colors.focus,
    shadowColor: Colors.focus,
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  buttonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.md,
    lineHeight: 20,
  },
  iconButton: {
    width: ComponentSize.touch,
    height: ComponentSize.touch,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSelected: { backgroundColor: Colors.brandLight },
  iconButtonPressed: { backgroundColor: Colors.surface2 },
  field: { gap: 6 },
  fieldLabel: { ...Typography.label, color: Colors.text },
  input: {
    minHeight: ComponentSize.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.md,
  },
  inputFocused: {
    borderColor: Colors.focus,
    borderWidth: 2,
    shadowColor: Colors.focus,
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  dateTrigger: {
    minHeight: ComponentSize.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  dateTriggerPressed: { backgroundColor: Colors.surface2 },
  dateTriggerDisabled: { opacity: 0.55 },
  dateTriggerText: { ...Typography.body, color: Colors.text, fontFamily: FontFamily.mono },
  dateTriggerPlaceholder: { color: Colors.textTertiary, fontFamily: FontFamily.regular },
  calendar: { gap: Spacing.md },
  calendarMonthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarMonthTitle: { ...Typography.label, color: Colors.text, textTransform: 'capitalize' },
  calendarWeek: { flexDirection: 'row' },
  calendarWeekday: { width: `${100 / 7}%`, textAlign: 'center', ...Typography.caption, color: Colors.textTertiary, fontFamily: FontFamily.semibold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.xs },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    maxHeight: ComponentSize.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  calendarDayToday: { borderWidth: 1, borderColor: Colors.brandSignature },
  calendarDaySelected: { backgroundColor: Colors.brand },
  calendarDayPressed: { backgroundColor: Colors.brandLight },
  calendarDayDisabled: { opacity: 0.35 },
  calendarDayText: { ...Typography.caption, color: Colors.text, fontFamily: FontFamily.medium },
  calendarDayTextSelected: { color: Colors.surface, fontFamily: FontFamily.semibold },
  calendarDayTextDisabled: { color: Colors.textTertiary },
  calendarActions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.xs },
  calendarAction: { flex: 1 },
  selectTrigger: {
    minHeight: 64,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectTriggerSelected: { borderColor: Colors.brandSignature, backgroundColor: Colors.brandLight },
  // A locked value is data, not a control: it drops the lime datum and the
  // affordances so it stops competing with the fields the user can still set.
  selectTriggerLocked: { backgroundColor: Colors.surface2, borderColor: Colors.border },
  selectTriggerError: { borderColor: Colors.nok, borderWidth: 1.5 },
  selectTriggerPressed: { backgroundColor: Colors.surface2 },
  selectDatum: {
    position: 'absolute',
    width: 3,
    left: 0,
    top: Spacing.sm,
    bottom: Spacing.sm,
    backgroundColor: Colors.brandSignature,
  },
  selectDatumLocked: { backgroundColor: Colors.borderNormal },
  selectIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  selectBody: { flex: 1, minWidth: 0, gap: 1 },
  selectValue: { ...Typography.label, color: Colors.text },
  selectPlaceholder: { color: Colors.brand },
  selectMeta: { ...Typography.caption, color: Colors.textSecondary },
  selectSheet: { gap: Spacing.md },
  selectSheetDescription: { ...Typography.caption, color: Colors.textSecondary },
  selectSearch: {
    minHeight: ComponentSize.input,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    borderRadius: Radius.md,
    paddingLeft: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectSearchInput: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    color: Colors.text,
    fontFamily: FontFamily.regular,
    fontSize: FontSizes.md,
  },
  selectList: { maxHeight: 360 },
  selectListContent: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden' },
  selectOption: {
    minHeight: 60,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  selectOptionSelected: { backgroundColor: Colors.brandLight },
  selectOptionPressed: { backgroundColor: Colors.surface2 },
  selectOptionBody: { flex: 1, minWidth: 0, gap: 1 },
  selectOptionLabel: { ...Typography.label, color: Colors.text },
  selectOptionMeta: { ...Typography.caption, color: Colors.textSecondary },
  selectEmpty: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
    backgroundColor: Colors.surface2,
  },
  selectEmptyTitle: { ...Typography.label, color: Colors.text },
  selectEmptyText: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
  textArea: { minHeight: 112, textAlignVertical: 'top' },
  inputError: { borderColor: Colors.nok, borderWidth: 1.5 },
  fieldError: { ...Typography.caption, color: Colors.nok },
  fieldHint: { ...Typography.caption, color: Colors.textSecondary },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface2,
    gap: 4,
  },
  segment: {
    minHeight: ComponentSize.touch,
    flex: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentSelected: { backgroundColor: Colors.surface, ...Elevation.card },
  segmentPressed: { backgroundColor: Colors.border },
  segmentText: { ...Typography.caption, color: Colors.textSecondary, fontFamily: FontFamily.medium },
  segmentTextSelected: { color: Colors.brand, fontFamily: FontFamily.semibold },
  chip: {
    minHeight: ComponentSize.touch,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipSelected: { backgroundColor: Colors.brandLight, borderColor: Colors.brandSignature },
  chipText: { ...Typography.caption, color: Colors.textSecondary, fontFamily: FontFamily.medium },
  chipTextSelected: { color: Colors.brand, fontFamily: FontFamily.semibold },
  stepper: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
  },
  stepItem: { flex: 1, alignItems: 'center', position: 'relative', gap: 5 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  stepDotActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  stepNumber: { fontFamily: FontFamily.semibold, fontSize: FontSizes.tiny, color: Colors.textSecondary },
  stepNumberActive: { color: Colors.surface },
  stepLabel: { ...Typography.caption, color: Colors.textTertiary, maxWidth: 92 },
  stepLabelActive: { color: Colors.text, fontFamily: FontFamily.semibold },
  stepLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: Colors.border,
    left: '50%',
    right: '-50%',
    top: 13,
  },
  stepLineDone: { backgroundColor: Colors.brand },
  actionBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    ...Elevation.floating,
  },
  actionBarInner: {
    width: '100%',
    maxWidth: Breakpoints.maxContent,
    alignSelf: 'center',
    gap: Spacing.sm,
  },
  actionButtons: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  actionPrimary: { flex: 1, maxWidth: 360 },
  actionHelper: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: Spacing.xxl, gap: Spacing.sm },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: { ...Typography.heading, color: Colors.text, textAlign: 'center' },
  emptyDescription: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', maxWidth: 420 },
  errorBanner: {
    borderRadius: Radius.md,
    backgroundColor: Colors.nokBg,
    borderWidth: 1,
    borderColor: Colors.nok,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  errorBannerText: { ...Typography.caption, color: Colors.nok, fontFamily: FontFamily.medium, flex: 1 },
  skeleton: { minHeight: 18, backgroundColor: Colors.surface2, borderRadius: Radius.sm },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sectionHeadingText: { flex: 1, gap: 3 },
  eyebrow: {
    ...Typography.caption,
    color: Colors.brand,
    fontFamily: FontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitle: { ...Typography.heading, color: Colors.text },
  sectionDescription: { ...Typography.body, color: Colors.textSecondary },
  badge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  badgeSm: { minHeight: 24, paddingHorizontal: Spacing.sm - 2 },
  badgeText: { ...Typography.caption, fontFamily: FontFamily.semibold },
  badgeTextSm: { fontSize: FontSizes.tiny, lineHeight: 16 },
  progressRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressLabel: { ...Typography.caption, color: Colors.textSecondary, minWidth: 68 },
  progressTrack: {
    flex: 1,
    minWidth: 40,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: Colors.surface2,
  },
  progressFill: { borderRadius: Radius.full, minWidth: 0 },
  progressValue: {
    ...Typography.caption,
    fontFamily: FontFamily.mono,
    color: Colors.textSecondary,
    minWidth: 34,
    textAlign: 'right',
  },
  sync: {
    minHeight: 28,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
  },
  syncCompact: { width: 28, height: 28, paddingHorizontal: 0, justifyContent: 'center' },
  syncText: { ...Typography.caption, fontFamily: FontFamily.medium },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: Breakpoints.maxForm,
    maxHeight: '90%',
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Elevation.floating,
  },
  modalHeader: {
    minHeight: 60,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  modalTitle: { ...Typography.heading, color: Colors.text, flex: 1 },
  modalContent: { padding: Spacing.lg },
  modalActions: { padding: Spacing.lg, paddingTop: 0, gap: Spacing.sm },
  toast: {
    width: '100%',
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Elevation.floating,
  },
  toastText: { ...Typography.bodyMedium, flex: 1 },
  toastAction: { minHeight: 36, paddingHorizontal: Spacing.sm, borderWidth: 0 },
  dataRow: {
    minHeight: ComponentSize.touch,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  dataRowStack: { alignItems: 'flex-start' },
  dataRowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  dataRowPressed: { backgroundColor: Colors.surface2 },
  dataRowLeading: { alignItems: 'center', justifyContent: 'center' },
  dataRowBody: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  dataRowBodyStack: { flexDirection: 'column', alignItems: 'flex-start', gap: 3 },
  dataRowLabelRow: { ...Typography.caption, color: Colors.textSecondary },
  dataRowLabelStack: { ...Typography.overline, color: Colors.textTertiary },
  dataRowValueRow: { ...Typography.bodyMedium, color: Colors.text, flexShrink: 1, textAlign: 'right' },
  dataRowValueStack: { ...Typography.bodyMedium, color: Colors.text },
  dataRowValueStrong: { fontFamily: FontFamily.semibold },
  dataRowValueMono: { fontFamily: FontFamily.mono },
  dataRowValueNodeRow: { alignItems: 'flex-end' },
  dataRowValueNodeStack: { alignItems: 'flex-start', marginTop: 2 },
  dataRowTrailing: { alignItems: 'center', justifyContent: 'center' },
  resultToggle: {
    flexDirection: 'row',
    minHeight: ComponentSize.choice,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  resultToggleLocked: { opacity: 0.6 },
  resultToggleError: { borderColor: Colors.nok, borderWidth: 1.5 },
  resultToggleOption: {
    position: 'relative',
    flex: 1,
    minHeight: ComponentSize.choice - 2,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: Spacing.xs,
  },
  resultToggleDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.borderNormal,
  },
  resultToggleOptionPressed: { backgroundColor: Colors.surface2 },
  // Drawn inside the option rather than as a border on it: the joined control
  // clips to its own radius, so an inset ring survives at the outer corners.
  resultToggleRing: { ...StyleSheet.absoluteFillObject, borderWidth: 1.5 },
  resultToggleText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.tiny,
    lineHeight: 16,
  },
  // Neutral by default: Cal Viva is reserved for focus, selection and the
  // signature, and a lime block here would outshout the state of the form it
  // sits in. The error state below is what earns colour.
  photoSlotEmpty: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderNormal,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  photoSlotEmptyPressed: { opacity: 0.85 },
  photoSlotError: { borderColor: Colors.nok, backgroundColor: Colors.nokBg },
  photoSlotLabel: { ...Typography.label, color: Colors.brand, textAlign: 'center' },
  photoSlotLabelError: { color: Colors.nok },
  photoSlotFilled: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.surface2,
  },
  photoSlotImage: { width: '100%', height: '100%' },
  photoSlotRemove: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlotPendingDot: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: Spacing.xs,
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.warn,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
});
