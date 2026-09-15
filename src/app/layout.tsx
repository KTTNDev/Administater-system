import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"สารบรรณ — พื้นที่ทำงานเอกสารราชการ",description:"จัดทำ ตรวจทาน และจัดเก็บร่างหนังสือราชการ"};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="th"><body>{children}</body></html>;}
