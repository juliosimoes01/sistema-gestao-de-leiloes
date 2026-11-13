'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Archive,
  ArrowDownToLine,
  Bell,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock,
  ClipboardList,
  FileDown,
  Filter,
  Gavel,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { signOut } from 'firebase/auth'
import {
  collection,
  deleteDoc,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Group = 'Inservíveis' | 'Estoque'

type MetricFilterKey =
  | 'inserviveis'
  | 'estoque'
  | 'aguardandoLeilao'
  | 'cadastradosMes'
  | 'descartados'

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
  group: Group
  discarded: boolean
  withdrawn: boolean
  withdrawnQuantity: number
  quantity: number
  model: string
  serviceTag: string
  image: string
  edited?: boolean
  updatedAt?: string
}

type NewItemData = {
  group: Group
  name: string
  type: string
  model: string
  tag: string
  serial: string
  serviceTag: string
  registeredAt: string
  categories: string[]
  quantity: number
  image: string
}

const itemTypes = [
  'Monitores',
  'Teclados com fio',
  'Teclados sem fio',
  'Mouses com fio',
  'Mouses sem fio',
  'Dockstations',
  'APs',
  'Telefones',
  'Placas de circuito',
  'Placas de vídeo',
  'Baterias',
  'Memória RAM',
  'HDs',
  'Fontes',
  'Extensões de tomada',
  'Webcams',
  'Impressoras',
  'Leitores de DVD',
]

const PIE_COLORS = [
  '#4a7fa7',
  '#3f8f8b',
  '#7fa87f',
  '#d9a95f',
  '#d38a7e',
  '#9a8cc4',
  '#7c8da0',
  '#b5b86a',
]

const GROUPS: Group[] = ['Inservíveis', 'Estoque']

const SUBCATEGORIES: Record<
  Group,
  { label: string; icon: typeof Tag; color: string }[]
> = {
  Inservíveis: [
    { label: 'Com patrimônio', icon: Tag, color: 'bg-[#4a7fa7]' },
    { label: 'Sem patrimônio', icon: Box, color: 'bg-[#7fa87f]' },
    { label: 'Sem garantia', icon: ShieldAlert, color: 'bg-[#d9a95f]' },
    { label: 'Funcionais', icon: PackageCheck, color: 'bg-[#3f8f8b]' },
  ],
  Estoque: [
    { label: 'Com patrimônio', icon: Tag, color: 'bg-[#4a7fa7]' },
    { label: 'Pendente patrimoniar', icon: Clock, color: 'bg-[#d9a95f]' },
    { label: 'Sem patrimônio', icon: Box, color: 'bg-[#7fa87f]' },
  ],
}

const DEFAULT_SUBCATEGORY: Record<Group, string> = {
  Inservíveis: 'Sem garantia',
  Estoque: 'Com patrimônio',
}

function formatDate(isoDate?: string) {
  if (!isoDate) return ''

  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function ageFrom(isoDate?: string) {
  if (!isoDate) return ''

  const days = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(`${isoDate}T00:00:00`).getTime()) / 86400000,
    ),
  )

  if (days < 1) return 'hoje'
  if (days < 30) return `${days} ${days === 1 ? 'dia' : 'dias'}`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`

  const years = Math.floor(months / 12)
  return `${years} ${years === 1 ? 'ano' : 'anos'}`
}

async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido.')
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = new Image()

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'))
      image.src = objectUrl
    })

    let scale = Math.min(1, 720 / Math.max(image.width, image.height))
    let quality = 0.76
    let dataUrl = ''

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))

      const context = canvas.getContext('2d')
      if (!context) throw new Error('Não foi possível processar a imagem.')

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      dataUrl = canvas.toDataURL('image/jpeg', quality)

      // Mantém a imagem compacta para não ultrapassar o limite do Firestore.
      if (dataUrl.length <= 260_000) return dataUrl

      if (quality > 0.5) {
        quality -= 0.1
      } else {
        scale *= 0.8
      }
    }

    if (!dataUrl) throw new Error('Não foi possível comprimir a imagem.')
    return dataUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
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
    group: data.group === 'Estoque' ? 'Estoque' : 'Inservíveis',
    discarded: Boolean(data.discarded),
    withdrawn: Boolean(data.withdrawn),
    withdrawnQuantity: Math.max(0, Number(data.withdrawnQuantity) || 0),
    quantity:
      data.quantity == null
        ? 1
        : Math.max(0, Number(data.quantity) || 0),
    model: data.model ?? '',
    serviceTag: data.serviceTag ?? '',
    image: data.image ?? '',
    edited: Boolean(data.edited || data.updatedAt),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  }
}

async function createItem(data: NewItemData) {
  const isStock = data.group === 'Estoque'
  const counterRef = doc(db, 'counters', isStock ? 'estoque' : 'inserviveis')
  const itemRef = doc(collection(db, 'inserviveis'))

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef)
    const next = (snapshot.exists() ? Number(snapshot.data().value) : 0) + 1
    const year = data.registeredAt.slice(0, 4) || String(new Date().getFullYear())

    transaction.set(counterRef, { value: next })
    transaction.set(itemRef, {
      code: `${isStock ? 'EST' : 'INV'}-${year}-${String(next).padStart(4, '0')}`,
      name: data.name.trim(),
      type: data.type,
      model: data.model.trim(),
      tag: data.tag.trim(),
      serial: data.serial.trim(),
      serviceTag: data.serviceTag.trim(),
      registeredAt: data.registeredAt,
      status: 'Armazenado',
      group: data.group,
      categories: data.categories,
      quantity: Math.max(1, Number(data.quantity) || 1),
      image: data.image,
      auction: false,
      discarded: false,
      withdrawn: false,
      edited: false,
      createdAt: serverTimestamp(),
    })
  })
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'blue',
  onClick,
}: {
  label: string
  value: string | number
  detail: string
  icon: typeof Box
  tone?: string
  onClick?: () => void
}) {
  const tones: Record<string, string> = {
    blue: 'bg-[#e6f0f7] text-[#3b6f94]',
    green: 'bg-[#e8f3ee] text-[#3f7d63]',
    amber: 'bg-[#fbf1de] text-[#a9741f]',
    navy: 'bg-[#eaeff2] text-[#4b6070]',
    red: 'bg-[#fbebe8] text-[#b5604f]',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="metric-card w-full cursor-pointer text-left transition duration-150 hover:-translate-y-0.5 hover:border-[#9cc8e2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#3685b7]"
    >
      <div className={`metric-icon ${tones[tone]}`}>
        <Icon size={19} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-detail">{detail}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-slate-400" />
    </button>
  )
}

type ReportRow = Record<
  | 'id'
  | 'item'
  | 'group'
  | 'type'
  | 'serial'
  | 'tag'
  | 'date'
  | 'age'
  | 'status'
  | 'categories'
  | 'auction'
  | 'quantity',
  string
>

const reportColumns: {
  header: string
  key: keyof ReportRow
  width: number
}[] = [
  { header: 'ID', key: 'id', width: 16 },
  { header: 'Item', key: 'item', width: 34 },
  { header: 'Categoria', key: 'group', width: 14 },
  { header: 'Tipo', key: 'type', width: 16 },
  { header: 'Quantidade', key: 'quantity', width: 12 },
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
    group: item.group,
    type: item.type,
    quantity: String(item.quantity),
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
    ...rows.map((row) =>
      reportColumns.map((column) => cell(row[column.key])).join(';'),
    ),
  ]

  saveBlob(
    new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
    `${filename}.csv`,
  )
}

function exportQuantitiesCsv(items: Item[], filename: string) {
  const totals = new Map<string, number>()

  items.forEach((item) => {
    const type = item.type || 'Outros'
    totals.set(type, (totals.get(type) ?? 0) + item.quantity)
  })

  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }

  const lines = [
    `${cell('Tipo')};${cell('Quantidade')}`,
    ...Array.from(totals.entries()).map(
      ([type, quantity]) => `${cell(type)};${quantity}`,
    ),
  ]

  saveBlob(
    new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
    `${filename}.csv`,
  )
}

async function exportXlsx(rows: ReportRow[], filename: string) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Ativos')

  sheet.addTable({
    name: 'Ativos',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: reportColumns.map((column) => ({
      name: column.header,
      filterButton: true,
    })),
    rows: rows.map((row) => reportColumns.map((column) => row[column.key])),
  })

  reportColumns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width
  })

  const buffer = await workbook.xlsx.writeBuffer()

  saveBlob(
    new Blob([buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filename}.xlsx`,
  )
}

async function exportPdf(
  rows: ReportRow[],
  filename: string,
  filterLabel: string,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const clean = (value: string) => value.replace(/—/g, '-')

  doc.setFontSize(16)
  doc.setTextColor(35, 78, 112)
  doc.text('Relatório de ativos', 40, 44)

  doc.setFontSize(9)
  doc.setTextColor(104, 119, 134)
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${rows.length} ${
      rows.length === 1 ? 'item' : 'itens'
    } · ${filterLabel}`,
    40,
    62,
  )

  autoTable(doc, {
    startY: 78,
    head: [reportColumns.map((column) => column.header)],
    body: rows.map((row) =>
      reportColumns.map((column) => clean(row[column.key])),
    ),
    styles: { fontSize: 8, cellPadding: 5, textColor: [45, 55, 65] },
    headStyles: {
      fillColor: [35, 78, 112],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [244, 247, 248] },
    margin: { left: 40, right: 40, bottom: 40 },
  })

  const totalPages = doc.getNumberOfPages()
  doc.setFontSize(8)
  doc.setTextColor(132, 144, 154)

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page)
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - 40, pageHeight - 20, {
      align: 'right',
    })
  }

  doc.save(`${filename}.pdf`)
}

function FloatingPanel({
  anchor,
  width,
  label,
  onClose,
  children,
}: {
  anchor: DOMRect
  width: number
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null

      if (
        ref.current?.contains(target) ||
        target?.closest('[data-popover-trigger]')
      ) {
        return
      }

      onClose()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

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

  const left = Math.min(
    Math.max(8, anchor.right - width),
    window.innerWidth - width - 8,
  )
  const openUp = window.innerHeight - anchor.bottom < 240 && anchor.top > 240
  const position = openUp
    ? { bottom: window.innerHeight - anchor.top + 6 }
    : { top: anchor.bottom + 6 }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
      style={{
        position: 'fixed',
        zIndex: 60,
        width,
        left,
        ...position,
      }}
    >
      {children}
    </div>
  )
}

const MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

const PERIOD_OPTIONS = ['2026-2027', '2027-2028', '2028-2029', '2029-2030']

function buildPeriodSeries(list: Item[], period: string) {
  const monthMap: Record<string, number> = {}

  list.forEach((item) => {
    if (!item.rawRegisteredAt) return

    const [year, month] = item.rawRegisteredAt.split('-')
    const monthIndex = parseInt(month, 10) - 1

    if (monthIndex >= 0 && monthIndex < 12) {
      const key = `${year} ${MONTH_NAMES[monthIndex]}`
      monthMap[key] = (monthMap[key] || 0) + 1
    }
  })

  const [start, end] = period.split('-').map(Number)
  const result: { name: string; cadastrados: number }[] = []

  for (let year = start; year <= end; year++) {
    MONTH_NAMES.forEach((month) => {
      const key = `${year} ${month}`
      result.push({ name: key, cadastrados: monthMap[key] || 0 })
    })
  }

  return result
}

function buildTypeDistribution(list: Item[]) {
  const counts: Record<string, number> = {}

  list.forEach((item) => {
    const type = item.type || 'Outros'
    counts[type] = (counts[type] || 0) + item.quantity
  })

  return Object.entries(counts).map(([name, value], index) => ({
    name,
    value,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }))
}

function MovementPanel({
  title,
  data,
  period,
  onPeriodChange,
  color,
}: {
  title: string
  data: { name: string; cadastrados: number }[]
  period: string
  onPeriodChange: (value: string) => void
  color: string
}) {
  return (
    <div className="panel large-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>Itens cadastrados por mês</p>
        </div>

        <label className="period-select">
          <span className="sr-only">Período do gráfico</span>
          <select
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace('-', '–')} · mensal
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>

      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
            barGap={7}
          >
            <CartesianGrid vertical={false} stroke="#dde5ea" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#5f7080', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#5f7080', fontSize: 12 }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: '#f4f7f8' }}
              contentStyle={{
                border: '1px solid #e1e8ec',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="cadastrados"
              name="Cadastrados"
              fill={color}
              radius={[4, 4, 0, 0]}
              barSize={16}
              background={{ fill: '#eef3f6' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-legend">
        <span>
          <i className="legend-blue" style={{ backgroundColor: color }} />
          Itens cadastrados
        </span>
        <span className="chart-total">
          Total no período:{' '}
          {data.reduce((sum, entry) => sum + entry.cadastrados, 0)}
        </span>
      </div>
    </div>
  )
}

function DistributionPanel({
  title,
  subtitle,
  data,
  total,
}: {
  title: string
  subtitle: string
  data: { name: string; value: number; color: string }[]
  total: number
}) {
  const chartData =
    data.length > 0
      ? data
      : [{ name: 'Sem itens', value: 1, color: '#e3eaee' }]

  return (
    <div className="panel category-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="pie-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="48%"
              innerRadius={52}
              outerRadius={88}
              paddingAngle={2}
              dataKey="value"
              stroke="#ffffff"
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            {data.length > 0 && (
              <Tooltip
                contentStyle={{
                  border: '1px solid #e1e8ec',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>

        <div className="pie-center">
          <strong>{total}</strong>
          <span>itens</span>
        </div>
      </div>

      <div className="category-legend">
        {data.map((entry) => (
          <div key={entry.name}>
            <span>
              <i style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <strong>{entry.value}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function getTypeIllustration(type: string) {
  const normalized = type.toLowerCase()

  if (normalized.includes('teclado')) return '⌨️'
  if (normalized.includes('mouse')) return '🖱️'
  if (normalized.includes('monitor')) return '🖥️'
  if (normalized.includes('telefone')) return '☎️'
  if (normalized.includes('bateria')) return '🔋'
  if (normalized.includes('impressora')) return '🖨️'
  if (normalized.includes('webcam')) return '📷'
  if (normalized.includes('memória')) return '💾'
  if (normalized.includes('hd')) return '💽'
  if (normalized.includes('placa')) return '🔌'

  return '📦'
}

function ItemsByType({ items }: { items: Item[] }) {
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const groups = useMemo(() => {
    const result = new Map<string, { items: Item[]; quantity: number }>()

    items
      .filter((item) => !item.discarded && !item.withdrawn)
      .forEach((item) => {
        const type = item.type || 'Outros'
        const current = result.get(type) ?? { items: [], quantity: 0 }

        current.items.push(item)
        current.quantity += item.quantity
        result.set(type, current)
      })

    return Array.from(result.entries()).sort(([first], [second]) =>
      first.localeCompare(second),
    )
  }, [items])

  const selectedGroup = selectedType
    ? groups.find(([type]) => type === selectedType)
    : undefined

  return (
    <>
      {groups.length === 0 ? (
        <div className="panel p-8 text-center text-slate-500">
          Nenhum item cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(([type, group]) => {
            const itemsWithPhoto = group.items.filter((entry) => entry.image)
            const coverImage = itemsWithPhoto[0]?.image

            return (
              <button
                key={type}
                type="button"
                className="panel flex w-full cursor-pointer flex-col overflow-hidden p-0 text-left transition duration-150 hover:-translate-y-1 hover:border-[#9cc8e2] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#3685b7]"
                onClick={() => setSelectedType(type)}
                aria-label={`Abrir registros do tipo ${type}`}
              >
                <div className="relative flex h-64 w-full items-center justify-center overflow-hidden border-b border-slate-100 bg-gradient-to-br from-[#dceeff] to-[#c8f0e4]">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt={type}
                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    />
                  ) : (
                    <span className="text-8xl" aria-hidden="true">
                      {getTypeIllustration(type)}
                    </span>
                  )}

                  <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-bold text-[#24744f] shadow-sm backdrop-blur-sm">
                    {group.quantity}{' '}
                    {group.quantity === 1 ? 'unidade' : 'unidades'}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-slate-800">
                        {type}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {group.items.length}{' '}
                        {group.items.length === 1
                          ? 'registro cadastrado'
                          : 'registros cadastrados'}
                      </p>
                    </div>

                    <ChevronRight
                      size={20}
                      className="mt-1 shrink-0 text-slate-400"
                    />
                  </div>

                  {itemsWithPhoto.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Fotos cadastradas ({itemsWithPhoto.length})
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {itemsWithPhoto.slice(0, 4).map((entry) => (
                          <div
                            key={entry.docId}
                            className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-xs"
                          >
                            <img
                              src={entry.image}
                              alt={entry.item}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                        {itemsWithPhoto.length > 4 && (
                          <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                            +{itemsWithPhoto.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-[#2875a5]">
                    Clique para visualizar todos os registros e fotos
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedGroup && (
        <TypeItemsModal
          type={selectedGroup[0]}
          items={selectedGroup[1].items}
          onClose={() => setSelectedType(null)}
        />
      )}
    </>
  )
}

function TypeItemsModal({
  type,
  items,
  onClose,
}: {
  type: string
  items: Item[]
  onClose: () => void
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal-card w-full max-w-4xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Registros de ${type}`}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">ITENS POR TIPO</p>
            <h2>{type}</h2>
            <p>
              {items.reduce((total, item) => total + item.quantity, 0)} unidades
              · {items.length} {items.length === 1 ? 'registro' : 'registros'}
            </p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar registros"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          {items.map((item) => (
            <article
              key={item.docId}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-[#eaf4fb] to-[#e6f6ef] text-5xl sm:w-40">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={`Imagem de ${item.item}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getTypeIllustration(type)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">
                        {item.item}
                      </h3>
                      <p className="text-xs text-slate-500">
                        ID: {item.id} · Cadastrado em {item.date || '—'}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#e4f2ec] px-3 py-1 text-sm font-semibold text-[#24744f]">
                      Qtd.: {item.quantity}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <dt className="text-xs text-slate-500">Categoria</dt>
                      <dd className="font-medium text-slate-700">
                        {item.group}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Modelo</dt>
                      <dd className="font-medium text-slate-700">
                        {item.model || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Patrimônio</dt>
                      <dd className="font-medium text-slate-700">
                        {item.tag || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Serial number</dt>
                      <dd className="font-medium text-slate-700">
                        {item.serial || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Service tag</dt>
                      <dd className="font-medium text-slate-700">
                        {item.serviceTag || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Status</dt>
                      <dd className="font-medium text-slate-700">
                        {item.status || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">
                        Quantidade já retirada
                      </dt>
                      <dd className="font-medium text-slate-700">
                        {item.withdrawnQuantity}
                      </dd>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <dt className="text-xs text-slate-500">Subcategorias</dt>
                      <dd className="font-medium text-slate-700">
                        {item.categories.length > 0
                          ? item.categories.join(', ')
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="modal-foot">
          <button
            type="button"
            className="primary-button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function MetricItemsModal({
  title,
  subtitle,
  items,
  onClose,
}: {
  title: string
  subtitle: string
  items: Item[]
  onClose: () => void
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal-card w-full max-w-4xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">VISÃO GERAL · DETALHAMENTO</p>
            <h2>{title}</h2>
            <p>
              {subtitle} · {items.length}{' '}
              {items.length === 1 ? 'item encontrado' : 'itens encontrados'}
            </p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar janela"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Nenhum item relacionado a este indicador no momento.
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.docId}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-[#eaf4fb] to-[#e6f6ef] text-3xl">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.item}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getTypeIllustration(item.type)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-800">
                            {item.item}
                          </h3>
                          {item.edited && (
                            <span className="rounded-full bg-[#fbf1de] px-2 py-0.5 text-[11px] font-semibold text-[#a9741f]">
                              Editado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {item.id} · {item.type || 'Outros'} · Cadastrado em{' '}
                          {item.date || '—'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#e6f0f7] px-2.5 py-1 text-xs font-semibold text-[#3b6f94]">
                          {item.group}
                        </span>
                        <span className="rounded-full bg-[#e4f2ec] px-2.5 py-1 text-xs font-semibold text-[#24744f]">
                          Qtd.: {item.quantity}
                        </span>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-slate-400">Patrimônio</dt>
                        <dd className="font-medium text-slate-700">
                          {item.tag || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Serial</dt>
                        <dd className="font-medium text-slate-700">
                          {item.serial || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Status</dt>
                        <dd className="font-medium text-slate-700">
                          {item.status}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">Leiloado</dt>
                        <dd className="font-medium text-slate-700">
                          {item.auction ? 'Sim' : 'Não'}
                        </dd>
                      </div>
                    </dl>

                    {item.categories.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {item.categories.map((cat) => (
                          <span
                            key={cat}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="modal-foot">
          <button
            type="button"
            className="primary-button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryDashboard() {
  const [activeSection, setActiveSection] = useState('Visão geral')
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<Group, boolean>>({
    Inservíveis: false,
    Estoque: false,
  })
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null)
  const [downloadAnchor, setDownloadAnchor] = useState<DOMRect | null>(null)
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showWithdrawal, setShowWithdrawal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [selectedMetricModal, setSelectedMetricModal] =
    useState<MetricFilterKey | null>(null)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('2026-2027')
  const [stockPeriod, setStockPeriod] = useState('2026-2027')
  const [items, setItems] = useState<Item[]>([])

  const activeCategory =
    selectedCategories.length === 1
      ? `${selectedGroup ? `${selectedGroup} · ` : ''}${selectedCategories[0]}`
      : selectedCategories.length > 1
        ? `${selectedCategories.length} subcategorias`
        : selectedGroup ?? 'Todos os itens'

  useEffect(() => {
    const itemsQuery = firestoreQuery(
      collection(db, 'inserviveis'),
      orderBy('createdAt', 'desc'),
    )

    return onSnapshot(
      itemsQuery,
      (snapshot) =>
        setItems(snapshot.docs.map((entry) => toItem(entry.id, entry.data()))),
      () => setToast('Não foi possível carregar os itens'),
    )
  }, [])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const activeItems = useMemo(
    () => items.filter((item) => !item.discarded && !item.withdrawn),
    [items],
  )

  const inserviveisItems = useMemo(
    () => activeItems.filter((item) => item.group === 'Inservíveis'),
    [activeItems],
  )

  const estoqueItems = useMemo(
    () => activeItems.filter((item) => item.group === 'Estoque'),
    [activeItems],
  )

  const subcategoryTree = useMemo(
    () =>
      GROUPS.map((group) => {
        const groupItems =
          group === 'Estoque' ? estoqueItems : inserviveisItems

        return {
          group,
          total: groupItems.reduce((sum, item) => sum + item.quantity, 0),
          subs: SUBCATEGORIES[group].map((sub) => ({
            ...sub,
            count: groupItems
              .filter((item) => item.categories.includes(sub.label))
              .reduce((sum, item) => sum + item.quantity, 0),
          })),
        }
      }),
    [inserviveisItems, estoqueItems],
  )

  const totalInserviveis = inserviveisItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  )

  const totalEstoque = estoqueItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  )

  const discardedItemsList = useMemo(
    () => items.filter((item) => item.discarded),
    [items],
  )

  const descartadosCount = useMemo(
    () => discardedItemsList.reduce((sum, item) => sum + item.quantity, 0),
    [discardedItemsList],
  )

  const aguardandoLeilaoItemsList = useMemo(
    () =>
      inserviveisItems.filter(
        (item) => item.categories.includes('Sem garantia') && !item.auction,
      ),
    [inserviveisItems],
  )

  const aguardandoLeilaoCount = useMemo(
    () =>
      aguardandoLeilaoItemsList.reduce((sum, item) => sum + item.quantity, 0),
    [aguardandoLeilaoItemsList],
  )

  const cadastradosNoMesItemsList = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `${currentYear}-${currentMonth}`

    return items.filter(
      (item) =>
        item.rawRegisteredAt && item.rawRegisteredAt.startsWith(prefix),
    )
  }, [items])

  const cadastradosNoMesCount = useMemo(
    () =>
      cadastradosNoMesItemsList.reduce((sum, item) => sum + item.quantity, 0),
    [cadastradosNoMesItemsList],
  )

  const metricModalData = useMemo(() => {
    if (!selectedMetricModal) return null

    const sortEditedFirst = (list: Item[]) =>
      [...list].sort((a, b) => Number(Boolean(b.edited)) - Number(Boolean(a.edited)))

    switch (selectedMetricModal) {
      case 'inserviveis':
        return {
          title: 'Total de Inservíveis',
          subtitle: 'Itens ativos classificados como inservíveis',
          items: sortEditedFirst(inserviveisItems),
        }
      case 'estoque':
        return {
          title: 'Total de Estoque',
          subtitle: 'Itens ativos disponíveis no estoque',
          items: sortEditedFirst(estoqueItems),
        }
      case 'aguardandoLeilao':
        return {
          title: 'Aguardando leilão',
          subtitle: 'Inservíveis sem garantia ainda não leiloados',
          items: sortEditedFirst(aguardandoLeilaoItemsList),
        }
      case 'cadastradosMes':
        return {
          title: 'Cadastrados no mês',
          subtitle: 'Itens de inservíveis e estoque registrados neste mês',
          items: sortEditedFirst(cadastradosNoMesItemsList),
        }
      case 'descartados':
        return {
          title: 'Itens Descartados',
          subtitle: 'Materiais marcados como descartados no sistema',
          items: sortEditedFirst(discardedItemsList),
        }
    }
  }, [
    selectedMetricModal,
    inserviveisItems,
    estoqueItems,
    aguardandoLeilaoItemsList,
    cadastradosNoMesItemsList,
    discardedItemsList,
  ])

  const deleteItem = async (docId: string, itemId: string) => {
    try {
      await deleteDoc(doc(db, 'inserviveis', docId))
      notify(`Item ${itemId} excluído com sucesso`)
    } catch {
      notify('Não foi possível excluir o item')
    }
  }

  const setDiscarded = async (
    docId: string,
    itemId: string,
    value: boolean,
  ) => {
    try {
      await updateDoc(doc(db, 'inserviveis', docId), {
        discarded: value,
        status: value ? 'Descartado' : 'Armazenado',
        edited: true,
        updatedAt: serverTimestamp(),
      })
      notify(value ? `Item ${itemId} descartado` : `Item ${itemId} restaurado`)
    } catch {
      notify('Não foi possível atualizar o item')
    }
  }

  const updateItem = async (docId: string, data: NewItemData) => {
    await updateDoc(doc(db, 'inserviveis', docId), {
      name: data.name.trim(),
      type: data.type,
      model: data.model.trim(),
      tag: data.tag.trim(),
      serial: data.serial.trim(),
      serviceTag: data.serviceTag.trim(),
      registeredAt: data.registeredAt,
      group: data.group,
      categories: data.categories,
      quantity: Math.max(1, Number(data.quantity) || 1),
      image: data.image,
      edited: true,
      updatedAt: serverTimestamp(),
    })
  }

  const registerWithdrawal = async (type: string, requestedQuantity: number) => {
    const candidates = items
      .filter(
        (item) =>
          (item.type || 'Outros') === type &&
          !item.discarded &&
          !item.withdrawn &&
          item.quantity > 0,
      )
      .sort((first, second) =>
        first.rawRegisteredAt.localeCompare(second.rawRegisteredAt),
      )

    const availableQuantity = candidates.reduce(
      (total, item) => total + item.quantity,
      0,
    )

    if (requestedQuantity > availableQuantity) {
      throw new Error(
        `Quantidade indisponível. Existem ${availableQuantity} unidade(s) desse tipo.`,
      )
    }

    const withdrawalRef = doc(collection(db, 'withdrawals'))

    await runTransaction(db, async (transaction) => {
      const snapshots = await Promise.all(
        candidates.map((item) =>
          transaction.get(doc(db, 'inserviveis', item.docId)),
        ),
      )

      const currentRecords = snapshots
        .map((snapshot, index) => ({
          snapshot,
          item: candidates[index],
        }))
        .filter(({ snapshot }) => snapshot.exists())

      const currentAvailable = currentRecords.reduce((total, record) => {
        const data = record.snapshot.data() ?? {}
        if (data.discarded || data.withdrawn) return total
        return total + Math.max(0, Number(data.quantity) || 0)
      }, 0)

      if (requestedQuantity > currentAvailable) {
        throw new Error(
          `Estoque alterado durante a operação. Disponível agora: ${currentAvailable} unidade(s).`,
        )
      }

      let remaining = requestedQuantity
      const affectedRecords: {
        docId: string
        itemId: string
        quantity: number
      }[] = []

      for (const { snapshot, item } of currentRecords) {
        if (remaining <= 0) break

        const data = snapshot.data() ?? {}
        if (data.discarded || data.withdrawn) continue

        const currentQuantity = Math.max(0, Number(data.quantity) || 0)
        if (currentQuantity <= 0) continue

        const quantityToWithdraw = Math.min(currentQuantity, remaining)
        const newQuantity = currentQuantity - quantityToWithdraw

        transaction.update(snapshot.ref, {
          quantity: newQuantity,
          withdrawn: newQuantity === 0,
          status: newQuantity === 0 ? 'Retirado' : data.status || 'Armazenado',
          edited: true,
          lastWithdrawalAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          withdrawnQuantity:
            (Number(data.withdrawnQuantity) || 0) + quantityToWithdraw,
        })

        affectedRecords.push({
          docId: item.docId,
          itemId: item.id,
          quantity: quantityToWithdraw,
        })

        remaining -= quantityToWithdraw
      }

      transaction.set(withdrawalRef, {
        type,
        quantity: requestedQuantity,
        records: affectedRecords,
        createdAt: serverTimestamp(),
      })
    })

    notify(
      `Retirada de ${requestedQuantity} unidade(s) de ${type} registrada com sucesso.`,
    )
  }

  const pieInserviveis = useMemo(
    () => buildTypeDistribution(inserviveisItems),
    [inserviveisItems],
  )

  const pieEstoque = useMemo(
    () => buildTypeDistribution(estoqueItems),
    [estoqueItems],
  )

  const periodInserviveis = useMemo(
    () =>
      buildPeriodSeries(
        items.filter((item) => item.group === 'Inservíveis'),
        selectedPeriod,
      ),
    [items, selectedPeriod],
  )

  const periodEstoque = useMemo(
    () =>
      buildPeriodSeries(
        items.filter((item) => item.group === 'Estoque'),
        stockPeriod,
      ),
    [items, stockPeriod],
  )

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesQuery = `${item.item} ${item.id} ${item.serial} ${item.tag}`
          .toLowerCase()
          .includes(query.toLowerCase())

        const matchesCategory =
          selectedCategories.length === 0 ||
          item.categories.some((category) =>
            selectedCategories.includes(category),
          )

        const matchesGroup =
          selectedGroup === null || item.group === selectedGroup

        return matchesQuery && matchesCategory && matchesGroup
      }),
    [items, query, selectedCategories, selectedGroup],
  )

  const setAuction = async (id: string, value: boolean) => {
    const target = items.find((entry) => entry.id === id)
    if (!target) return

    try {
      await updateDoc(doc(db, 'inserviveis', target.docId), {
        auction: value,
        edited: true,
        updatedAt: serverTimestamp(),
      })
    } catch {
      notify('Não foi possível salvar a alteração')
    }
  }

  const downloadReport = async (format: string) => {
    const normalized = format.toLowerCase()
    const kind = normalized.includes('csv')
      ? 'csv'
      : normalized.includes('pdf')
        ? 'pdf'
        : /xls|excel/.test(normalized)
          ? 'xlsx'
          : null

    if (!kind) {
      notify(`Relatório ${format.toUpperCase()} preparado para download`)
      return
    }

    if (filteredItems.length === 0) {
      notify('Nenhum item para exportar com os filtros atuais')
      return
    }

    const rows = buildReportRows(filteredItems)
    const filename = `relatorio-ativos-${new Date().toLocaleDateString('en-CA')}`
    const filterLabel = [
      selectedGroup ? `Categoria: ${selectedGroup}` : 'Todas as categorias',
      selectedCategories.length > 0
        ? `Subcategorias: ${selectedCategories.join(', ')}`
        : '',
      query.trim() ? `Busca: "${query.trim()}"` : '',
    ]
      .filter(Boolean)
      .join(' · ')

    try {
      if (kind === 'csv') exportCsv(rows, filename)
      else if (kind === 'pdf') await exportPdf(rows, filename, filterLabel)
      else await exportXlsx(rows, filename)

      notify(
        `Relatório ${
          kind === 'csv' ? 'CSV' : kind === 'pdf' ? 'PDF' : 'Excel'
        } baixado`,
      )
    } catch {
      notify('Não foi possível gerar o relatório')
    }
  }

  const downloadQuantities = () => {
    if (filteredItems.length === 0) {
      notify('Nenhum item para exportar com os filtros atuais')
      return
    }

    const filename = `quantitativos-por-tipo-${new Date().toLocaleDateString(
      'en-CA',
    )}`

    exportQuantitiesCsv(filteredItems, filename)
    notify('Quantitativos por tipo exportados')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${showMobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Box size={21} />
          </div>
          <div>
            <strong>Gestão de Ativos</strong>
            <small>Inservíveis e estoque</small>
          </div>
          <button
            className="mobile-close"
            onClick={() => setShowMobileNav(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="main-nav" aria-label="Navegação principal">
          <p className="nav-caption">GESTÃO</p>

          {[
            ['Visão geral', LayoutDashboard],
            ['Inventário', ClipboardList],
            ['Itens por tipo', Box],
          ].map(([label, Icon]) => (
            <button
              key={label as string}
              className={`nav-link ${
                activeSection === label ? 'active' : ''
              }`}
              onClick={() => {
                setActiveSection(label as string)
                setShowMobileNav(false)
              }}
            >
              <Icon size={18} />
              {label as string}
            </button>
          ))}

          <p className="nav-caption nav-caption-spaced">CATEGORIAS</p>

          {subcategoryTree.map(({ group, total, subs }) => {
            const GroupIcon = group === 'Estoque' ? Archive : Box
            const groupSelected =
              selectedGroup === group && selectedCategories.length === 0
            const open = expandedGroups[group]

            return (
              <div key={group}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
                    onClick={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        [group]: !current[group],
                      }))
                    }
                    aria-expanded={open}
                    aria-label={`${open ? 'Recolher' : 'Expandir'} ${group}`}
                  >
                    <ChevronRight
                      size={15}
                      className={`transition-transform ${
                        open ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  <button
                    className={`category-link min-w-0 flex-1 ${
                      groupSelected ? 'selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedGroup(groupSelected ? null : group)
                      setSelectedCategories([])
                      setExpandedGroups((current) => ({
                        ...current,
                        [group]: true,
                      }))
                      setActiveSection('Inventário')
                      setShowMobileNav(false)
                    }}
                  >
                    <span
                      className={`category-dot ${
                        group === 'Estoque'
                          ? 'bg-[#3f8f8b]'
                          : 'bg-[#4a7fa7]'
                      }`}
                    >
                      <GroupIcon size={13} />
                    </span>
                    {group}
                    <span className="category-count">{total}</span>
                  </button>
                </div>

                {open && (
                  <div className="ml-7 border-l border-slate-200 pl-2">
                    {subs.map(({ label, count, icon: Icon, color }) => (
                      <button
                        key={label}
                        className={`category-link ${
                          selectedGroup === group &&
                          selectedCategories.includes(label)
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => {
                          setSelectedGroup(group)
                          setSelectedCategories((current) =>
                            selectedGroup === group &&
                            current.length === 1 &&
                            current[0] === label
                              ? []
                              : [label],
                          )
                          setActiveSection('Inventário')
                          setShowMobileNav(false)
                        }}
                      >
                        <span className={`category-dot ${color}`}>
                          <Icon size={13} />
                        </span>
                        {label}
                        <span className="category-count">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-link" onClick={() => void signOut(auth)}>
            <LogOut size={18} />
            Sair
          </button>

          <div className="profile">
            <div className="avatar">JS</div>
            <div>
              <strong>Julio Simões</strong>
              <small>Administrador</small>
            </div>
            <ChevronDown size={15} className="ml-auto text-slate-400" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setShowMobileNav(true)}
            aria-label="Abrir menu"
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumbs">
            <span>Gestão de Ativos</span>
            <span>/</span>
            <strong>{activeSection}</strong>
            {activeCategory !== 'Todos os itens' && (
              <>
                <span>/</span>
                <strong>{activeCategory}</strong>
              </>
            )}
          </div>

          <div className="top-actions">
            <button className="icon-button" aria-label="Ajuda">
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-button notification"
              aria-label="Notificações"
            >
              <Bell size={19} />
              <i />
            </button>
            <div className="top-avatar">JS</div>
          </div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CENTRAL DE OPERAÇÕES</p>
              <h1>{activeSection}</h1>
              <p className="page-description">
                Acompanhe o ciclo dos materiais inservíveis e prepare seus
                próximos leilões.
              </p>
            </div>

            <div className="heading-actions">
              {activeSection === 'Itens por tipo' && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowWithdrawal(true)}
                >
                  <ArrowDownToLine size={16} />
                  Registrar retirada
                </button>
              )}

              <button
                className="secondary-button"
                data-popover-trigger
                aria-haspopup="dialog"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  setFilterAnchor(null)
                  setDownloadAnchor((current) => (current ? null : rect))
                }}
              >
                <FileDown size={16} />
                Exportar relatório
                <ChevronDown size={15} />
              </button>

              {downloadAnchor && (
                <FloatingPanel
                  anchor={downloadAnchor}
                  width={268}
                  label="Exportar relatório"
                  onClose={() => setDownloadAnchor(null)}
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Exportar relatório
                  </p>

                  <button
                    className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setDownloadAnchor(null)
                      void downloadReport('xlsx')
                    }}
                  >
                    <strong className="text-sm text-slate-800">
                      Excel (.xlsx)
                    </strong>
                    <small className="text-xs text-slate-500">
                      Tabela formatada, com filtros nas colunas
                    </small>
                  </button>

                  <button
                    className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setDownloadAnchor(null)
                      void downloadReport('csv')
                    }}
                  >
                    <strong className="text-sm text-slate-800">CSV (.csv)</strong>
                    <small className="text-xs text-slate-500">
                      Relatório completo separado por ponto e vírgula
                    </small>
                  </button>

                  <button
                    className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setDownloadAnchor(null)
                      void downloadReport('pdf')
                    }}
                  >
                    <strong className="text-sm text-slate-800">PDF (.pdf)</strong>
                    <small className="text-xs text-slate-500">
                      Documento pronto para imprimir ou enviar
                    </small>
                  </button>

                  <button
                    className="flex w-full flex-col rounded-md px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setDownloadAnchor(null)
                      downloadQuantities()
                    }}
                  >
                    <strong className="text-sm text-slate-800">
                      Quantitativos por tipo (.csv)
                    </strong>
                    <small className="text-xs text-slate-500">
                      Apenas o total de unidades agrupado por tipo
                    </small>
                  </button>
                </FloatingPanel>
              )}

              <button
                className="primary-button"
                onClick={() => setShowNew(true)}
              >
                <Plus size={17} />
                Cadastrar item
              </button>
            </div>
          </div>

          {activeSection === 'Itens por tipo' ? (
            <ItemsByType items={items} />
          ) : activeSection === 'Visão geral' ? (
            <>
              <div className="metrics-grid">
                <MetricCard
                  label="Total de Inservíveis"
                  value={totalInserviveis}
                  detail="unidades cadastradas"
                  icon={Box}
                  onClick={() => setSelectedMetricModal('inserviveis')}
                />
                <MetricCard
                  label="Total de Estoque"
                  value={totalEstoque}
                  detail="unidades em estoque"
                  icon={Archive}
                  tone="green"
                  onClick={() => setSelectedMetricModal('estoque')}
                />
                <MetricCard
                  label="Aguardando leilão"
                  value={aguardandoLeilaoCount}
                  detail="unidades sem garantia"
                  icon={Gavel}
                  tone="amber"
                  onClick={() => setSelectedMetricModal('aguardandoLeilao')}
                />
                <MetricCard
                  label="Cadastrados no mês"
                  value={cadastradosNoMesCount}
                  detail="inservíveis e estoque"
                  icon={ClipboardList}
                  tone="green"
                  onClick={() => setSelectedMetricModal('cadastradosMes')}
                />
                <MetricCard
                  label="Descartados"
                  value={descartadosCount}
                  detail={
                    descartadosCount === 1
                      ? 'unidade descartada'
                      : 'unidades descartadas'
                  }
                  icon={Trash2}
                  tone="red"
                  onClick={() => setSelectedMetricModal('descartados')}
                />
              </div>

              <div className="dashboard-grid">
                <MovementPanel
                  title="Movimentação de inservíveis"
                  data={periodInserviveis}
                  period={selectedPeriod}
                  onPeriodChange={setSelectedPeriod}
                  color="#4a7fa7"
                />
                <DistributionPanel
                  title="Por categoria"
                  subtitle="Distribuição por inservíveis"
                  data={pieInserviveis}
                  total={totalInserviveis}
                />
              </div>

              <div className="dashboard-grid">
                <MovementPanel
                  title="Movimentação de estoque"
                  data={periodEstoque}
                  period={stockPeriod}
                  onPeriodChange={setStockPeriod}
                  color="#3f8f8b"
                />
                <DistributionPanel
                  title="Por categoria"
                  subtitle="Distribuição por estoque"
                  data={pieEstoque}
                  total={totalEstoque}
                />
              </div>

              <div className="section-heading">
                <div>
                  <h2>Itens recentes</h2>
                  <p>Últimas movimentações registradas no sistema</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setActiveSection('Inventário')}
                >
                  Ver inventário completo <span>→</span>
                </button>
              </div>

              <div className="panel inventory-panel">
                <div className="panel-header">
                  <div>
                    <h2>Itens recentes</h2>
                    <p>Últimas movimentações registradas no sistema.</p>
                  </div>

                  <div className="panel-actions">
                    <div className="search-box">
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar item, serial ou patrimônio"
                      />
                    </div>
                    <button
                      className="secondary-button small"
                      onClick={() => setActiveSection('Inventário')}
                    >
                      Ver todos
                      <ArrowDownToLine size={15} />
                    </button>
                  </div>
                </div>

                <InventoryTable
                  items={filteredItems.slice(0, 4)}
                  onNotify={notify}
                  onAuctionChange={setAuction}
                  onDeleteItem={deleteItem}
                  onDiscardItem={setDiscarded}
                  onEditItem={setEditingItem}
                />
              </div>
            </>
          ) : (
            <div className="panel inventory-panel">
              <div className="panel-header">
                <div>
                  <h2>
                    {activeCategory === 'Todos os itens'
                      ? 'Todos os itens'
                      : activeCategory}
                  </h2>
                  <p>
                    Consulte, filtre e atualize os materiais cadastrados.
                  </p>
                </div>

                <div className="panel-actions">
                  <button
                    className="secondary-button small"
                    data-popover-trigger
                    aria-haspopup="dialog"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      setDownloadAnchor(null)
                      setFilterAnchor((current) => (current ? null : rect))
                    }}
                  >
                    <Filter size={15} />
                    Filtros
                    {(selectedCategories.length > 0 ||
                      selectedGroup !== null) && (
                      <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#4a7fa7] px-1 text-[10px] font-semibold text-white">
                        {selectedCategories.length > 0
                          ? selectedCategories.length
                          : 1}
                      </span>
                    )}
                  </button>

                  {filterAnchor && (
                    <FloatingPanel
                      anchor={filterAnchor}
                      width={264}
                      label="Filtrar por categoria"
                      onClose={() => setFilterAnchor(null)}
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Categoria
                      </p>

                      <div className="mb-3 flex gap-2">
                        {GROUPS.map((group) => (
                          <button
                            key={group}
                            type="button"
                            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                              selectedGroup === group
                                ? 'border-[#4a7fa7] bg-[#4a7fa7] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-700'
                            }`}
                            onClick={() => {
                              if (selectedGroup !== group) {
                                setSelectedGroup(group)
                                setSelectedCategories([])
                              }
                            }}
                          >
                            {group}
                          </button>
                        ))}
                      </div>

                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Subcategorias
                      </p>

                      {selectedGroup === null ? (
                        <p className="text-xs text-slate-500">
                          Escolha Inservíveis ou Estoque para filtrar por
                          subcategoria.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {SUBCATEGORIES[selectedGroup].map((sub) => (
                            <label
                              key={sub.label}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[#4a7fa7]"
                                checked={selectedCategories.includes(
                                  sub.label,
                                )}
                                onChange={() =>
                                  setSelectedCategories((current) =>
                                    current.includes(sub.label)
                                      ? current.filter(
                                          (name) => name !== sub.label,
                                        )
                                      : [...current, sub.label],
                                  )
                                }
                              />
                              {sub.label}
                            </label>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <button
                          className="text-sm text-slate-500 hover:text-slate-800 disabled:opacity-40"
                          disabled={
                            selectedCategories.length === 0 &&
                            selectedGroup === null
                          }
                          onClick={() => {
                            setSelectedCategories([])
                            setSelectedGroup(null)
                          }}
                        >
                          Limpar
                        </button>
                        <button
                          className="primary-button small"
                          onClick={() => setFilterAnchor(null)}
                        >
                          Concluir
                        </button>
                      </div>
                    </FloatingPanel>
                  )}

                  <button
                    className="primary-button small"
                    onClick={() => setShowNew(true)}
                  >
                    <Plus size={15} />
                    Novo item
                  </button>
                </div>
              </div>

              <InventoryTable
                items={filteredItems}
                onNotify={notify}
                onAuctionChange={setAuction}
                onDeleteItem={deleteItem}
                onDiscardItem={setDiscarded}
                onEditItem={setEditingItem}
              />
            </div>
          )}
        </div>
      </main>

      {metricModalData && (
        <MetricItemsModal
          title={metricModalData.title}
          subtitle={metricModalData.subtitle}
          items={metricModalData.items}
          onClose={() => setSelectedMetricModal(null)}
        />
      )}

      {showWithdrawal && (
        <WithdrawalModal
          items={activeItems}
          onClose={() => setShowWithdrawal(false)}
          onSave={async (type, quantity) => {
            await registerWithdrawal(type, quantity)
            setShowWithdrawal(false)
          }}
        />
      )}

      {showNew && (
        <NewItemModal
          onClose={() => setShowNew(false)}
          onSave={async (data) => {
            await createItem(data)
            setShowNew(false)
            notify('Item cadastrado com sucesso')
          }}
        />
      )}

      {editingItem && (
        <NewItemModal
          key={editingItem.docId}
          initialItem={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (data) => {
            await updateItem(editingItem.docId, data)
            setEditingItem(null)
            notify('Item atualizado com sucesso')
          }}
        />
      )}

      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  )
}

function InventoryTable({
  items: rows,
  onNotify,
  onAuctionChange,
  onDeleteItem,
  onDiscardItem,
  onEditItem,
}: {
  items: Item[]
  onNotify: (message: string) => void
  onAuctionChange: (id: string, value: boolean) => void | Promise<void>
  onDeleteItem?: (docId: string, id: string) => void | Promise<void>
  onDiscardItem?: (
    docId: string,
    id: string,
    value: boolean,
  ) => void | Promise<void>
  onEditItem?: (item: Item) => void
}) {
  const [menu, setMenu] = useState<{
    id: string
    docId: string
    rect: DOMRect
    confirming?: boolean
  } | null>(null)

  const menuItem = menu
    ? rows.find((row) => row.docId === menu.docId)
    : undefined

  const showAuction = menuItem?.group !== 'Estoque' && !menuItem?.discarded

  return (
    <div className="table-scroll">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>ITEM</th>
            <th>IDENTIFICAÇÃO</th>
            <th>CADASTRO</th>
            <th>CATEGORIAS</th>
            <th>STATUS</th>
            <th>LEILOADO</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {rows.map((item) => {
            const isAuctioned = item.auction

            return (
              <tr key={item.docId}>
                <td>
                  <div className="item-cell">
                    <div className="item-thumb">
                      <Box size={17} />
                    </div>
                    <div>
                      <strong>{item.item}</strong>
                      <small>
                        {item.id} · {item.type} · Qtd.: {item.quantity}
                      </small>
                    </div>
                  </div>
                </td>

                <td>
                  <span className="mono">{item.serial}</span>
                  <small className="table-sub">{item.tag}</small>
                </td>

                <td>
                  <span>{item.date}</span>
                  <small className="table-sub">
                    {item.age === 'hoje'
                      ? 'Cadastrado hoje'
                      : `Há ${item.age}`}
                  </small>
                </td>

                <td>
                  <div className="tag-list">
                    {(
                      item.categories.length > 0
                        ? item.categories
                        : item.group === 'Estoque'
                          ? ['Estoque']
                          : []
                    )
                      .slice(0, 2)
                      .map((category) => (
                        <span key={category} className="table-tag">
                          {category}
                        </span>
                      ))}
                  </div>
                </td>

                <td>
                  <span
                    className={`status-badge ${
                      item.status === 'Retirado' || item.discarded
                        ? 'retired'
                        : ''
                    }`}
                  >
                    <i />
                    {item.status}
                  </span>
                </td>

                <td>
                  {item.group === 'Estoque' || item.discarded ? (
                    <span className="auction-no">—</span>
                  ) : isAuctioned ? (
                    <span className="auction-yes">
                      <Gavel size={13} />
                      Sim
                    </span>
                  ) : (
                    <span className="auction-no">Não</span>
                  )}
                </td>

                <td>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#72b2d3] bg-gradient-to-b from-[#55a6d2] to-[#17649f] text-white shadow-[0_4px_0_#104b78,0_7px_12px_rgba(23,100,159,0.22)] transition duration-150 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_5px_0_#104b78,0_9px_15px_rgba(23,100,159,0.26)] active:translate-y-[3px] active:shadow-[0_1px_0_#104b78] focus:outline-none focus:ring-2 focus:ring-[#67c7a4] focus:ring-offset-2"
                    data-popover-trigger
                    aria-haspopup="dialog"
                    aria-label={`Opções do item ${item.id}`}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()

                      setMenu((current) =>
                        current?.id === item.id
                          ? null
                          : {
                              id: item.id,
                              docId: item.docId,
                              rect,
                            },
                      )
                    }}
                  >
                    <MoreHorizontal size={20} strokeWidth={2.8} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Nenhum item cadastrado ainda. Use o botão “Novo item” para começar.
        </p>
      )}

      {menu && (
        <FloatingPanel
          anchor={menu.rect}
          width={220}
          label={`Ações do item ${menu.id}`}
          onClose={() => setMenu(null)}
        >
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            ITEM {menu.id}
          </p>

          <div className="space-y-2.5">
            {menuItem && onEditItem && (
              <button
                type="button"
                className="flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_2px_0_#e2e8f0] transition hover:bg-[#eef7fb] active:translate-y-[2px] active:shadow-none"
                onClick={() => {
                  onEditItem(menuItem)
                  setMenu(null)
                }}
              >
                Editar item
              </button>
            )}

            {showAuction && (
              <div className="border-t border-slate-100 pt-2.5">
                <p className="mb-2 text-xs font-medium text-slate-700">
                  Foi leiloado?
                </p>

                <div className="flex gap-2">
                  {(
                    [
                      ['Sim', true],
                      ['Não', false],
                    ] as const
                  ).map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      className={`${
                        (rows.find((row) => row.id === menu.id)?.auction ??
                          false) === value
                          ? value
                            ? 'rounded-lg bg-gradient-to-b from-[#38a879] to-[#21764f] text-white shadow-[0_3px_0_#15583a]'
                            : 'rounded-lg bg-gradient-to-b from-[#3188bd] to-[#17649f] text-white shadow-[0_3px_0_#104b78]'
                          : 'rounded-lg border border-slate-200 bg-white text-slate-700 shadow-[0_2px_0_#e2e8f0] hover:bg-[#eef7fb]'
                      } flex flex-1 items-center justify-center py-1.5 text-xs font-semibold transition active:translate-y-[2px] active:shadow-none`}
                      onClick={() => {
                        onAuctionChange(menu.id, value)
                        onNotify(`${menu.id}: leiloado marcado como ${label}`)
                        setMenu(null)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {onDiscardItem && (
              <div className="border-t border-slate-100 pt-2.5">
                <button
                  type="button"
                  className="flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_2px_0_#e2e8f0] transition hover:bg-[#eef7fb] active:translate-y-[2px] active:shadow-none"
                  onClick={() => {
                    const { docId, id } = menu
                    const discard = !menuItem?.discarded
                    setMenu(null)
                    void onDiscardItem(docId, id, discard)
                  }}
                >
                  {menuItem?.discarded ? 'Restaurar item' : 'Descartar item'}
                </button>
              </div>
            )}

            {onDeleteItem && (
              <div className="border-t border-slate-100 pt-2.5">
                {menu.confirming ? (
                  <>
                    <p className="mb-2 text-xs text-slate-600">
                      Excluir {menu.id}? Essa ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 shadow-[0_2px_0_#e2e8f0] transition hover:bg-slate-50 active:translate-y-[2px] active:shadow-none"
                        onClick={() =>
                          setMenu((current) =>
                            current
                              ? { ...current, confirming: false }
                              : current,
                          )
                        }
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="flex flex-1 items-center justify-center rounded-lg bg-gradient-to-b from-[#d96b5e] to-[#b5483c] py-1.5 text-xs font-semibold text-white shadow-[0_3px_0_#8a3228] transition hover:brightness-110 active:translate-y-[2px] active:shadow-none"
                        onClick={() => {
                          const { docId, id } = menu
                          setMenu(null)
                          void onDeleteItem(docId, id)
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center justify-center rounded-lg border border-[#f2c6c0] bg-[#fff5f4] px-3 py-1.5 text-xs font-semibold text-[#b5483c] shadow-[0_2px_0_#f2c6c0] transition hover:bg-[#fbebe8] active:translate-y-[2px] active:shadow-none"
                    onClick={() =>
                      setMenu((current) =>
                        current ? { ...current, confirming: true } : current,
                      )
                    }
                  >
                    Excluir item
                  </button>
                )}
              </div>
            )}
          </div>
        </FloatingPanel>
      )}
    </div>
  )
}

function WithdrawalModal({
  items,
  onClose,
  onSave,
}: {
  items: Item[]
  onClose: () => void
  onSave: (type: string, quantity: number) => Promise<void>
}) {
  const availableTypes = useMemo(() => {
    const totals = new Map<string, number>()

    items.forEach((item) => {
      if (item.discarded || item.withdrawn || item.quantity <= 0) return
      const type = item.type || 'Outros'
      totals.set(type, (totals.get(type) ?? 0) + item.quantity)
    })

    return Array.from(totals.entries()).sort(([first], [second]) =>
      first.localeCompare(second),
    )
  }, [items])

  const [type, setType] = useState(availableTypes[0]?.[0] ?? '')
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (
      availableTypes.length > 0 &&
      !availableTypes.some(([itemType]) => itemType === type)
    ) {
      setType(availableTypes[0][0])
      setQuantity(1)
    }
  }, [availableTypes, type])

  const availableQuantity =
    availableTypes.find(([itemType]) => itemType === type)?.[1] ?? 0

  const submit = async () => {
    if (!type) {
      setError('Selecione o tipo de item.')
      return
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Informe um quantitativo inteiro maior que zero.')
      return
    }

    if (quantity > availableQuantity) {
      setError(`Quantidade máxima disponível: ${availableQuantity}.`)
      return
    }

    setSaving(true)
    setError('')

    try {
      await onSave(type, quantity)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível registrar a retirada.',
      )
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <div
        className="modal-card w-full max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Registrar retirada de itens"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">MOVIMENTAÇÃO DE ESTOQUE</p>
            <h2>Registrar retirada</h2>
            <p>Selecione o tipo de item e informe a quantidade retirada.</p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {availableTypes.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Não há itens disponíveis para retirada.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Tipo de item
              </span>
              <select
                className="w-full"
                value={type}
                onChange={(event) => {
                  setType(event.target.value)
                  setQuantity(1)
                  setError('')
                }}
              >
                {availableTypes.map(([itemType, total]) => (
                  <option key={itemType} value={itemType}>
                    {itemType} · {total} disponível(is)
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Quantitativo a retirar
              </span>
              <input
                type="number"
                min="1"
                max={availableQuantity}
                step="1"
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number(event.target.value) || 1))
                }
              />
              <span className="mt-1 block text-xs text-slate-500">
                Quantidade disponível: {availableQuantity}
              </span>
            </label>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="modal-foot">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void submit()}
            disabled={saving || availableTypes.length === 0}
          >
            {saving ? 'Registrando...' : 'Confirmar retirada'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewItemModal({
  onClose,
  onSave,
  initialItem,
}: {
  onClose: () => void
  onSave: (data: NewItemData) => Promise<void>
  initialItem?: Item
}) {
  const [form, setForm] = useState<NewItemData>(() => {
    if (initialItem) {
      const knownType = itemTypes.includes(initialItem.type)

      return {
        group: initialItem.group,
        name: initialItem.item,
        type: knownType ? initialItem.type : 'Outro',
        model: initialItem.model,
        tag: initialItem.tag === '—' ? '' : initialItem.tag,
        serial: initialItem.serial === 'N/A' ? '' : initialItem.serial,
        serviceTag: initialItem.serviceTag,
        registeredAt: initialItem.rawRegisteredAt,
        categories: initialItem.categories,
        quantity: initialItem.quantity,
        image: initialItem.image ?? '',
      }
    }

    return {
      group: 'Inservíveis',
      name: '',
      type: '',
      model: '',
      tag: '',
      serial: '',
      serviceTag: '',
      registeredAt: new Date().toLocaleDateString('en-CA'),
      categories: ['Sem garantia'],
      quantity: 1,
      image: '',
    }
  })

  const [customType, setCustomType] = useState(() => {
    if (!initialItem) return ''
    return itemTypes.includes(initialItem.type) ? '' : initialItem.type
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')

  const itemTypesWithOptions = [...itemTypes, 'Outro']

  const update = (
    field: Exclude<keyof NewItemData, 'categories' | 'group' | 'quantity'>,
    value: string,
  ) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const toggleCategory = (label: string) => {
    setForm((current) => ({
      ...current,
      categories:
        current.group === 'Estoque'
          ? [label]
          : current.categories.includes(label)
            ? current.categories.filter((name) => name !== label)
            : [...current.categories, label],
    }))
  }

  const submit = async () => {
    const finalType = form.type === 'Outro' ? customType.trim() : form.type

    if (!form.name.trim() || !finalType) {
      setError('Informe o nome e o tipo do item.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await onSave({
        ...form,
        type: finalType,
        quantity: Math.max(1, Number(form.quantity) || 1),
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
            <p className="eyebrow">
              {initialItem ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}
            </p>
            <h2>
              {initialItem
                ? 'Editar item'
                : form.group === 'Estoque'
                  ? 'Cadastrar item de estoque'
                  : 'Cadastrar inservível'}
            </h2>
            <p>
              {initialItem
                ? 'Atualize os dados do item cadastrado.'
                : 'Informe os dados para adicionar um material ao estoque.'}
            </p>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Categoria
          </p>
          <div className="flex gap-2">
            {GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                  form.group === group
                    ? 'border-[#4a7fa7] bg-[#4a7fa7] text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    group,
                    categories:
                      current.group === group
                        ? current.categories
                        : [DEFAULT_SUBCATEGORY[group]],
                  }))
                }
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Imagem do item
            </span>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-[#b7d8ec] bg-gradient-to-br from-[#eaf4fb] to-[#e6f6ef] text-4xl">
                {form.image ? (
                  <img
                    src={form.image}
                    alt="Pré-visualização do item"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getTypeIllustration(form.type || 'Outros')
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg bg-gradient-to-b from-[#3188bd] to-[#17649f] px-4 py-2 text-sm font-semibold !text-white shadow-[0_4px_0_#104b78] transition hover:brightness-110 active:translate-y-1 active:shadow-none">
                  {form.image ? 'Trocar imagem' : 'Adicionar imagem'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (event) => {
                      const file = event.currentTarget.files?.[0]
                      event.currentTarget.value = ''

                      if (!file) return

                      try {
                        const image = await compressImage(file)
                        setForm((current) => ({ ...current, image }))
                        setImageError('')
                      } catch {
                        setImageError(
                          'Não foi possível carregar essa imagem. Tente outro arquivo.',
                        )
                      }
                    }}
                  />
                </label>

                {form.image && (
                  <button
                    type="button"
                    className="rounded-lg border border-[#a7d9c1] bg-[#e8f6ef] px-4 py-2 text-sm font-semibold text-[#24744f] transition hover:bg-[#d8f0e3]"
                    onClick={() =>
                      setForm((current) => ({ ...current, image: '' }))
                    }
                  >
                    Remover imagem
                  </button>
                )}
              </div>
            </div>

            {imageError && (
              <p className="mt-2 text-xs text-red-600">{imageError}</p>
            )}

            <p className="mt-2 text-xs text-slate-500">
              A imagem é redimensionada e comprimida antes de ser salva.
            </p>
          </div>

          <label>
            Nome do item
            <input
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Ex.: Notebook Dell Latitude"
            />
          </label>

          <label>
            Tipo de item
            <select
              value={form.type}
              onChange={(event) => update('type', event.target.value)}
            >
              <option value="" disabled>
                Selecione
              </option>
              {itemTypesWithOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          {form.type === 'Outro' && (
            <label className="col-span-2">
              Especifique o tipo de item
              <input
                value={customType}
                onChange={(event) => setCustomType(event.target.value)}
                placeholder="Digite o tipo de item (Ex.: Hub Switch, Nobreak)"
                autoFocus
              />
            </label>
          )}

          <label>
            Quantidade
            <input
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  quantity: Math.max(1, Number(event.target.value) || 1),
                }))
              }
            />
          </label>

          <label>
            Modelo
            <input
              value={form.model}
              onChange={(event) => update('model', event.target.value)}
              placeholder="Ex.: Latitude 5420"
            />
          </label>

          <label>
            Patrimônio
            <input
              value={form.tag}
              onChange={(event) => update('tag', event.target.value)}
              placeholder="Ex.: PAT-004218"
            />
          </label>

          <label>
            Serial number
            <input
              value={form.serial}
              onChange={(event) => update('serial', event.target.value)}
              placeholder="Informe o serial"
            />
          </label>

          <label>
            Data de cadastro
            <input
              type="date"
              value={form.registeredAt}
              onChange={(event) =>
                update('registeredAt', event.target.value)
              }
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {form.group === 'Estoque'
              ? 'Subcategoria do item'
              : 'Subcategorias do item'}
          </p>

          <div className="flex flex-wrap gap-2">
            {SUBCATEGORIES[form.group].map(({ label }) => (
              <button
                key={label}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  form.categories.includes(label)
                    ? 'border-[#4a7fa7] bg-[#4a7fa7] text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
                onClick={() => toggleCategory(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="modal-foot">
          <button className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="primary-button"
            disabled={saving}
            onClick={submit}
          >
            {saving
              ? 'Salvando...'
              : initialItem
                ? 'Salvar alterações'
                : 'Cadastrar item'}
          </button>
        </div>
      </div>
    </div>
  )
}