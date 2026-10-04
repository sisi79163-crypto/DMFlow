# Meta / Instagram configuration

This project uses **Instagram API with Instagram Login**, not unofficial clients, scraping, or an Instagram password form. Do not mix Facebook Login scopes/tokens with this implementation.

## Operator setup

1. Create a Meta developer app with the Instagram API use case. Add Instagram Login to the professional-account flow supported by your app dashboard.
2. Set the web platform/domain and an exact redirect URI: `https://YOUR_DOMAIN/api/meta/callback`.
3. On the server set `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION`, `META_WEBHOOK_VERIFY_TOKEN`, `APP_URL`, and `TOKEN_ENCRYPTION_KEY`.
4. The `.env.example` API version is an explicit starting version, not an assertion that it is the newest. Choose a supported version shown in your app dashboard and run the sandbox test checklist before live use.
5. Add callback `https://YOUR_DOMAIN/api/webhooks/instagram`; enter the same verify token you set server-side. Subscribe the Instagram object to `comments`, `messages`, and `messaging_postbacks` if available for the app. Postbacks are subscribed for future richer interactions; this release handles comment and text message events.
6. Register `https://YOUR_DOMAIN/api/meta/deletion` as the data deletion callback. Configure the privacy page URL and replace the operator-specific policy text before review.
7. Log in to DMFlow, open Instagram connection, click Connect. Use a Business or Creator account. Authorize only through Instagram’s hosted screen. OAuth exchanges the short token for a long-lived token, stores it encrypted, subscribes the account and syncs media.
8. Create an automation for a synced post, save it, then explicitly activate it. Comment from a separate test user. Confirm private reply, public reply if selected, user response, follow-up and opt-out.

## Requested scopes

| Scope                                | Used for                                                  |
| ------------------------------------ | --------------------------------------------------------- |
| `instagram_business_basic`           | Account identification and media access                   |
| `instagram_business_manage_comments` | Comment events and public/private comment-related actions |
| `instagram_business_manage_messages` | Messaging and conversation replies                        |

Access levels, webhook availability and business verification requirements depend on the Meta app and use case. Developer/test roles can be used only where Meta permits. To serve professional accounts outside the developer roles, request the necessary Advanced Access through App Review and put the approved app into Live mode. Approval is external; this source code does not grant it.

Provide reviewers: a working HTTPS domain, test credentials, a clear screencast of OAuth → post selection → keyword comment → private reply → user reply → follow-up, justification for each scope, published privacy/deletion instructions and reviewer-accessible settings. Never submit real production account passwords in source files.

## Implemented messaging guardrails

- One initial private reply per comment, addressed by comment ID.
- Initial comment response limited to seven days; Live comments are not handled in this release.
- A comment alone does not open the normal messaging window. Follow-up waits for the person to reply, then uses a 24-hour window.
- No `HUMAN_AGENT` extension is used for automation or manual inbox sends.
- Per-contact cooldown, per-account conservative configurable rate budget, opt-out, signed webhooks, exponential retry only where rejection is known, and ambiguous-delivery quarantine.
- Arabic stop word `توقف` and English `stop`/`unsubscribe` opt out.

## Official references and verification status

- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
- https://developers.facebook.com/docs/instagram-platform/private-replies/
- https://developers.facebook.com/docs/instagram-platform/webhooks/
- https://www.postman.com/meta/instagram/

Meta documentation requests returned rate-limit/access errors in the build environment. The OAuth and messaging code has integration coverage against controlled responses, but no live Meta credentials or approved app were available for a real account test. Validate endpoints, scopes and current limits against your app’s official dashboard/documentation before production activation.
