import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-navy-deep px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-gold-light tracking-[0.3em] text-xs uppercase mb-2">
            Huasca Retreats
          </p>
          <h1 className="text-2xl font-semibold text-cream">Panel de anfitrión</h1>
        </div>
        <div className="bg-cream rounded-2xl shadow-xl p-6 sm:p-8">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
