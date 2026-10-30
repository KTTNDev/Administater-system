import type { Metadata } from "next";
import "./globals.css";
import "./system-theme.css";
import "./workspace-tokens.css";
import "./workspace-polish.css";
import "./notion-workspace.css";
import "./workspace-comfort.css";
import "./workspace-appearance.css";
import "./minutes-workspace.css";
import "./workspace-calm.css";
export const metadata:Metadata={title:"สารบรรณ — พื้นที่ทำงานเอกสารราชการ",description:"จัดทำ ตรวจทาน และจัดเก็บร่างหนังสือราชการ"};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="th"><body>{children}</body></html>;}
