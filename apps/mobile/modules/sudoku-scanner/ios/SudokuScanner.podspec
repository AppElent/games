Pod::Spec.new do |s|
  s.name           = 'SudokuScanner'
  s.version        = '1.0.0'
  s.summary        = 'Reads a sudoku grid from a photo with Apple Vision'
  s.description    = 'Grid detection, perspective correction and digit reading for the Arcade Club sudoku scan, all on the device.'
  s.author         = 'AppElent'
  s.homepage       = 'https://github.com/AppElent/games'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
