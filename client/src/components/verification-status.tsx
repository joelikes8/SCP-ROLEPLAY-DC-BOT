import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface VerificationStatusProps {
  verifications: any[];
}

export default function VerificationStatus({ verifications }: VerificationStatusProps) {
  if (verifications.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No recent verifications.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-700">
            <TableHead className="text-gray-400">Roblox User</TableHead>
            <TableHead className="text-gray-400">Discord User</TableHead>
            <TableHead className="text-gray-400">Verified At</TableHead>
            <TableHead className="text-gray-400">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {verifications.map((verification, index) => (
            <TableRow key={index} className="border-gray-700">
              <TableCell className="font-medium">
                <div className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={`https://www.roblox.com/headshot-thumbnail/image?userId=${verification.robloxId}&width=48&height=48&format=png`} 
                      alt={verification.robloxUsername} 
                    />
                    <AvatarFallback className="bg-[#5865F2] text-white">
                      {verification.robloxUsername?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span>{verification.robloxUsername}</span>
                </div>
              </TableCell>
              <TableCell className="text-gray-300">
                {verification.discordUsername}
              </TableCell>
              <TableCell className="text-gray-300">
                {format(new Date(verification.verifiedAt), "MMM d, h:mm a")}
              </TableCell>
              <TableCell>
                <Badge className="bg-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2]/20">
                  Verified
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
