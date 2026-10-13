import {
  Home, Zap, Flame, Smartphone, Car, ShieldCheck, CreditCard, GraduationCap, Tv, Music, Gamepad2, Route,
  HeartPulse, Sparkles, Globe, Package, Droplet, Wifi, Receipt,
} from "lucide-react";

const MAP = {
  home: Home, zap: Zap, flame: Flame, phone: Smartphone, car: Car, shield: ShieldCheck, card: CreditCard,
  cap: GraduationCap, tv: Tv, music: Music, game: Gamepad2, road: Route, pulse: HeartPulse, sparkle: Sparkles,
  globe: Globe, package: Package, droplet: Droplet, wifi: Wifi, receipt: Receipt,
};

export default function CategoryIcon({ name, ...rest }) {
  const C = MAP[name] || Receipt;
  return <C strokeWidth={2} {...rest} />;
}
