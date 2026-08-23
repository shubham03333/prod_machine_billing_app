'use client'

import { useEffect, useState } from 'react'
import { FIELD_SESSION_KEY } from '@/lib/gps/constants'
import FieldApp, { loadFieldSession } from '@/components/gps/FieldApp'

type Session = NonNullable<ReturnType<typeof loadFieldSession>>

export default function FieldPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSession(loadFieldSession())
    setReady(true)
  }, [])

  if (!ready) return <div className="p-8 text-center text-gray-500">Loading...</div>
  if (!session) {
    if (typeof window !== 'undefined') window.location.href = '/'
    return <div className="p-8 text-center">Redirecting to login...</div>
  }

  return (
    <FieldApp
      session={session}
      onLogout={() => {
        localStorage.removeItem(FIELD_SESSION_KEY)
        window.location.href = '/'
      }}
    />
  )
}
