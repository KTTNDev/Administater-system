/** Shared physical pagination for the live iframe and Chromium PDF. No server dependencies. */
export const PAGINATION_MEASUREMENT_CSS = `.sheet{width:16cm;min-height:0!important;padding:0!important;margin:0!important;display:flow-root}.approval-grid:has(>.approval:nth-child(3)){grid-template-columns:repeat(3,minmax(0,1fr))}.approval-grid>.approval:last-child:nth-child(odd){grid-column:auto}.section-heading{margin-top:1.5pt;margin-bottom:0;line-height:1.05}.recipient{margin-bottom:6pt}.force-break-before{break-before:page}.physical-page+.physical-page{break-before:page}.physical-page:last-child{break-after:auto}`;
export function paginateDocument({margins}:{margins:{top:number;bottom:number;left:number;right:number}},doc:Document=document){
    const main = doc.querySelector<HTMLElement>('.document')!;
    const authored = [...main.querySelectorAll<HTMLElement>(':scope > .sheet')];
    const pxPerCm = 96 / 2.54;
    const usableWidth = (21 - margins.left - margins.right) * pxPerCm;
    let antiOrphanTriggered = false;
    let purpose = 'body';
    let current!: HTMLElement;
    let capacity = 0;
    let physicalPages = 0;
    const original = authored.map(sheet => ({purpose: sheet.dataset.purpose || 'body', nodes: [...sheet.children].filter(n => !n.classList.contains('page-number') && !n.classList.contains('continuation-note')).map(n => n.cloneNode(true) as HTMLElement)}));
    main.replaceChildren();
    function newPage() {
      current = doc.createElement('section');
      current.className = 'sheet physical-page';
      current.dataset.purpose = purpose;
      current.dataset.physicalPage = String(++physicalPages);
      capacity = (29.7 - (purpose === 'attachment' ? 2.5 : margins.top) - margins.bottom) * pxPerCm - 2;
      Object.assign(current.style, {width: `${usableWidth}px`, height: `${capacity}px`, minHeight: '0', padding: '0', margin: '0', display: 'flow-root'});
      main.append(current);
      return current;
    }
    const fits = () => current.scrollHeight <= Math.ceil(capacity) + 1;
    function emptyPage() {return current.children.length === 0;}
    function appendAtomic(node: HTMLElement) {
      current.append(node);
      if (fits()) return;
      node.remove();
      if (!emptyPage()) newPage();
      current.append(node);
      if (!fits()) throw new Error('เนื้อหาบางส่วนสูงเกินหนึ่งหน้า กรุณาแบ่งเนื้อหาหรือภาพก่อนส่งออก');
    }
    const cloneParagraph = (source: HTMLElement, value: string) => {
      const p = source.cloneNode(false) as HTMLElement;
      p.textContent = value;
      return p;
    };
    function addParagraph(node: HTMLElement) {
      current.append(node);
      if (fits()) return;
      node.remove();
      const heading = current.lastElementChild?.classList.contains('section-heading') ? current.lastElementChild as HTMLElement : undefined;
      const value = node.textContent || '';
      const boundaries = [0, ...Array.from(new Intl.Segmenter('th', {granularity: 'grapheme'}).segment(value), s => s.index + s.segment.length)];
      const probe = cloneParagraph(node, '');
      current.append(probe);
      let lo = 0, hi = boundaries.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        probe.textContent = value.slice(0, boundaries[mid]);
        if (fits()) lo = mid; else hi = mid - 1;
      }
      const end = boundaries[lo];
      probe.textContent = value.slice(0, end);
      const range = doc.createRange(); range.selectNodeContents(probe);
      const lineCount = range.getClientRects().length;
      if (!end || (lineCount < 2 && current.children.length > 1)) {
        probe.remove(); heading?.remove();
        if (emptyPage()) throw new Error('ไม่สามารถจัดย่อหน้าในพื้นที่กระดาษได้');
        newPage(); if (heading) current.append(heading);
        addParagraph(node); return;
      }
      if (end < value.length) {
        probe.classList.remove('keep-body-tail');
        newPage(); addParagraph(cloneParagraph(node, value.slice(end)));
      }
    }
    function tailIndex(p: HTMLElement) {
      const node = p.firstChild;
      if (!node || node.nodeType !== 3) return 0;
      const range = doc.createRange(); range.selectNodeContents(p);
      const rects = [...range.getClientRects()];
      const tops = [...new Set(rects.map(r => Math.round(r.top)))];
      if (tops.length <= 2) return 0;
      const target = tops[tops.length - 2];
      let lo = 0, hi = node.textContent!.length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        range.setStart(node, mid); range.setEnd(node, Math.min(mid + 1, node.textContent!.length));
        if (range.getBoundingClientRect().top >= target - 1) hi = mid; else lo = mid + 1;
      }
      return lo;
    }
    function bodyLines(p: Element) {
      const range = doc.createRange(); range.selectNodeContents(p);
      return new Set([...range.getClientRects()].map(r => Math.round(r.top))).size;
    }
    function addCluster(cluster: HTMLElement) {
      current.append(cluster);
      if (fits()) return;
      cluster.remove();
      const previous = current.lastElementChild as HTMLElement | null;
      const anchors: HTMLElement[] = [];
      let carriedLines = 0;
      if (previous?.classList.contains('paragraph')) {
        const value = previous.textContent || '';
        const at = tailIndex(previous);
        carriedLines = Math.min(2, bodyLines(previous));
        const anchor = cloneParagraph(previous, value.slice(at));
        anchor.classList.add('force-break-before', 'keep-with-signature-anchor');
        anchors.push(anchor);
        if (at) previous.textContent = value.slice(0, at); else previous.remove();
        // Short list items can occupy only one line. Carry another body line, not merely a heading.
        while (carriedLines < 2) {
          const before = current.lastElementChild as HTMLElement | null;
          if (!before || !before.matches('.paragraph,.section-heading')) break;
          if (before.classList.contains('paragraph')) {
            const split = tailIndex(before), value = before.textContent || '';
            carriedLines += Math.min(2, bodyLines(before));
            anchors.unshift(cloneParagraph(before, value.slice(split)));
            if (split) before.textContent = value.slice(0, split); else before.remove();
          } else {before.remove(); anchors.unshift(before);}
        }
        if (current.lastElementChild?.classList.contains('section-heading')) {
          const heading = current.lastElementChild as HTMLElement; heading.remove(); anchors.unshift(heading);
        }
        antiOrphanTriggered = true;
      }
      if (!emptyPage()) newPage();
      for (const anchor of anchors) anchor.classList.remove('force-break-before');
      if (anchors[0]) anchors[0].classList.add('force-break-before');
      current.append(...anchors);
      current.append(cluster);
      if (fits()) return;
      // An unusually long vertical comment chain may span pages; keep closing + primary signature intact.
      const approvals = cluster.querySelector<HTMLElement>('.approval-grid,.approval-vertical');
      if (!approvals) throw new Error('ชุดลงนามสูงเกินหนึ่งหน้า กรุณาตรวจตำแหน่งและข้อความผู้ลงนาม');
      const boxes = [...approvals.children] as HTMLElement[];
      approvals.remove();
      if (!fits()) throw new Error('เนื้อหากับผู้ลงนามหลักสูงเกินหนึ่งหน้า');
      for (const box of boxes) {
        const part = doc.createElement('section');
        part.className = 'signature-cluster'; part.dataset.clusterPart = 'approval';
        const container = doc.createElement('div'); container.className = 'approval-vertical';
        container.append(box); part.append(container); appendAtomic(part);
      }
    }
    function addTable(source: HTMLTableElement) {
      const rows = [...source.tBodies[0].rows];
      const footer = source.tFoot?.cloneNode(true) as HTMLElement | undefined;
      const create = (continued: boolean) => {
        const table = source.cloneNode(true) as HTMLTableElement;
        table.tBodies[0].replaceChildren(); table.tFoot?.remove();
        table.classList.toggle('continued-table', continued);
        current.append(table); return table;
      };
      let table = create(false), continued = false;
      for (const row of rows) {
        table.tBodies[0].append(row);
        if (fits()) continue;
        row.remove();
        if (!table.tBodies[0].rows.length) {
          table.remove();
          if (emptyPage()) throw new Error('แถวตารางสูงเกินหนึ่งหน้า กรุณาแบ่งรายละเอียดรายการ');
        } else continued = true;
        newPage(); table = create(continued); table.tBodies[0].append(row);
        if (!fits()) throw new Error('แถวตารางสูงเกินหนึ่งหน้า กรุณาแบ่งรายละเอียดรายการ');
      }
      if (footer) {
        table.append(footer);
        if (!fits()) {
          footer.remove();
          const last = table.tBodies[0].lastElementChild as HTMLTableRowElement | null;
          if (!last) throw new Error('ส่วนยอดรวมตารางสูงเกินหน้า');
          last.remove();
          if (!table.tBodies[0].rows.length) table.remove();
          newPage(); table = create(true); table.tBodies[0].append(last); table.append(footer);
          if (!fits()) throw new Error('รายการสุดท้ายกับยอดรวมสูงเกินหนึ่งหน้า');
        }
      }
    }
    for (const group of original) {
      purpose = group.purpose;
      newPage();
      const nodes = group.nodes;
      const cluster = nodes.findLast(n => n.classList.contains('signature-cluster'));
      for (const node of [...nodes]) if (cluster && (node.classList.contains('routing-strip') || node.classList.contains('footer'))) {cluster.append(node); nodes.splice(nodes.indexOf(node), 1);}
      if (purpose === 'photos') {
        // Maximum photo heights are bounds, not fixed heights. Reserve room for the final certification.
        const grid = nodes.find(n => n.classList.contains('photo-grid'));
        if (grid && cluster) {
          const probe = doc.createElement('div'); probe.append(...nodes.map(n => n.cloneNode(true))); current.append(probe);
          const excess = probe.getBoundingClientRect().height - capacity;
          if (excess > 0) {
            const images = [...grid.querySelectorAll('img')];
            const cols = Number(grid.style.gridTemplateColumns.includes('repeat(2') ? 2 : 1);
            const rowCount = Math.ceil(images.length / cols) || 1;
            for (const img of images) img.style.maxHeight = `${Math.max(40, parseFloat(img.style.maxHeight) * pxPerCm - excess / rowCount - 4)}px`;
          }
          probe.remove();
        }
      }
      for (const node of nodes) {
        if (node.classList.contains('signature-cluster')) addCluster(node);
        else if (node.tagName === 'TABLE') addTable(node as HTMLTableElement);
        else if (node.classList.contains('paragraph')) addParagraph(node);
        else appendAtomic(node);
      }
    }
    const pages = [...main.children] as HTMLElement[];
    const horizontalOverflow = pages.some(p => p.scrollWidth > p.clientWidth + 1);
    const overflows = pages.filter(p => p.scrollHeight > p.clientHeight + 2).map(p => p.dataset.physicalPage!);
    const signaturePages = pages.flatMap((p, i) => [...p.querySelectorAll<HTMLElement>('.signature-cluster:not([data-cluster-part])')].map(cluster => {
      const preceding = [...p.children].slice(0, [...p.children].indexOf(cluster));
      return {page: i + 1, bodyBefore: preceding.some(n => n.classList.contains('paragraph') || n.tagName === 'TABLE' || n.classList.contains('photo-grid')), bodyLinesBefore: preceding.filter(n => n.classList.contains('paragraph')).reduce((sum, n) => sum + bodyLines(n), 0)};
    }));
    return {physicalPages, antiOrphanTriggered, horizontalOverflow, overflows, signaturePages};

}
