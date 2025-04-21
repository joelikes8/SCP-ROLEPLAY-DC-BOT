import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Dashboard from "@/components/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Home() {
  const [webSocketStatus, setWebSocketStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const [activePatrols, setActivePatrols] = useState<any[]>([]);
  const [latestVerifications, setLatestVerifications] = useState<any[]>([]);

  // Query for initial data
  const { data: initialPatrols, isLoading, isError } = useQuery({
    queryKey: ["/api/patrols/active"],
    retry: 3
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Use the specific WebSocket path that matches the server configuration
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onopen = () => {
      console.log("WebSocket connected to /ws path");
      setWebSocketStatus("connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message:", data);

        // Handle different types of updates
        if (data.type === "initial_data") {
          if (data.activePatrols) {
            setActivePatrols(data.activePatrols);
          }
        } else if (data.type === "patrol_update") {
          handlePatrolUpdate(data);
        } else if (data.type === "verification_update") {
          handleVerificationUpdate(data);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setWebSocketStatus("error");
    };

    socket.onclose = () => {
      console.log("WebSocket closed");
      setWebSocketStatus("error");
    };

    setWebSocket(socket);

    // Cleanup function
    return () => {
      socket.close();
    };
  }, []);

  // Update active patrols when initial data is loaded
  useEffect(() => {
    if (initialPatrols) {
      setActivePatrols(initialPatrols);
    }
  }, [initialPatrols]);

  // Handle patrol updates from WebSocket
  const handlePatrolUpdate = (data: any) => {
    const { action, userId, session } = data;

    if (action === "start" || action === "resume") {
      setActivePatrols(prev => {
        // Remove any existing session for this user
        const filtered = prev.filter(p => p.discordUserId !== userId);
        // Add the new session
        return [...filtered, session];
      });
    } else if (action === "pause") {
      setActivePatrols(prev => {
        // Update the session status
        return prev.map(p => p.discordUserId === userId ? session : p);
      });
    } else if (action === "end") {
      setActivePatrols(prev => {
        // Remove the session
        return prev.filter(p => p.discordUserId !== userId);
      });
    }
  };

  // Handle verification updates from WebSocket
  const handleVerificationUpdate = (data: any) => {
    const { action, userId, username, robloxUsername, robloxId } = data;

    if (action === "verify") {
      // Add to latest verifications
      setLatestVerifications(prev => {
        // Keep only the last 5 verifications
        const newVerifications = [
          {
            discordId: userId,
            discordUsername: username,
            robloxUsername,
            robloxId,
            verifiedAt: new Date()
          },
          ...prev
        ].slice(0, 5);
        
        return newVerifications;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-discord-bg flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-white">Loading Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">Loading bot status and patrol information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || webSocketStatus === "error") {
    return (
      <div className="min-h-screen bg-discord-bg flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Could not connect to the server. Please refresh the page or check your connection.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <Dashboard 
      activePatrols={activePatrols} 
      latestVerifications={latestVerifications}
      webSocketStatus={webSocketStatus}
    />
  );
}
