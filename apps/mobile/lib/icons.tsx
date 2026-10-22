/**
 * Ícones do PWA na identidade Trena.
 *
 * Todas as telas importam daqui, nunca direto de 'lucide-react-native'.
 * - Os ícones mais visíveis (menu, obra, NC, sync, prazos, setas) são desenhados
 *   para o app: traço reto, cantos vivos, formas de canteiro (capacete no Perfil).
 * - Os demais vêm do Lucide com o mesmo acabamento: traço 2,3 e pontas retas.
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
  History as LucideHistory,
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
  Search as LucideSearch,
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
export const ICON_STROKE = 2.3;

const EDGES = { strokeLinecap: 'square', strokeLinejoin: 'miter' } as const;

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

/** Ícone do Lucide com o acabamento Trena (pontas retas e traço mais firme). */
function tuned(name: string, Base: ComponentType<IconProps>): IconComponent {
  const Icon = forwardRef<Svg, IconProps>(function TunedIcon(props, ref) {
    // O Lucide repassa as props extras para cada traço do desenho.
    const BaseWithRef = Base as ComponentType<IconProps & { ref?: unknown }>;
    return <BaseWithRef ref={ref} strokeWidth={ICON_STROKE} {...EDGES} {...props} />;
  });
  Icon.displayName = name;
  return Icon;
}

// Desenhados para o app
export const LayoutGrid = drawn('LayoutGrid', 'M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z');
export const Building2 = drawn('Building2', 'M4 21V3h11v18M15 9h5v12M2 21h20M7.5 7h4M7.5 11h4M7.5 15h4M17.5 13v.01M17.5 17v.01');
export const AlertTriangle = drawn('AlertTriangle', 'M12 3l10 18H2zM12 10v5M12 17.5v.5');
export const ClipboardCheck = drawn('ClipboardCheck', 'M8 3h8v3H8zM8 4.5H4V21h16V4.5h-4M8 13l2.5 2.5L16 10');
export const User = drawn('User', 'M5 15a7 7 0 0 1 14 0M10 8.4V5h4v3.4M3 15h18v3H3z');
export const HardHat = drawn('HardHat', 'M5 15a7 7 0 0 1 14 0M10 8.4V5h4v3.4M3 15h18v3H3z');
export const RefreshCw = drawn('RefreshCw', 'M4 12a8 8 0 0 1 14-5.3L20 9M20 3.5V9h-5.5M20 12a8 8 0 0 1-14 5.3L4 15M4 20.5V15h5.5');
export const Clock3 = drawn('Clock3', 'M3 3h18v18H3zM12 7v5.5l3.5 2');
export const CalendarDays = drawn('CalendarDays', 'M3 5h18v16H3zM3 10h18M8 2v5M16 2v5M7 14h3v3H7z');
export const Camera = drawn('Camera', 'M3 7h4l2-3h6l2 3h4v13H3zM16 13.5a4 4 0 1 1-8 0a4 4 0 1 1 8 0');
export const ChevronRight = drawn('ChevronRight', 'M9 5l7 7-7 7');
export const ChevronLeft = drawn('ChevronLeft', 'M15 5l-7 7 7 7');
export const ChevronDown = drawn('ChevronDown', 'M5 9l7 7 7-7');
export const ChevronUp = drawn('ChevronUp', 'M5 15l7-7 7 7');
export const Check = drawn('Check', 'M4 12.5l5 5L20 6.5');
export const X = drawn('X', 'M6 6l12 12M18 6L6 18');
export const Plus = drawn('Plus', 'M12 4v16M4 12h16');
export const ArrowRight = drawn('ArrowRight', 'M4 12h15M13 6l6 6-6 6');
export const ArrowLeft = drawn('ArrowLeft', 'M20 12H5M11 6l-6 6 6 6');

// Lucide com acabamento Trena
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
export const History = tuned('History', LucideHistory);
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
export const Search = tuned('Search', LucideSearch);
export const ShieldAlert = tuned('ShieldAlert', LucideShieldAlert);
export const ShieldCheck = tuned('ShieldCheck', LucideShieldCheck);
export const SlidersHorizontal = tuned('SlidersHorizontal', LucideSlidersHorizontal);
export const Trash2 = tuned('Trash2', LucideTrash2);
export const UserRound = tuned('UserRound', LucideUserRound);
export const UsersRound = tuned('UsersRound', LucideUsersRound);
export const WifiOff = tuned('WifiOff', LucideWifiOff);
export const Wrench = tuned('Wrench', LucideWrench);
export const XCircle = tuned('XCircle', LucideXCircle);
