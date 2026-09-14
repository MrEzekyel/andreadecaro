import * as Lucide from "lucide-react-native";
import React from "react";

type IconProps = {
  name: string;
  size?: number;
  color: string;
  strokeWidth?: number;
  /** Riempimento dell'icona — usato per uno stato "attivo" (es. il preferito
   *  nel selettore di divisione), non necessario altrove. */
  fill?: string;
};

function toPascalCase(slug: string) {
  return slug
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Icone Lucide risolte per nome a runtime.
 *
 * Il nome arriva dal database (categories.icon), quindi non e' noto a compile
 * time; la ricerca dinamica evita anche che una icona rinominata a monte
 * rompa la build — in quel caso si ripiega su CircleHelp.
 *
 * Lo spessore predefinito e' 1.75, allineato ai pesi tipografici del sistema.
 */
export function Icon({ name, size = 20, color, strokeWidth = 1.75, fill }: IconProps) {
  const registry = Lucide as unknown as Record<
    string,
    React.ComponentType<{
      size?: number;
      color?: string;
      strokeWidth?: number;
      fill?: string;
    }>
  >;

  const Component =
    registry[toPascalCase(name)] ?? registry.CircleHelp ?? registry.HelpCircle;

  if (!Component) return null;

  return <Component size={size} color={color} strokeWidth={strokeWidth} fill={fill} />;
}
