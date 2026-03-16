"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Sparkles,
  Users,
  Plus,
  X,
} from "lucide-react";
import { companyApi } from "@/lib/api";
import { useCompany } from "@/lib/company-context";

interface AgentEntry {
  name: string;
  role: string;
}

export function WelcomeScreen() {
  const { refresh } = useCompany();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [agents, setAgents] = useState<AgentEntry[]>([
    { name: "", role: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addAgent = () => {
    setAgents([...agents, { name: "", role: "" }]);
  };

  const removeAgent = (index: number) => {
    if (agents.length <= 1) return;
    setAgents(agents.filter((_, i) => i !== index));
  };

  const updateAgent = (
    index: number,
    field: keyof AgentEntry,
    value: string
  ) => {
    setAgents(agents.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const validAgents = agents.filter(
    (a) => a.name.trim() && a.role.trim()
  );
  const canSubmit =
    companyName.trim() && departmentName.trim() && validAgents.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await companyApi.onboarding({
        company_name: companyName.trim(),
        company_description: description.trim(),
        industry: industry.trim(),
        department_name: departmentName.trim(),
        agents: validAgents.map((a) => ({
          name: a.name.trim(),
          role: a.role.trim(),
        })),
      });
      await refresh();
    } catch (err) {
      console.error("Failed to complete setup:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[0, 1, 2].map((s) => (
        <div
          key={s}
          className={`h-2 rounded-full transition-all ${
            s === step ? "w-8 bg-primary" : s < step ? "w-2 bg-primary/60" : "w-2 bg-muted"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to AI Workers
          </h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            {step === 0 && "Let\u2019s set up your company to get started."}
            {step === 1 && "Tell us a bit more about your business."}
            {step === 2 && "Create your first department and agents."}
          </p>
        </div>

        {stepIndicator}

        <Card className="border-2">
          <CardContent className="pt-6 space-y-6">
            {/* Step 0: Company Name */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    What&apos;s your company name?
                  </label>
                  <Input
                    placeholder="e.g. Acme Corporation"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="text-lg h-12"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && companyName.trim()) setStep(1);
                    }}
                  />
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setStep(1)}
                  disabled={!companyName.trim()}
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 1: Description & Industry */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    What does {companyName} do?
                  </label>
                  <Input
                    placeholder="e.g. AI-powered analytics platform for businesses"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setStep(2);
                    }}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    This helps your AI agents understand your business context.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Industry</label>
                  <Input
                    placeholder="e.g. Technology, Healthcare, Finance"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setStep(2);
                    }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(0)}
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() => setStep(2)}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Department & Agents */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Department name
                  </label>
                  <Input
                    placeholder="e.g. Marketing, Engineering, Sales"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    You can create more departments later.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Add agents to this department
                  </label>

                  <div className="space-y-3">
                    {agents.map((agent, index) => (
                      <div
                        key={index}
                        className="flex gap-2 items-start"
                      >
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Agent name"
                            value={agent.name}
                            onChange={(e) =>
                              updateAgent(index, "name", e.target.value)
                            }
                          />
                          <Input
                            placeholder="Role (e.g. Content Writer, Data Analyst)"
                            value={agent.role}
                            onChange={(e) =>
                              updateAgent(index, "role", e.target.value)
                            }
                          />
                        </div>
                        {agents.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeAgent(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addAgent}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add another agent
                  </Button>
                </div>

                {error && (
                  <p className="text-sm text-destructive text-center">
                    {error}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={saving || !canSubmit}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Launch {companyName}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          You can change these settings and add more departments later.
        </p>
      </div>
    </div>
  );
}
