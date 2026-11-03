'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  Bell,
  Box,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  FileDown,
  Filter,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Tag,
  Truck,
  X,
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Item = {
  docId: string
  id: string
  item: string
  type: string
  serial: string
  tag: string
  date: string
  rawRegisteredAt: string
  age: string
  status: string
  categories: string[]
  auction: boolean
}

type NewItemData = {
  name: string
  type: string
  model: string
  tag: string
  serial: string
  serviceTag: string
  registeredAt: string
  categories: string[]
}

const itemTypes = ['Monitores', 'Teclados', 'Mouses', 'Dockstations', 'APs', 'Telefones', 'Placas de circuito', 'Placas de vídeo', 'Baterias', 'Memória RAM', 'HDs', 'Fontes', 'Extensões de tomada', 'Webcams', 'Impressoras', 'Leitores de DVD']

const PIE_COLORS = ['#234e70', '#4f8a81', '#c98235', '#728c45', '#687786', '#a259ff', '#f24e1e', '#0acf83']

function formatDate(isoDate?: string) {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function ageFrom(isoDate?: string) {
  if (!isoDate) return ''
  const days = Math.max(0, Math.floor((Date.now() - new Date(`${isoDate}T00:00:00`).getTime()) / 86400000))
  if (days < 1) return 'hoje'
  if (days < 30) return `${days} ${days === 1 ? 'dia' : 'dias'}`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  return `${years} ${years === 1 ? 'ano' : 'anos'}`
}

function toItem(docId: string, data: DocumentData): Item {
  return {
    docId,
    id: data.code ?? docId,
    item: data.name ?? '',
    type: data.type ?? '',
    serial: data.serial || 'N/A',
    tag: data.tag || '—',
    date: formatDate(data.registeredAt),
    rawRegisteredAt: data.registeredAt ?? '',
    age: ageFrom(data.registeredAt),
    status: data.status ?? 'Armazenado',
    categories: Array.isArray(data.categories) ? data.categories : [],
    auction: Boolean(data.auction),
  }
}

async function createItem(data: NewItemData) {
  const counterRef = doc(db, 'counters', 'inserviveis')
  const itemRef = doc(collection(db, 'inserviveis'))
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef)
    const next = (snapshot.exists() ? Number(snapshot.data().value) : 0) + 1
    const year = data.registeredAt.slice(0, 4) || String(new Date().getFullYear())
    transaction.set(counterRef, { value: next })
    transaction.set(itemRef, {
      code: `INV-${year}-${String(next).padStart(4, '0')}`,
      name: data.name.trim(),
      type: data.type,
      model: data.model.trim(),
      tag: data.tag.trim(),
      serial: data.serial.trim(),
      serviceTag: data.serviceTag.trim(),
      registeredAt: data.registeredAt,
      status: 'Armazenado',
      categories: data.categories,
      auction: false,
      createdAt: serverTimestamp(),
    })
  })
}

function MetricCard({ label, value, detail, icon: Icon, tone = 'blue' }: { label: string; value: string | number; detail: string; icon: typeof Box; tone?: string }) {
  const tones: Record<string, string> = { blue: 'bg-[#eaf2f8] text-[#234e70]', green: 'bg-[#edf5ed] text-[#567341]', amber: 'bg-[#fff3e3] text-[#b46c1c]', navy: 'bg-[#eef1f3] text-[#3d5061]' }
  return <div className="metric-card"><div className={`metric-icon ${tones[tone]}`}><Icon size={19} strokeWidth={1.8} /></div><div className="min-w-0"><p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-detail">{detail}</p></div></div>
}

type ReportRow = Record<'id' | 'item' | 'type' | 'serial' | 'tag' | 'date' | 'age' | 'status' | 'categories' | 'auction', string>

const reportColumns: { header: string; key: keyof ReportRow; width: number }[] = [
  { header: 'ID', key: 'id', width: 16 },
  { header: 'Item', key: 'item', width: 34 },
  { header: 'Tipo', key: 'type', width: 16 },
  { header: 'Serial', key: 'serial', width: 14 },
  { header: 'Patrimônio', key: 'tag', width: 14 },
  { header: 'Data de cadastro', key: 'date', width: 18 },
  { header: 'Tempo', key: 'age', width: 10 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Categorias', key: 'categories', width: 32 },
  { header: 'Leiloado', key: 'auction', width: 11 },
]

function buildReportRows(rows: Item[]): ReportRow[] {
  return rows.map((item) => ({
    id: item.id,
    item: item.item,
    type: item.type,
    serial: item.serial,
    tag: item.tag,
    date: item.date,
    age: item.age,
    status: item.status,
    categories: item.categories.join(', '),
    auction: item.auction ? 'Sim' : 'Não',
  }))
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function exportCsv(rows: ReportRow[], filename: string) {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }
  const lines = [
    reportColumns.map((column) => cell(column.header)).join(';'),
    ...rows.map((row) => reportColumns.map((column) => cell(row[column.key])).join(';')),
  ]
  saveBlob(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
}

async function exportXlsx(rows: ReportRow[], filename: string) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Inservíveis')
  sheet.addTable({
    name: 'Inserviveis',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: reportColumns.map((column) => ({ name: column.header, filterButton: true })),
    rows: rows.map((row) => reportColumns.map((column) => row[column.key])),
  })
  reportColumns.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width })
  const buffer = await workbook.xlsx.writeBuffer()
  saveBlob(
    new Blob([buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  )
}

async function exportPdf(rows: ReportRow[], filename: string, filterLabel: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const clean = (value: string) => value.replace(/—/g, '-')

  doc.setFontSize(16)
  doc.setTextColor(35, 78, 112)
  doc.text('Relatório de inservíveis', 40, 44)
  doc.setFontSize(9)
  doc.setTextColor(104, 119, 134)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${rows.length} ${rows.length === 1 ? 'item' : 'itens'} · ${filterLabel}`, 40, 62)

  autoTable(doc, {
    startY: 78,
    head: [reportColumns.map((column) => column.header)],
    body: rows.map((row) => reportColumns.map((column) => clean(row[column.key]))),
    styles: { fontSize: 8, cellPadding: 5, textColor: [45, 55, 65] },
    headStyles: { fillColor: [35, 78, 112], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 247, 248] },
    margin: { left: 40, right: 40, bottom: 40 },
  })

  const totalPages = doc.getNumberOfPages()
  doc.setFontSize(8)
  doc.setTextColor(132, 144, 154)
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page)
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - 40, pageHeight - 20, { align: 'right' })
  }

  doc.save(`${filename}.pdf`)
}

function FloatingPanel({ anchor, width, label, onClose, children }: { anchor: DOMRect; width: number; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (ref.current?.contains(target) || target?.closest('[data-popover-trigger]')) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  const left = Math.min(Math.max(8, anchor.right - width), window.innerWidth - width - 8)
  const openUp = window.innerHeight - anchor.bottom < 240 && anchor.top > 240
  const position = openUp ? { bottom: window.innerHeight - anchor.top + 6 } : { top: anchor.bottom + 6 }

  return <div ref={ref} role="dialog" aria-label={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl" style={{ position: 'fixed', zIndex: 60, width, left, ...position }}>{children}</div>
}

export default function InventoryDashboard() {
  const [activeSection, setActiveSection] = useState('Visão geral')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const activeCategory = selectedCategories.length === 0 ? 'Todos os itens' : selectedCategories.length === 1 ? selectedCategories[0] : `${selectedCategories.length} categorias`
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null)
  const [downloadAnchor, setDownloadAnchor] = useState<DOMRect | null>(null)
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('2026-2027')
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    const itemsQuery = firestoreQuery(collection(db, 'inserviveis'), orderBy('createdAt', 'desc'))
    return onSnapshot(
      itemsQuery,
      (snapshot) => setItems(snapshot.docs.map((entry) => toItem(entry.id, entry.data()))),
      () => setToast('Não foi possível carregar os itens'),
    )
  }, [])

  // --- CÁLCULO DE CATEGORIAS DINÂMICAS PARA A SIDEBAR ---
  const dynamicCategories = useMemo(() => {
    const baseCategories = [
      { label: 'Com patrimônio', icon: Tag, color: 'bg-[#234e70]', accent: '#234e70' },
      { label: 'Sem patrimônio', icon: Box, color: 'bg-[#4f8a81]', accent: '#4f8a81' },
      { label: 'Sem garantia', icon: ShieldAlert, color: 'bg-[#c98235]', accent: '#c98235' },
      { label: 'Funcionais', icon: PackageCheck, color: 'bg-[#728c45]', accent: '#728c45' },
    ]

    return baseCategories.map(cat => ({
      ...cat,
      count: items.filter(item => item.categories.includes(cat.label)).length
    }))
  }, [items])

  // --- CÁLCULOS DAS MÉTRICAS DO TOPO ---
  const totalInserviveis = items.length
  const aguardandoLeilaoCount = useMemo(() => {return items.filter((item) => item.categories.includes('Sem garantia')).length}, [items])
  const retiradosCount = useMemo(() => {return items.filter((item) => item.auction).length}, [items])
  
  const cadastradosNoMesCount = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `${currentYear}-${currentMonth}`
    return items.filter((i) => i.rawRegisteredAt && i.rawRegisteredAt.startsWith(prefix)).length
  }, [items])

  // --- GRÁFICO DINÂMICO POR TIPO DE ITEM ---
  const pieDataDynamic = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(item => {
      const t = item.type || 'Outros'
      counts[t] = (counts[t] || 0) + 1
    })

    return Object.entries(counts).map(([name, value], index) => ({
      name,
      value,
      color: PIE_COLORS[index % PIE_COLORS.length]
    }))
  }, [items])

  // --- GRÁFICO DINÂMICO DE MOVIMENTAÇÃO POR MÊS ---
  const periodDataDynamic = useMemo(() => {
    const monthMap: Record<string, number> = {}
    items.forEach(item => {
      if (item.rawRegisteredAt) {
        const [y, m] = item.rawRegisteredAt.split('-')
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        const monthIndex = parseInt(m, 10) - 1
        if (monthIndex >= 0 && monthIndex < 12) {
          const key = `${y} ${monthNames[monthIndex]}`
          monthMap[key] = (monthMap[key] || 0) + 1
        }
      }
    })

    const [start, end] = selectedPeriod.split('-').map(Number)
    const result: { name: string; cadastrados: number }[] = []

    for (let y = start; y <= end; y++) {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      monthNames.forEach(m => {
        const key = `${y} ${m}`
        result.push({
          name: key,
          cadastrados: monthMap[key] || 0
        })
      })
    }

    return result
  }, [items, selectedPeriod])

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.item} ${item.id} ${item.serial} ${item.tag}`.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = selectedCategories.length === 0 || item.categories.some((category) => selectedCategories.includes(category))
    return matchesQuery && matchesCategory
  }), [items, query, selectedCategories])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }

  const setAuction = async (id: string, value: boolean) => {
    const target = items.find((entry) => entry.id === id)
    if (!target) return
    try {
      await updateDoc(doc(db, 'inserviveis', target.docId), { auction: value })
    } catch {
      notify('Não foi possível salvar a alteração')
    }
  }

  const downloadReport = async (format: string) => {
    const normalized = format.toLowerCase()
    const kind = normalized.includes('csv') ? 'csv' : normalized.includes('pdf') ? 'pdf' : /xls|excel/.test(normalized) ? 'xlsx' : null
    if (!kind) { notify(`Relatório ${format.toUpperCase()} preparado para download`); return }
    if (filteredItems.length === 0) { notify('Nenhum item para exportar com os filtros atuais'); return }
    const rows = buildReportRows(filteredItems)
    const filename = `relatorio-inserviveis-${new Date().toLocaleDateString('en-CA')}`
    const filterLabel = [
      selectedCategories.length > 0 ? `Categorias: ${selectedCategories.join(', ')}` : 'Todas as categorias',
      query.trim() ? `Busca: "${query.trim()}"` : '',
    ].filter(Boolean).join(' · ')
    try {
      if (kind === 'csv') exportCsv(rows, filename)
      else if (kind === 'pdf') await exportPdf(rows, filename, filterLabel)
      else await exportXlsx(rows, filename)
      notify(`Relatório ${kind === 'csv' ? 'CSV' : kind === 'pdf' ? 'PDF' : 'Excel'} baixado`)
    } catch {
      notify('Não foi possível gerar o relatório')
    }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${showMobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Box size={21} /></div><div><strong>Inservíveis</strong><small>Gestão de inservíveis</small></div><button className="mobile-close" onClick={() => setShowMobileNav(false)} aria-label="Fechar menu"><X size={18} /></button></div>
      <nav className="main-nav" aria-label="Navegação principal">
        <p className="nav-caption">GESTÃO</p>
        {[['Visão geral', LayoutDashboard], ['Inventário', ClipboardList]].map(([label, Icon]) => <button key={label as string} className={`nav-link ${activeSection === label ? 'active' : ''}`} onClick={() => { setActiveSection(label as string); setShowMobileNav(false) }}><Icon size={18} />{label as string}</button>)}
        <p className="nav-caption nav-caption-spaced">CATEGORIAS</p>
        {dynamicCategories.map(({ label, count, icon: Icon, color }) => <button key={label} className={`category-link ${selectedCategories.includes(label) ? 'selected' : ''}`} onClick={() => { setSelectedCategories((current) => (current.length === 1 && current[0] === label ? [] : [label])); setActiveSection('Inventário'); setShowMobileNav(false) }}><span className={`category-dot ${color}`}><Icon size={13} /></span>{label}<span className="category-count">{count}</span></button>)}
      </nav>
      <div className="sidebar-bottom">
        <button className={`nav-link ${activeSection === 'Configurações' ? 'active' : ''}`} onClick={() => { setActiveSection('Configurações'); setShowMobileNav(false) }}>
          <Settings2 size={18} />Configurações
        </button>
        <button className="nav-link" onClick={() => void signOut(auth)}><LogOut size={18} />Sair</button>
        <div className="profile"><div className="avatar">JS</div><div><strong>Julio Simões</strong><small>Administrador</small></div><ChevronDown size={15} className="ml-auto text-slate-400" /></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setShowMobileNav(true)} aria-label="Abrir menu"><Menu size={21} /></button><div className="breadcrumbs"><span>Inservíveis</span><span>/</span><strong>{activeSection}</strong>{activeCategory !== 'Todos os itens' && <><span>/</span><strong>{activeCategory}</strong></>}</div><div className="top-actions"><button className="icon-button" aria-label="Ajuda"><CircleHelp size={19} /></button><button className="icon-button notification" aria-label="Notificações"><Bell size={19} /><i /></button><div className="top-avatar">JS</div></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><p className="eyebrow">CENTRAL DE OPERAÇÕES</p><h1>{activeSection}</h1><p className="page-description">Acompanhe o ciclo dos materiais inservíveis e prepare seus próximos leilões.</p></div><div className="heading-actions"><button className="secondary-button" data-popover-trigger aria-haspopup="dialog" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setFilterAnchor(null); setDownloadAnchor((current) => (current ? null : rect)) }}><FileDown size={16} />Exportar relatório<ChevronDown size={15} /></button>{downloadAnchor && <FloatingPanel anchor={downloadAnchor} width={248} label="Exportar relatório" onClose={() => setDownloadAnchor(null)}>
  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Exportar relatório</p>
  <button className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-slate-50" onClick={() => { setDownloadAnchor(null); void downloadReport('xlsx') }}><strong className="text-sm text-slate-800">Excel (.xlsx)</strong><small className="text-xs text-slate-500">Tabela formatada, com filtros nas colunas</small></button>
  <button className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-slate-50" onClick={() => { setDownloadAnchor(null); void downloadReport('csv') }}><strong className="text-sm text-slate-800">CSV (.csv)</strong><small className="text-xs text-slate-500">Texto separado por ponto e vírgula</small></button>
  <button className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-slate-50" onClick={() => { setDownloadAnchor(null); void downloadReport('pdf') }}><strong className="text-sm text-slate-800">PDF (.pdf)</strong><small className="text-xs text-slate-500">Documento pronto para imprimir ou enviar</small></button>
</FloatingPanel>}<button className="primary-button" onClick={() => setShowNew(true)}><Plus size={17} />Cadastrar item</button></div></div>

        {activeSection === 'Configurações' ? (
          <div className="panel p-8 text-center text-slate-600">
            <Settings2 size={48} className="mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-bold text-slate-800">Configurações do Sistema</h2>
            <p className="mt-2 text-sm text-slate-500">Esta tela está em desenvolvimento. Em breve você poderá editar perfis, permissões e parâmetros do sistema por aqui.</p>
          </div>
        ) : activeSection === 'Visão geral' ? <>
          <div className="metrics-grid">
  <MetricCard label="Total de Inservíveis" value={totalInserviveis} detail="itens cadastrados" icon={Box} />
  <MetricCard label="Aguardando leilão" value={aguardandoLeilaoCount} detail="itens sem garantia" icon={Gavel} tone="amber" />
  <MetricCard label="Cadastrados no mês" value={cadastradosNoMesCount} detail="no mês atual" icon={ClipboardList} tone="green" />
  <MetricCard label="Retirados / Leiloados" value={retiradosCount} detail={`${totalInserviveis > 0 ? ((retiradosCount / totalInserviveis) * 100).toFixed(1) : 0}% do total`} icon={Truck} tone="navy" />
</div>
          <div className="dashboard-grid">
            <div className="panel large-panel">
              <div className="panel-header">
                <div>
                  <h2>Movimentação de inservíveis</h2>
                  <p>Itens cadastrados por mês</p>
                </div>
                <label className="period-select">
                  <span className="sr-only">Período do gráfico</span>
                  <select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>
                    <option value="2026-2027">2026–2027 · mensal</option>
                    <option value="2027-2028">2027–2028 · mensal</option>
                    <option value="2028-2029">2028–2029 · mensal</option>
                    <option value="2029-2030">2029–2030 · mensal</option>
                  </select>
                  <ChevronDown size={15} />
                </label>
              </div>
              <div className="chart-area">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={periodDataDynamic} margin={{ top: 12, right: 10, left: -20, bottom: 0 }} barGap={7}>
                    <CartesianGrid vertical={false} stroke="#e7ecef" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#84909a', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#84909a', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f4f7f8' }} contentStyle={{ border: '1px solid #e1e8ec', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="cadastrados" name="Cadastrados" fill="#234e70" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span><i className="legend-blue" />Itens cadastrados</span>
                <span className="chart-total">Total no período: {periodDataDynamic.reduce((a, b) => a + b.cadastrados, 0)}</span>
              </div>
            </div>
            
            <div className="panel category-panel">
              <div className="panel-header">
                <div>
                  <h2>Por categoria</h2>
                  <p>Distribuição do estoque</p>
                </div>
              </div>
              <div className="pie-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieDataDynamic.length > 0 ? pieDataDynamic : [{ name: 'Sem itens', value: 1, color: '#e2e8f0' }]} cx="50%" cy="48%" innerRadius={55} outerRadius={84} paddingAngle={3} dataKey="value" stroke="none">
                      {pieDataDynamic.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ border: '1px solid #e1e8ec', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-center"><strong>{totalInserviveis}</strong><span>itens</span></div>
              </div>
              <div className="category-legend">
                {pieDataDynamic.map((entry) => (
                  <div key={entry.name}>
                    <span><i style={{ backgroundColor: entry.color }} />{entry.name}</span>
                    <strong>{entry.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="section-heading"><div><h2>Itens recentes</h2><p>Últimas movimentações registradas no sistema</p></div><button className="text-button" onClick={() => setActiveSection('Inventário')}>Ver inventário completo <span>→</span></button></div>
        </> : <div className="panel inventory-panel"><div className="panel-header"><div><h2>{activeCategory === 'Todos os itens' ? 'Todos os itens' : activeCategory}</h2><p>Consulte, filtre e atualize os materiais cadastrados.</p></div><div className="panel-actions"><button className="secondary-button small" data-popover-trigger aria-haspopup="dialog" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setDownloadAnchor(null); setFilterAnchor((current) => (current ? null : rect)) }}><Filter size={15} />Filtros{selectedCategories.length > 0 && <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#234e70] px-1 text-[10px] font-semibold text-white">{selectedCategories.length}</span>}</button>
{filterAnchor && <FloatingPanel anchor={filterAnchor} width={264} label="Filtrar por categoria" onClose={() => setFilterAnchor(null)}>
  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</p>
  <div className="flex flex-col gap-1">
    {['Com patrimônio', 'Sem patrimônio', 'Sem garantia', 'Funcionais'].map((catLabel) => <label key={catLabel} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" className="h-4 w-4 accent-[#234e70]" checked={selectedCategories.includes(catLabel)} onChange={() => setSelectedCategories((current) => (current.includes(catLabel) ? current.filter((name) => name !== catLabel) : [...current, catLabel]))} />{catLabel}</label>)}
  </div>
  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
    <button className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40" disabled={selectedCategories.length === 0} onClick={() => setSelectedCategories([])}>Limpar</button>
    <button className="primary-button small" onClick={() => setFilterAnchor(null)}>Concluir</button>
  </div>
</FloatingPanel>}<button className="primary-button small" onClick={() => setShowNew(true)}><Plus size={15} />Novo item</button></div></div><InventoryTable items={filteredItems} onNotify={notify} onAuctionChange={setAuction} /></div>}

        {activeSection === 'Visão geral' && <div className="panel inventory-panel"><div className="panel-header"><div><h2>Itens recentes</h2><p>Últimas movimentações registradas no sistema.</p></div><div className="panel-actions"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar item, serial ou patrimônio" /></div><button className="secondary-button small" onClick={() => setActiveSection('Inventário')}>Ver todos <ArrowDownToLine size={15} /></button></div></div><InventoryTable items={filteredItems.slice(0, 4)} onNotify={notify} onAuctionChange={setAuction} /></div>}
      </div>
    </main>
    {showNew && <NewItemModal onClose={() => setShowNew(false)} onSave={async (data) => { await createItem(data); setShowNew(false); notify('Item cadastrado com sucesso') }} />}
    {toast && <div className="toast"><Check size={17} />{toast}</div>}
  </div>
}

function InventoryTable({ items: rows, onNotify, onAuctionChange }: { items: Item[]; onNotify: (message: string) => void; onAuctionChange: (id: string, value: boolean) => void | Promise<void> }) {
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null)

  return <div className="table-scroll"><table className="inventory-table"><thead><tr><th>ITEM</th><th>IDENTIFICAÇÃO</th><th>CADASTRO</th><th>CATEGORIAS</th><th>STATUS</th><th>LEILOADO</th><th /></tr></thead><tbody>{rows.map((item) => { const isAuctioned = item.auction; return <tr key={item.id}><td><div className="item-cell"><div className="item-thumb"><Box size={17} /></div><div><strong>{item.item}</strong><small>{item.id} · {item.type}</small></div></div></td><td><span className="mono">{item.serial}</span><small className="table-sub">{item.tag}</small></td><td><span>{item.date}</span><small className="table-sub">{item.age === 'hoje' ? 'Cadastrado hoje' : `Há ${item.age}`}</small></td><td><div className="tag-list">{item.categories.slice(0, 2).map((category) => <span key={category} className="table-tag">{category}</span>)}</div></td><td><span className={`status-badge ${item.status === 'Retirado' ? 'retired' : ''}`}><i />{item.status}</span></td><td>{isAuctioned ? <span className="auction-yes"><Gavel size={13} />Sim</span> : <span className="auction-no">Não</span>}</td><td><button className="row-menu" data-popover-trigger aria-haspopup="dialog" aria-label={`Marcar ${item.id} como leiloado`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenu((current) => (current?.id === item.id ? null : { id: item.id, rect })) }}>•••</button></td></tr> })}</tbody></table>{rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum item cadastrado ainda. Use o botão “Novo item” para começar.</p>}{menu && <FloatingPanel anchor={menu.rect} width={188} label={`Marcar ${menu.id} como leiloado`} onClose={() => setMenu(null)}>
  <p className="mb-2 text-sm font-medium text-slate-800">O item {menu.id} foi leiloado?</p>
  <div className="flex gap-2">
    {([['Sim', true], ['Não', false]] as const).map(([label, value]) => <button key={label} className={`${(rows.find((row) => row.id === menu.id)?.auction ?? false) === value ? 'primary-button' : 'secondary-button'} small flex-1 justify-center`} onClick={() => { onAuctionChange(menu.id, value); onNotify(`${menu.id}: leiloado marcado como ${label}`); setMenu(null) }}>{label}</button>)}
  </div>
</FloatingPanel>}</div>
}

function NewItemModal({ onClose, onSave }: { onClose: () => void; onSave: (data: NewItemData) => Promise<void> }) {
  const [form, setForm] = useState<NewItemData>({
    name: '',
    type: '',
    model: '',
    tag: '',
    serial: '',
    serviceTag: '',
    registeredAt: new Date().toLocaleDateString('en-CA'),
    categories: ['Sem garantia'],
  })
  const [customType, setCustomType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Lista de tipos incluindo a opção "Outro"
  const itemTypesWithOptions = [...itemTypes, 'Outro']

  const update = (field: keyof Omit<NewItemData, 'categories'>, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const toggleCategory = (label: string) => setForm((current) => ({
    ...current,
    categories: current.categories.includes(label) ? current.categories.filter((name) => name !== label) : [...current.categories, label],
  }))

  const submit = async () => {
    // Define o tipo final: se for 'Outro', utiliza o valor digitado no campo personalizado
    const finalType = form.type === 'Outro' ? customType.trim() : form.type

    if (!form.name.trim() || !finalType) { 
      setError('Informe o nome e o tipo do item.'); 
      return 
    }

    setSaving(true)
    setError('')
    try {
      await onSave({
        ...form,
        type: finalType
      })
    } catch {
      setError('Não foi possível salvar o item. Tente novamente.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <p className="eyebrow">NOVO REGISTRO</p>
            <h2>Cadastrar inservível</h2>
            <p>Informe os dados para adicionar um material ao estoque.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="form-grid">
          <label>
            Nome do item
            <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ex.: Notebook Dell Latitude" />
          </label>

          <label>
            Tipo de item
            <select value={form.type} onChange={(event) => update('type', event.target.value)}>
              <option value="" disabled>Selecione</option>
              {itemTypesWithOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          {/* Campo de texto extra exibido apenas se selecionar "Outro" */}
          {form.type === 'Outro' && (
            <label className="col-span-2">
              Especifique o tipo de item
              <input 
                value={customType} 
                onChange={(event) => setCustomType(event.target.value)} 
                placeholder="Digite o tipo de item (Ex.: Hub Switch, Nobreak, etc.)" 
                autoFocus
              />
            </label>
          )}

          <label>
            Modelo
            <input value={form.model} onChange={(event) => update('model', event.target.value)} placeholder="Ex.: Latitude 5420" />
          </label>

          <label>
            Patrimônio
            <input value={form.tag} onChange={(event) => update('tag', event.target.value)} placeholder="Ex.: PAT-004218" />
          </label>

          <label>
            Serial number
            <input value={form.serial} onChange={(event) => update('serial', event.target.value)} placeholder="Informe o serial" />
          </label>

          <label>
            Data de cadastro
            <input type="date" value={form.registeredAt} onChange={(event) => update('registeredAt', event.target.value)} />
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Categorias do item</p>
          <div className="flex flex-wrap gap-2">
            {['Com patrimônio', 'Sem patrimônio', 'Sem garantia', 'Funcionais'].map((category) => (
              <button 
                key={category} 
                type="button" 
                className={`px-3 py-1.5 rounded-md text-xs font-medium border ${form.categories.includes(category) ? 'bg-[#234e70] text-white border-[#234e70]' : 'bg-slate-50 text-slate-700 border-slate-200'}`} 
                onClick={() => toggleCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="modal-foot">
          <button className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={saving} onClick={submit}>
            {saving ? 'Salvando...' : 'Cadastrar item'}
          </button>
        </div>
      </div>
    </div>
  )
}