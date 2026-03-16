"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Building2 } from "lucide-react";
import { companyApi, type CompanySettings } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { toast } from "sonner";

export default function SettingsPage() {
  const { company, refresh: refreshCompany } = useCompany();
  const [name, setName] = useState(company?.company_name || "");
  const [description, setDescription] = useState(company?.company_description || "");
  const [industry, setIndustry] = useState(company?.industry || "");
  const [brandVoice, setBrandVoice] = useState(company?.brand_voice || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.company_name);
      setDescription(company.company_description);
      setIndustry(company.industry);
      setBrandVoice(company.brand_voice);
    }
  }, [company]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Company name is required.");
      return;
    }
    setSaving(true);
    try {
      await companyApi.save({
        company_name: name.trim(),
        company_description: description.trim(),
        industry: industry.trim(),
        brand_voice: brandVoice.trim(),
      });
      await refreshCompany();
      toast.success("Company settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 h-14">
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="max-w-lg space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Company Profile</h2>
              <p className="text-xs text-muted-foreground">
                This information is shared with your AI agents as context.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Company Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your company name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does your company do?"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Industry</label>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Technology, Healthcare, Finance"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Brand Voice</label>
              <textarea
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="Describe how your company communicates — tone, style, values..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
