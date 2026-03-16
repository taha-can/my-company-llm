"""Integration registry: defines available integrations and what credentials each one needs."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CredentialField:
    key: str
    label: str
    placeholder: str = ""
    secret: bool = True
    required: bool = True
    help_text: str = ""


@dataclass
class IntegrationSpec:
    id: str
    name: str
    description: str
    icon: str
    category: str
    fields: list[CredentialField] = field(default_factory=list)
    tool_names: list[str] = field(default_factory=list)


INTEGRATIONS: dict[str, IntegrationSpec] = {}


def register_integration(spec: IntegrationSpec):
    INTEGRATIONS[spec.id] = spec


register_integration(IntegrationSpec(
    id="openai",
    name="OpenAI",
    description="LLM provider for GPT models and embeddings",
    icon="Brain",
    category="LLM",
    fields=[
        CredentialField(key="api_key", label="API Key", placeholder="sk-..."),
    ],
))

register_integration(IntegrationSpec(
    id="anthropic",
    name="Anthropic",
    description="LLM provider for Claude models",
    icon="Brain",
    category="LLM",
    fields=[
        CredentialField(key="api_key", label="API Key", placeholder="sk-ant-..."),
    ],
))

register_integration(IntegrationSpec(
    id="twitter",
    name="Twitter / X",
    description="Post tweets and threads to Twitter/X",
    icon="Twitter",
    category="Social Media",
    tool_names=["post_to_twitter", "post_twitter_thread"],
    fields=[
        CredentialField(key="api_key", label="API Key (Consumer Key)", placeholder="Your API key"),
        CredentialField(key="api_secret", label="API Secret (Consumer Secret)", placeholder="Your API secret"),
        CredentialField(key="access_token", label="Access Token", placeholder="User access token"),
        CredentialField(key="access_secret", label="Access Token Secret", placeholder="User access secret"),
    ],
))

register_integration(IntegrationSpec(
    id="linkedin",
    name="LinkedIn",
    description="Create posts on LinkedIn",
    icon="Linkedin",
    category="Social Media",
    tool_names=["post_to_linkedin"],
    fields=[
        CredentialField(key="access_token", label="Access Token (OAuth 2.0)", placeholder="Bearer token"),
    ],
))

register_integration(IntegrationSpec(
    id="instagram",
    name="Instagram",
    description="Post photos to Instagram via Meta Graph API",
    icon="Instagram",
    category="Social Media",
    tool_names=["post_to_instagram"],
    fields=[
        CredentialField(key="access_token", label="Access Token", placeholder="Meta Graph API token"),
        CredentialField(key="user_id", label="Instagram User ID", placeholder="Numeric user ID", secret=False),
    ],
))


register_integration(IntegrationSpec(
    id="google_gmail",
    name="Google Gmail",
    description="Send and read emails via Gmail API or Workspace delegation",
    icon="Mail",
    category="Google Workspace",
    tool_names=["send_email", "read_email"],
    fields=[
        CredentialField(
            key="sender_email",
            label="Workspace Sender Email",
            placeholder="agent@company.com",
            secret=False,
            required=False,
            help_text="Auto-linked for Google Workspace-provisioned agents. No manual login required.",
        ),
        CredentialField(
            key="client_id",
            label="Client ID",
            placeholder="xxxx.apps.googleusercontent.com",
            secret=False,
            required=False,
            help_text="Optional manual OAuth fallback for non-provisioned accounts.",
        ),
        CredentialField(
            key="client_secret",
            label="Client Secret",
            placeholder="GOCSPX-...",
            required=False,
            help_text="Optional manual OAuth fallback for non-provisioned accounts.",
        ),
        CredentialField(
            key="refresh_token",
            label="Refresh Token",
            placeholder="1//0...",
            required=False,
            help_text="Optional OAuth 2.0 refresh token for non-provisioned accounts.",
        ),
    ],
))

register_integration(IntegrationSpec(
    id="google_calendar",
    name="Google Calendar",
    description="Create and list calendar events via Calendar API or Workspace delegation",
    icon="Calendar",
    category="Google Workspace",
    tool_names=["create_calendar_event", "list_calendar_events"],
    fields=[
        CredentialField(
            key="sender_email",
            label="Workspace Account Email",
            placeholder="agent@company.com",
            secret=False,
            required=False,
            help_text="Auto-linked for Google Workspace-provisioned agents.",
        ),
        CredentialField(
            key="client_id",
            label="Client ID",
            placeholder="xxxx.apps.googleusercontent.com",
            secret=False,
            required=False,
            help_text="Optional manual OAuth fallback for non-provisioned accounts.",
        ),
        CredentialField(
            key="client_secret",
            label="Client Secret",
            placeholder="GOCSPX-...",
            required=False,
            help_text="Optional manual OAuth fallback for non-provisioned accounts.",
        ),
        CredentialField(
            key="refresh_token",
            label="Refresh Token",
            placeholder="1//0...",
            required=False,
            help_text="Optional OAuth 2.0 refresh token for non-provisioned accounts.",
        ),
    ],
))

register_integration(IntegrationSpec(
    id="google_drive",
    name="Google Drive",
    description="Upload and list files in Google Drive or Workspace delegation",
    icon="HardDrive",
    category="Google Workspace",
    tool_names=["upload_to_drive", "list_drive_files"],
    fields=[
        CredentialField(
            key="sender_email",
            label="Workspace Account Email",
            placeholder="agent@company.com",
            secret=False,
            required=False,
            help_text="Auto-linked for Google Workspace-provisioned agents.",
        ),
        CredentialField(
            key="client_id",
            label="Client ID",
            placeholder="xxxx.apps.googleusercontent.com",
            secret=False,
            required=False,
            help_text="Optional manual OAuth fallback for non-provisioned accounts.",
        ),
        CredentialField(
            key="client_secret",
            label="Client Secret",
            placeholder="GOCSPX-...",
            required=False,
            help_text="Optional manual OAuth fallback for non-provisioned accounts.",
        ),
        CredentialField(
            key="refresh_token",
            label="Refresh Token",
            placeholder="1//0...",
            required=False,
            help_text="Optional OAuth 2.0 refresh token for non-provisioned accounts.",
        ),
    ],
))

# ── Workspace Admin ──

register_integration(IntegrationSpec(
    id="google_workspace_admin",
    name="Google Workspace Admin",
    description="Auto-provision Google Workspace accounts for AI agents",
    icon="Building2",
    category="Workspace",
    fields=[
        CredentialField(
            key="service_account_json", label="Service Account JSON",
            placeholder='{"type": "service_account", ...}',
            help_text="Service account with Domain-wide Delegation and Admin SDK, Gmail, Calendar, and Drive scopes approved",
        ),
        CredentialField(
            key="admin_email", label="Admin Email",
            placeholder="admin@yourdomain.com", secret=False,
            help_text="Super admin email for impersonation",
        ),
    ],
))

register_integration(IntegrationSpec(
    id="microsoft_365_admin",
    name="Microsoft 365 Admin",
    description="Auto-provision Microsoft 365 accounts for AI agents",
    icon="Building2",
    category="Workspace",
    fields=[
        CredentialField(
            key="tenant_id", label="Tenant ID",
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret=False,
            help_text="Azure AD Tenant ID",
        ),
        CredentialField(
            key="client_id", label="Application (Client) ID",
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", secret=False,
            help_text="App registration Client ID with User.ReadWrite.All permission",
        ),
        CredentialField(
            key="client_secret", label="Client Secret",
            placeholder="xxxxxxxx",
            help_text="App registration client secret",
        ),
    ],
))

register_integration(IntegrationSpec(
    id="slack",
    name="Slack",
    description="Integrate AI agents into Slack workspace as team members",
    icon="MessageSquare",
    category="Workspace",
    fields=[
        CredentialField(
            key="bot_token", label="Bot Token (xoxb-...)",
            placeholder="xoxb-...",
            help_text="Global Slack bot token used during onboarding. Configure it here in Integrations.",
        ),
        CredentialField(
            key="team_id", label="Team/Workspace ID",
            placeholder="T0XXXXXXX", secret=False, required=False,
            help_text="Your Slack workspace ID",
        ),
        CredentialField(
            key="default_channel", label="Default Channel ID",
            placeholder="C0XXXXXXX", secret=False, required=False,
            help_text="Channel to auto-add agents to",
        ),
    ],
))

register_integration(IntegrationSpec(
    id="gemini",
    name="Gemini",
    description="Google Gemini API for direct responses and avatar image generation",
    icon="Sparkles",
    category="LLM",
    fields=[
        CredentialField(
            key="api_key",
            label="API Key",
            placeholder="AIza...",
            help_text="Gemini API key from Google AI Studio.",
        ),
    ],
))

# ── Creative / Media Generation ──

register_integration(IntegrationSpec(
    id="runway",
    name="Runway",
    description="AI video generation with Gen-3 Alpha. Create short video clips from text prompts.",
    icon="Video",
    category="Creative AI",
    tool_names=["generate_video"],
    fields=[
        CredentialField(
            key="api_key", label="API Key", placeholder="key_...",
            help_text="Get your API key from https://app.runwayml.com/settings/api-keys",
        ),
    ],
))

register_integration(IntegrationSpec(
    id="replicate",
    name="Replicate",
    description="Run open-source AI models — video, image, and audio generation.",
    icon="Sparkles",
    category="Creative AI",
    tool_names=["generate_video"],
    fields=[
        CredentialField(
            key="api_token", label="API Token", placeholder="r8_...",
            help_text="Get your token from https://replicate.com/account/api-tokens",
        ),
    ],
))
