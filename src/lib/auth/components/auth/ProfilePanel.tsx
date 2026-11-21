import {
	type PasswordFailure,
	passwordFailure,
	passwordUpdate,
} from "@arcadeclub/core/account-password";
import { useClerk, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { AppearanceSettings } from "#/lib/auth/components/account/AppearanceSettings";
import { useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { clerkErrorMessage } from "./types";
import { UsernameHint } from "./UsernameHint";

export function ProfilePanel() {
	const messages = useMessages();
	const copy = messages.profile.password;
	const { isLoaded, user } = useUser();
	const { signOut } = useClerk();
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [fieldError, setFieldError] = useState<PasswordFailure | null>(null);
	const [passwordChanged, setPasswordChanged] = useState(false);
	const [savingProfile, setSavingProfile] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);

	useEffect(() => {
		if (user) {
			setFirstName(user.firstName ?? "");
			setLastName(user.lastName ?? "");
		}
	}, [user]);

	if (!isLoaded || !user) {
		return <p className="text-sm text-[var(--auth-muted)]">Loading…</p>;
	}

	async function saveProfile(e: React.FormEvent) {
		e.preventDefault();
		if (!user) {
			return;
		}
		setError(null);
		setSavingProfile(true);
		try {
			await user.update({ firstName, lastName });
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setSavingProfile(false);
		}
	}

	async function changePassword(e: React.FormEvent) {
		e.preventDefault();
		if (!user) {
			return;
		}
		setError(null);
		setFieldError(null);
		setPasswordChanged(false);
		setSavingPassword(true);
		try {
			await user.updatePassword(passwordUpdate(currentPassword, newPassword));
			setCurrentPassword("");
			setNewPassword("");
			setPasswordChanged(true);
		} catch (err) {
			const failure = passwordFailure(err);
			if (failure) {
				setFieldError(failure);
			} else {
				setError(clerkErrorMessage(err));
			}
		} finally {
			setSavingPassword(false);
		}
	}

	return (
		<div className="space-y-6">
			<AuthError message={error} />

			<section className="rm-panel p-4">
				<p className="rm-label">Profile</p>
				<form
					onSubmit={saveProfile}
					className="mt-3 flex flex-col gap-3"
					noValidate
				>
					<AuthField
						label="First name"
						type="text"
						value={firstName}
						onChange={setFirstName}
					/>
					<AuthField
						label="Last name"
						type="text"
						value={lastName}
						onChange={setLastName}
					/>
					<p className="text-xs text-[var(--auth-muted)]">
						Email: {user.primaryEmailAddress?.emailAddress}
					</p>
					<AuthButton loading={savingProfile}>Save profile</AuthButton>
				</form>
			</section>

			<section className="rm-panel p-4">
				<p className="rm-label">{copy.title}</p>
				{user.passwordEnabled ? (
					<form
						onSubmit={changePassword}
						className="mt-3 flex flex-col gap-3"
						noValidate
					>
						<UsernameHint
							username={user.primaryEmailAddress?.emailAddress ?? ""}
						/>
						<AuthField
							label={copy.current}
							type="password"
							autoComplete="current-password"
							value={currentPassword}
							onChange={setCurrentPassword}
							error={
								fieldError?.field === "current"
									? messages.auth.errors[fieldError.key]
									: undefined
							}
						/>
						<AuthField
							label={copy.new}
							type="password"
							autoComplete="new-password"
							value={newPassword}
							onChange={setNewPassword}
							error={
								fieldError?.field === "new"
									? messages.auth.errors[fieldError.key]
									: undefined
							}
						/>
						<AuthButton loading={savingPassword}>{copy.submit}</AuthButton>
						{passwordChanged ? (
							<p role="status" className="text-sm text-[var(--auth-muted)]">
								{copy.changed}. {copy.changedBody}
							</p>
						) : null}
					</form>
				) : (
					// Social or emailed-code sign-in only: nothing to change.
					<p className="mt-3 text-sm text-[var(--auth-muted)]">{copy.none}</p>
				)}
			</section>

			<AppearanceSettings />

			<section className="rm-panel p-4">
				<p className="rm-label">Session</p>
				<div className="mt-3">
					<AuthButton type="button" variant="ghost" onClick={() => signOut()}>
						Sign out
					</AuthButton>
				</div>
			</section>
		</div>
	);
}
