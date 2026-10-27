import type { Metadata } from "next";
import "./globals.css";
import "./system-theme.css";
import "./workspace-tokens.css";
import "./workspace-polish.css";
import "./notion-workspace.css";
import "./workspace-comfort.css";
import "./workspace-appearance.css";
import "./minutes-workspace.css";
export const metadata:Metadata={title:"สารบรรณ — พื้นที่ทำงานเอกสารราชการ",description:"จัดทำ ตรวจทาน และจัดเก็บร่างหนังสือราชการ"};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="th" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{__html:'try{document.documentElement.dataset.uiTheme=localStorage.getItem("sarabun-ui-theme")==="dim"?"dim":"light"}catch{}'}}/>{children}</body></html>;}
