import CallsPage from "@/components/dashboard/outbound/calls-page"
import LeadsPage from "@/components/dashboard/outbound/leads-page"
import OverviewPage from "@/components/dashboard/outbound/overview-page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Dashboard() {
  return (
    /* Fixed-height container with flex layout */
    <div className="relative h-[100svh] w-full flex flex-col bg-white text-black overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 w-full">
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0 w-full">
          {/* Sticky, responsive tab bar */}
          <div className="mb-4 sm:mb-6">
            <TabsList className="flex w-full gap-2 overflow-x-auto rounded-lg border bg-gray-50 p-1 shrink-0">
              <TabsTrigger
                value="overview"
                className="flex-1 min-w-[8rem] whitespace-nowrap data-[state=active]:bg-white"
              >
                Panoramica
              </TabsTrigger>
              <TabsTrigger
                value="leads"
                className="flex-1 min-w-[8rem] whitespace-nowrap data-[state=active]:bg-white"
              >
                Lead
              </TabsTrigger>
              <TabsTrigger
                value="calls"
                className="flex-1 min-w-[8rem] whitespace-nowrap data-[state=active]:bg-white"
              >
                Chiamate
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content Areas - Scroll independently if needed */}
          <TabsContent value="overview" className="mt-0 sm:mt-2 flex-1 overflow-y-auto min-h-0">
            <OverviewPage />
          </TabsContent>

          <TabsContent value="leads" className="mt-0 sm:mt-2 flex-1 overflow-y-auto min-h-0">
            <LeadsPage />
          </TabsContent>

          {/* Calls page handles its own layout/scroll, so just flex-1 here */}
          <TabsContent value="calls" className="mt-0 sm:mt-2 flex-1 flex flex-col min-h-0 overflow-hidden pb-0">
            <CallsPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
