import { createFileRoute } from "@tanstack/react-router";
import { RequireSignedIn } from "#/components/RequireSignedIn";
import { ProfilePanel } from "#/lib/auth";
import { DeleteAccount } from "../components/account/DeleteAccount";
import { ExportData } from "../components/account/ExportData";
import { ManageAccount } from "../components/account/ManageAccount";
import { ReportProblem } from "../components/ReportProblem";

export const Route = createFileRoute("/account")({
	component: AccountPage,
});

function AccountPage() {
	return (
		<RequireSignedIn>
			<main className="club-wrap py-10">
				<ProfilePanel />
				<ManageAccount />
				<ExportData />
				<ReportProblem />
				<DeleteAccount />
			</main>
		</RequireSignedIn>
	);
}
