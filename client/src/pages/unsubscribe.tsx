import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function Unsubscribe() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("t") || "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [alreadyUnsubscribed, setAlreadyUnsubscribed] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No unsubscribe token provided.");
      setLoading(false);
      return;
    }
    fetch(`/api/unsubscribe/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message || "Invalid link");
        return r.json();
      })
      .then((data) => {
        setEmail(data.email);
        setAlreadyUnsubscribed(!!data.alreadyUnsubscribed);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "This unsubscribe link is invalid or expired.");
        setLoading(false);
      });
  }, [token]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/unsubscribe/${encodeURIComponent(token)}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to unsubscribe.");
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Failed to unsubscribe.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full" data-testid="card-unsubscribe">
        <CardHeader>
          <CardTitle className="text-center text-cascadia-green">
            Cascadia Oceanic Email Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {loading && (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
              <p className="text-sm text-gray-600">Looking up your subscription…</p>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center gap-2 py-4" data-testid="state-error">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm text-gray-700">{error}</p>
            </div>
          )}
          {!loading && !error && done && (
            <div className="flex flex-col items-center gap-2 py-4" data-testid="state-success">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
              <p className="text-base font-medium">You've been unsubscribed.</p>
              <p className="text-sm text-gray-600">
                {email} will no longer receive marketing emails from Cascadia Oceanic.
                Important transactional messages (account & order related) may still be sent.
              </p>
            </div>
          )}
          {!loading && !error && !done && alreadyUnsubscribed && (
            <div className="flex flex-col items-center gap-2 py-4" data-testid="state-already">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
              <p className="text-base font-medium">You're already unsubscribed.</p>
              <p className="text-sm text-gray-600">
                {email} is not currently on our mailing list.
              </p>
            </div>
          )}
          {!loading && !error && !done && !alreadyUnsubscribed && email && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-700">
                Click below to unsubscribe <strong>{email}</strong> from Cascadia Oceanic
                marketing emails.
              </p>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                className="w-full bg-cascadia-green hover:opacity-90"
                data-testid="button-confirm-unsubscribe"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing…
                  </>
                ) : (
                  "Confirm unsubscribe"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
