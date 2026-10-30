import {Files,ArrowRight} from "lucide-react";
import {HomeHero} from "@/components/home-hero";
import type {Metadata} from "next";
export const metadata:Metadata={title:"sarabun — เริ่มงานเอกสาร"};
// This public welcome page never loads document, organization, or account data.
export default function HomePage(){return <div className="welcome-standalone"><a className="skip-link" href="#welcome-title">ข้ามไปยังเนื้อหา</a><header className="welcome-header"><a href="/home" aria-label="sarabun หน้าต้อนรับ"><Files size={25}/><strong>sarabun</strong></a><a href="/">พื้นที่ทำงาน<ArrowRight size={16}/></a></header><HomeHero/></div>}
