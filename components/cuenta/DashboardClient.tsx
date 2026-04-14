'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddStudentDialog } from './AddStudentDialog'

export function DashboardClient() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-sm"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Agregar estudiante
      </Button>

      <AddStudentDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
