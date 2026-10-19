import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib";

type Props = { ar: boolean; notify: (text: string) => void };
export function ForgotPassword({
  ar,
  notify,
  onBack,
}: Props & { onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  return (
    <div className="page shell narrow recovery-page">
      <h1>{t("Reset your password.", "استرجاع كلمة المرور.")}</h1>
      <p>
        {t(
          "Enter your email to request a secure reset link.",
          "أدخل بريدك لطلب رابط آمن لاسترجاع كلمة المرور.",
        )}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!supabase) {
            notify(
              t(
                "Account recovery requires the backend connection. No email was sent.",
                "استرجاع الحساب يحتاج ربط الخدمة. لم يُرسل بريد.",
              ),
            );
            return;
          }
          const email = String(
            new FormData(e.currentTarget).get("email"),
          ).trim();
          setBusy(true);
          try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: new URL("/reset-password", window.location.origin)
                .href,
            });
            if (error) throw error;
            notify(
              t(
                "If an account exists, a reset link will be sent. Check your inbox and spam folder.",
                "إذا كان الحساب موجوداً فسيُرسل رابط الاسترجاع. راجع البريد والرسائل غير المرغوبة.",
              ),
            );
          } catch (error) {
            notify((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t("Email address", "البريد الإلكتروني")}
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <button className="btn gold" disabled={busy}>
          {busy ? "…" : t("Send reset link", "إرسال رابط الاسترجاع")}
        </button>
      </form>
      <button className="text-link" onClick={onBack}>
        {t("Back to sign in", "العودة لتسجيل الدخول")}
      </button>
    </div>
  );
}
export function ResetPassword({
  ar,
  notify,
  authenticated,
  authReady,
}: Props & { authenticated: boolean; authReady: boolean }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  if (!authReady)
    return (
      <div className="page shell narrow">
        {t("Checking reset link…", "جارٍ التحقق من رابط الاسترجاع…")}
      </div>
    );
  return (
    <div className="page shell narrow recovery-page">
      <h1>{t("Choose a new password.", "اختر كلمة مرور جديدة.")}</h1>
      {!authenticated || !supabase ? (
        <>
          <p>
            {t(
              "This reset link is missing or expired. Request a new link from the sign-in page.",
              "رابط الاسترجاع غير موجود أو انتهت صلاحيته. اطلب رابطاً جديداً من صفحة الدخول.",
            )}
          </p>
          <Link className="btn gold" to="/account">
            {t("Back to sign in", "العودة لتسجيل الدخول")}
          </Link>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const password = String(form.get("password"));
            if (password !== form.get("confirm")) {
              notify(
                t("Passwords do not match.", "كلمتا المرور غير متطابقتين."),
              );
              return;
            }
            setBusy(true);
            try {
              const { error } = await supabase!.auth.updateUser({ password });
              if (error) throw error;
              await supabase!.auth.signOut();
              navigate("/account", { replace: true });
              notify(
                t(
                  "Password updated. Sign in with your new password.",
                  "تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.",
                ),
              );
            } catch (error) {
              notify((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("New password", "كلمة المرور الجديدة")}
            <input
              type="password"
              name="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            {t("Confirm password", "تأكيد كلمة المرور")}
            <input
              type="password"
              name="confirm"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="btn gold" disabled={busy}>
            {busy ? "…" : t("Update password", "تحديث كلمة المرور")}
          </button>
        </form>
      )}
    </div>
  );
}
