# Build file for WebDriver. I wonder if this could be run with JRuby?

require 'rake'
require 'rake/testtask'
require 'rake/rdoctask'

task :default => [:test]

task :build => [:common, :htmlunit, :firefox]

task :clean do
  rm_rf 'common/build'
  rm_rf 'htmlunit/build'
  rm_rf 'jobbie/build'
  rm_rf 'firefox/build'
end

task :test => [:test_htmlunit, :test_firefox] do 
end

task :install_firefox do  
  if windows? then
    dir = ENV['USERPROFILE'] + "\\Application Data\\Mozilla\\Firefox\\Profiles"
    firefox = "c:\\program files\\mozilla firefox\\firefox"
  elsif mac? then
    dir = ENV['HOME'] + "/Library/Application Support/Firefox/Profiles"
    firefox = "/Applications/Firefox.app/Contents/MacOS/firefox"
  elsif linux? then
    dir = ENV['HOME'] + "/.mozilla/Profiles"
    firefox = firefox
  end
  
  if ENV['firefox'] then
    firefox = ENV['firefox']
  end

  return unless File.exists?(dir) && File.exists?(firefox)

  puts "Using firefox: #{firefox}"
  
  # Create the profile
  sh "#{firefox} -CreateProfile WebDriver", :verbose => false
  
  extdir = File.join(File.dirname(__FILE__), "firefox/src/extension")

  dir = Dir[dir + "/*WebDriver"]
  begin
    File.delete(File.join(dir, "extensions.cache"))
  rescue
    # It's okay
  end
  
  if (windows?) then
    extdir = extdir.tr '/', '\\'
  end
  
  File.makedirs File.join(dir, "extensions")
  extension = File.new(File.join(dir, "extensions/fxdriver@thoughtworks.com"), "w")
  extension.puts extdir
  extension.close
  
  sh "#{firefox} -P WebDriver"
end

%w(common htmlunit jobbie firefox).each do |driver|
  source = FileList["#{driver}/src/java/**/*.java"]
  libs = ["#{driver}/lib/runtime/*.jar", "#{driver}/lib/buildtime/*.jar", "common/build/webdriver-common.jar"]
  deps = Array.new
  deps = %w(common/build/webdriver-common.jar) unless driver == "common"
  deps |= source
  file "#{driver}/build/webdriver-#{driver}.jar" => deps do
    javac :jar => "#{driver}/build/webdriver-#{driver}.jar",
              :sources => source,
              :classpath => libs
  end
  tsk = task "#{driver}" => ["#{driver}/build/webdriver-#{driver}.jar"]
  tsk.enhance(%w(common/build/webdriver-common.jar)) unless driver == "common"
  
  libs << "#{driver}/build/webdriver-#{driver}.jar"
  libs << "common/lib/buildtime/*.jar"
  test_source = FileList["#{driver}/test/java/**/*.java"]
  deps << "#{driver}/build/webdriver-#{driver}.jar"
  if (driver != "common") then
    deps << "common/build/webdriver-common-test.jar"
    libs << "common/build/webdriver-common-test.jar"
  end
  file "#{driver}/build/webdriver-#{driver}-test.jar" => deps do
    javac :jar => "#{driver}/build/webdriver-#{driver}-test.jar",
              :sources => test_source,
              :classpath => libs
  end
  tsk = task "test_#{driver}" => ["#{driver}/build/webdriver-#{driver}-test.jar"] do
    libs << "#{driver}/build/webdriver-#{driver}-test.jar"
    junit :in => driver, :classpath => libs, :native_path => ["#{driver}/build", "#{driver}/lib/runtime"]
  end
end

file 'jobbie/build/webdriver-jobbie.dll' => FileList['jobbie/src/csharp/**/*.cs'] do
  sh "MSBuild.exe WebDriver.sln /verbosity:q /target:Rebuild /property:Configuration=Debug", :verbose => true

  File.copy('jobbie/build/InternetExplorerDriver.dll', 'jobbie/lib/runtime')
end

def windows?
  RUBY_PLATFORM =~ /win32/i
end

def mac?
  RUBY_PLATFORM =~ /darwin/i
end

def linux?
  RUBY_PLATFORM =~ /linux/i
end

if windows? then
  Rake::Task[:build].enhance([:jobbie])
  Rake::Task[:test].enhance([:test_jobbie])
  Rake::Task[:test_jobbie].enhance([:jobbie])
  Rake::Task[:jobbie].enhance %w(jobbie/build/webdriver-jobbie.dll)
end

def javac(args)
  # mandatory args  
  out = (args[:jar] or raise 'javac: please specify the :jar parameter')
  source_patterns = (args[:sources] or raise 'javac: please specify the :sources parameter')
  sources = FileList.new(source_patterns)
  raise("No source files found at #{sources.join(', ')}") if sources.empty?
  
  puts "Building: #{out}"
  
  # optional args
  unless args[:exclude].nil?
    args[:exclude].each { |pattern| sources.exclude(pattern) }
  end
  debug = (args[:debug] or true)
  temp_classpath = (args[:classpath]) || []
  
  classpath = FileList.new
  temp_classpath.each do |item|
    classpath.add item
  end
  
  target_dir = "#{out}.classes"
  mkdir_p target_dir, :verbose => false
  
  compile_string = "javac "
  compile_string += "-source 1.4 -target 1.4 "
  compile_string += "-g " if debug 
  compile_string += "-d #{target_dir} "

  compile_string += "-cp " + classpath.join(File::PATH_SEPARATOR) + " " if classpath.length > 1
  
  sources.each do |source| 
    compile_string += " #{source}"
  end
  
  sh compile_string, :verbose => false
  
  jar_string = "jar cf #{out} -C #{target_dir} ."
  sh jar_string, :verbose => false
  
  rm_rf target_dir, :verbose => false
end

def junit(args)
  using = args[:in]
  
  source_dir = "#{using}/test/java"
  source_glob = source_dir + File::SEPARATOR + '**' + File::SEPARATOR + '*.java'
  
  temp_classpath = (args[:classpath]) || []    
  classpath = FileList.new
  temp_classpath.each do |item|
      classpath.add item
  end
  
  tests = FileList.new(source_dir + File::SEPARATOR + '**' + File::SEPARATOR + '*Test.java')
  tests.exclude '**/Abstract*'
  
  test_string = 'java '
  test_string += '-cp ' + classpath.join(File::PATH_SEPARATOR) + ' ' if classpath.length > 1
  test_string += '-Djava.library.path=' + args[:native_path].join(File::PATH_SEPARATOR) + ' ' unless args[:native_path].nil?
  test_string += "-Dfirefox.bin=\"#{ENV['firefox']}\" " unless ENV['firefox'].nil?
  test_string += 'junit.textui.TestRunner'
  puts test_string
  tests.each do |test|
    puts "Looking at #{test}\n"
    name = test.sub("#{source_dir}/", '').gsub('/', '.')
    test_string += " #{name[0, name.size - 5]}"
    result = sh test_string, :verbose => false
  end
end
