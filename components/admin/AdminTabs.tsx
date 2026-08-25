'use client'

import { useState } from 'react'
import { Users, UserPlus, Bell, Calendar, Settings, Database, Sliders, Receipt, QrCode, Upload } from 'lucide-react'
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
        {/* Barra superior: tabs (scroll horizontal en mobile) + acción primaria */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            <TabsList className="h-12 sm:h-14 p-1 sm:p-1.5 shadow-sm">
              <TabsTrigger value="alumnos" className="gap-2 px-3 sm:px-4 h-10 sm:h-11">
                <Users className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Alumnos</span>
              </TabsTrigger>
              <TabsTrigger value="alertas" className="gap-2 px-3 sm:px-4 h-10 sm:h-11 relative">
                <Bell className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Alertas</span>
                {alumnosConDeuda.length > 0 && (
                  <span className="ml-0 sm:ml-1 absolute -top-1 -right-1 sm:static rounded-full bg-red-500 text-white text-[10px] sm:text-[11px] font-semibold min-w-[18px] h-[18px] sm:min-w-0 sm:h-auto px-1 sm:px-1.5 sm:py-0.5 flex items-center justify-center leading-none animate-pulse-soft">
                    {alumnosConDeuda.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="pagos" className="gap-2 px-3 sm:px-4 h-10 sm:h-11">
                <Receipt className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Aportes recibidos</span>
              </TabsTrigger>
              <TabsTrigger value="cron" className="gap-2 px-3 sm:px-4 h-10 sm:h-11">
                <Calendar className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Cron</span>
              </TabsTrigger>
              <TabsTrigger value="padron" className="gap-2 px-3 sm:px-4 h-10 sm:h-11">
                <Upload className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Padrón</span>
              </TabsTrigger>
              <TabsTrigger value="datos" className="gap-2 px-3 sm:px-4 h-10 sm:h-11">
                <Database className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Datos</span>
              </TabsTrigger>
              <TabsTrigger value="qr" className="gap-2 px-3 sm:px-4 h-10 sm:h-11">
                <QrCode className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">QR</span>
              </TabsTrigger>
              <TabsTrigger value="configuracion" className="gap-2 px-3 sm:px-4 h-10 sm:h-11">
                <Settings className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Planes</span>
              </TabsTrigger>
              <TabsTrigger value="parametros" className="gap-2 px-3 sm:px-4 h-10 sm:h-11">
                <Sliders className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Parámetros</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Mobile: solo ícono +. Desktop: botón completo */}
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="gap-2 h-10 sm:h-11 px-3 sm:px-5 shadow-sm hover:shadow-md transition-shadow shrink-0"
            aria-label="Nuevo aportante/alumno"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden md:inline">Nuevo aportante/alumno</span>
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
