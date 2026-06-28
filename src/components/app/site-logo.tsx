import { Wine, Martini } from "lucide-react";
import { BarskabLogo } from "@/components/app/barskab-logo";
import type { LogoType } from "@/lib/orders.functions";

interface SiteLogoProps {
  type: LogoType;
  size: number;
  className?: string;
}

export function SiteLogo({ type, size, className }: SiteLogoProps) {
  const style = { width: size, height: size };

  if (type === "martini") {
    return <Martini className={className} style={style} />;
  }
  if (type === "wine") {
    return <Wine className={className} style={style} />;
  }
  if (type === "custom") {
    return (
      <img
        src="/custom-logo.png"
        alt="Logo"
        className={className}
        style={{ ...style, objectFit: "contain" }}
      />
    );
  }
  return <BarskabLogo className={className} style={style} />;
}
