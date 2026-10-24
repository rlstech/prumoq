/**
 * Ícones do painel: pacote Seixo (identidade Trena Suave, a mesma do PWA).
 *
 * Todas as telas importam daqui, nunca direto de 'lucide-react'.
 * - Os mais visíveis (menu, obra, NC, prazos, setas...) são desenhados numa
 *   grade de 24 com os traços de `seixoIconPaths` (`@prumoq/design-system`).
 * - Os demais vêm do Lucide com o mesmo acabamento (traço 1,8, pontas redondas).
 * A API é a do Lucide (size, color, strokeWidth, className...), então trocar um
 * ícone entre os dois grupos não muda as telas.
 */
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import { seixoIconPaths, type SeixoIconName } from '@prumoq/design-system';
import {
  AlertCircle as LucideAlertCircle,
  ArrowRightLeft as LucideArrowRightLeft,
  ArrowUpRight as LucideArrowUpRight,
  Ban as LucideBan,
  CheckCircle2 as LucideCheckCircle2,
  Download as LucideDownload,
  ExternalLink as LucideExternalLink,
  FileDown as LucideFileDown,
  FileText as LucideFileText,
  GripVertical as LucideGripVertical,
  KeyRound as LucideKeyRound,
  Loader2 as LucideLoader2,
  Pencil as LucidePencil,
  RotateCcw as LucideRotateCcw,
  Save as LucideSave,
  Settings2 as LucideSettings2,
  ShieldAlert as LucideShieldAlert,
  ShieldCheck as LucideShieldCheck,
  ShieldOff as LucideShieldOff,
  ShieldX as LucideShieldX,
  Trash2 as LucideTrash2,
  Upload as LucideUpload,
  UserCheck as LucideUserCheck,
  UserRound as LucideUserRound,
  UserX as LucideUserX,
  UsersRound as LucideUsersRound,
  Wifi as LucideWifi,
  Wrench as LucideWrench,
  XCircle as LucideXCircle,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

export type IconProps = LucideProps;
export type IconComponent = ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>;

/** Traço padrão quando a tela não define um. */
export const ICON_STROKE = 1.8;

/** Ícone desenhado (Seixo), numa grade de 24. */
function drawn(name: SeixoIconName): IconComponent {
  const d = seixoIconPaths[name];
  const Icon = forwardRef<SVGSVGElement, Omit<LucideProps, 'ref'>>(function DrawnIcon(
    { color = 'currentColor', size = 24, strokeWidth = ICON_STROKE, absoluteStrokeWidth, children, ...rest },
    ref,
  ) {
    const width = absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={rest['aria-label'] ? undefined : true}
        {...rest}
      >
        <path d={d} />
        {children}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}

/** Ícone do Lucide com o acabamento Seixo (traço 1,8 e pontas redondas). */
function tuned(name: string, Base: LucideIcon): IconComponent {
  const Icon = forwardRef<SVGSVGElement, Omit<LucideProps, 'ref'>>(function TunedIcon(props, ref) {
    return <Base ref={ref} strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" {...props} />;
  });
  Icon.displayName = name;
  return Icon;
}

// Desenhados (Seixo)
export const Plumb = drawn('Plumb');
export const Home = drawn('Home');
export const LayoutGrid = drawn('LayoutGrid');
export const Building2 = drawn('Building2');
export const AlertTriangle = drawn('AlertTriangle');
export const ClipboardCheck = drawn('ClipboardCheck');
export const ClipboardList = drawn('ClipboardList');
export const Star = drawn('Star');
export const HardHat = drawn('HardHat');
export const Ruler = drawn('Ruler');
export const Landmark = drawn('Landmark');
export const Users = drawn('Users');
export const Layers = drawn('Layers');
export const LogOut = drawn('LogOut');
export const Printer = drawn('Printer');
export const ScanLine = drawn('ScanLine');
export const RefreshCw = drawn('RefreshCw');
export const History = drawn('History');
export const Clock3 = drawn('Clock3');
export const CalendarDays = drawn('CalendarDays');
export const Camera = drawn('Camera');
export const Search = drawn('Search');
export const MapPin = drawn('MapPin');
export const ChevronRight = drawn('ChevronRight');
export const ChevronLeft = drawn('ChevronLeft');
export const ChevronDown = drawn('ChevronDown');
export const ChevronUp = drawn('ChevronUp');
export const ChevronsLeft = drawn('ChevronsLeft');
export const ChevronsRight = drawn('ChevronsRight');
export const Check = drawn('Check');
export const X = drawn('X');
export const Plus = drawn('Plus');
export const Minus = drawn('Minus');
export const Menu = drawn('Menu');
export const ArrowRight = drawn('ArrowRight');
export const ArrowLeft = drawn('ArrowLeft');

// Do Lucide, com o acabamento Seixo
export const AlertCircle = tuned('AlertCircle', LucideAlertCircle);
export const ArrowRightLeft = tuned('ArrowRightLeft', LucideArrowRightLeft);
export const ArrowUpRight = tuned('ArrowUpRight', LucideArrowUpRight);
export const Ban = tuned('Ban', LucideBan);
export const CheckCircle2 = tuned('CheckCircle2', LucideCheckCircle2);
export const Download = tuned('Download', LucideDownload);
export const ExternalLink = tuned('ExternalLink', LucideExternalLink);
export const FileDown = tuned('FileDown', LucideFileDown);
export const FileText = tuned('FileText', LucideFileText);
export const GripVertical = tuned('GripVertical', LucideGripVertical);
export const KeyRound = tuned('KeyRound', LucideKeyRound);
export const Loader2 = tuned('Loader2', LucideLoader2);
export const Pencil = tuned('Pencil', LucidePencil);
export const RotateCcw = tuned('RotateCcw', LucideRotateCcw);
export const Save = tuned('Save', LucideSave);
export const Settings2 = tuned('Settings2', LucideSettings2);
export const ShieldAlert = tuned('ShieldAlert', LucideShieldAlert);
export const ShieldCheck = tuned('ShieldCheck', LucideShieldCheck);
export const ShieldOff = tuned('ShieldOff', LucideShieldOff);
export const ShieldX = tuned('ShieldX', LucideShieldX);
export const Trash2 = tuned('Trash2', LucideTrash2);
export const Upload = tuned('Upload', LucideUpload);
export const UserCheck = tuned('UserCheck', LucideUserCheck);
export const UserRound = tuned('UserRound', LucideUserRound);
export const UserX = tuned('UserX', LucideUserX);
export const UsersRound = tuned('UsersRound', LucideUsersRound);
export const Wifi = tuned('Wifi', LucideWifi);
export const Wrench = tuned('Wrench', LucideWrench);
export const XCircle = tuned('XCircle', LucideXCircle);
