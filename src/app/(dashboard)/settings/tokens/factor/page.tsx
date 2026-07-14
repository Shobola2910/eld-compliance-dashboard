import TokenAuthTabs from "@/components/TokenAuthTabs";

export default function FactorTokenPage() {
  return (
    <div className="flex justify-center pt-8">
      <TokenAuthTabs provider="factor" label="Factor ELD" />
    </div>
  );
}
