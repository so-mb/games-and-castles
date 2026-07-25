import {
  CakeSlice,
  Camera,
  Castle,
  Coffee,
  Crown,
  Dice5,
  Film,
  Gamepad2,
  Grid3X3,
  Joystick,
  Layers3,
  Luggage,
  Map,
  MoonStar,
  Route,
  Sparkles,
  Ticket,
  TrainFront,
  Trophy,
  UsersRound,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { ContentIcon as ContentIconName } from "../../types/content";

const icons: Record<ContentIconName, LucideIcon> = {
  arcade: Joystick,
  board: Grid3X3,
  cards: Layers3,
  cake: CakeSlice,
  camera: Camera,
  castle: Castle,
  coffee: Coffee,
  controller: Gamepad2,
  crown: Crown,
  dice: Dice5,
  film: Film,
  food: Utensils,
  gamepad: Joystick,
  luggage: Luggage,
  map: Map,
  moon: MoonStar,
  route: Route,
  sparkles: Sparkles,
  ticket: Ticket,
  train: TrainFront,
  trophy: Trophy,
  users: UsersRound,
};

interface ContentIconProps {
  name: ContentIconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export function ContentIcon({
  name,
  className,
  size = 20,
  strokeWidth = 1.8,
}: ContentIconProps) {
  const Icon = icons[name];

  return (
    <Icon
      aria-hidden="true"
      className={className}
      focusable="false"
      size={size}
      strokeWidth={strokeWidth}
    />
  );
}
