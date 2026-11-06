"use client";
import {useEffect,useState} from 'react';
import {getDocumentSources} from '@/app/word-import-actions';
import styles from './word-import.module.css';
export function DocumentSourcePanel({documentId}:{documentId:string}){
 const [items,setItems]=useState<Awaited<ReturnType<typeof getDocumentSources>>>([]),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setItems([]);setError('');getDocumentSources(documentId).then(rows=>{if(active)setItems(rows);}).catch(()=>{if(active)setError('อ่านไฟล์ต้นฉบับไม่สำเร็จ');});return()=>{active=false};},[documentId,attempt]);
 if(error)return <p role="alert">{error} <button type="button" onClick={()=>setAttempt(n=>n+1)}>ลองใหม่</button></p>;
 if(!items.length)return null;
 return <details className={styles.savedSource}><summary>ต้นฉบับ Word ที่นำเข้า ({items.length})</summary>{items.map(item=><section key={item.id}><a href={'/api/document-sources/'+item.id}>ดาวน์โหลด {item.name}</a><p>เก็บกับเรื่องนี้ · {(item.bytes/1024).toFixed(0)} KB</p><details><summary>ดูข้อความต้นฉบับและจุดที่ต้องตรวจ</summary><ul>{item.analysis.warnings.map(w=><li key={w}>{w}</li>)}</ul><pre>{item.analysis.sourceText}</pre></details></section>)}</details>;
}
