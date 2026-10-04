"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  Workflow,
  MessageSquare,
  Users,
  BarChart3,
  BookOpen,
  Settings,
  Camera as Instagram,
  Activity,
  Webhook,
  BrainCircuit,
  Link2,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Check,
  Pause,
  Play,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  RefreshCw,
  Send,
  Trash2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Command,
  Clock,
  Copy,
  FileText,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Auth from "./auth";
import { defaultFlow, type Flow } from "@/lib/flow";
const FlowBuilder = dynamic(() => import("./flow-builder"), {
  ssr: false,
  loading: () => <div className="empty">Loading editor…</div>,
});
type Data = any;
type View =
  | "dashboard"
  | "automations"
  | "inbox"
  | "leads"
  | "analytics"
  | "knowledge"
  | "links"
  | "connection"
  | "ai"
  | "logs"
  | "webhooks"
  | "settings";
const nav = [
  ["dashboard", LayoutDashboard, "نظرة عامة", "Overview"],
  ["automations", Workflow, "الأتمتة", "Automations"],
  ["inbox", MessageSquare, "صندوق الوارد", "Inbox"],
  ["leads", Users, "العملاء", "Contacts"],
  ["analytics", BarChart3, "التحليلات", "Analytics"],
  ["knowledge", BookOpen, "قاعدة المعرفة", "Knowledge base"],
  ["links", Link2, "الروابط", "Tracked links"],
] as const;
const manage = [
  ["connection", Instagram, "ربط Instagram", "Instagram"],
  ["ai", BrainCircuit, "مساعد الذكاء الاصطناعي", "AI assistant"],
  ["logs", Activity, "سجل النشاط", "Activity"],
  ["webhooks", Webhook, "Webhooks", "Webhooks"],
  ["settings", Settings, "الإعدادات", "Settings"],
] as const;
const statuses = ["Interested", "Hot Lead", "Customer", "Needs Follow-up"];
export default function Workspace() {
  const [data, setData] = useState<Data>(null),
    [auth, setAuth] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState<View>("dashboard"),
    [ar, setAr] = useState(true),
    [dark, setDark] = useState(false),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [notifications, setNotifications] = useState(false),
    [editor, setEditor] = useState<any>(null),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0),
    [selectedLead, setSelectedLead] = useState<any>(null),
    [messages, setMessages] = useState<any[]>([]),
    [reply, setReply] = useState(""),
    [knowledgeEdit, setKnowledgeEdit] = useState<any>(null);
  const t = (a: string, b: string) => (ar ? a : b);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(
        "/api/workspace?" +
          new URLSearchParams({ q, status, page: String(page) }),
      );
      if (r.status === 401) {
        setAuth(true);
        return;
      }
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setData(b);
      setAuth(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, status, page]);
  useEffect(() => {
    const v = new URLSearchParams(location.search).get("view");
    if (v && [...nav, ...manage].some((n) => n[0] === v)) setView(v as View);
    setDark(localStorage.getItem("dmflow-dark") === "true");
    setAr(localStorage.getItem("dmflow-lang") !== "en");
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dir = ar ? "rtl" : "ltr";
    document.documentElement.lang = ar ? "ar" : "en";
    localStorage.setItem("dmflow-lang", ar ? "ar" : "en");
  }, [ar]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("dmflow-dark", String(dark));
  }, [dark]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function act(action: string, payload: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      await refresh();
      setToast(t("تم حفظ التغييرات", "Changes saved"));
      return b;
    } catch (e) {
      setToast((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  function run(action: string, payload: unknown) {
    void act(action, payload).catch(() => {});
  }
  async function connect() {
    setBusy(true);
    try {
      const r = await fetch("/api/meta/connect", { method: "POST" });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      location.assign(b.url);
    } catch (e) {
      setToast((e as Error).message);
      setBusy(false);
    }
  }
  const loadMessages = useCallback(async (id: string) => {
    const r = await fetch(
      "/api/workspace?view=messages&leadId=" + encodeURIComponent(id),
    );
    const b = await r.json();
    if (r.ok) {
      setMessages(b.messages);
      setSelectedLead(b.lead);
    }
  }, []);
  useEffect(() => {
    if (!selectedLead?.id || view !== "inbox") return;
    const timer = setInterval(() => loadMessages(selectedLead.id), 5000);
    return () => clearInterval(timer);
  }, [selectedLead?.id, view, loadMessages]);
  function navigate(v: View) {
    setView(v);
    setMobile(false);
    history.replaceState(null, "", "/?view=" + v);
  }
  function createAutomation(template?: string) {
    const f: Flow = JSON.parse(JSON.stringify(defaultFlow));
    const isPricing = template === t("استفسار عن السعر", "Pricing enquiry");
    const isInterest = template === t("عميل مهتم", "Capture interest");
    const isLink = template === t("إرسال رابط", "Share a link");
    f.nodes.push({
      id: "answer",
      position: { x: 200, y: 390 },
      data: {
        kind:
          isPricing || isInterest ? "question" : isLink ? "link" : "message",
        label: isPricing
          ? "Ask product"
          : isInterest
            ? "Ask interest"
            : isLink
              ? "Share your link"
              : "Send message",
        text: isPricing
          ? t(
              "عن أي منتج تريد معرفة السعر؟",
              "Which product would you like pricing for?",
            )
          : isInterest
            ? t(
                "أهلًا! ما المنتج الذي يهمك؟",
                "Hi! Which product are you interested in?",
              )
            : isLink
              ? t("هذا الرابط الذي طلبته:", "Here is the link you requested:")
              : t("أهلًا! كيف يمكنني مساعدتك؟", "Hi! How can I help?"),
        ...(isLink ? { value: "" } : {}),
      },
    });
    f.edges.push({ id: "e3", source: "wait", target: "answer" });
    if (isInterest) {
      f.nodes.push({
        id: "tag",
        position: { x: 200, y: 520 },
        data: { kind: "tag", label: "Tag hot lead", value: "Hot Lead" },
      });
      f.edges.push({ id: "e4", source: "answer", target: "tag" });
    }
    setEditor({
      name: template || "",
      accountId: data.accounts[0]?.id || "",
      mediaId: "",
      trigger: "keywords",
      keywords: isPricing
        ? ["السعر", "بكم", "price"]
        : isInterest
          ? ["مهتم", "بدي", "interested"]
          : ["رابط", "أرسل", "link"],
      messageA: t(
        "أهلًا! شكرًا لاهتمامك. رد على هذه الرسالة لأرسل لك التفاصيل.",
        "Thanks for your interest! Reply here and I’ll send you the details.",
      ),
      messageB: "",
      publicReply: "",
      cooldownHours: 24,
      startsAt: null,
      endsAt: null,
      flow: f,
    });
  }
  if (auth) return <Auth onDone={refresh} />;
  if (!data)
    return (
      <main className="boot">
        <span className="brand-symbol">
          <Workflow />
        </span>
        <h2>DMFlow</h2>
        <p>{error || t("جارٍ فتح مساحة العمل…", "Opening your workspace…")}</p>
        {error && (
          <button className="button" onClick={refresh}>
            {t("إعادة المحاولة", "Retry")}
          </button>
        )}
      </main>
    );
  const title = [...nav, ...manage].find((n) => n[0] === view);
  const unread = data.notifications.filter((n: any) => !n.read).length;
  const chart = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(data.analyticsDate + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 29 + i);
    const day = d.toISOString().slice(0, 10);
    return {
      day: day.slice(5),
      out: data.trend
        .filter((x: any) => x.day === day && x.direction === "out")
        .reduce((n: number, x: any) => n + x.count, 0),
      in: data.trend
        .filter((x: any) => x.day === day && x.direction === "in")
        .reduce((n: number, x: any) => n + x.count, 0),
    };
  });
  const active = data.automations.filter((a: any) => a.enabled).length;
  const chartElement = (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chart}
          margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7761e8" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#7761e8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--line)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            minTickGap={45}
            tick={{ fill: "#87909e", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "#87909e", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
            }}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="out"
            name={t("رسائل مرسلة", "Sent messages")}
            stroke="#7761e8"
            fill="url(#fill)"
            strokeWidth={2.5}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="in"
            name={t("ردود العملاء", "Replies")}
            stroke="#28a88c"
            fill="transparent"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
  const empty = (
    Icon: any,
    heading: string,
    body: string,
    button?: React.ReactNode,
  ) => (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={27} />
      </span>
      <h3>{heading}</h3>
      <p>{body}</p>
      {button}
    </div>
  );
  return (
    <div className="app-shell">
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a className="brand" href="/">
          <span className="brand-symbol">
            <Workflow size={22} />
          </span>
          DMFlow
        </a>
        <button
          className="workspace-switch"
          onClick={() => navigate("settings")}
        >
          <span className="avatar violet">
            {data.workspace.name.slice(0, 1)}
          </span>
          <span>
            <strong>{data.workspace.name}</strong>
            <small>{t("مساحة العمل", "Workspace")}</small>
          </span>
          <ChevronRight size={15} />
        </button>
        <div className="nav-caption">{t("مساحة العمل", "WORKSPACE")}</div>
        <nav>
          {nav.map(([key, Icon, a, b]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={19} />
              <span>{t(a, b)}</span>
              {key === "automations" && (
                <small className="nav-count">{data.automations.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-caption">{t("الإدارة", "MANAGE")}</div>
        <nav>
          {manage.map(([key, Icon, a, b]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              <Icon size={18} />
              <span>{t(a, b)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-chip">
            <span
              className={
                "status-dot " +
                (data.accounts.some((a: any) => a.connected) ? "live" : "")
              }
            />
            {data.accounts.some((a: any) => a.connected)
              ? t("Instagram متصل", "Instagram connected")
              : t("لا يوجد حساب متصل", "No Instagram connected")}
          </div>
          <button className="profile" onClick={() => navigate("settings")}>
            <span className="avatar">
              {data.user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{data.user.name}</strong>
              <small>{t("مالك مساحة العمل", "Workspace owner")}</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{title ? t(title[2], title[3]) : "DMFlow"}</strong>
          </div>
          <div className="top-actions">
            <button className="language" onClick={() => setAr(!ar)}>
              {ar ? "EN" : "عربي"}
            </button>
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="notifications-wrap">
              <button
                className="icon-button"
                aria-label="Notifications"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                {unread > 0 && <span className="notification-dot" />}
              </button>
              {notifications && (
                <div className="notification-pop">
                  <div className="panel-title">
                    <strong>{t("الإشعارات", "Notifications")}</strong>
                    <button
                      className="text-button"
                      onClick={() => run("notification.read", {})}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                  {!data.notifications.length ? (
                    <p className="muted">
                      {t("لا توجد إشعارات جديدة", "You’re all caught up")}
                    </p>
                  ) : (
                    data.notifications.map((n: any) => (
                      <p key={n.id} className={n.read ? "muted" : ""}>
                        {n.title}
                        <small>{new Date(n.createdAt).toLocaleString()}</small>
                      </p>
                    ))
                  )}
                </div>
              )}
            </div>
            <span className="top-divider" />
            <span className="avatar small">{data.user.name.slice(0, 1)}</span>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "dashboard"
                  ? t("كل محادثة، فرصة جديدة", "MAKE EVERY CONVERSATION COUNT")
                  : "DMFLOW WORKSPACE"}
              </div>
              <h1>
                {view === "dashboard"
                  ? t("مساحة للنمو.", "Your growth, in focus.")
                  : title
                    ? t(title[2], title[3])
                    : ""}
              </h1>
              <p>
                {view === "dashboard"
                  ? t(
                      "من أول تعليق إلى علاقة حقيقية. كل شيء هنا.",
                      "From the first comment to a real connection. All right here.",
                    )
                  : view === "automations"
                    ? t(
                        "صمّم محادثات تبدأ في الوقت المناسب.",
                        "Thoughtful conversations, running on your terms.",
                      )
                    : view === "inbox"
                      ? t(
                          "كل محادثات عملائك في مكان واحد.",
                          "Every customer conversation, in one place.",
                        )
                      : view === "knowledge"
                        ? t(
                            "المعلومات التي يعتمد عليها مساعدك في الرد.",
                            "The source of truth for your AI assistant.",
                          )
                        : ""}
              </p>
            </div>
            <div className="heading-actions">
              {["dashboard", "automations"].includes(view) && (
                <button
                  className="button primary"
                  onClick={() => createAutomation()}
                >
                  <Plus size={18} />
                  {t("أتمتة جديدة", "New automation")}
                </button>
              )}
              {view === "knowledge" && (
                <button
                  className="button primary"
                  onClick={() =>
                    setKnowledgeEdit({
                      title: "",
                      category: "business",
                      content: "",
                    })
                  }
                >
                  <Plus size={18} />
                  {t("إضافة معرفة", "Add knowledge")}
                </button>
              )}
              <button
                className="icon-button bordered"
                aria-label="Refresh"
                onClick={refresh}
              >
                <RefreshCw size={17} />
              </button>
            </div>
          </div>
          {error && <div className="alert error">{error}</div>}
          {view === "dashboard" && (
            <>
              {!data.accounts.some((a: any) => a.connected) && (
                <section className="connect-banner">
                  <div className="instagram-mark">
                    <Instagram size={27} />
                  </div>
                  <div>
                    <div className="eyebrow">
                      {t("خطوتك الأولى", "YOUR FIRST CONNECTION")}
                    </div>
                    <h2>
                      {t(
                        "حوّل التعليقات إلى محادثات.",
                        "Turn comments into conversations.",
                      )}
                    </h2>
                    <p>
                      {t(
                        "اربط حسابك الاحترافي، اختر منشورًا، ودع التدفق يبدأ.",
                        "Connect your professional account. Pick a post. Let the flow begin.",
                      )}
                    </p>
                  </div>
                  <button
                    className="button dark-button"
                    onClick={connect}
                    disabled={busy}
                  >
                    {t("ربط Instagram", "Connect Instagram")}
                    <ArrowUpRight size={17} />
                  </button>
                </section>
              )}
              <div className="stats-grid">
                {[
                  [
                    MessageSquare,
                    t("التعليقات", "Comments"),
                    data.stats.comments,
                  ],
                  [Send, t("الرسائل الخاصة", "Messages sent"), data.stats.sent],
                  [
                    Users,
                    t("ردود العملاء", "Customer replies"),
                    data.stats.replies,
                  ],
                  [
                    ArrowUpRight,
                    t("التحويل إلى عملاء", "Customer conversion"),
                    data.stats.conversion + "%",
                  ],
                ].map(([Icon, label, value]: any, i) => (
                  <section className="stat-card" key={i}>
                    <div>
                      <span>{label}</span>
                      <Icon size={18} />
                    </div>
                    <strong>{value}</strong>
                    <small>
                      {i === 3
                        ? t(
                            "عملاء مشترون ÷ إجمالي العملاء",
                            "Customers ÷ all contacts",
                          )
                        : t("من جميع الحملات", "Across all automations")}
                    </small>
                  </section>
                ))}
              </div>
              <div className="dashboard-columns">
                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h3>{t("نشاط المحادثات", "Conversation activity")}</h3>
                      <p>
                        {t(
                          "كل تفاعل هو بداية جديدة",
                          "A little momentum, every day",
                        )}
                      </p>
                    </div>
                    <span className="pill">
                      {t("آخر 30 يومًا", "Last 30 days")}
                      <Clock size={13} />
                    </span>
                  </div>
                  {chartElement}
                  <div className="chart-legend">
                    <span>
                      <i style={{ background: "#7761e8" }} />
                      {t("رسائل مرسلة", "Messages sent")}
                    </span>
                    <span>
                      <i style={{ background: "#28a88c" }} />
                      {t("الردود", "Replies")}
                    </span>
                  </div>
                </section>
                <section className="panel getting-started">
                  <div className="panel-title">
                    <h3>{t("جهّز تدفقك الأول", "Make it flow")}</h3>
                    <span className="mini-logo">
                      <Workflow size={19} />
                    </span>
                  </div>
                  <p className="muted">
                    {t(
                      "ثلاث خطوات للوصول إلى جمهورك.",
                      "Three steps closer to your audience.",
                    )}
                  </p>
                  {[
                    [
                      data.accounts.some((a: any) => a.connected),
                      "connection",
                      t("اربط حساب Instagram", "Connect Instagram"),
                      t("ربط رسمي وآمن", "An official, secure connection"),
                    ],
                    [
                      data.automations.length > 0,
                      "automations",
                      t("أنشئ أول أتمتة", "Create your first automation"),
                      t("اختر المنشور والكلمات", "Pick your post and keywords"),
                    ],
                    [
                      active > 0,
                      "automations",
                      t("شغّل المحادثة", "Start the conversation"),
                      t("فعّل حملتك الأولى", "Publish your first flow"),
                    ],
                  ].map(([done, target, label, sub], i) => (
                    <button
                      className="checklist-row"
                      key={i}
                      onClick={() => navigate(target as View)}
                    >
                      <span
                        className={"step-number " + (done ? "complete" : "")}
                      >
                        {done ? <Check size={16} /> : i + 1}
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>{sub}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${([data.accounts.length > 0, data.automations.length > 0, active > 0].filter(Boolean).length / 3) * 100}%`,
                      }}
                    />
                  </div>
                  <small className="muted">
                    {t(
                      "خطوات صغيرة، علاقات أقوى.",
                      "Small steps. Stronger connections.",
                    )}
                  </small>
                </section>
              </div>
              <section className="panel">
                <div className="panel-title">
                  <h3>
                    {t("أتمتتك", "Your automations")}
                    <span className="count-badge">
                      {data.automations.length}
                    </span>
                  </h3>
                  <button
                    className="text-button"
                    onClick={() => navigate("automations")}
                  >
                    {t("عرض الكل", "View all")}
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                {data.automations.length ? (
                  <div className="compact-list">
                    {data.automations.slice(0, 4).map((a: any) => (
                      <button
                        className="automation-row"
                        key={a.id}
                        onClick={() => setEditor(a)}
                      >
                        <span className="automation-icon">
                          <Workflow size={19} />
                        </span>
                        <span>
                          <strong>{a.name}</strong>
                          <small>
                            {a.keywords.join(" · ") ||
                              t("كل التعليقات", "Any comment")}
                          </small>
                        </span>
                        <span className={"badge " + (a.enabled ? "green" : "")}>
                          {a.enabled
                            ? t("تعمل", "Active")
                            : t("متوقفة", "Paused")}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  empty(
                    Workflow,
                    t("فكرتك الأولى تبدأ هنا", "Your first flow starts here"),
                    t(
                      "ردّ على المهتمين، شارك روابطك، وابدأ محادثة.",
                      "Reply to interest. Share your links. Start a conversation.",
                    ),
                    <button
                      className="text-button"
                      onClick={() => createAutomation()}
                    >
                      <Plus size={16} />
                      {t("إنشاء أتمتة", "Create automation")}
                    </button>,
                  )
                )}
              </section>
            </>
          )}
          {view === "automations" && (
            <>
              <div className="template-grid">
                {[
                  [
                    Link2,
                    t("إرسال رابط", "Share a link"),
                    t("تعليق واحد يفتح الباب.", "One comment opens the door."),
                  ],
                  [
                    MessageSquare,
                    t("استفسار عن السعر", "Pricing enquiry"),
                    t(
                      "التفاصيل في الوقت المناسب.",
                      "The right details, right on time.",
                    ),
                  ],
                  [
                    Sparkles,
                    t("عميل مهتم", "Capture interest"),
                    t("ابدأ محادثة شخصية.", "Start a personal conversation."),
                  ],
                ].map(([Icon, name, sub]: any, i) => (
                  <button
                    className="template-card"
                    key={i}
                    onClick={() => createAutomation(name)}
                  >
                    <Icon size={21} />
                    <strong>{name}</strong>
                    <small>{sub}</small>
                    <Plus size={17} />
                  </button>
                ))}
              </div>
              <section className="panel">
                <div className="panel-title">
                  <h3>{t("كل الأتمتة", "All automations")}</h3>
                  <span className="pill">
                    {active} {t("نشطة", "active")}
                  </span>
                </div>
                {data.automations.length ? (
                  <div className="automation-grid">
                    {data.automations.map((a: any) => (
                      <article className="automation-card" key={a.id}>
                        <div className="row-between">
                          <span className="automation-icon">
                            <Workflow />
                          </span>
                          <span
                            className={"badge " + (a.enabled ? "green" : "")}
                          >
                            {a.enabled
                              ? t("نشطة", "Live")
                              : t("مسودة / متوقفة", "Draft / paused")}
                          </span>
                        </div>
                        <h3>{a.name}</h3>
                        <div className="tags">
                          {(a.trigger === "any"
                            ? [t("أي تعليق", "Any comment")]
                            : a.keywords
                          ).map((k: string) => (
                            <span className="tag" key={k}>
                              {k}
                            </span>
                          ))}
                        </div>
                        <p className="message-preview">{a.messageA}</p>
                        <div className="automation-footer">
                          <span>
                            {a._count.comments} {t("تعليق", "comments")}
                          </span>
                          <button
                            className="text-button"
                            onClick={() => setEditor(a)}
                          >
                            {t("تعديل التدفق", "Edit flow")}
                          </button>
                          <button
                            className="icon-button bordered"
                            aria-label="Pause or resume"
                            disabled={busy}
                            onClick={() =>
                              run("automation.toggle", {
                                id: a.id,
                                enabled: !a.enabled,
                              })
                            }
                          >
                            {a.enabled ? (
                              <Pause size={16} />
                            ) : (
                              <Play size={16} />
                            )}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  empty(
                    Workflow,
                    t("لا توجد أتمتة بعد", "No automations yet"),
                    t(
                      "اختر قالبًا أو ابدأ من أتمتة جديدة.",
                      "Choose a template or build your first flow.",
                    ),
                  )
                )}
              </section>
            </>
          )}
          {view === "inbox" && (
            <section className="inbox-layout panel">
              <div className="conversation-list">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    placeholder={t("ابحث عن محادثة…", "Search conversations…")}
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                {data.leads.map((l: any) => (
                  <button
                    key={l.id}
                    className={
                      "conversation " +
                      (selectedLead?.id === l.id ? "selected" : "")
                    }
                    onClick={() => loadMessages(l.id)}
                  >
                    <span className="avatar violet">
                      {(l.username || l.instagramId).slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{l.username || l.instagramId}</strong>
                      <small>
                        {l.comments[0]?.text ||
                          t("محادثة Instagram", "Instagram conversation")}
                      </small>
                    </span>
                  </button>
                ))}
                {!data.leads.length && (
                  <p className="empty-small">
                    {t(
                      "تظهر المحادثات عند وصول أول تفاعل.",
                      "Conversations appear after your first interaction.",
                    )}
                  </p>
                )}
              </div>
              <div className="chat">
                {selectedLead ? (
                  <>
                    <div className="chat-header">
                      <span className="avatar violet">
                        {(selectedLead.username || "?").slice(0, 1)}
                      </span>
                      <div>
                        <strong>
                          {selectedLead.username || selectedLead.instagramId}
                        </strong>
                        <small>
                          {selectedLead.lastInboundAt &&
                          Date.now() -
                            new Date(selectedLead.lastInboundAt).getTime() <
                            86400000
                            ? t("نافذة الرد مفتوحة", "Reply window open")
                            : t(
                                "بانتظار رسالة من العميل",
                                "Waiting for a customer message",
                              )}
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={() =>
                          run("lead.update", {
                            ...selectedLead,
                            aiPaused: !selectedLead.aiPaused,
                          })
                        }
                      >
                        {selectedLead.aiPaused
                          ? t("تفعيل AI", "Resume AI")
                          : t("إيقاف AI", "Pause AI")}
                      </button>
                    </div>
                    <div className="messages">
                      {messages.length >= 100 && (
                        <button
                          className="text-button"
                          onClick={async () => {
                            const r = await fetch(
                              "/api/workspace?view=messages&leadId=" +
                                selectedLead.id +
                                "&before=" +
                                messages[0].createdAt,
                            );
                            const b = await r.json();
                            if (r.ok) setMessages([...b.messages, ...messages]);
                          }}
                        >
                          {t("رسائل أقدم", "Older messages")}
                        </button>
                      )}
                      {messages.map((m: any) => (
                        <div
                          className={
                            "message " + (m.direction === "out" ? "out" : "in")
                          }
                          key={m.id}
                        >
                          <p>{m.body}</p>
                          <small>
                            {new Date(m.createdAt).toLocaleTimeString(
                              ar ? "ar" : "en",
                              { hour: "2-digit", minute: "2-digit" },
                            )}{" "}
                            · {m.status}
                            {m.kind === "public" ? " · Public" : ""}
                          </small>
                          {m.status === "draft" && (
                            <button
                              className="text-button"
                              onClick={() => setReply(m.body)}
                            >
                              {t("استخدام المسودة", "Use draft")}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <form
                      className="composer"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          await act("message.send", {
                            leadId: selectedLead.id,
                            text: reply,
                            requestId: crypto.randomUUID(),
                          });
                          setReply("");
                          await loadMessages(selectedLead.id);
                        } catch {}
                      }}
                    >
                      <textarea
                        required
                        maxLength={1000}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder={t("اكتب ردًا…", "Write a reply…")}
                      />
                      <div className="row-between">
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy || !data.configured.ai}
                          onClick={async () => {
                            try {
                              const b = await act("ai.draft", {
                                leadId: selectedLead.id,
                              });
                              setReply(b.text);
                            } catch {}
                          }}
                        >
                          <Sparkles size={16} />
                          {t("مسودة AI", "AI draft")}
                        </button>
                        <button
                          className="button primary"
                          disabled={busy || !reply.trim()}
                        >
                          <Send size={16} />
                          {t("إرسال", "Send")}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  empty(
                    MessageSquare,
                    t("مساحة لمحادثة أفضل", "Room for a better conversation"),
                    t(
                      "اختر محادثة لقراءة الرسائل والرد عليها.",
                      "Select a conversation to read and reply.",
                    ),
                  )
                )}
              </div>
            </section>
          )}
          {view === "leads" && (
            <section className="panel">
              <div className="filter-bar">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(0);
                    }}
                    placeholder={t(
                      "اسم، مستخدم أو وسم…",
                      "Name, username or tag…",
                    )}
                  />
                </div>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">{t("كل الحالات", "All statuses")}</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <span className="muted">
                  {data.stats.leads} {t("عميل", "contacts")}
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("العميل", "Contact")}</th>
                      <th>{t("الحالة", "Status")}</th>
                      <th>{t("الوسوم", "Tags")}</th>
                      <th>{t("التعليق / المصدر", "Comment / source")}</th>
                      <th>{t("آخر تفاعل", "Last seen")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.leads.map((l: any) => (
                      <tr key={l.id}>
                        <td>
                          <strong>
                            {l.name || l.username || l.instagramId}
                          </strong>
                          <small>@{l.username || "—"}</small>
                        </td>
                        <td>
                          <select
                            value={l.status}
                            onChange={(e) =>
                              run("lead.update", {
                                ...l,
                                status: e.target.value,
                              })
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            aria-label="Tags"
                            className="tag-input"
                            defaultValue={l.tags.join(", ")}
                            onBlur={(e) => {
                              const tags = e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              if (
                                JSON.stringify(tags) !== JSON.stringify(l.tags)
                              )
                                run("lead.update", { ...l, tags });
                            }}
                          />
                        </td>
                        <td>
                          <span className="truncate">
                            {l.comments[0]?.text || "—"}
                          </span>
                          <small>{l.comments[0]?.mediaId || ""}</small>
                        </td>
                        <td>
                          {new Date(l.lastInteraction).toLocaleDateString(
                            ar ? "ar" : "en",
                          )}
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label="Open conversation"
                            onClick={() => {
                              navigate("inbox");
                              loadMessages(l.id);
                            }}
                          >
                            <MessageSquare size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.leads.length &&
                empty(
                  Users,
                  t("عملاؤك سيظهرون هنا", "Your contacts will appear here"),
                  t(
                    "تُنشأ بطاقة العميل تلقائيًا من التعليقات والرسائل.",
                    "Contact records are created from incoming comments and messages.",
                  ),
                )}
              <div className="pagination">
                <button
                  className="button"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  {t("السابق", "Previous")}
                </button>
                <span>{page + 1}</span>
                <button
                  className="button"
                  disabled={data.leads.length < 50}
                  onClick={() => setPage(page + 1)}
                >
                  {t("التالي", "Next")}
                </button>
              </div>
            </section>
          )}
          {view === "analytics" && (
            <>
              <section className="panel">
                <div className="panel-title">
                  <h3>{t("أفضل مصادر التفاعل", "Top engagement sources")}</h3>
                </div>
                <div className="template-grid">
                  {[...data.triggers].slice(0, 3).map((r: any, i: number) => (
                    <div className="stat-card" key={i}>
                      <span>
                        {r.triggerKeyword || t("كل التعليقات", "Any comment")}
                      </span>
                      <strong>{r._count}</strong>
                      <small>Post / Reel: {r.mediaId}</small>
                    </div>
                  ))}
                </div>
                <p className="hint">
                  {t(
                    "مرتبة حسب التعليقات المطابقة لكل منشور وكلمة تشغيل.",
                    "Ranked by matched comments for each post and trigger keyword.",
                  )}
                </p>
              </section>
              <div className="stats-grid">
                {[
                  [t("العملاء", "Contacts"), data.stats.leads],
                  [t("العملاء المشترون", "Customers"), data.stats.customers],
                  [
                    t("معدل التحويل", "Conversion"),
                    data.stats.conversion + "%",
                  ],
                  [
                    t("نقرات الروابط", "Link clicks"),
                    data.links.reduce((n: number, l: any) => n + l.clicks, 0),
                  ],
                ].map(([label, value], i) => (
                  <div className="stat-card" key={i}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>
                      {t("إجمالي مساحة العمل", "Workspace lifetime total")}
                    </small>
                  </div>
                ))}
              </div>
              <section className="panel">
                <div className="panel-title">
                  <h3>{t("الرسائل والردود", "Messages & replies")}</h3>
                  <span className="pill">30 {t("يومًا", "days")}</span>
                </div>
                {chartElement}
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h3>
                    {t(
                      "أداء الحملات واختبار A/B",
                      "Campaign performance & A/B testing",
                    )}
                  </h3>
                </div>
                <p className="hint">
                  {t(
                    "التحويل = العملاء بحالة Customer ÷ جميع العملاء. النقرات إجمالية وقد تشمل زيارات آلية.",
                    "Conversion = contacts marked Customer ÷ all contacts. Clicks are total visits and may include bots.",
                  )}
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("الأتمتة", "Automation")}</th>
                        <th>Post / Reel</th>
                        <th>{t("الكلمات", "Triggers")}</th>
                        <th>{t("التعليقات", "Comments")}</th>
                        <th>A · {t("إرسال", "Sent")}</th>
                        <th>B · {t("إرسال", "Sent")}</th>
                        <th>A · {t("ردود", "Replies")}</th>
                        <th>B · {t("ردود", "Replies")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.automations]
                        .sort(
                          (a: any, b: any) =>
                            b._count.comments - a._count.comments,
                        )
                        .map((a: any) => (
                          <tr key={a.id}>
                            <td>{a.name}</td>
                            <td>{a.mediaId}</td>
                            <td>{a.keywords.join(", ") || "Any"}</td>
                            <td>{a._count.comments}</td>
                            <td>
                              {data.performance
                                .filter(
                                  (p: any) =>
                                    p.automationId === a.id &&
                                    p.variant === "A" &&
                                    p.direction === "out",
                                )
                                .reduce((n: number, p: any) => n + p._count, 0)}
                            </td>
                            <td>
                              {data.performance
                                .filter(
                                  (p: any) =>
                                    p.automationId === a.id &&
                                    p.variant === "B" &&
                                    p.direction === "out",
                                )
                                .reduce((n: number, p: any) => n + p._count, 0)}
                            </td>
                            <td>
                              {data.performance
                                .filter(
                                  (p: any) =>
                                    p.automationId === a.id &&
                                    p.variant === "A" &&
                                    p.direction === "in",
                                )
                                .reduce((n: number, p: any) => n + p._count, 0)}
                            </td>
                            <td>
                              {data.performance
                                .filter(
                                  (p: any) =>
                                    p.automationId === a.id &&
                                    p.variant === "B" &&
                                    p.direction === "in",
                                )
                                .reduce((n: number, p: any) => n + p._count, 0)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {view === "knowledge" && (
            <div className="knowledge-grid">
              {data.knowledge.map((k: any) => (
                <article className="panel knowledge-card" key={k.id}>
                  <div className="row-between">
                    <span className="tag">{k.category}</span>
                    <button
                      className="icon-button"
                      aria-label="Delete knowledge"
                      onClick={() => {
                        if (
                          confirm(t("حذف هذا المحتوى؟", "Delete this entry?"))
                        )
                          run("knowledge.delete", { id: k.id });
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <BookOpen className="knowledge-icon" size={26} />
                  <h3>{k.title}</h3>
                  <p>{k.content}</p>
                  <button
                    className="text-button"
                    onClick={() => setKnowledgeEdit(k)}
                  >
                    {t("تعديل المحتوى", "Edit content")}
                    <ArrowUpRight size={15} />
                  </button>
                </article>
              ))}
              {!data.knowledge.length && (
                <section className="panel full-span">
                  {empty(
                    BookOpen,
                    t(
                      "أعطِ مساعدك المعرفة الصحيحة",
                      "Give your assistant the right knowledge",
                    ),
                    t(
                      "أضف معلومات النشاط، المنتجات، الأسعار، الشحن والأسئلة الشائعة.",
                      "Add business details, products, pricing, shipping and FAQs.",
                    ),
                  )}
                </section>
              )}
            </div>
          )}
          {view === "links" && (
            <section className="panel">
              <div className="panel-title">
                <h3>{t("روابط قابلة للقياس", "Links you can measure")}</h3>
              </div>
              <form
                className="inline-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  try {
                    await act(
                      "link.create",
                      Object.fromEntries(new FormData(f)),
                    );
                    f.reset();
                  } catch {}
                }}
              >
                <input
                  name="label"
                  required
                  placeholder={t("اسم الرابط", "Link name")}
                />
                <input
                  name="destination"
                  required
                  type="url"
                  placeholder="https://your-store.com/product"
                  dir="ltr"
                />
                <button className="button primary" disabled={busy}>
                  <Plus size={16} />
                  {t("إنشاء", "Create")}
                </button>
              </form>
              {data.links.map((l: any) => (
                <div className="link-row" key={l.id}>
                  <Link2 size={19} />
                  <div>
                    <strong>{l.label}</strong>
                    <small dir="ltr">
                      {typeof location !== "undefined" ? location.origin : ""}
                      /r/{l.id}
                    </small>
                  </div>
                  <span className="pill">
                    {l.clicks} {t("نقرة", "clicks")}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Copy link"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(location.origin + "/r/" + l.id)
                        .then(() => setToast(t("تم النسخ", "Copied")))
                    }
                  >
                    <Copy size={17} />
                  </button>
                </div>
              ))}
            </section>
          )}
          {view === "connection" && (
            <>
              <section className="panel connection-panel">
                <div className="instagram-mark">
                  <Instagram size={31} />
                </div>
                <h2>
                  {t(
                    "Instagram، متصل بمساحة عملك.",
                    "Instagram, meet your workspace.",
                  )}
                </h2>
                <p className="muted">
                  {t(
                    "اربط حساب Business أو Creator عبر نافذة Instagram الرسمية.",
                    "Connect a Business or Creator account through official Instagram authorization.",
                  )}
                </p>
                <button
                  className="button primary"
                  onClick={connect}
                  disabled={busy}
                >
                  <Instagram size={18} />
                  {t("ربط حساب Instagram", "Connect Instagram")}
                </button>
                {!data.configured.meta && (
                  <div className="alert">
                    {t(
                      "الربط غير مفعّل بعد. يلزم ضبط مفاتيح تطبيق Meta على الخادم.",
                      "Connection is not configured yet. Add Meta app credentials on the server.",
                    )}
                  </div>
                )}
                {typeof location !== "undefined" &&
                  new URLSearchParams(location.search).has("error") && (
                    <div className="alert error">
                      {t(
                        "لم يكتمل الربط. تحقق من إعدادات OAuth والصلاحيات وحاول مجددًا.",
                        "Connection failed. Check OAuth settings and permissions, then retry.",
                      )}
                    </div>
                  )}
                <div className="security-note">
                  <ShieldCheck size={18} />
                  {t(
                    "لا كلمات مرور Instagram. الرموز مشفّرة على الخادم.",
                    "No Instagram passwords. Tokens are encrypted on the server.",
                  )}
                </div>
              </section>
              {data.accounts.map((a: any) => (
                <section className="panel account-row" key={a.id}>
                  <span className="avatar violet">
                    <Instagram size={22} />
                  </span>
                  <div>
                    <h3>@{a.username}</h3>
                    <small>
                      {t("صلاحية الرمز حتى", "Token valid until")}{" "}
                      {new Date(a.tokenExpiresAt).toLocaleDateString()}
                    </small>
                  </div>
                  <span className={"badge " + (a.connected ? "green" : "")}>
                    {a.connected
                      ? t("متصل", "Connected")
                      : t("غير متصل", "Disconnected")}
                  </span>
                  <button
                    className="button"
                    onClick={() => run("media.sync", { id: a.id })}
                    disabled={busy || !a.connected}
                  >
                    <RefreshCw size={15} />
                    {t("مزامنة المنشورات", "Sync media")}
                  </button>
                  <button
                    className="text-button danger"
                    onClick={() => {
                      if (
                        confirm(
                          t(
                            "فصل الحساب وإيقاف أتمتته؟",
                            "Disconnect and pause its automations?",
                          ),
                        )
                      )
                        run("account.disconnect", { id: a.id });
                    }}
                  >
                    {t("فصل", "Disconnect")}
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label="Delete account data"
                    onClick={() => {
                      if (
                        confirm(
                          t(
                            "حذف الحساب وجميع بيانات عملائه نهائيًا؟",
                            "Permanently delete this account and its customer data?",
                          ),
                        )
                      )
                        run("account.delete", { id: a.id });
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </section>
              ))}
              <section className="panel">
                <div className="panel-title">
                  <h3>{t("المنشورات وReels", "Posts & Reels")}</h3>
                  <span className="pill">{data.media.length}</span>
                </div>
                <div className="media-grid">
                  {data.media.map((m: any) => (
                    <article key={m.id} className="media-card">
                      {m.mediaUrl ? (
                        <img src={m.mediaUrl} alt="" loading="lazy" />
                      ) : (
                        <Instagram size={30} />
                      )}
                      <div>
                        <span className="tag">{m.mediaType}</span>
                        <p>{m.caption || m.id}</p>
                        {m.permalink && (
                          <a
                            href={m.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-button"
                          >
                            Instagram
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {!data.media.length && (
                  <p className="empty-small">
                    {t(
                      "تظهر منشوراتك بعد الربط والمزامنة.",
                      "Your posts appear after connection and sync.",
                    )}
                  </p>
                )}
              </section>
            </>
          )}
          {(view === "settings" || view === "ai") && (
            <section className="panel settings-panel">
              <div className="panel-title">
                <h3>
                  {view === "ai"
                    ? t(
                        "مساعد يعرف نشاطك",
                        "An assistant that knows your business",
                      )
                    : t("تفضيلات مساحة العمل", "Workspace preferences")}
                </h3>
              </div>
              <form
                key={view}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const old = data.workspace;
                  const ai = view === "ai";
                  const b = {
                    name: ai ? old.name : String(f.get("name")),
                    locale: ai ? old.locale : String(f.get("locale")),
                    timezone: ai ? old.timezone : String(f.get("timezone")),
                    aiEnabled: ai ? f.get("aiEnabled") === "on" : old.aiEnabled,
                    aiMode: ai ? String(f.get("aiMode")) : old.aiMode,
                    aiInstructions: ai
                      ? String(f.get("aiInstructions"))
                      : old.aiInstructions,
                    businessHours: ai
                      ? {
                          enabled: false,
                          start: 9,
                          end: 18,
                          days: [0, 1, 2, 3, 4, 5, 6],
                          ...old.businessHours,
                        }
                      : {
                          enabled: f.get("hoursEnabled") === "on",
                          start: Number(f.get("start")),
                          end: Number(f.get("end")),
                          days: f.getAll("days").map(Number),
                        },
                  };
                  try {
                    await act("settings.save", b);
                    setAr(b.locale === "ar");
                  } catch {}
                }}
              >
                {view === "settings" ? (
                  <>
                    <div className="form-grid">
                      <label>
                        {t("اسم مساحة العمل", "Workspace name")}
                        <input
                          name="name"
                          defaultValue={data.workspace.name}
                          required
                        />
                      </label>
                      <label>
                        {t("اللغة", "Language")}
                        <select
                          name="locale"
                          defaultValue={data.workspace.locale}
                        >
                          <option value="ar">العربية</option>
                          <option value="en">English</option>
                        </select>
                      </label>
                      <label>
                        {t("المنطقة الزمنية", "Timezone")}
                        <input
                          name="timezone"
                          defaultValue={data.workspace.timezone}
                        />
                      </label>
                    </div>
                    <div className="section-divider" />
                    <h3>{t("ساعات العمل", "Business hours")}</h3>
                    <label className="check-label">
                      <input
                        name="hoursEnabled"
                        type="checkbox"
                        defaultChecked={data.workspace.businessHours.enabled}
                      />
                      {t(
                        "حصر الإرسال الآلي بساعات العمل",
                        "Send automated messages during business hours",
                      )}
                    </label>
                    <div className="form-grid">
                      <label>
                        {t("من الساعة", "Start hour")}
                        <input
                          type="number"
                          name="start"
                          min="0"
                          max="23"
                          defaultValue={data.workspace.businessHours.start ?? 9}
                        />
                      </label>
                      <label>
                        {t("إلى الساعة", "End hour")}
                        <input
                          type="number"
                          name="end"
                          min="0"
                          max="24"
                          defaultValue={data.workspace.businessHours.end ?? 18}
                        />
                      </label>
                    </div>
                    <div className="days">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (d, i) => (
                          <label className="check-label" key={d}>
                            <input
                              type="checkbox"
                              name="days"
                              value={i}
                              defaultChecked={(
                                data.workspace.businessHours.days || [
                                  0, 1, 2, 3, 4, 5, 6,
                                ]
                              ).includes(i)}
                            />
                            {d}
                          </label>
                        ),
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={
                        "alert " + (data.configured.ai ? "success" : "")
                      }
                    >
                      {data.configured.ai
                        ? t(
                            "مزود الذكاء الاصطناعي مضبوط على الخادم.",
                            "AI provider is configured on the server.",
                          )
                        : t(
                            "أضف AI_API_KEY وAI_MODEL على الخادم لتفعيل الردود.",
                            "Set AI_API_KEY and AI_MODEL on the server to enable replies.",
                          )}
                    </div>
                    <label className="check-label">
                      <input
                        name="aiEnabled"
                        type="checkbox"
                        defaultChecked={data.workspace.aiEnabled}
                      />
                      {t("تفعيل مساعد الذكاء الاصطناعي", "Enable AI assistant")}
                    </label>
                    <label>
                      {t("أسلوب الرد", "Reply mode")}
                      <select
                        name="aiMode"
                        defaultValue={data.workspace.aiMode}
                      >
                        <option value="draft">
                          {t("مسودات للمراجعة", "Drafts for review")}
                        </option>
                        <option value="auto">
                          {t("إرسال تلقائي", "Send automatically")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {t("تعليمات المساعد", "Assistant instructions")}
                      <textarea
                        name="aiInstructions"
                        rows={6}
                        defaultValue={data.workspace.aiInstructions}
                        placeholder={t(
                          "أسلوب الحديث، حدود الرد، متى يُحوّل لموظف…",
                          "Tone, response boundaries, when to hand over…",
                        )}
                      />
                    </label>
                    <p className="hint">
                      {t(
                        "يستخدم المساعد قاعدة المعرفة، ويعمل فقط بعد رسالة العميل وضمن نافذة الرد. يمكن إيقافه لكل محادثة.",
                        "Uses your knowledge base, only after a customer message and inside the reply window. Pause it per conversation.",
                      )}
                    </p>
                  </>
                )}
                <button className="button primary" disabled={busy}>
                  <Check size={17} />
                  {t("حفظ الإعدادات", "Save settings")}
                </button>
              </form>
              {view === "settings" && (
                <>
                  <div className="section-divider" />
                  <div className="row-between">
                    <div>
                      <strong>{data.user.email}</strong>
                      <small>
                        {t(
                          "مالك مساحة العمل. إدارة الفريق والصلاحيات في إصدار لاحق.",
                          "Workspace owner. Team invitations and roles are reserved for a future release.",
                        )}
                      </small>
                    </div>
                    <button
                      className="button"
                      onClick={async () => {
                        await fetch("/api/auth/logout", { method: "POST" });
                        setData(null);
                        setAuth(true);
                      }}
                    >
                      <LogOut size={16} />
                      {t("خروج", "Sign out")}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          {(view === "logs" || view === "webhooks") && (
            <section className="panel">
              <div className="panel-title">
                <h3>
                  {view === "logs"
                    ? t("النشاط وسجل التدقيق", "Activity & audit trail")
                    : t("أحداث Instagram", "Instagram events")}
                </h3>
                <span className="pill">{t("آخر 100 سجل", "Latest 100")}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("الوقت", "Time")}</th>
                      <th>
                        {view === "logs"
                          ? t("النوع", "Type")
                          : t("الحالة", "Status")}
                      </th>
                      <th>{t("الحدث", "Event")}</th>
                      <th>{t("التفاصيل", "Details")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(view === "logs" ? data.logs : data.webhooks).map(
                      (l: any) => (
                        <tr key={l.id}>
                          <td>
                            {new Date(l.createdAt).toLocaleString(
                              ar ? "ar" : "en",
                            )}
                          </td>
                          <td>
                            <span className="tag">{l.type || l.status}</span>
                          </td>
                          <td>
                            <code>{l.action || l.id.slice(0, 20)}</code>
                          </td>
                          <td>
                            {l.detail || l.error || "—"}
                            {view === "webhooks" && l.status === "failed" && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  run("webhook.retry", { id: l.id })
                                }
                              >
                                {t("إعادة المعالجة", "Retry")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
              {!(view === "logs" ? data.logs : data.webhooks).length &&
                empty(
                  Activity,
                  t("لا توجد أحداث بعد", "No events yet"),
                  t(
                    "تظهر العمليات الحقيقية هنا عند حدوثها.",
                    "Real events will appear here as they happen.",
                  ),
                )}
            </section>
          )}
          <footer className="workspace-footer">
            <span>DMFlow</span>
            <span>
              {t(
                "صُمّم للمحادثات التي تستحق وقتك.",
                "Built for conversations that matter.",
              )}
            </span>
            <a href="/privacy">{t("الخصوصية", "Privacy")}</a>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {editor && (
        <div className="modal-backdrop">
          <section className="modal wide">
            <div className="modal-header">
              <div>
                <div className="eyebrow">FLOW STUDIO</div>
                <h2>
                  {editor.id
                    ? t("تعديل الأتمتة", "Edit automation")
                    : t("أنشئ تدفقك", "Build your flow")}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close"
                onClick={() => setEditor(null)}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await act("automation.save", editor);
                  setEditor(null);
                } catch {}
              }}
            >
              <div className="editor-grid">
                <div className="editor-fields">
                  <label>
                    {t("اسم الأتمتة", "Automation name")}
                    <input
                      value={editor.name}
                      onChange={(e) =>
                        setEditor({ ...editor, name: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Instagram
                    <select
                      value={editor.accountId}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          accountId: e.target.value,
                          mediaId: "",
                        })
                      }
                      required
                    >
                      <option value="">
                        {t("اختر حسابًا", "Select account")}
                      </option>
                      {data.accounts
                        .filter((a: any) => a.connected)
                        .map((a: any) => (
                          <option value={a.id} key={a.id}>
                            @{a.username}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Post / Reel
                    <select
                      value={editor.mediaId}
                      onChange={(e) =>
                        setEditor({ ...editor, mediaId: e.target.value })
                      }
                      required
                    >
                      <option value="">
                        {t("اختر المنشور", "Select post")}
                      </option>
                      {data.media
                        .filter((m: any) => m.accountId === editor.accountId)
                        .map((m: any) => (
                          <option value={m.id} key={m.id}>
                            {m.caption.slice(0, 60) || m.id}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("يبدأ عندما", "Start when")}
                    <select
                      value={editor.trigger}
                      onChange={(e) =>
                        setEditor({ ...editor, trigger: e.target.value })
                      }
                    >
                      <option value="keywords">
                        {t("تعليق يحتوي كلمة", "Comment contains keyword")}
                      </option>
                      <option value="any">
                        {t("أي تعليق", "Any comment")}
                      </option>
                    </select>
                  </label>
                  {editor.trigger === "keywords" && (
                    <label>
                      {t("الكلمات، مفصولة بفاصلة", "Keywords, comma-separated")}
                      <input
                        value={editor.keywords.join(",")}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            keywords: e.target.value.split(/[,،]/),
                          })
                        }
                      />
                    </label>
                  )}
                  <label>
                    {t("الرسالة الخاصة — A", "Private reply — A")}
                    <textarea
                      value={editor.messageA}
                      onChange={(e) =>
                        setEditor({ ...editor, messageA: e.target.value })
                      }
                      maxLength={1000}
                      required
                      rows={4}
                    />
                  </label>
                  <label>
                    {t(
                      "نسخة B اختيارية لاختبار A/B",
                      "Optional B variant for A/B testing",
                    )}
                    <textarea
                      value={editor.messageB}
                      onChange={(e) =>
                        setEditor({ ...editor, messageB: e.target.value })
                      }
                      maxLength={1000}
                    />
                  </label>
                  <label>
                    {t("رد عام اختياري", "Optional public reply")}
                    <input
                      value={editor.publicReply}
                      onChange={(e) =>
                        setEditor({ ...editor, publicReply: e.target.value })
                      }
                      placeholder={t("تم، شوف الخاص", "Sent! Check your DMs")}
                    />
                  </label>
                  <label>
                    {t(
                      "فاصل الإرسال لنفس العميل، بالساعات",
                      "Contact cooldown, hours",
                    )}
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={editor.cooldownHours}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          cooldownHours: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <div className="form-grid">
                    {["startsAt", "endsAt"].map((k) => (
                      <label key={k}>
                        {k === "startsAt"
                          ? t("البداية", "Starts")
                          : t("النهاية", "Ends")}
                        <input
                          type="datetime-local"
                          value={
                            editor[k]
                              ? new Date(
                                  new Date(editor[k]).getTime() -
                                    new Date(editor[k]).getTimezoneOffset() *
                                      60000,
                                )
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                          onChange={(e) =>
                            setEditor({
                              ...editor,
                              [k]: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <p className="hint">
                    {t(
                      "الأوقات حسب توقيت جهازك. تُحفظ الأتمتة متوقفة أولًا.",
                      "Times use your device timezone. New automations start paused.",
                    )}
                  </p>
                </div>
                <FlowBuilder
                  ar={ar}
                  value={editor.flow}
                  onChange={(flow) => setEditor({ ...editor, flow })}
                />
              </div>
              <div className="modal-footer">
                {editor.id && (
                  <button
                    type="button"
                    className="button danger"
                    onClick={async () => {
                      if (
                        confirm(t("حذف الأتمتة؟", "Delete this automation?"))
                      ) {
                        try {
                          await act("automation.delete", { id: editor.id });
                          setEditor(null);
                        } catch {}
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    {t("حذف", "Delete")}
                  </button>
                )}
                <button
                  type="button"
                  className="button"
                  onClick={() => setEditor(null)}
                >
                  {t("إلغاء", "Cancel")}
                </button>
                <button
                  className="button primary"
                  disabled={busy || !data.accounts.length}
                >
                  <Check size={17} />
                  {t("حفظ التدفق", "Save flow")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {knowledgeEdit && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="modal-header">
              <h2>{t("مصدر معرفة", "Knowledge entry")}</h2>
              <button
                className="icon-button"
                aria-label="Close"
                onClick={() => setKnowledgeEdit(null)}
              >
                <X />
              </button>
            </div>
            <form
              className="modal-body"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await act("knowledge.save", knowledgeEdit);
                  setKnowledgeEdit(null);
                } catch {}
              }}
            >
              <label>
                {t("العنوان", "Title")}
                <input
                  required
                  value={knowledgeEdit.title}
                  onChange={(e) =>
                    setKnowledgeEdit({
                      ...knowledgeEdit,
                      title: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                {t("الفئة", "Category")}
                <select
                  value={knowledgeEdit.category}
                  onChange={(e) =>
                    setKnowledgeEdit({
                      ...knowledgeEdit,
                      category: e.target.value,
                    })
                  }
                >
                  {["business", "products", "pricing", "shipping", "faq"].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                {t("المحتوى", "Content")}
                <textarea
                  required
                  rows={10}
                  maxLength={12000}
                  value={knowledgeEdit.content}
                  onChange={(e) =>
                    setKnowledgeEdit({
                      ...knowledgeEdit,
                      content: e.target.value,
                    })
                  }
                />
              </label>
              <button className="button primary" disabled={busy}>
                {t("حفظ المعرفة", "Save knowledge")}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
