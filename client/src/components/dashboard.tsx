import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, UserCheck, Clock } from "lucide-react";
import PatrolStatus from "./patrol-status";
import VerificationStatus from "./verification-status";
import { formatDistanceToNow } from "date-fns";

interface DashboardProps {
  activePatrols: any[];
  latestVerifications: any[];
  webSocketStatus: "connecting" | "connected" | "error";
}

export default function Dashboard({ activePatrols, latestVerifications, webSocketStatus }: DashboardProps) {
  // Count active and paused patrols
  const onDutyCount = activePatrols.filter(p => p.status === "on_duty").length;
  const pausedCount = activePatrols.filter(p => p.status === "paused").length;

  return (
    <div className="min-h-screen bg-[#36393F] text-white">
      {/* Header */}
      <header className="border-b border-gray-700 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center">
              <span className="text-lg font-bold">M</span>
            </div>
            <h1 className="text-xl font-bold">Moderator Bot Dashboard</h1>
          </div>
          
          <div className="flex items-center">
            <Badge 
              variant={webSocketStatus === "connected" ? "success" : "destructive"}
              className="gap-1 items-center"
            >
              <span className={`w-2 h-2 rounded-full ${webSocketStatus === "connected" ? "bg-green-500" : "bg-red-500"}`}></span>
              {webSocketStatus === "connected" ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Summary Cards */}
          <Card className="bg-[#2F3136] border-gray-700 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#57F287]" />
                Active Patrols
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{onDutyCount + pausedCount}</div>
              <div className="mt-2 text-sm text-gray-400">
                <span className="text-[#57F287] font-medium">{onDutyCount} on duty</span>
                {pausedCount > 0 && (
                  <> • <span className="text-[#FEE75C] font-medium">{pausedCount} paused</span></>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#2F3136] border-gray-700 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#5865F2]" />
                Verifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{latestVerifications.length}</div>
              <div className="mt-2 text-sm text-gray-400">
                {latestVerifications.length > 0 
                  ? `Latest: ${latestVerifications[0]?.robloxUsername || 'Unknown'}`
                  : 'No recent verifications'
                }
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#2F3136] border-gray-700 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#ED4245]" />
                Bot Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-[#57F287]">Online</div>
              <div className="mt-2 text-sm text-gray-400">
                Commands: /patrol, /verify, /reverify
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="patrols" className="mt-8">
          <TabsList className="bg-[#2F3136] border-gray-700">
            <TabsTrigger value="patrols" className="data-[state=active]:bg-[#5865F2] data-[state=active]:text-white">
              Patrol Status
            </TabsTrigger>
            <TabsTrigger value="verifications" className="data-[state=active]:bg-[#5865F2] data-[state=active]:text-white">
              Recent Verifications
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="patrols" className="mt-4">
            <Card className="bg-[#2F3136] border-gray-700 text-white">
              <CardHeader>
                <CardTitle>Current Patrol Sessions</CardTitle>
                <CardDescription className="text-gray-400">
                  Live status of all patrol sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PatrolStatus activePatrols={activePatrols} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="verifications" className="mt-4">
            <Card className="bg-[#2F3136] border-gray-700 text-white">
              <CardHeader>
                <CardTitle>Recent Verifications</CardTitle>
                <CardDescription className="text-gray-400">
                  Most recent Discord-Roblox verifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VerificationStatus verifications={latestVerifications} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Command Reference */}
        <Card className="mt-8 bg-[#2F3136] border-gray-700 text-white">
          <CardHeader>
            <CardTitle>Discord Command Reference</CardTitle>
            <CardDescription className="text-gray-400">
              Available commands for server members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-medium mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#57F287]" />
                  Patrol Commands
                </h3>
                <div className="bg-[#202225] p-3 rounded-md font-mono text-sm">
                  <div className="mb-2">/patrol</div>
                  <div className="text-gray-400 text-xs">
                    Starts or manages your patrol session with buttons for Start, Pause, and Off Duty
                  </div>
                </div>
              </div>
              
              <Separator className="bg-gray-700" />
              
              <div>
                <h3 className="text-md font-medium mb-2 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#5865F2]" />
                  Verification Commands
                </h3>
                <div className="bg-[#202225] p-3 rounded-md font-mono text-sm">
                  <div className="mb-2">/verify [roblox username]</div>
                  <div className="text-gray-400 text-xs mb-3">
                    Links your Discord account to your Roblox account
                  </div>
                  
                  <div className="mb-2">/reverify</div>
                  <div className="text-gray-400 text-xs">
                    Allows you to verify with a different Roblox account
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
