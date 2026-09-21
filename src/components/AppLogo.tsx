import { useNavigate } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { supabase } from "../lib/supabase";

type AppLogoProps = {
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
  "aria-label"?: string;
};

export function AppLogo({ className, children, "aria-label": ariaLabel = "LOSI CONECTA" }: AppLogoProps) {
  const navigate = useNavigate();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      navigate({ to: "/" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type,blocked")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || profile.blocked) {
      navigate({ to: "/" });
      return;
    }

    if (profile.user_type === "admin") {
      navigate({ to: "/admin" });
      return;
    }

    navigate({ to: "/painel" });
  }

  return (
    <a href="/" className={className} aria-label={ariaLabel} onClick={handleClick}>
      {children ?? <>LOSI <span>CONECTA</span></>}
    </a>
  );
}
