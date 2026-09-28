# 해설: Windows PowerShell 7용 APK 빌드 자동화입니다. ToolRoot와 OutputApk를 지정하면 다른 폴더에서도 사용할 수 있습니다.
param(
  [string]$ToolRoot = (Join-Path $PSScriptRoot '../android-tools'),
  [string]$OutputApk = (Join-Path $PSScriptRoot '../../outputs/room-atelier-android.apk')
)
# 해설: 도구의 실패를 즉시 확인합니다. 이 소스 압축에는 JDK와 Android SDK를 포함하지 않았습니다.
$ErrorActionPreference = 'Stop'
$toolsDir = (Resolve-Path -LiteralPath $ToolRoot).Path
$jdk = (Get-ChildItem -LiteralPath (Join-Path $toolsDir 'jdk') -Directory | Select-Object -First 1).FullName
$aapt = (Get-ChildItem -LiteralPath (Join-Path $toolsDir 'build-tools') -Recurse -Filter aapt2.exe | Select-Object -First 1).FullName
$buildTools = Split-Path -Parent $aapt
$androidJar = (Get-ChildItem -LiteralPath (Join-Path $toolsDir 'platform') -Recurse -Filter android.jar | Select-Object -First 1).FullName
if (!$jdk -or !$aapt -or !$androidJar) { throw 'JDK 17, Android build-tools 36 and Android platform 35 are required.' }
$java = Join-Path $jdk 'bin/java.exe'
$work = Join-Path $PSScriptRoot 'build'
$main = Join-Path $PSScriptRoot 'app/src/main'
$private = Join-Path $PSScriptRoot '.signing'
New-Item -ItemType Directory -Path $work,(Join-Path $work 'generated'),(Join-Path $work 'classes'),(Join-Path $work 'dex'),$private -Force | Out-Null
# 해설: 실행 파일에 인수 배열을 전달하고 종료 코드가 0이 아니면 빌드를 멈춥니다.
function Run-Tool([string]$Executable, [string[]]$Arguments) {
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Build tool failed: $Executable" }
}
# 해설: 1. 아이콘·문자열 XML을 컴파일하고 manifest와 합쳐 APK의 리소스 부분을 만듭니다.
Run-Tool $aapt @('compile','--dir',(Join-Path $main 'res'),'-o',(Join-Path $work 'resources.zip'))
Run-Tool $aapt @('link','-o',(Join-Path $work 'unsigned.apk'),'-I',$androidJar,'--manifest',(Join-Path $main 'AndroidManifest.xml'),'--java',(Join-Path $work 'generated'),'--auto-add-overlay',(Join-Path $work 'resources.zip'))
# 해설: 2. Java와 생성된 R.java를 javac으로 컴파일한 후 JAR로 묶습니다. JDK 17에서 Java 8 문법·바이트코드 대상으로 빌드합니다.
$sources = @(Get-ChildItem -Path (Join-Path $main 'java'),(Join-Path $work 'generated') -Filter '*.java' -Recurse | ForEach-Object FullName)
Run-Tool (Join-Path $jdk 'bin/javac.exe') (@('-encoding','UTF-8','-source','8','-target','8','-classpath',$androidJar,'-d',(Join-Path $work 'classes')) + $sources)
Run-Tool (Join-Path $jdk 'bin/jar.exe') @('cf',(Join-Path $work 'classes.jar'),'-C',(Join-Path $work 'classes'),'.')
# 해설: 3. D8이 JVM 클래스 파일을 안드로이드가 실행하는 DEX로 변환합니다.
Run-Tool $java @('-cp',(Join-Path $buildTools 'lib/d8.jar'),'com.android.tools.r8.D8','--release','--min-api','26','--lib',$androidJar,'--output',(Join-Path $work 'dex'),(Join-Path $work 'classes.jar'))
# 해설: 4. APK는 ZIP 구조입니다. classes.dex와 웹 자산을 넣습니다. Windows 경로도 APK 안에서는 / 구분자로 정규화해야 합니다.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open((Join-Path $work 'unsigned.apk'),[System.IO.Compression.ZipArchiveMode]::Update)
try {
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $work 'dex/classes.dex'),'classes.dex',[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  $assetRoot = Join-Path $main 'assets'
  foreach ($asset in (Get-ChildItem -LiteralPath $assetRoot -File -Recurse)) {
    $entryName = 'assets/' + [System.IO.Path]::GetRelativePath($assetRoot,$asset.FullName).Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$asset.FullName,$entryName,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }
# 해설: 5. APK 내부 파일을 정렬합니다. 서명 전에 수행해야 합니다.
Run-Tool (Join-Path $buildTools 'zipalign.exe') @('-f','4',(Join-Path $work 'unsigned.apk'),(Join-Path $work 'aligned.apk'))
# 해설: 6. 기존 개인 서명키를 사용하고, 없을 때만 새로 만듭니다. 같은 앱을 업데이트하려면 기존 키가 필요합니다. .signing은 공유 소스에 포함하지 않습니다.
$keyStore = Join-Path $private 'room-atelier.jks'
$keyPassword = Join-Path $private 'password.txt'
if (!(Test-Path -LiteralPath $keyStore)) {
  $random = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($random)
  [System.IO.File]::WriteAllText($keyPassword,[Convert]::ToBase64String($random),[System.Text.Encoding]::ASCII)
  Run-Tool (Join-Path $jdk 'bin/keytool.exe') @('-genkeypair','-keystore',$keyStore,'-storepass:file',$keyPassword,'-keypass:file',$keyPassword,'-alias','room-atelier','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Room Atelier, O=Room Atelier','-noprompt')
}
$OutputApk = [System.IO.Path]::GetFullPath($OutputApk)
New-Item -ItemType Directory -Path (Split-Path -Parent $OutputApk) -Force | Out-Null
# 해설: 7. APK에 서명한 뒤 서명·정렬·패키지 정보를 검사하고 SHA256을 출력합니다.
Run-Tool $java @('-jar',(Join-Path $buildTools 'lib/apksigner.jar'),'sign','--ks',$keyStore,'--ks-key-alias','room-atelier','--ks-pass',('file:'+$keyPassword),'--v4-signing-enabled','false','--out',$OutputApk,(Join-Path $work 'aligned.apk'))
Run-Tool $java @('-jar',(Join-Path $buildTools 'lib/apksigner.jar'),'verify','--verbose','--print-certs',$OutputApk)
Run-Tool (Join-Path $buildTools 'zipalign.exe') @('-c','4',$OutputApk)
Run-Tool $aapt @('dump','badging',$OutputApk)
Get-FileHash -Algorithm SHA256 -LiteralPath $OutputApk
Write-Output "APK ready: $OutputApk"
