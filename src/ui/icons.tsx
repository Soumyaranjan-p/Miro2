import {
  AlignLeft,
  BatteryCharging,
  Check,
  Cpu,
  Droplet,
  FileText,
  Folder,
  FolderOpen,
  Gauge,
  HardDrive,
  Headphones,
  LayoutGrid,
  ListTodo,
  MemoryStick,
  Music2,
  Pause,
  Play,
  Settings2,
  SkipBack,
  SkipForward,
  Timer,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * One icon set: lucide. Miro only chooses size and stroke; it never mixes in
 * hand-drawn glyphs, emoji, or Unicode stand-ins.
 */
function miroIcon(Icon: LucideIcon) {
  return function MiroIcon({ size = 14, strokeWidth = 1.8, ...props }: LucideProps) {
    return <Icon size={size} strokeWidth={strokeWidth} {...props} />;
  };
}

export const MusicIcon = miroIcon(Music2);
export const WidgetsIcon = miroIcon(LayoutGrid);
export const LyricsIcon = miroIcon(AlignLeft);
export const UsageIcon = miroIcon(Gauge);
export const FocusIcon = miroIcon(Timer);
export const WaterIcon = miroIcon(Droplet);
export const ShelfIcon = miroIcon(FolderOpen);
export const TodoIcon = miroIcon(ListTodo);
export const SystemIcon = miroIcon(Cpu);
export const SettingsIcon = miroIcon(Settings2);

export const PlayIcon = miroIcon(Play);
export const PauseIcon = miroIcon(Pause);
export const PreviousIcon = miroIcon(SkipBack);
export const NextIcon = miroIcon(SkipForward);
export const CheckIcon = miroIcon(Check);
export const FileIcon = miroIcon(FileText);
export const FolderIcon = miroIcon(Folder);

/* Transient state icons — charger, headphones. Same set, same stroke. */
export const ChargingIcon = miroIcon(BatteryCharging);
export const HeadphonesIcon = miroIcon(Headphones);

/* System stats row icons. */
export const MemoryIcon = miroIcon(MemoryStick);
export const DiskIcon = miroIcon(HardDrive);
