/**
 * The second step of a sign-in, after a password, an emailed code or a
 * password reset. A verified code signs in and the `(auth)` layout closes the
 * modal. "Back to sign in" drops the attempt; leaving another way is as safe,
 * because every first step starts a new one.
 */
import { useRouter } from "expo-router";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { AuthForm } from "../components/auth-form";
import { SecondFactorStep } from "./second-factor-step";
import { useSignInSecondFactor } from "./use-second-factor";

export function SecondFactorScreen({
	afterReset = false,
}: {
	/** The password was just changed, and still needs this step to sign in. */
	afterReset?: boolean;
}) {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.auth.secondFactor;
	const { flow, state, cancel } = useSignInSecondFactor();

	return (
		<AuthForm
			title={copy.title}
			footer={
				<Button
					variant="plain"
					label={copy.backToSignIn}
					disabled={state.busy !== null}
					onPress={async () => {
						await cancel();
						router.dismissTo("/sign-in");
					}}
					testID="second-factor-back"
				/>
			}
		>
			<SecondFactorStep
				flow={flow}
				state={state}
				notice={afterReset ? copy.passwordChanged : null}
			/>
		</AuthForm>
	);
}
