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
        {/* Barra superior: tabs (scroll horizontal en mobile) + acción primaria */}
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex-1 min-w-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="h-14 p-1.5 shadow-sm">
              <TabsTrigger value="alumnos" className="gap-2 px-4 h-11">
                <Users className="h-4 w-4" />
                <span>Alumnos</span>
              </TabsTrigger>
              <TabsTrigger value="alertas" className="gap-2 px-4 h-11">
                <Bell className="h-4 w-4" />
                <span>Alertas</span>
                {alumnosConDeuda.length > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 leading-none animate-pulse-soft">
                    {alumnosConDeuda.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="pagos" className="gap-2 px-4 h-11">
                <Receipt className="h-4 w-4" />
                <span>Pagos</span>
              </TabsTrigger>
              <TabsTrigger value="cron" className="gap-2 px-4 h-11">
                <Calendar className="h-4 w-4" />
                <span>Cron mensual</span>
              </TabsTrigger>
              <TabsTrigger value="datos" className="gap-2 px-4 h-11">
                <Database className="h-4 w-4" />
                <span>Datos</span>
              </TabsTrigger>
              <TabsTrigger value="qr" className="gap-2 px-4 h-11">
                <QrCode className="h-4 w-4" />
                <span>QR</span>
              </TabsTrigger>
              <TabsTrigger value="configuracion" className="gap-2 px-4 h-11">
                <Settings className="h-4 w-4" />
                <span>Planes</span>
              </TabsTrigger>
              <TabsTrigger value="parametros" className="gap-2 px-4 h-11">
                <Sliders className="h-4 w-4" />
                <span>Parámetros</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <Button
            onClick={() => setAddDialogOpen(true)}
            className="gap-2 h-11 px-5 shadow-sm hover:shadow-md transition-shadow shrink-0"
          >
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
