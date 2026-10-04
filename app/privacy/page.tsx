export default function Privacy() {
  return (
    <main className="content" style={{ maxWidth: 800 }}>
      <a href="/" className="brand">
        DMFlow
      </a>
      <section className="panel" style={{ marginTop: 30 }}>
        <h1>الخصوصية · Privacy</h1>
        <p>
          DMFlow stores the profile information, comments and messages needed to
          operate the Instagram automations you configure. Account access tokens
          are encrypted on the server. Instagram passwords are never collected.
        </p>
        <p>
          Workspace owners control access to customer conversations. When
          enabled by an owner, AI replies transmit selected conversation text
          and business knowledge to the AI provider configured by the operator.
          AI is disabled by default.
        </p>
        <p>
          Disconnecting Instagram disables automations and removes the stored
          access token. To delete the account’s imported contacts and messages,
          use the deletion control in connection settings. Meta data-deletion
          callbacks are also supported.
        </p>
        <p>
          The operator is responsible for publishing its identity and privacy
          contact, configuring retention periods, securing backups and reviewing
          the selected AI provider’s data handling before opening this service
          to external users.
        </p>
        <p>
          لا يجمع الموقع كلمة مرور Instagram. يمكن فصل الحساب وحذف بياناته من
          صفحة الربط. يجب أن يحدّد مشغّل الموقع جهة الاتصال وسياسة الاحتفاظ قبل
          إتاحته للجمهور.
        </p>
        <a className="text-button" href="/">
          Back to workspace
        </a>
      </section>
    </main>
  );
}
