"use client";
import { useState } from "react";
import { MessageSquare, Send, Check, X } from "lucide-react";
import { matches } from "@/lib/rules";

type Props = {
  ar: boolean;
  username: string;
  trigger: string;
  keywords: string[];
  messageA: string;
  messageB: string;
  publicReply: string;
};
export default function AutomationPreview(props: Props) {
  const [comment, setComment] = useState("");
  const [variant, setVariant] = useState<"A" | "B">("A");
  const t = (a: string, b: string) => (props.ar ? a : b);
  const matched =
    comment.trim().length > 0 &&
    matches(comment, props.trigger, props.keywords);
  const message =
    variant === "B" && props.messageB.trim() ? props.messageB : props.messageA;
  return (
    <section
      className="automation-preview"
      aria-label={t("معاينة الرد", "Reply preview")}
    >
      <div className="row-between">
        <h3>
          <MessageSquare size={16} /> {t("معاينة الرد", "Reply preview")}
        </h3>
        <span className="pill">{t("محاكاة", "Simulation")}</span>
      </div>
      <p className="hint">
        {t(
          "جرّب التعليق وشوف الرسالة قبل الحفظ. التجربة ما بتبعت أي رسالة.",
          "Try a comment and review the reply before saving. This simulation sends no messages.",
        )}
      </p>
      <label>
        {t("تعليق للتجربة", "Test comment")}
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("مثلاً: دعاء", "For example: link")}
          maxLength={1000}
        />
      </label>
      {comment.trim() && (
        <p
          className={"trigger-result " + (matched ? "matched" : "unmatched")}
          role="status"
        >
          {matched ? <Check size={16} /> : <X size={16} />}
          {matched
            ? t(
                "التعليق بيطابق شرط الكلمات",
                "Comment matches the keyword trigger",
              )
            : t(
                "التعليق ما بيطابق شرط الكلمات",
                "Comment does not match the keyword trigger",
              )}
        </p>
      )}
      <div className="preview-thread">
        <div className="preview-account">
          <span className="avatar violet">
            <Send size={16} />
          </span>
          <b dir="ltr">@{props.username || "instagram"}</b>
        </div>
        {props.messageB.trim() && (
          <div
            className="preview-variants"
            role="group"
            aria-label={t("نسخة الرسالة", "Message variant")}
          >
            {(["A", "B"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={variant === v}
                onClick={() => setVariant(v)}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        <div className="preview-bubble" dir="auto">
          {message.trim() ||
            t(
              "رسالتك الخاصة رح تظهر هون…",
              "Your private reply will appear here…",
            )}
        </div>
        <small className="muted">{message.length}/1000</small>
        {props.publicReply.trim() && (
          <div className="preview-public">
            <small>{t("الرد تحت التعليق", "Reply below the comment")}</small>
            <p dir="auto">{props.publicReply}</p>
          </div>
        )}
      </div>
      <p className="hint">
        {t(
          "المطابقة هون للكلمات فقط. الإرسال الفعلي بيعتمد كمان على اتصال الحساب، تفعيل الأتمتة، التوقيت ومنع التكرار.",
          "This checks keyword matching only. Actual delivery also depends on the account connection, active automation, schedule and cooldown.",
        )}
      </p>
    </section>
  );
}
