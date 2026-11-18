import CoreGraphics
import ExpoModulesCore
import UniformTypeIdentifiers

struct ScanPoint: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
}

struct ScanBox: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var width: Double = 0
  @Field var height: Double = 0
}

/// JavaScript side: `modules/sudoku-scanner/index.ts`.
public class SudokuScannerModule: Module {
  /// Longest side of the photo the scan works on: enough for a grid that
  /// fills part of the frame, small enough to warp quickly.
  private static let maxDimension: CGFloat = 1600

  public func definition() -> ModuleDefinition {
    Name("SudokuScanner")

    /// The photo upright and scaled down, as a JPEG in the caches folder:
    /// corners, the warp and the screen all use this one image.
    AsyncFunction("prepareImage") { (uri: String) -> [String: Any] in
      let folder = try Self.scanFolder(reset: true)
      let image = try SudokuScanEngine.loadUpright(Self.fileURL(uri), maxDimension: Self.maxDimension)
      let output = folder.appendingPathComponent("photo-\(UUID().uuidString).jpg")
      try SudokuScanEngine.write(image, to: output, type: .jpeg)
      return ["uri": output.absoluteString, "width": image.width, "height": image.height]
    }

    AsyncFunction("detectGrid") { (uri: String) -> [[String: Double]]? in
      let image = try SudokuScanEngine.loadImage(Self.fileURL(uri))
      return SudokuScanEngine.detectGrid(in: image)?.map { ["x": Double($0.x), "y": Double($0.y)] }
    }

    /// The grid inside `corners` as a grayscale square: a PNG to show and
    /// read digits from, and its pixels for the ink analysis in JavaScript.
    AsyncFunction("warpGrid") { (uri: String, corners: [ScanPoint]) -> [String: Any] in
      let image = try SudokuScanEngine.loadImage(Self.fileURL(uri))
      let warped = try SudokuScanEngine.warp(image, corners: corners.map { CGPoint(x: $0.x, y: $0.y) })
      let output = try Self.scanFolder(reset: false).appendingPathComponent("grid-\(UUID().uuidString).png")
      try SudokuScanEngine.write(warped, to: output, type: .png)
      let pixels = try SudokuScanEngine.grayPixels(warped)
      return ["uri": output.absoluteString, "size": warped.width, "pixels": Data(pixels)]
    }

    AsyncFunction("readDigits") { (uri: String, boxes: [ScanBox]) -> [[String: Double]] in
      let image = try SudokuScanEngine.loadImage(Self.fileURL(uri))
      let pixels = try SudokuScanEngine.grayPixels(image)
      let rects = boxes.map { CGRect(x: $0.x, y: $0.y, width: $0.width, height: $0.height) }
      return SudokuScanEngine.readDigits(pixels, width: image.width, height: image.height, boxes: rects)
        .map { ["digit": Double($0.digit), "confidence": $0.confidence] }
    }
  }

  private static func fileURL(_ uri: String) -> URL {
    if let url = URL(string: uri), url.isFileURL { return url }
    return URL(fileURLWithPath: uri)
  }

  /// One scan's files at a time: a new photo clears the last scan's.
  private static func scanFolder(reset: Bool) throws -> URL {
    let caches = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let folder = caches.appendingPathComponent("sudoku-scan", isDirectory: true)
    if reset { try? FileManager.default.removeItem(at: folder) }
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder
  }
}
