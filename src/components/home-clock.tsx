'use client';
import type {CSSProperties} from 'react';
import {homeClockFonts,type HomeLayout} from '@/lib/home-layout';

export function HomeClock({layout,now}:{layout:HomeLayout;now:Date|null}){
 const style={
  '--home-clock-size':layout.clockSize+'px',
  '--home-date-size':layout.dateSize+'px',
  '--home-clock-family':homeClockFonts[layout.clockFont].family,
  '--home-date-family':homeClockFonts[layout.dateFont].family,
 } as CSSProperties;
 return <div className="wd-hero-date home-clock" style={style} aria-label="นาฬิกาและวันที่">
  <time dateTime={now?.toISOString()}>{now?new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok',hourCycle:'h23'}).format(now):'—:—'}</time>
  <span>{now?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(now):'กำลังโหลดวันที่'}</span>
 </div>;
}
