// Draws the DEV and PREVIEW labels onto copies of the app icon, for the
// install variants in app.config.ts. Rerun after changing icon.png or
// adaptive-icon.png:
//
//   swift apps/mobile/scripts/badge-icons.swift
//
// iOS gets a full-width band at the bottom and stays opaque. Android gets a
// pill inside the circular safe zone, since launchers mask the corners.
import AppKit

let assets = URL(fileURLWithPath: #filePath)
	.deletingLastPathComponent().deletingLastPathComponent()
	.appendingPathComponent("assets")

let variants = [("dev", "DEV", 0xFF9C4C), ("preview", "PREVIEW", 0x7FBAFF)]

func color(_ hex: Int) -> NSColor {
	NSColor(
		srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
		green: CGFloat((hex >> 8) & 0xFF) / 255,
		blue: CGFloat(hex & 0xFF) / 255,
		alpha: 1
	)
}

func badge(_ name: String, suffix: String, label: String, fill: Int, android: Bool) throws {
	let source = assets.appendingPathComponent("\(name).png")
	let src = NSBitmapImageRep(data: NSImage(contentsOf: source)!.tiffRepresentation!)!
	let size = src.pixelsWide
	let rep = NSBitmapImageRep(
		bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
		samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
		colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
	)!
	NSGraphicsContext.saveGraphicsState()
	NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
	src.draw(in: NSRect(x: 0, y: 0, width: size, height: size))

	// Boxes are on a 1024 grid measured from the top, like Foundry's icons.
	let s = CGFloat(size) / 1024
	let (box, fontSize, radius): (NSRect, CGFloat, CGFloat) =
		android
		? (NSRect(x: 382, y: 726, width: 260, height: 64), 40, 32)
		: (NSRect(x: 0, y: 832, width: 1024, height: 192), 104, 0)
	let rect = NSRect(
		x: box.minX * s, y: CGFloat(size) - box.maxY * s,
		width: box.width * s, height: box.height * s
	)
	let shape = NSBezierPath(roundedRect: rect, xRadius: radius * s, yRadius: radius * s)
	color(fill).setFill()
	shape.fill()
	if android {
		// Separates the pill from same-coloured art underneath.
		color(0x0A0F1A).setStroke()
		shape.lineWidth = 8 * s
		shape.stroke()
	}

	let font = NSFont.systemFont(ofSize: fontSize * s, weight: .bold)
	let text = NSAttributedString(
		string: label,
		attributes: [.font: font, .foregroundColor: NSColor.black, .kern: fontSize * s * 0.04]
	)
	let width = text.size().width
	// Centre the capitals, not the line box.
	let baseline = rect.midY - font.capHeight / 2
	text.draw(at: NSPoint(x: rect.midX - width / 2, y: baseline + font.descender))
	NSGraphicsContext.restoreGraphicsState()

	var image = rep
	if !android {
		// App Store icons must not carry an alpha channel.
		let ctx = CGContext(
			data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
			space: CGColorSpace(name: CGColorSpace.sRGB)!,
			bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
		)!
		ctx.draw(rep.cgImage!, in: CGRect(x: 0, y: 0, width: size, height: size))
		image = NSBitmapImageRep(cgImage: ctx.makeImage()!)
	}
	let out = assets.appendingPathComponent("\(name)-\(suffix).png")
	try image.representation(using: .png, properties: [:])!.write(to: out)
	print("wrote \(out.lastPathComponent)")
}

for (suffix, label, fill) in variants {
	try badge("icon", suffix: suffix, label: label, fill: fill, android: false)
	try badge("adaptive-icon", suffix: suffix, label: label, fill: fill, android: true)
}
