import TokenAuthTabs from "@/components/TokenAuthTabs";

export default function NexusTokenPage() {
  return (
    <div className="flex justify-center pt-8">
      <TokenAuthTabs provider="nexus" label="Nexus ELD" />
    </div>
  );
}
