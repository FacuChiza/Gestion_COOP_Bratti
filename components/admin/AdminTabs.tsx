'use client'

import { useState } from 'react'
import { Users, UserPlus, Bell, Calendar, Settings, Database, Sliders, Receipt, QrCode } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { StudentList } from './StudentList'
import { AlertsSection } from './AlertsSection'
import { AddPagadorDialog } from './AddPagadorDialog'
import { CronButton } from './CronButton'
import { PreciosPanel } from './PreciosPanel'
import { DataExportPanel } from './DataExportPanel'
import { ConfiguracionPanel } from './ConfiguracionPanel'
import { PagosHistoryPanel } from './PagosHistoryPanel'
import { QrPanel } from './QrPanel'
import type { AlumnoConEstado, Plan, ConfiguracionItem } from '@/types'

type AlumnoDeuda = {
  id: string
  nombre: string
  grado: string
  turno: string | null
  cuotas_deuda: number
  pagadores?: { nombre: string; mail: string; telefono: string | null } | null
}

type Props = {
  alumnos: AlumnoConEstado[]
  alumnosConDeuda: AlumnoDeuda[]
  planes: Plan[]
  configuracion: ConfiguracionItem[]
}

export function AdminTabs({ alumnos, alumnosConDeuda, planes, configuracion }: Props) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  return (
    <>
      <Tabs defaultValue="alumnos">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="alumnos" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Alumnos
            </TabsTrigger>
            <TabsTrigger value="alertas" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Alertas
              {alumnosConDeuda.length > 0 && (
                <span className="ml-1 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5 leading-none">
                  {alumnosConDeuda.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pagos" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Pagos
            </TabsTrigger>
            <TabsTrigger value="cron" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Cron mensual
            </TabsTrigger>
            <TabsTrigger value="datos" className="gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Datos
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-1.5">
              <QrCode className="h-3.5 w-3.5" />
              QR
            </TabsTrigger>
            <TabsTrigger value="configuracion" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Planes
            </TabsTrigger>
            <TabsTrigger value="parametros" className="gap-1.5">
              <Sliders className="h-3.5 w-3.5" />
              Parámetros
            </TabsTrigger>
          </TabsList>

          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo pagador/alumno
          </Button>
        </div>

        <TabsContent value="alumnos">
          <StudentList alumnos={alumnos} planes={planes} />
        </TabsContent>

        <TabsContent value="alertas">
          <AlertsSection alumnos={alumnosConDeuda} />
        </TabsContent>

        <TabsContent value="pagos">
          <PagosHistoryPanel />
        </TabsContent>

        <TabsContent value="cron">
          <CronButton />
        </TabsContent>

        <TabsContent value="datos">
          <DataExportPanel />
        </TabsContent>

        <TabsContent value="qr">
          <QrPanel />
        </TabsContent>

        <TabsContent value="configuracion">
          <PreciosPanel planes={planes} />
        </TabsContent>

        <TabsContent value="parametros">
          <ConfiguracionPanel configuracion={configuracion} />
        </TabsContent>
      </Tabs>

      <AddPagadorDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        planes={planes}
      />
    </>
  )
}
