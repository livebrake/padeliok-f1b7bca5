<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep checkout eligibility in a browser-safe shared validation module used by the form and submission handler so required-field and agreement rules cannot diverge.
- Classify preview hosts in the shared browser-safe preview-host module using the actual request URL inside gate handlers; production build flags cannot distinguish built previews from published sites, and admin authentication must remain independent.
- Mark orders paid only from a Montonio token whose HS256 signature, access key and amount are verified server-side (return page and webhook share one handler); emails are claimed via payment_email_sent_at so they send once.
- Team authority lives only in protected team_roles and active team_members; profiles hold display data, never roles, to prevent privilege escalation.
- Team order reads use team_orders with server-side financial redaction; mutations use narrow change_team_order RPC and immutable database audit triggers to preserve authenticated actors and automated payment ownership.
- Deactivate team membership instead of deleting accounts, retaining historical assignment and audit references; manage_team_member serializes last-super-admin protection.
- Team invitations use an authenticated server function with a verified super-admin check before loading the service client; public invitation completion sets the password.
