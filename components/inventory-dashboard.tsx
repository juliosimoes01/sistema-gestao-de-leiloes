'use client'

import { useMemo, useState } from 'react'
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
import { ReportExportModal } from './report-export-modal'
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

const categories = [
  { label: 'Com patrimônio', count: 186, icon: Tag, color: 'bg-[#234e70]', accent: '#234e70' },
  { label: 'Sem patrimônio', count: 274, icon: Box, color: 'bg-[#4f8a81]', accent: '#4f8a81' },
  { label: 'Sem garantia', count: 158, icon: ShieldAlert, color: 'bg-[#c98235]', accent: '#c98235' },
  { label: 'Funcionais', count: 96, icon: PackageCheck, color: 'bg-[#728c45]', accent: '#728c45' },
]

const items = [
  { id: 'INV-2024-0186', item: 'Notebook Dell Latitude 5420', type: 'Informática', serial: '8XK9Q22', tag: 'PAT-004218', date: '18/09/2024', age: '1 ano', status: 'Armazenado', categories: ['Com patrimônio', 'Funcionais'], auction: false },
  { id: 'INV-2024-0185', item: 'Monitor LG 24” LED', type: 'Informática', serial: 'N/A', tag: '—', date: '16/09/2024', age: '1 ano', status: 'Armazenado', categories: ['Sem patrimônio', 'Sem garantia'], auction: true },
  { id: 'INV-2024-0184', item: 'Cadeira giratória presidente', type: 'Mobiliário', serial: 'N/A', tag: 'PAT-003917', date: '14/09/2024', age: '1 ano', status: 'Retirado', categories: ['Com patrimônio'], auction: false },
  { id: 'INV-2024-0183', item: 'Impressora HP LaserJet Pro', type: 'Informática', serial: 'VNB3K1804', tag: 'PAT-004012', date: '11/09/2024', age: '1 ano', status: 'Armazenado', categories: ['Com patrimônio', 'Sem garantia'], auction: true },
  { id: 'INV-2024-0182', item: 'Armário de aço 2 portas', type: 'Mobiliário', serial: 'N/A', tag: '—', date: '09/09/2024', age: '1 ano', status: 'Armazenado', categories: ['Sem patrimônio', 'Funcionais'], auction: false },
]

const periodData = [
  { name: '2026 Jan', cadastrados: 28 }, { name: '2026 Fev', cadastrados: 35 }, { name: '2026 Mar', cadastrados: 42 }, { name: '2026 Abr', cadastrados: 31 }, { name: '2026 Mai', cadastrados: 48 }, { name: '2026 Jun', cadastrados: 42 }, { name: '2026 Jul', cadastrados: 68 }, { name: '2026 Ago', cadastrados: 55 }, { name: '2026 Set', cadastrados: 74 }, { name: '2026 Out', cadastrados: 61 }, { name: '2026 Nov', cadastrados: 53 }, { name: '2026 Dez', cadastrados: 47 },
  { name: '2027 Jan', cadastrados: 39 }, { name: '2027 Fev', cadastrados: 44 }, { name: '2027 Mar', cadastrados: 58 }, { name: '2027 Abr', cadastrados: 63 }, { name: '2027 Mai', cadastrados: 71 }, { name: '2027 Jun', cadastrados: 66 }, { name: '2027 Jul', cadastrados: 52 }, { name: '2027 Ago', cadastrados: 69 }, { name: '2027 Set', cadastrados: 77 }, { name: '2027 Out', cadastrados: 64 }, { name: '2027 Nov', cadastrados: 59 }, { name: '2027 Dez', cadastrados: 73 },
  { name: '2028 Jan', cadastrados: 46 }, { name: '2028 Fev', cadastrados: 51 }, { name: '2028 Mar', cadastrados: 62 }, { name: '2028 Abr', cadastrados: 57 }, { name: '2028 Mai', cadastrados: 75 }, { name: '2028 Jun', cadastrados: 68 }, { name: '2028 Jul', cadastrados: 81 }, { name: '2028 Ago', cadastrados: 72 }, { name: '2028 Set', cadastrados: 86 }, { name: '2028 Out', cadastrados: 78 }, { name: '2028 Nov', cadastrados: 70 }, { name: '2028 Dez', cadastrados: 84 },
  { name: '2029 Jan', cadastrados: 61 }, { name: '2029 Fev', cadastrados: 66 }, { name: '2029 Mar', cadastrados: 74 }, { name: '2029 Abr', cadastrados: 69 }, { name: '2029 Mai', cadastrados: 88 }, { name: '2029 Jun', cadastrados: 79 }, { name: '2029 Jul', cadastrados: 92 }, { name: '2029 Ago', cadastrados: 85 }, { name: '2029 Set', cadastrados: 97 }, { name: '2029 Out', cadastrados: 90 }, { name: '2029 Nov', cadastrados: 83 }, { name: '2029 Dez', cadastrados: 101 },
  { name: '2030 Jan', cadastrados: 72 }, { name: '2030 Fev', cadastrados: 78 }, { name: '2030 Mar', cadastrados: 86 }, { name: '2030 Abr', cadastrados: 80 }, { name: '2030 Mai', cadastrados: 95 }, { name: '2030 Jun', cadastrados: 89 },
]

const pieData = [
  { name: 'Mouses', value: 34, color: '#234e70' },
  { name: 'Teclados', value: 42, color: '#4f8a81' },
  { name: 'Headsets', value: 27, color: '#c98235' },
  { name: 'Monitores', value: 58, color: '#728c45' },
  { name: 'Outros itens de informática', value: 68, color: '#687786' },
]

function MetricCard({ label, value, detail, icon: Icon, tone = 'blue' }: { label: string; value: string; detail: string; icon: typeof Box; tone?: string }) {
  const tones: Record<string, string> = { blue: 'bg-[#eaf2f8] text-[#234e70]', green: 'bg-[#edf5ed] text-[#567341]', amber: 'bg-[#fff3e3] text-[#b46c1c]', navy: 'bg-[#eef1f3] text-[#3d5061]' }
  return <div className="metric-card"><div className={`metric-icon ${tones[tone]}`}><Icon size={19} strokeWidth={1.8} /></div><div className="min-w-0"><p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-detail">{detail}</p></div><span className="metric-trend">+12,4%</span></div>
}

export default function InventoryDashboard() {
  const [activeSection, setActiveSection] = useState('Visão geral')
  const [activeCategory, setActiveCategory] = useState('Todos os itens')
  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [auctionOverrides, setAuctionOverrides] = useState<Record<string, boolean>>({})
  const [selectedPeriod, setSelectedPeriod] = useState('2026-2027')
  const visiblePeriodData = useMemo(() => {
    const [start, end] = selectedPeriod.split('-').map(Number)
    return periodData.filter((entry) => {
      const year = Number(entry.name.slice(0, 4))
      return year >= start && year <= end
    })
  }, [selectedPeriod])

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.item} ${item.id} ${item.serial} ${item.tag}`.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = activeCategory === 'Todos os itens' || item.categories.includes(activeCategory)
    return matchesQuery && matchesCategory
  }), [query, activeCategory])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }

  return <div className="app-shell">
    <aside className={`sidebar ${showMobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Box size={21} /></div><div><strong>Inservíveis</strong><small>Gestão de inservíveis</small></div><button className="mobile-close" onClick={() => setShowMobileNav(false)} aria-label="Fechar menu"><X size={18} /></button></div>
      <nav className="main-nav" aria-label="Navegação principal">
        <p className="nav-caption">GESTÃO</p>
        {[['Visão geral', LayoutDashboard], ['Inventário', ClipboardList]].map(([label, Icon]) => <button key={label as string} className={`nav-link ${activeSection === label ? 'active' : ''}`} onClick={() => { setActiveSection(label as string); setShowMobileNav(false) }}><Icon size={18} />{label as string}</button>)}
        <p className="nav-caption nav-caption-spaced">CATEGORIAS</p>
        {categories.map(({ label, count, icon: Icon, color }) => <button key={label} className={`category-link ${activeCategory === label ? 'selected' : ''}`} onClick={() => { setActiveCategory(activeCategory === label ? 'Todos os itens' : label); setActiveSection('Inventário'); setShowMobileNav(false) }}><span className={`category-dot ${color}`}><Icon size={13} /></span>{label}<span className="category-count">{count}</span></button>)}
      </nav>
      <div className="sidebar-bottom"><button className="nav-link"><Settings2 size={18} />Configurações</button><div className="profile"><div className="avatar">JS</div><div><strong>Julio Simões</strong><small>Administrador</small></div><ChevronDown size={15} className="ml-auto text-slate-400" /></div></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setShowMobileNav(true)} aria-label="Abrir menu"><Menu size={21} /></button><div className="breadcrumbs"><span>Inservíveis</span><span>/</span><strong>{activeSection}</strong>{activeCategory !== 'Todos os itens' && <><span>/</span><strong>{activeCategory}</strong></>}</div><div className="top-actions"><button className="icon-button" aria-label="Ajuda"><CircleHelp size={19} /></button><button className="icon-button notification" aria-label="Notificações"><Bell size={19} /><i /></button><div className="top-avatar">JS</div></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><p className="eyebrow">CENTRAL DE OPERAÇÕES</p><h1>{activeSection === 'Visão geral' ? 'Visão geral' : activeSection}</h1><p className="page-description">Acompanhe o ciclo dos materiais inservíveis e prepare seus próximos leilões.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => setShowExport(true)}><FileDown size={16} />Exportar relatório</button><button className="primary-button" onClick={() => setShowNew(true)}><Plus size={17} />Cadastrar item</button></div></div>

        {activeSection === 'Visão geral' ? <>
          <div className="metrics-grid"><MetricCard label="Total de Inservíveis" value="618" detail="itens cadastrados" icon={Box} /><MetricCard label="Aguardando leilão" value="48" detail="itens prontos" icon={Gavel} tone="amber" /><MetricCard label="Cadastrados no mês" value="74" detail="+12,4% vs. mês anterior" icon={ClipboardList} tone="green" /><MetricCard label="Retirados" value="126" detail="20,4% do total" icon={Truck} tone="navy" /></div>
          <div className="dashboard-grid"><div className="panel large-panel"><div className="panel-header"><div><h2>Movimentação de inservíveis</h2><p>Itens cadastrados por mês · 2026 a 2030</p></div><label className="period-select"><span className="sr-only">Período do gráfico</span><select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}><option value="2026-2027">2026–2027 · mensal</option><option value="2027-2028">2027–2028 · mensal</option><option value="2028-2029">2028–2029 · mensal</option><option value="2029-2030">2029–2030 · mensal</option></select><ChevronDown size={15} /></label></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={visiblePeriodData} margin={{ top: 12, right: 10, left: -20, bottom: 0 }} barGap={7}><CartesianGrid vertical={false} stroke="#e7ecef" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#84909a', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#84909a', fontSize: 12 }} /><Tooltip cursor={{ fill: '#f4f7f8' }} contentStyle={{ border: '1px solid #e1e8ec', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="cadastrados" name="Cadastrados" fill="#234e70" radius={[4, 4, 0, 0]} barSize={12} /></BarChart></ResponsiveContainer></div><div className="chart-legend"><span><i className="legend-blue" />Itens cadastrados</span><span className="chart-total">Total no período: 3.214</span></div></div><div className="panel category-panel"><div className="panel-header"><div><h2>Por categoria</h2><p>Distribuição do estoque</p></div><button className="more-button" aria-label="Mais opções">•••</button></div><div className="pie-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="48%" innerRadius={55} outerRadius={84} paddingAngle={3} dataKey="value" stroke="none">{pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ border: '1px solid #e1e8ec', borderRadius: 8, fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="pie-center"><strong>618</strong><span>itens</span></div></div><div className="category-legend">{pieData.map((entry) => <div key={entry.name}><span><i style={{ backgroundColor: entry.color }} />{entry.name}</span><strong>{entry.value}</strong></div>)}</div></div></div>
          <div className="section-heading"><div><h2>Itens recentes</h2><p>Últimas movimentações registradas no sistema</p></div><button className="text-button" onClick={() => setActiveSection('Inventário')}>Ver inventário completo <span>→</span></button></div>
        </> : <div className="panel inventory-panel"><div className="panel-header"><div><h2>{activeCategory === 'Todos os itens' ? 'Todos os itens' : activeCategory}</h2><p>Consulte, filtre e atualize os materiais cadastrados.</p></div><div className="panel-actions"><button className="secondary-button small" onClick={() => notify('Filtros avançados abertos')}><Filter size={15} />Filtros</button><button className="primary-button small" onClick={() => setShowNew(true)}><Plus size={15} />Novo item</button></div></div><InventoryTable items={filteredItems} onNotify={notify} auctionOverrides={auctionOverrides} onAuctionChange={(id, value) => setAuctionOverrides((current) => ({ ...current, [id]: value }))} /></div>}

        {activeSection === 'Visão geral' && <div className="panel inventory-panel"><div className="panel-header"><div><h2>Itens recentes</h2><p>Últimas movimentações registradas no sistema.</p></div><div className="panel-actions"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar item, serial ou patrimônio" /></div><button className="secondary-button small" onClick={() => setActiveSection('Inventário')}>Ver todos <ArrowDownToLine size={15} /></button></div></div><InventoryTable items={filteredItems.slice(0, 4)} onNotify={notify} auctionOverrides={auctionOverrides} onAuctionChange={(id, value) => setAuctionOverrides((current) => ({ ...current, [id]: value }))} /></div>}
      </div>
    </main>
    {showNew && <NewItemModal onClose={() => setShowNew(false)} onSave={() => { setShowNew(false); notify('Item cadastrado com sucesso') }} />}
    {showExport && <ReportExportModal onClose={() => setShowExport(false)} onExport={(format) => { setShowExport(false); notify(`Relatório ${format.toUpperCase()} preparado para download`) }} />}
    {toast && <div className="toast"><Check size={17} />{toast}</div>}
  </div>
}

function InventoryTable({ items: rows, onNotify, auctionOverrides, onAuctionChange }: { items: typeof items; onNotify: (message: string) => void; auctionOverrides: Record<string, boolean>; onAuctionChange: (id: string, value: boolean) => void }) {
  return <div className="table-scroll"><table className="inventory-table"><thead><tr><th>ITEM</th><th>IDENTIFICAÇÃO</th><th>CADASTRO</th><th>CATEGORIAS</th><th>STATUS</th><th>LEILOADO</th><th /></tr></thead><tbody>{rows.map((item) => { const isAuctioned = auctionOverrides[item.id] ?? item.auction; return <tr key={item.id}><td><div className="item-cell"><div className="item-thumb"><Box size={17} /></div><div><strong>{item.item}</strong><small>{item.id} · {item.type}</small></div></div></td><td><span className="mono">{item.serial}</span><small className="table-sub">{item.tag}</small></td><td><span>{item.date}</span><small className="table-sub">Há {item.age}</small></td><td><div className="tag-list">{item.categories.slice(0, 2).map((category) => <span key={category} className="table-tag">{category}</span>)}</div></td><td><span className={`status-badge ${item.status === 'Retirado' ? 'retired' : ''}`}><i />{item.status}</span></td><td>{isAuctioned ? <span className="auction-yes"><Gavel size={13} />Sim</span> : <span className="auction-no">Não</span>}</td><td><button className="row-menu" aria-label={`Marcar ${item.id} como leiloado`} onClick={() => { const nextValue = window.confirm(`O item ${item.id} foi leiloado?\n\nClique em OK para Sim ou Cancelar para Não.`); onAuctionChange(item.id, nextValue); onNotify(`${item.id}: leiloado marcado como ${nextValue ? 'Sim' : 'Não'}`) }}>•••</button></td></tr> })}</tbody></table></div>
}

function NewItemModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) { return <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><p className="eyebrow">NOVO REGISTRO</p><h2>Cadastrar inservível</h2><p>Informe os dados para adicionar um material ao estoque.</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div><div className="form-grid"><label>Nome do item<input placeholder="Ex.: Notebook Dell Latitude" /></label><label>Tipo de item<select defaultValue=""><option value="" disabled>Selecione</option><option>Monitores</option><option>Teclados</option><option>Mouses</option><option>Dockstations</option><option>APs</option><option>Telefones</option><option>Placas de circuito</option><option>Placas de vídeo</option><option>Baterias</option><option>Memória RAM</option><option>HDs</option><option>Fontes</option><option>Extensões de tomada</option><option>Webcams</option><option>Impressoras</option><option>Leitores de DVD</option></select></label><label>Modelo<input placeholder="Ex.: Latitude 5420" /></label><label>Patrimônio<input placeholder="Ex.: PAT-004218" /></label><label>Serial number<input placeholder="Informe o serial" /></label><label>Service tag <span>(opcional)</span><input placeholder="Informe a service tag" /></label><label>Data de cadastro<input type="date" defaultValue="2024-09-30" /></label></div><fieldset><legend>Categorias do inservível</legend><div className="check-grid">{categories.map((category) => <label key={category.label}><input type="checkbox" defaultChecked={category.label === 'Sem garantia'} />{category.label}</label>)}</div></fieldset><div className="modal-note"><AlertTriangle size={16} /><span>Itens sem garantia terão o tempo de armazenamento calculado automaticamente a partir da data de cadastro.</span></div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={onSave}><Check size={16} />Salvar item</button></div></div></div> }

/*
 * Integração Firebase (intencionalmente não ativa neste protótipo visual):
 * 1. Instale firebase e firebase-admin.
 * 2. Crie um app Web no Firebase Console e configure as variáveis
 *    NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
 *    NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
 *    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID e NEXT_PUBLIC_FIREBASE_APP_ID.
 * 3. Inicialize o client SDK em lib/firebase.ts com initializeApp() e
 *    getFirestore(). Use uma coleção `inserviveis` para os cadastros.
 * 4. Substitua os dados demonstrativos por queries onSnapshot() e envie
 *    novos itens com addDoc(), mantendo as regras do Firestore restritas
 *    a usuários autenticados.
 */
