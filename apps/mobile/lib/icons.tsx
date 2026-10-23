/**
 * Ícones do PWA: pacote Seixo (identidade Trena Suave).
 *
 * Todas as telas importam daqui, nunca direto de 'lucide-react-native'.
 * - Os ícones mais visíveis (menu, obra, NC, sync, prazos, setas, prumo) são
 *   desenhados para o app numa grade de 24: traço 1,8, pontas e junções
 *   arredondadas, cantos internos com raio 1,5.
 * - Os demais vêm do Lucide com o mesmo acabamento (traço 1,8, pontas redondas).
 * A API é a do Lucide (size, color, strokeWidth, fill...), então trocar um
 * ícone entre os dois grupos não muda as telas.
 */
import { forwardRef, type ComponentType } from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  AlertCircle as LucideAlertCircle,
  BadgeCheck as LucideBadgeCheck,
  CalendarClock as LucideCalendarClock,
  CalendarX as LucideCalendarX,
  CheckCircle2 as LucideCheckCircle2,
  Circle as LucideCircle,
  CircleAlert as LucideCircleAlert,
  CircleDollarSign as LucideCircleDollarSign,
  ClipboardList as LucideClipboardList,
  CloudUpload as LucideCloudUpload,
  FileClock as LucideFileClock,
  FileDown as LucideFileDown,
  FileQuestion as LucideFileQuestion,
  FileText as LucideFileText,
  Flag as LucideFlag,
  Image as LucideImage,
  Images as LucideImages,
  Key as LucideKey,
  KeyRound as LucideKeyRound,
  Landmark as LucideLandmark,
  Layers3 as LucideLayers3,
  ListChecks as LucideListChecks,
  ListFilter as LucideListFilter,
  LoaderCircle as LucideLoaderCircle,
  LockKeyhole as LucideLockKeyhole,
  Mail as LucideMail,
  MapPin as LucideMapPin,
  MinusCircle as LucideMinusCircle,
  PenLine as LucidePenLine,
  Phone as LucidePhone,
  Printer as LucidePrinter,
  RotateCcw as LucideRotateCcw,
  Save as LucideSave,
  ShieldAlert as LucideShieldAlert,
  ShieldCheck as LucideShieldCheck,
  SlidersHorizontal as LucideSlidersHorizontal,
  Trash2 as LucideTrash2,
  UserRound as LucideUserRound,
  UsersRound as LucideUsersRound,
  WifiOff as LucideWifiOff,
  Wrench as LucideWrench,
  XCircle as LucideXCircle,
  type LucideProps,
} from 'lucide-react-native';

export type IconProps = LucideProps;
export type IconComponent = ComponentType<IconProps>;

/** Traço padrão quando a tela não define um. */
export const ICON_STROKE = 1.8;

const EDGES = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Ícone desenhado para o app, numa grade de 24. */
function drawn(name: string, d: string): IconComponent {
  const Icon = forwardRef<Svg, IconProps>(function DrawnIcon(
    { color = 'currentColor', size = 24, strokeWidth = ICON_STROKE, absoluteStrokeWidth, fill = 'none', children, ...rest },
    ref,
  ) {
    const width = absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth;
    return (
      <Svg ref={ref} width={size} height={size} viewBox="0 0 24 24" {...rest}>
        <Path d={d} fill={fill} stroke={color} strokeWidth={width} {...EDGES} />
        {children}
      </Svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}

/** Ícone do Lucide com o acabamento Seixo (traço 1,8 e pontas redondas). */
function tuned(name: string, Base: ComponentType<IconProps>): IconComponent {
  const Icon = forwardRef<Svg, IconProps>(function TunedIcon(props, ref) {
    // O Lucide repassa as props extras para cada traço do desenho.
    const BaseWithRef = Base as ComponentType<IconProps & { ref?: unknown }>;
    return <BaseWithRef ref={ref} strokeWidth={ICON_STROKE} {...EDGES} {...props} />;
  });
  Icon.displayName = name;
  return Icon;
}

// Desenhados para o app (Seixo)
export const Plumb = drawn('Plumb', 'M12 2.5v5M8 7.5h8L12 21.5z');
export const Home = drawn('Home', 'M4 10.8L11 5a1.6 1.6 0 0 1 2 0l7 5.8V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z');
export const LayoutGrid = drawn('LayoutGrid', 'M6 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM15 4h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM6 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM15 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z');
export const Building2 = drawn('Building2', 'M5 20V9.8a1.5 1.5 0 0 1 .7-1.3l5.5-3.3a1.5 1.5 0 0 1 1.6 0l5.5 3.3a1.5 1.5 0 0 1 .7 1.3V20M3.5 20h17M10 20v-4.5h4V20M9.5 11h.01M14.5 11h.01');
export const AlertTriangle = drawn('AlertTriangle', 'M10.3 5.2a2 2 0 0 1 3.4 0l6.6 11.3a2 2 0 0 1-1.7 3H5.4a2 2 0 0 1-1.7-3zM12 10v3.5M12 16.4v.1');
export const ClipboardCheck = drawn('ClipboardCheck', 'M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16M9.5 3.5h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zM9 13.5l2 2 4-4');
export const Star = drawn('Star', 'M12 4.5l2.2 4.5 4.9.7-3.5 3.4.8 4.9-4.4-2.3-4.4 2.3.8-4.9-3.5-3.4 4.9-.7z');
export const HardHat = drawn('HardHat', 'M3.5 17.5h17M5.5 17.5V15a6.5 6.5 0 0 1 13 0v2.5M10 8.8V6.5a2 2 0 0 1 4 0v2.3');
export const User = HardHat;
export const RefreshCw = drawn('RefreshCw', 'M19 12a7 7 0 0 1-12.5 4.3M5 12a7 7 0 0 1 12.5-4.3M17.5 4v3.7h-3.7M6.5 20v-3.7h3.7');
export const History = drawn('History', 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3h3M12 8v4l2.5 2.5');
export const Clock3 = drawn('Clock3', 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 8v4.5l3 2');
export const CalendarDays = drawn('CalendarDays', 'M6.5 6h11A1.5 1.5 0 0 1 19 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-11A1.5 1.5 0 0 1 6.5 6zM5 10.5h14M9 4v3.5M15 4v3.5M9 14.5h.01M12 14.5h.01M15 14.5h.01');
export const Camera = drawn('Camera', 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z');
export const Search = drawn('Search', 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.5 16.5L20 20');
export const SquareStack = drawn('SquareStack', 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4');
export const List = drawn('List', 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01');
export const ChevronRight = drawn('ChevronRight', 'M10 6l6 6-6 6');
export const ChevronLeft = drawn('ChevronLeft', 'M14 6l-6 6 6 6');
export const ChevronDown = drawn('ChevronDown', 'M6 10l6 6 6-6');
export const ChevronUp = drawn('ChevronUp', 'M6 14l6-6 6 6');
export const Check = drawn('Check', 'M5 12.5l4.5 4.5L19 7.5');
export const X = drawn('X', 'M7 7l10 10M17 7L7 17');
export const Plus = drawn('Plus', 'M12 5v14M5 12h14');
export const ArrowRight = drawn('ArrowRight', 'M5 12h14M13 6l6 6-6 6');
export const ArrowLeft = drawn('ArrowLeft', 'M19 12H5M11 6l-6 6 6 6');

// Lucide com acabamento Seixo
export const AlertCircle = tuned('AlertCircle', LucideAlertCircle);
export const BadgeCheck = tuned('BadgeCheck', LucideBadgeCheck);
export const CalendarClock = tuned('CalendarClock', LucideCalendarClock);
export const CalendarX = tuned('CalendarX', LucideCalendarX);
export const CheckCircle2 = tuned('CheckCircle2', LucideCheckCircle2);
export const Circle = tuned('Circle', LucideCircle);
export const CircleAlert = tuned('CircleAlert', LucideCircleAlert);
export const CircleDollarSign = tuned('CircleDollarSign', LucideCircleDollarSign);
export const ClipboardList = tuned('ClipboardList', LucideClipboardList);
export const CloudUpload = tuned('CloudUpload', LucideCloudUpload);
export const FileClock = tuned('FileClock', LucideFileClock);
export const FileDown = tuned('FileDown', LucideFileDown);
export const FileQuestion = tuned('FileQuestion', LucideFileQuestion);
export const FileText = tuned('FileText', LucideFileText);
export const Flag = tuned('Flag', LucideFlag);
export const Image = tuned('Image', LucideImage);
export const Images = tuned('Images', LucideImages);
export const Key = tuned('Key', LucideKey);
export const KeyRound = tuned('KeyRound', LucideKeyRound);
export const Landmark = tuned('Landmark', LucideLandmark);
export const Layers3 = tuned('Layers3', LucideLayers3);
export const ListChecks = tuned('ListChecks', LucideListChecks);
export const ListFilter = tuned('ListFilter', LucideListFilter);
export const LoaderCircle = tuned('LoaderCircle', LucideLoaderCircle);
export const LockKeyhole = tuned('LockKeyhole', LucideLockKeyhole);
export const Mail = tuned('Mail', LucideMail);
export const MapPin = tuned('MapPin', LucideMapPin);
export const MinusCircle = tuned('MinusCircle', LucideMinusCircle);
export const PenLine = tuned('PenLine', LucidePenLine);
export const Phone = tuned('Phone', LucidePhone);
export const Printer = tuned('Printer', LucidePrinter);
export const RotateCcw = tuned('RotateCcw', LucideRotateCcw);
export const Save = tuned('Save', LucideSave);
export const ShieldAlert = tuned('ShieldAlert', LucideShieldAlert);
export const ShieldCheck = tuned('ShieldCheck', LucideShieldCheck);
export const SlidersHorizontal = tuned('SlidersHorizontal', LucideSlidersHorizontal);
export const Trash2 = tuned('Trash2', LucideTrash2);
export const UserRound = tuned('UserRound', LucideUserRound);
export const UsersRound = tuned('UsersRound', LucideUsersRound);
export const WifiOff = tuned('WifiOff', LucideWifiOff);
export const Wrench = tuned('Wrench', LucideWrench);
export const XCircle = tuned('XCircle', LucideXCircle);
