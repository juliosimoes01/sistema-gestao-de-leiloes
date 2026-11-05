'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, type User } from 'firebase/auth'
import { Box } from 'lucide-react'
import { auth } from '@/lib/firebase'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/too-many-requests') setError('Muitas tentativas. Aguarde um pouco e tente de novo.')
      else if (code === 'auth/network-request-failed') setError('Sem conexão. Verifique sua internet.')
      else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') setError('E-mail ou senha incorretos.')
      else setError(`Não foi possível entrar (${code ?? 'erro desconhecido'}).`)
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#234e70] text-white"><Box size={21} /></div>
          <div>
            <strong className="block text-slate-900">Gestão de Ativos</strong>
            <small className="text-slate-500">Inservíveis e estoque</small>
          </div>
        </div>
        <label className="mb-3 block text-sm font-medium text-slate-700">
          E-mail
          <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#234e70]" />
        </label>
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Senha
          <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#234e70]" />
        </label>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="primary-button w-full justify-center">{loading ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (current) => {
    setUser(current)
    setChecking(false)
  }), [])

  if (checking) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Carregando…</div>
  if (!user) return <LoginForm />
  return <>{children}</>
}
