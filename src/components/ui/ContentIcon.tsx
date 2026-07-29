import {
  Bot,
  CakeSlice,
  Camera,
  Cat,
  Castle,
  Coffee,
  Compass,
  Crown,
  Dice5,
  Film,
  Gamepad2,
  Gem,
  Ghost,
  Grid3X3,
  Joystick,
  KeyRound,
  Layers3,
  Luggage,
  Map,
  MoonStar,
  Puzzle,
  Rocket,
  Route,
  Shield,
  Sparkles,
  Swords,
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
  cat: Cat,
  cards: Layers3,
  cake: CakeSlice,
  camera: Camera,
  castle: Castle,
  coffee: Coffee,
  compass: Compass,
  controller: Gamepad2,
  crown: Crown,
  dice: Dice5,
  film: Film,
  food: Utensils,
  gamepad: Joystick,
  gem: Gem,
  ghost: Ghost,
  key: KeyRound,
  luggage: Luggage,
  map: Map,
  moon: MoonStar,
  puzzle: Puzzle,
  robot: Bot,
  rocket: Rocket,
  route: Route,
  shield: Shield,
  sparkles: Sparkles,
  swords: Swords,
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
