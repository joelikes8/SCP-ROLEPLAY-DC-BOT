import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";

interface PatrolStatusProps {
  activePatrols: any[];
}

export default function PatrolStatus({ activePatrols }: PatrolStatusProps) {
  if (activePatrols.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No active patrol sessions at the moment.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-700">
            <TableHead className="text-gray-400">Discord User</TableHead>
            <TableHead className="text-gray-400">Status</TableHead>
            <TableHead className="text-gray-400">Start Time</TableHead>
            <TableHead className="text-gray-400">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activePatrols.map((patrol, index) => {
            // Calculate duration
            const startTime = new Date(patrol.startTime);
            const now = new Date();
            
            let durationText = "";
            if (patrol.status === "on_duty") {
              // For active patrol, calculate from start time plus any previous active time
              const totalDurationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000) + 
                (patrol.activeDurationSeconds || 0);
              durationText = formatDuration(totalDurationSeconds);
            } else if (patrol.status === "paused") {
              // For paused patrol, use the saved active duration
              durationText = formatDuration(patrol.activeDurationSeconds || 0);
            }
            
            return (
              <TableRow key={index} className="border-gray-700">
                <TableCell className="font-medium">
                  {patrol.discordUserId}
                </TableCell>
                <TableCell>
                  {patrol.status === "on_duty" ? (
                    <Badge className="bg-[#57F287] text-white hover:bg-[#57F287]/80">On Duty</Badge>
                  ) : (
                    <Badge className="bg-[#FEE75C] text-black hover:bg-[#FEE75C]/80">Paused</Badge>
                  )}
                </TableCell>
                <TableCell className="text-gray-300">
                  {format(new Date(patrol.startTime), "MMM d, h:mm a")}
                </TableCell>
                <TableCell className="text-gray-300">
                  {durationText}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} sec`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min${remainingSeconds > 0 ? `, ${remainingSeconds} sec` : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} hr${hours !== 1 ? 's' : ''}, ${minutes} min`;
  }
}
