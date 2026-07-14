import TokenAuthTabs from "@/components/TokenAuthTabs";

export default function LeaderTokenPage() {
  return (
    <div className="flex justify-center pt-8">
      <TokenAuthTabs provider="leader" label="Leader ELD" />
    </div>
  );
}
