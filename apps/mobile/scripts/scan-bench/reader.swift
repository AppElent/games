// The app's scan engine (modules/sudoku-scanner/ios/SudokuScanEngine.swift) as
// a macOS command line tool for bench.mjs: one JSON request per line on stdin,
// one JSON answer per line on stdout. It mirrors SudokuScannerModule.swift.
import CoreGraphics
import Foundation
import UniformTypeIdentifiers

let folder = URL(fileURLWithPath: CommandLine.arguments[1])
let maxDimension: CGFloat = 1600

func url(_ value: Any?) -> URL { URL(fileURLWithPath: value as! String) }
func number(_ value: Any?) -> Double { (value as! NSNumber).doubleValue }

func answer(_ request: [String: Any]) throws -> Any {
  switch request["call"] as! String {
  case "prepareImage":
    let image = try SudokuScanEngine.loadUpright(url(request["uri"]), maxDimension: maxDimension)
    let output = folder.appendingPathComponent("photo-\(UUID().uuidString).jpg")
    try SudokuScanEngine.write(image, to: output, type: .jpeg)
    return ["uri": output.path, "width": image.width, "height": image.height]
  case "turnPhoto":
    // The bench's own: the photo turned `quarters` quarter turns clockwise.
    let image = try SudokuScanEngine.loadImage(url(request["uri"]))
    let quarters = Int(number(request["quarters"]))
    let sideways = quarters % 2 == 1
    let width = sideways ? image.height : image.width
    let height = sideways ? image.width : image.height
    guard let context = CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { throw NSError(domain: "reader", code: 1) }
    // Core Graphics counts y upwards, so a clockwise turn is a negative angle.
    context.translateBy(x: CGFloat(width) / 2, y: CGFloat(height) / 2)
    context.rotate(by: -CGFloat(quarters) * .pi / 2)
    context.draw(image, in: CGRect(
      x: -CGFloat(image.width) / 2, y: -CGFloat(image.height) / 2,
      width: CGFloat(image.width), height: CGFloat(image.height)
    ))
    guard let turned = context.makeImage() else { throw NSError(domain: "reader", code: 2) }
    let output = folder.appendingPathComponent("turned-\(UUID().uuidString).png")
    try SudokuScanEngine.write(turned, to: output, type: .png)
    return ["uri": output.path, "width": width, "height": height]
  case "detectGrid":
    let image = try SudokuScanEngine.loadImage(url(request["uri"]))
    return SudokuScanEngine.detectGrid(in: image)?.map { ["x": $0.x, "y": $0.y] } ?? NSNull() as Any
  case "warpGrid":
    let image = try SudokuScanEngine.loadImage(url(request["uri"]))
    let corners = (request["corners"] as! [[String: Any]]).map { CGPoint(x: number($0["x"]), y: number($0["y"])) }
    let warped = try SudokuScanEngine.warp(image, corners: corners)
    let name = UUID().uuidString
    let output = folder.appendingPathComponent("grid-\(name).png")
    try SudokuScanEngine.write(warped, to: output, type: .png)
    let raw = folder.appendingPathComponent("grid-\(name).raw")
    try Data(SudokuScanEngine.grayPixels(warped)).write(to: raw)
    return ["uri": output.path, "size": warped.width, "raw": raw.path]
  case "readDigits":
    let image = try SudokuScanEngine.loadImage(url(request["uri"]))
    let pixels = try SudokuScanEngine.grayPixels(image)
    let boxes = (request["boxes"] as! [[String: Any]]).map {
      CGRect(x: number($0["x"]), y: number($0["y"]), width: number($0["width"]), height: number($0["height"]))
    }
    return SudokuScanEngine.readDigits(pixels, width: image.width, height: image.height, boxes: boxes)
      .map { ["digit": Double($0.digit), "confidence": $0.confidence] }
  default:
    return NSNull()
  }
}

while let line = readLine() {
  let request = try JSONSerialization.jsonObject(with: Data(line.utf8)) as! [String: Any]
  var reply: [String: Any]
  do { reply = ["value": try answer(request)] } catch { reply = ["error": "\(error)"] }
  let data = try JSONSerialization.data(withJSONObject: reply)
  FileHandle.standardOutput.write(data + Data("\n".utf8))
}
