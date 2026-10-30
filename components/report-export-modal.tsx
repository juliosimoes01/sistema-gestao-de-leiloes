'use client'

import { useState } from 'react'
import { FileDown, FileText, X } from 'lucide-react'

type ReportExportModalProps = {
  onClose: () => void
  onExport: (format: 'pdf' | 'docx') => void
}

const reportFields = ['Item', 'Modelo', 'Patrimônio', 'Service tag', 'Serial number', 'Data de cadastro', 'Status', 'Leiloado']

export function ReportExportModal({ onClose, onExport }: ReportExportModalProps) {
  const [selectedFields, setSelectedFields] = useState(reportFields)
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf')

  function toggleField(field: string) {
    setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])
  }

  return <div className="modal-backdrop"><div className="modal-card report-modal"><div className="modal-head"><div><p className="eyebrow">EXPORTAR RELATÓRIO</p><h2>Personalizar relatório</h2><p>Escolha as colunas que deseja mostrar antes de baixar o arquivo.</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div><fieldset><legend>Informações do relatório</legend><div className="check-grid report-fields">{reportFields.map((field) => <label key={field}><input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} />{field}</label>)}</div></fieldset><div className="format-choice"><span>Formato do arquivo</span><div className="format-options"><button className={format === 'pdf' ? 'format-option active' : 'format-option'} onClick={() => setFormat('pdf')}><FileDown size={16} />PDF</button><button className={format === 'docx' ? 'format-option active' : 'format-option'} onClick={() => setFormat('docx')}><FileText size={16} />DOCX</button></div></div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!selectedFields.length} onClick={() => onExport(format)}><FileDown size={16} />Baixar relatório</button></div></div></div>
}
