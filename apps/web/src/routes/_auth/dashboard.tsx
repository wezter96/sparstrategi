import { createFileRoute } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: session } = authClient.useSession();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session?.user.email}</p>
    </div>
  );
}
