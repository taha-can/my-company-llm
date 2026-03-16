import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "my-company-llm — AI-Powered Digital Company Management Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafbfc",
          backgroundImage:
            "radial-gradient(ellipse at top, rgba(22,163,74,0.08), transparent 60%), radial-gradient(ellipse at bottom right, rgba(22,163,74,0.04), transparent 50%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "36px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "14px",
              backgroundColor: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              color: "white",
              fontWeight: 700,
            }}
          >
            MCL
          </div>
        </div>

        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#0f172a",
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: "900px",
            marginBottom: "16px",
          }}
        >
          Manage Your Digital Company
          <br />
          <span style={{ color: "#16a34a" }}>with AI-Powered Teams</span>
        </div>

        <div
          style={{
            fontSize: "22px",
            color: "#64748b",
            textAlign: "center",
            maxWidth: "700px",
            lineHeight: 1.5,
          }}
        >
          Build departments, automate operations, and scale your business from
          a single intelligent platform
        </div>

        <div
          style={{
            display: "flex",
            gap: "20px",
            marginTop: "44px",
          }}
        >
          {[
            "Team Management",
            "Departments",
            "Projects",
            "Knowledge Base",
            "Automation",
          ].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                borderRadius: "9999px",
                backgroundColor: "rgba(22,163,74,0.08)",
                border: "1px solid rgba(22,163,74,0.2)",
                color: "#15803d",
                fontSize: "15px",
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "32px",
            fontSize: "17px",
            color: "#94a3b8",
            fontWeight: 500,
          }}
        >
          my-company-llm.com
        </div>
      </div>
    ),
    { ...size }
  );
}
