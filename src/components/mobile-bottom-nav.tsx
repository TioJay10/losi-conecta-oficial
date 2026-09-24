import type { ReactNode } from "react";

type NavItemProps = {
  label: string;
  icon: ReactNode;
};

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20.5h16M6.5 20V5.5h7V20M13.5 9h4v11M8.5 8.5h2M8.5 12h2M8.5 15.5h2M15.5 12h2M15.5 15.5h2" />
      <path d="M6.5 5.5 10 3.5l3.5 2" />
    </svg>
  );
}

function VideosIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="m10 9 5 3-5 3V9Z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20c.7-3.55 3.05-5.35 6.5-5.35S17.8 16.45 18.5 20" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function NavItem({ label, icon }: NavItemProps) {
  return (
    <button type="button" className="losi-mobile-bottom-nav-item" aria-label={label}>
      <span className="losi-mobile-bottom-nav-icon">{icon}</span>
      <span className="losi-mobile-bottom-nav-label">{label}</span>
    </button>
  );
}

export function MobileBottomNav() {
  return (
    <nav className="losi-mobile-bottom-nav" aria-label="Navegação principal">
      <div className="losi-mobile-bottom-nav-inner">
        <NavItem label="Painel" icon={<DashboardIcon />} />
        <NavItem label="Empresa" icon={<CompanyIcon />} />
        <NavItem label="Vídeos" icon={<VideosIcon />} />
        <NavItem label="Perfil" icon={<ProfileIcon />} />
      </div>
    </nav>
  );
}
