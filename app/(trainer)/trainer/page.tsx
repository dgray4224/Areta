import Link from "next/link";
import { listMyClients, listMyInviteCodes, listIncomingTrainerRequests } from "@/domains/trainer/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";
import { InviteCodePanel } from "./InviteCodePanel";
import { IncomingRequests } from "./IncomingRequests";

export default async function TrainerDashboardPage() {
  const [clients, codes, incomingRequests] = await Promise.all([
    listMyClients(),
    listMyInviteCodes(),
    listIncomingTrainerRequests(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex justify-end gap-2">
        <LinkButton href="/trainer/programs" variant="secondary">
          Your programs
        </LinkButton>
        <LinkButton href="/trainer/profile" variant="secondary">
          Edit public profile
        </LinkButton>
      </div>

      <IncomingRequests initialRequests={incomingRequests} />

      <section className="space-y-3">
        {clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            description="Generate an invite code below and share it with a client, or list your public profile so clients can find and request you."
          />
        ) : (
          <div className="space-y-2">
            {clients.map((client) => (
              <Link key={client.relationshipId} href={`/trainer/clients/${client.clientId}`}>
                <Card className="flex items-center justify-between hover:border-brand/40">
                  <div>
                    <p className="font-medium">{client.fullName || "Unnamed client"}</p>
                    <p className="text-xs text-neutral-500">
                      Client since {new Date(client.startedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <InviteCodePanel initialCodes={codes} />
      </section>
    </div>
  );
}
