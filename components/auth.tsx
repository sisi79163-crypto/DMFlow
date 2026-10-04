"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Workflow,
  ShieldCheck,
  MessageSquare,
  Zap,
} from "lucide-react";
export default function Auth({ onDone }: { onDone: () => void }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch("/api/auth/" + (register ? "register" : "login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout" dir="ltr">
      <section className="auth-brand">
        <a className="brand" href="/">
          <span className="brand-symbol">
            <Workflow size={23} />
          </span>
          DMFlow<span className="tiny-tag">WORKSPACE</span>
        </a>
        <div className="auth-story">
          <div className="eyebrow">LESS BUSYWORK. MORE CONVERSATIONS.</div>
          <h1>
            Every comment.
            <br />A new <span>connection.</span>
          </h1>
          <p>
            Your Instagram conversations, automations, and customers. In one
            thoughtful workspace.
          </p>
          <div className="auth-flow">
            <div>
              <MessageSquare />
              <span>A comment comes in</span>
              <b>“رابط”</b>
            </div>
            <div className="flow-line" />
            <div>
              <Zap />
              <span>Your flow takes over</span>
              <b>Private reply</b>
            </div>
            <div className="flow-line" />
            <div>
              <ArrowUpRight />
              <span>A conversation begins</span>
              <b>Connected</b>
            </div>
          </div>
        </div>
        <small>
          <ShieldCheck size={16} /> Built for the official Instagram API
        </small>
      </section>
      <section className="auth-form" dir="rtl">
        <div className="auth-form-inner">
          <div className="eyebrow">مساحة عملك تبدأ هنا</div>
          <h2>{register ? "أنشئ حساب DMFlow" : "مرحبًا بعودتك"}</h2>
          <p className="muted">
            تعليقات تتحول إلى محادثات. وبداية لكل فرصة جديدة.
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                الاسم / Name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                />
              </label>
            )}
            <label>
              البريد الإلكتروني / Email
              <input
                name="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                required
              />
            </label>
            <label>
              كلمة المرور / Password
              <input
                name="password"
                type="password"
                dir="ltr"
                minLength={12}
                maxLength={72}
                autoComplete={register ? "new-password" : "current-password"}
                required
              />
              <small>12 حرفًا على الأقل</small>
            </label>
            {error && (
              <div role="alert" className="alert error">
                {error}
              </div>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "جارٍ المتابعة…"
                : register
                  ? "إنشاء حساب"
                  : "تسجيل الدخول"}
            </button>
          </form>
          <button
            className="text-button full"
            onClick={() => setRegister(!register)}
          >
            {register
              ? "لديك حساب؟ تسجيل الدخول"
              : "حساب جديد؟ إنشاء مساحة عمل"}
          </button>
          <div className="auth-note">
            <ShieldCheck size={17} /> لا نطلب كلمة مرور Instagram مطلقًا.
          </div>
        </div>
      </section>
    </main>
  );
}
