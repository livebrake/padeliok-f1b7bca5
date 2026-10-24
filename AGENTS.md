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
- Montonio signing and payment reconciliation live behind server boundaries; only signed provider tokens or purpose-scoped retry capabilities authorize public payment operations, and verified provider order ID, reference, currency and amount must match before payment updates and idempotent email delivery.
