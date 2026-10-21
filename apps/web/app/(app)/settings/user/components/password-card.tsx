"use client";

import { useState } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { useUserSettingsContext } from "@/app/(app)/settings/user/context";
import UiSwitch from "@/components/shared/ui-switch";
import { authClient } from "@/lib/auth/client";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { Button, Input, Label, TextField } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export default function PasswordCard() {
  const t = useTranslations("settings.user.password");
  const { user } = useUserSettingsContext();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const accounts = useQuery({
    queryKey: ["auth", "accounts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const result = await authClient.listAccounts();

      if (result.error) throw new Error("Unable to load account providers");

      return result.data;
    },
  });

  if (accounts.isPending) return null;
  if (accounts.isError) {
    return (
      <SettingsCard icon={LockClosedIcon} title={t("title")}>
        <p role="alert">{t("loadError")}</p>
        <Button onPress={() => void accounts.refetch()}>{t("retry")}</Button>
      </SettingsCard>
    );
  }
  if (!accounts.data?.some((account) => account.providerId === "credential")) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSuccess(false);
    setMessage(null);
    if (newPassword !== confirmation) {
      setMessage(t("mismatch"));

      return;
    }
    setSaving(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });

      if (result.error) {
        setMessage(t(result.error.code === "INVALID_PASSWORD" ? "incorrectPassword" : "error"));

        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSuccess(true);
      setMessage(t("success"));
    } catch {
      setMessage(t("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard icon={LockClosedIcon} title={t("title")}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <TextField
          isRequired
          isDisabled={saving}
          value={currentPassword}
          onChange={setCurrentPassword}
        >
          <Label>{t("current")}</Label>
          <Input
            autoComplete="current-password"
            name="currentPassword"
            type="password"
            variant="secondary"
          />
        </TextField>
        <TextField isRequired isDisabled={saving} value={newPassword} onChange={setNewPassword}>
          <Label>{t("new")}</Label>
          <Input
            autoComplete="new-password"
            maxLength={128}
            minLength={8}
            name="newPassword"
            type="password"
            variant="secondary"
          />
        </TextField>
        <TextField isRequired isDisabled={saving} value={confirmation} onChange={setConfirmation}>
          <Label>{t("confirm")}</Label>
          <Input
            autoComplete="new-password"
            maxLength={128}
            minLength={8}
            name="confirmPassword"
            type="password"
            variant="secondary"
          />
        </TextField>
        <p className="text-muted text-sm">{t("length")}</p>
        <UiSwitch
          isDisabled={saving}
          isSelected={revokeOtherSessions}
          onValueChange={setRevokeOtherSessions}
        >
          <Label>{t("revoke")}</Label>
        </UiSwitch>
        <p className="text-muted text-sm">{t("revokeHint")}</p>
        {message && <p role={success ? "status" : "alert"}>{message}</p>}
        <div className="flex justify-end">
          <Button isDisabled={saving} isPending={saving} type="submit" variant="primary">
            {t("title")}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}
