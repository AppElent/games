/**
 * A QR code for an invite. Always dark modules on white with a quiet zone,
 * whatever the theme: inverted codes fail on many phone cameras.
 */
import QRCode from "qrcode";
import { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";

const QUIET_ZONE = 2;
const LIGHT = "#ffffff";
const DARK = "#000000";

type Props = { value: string; size: number; accessibilityLabel: string };

export function QrCode({ value, size, accessibilityLabel }: Props) {
	const { path, count } = useMemo(() => {
		const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
		let d = "";
		for (let row = 0; row < modules.size; row++) {
			for (let col = 0; col < modules.size; col++) {
				if (modules.get(row, col)) d += `M${col} ${row}h1v1h-1z`;
			}
		}
		return { path: d, count: modules.size };
	}, [value]);
	const extent = count + QUIET_ZONE * 2;
	return (
		<Svg
			width={size}
			height={size}
			viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
			accessible
			accessibilityRole="image"
			accessibilityLabel={accessibilityLabel}
		>
			<Rect
				x={-QUIET_ZONE}
				y={-QUIET_ZONE}
				width={extent}
				height={extent}
				fill={LIGHT}
			/>
			<Path d={path} fill={DARK} />
		</Svg>
	);
}
