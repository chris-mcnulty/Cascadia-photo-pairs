import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SocialAccounts from "./social-accounts";
import SocialImport from "./social-import";
import SocialPostsList from "./social-posts";
import SocialComposer from "./social-composer";

export default function SocialManagement() {
  const [tab, setTab] = useState("accounts");
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="accounts" data-testid="tab-social-accounts">
          Accounts
        </TabsTrigger>
        <TabsTrigger value="compose" data-testid="tab-social-compose">
          Compose
        </TabsTrigger>
        <TabsTrigger value="import" data-testid="tab-social-import">
          Import CSV
        </TabsTrigger>
        <TabsTrigger value="queue" data-testid="tab-social-queue">
          Post Queue
        </TabsTrigger>
      </TabsList>
      <TabsContent value="accounts">
        <SocialAccounts />
      </TabsContent>
      <TabsContent value="compose">
        <SocialComposer />
      </TabsContent>
      <TabsContent value="import">
        <SocialImport />
      </TabsContent>
      <TabsContent value="queue">
        <SocialPostsList />
      </TabsContent>
    </Tabs>
  );
}
