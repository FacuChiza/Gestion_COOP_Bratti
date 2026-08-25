'use client'

import { useState } from 'react'
import { Users, UserPlus, Bell, Database, Sliders, Receipt, QrCode, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { StudentList } from './StudentList'
import { AlertsSection } from './AlertsSection'
import { AddPagadorDialog } from './AddPagadorDialog'
import { CronButton } from './CronButton'
import { DataExportPanel } from './DataExportPanel'
import { ConfiguracionPanel } from './ConfiguracionPanel'
import { PagosHistoryPanel } from './PagosHistoryPanel'
import { QrPanel } from './QrPanel'
import { ImportarPadronPanel } from './ImportarPadronPanel'
import { ReporteAnualPanel } from './ReporteAnualPanel'
import { ProbarEmailPanel } from './ProbarEmailPanel'
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
        {/* Acción primaria en su propia fila para que nunca tape las pestañas */}
        <div className="flex justify-end mb-3">
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="gap-2 h-10 px-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo alumno
          </Button>
        </div>

        {/* Pestañas: bajan de línea si no entran (nunca se cortan) */}
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 p-1.5 shadow-sm mb-2">
          <TabsTrigger value="alumnos" className="gap-2 px-3 h-10">
            <Users className="h-4 w-4 shrink-0" />
            <span>Alumnos</span>
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-2 px-3 h-10">
            <Bell className="h-4 w-4 shrink-0" />
            <span>Alertas</span>
            {alumnosConDeuda.length > 0 && (
              <span className="ml-1 rounded-full bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 leading-none animate-pulse-soft">
                {alumnosConDeuda.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pagos" className="gap-2 px-3 h-10">
            <Receipt className="h-4 w-4 shrink-0" />
            <span>Aportes recibidos</span>
          </TabsTrigger>
          <TabsTrigger value="padron" className="gap-2 px-3 h-10">
            <Upload className="h-4 w-4 shrink-0" />
            <span>Padrón</span>
          </TabsTrigger>
          <TabsTrigger value="qr" className="gap-2 px-3 h-10">
            <QrCode className="h-4 w-4 shrink-0" />
            <span>QR</span>
          </TabsTrigger>
          <TabsTrigger value="datos" className="gap-2 px-3 h-10">
            <Database className="h-4 w-4 shrink-0" />
            <span>Informes</span>
          </TabsTrigger>
          <TabsTrigger value="parametros" className="gap-2 px-3 h-10">
            <Sliders className="h-4 w-4 shrink-0" />
            <span>Ajustes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alumnos">
          <StudentList alumnos={alumnos} planes={planes} />
        </TabsContent>

        <TabsContent value="alertas">
          <AlertsSection alumnos={alumnosConDeuda} />
        </TabsContent>

        <TabsContent value="pagos">
          <PagosHistoryPanel />
        </TabsContent>

        <TabsContent value="padron">
          <ImportarPadronPanel />
        </TabsContent>

        <TabsContent value="datos">
          <div className="space-y-6">
            <ReporteAnualPanel />
            <DataExportPanel />
            <ProbarEmailPanel />
          </div>
        </TabsContent>

        <TabsContent value="qr">
          <QrPanel />
        </TabsContent>

        {/* Ajustes reúne los parámetros editables + la generación manual de aportes
            (antes estaban repartidos en 3 pestañas distintas). */}
        <TabsContent value="parametros">
          <div className="space-y-6">
            <ConfiguracionPanel configuracion={configuracion} />
            <CronButton />
          </div>
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
