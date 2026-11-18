import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

/// The image work behind the sudoku scan, on the device and offline: load a
/// photo upright, find the grid, warp it to a square, and read digits with
/// Apple Vision. Which cells hold ink, and what that ink means, is decided in
/// JavaScript by `@arcadeclub/core/sudoku-scan-ink`, shared with the web.
enum SudokuScanEngine {
  /// Side of the warped grid in pixels: 9 cells of 100.
  static let warpSize = 900

  enum Failure: Error {
    case unreadableImage
    case renderFailed
    case badCorners
  }

  private static let context = CIContext()

  // MARK: Loading

  /// The photo upright (EXIF orientation applied) and no longer than
  /// `maxDimension` on its longest side.
  static func loadUpright(_ url: URL, maxDimension: CGFloat) throws -> CGImage {
    guard var image = CIImage(contentsOf: url, options: [.applyOrientationProperty: true]) else {
      throw Failure.unreadableImage
    }
    let scale = min(1, maxDimension / max(image.extent.width, image.extent.height))
    if scale < 1 {
      image = image.applyingFilter("CILanczosScaleTransform", parameters: [
        kCIInputScaleKey: scale,
        kCIInputAspectRatioKey: 1,
      ])
    }
    image = image.transformed(by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY))
    let rect = CGRect(x: 0, y: 0, width: floor(image.extent.width), height: floor(image.extent.height))
    guard let output = context.createCGImage(image, from: rect, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB()) else {
      throw Failure.renderFailed
    }
    return output
  }

  static func loadImage(_ url: URL) throws -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
      throw Failure.unreadableImage
    }
    return image
  }

  static func write(_ image: CGImage, to url: URL, type: UTType) throws {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil) else {
      throw Failure.renderFailed
    }
    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw Failure.renderFailed }
  }

  // MARK: Grid detection

  /// The grid's corners (top-left, top-right, bottom-right, bottom-left) in
  /// pixels from the top-left, or nil when no near-square quad stands out.
  /// The largest quad wins: a sudoku's 3x3 boxes are quads too. Vision misses
  /// a rectangle that touches the photo's edge, so it looks at the photo with
  /// its edges stretched outward.
  static func detectGrid(in image: CGImage) -> [CGPoint]? {
    let inset = max(image.width, image.height) / 20
    guard let padded = padded(image, margin: inset) else { return nil }
    let margin = CGFloat(inset)
    let request = VNDetectRectanglesRequest()
    request.minimumAspectRatio = 0.6
    request.maximumAspectRatio = 1
    request.minimumSize = 0.25
    request.maximumObservations = 8
    request.quadratureTolerance = 35
    request.minimumConfidence = 0.4
    do {
      try VNImageRequestHandler(cgImage: padded, options: [:]).perform([request])
    } catch {
      return nil
    }
    let width = CGFloat(padded.width)
    let height = CGFloat(padded.height)
    func pixels(_ point: CGPoint) -> CGPoint {
      CGPoint(
        x: min(max(point.x * width - margin, 0), CGFloat(image.width)),
        y: min(max((1 - point.y) * height - margin, 0), CGFloat(image.height))
      )
    }
    let quads = (request.results ?? []).map { quad in
      [pixels(quad.topLeft), pixels(quad.topRight), pixels(quad.bottomRight), pixels(quad.bottomLeft)]
    }
    return quads.max { area($0) < area($1) }
  }

  /// The photo with `margin` pixels added around it, repeating its edge
  /// pixels so the margin draws no new edge of its own.
  private static func padded(_ image: CGImage, margin: Int) -> CGImage? {
    let source = CIImage(cgImage: image)
    let inset = CGFloat(margin)
    let extended = source.clampedToExtent()
      .cropped(to: source.extent.insetBy(dx: -inset, dy: -inset))
      .transformed(by: CGAffineTransform(translationX: inset, y: inset))
    return context.createCGImage(extended, from: CGRect(
      x: 0,
      y: 0,
      width: image.width + margin * 2,
      height: image.height + margin * 2
    ))
  }

  private static func area(_ quad: [CGPoint]) -> CGFloat {
    var sum: CGFloat = 0
    for index in 0..<quad.count {
      let a = quad[index]
      let b = quad[(index + 1) % quad.count]
      sum += a.x * b.y - b.x * a.y
    }
    return abs(sum) / 2
  }

  // MARK: Warp

  /// The quad warped to a `warpSize` square, in grayscale.
  static func warp(_ image: CGImage, corners: [CGPoint]) throws -> CGImage {
    guard corners.count == 4 else { throw Failure.badCorners }
    let height = CGFloat(image.height)
    // Core Image counts y from the bottom.
    func vector(_ point: CGPoint) -> CIVector { CIVector(x: point.x, y: height - point.y) }
    let corrected = CIImage(cgImage: image).applyingFilter("CIPerspectiveCorrection", parameters: [
      "inputTopLeft": vector(corners[0]),
      "inputTopRight": vector(corners[1]),
      "inputBottomRight": vector(corners[2]),
      "inputBottomLeft": vector(corners[3]),
      "inputCrop": true,
    ])
    let extent = corrected.extent
    guard extent.width >= 1, extent.height >= 1, extent.width.isFinite, extent.height.isFinite else {
      throw Failure.badCorners
    }
    let size = CGFloat(warpSize)
    let square = corrected
      .transformed(by: CGAffineTransform(translationX: -extent.minX, y: -extent.minY))
      .transformed(by: CGAffineTransform(scaleX: size / extent.width, y: size / extent.height))
    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    guard let output = context.createCGImage(square, from: rect, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray()) else {
      throw Failure.renderFailed
    }
    return output
  }

  /// One byte per pixel, rows from the top.
  static func grayPixels(_ image: CGImage) throws -> [UInt8] {
    let width = image.width
    let height = image.height
    var pixels = [UInt8](repeating: 255, count: width * height)
    let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard let bitmap = CGContext(
        data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width,
        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
      ) else { return false }
      bitmap.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    guard drawn else { throw Failure.renderFailed }
    return pixels
  }

  // MARK: Digits

  struct Read {
    var digit = 0
    var confidence = 0.0
  }

  /// Glyph height in the images Vision reads.
  private static let glyphHeight = 40
  /// How often each glyph repeats on its line.
  private static let repeats = 4
  /// Lines per Vision request: a taller image gets downscaled and loses lines.
  private static let linesPerRequest = 9

  /// Read the digit in each box of a grayscale image.
  ///
  /// Vision reads words, not lone characters: a single digit crop mostly
  /// comes back empty. So each glyph is repeated on its own line ("5555"),
  /// contrast-stretched to black on white, and lines are stacked a few per
  /// request. A line maps back to its box by its vertical position, and the
  /// share of repeats that agree scales Vision's confidence.
  static func readDigits(_ pixels: [UInt8], width: Int, height: Int, boxes: [CGRect]) -> [Read] {
    var reads: [Read] = []
    var start = 0
    while start < boxes.count {
      let end = min(boxes.count, start + linesPerRequest)
      reads += readLines(pixels, width: width, height: height, boxes: Array(boxes[start..<end]))
      start = end
    }
    return reads
  }

  private static func readLines(_ pixels: [UInt8], width: Int, height: Int, boxes: [CGRect]) -> [Read] {
    var reads = [Read](repeating: Read(), count: boxes.count)
    let gap = glyphHeight / 3
    let lineHeight = glyphHeight * 2
    let slot = glyphHeight
    let canvasWidth = (slot + gap) * repeats + glyphHeight * 2
    let canvasHeight = lineHeight * boxes.count + glyphHeight
    var canvas = [UInt8](repeating: 255, count: canvasWidth * canvasHeight)
    let bounds = CGRect(x: 0, y: 0, width: width, height: height)

    for (line, box) in boxes.enumerated() {
      let crop = box.intersection(bounds).integral
      guard crop.width >= 1, crop.height >= 1 else { continue }
      let minX = Int(crop.minX), maxX = Int(crop.maxX), minY = Int(crop.minY), maxY = Int(crop.maxY)
      // Stretch contrast: the darkest pixel turns black, the paper white.
      var values: [UInt8] = []
      values.reserveCapacity((maxX - minX) * (maxY - minY))
      for y in minY..<maxY {
        for x in minX..<maxX { values.append(pixels[y * width + x]) }
      }
      values.sort()
      let low = Double(values[0])
      let paper = Double(values[min(values.count - 1, values.count * 85 / 100)])
      let span = max(1, paper - low)
      let scale = Double(glyphHeight) / Double(crop.height)
      let glyphWidth = min(slot, max(1, Int(Double(crop.width) * scale)))
      let top = glyphHeight / 2 + line * lineHeight + (lineHeight - glyphHeight) / 2
      for copy in 0..<repeats {
        let left = glyphHeight + copy * (slot + gap) + (slot - glyphWidth) / 2
        for y in 0..<glyphHeight {
          let sourceY = min(maxY - 1, minY + Int(Double(y) / scale))
          for x in 0..<glyphWidth {
            let sourceX = min(maxX - 1, minX + Int(Double(x) / scale))
            let value = (Double(pixels[sourceY * width + sourceX]) - low) / span * 255
            canvas[(top + y) * canvasWidth + left + x] = UInt8(max(0, min(255, value)))
          }
        }
      }
    }

    guard let provider = CGDataProvider(data: Data(canvas) as CFData),
          let image = CGImage(
            width: canvasWidth, height: canvasHeight, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: canvasWidth,
            space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGBitmapInfo(rawValue: 0), provider: provider,
            decode: nil, shouldInterpolate: true, intent: .defaultIntent
          ) else { return reads }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.minimumTextHeight = Float(glyphHeight) / Float(canvasHeight) * 0.5
    do {
      try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    } catch {
      return reads
    }
    for observation in request.results ?? [] {
      let middle = (1 - observation.boundingBox.midY) * Double(canvasHeight)
      let line = Int((middle - Double(glyphHeight / 2)) / Double(lineHeight))
      guard line >= 0, line < boxes.count else { continue }
      for candidate in observation.topCandidates(3) {
        let read = vote(candidate.string, confidence: Double(candidate.confidence))
        if read.confidence > reads[line].confidence { reads[line] = read }
      }
    }
    return reads
  }

  /// The digit most characters of a line read as, with Vision's confidence
  /// scaled by the share of repeats that agree.
  private static func vote(_ text: String, confidence: Double) -> Read {
    var counts = [Int](repeating: 0, count: 10)
    var characters = 0
    for character in text where !character.isWhitespace {
      characters += 1
      if let digit = digit(character) { counts[digit] += 1 }
    }
    guard let best = (1...9).max(by: { counts[$0] < counts[$1] }), counts[best] > 0 else { return Read() }
    return Read(digit: best, confidence: confidence * Double(counts[best]) / Double(max(characters, repeats)))
  }

  /// The digit a character stands for, reading the letters Vision mistakes
  /// for digits on their own as those digits.
  private static func digit(_ character: Character) -> Int? {
    if let value = character.wholeNumberValue, (1...9).contains(value) { return value }
    let lookalikes: [Character: Int] = [
      "l": 1, "I": 1, "|": 1, "i": 1, "!": 1, "]": 1, "[": 1,
      "Z": 2, "z": 2, "S": 5, "s": 5, "b": 6, "G": 6, "T": 7, "B": 8, "g": 9, "q": 9,
    ]
    return lookalikes[character]
  }
}
